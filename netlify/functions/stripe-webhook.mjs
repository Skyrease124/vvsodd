// Stripe webhooks: keeps who-is-paid in sync with Stripe (renewals, failed payments, cancellations) and flags refunds, disputes and fraud warnings.
// Payment & trust evidence (netlify/lib/evidence.mjs) is written from the same events. Evidence records are append-only.
import * as S from '../lib/stripe.mjs';
import * as EV from '../lib/evidence.mjs';
import * as auth from '../lib/auth.mjs';
import { kvGet, kvPut, saveUser } from '../lib/auth.mjs';

const subIdOf = inv => (inv.parent && inv.parent.subscription_details && inv.parent.subscription_details.subscription) || inv.subscription || null;
const idOf = v => (v == null ? null : typeof v === 'string' ? v : (v.id || null));
async function flag(user, type, ref) {
  user.billingAlert = { type, ref: ref || '', at: new Date().toISOString() };
  await saveUser(user);
}

// Private owner pushes (never to members). Failures here never affect billing.
const ownerPing = (t, b, k) => import('../lib/retail.mjs').then(R => R.notifyOwner(t, b, '/members/', k)).catch(() => {});
// Owner alerts for disputes and webhook failures: a bell/push plus an email to the owner's address (set in OWNER_EMAIL). Never throws.
async function alertOwner(title, body, key, path = '/admin/disputes/') {
  await import('../lib/retail.mjs').then(R => R.notifyOwner(title, body, path, key)).catch(() => {});
  const to = EV.ownerEmail();
  if (to) await auth.sendMail(to, title, body).catch(() => {});
}
// The member a Stripe customer belongs to, or null.
async function memberOf(customer) {
  const cust = idOf(customer); return cust ? S.userForCustomer(cust) : null;
}
// Payment records need the card details Stripe holds for the charge. A missing charge is fine; a network error is retried.
async function chargeOf(stripe, chargeRef) {
  const id = idOf(chargeRef); if (!id) return null;
  try { return await stripe.charges.retrieve(id); } catch (e) { if (e && e.code === 'resource_missing') return null; throw e; }
}
// Who a disputed charge belongs to: from our own payment record first (no network), else from Stripe.
async function memberForCharge(stripe, chargeId) {
  const map = chargeId && await EV.chargeOwner(chargeId);
  if (map && map.email) return { email: map.email, user: await auth.getUser(map.email), paidAt: map.paidAt, amount: map.amount, currency: map.currency };
  const ch = chargeId && await chargeOf(stripe, chargeId);
  const u = ch && await memberOf(ch.customer);
  return u ? { email: u.email, user: u, paidAt: null } : { email: null, user: null };
}

