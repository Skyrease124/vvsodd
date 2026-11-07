// Stripe webhooks: keeps who-is-paid in sync with Stripe (renewals, failed payments, cancellations) and flags refunds, disputes and fraud warnings.
import * as S from '../lib/stripe.mjs';
import { kvGet, kvPut, saveUser } from '../lib/auth.mjs';

const subIdOf = inv => (inv.parent && inv.parent.subscription_details && inv.parent.subscription_details.subscription) || inv.subscription || null;
async function flag(user, type, ref) {
  user.billingAlert = { type, ref: ref || '', at: new Date().toISOString() };
  await saveUser(user);
}

export async function process_(stripe, event) {
  const o = event.data.object;
  switch (event.type) {
    case 'checkout.session.completed': {
      if (o.mode !== 'subscription' || !o.customer) break;
      const u = await S.userForCustomer(o.customer); if (!u) break;
      if (o.subscription) await S.applySubscription(u, await stripe.subscriptions.retrieve(typeof o.subscription === 'string' ? o.subscription : o.subscription.id));
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const u = await S.userForCustomer(typeof o.customer === 'string' ? o.customer : o.customer.id); if (!u) break;
      await S.applySubscription(u, o);
      break;
    }
    case 'invoice.paid':
    case 'invoice.payment_failed': {
      const cust = typeof o.customer === 'string' ? o.customer : (o.customer && o.customer.id);
      const u = cust && await S.userForCustomer(cust); if (!u) break;
      const sid = subIdOf(o);
      if (sid) await S.applySubscription(u, await stripe.subscriptions.retrieve(typeof sid === 'string' ? sid : sid.id));
      if (event.type === 'invoice.payment_failed') await flag(u, 'payment_failed', o.id);
      else if (u.billingAlert && u.billingAlert.type === 'payment_failed') { delete u.billingAlert; await saveUser(u); }
      break;
    }
    case 'charge.refunded':
    case 'charge.dispute.created':
    case 'radar.early_fraud_warning.created': {
      let chargeId = event.type === 'charge.refunded' ? o.id : o.charge;
      if (chargeId && typeof chargeId !== 'string') chargeId = chargeId.id;
      if (!chargeId) break;
      let ch = o;
      if (event.type !== 'charge.refunded') { try { ch = await stripe.charges.retrieve(chargeId); } catch (e) { if (e && e.code === 'resource_missing') break; throw e; } }
      const cust = typeof ch.customer === 'string' ? ch.customer : (ch.customer && ch.customer.id);
      const u = cust && await S.userForCustomer(cust); if (!u) break;
      await flag(u, event.type === 'charge.refunded' ? 'refunded' : event.type === 'charge.dispute.created' ? 'dispute' : 'fraud_warning', chargeId);
      break;
    }
    case 'customer.updated': break; // we keep no local copy of the customer's details
    default: break;
  }
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
  if (await kvGet('evt_' + event.id)) return new Response('ok (already handled)', { status: 200 });
  try { await process_(stripe, event); }
  catch (e) { console.log('webhook error', event.type, e && e.message); return new Response('retry', { status: 500 }); }
  await kvPut('evt_' + event.id, { at: new Date().toISOString(), type: event.type });
  return new Response('ok', { status: 200 });
}
export default async req => handle(req);
export { handle as _handle };