export async function process_(stripe, event) {
  const o = event.data.object;
  switch (event.type) {
    case 'checkout.session.completed': {
      if (o.mode !== 'subscription' || !o.customer) break;
      const u = await S.userForCustomer(o.customer); if (!u) break;
      const subId = idOf(o.subscription);
      if (o.subscription) await S.applySubscription(u, await stripe.subscriptions.retrieve(typeof o.subscription === 'string' ? o.subscription : o.subscription.id));
      await EV.recordTermsLink(u, { subscription: subId, session: o.id });
      await ownerPing('New Pro member', 'A member just started a Pro subscription.', 'pro' + event.id);
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const u = await S.userForCustomer(typeof o.customer === 'string' ? o.customer : o.customer.id); if (!u) break;
      await S.applySubscription(u, o);
      if (event.type === 'customer.subscription.updated' && o.cancel_at_period_end) await EV.recordSubscriptionEvent(u, 'subscription_cancel_requested', o.id);
      if (event.type === 'customer.subscription.deleted') await EV.recordSubscriptionEvent(u, 'subscription_ended', o.id);
      break;
    }
    case 'invoice.paid':
    case 'invoice.payment_failed': {
      const cust = typeof o.customer === 'string' ? o.customer : (o.customer && o.customer.id);
      const u = cust && await S.userForCustomer(cust);
      if (!u) { await EV.recordUnmatched(event.type, o.id, cust); break; }
      const sid = subIdOf(o);
      if (sid) await S.applySubscription(u, await stripe.subscriptions.retrieve(typeof sid === 'string' ? sid : sid.id));
      if (event.type === 'invoice.paid') await EV.recordInvoicePaid(u, o, await chargeOf(stripe, o.charge), idOf(sid));
      else await EV.recordPaymentFailed(u, o);
      await ownerPing(event.type === 'invoice.paid' ? 'Payment received' : 'Payment failed', event.type === 'invoice.paid' ? 'A Pro payment went through.' : 'A Pro payment failed. Stripe will retry.', 'inv' + event.id);
      if (event.type === 'invoice.payment_failed') await flag(u, 'payment_failed', o.id);
      else if (u.billingAlert && u.billingAlert.type === 'payment_failed') { delete u.billingAlert; await saveUser(u); }
      break;
    }
    case 'charge.refunded': {
      const u = await memberOf(o.customer);
      if (!u) { await EV.recordUnmatched(event.type, o.id, idOf(o.customer)); break; }
      await EV.recordRefund(u, o);
      await flag(u, 'refunded', o.id);
      break;
    }
    case 'charge.dispute.created': await onDisputeOpened(stripe, event, o); break;
    case 'charge.dispute.updated': await onDisputeChanged(stripe, event, o, 'updated'); break;
    case 'charge.dispute.funds_withdrawn': await onDisputeChanged(stripe, event, o, 'funds_withdrawn'); break;
    case 'charge.dispute.funds_reinstated': await onDisputeChanged(stripe, event, o, 'funds_reinstated'); break;
    case 'charge.dispute.closed': await onDisputeClosed(stripe, event, o); break;
    case 'radar.early_fraud_warning.created': {
      const chargeId = idOf(o.charge); if (!chargeId) break;
      const who = await memberForCharge(stripe, chargeId); if (!who.user) break;
      await EV.recordWarning(who.user, o.id, chargeId);
      await flag(who.user, 'fraud_warning', chargeId);
      break;
    }
    case 'customer.updated': break; // we keep no local copy of the customer's details
    default: break;
  }
}

// ---- disputes ----------------------------------------------------------------------------------------------------------
async function onDisputeOpened(stripe, event, d) {
  const existing = await EV.disputeEvents(d.id);
  if (existing.some(e => e.type === 'opened')) return;   // the same dispute was already recorded
  const chargeId = idOf(d.charge);
  const who = await memberForCharge(stripe, chargeId);
  const u = who.user;
  const extra = { eventId: event.id, email: who.email, uid: who.email ? EV.uidOf(who.email) : null, matched: !!u };
  await EV.recordDispute(d, 'opened', extra);
  const settings = await EV.getSettings();
  if (u && !u.owner && settings.suspendDuringDispute) {
    await EV.suspendForDispute(u, d.id);
    await EV.recordDispute(d, 'access_suspended', { eventId: event.id, email: who.email, uid: extra.uid, matched: true });
  }
  if (u) await flag(u, 'dispute', chargeId);
  const purchase = who.paidAt ? new Date(who.paidAt).toISOString().slice(0, 10) : 'not recorded';
  const body = [
    'Customer: ' + (who.email || 'no matching member account'),
    'Amount: $' + ((d.amount || 0) / 100).toFixed(2) + ' ' + String(d.currency || '').toUpperCase(),
    'Purchase: PricePocketAsset Member (weekly membership)',
    'Dispute reason: ' + (d.reason || 'not given'),
    'Payment date: ' + purchase,
    'Dispute opened: ' + new Date().toISOString().slice(0, 10),
    'Access: ' + (u && u.disputeHold ? 'suspended while the dispute is open (Admin setting)' : 'not suspended'),
    '', 'View Dispute Evidence: /admin/disputes/?id=' + encodeURIComponent(d.id)
  ].join('\n');
  await alertOwner('Payment Dispute Opened', body, 'dsp' + event.id, '/admin/disputes/?id=' + encodeURIComponent(d.id));
}
async function onDisputeChanged(stripe, event, d, type) {
  const opened = (await EV.disputeEvents(d.id)).find(e => e.type === 'opened') || {};
  await EV.recordDispute(d, type, { eventId: event.id, email: opened.email || null, uid: opened.uid || null, matched: !!opened.uid });
}
async function onDisputeClosed(stripe, event, d) {
  const evs = await EV.disputeEvents(d.id);
  const opened = evs.find(e => e.type === 'opened') || {};
  await EV.recordDispute(d, 'closed', { eventId: event.id, email: opened.email || null, uid: opened.uid || null, matched: !!opened.uid });
  const u = opened.email ? await auth.getUser(opened.email) : null;
  if (!u || !u.disputeHold || u.disputeHold.disputeId !== d.id) {
    // nothing suspended for this dispute; nothing to restore
  } else if (d.status === 'won') {
    const settings = await EV.getSettings();
    const others = await otherOpenDisputes(opened.uid, d.id);
    if (settings.restoreOnWin === 'auto' && others === 0) {
      await EV.restoreAccess(u, { by: 'system', reason: 'Dispute won. Restored automatically (Admin setting).', automatic: true });
      await EV.recordDispute(d, 'access_restored', { eventId: event.id, email: u.email, uid: opened.uid, matched: true });
    } else {
      await EV.recordDispute(d, 'review_required', { eventId: event.id, email: u.email, uid: opened.uid, matched: true, note: 'Dispute won. Access stays suspended until the Admin restores it.' });
    }
  } else {
    // lost or any other final status: the disputed payment stays invalid until the Admin reviews it
    await EV.recordDispute(d, 'review_required', { eventId: event.id, email: opened.email || null, uid: opened.uid || null, matched: !!opened.uid, note: 'Dispute ' + (d.status || 'closed') + '. Admin review required before anything is restored.' });
  }
  const body = ['Payment Dispute Closed', '', 'Customer: ' + (opened.email || 'no matching member account'), 'Dispute: ' + d.id, 'Stripe final status: ' + (d.status || 'not given'), 'Review it: /admin/disputes/?id=' + encodeURIComponent(d.id)].join('\n');
  await alertOwner('Payment Dispute Closed: ' + (d.status || 'final'), body, 'dspc' + event.id, '/admin/disputes/?id=' + encodeURIComponent(d.id));
}
// Number of other disputes for this account that are still open.
async function otherOpenDisputes(uid, exceptId) {
  if (!uid) return 0;
  let n = 0;
  for (const id of await EV.disputeIds()) {
    if (id === exceptId) continue;
    const evs = await EV.disputeEvents(id);
    const o = evs.find(e => e.type === 'opened');
    if (o && o.uid === uid && !evs.some(e => e.type === 'closed')) n++;
  }
  return n;
}

async function handle(req) {
  if (req.method !== 'POST') return new Response('Use POST', { status: 405 });
  const cfg = await S.getConfig();
  if (!cfg || !cfg.webhookSecret) return new Response('Webhook not configured', { status: 503 });
  const raw = await req.text();
  const stripe = S.client(cfg);
  let event;
  try { event = stripe.webhooks.constructEvent(raw, req.headers.get('stripe-signature') || '', cfg.webhookSecret); }
  catch (e) { return new Response('Bad signature', { status: 400 }); }
  // Stripe event IDs make a re-delivered event a no-op, so a retry never creates a second dispute case.
  if (await kvGet('evt_' + event.id)) return new Response('ok (already handled)', { status: 200 });
  const received = new Date().toISOString();
  try { await process_(stripe, event); }
  catch (e) {
    const msg = String((e && e.message) || e).slice(0, 300);
    console.log('webhook error', event.type, msg);
    await kvPut('whe_' + event.id, { at: received, type: event.type, error: msg, retryFrom: 'Stripe' }).catch(() => {});
    await alertOwner('Webhook needs attention', 'Stripe event ' + event.type + ' (' + event.id + ') could not be processed. Stripe will retry it automatically. Error: ' + msg, 'whe' + event.id, '/admin/disputes/').catch(() => {});
    return new Response('retry', { status: 500 });
  }
  await kvPut('evt_' + event.id, { at: received, processedAt: new Date().toISOString(), type: event.type, result: 'ok' });
  return new Response('ok', { status: 200 });
}
export default async req => handle(req);
export { handle as _handle };
