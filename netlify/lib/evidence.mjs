// Payment & trust evidence. Everything here is APPEND-ONLY: records are written once and never edited. A dispute case is a
// view built from its records, so nothing can be overwritten. Admin notes and admin actions are records too (audit trail).
// Nothing in this file is shown to members. The owner reads it through /.netlify/functions/disputes (owner only).
// Never stored: card numbers, CVC, passwords, API keys. Card data kept is only Stripe's own non-sensitive identifiers (brand, country, fingerprint).
import crypto from 'node:crypto';
import * as auth from './auth.mjs';
import * as P from './policy.mjs';

const nowIso = () => new Date().toISOString();
const stamp = () => nowIso().replace(/[:.]/g, '-');          // sortable and safe in a key
const rnd = () => crypto.randomBytes(4).toString('hex');
const idOf = v => (v == null ? null : typeof v === 'string' ? v : (v.id || null));
const isoOf = s => (s ? new Date(s * 1000).toISOString() : null);
export const uidOf = email => crypto.createHash('sha256').update(auth.normEmail(email)).digest('hex').slice(0, 16);
// The owner's notification address is set in the OWNER_EMAIL environment variable (not written into the code).
export const ownerEmail = () => process.env.OWNER_EMAIL || '';

export const DEFAULTS = {
  suspendDuringDispute: true,   // Admin setting. ON by default: paid access funded by a disputed payment is suspended.
  restoreOnWin: 'manual',       // 'manual' (Admin restores) or 'auto' (restore automatically when the dispute is won and no other dispute is open)
  burstFiles: 10, burstHours: 48,   // many files downloaded soon after payment
  rapidFiles: 5, rapidSeconds: 60,  // automated-looking download speed
  retentionYears: 7             // stored setting only. Automatic deletion is NOT built yet (see the notes in the admin page).
};
export async function getSettings() { return { ...DEFAULTS, ...((await auth.kvGet('evidence-settings')) || {}) }; }
export async function setSettings(patch) {
  const cur = (await auth.kvGet('evidence-settings')) || {};
  const next = { ...cur };
  for (const k of Object.keys(DEFAULTS)) if (patch && patch[k] !== undefined) next[k] = patch[k];
  await auth.kvPut('evidence-settings', next);
  return getSettings();
}

// ---- append-only storage -------------------------------------------------------------------------------------------
// A counter keeps records written in the same millisecond in the order they were written (random suffixes would not).
let SEQ = 0;
async function append(prefix, rec) { const key = prefix + '__' + stamp() + '_' + String(++SEQ).padStart(7, '0') + '_' + rnd(); await auth.kvPut(key, rec); return key; }
async function appendOnce(key, rec) { if (await auth.kvGet(key)) return false; await auth.kvPut(key, rec); return true; }
async function readAll(prefix) {
  const keys = (await auth.kvList(prefix)).sort(); const out = [];
  for (const k of keys) { const r = await auth.kvGet(k); if (r) out.push(r); }
  return out;
}
const userEvents = uid => readAll('ev_' + uid + '__');

// ---- human-readable helpers ---------------------------------------------------------------------------------------
export const humanTime = iso => (iso ? new Date(iso).toLocaleString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) : 'Not recorded');
export function deviceOf(ua) {
  const s = String(ua || ''); if (!s) return null;
  if (/iPad|Tablet/i.test(s)) return 'tablet';
  if (/Mobi|iPhone|Android/i.test(s)) return 'mobile';
  return 'desktop';
}
// The session id inside the signed session cookie (no secret is read or stored).
export function sessionOf(cookieHeader) {
  const m = String(cookieHeader || '').match(/(?:^|;\s*)ppa_s=([^;]+)/); if (!m) return null;
  try { return JSON.parse(Buffer.from(m[1].split('.')[0], 'base64url').toString()).sid || null; } catch (e) { return null; }
}

// ---- activity log (sign-in, sign-out, downloads, exports, reports, cancellations, email changes) --------------------
// ctx: { ip, ua, session, page, resource, file, count, result, detail }. Only what the request legitimately carries.
export async function logActivity(user, type, ctx = {}) {
  if (!user || !user.email) return null;
  const at = nowIso(), uid = uidOf(user.email);
  return append('ev_' + uid, {
    k: 'activity', type, uid, email: user.email, at, human: humanTime(at),
    ip: ctx.ip || null, ua: ctx.ua || null, device: deviceOf(ctx.ua), session: ctx.session || null,
    page: ctx.page || null, resource: ctx.resource || null, file: ctx.file || null,
    count: ctx.count == null ? null : ctx.count,
    subscription: (user.sub && user.sub.id) || null, paidThrough: user.paidThrough || null,
    result: ctx.result || 'ok', detail: ctx.detail || null
  });
}

// ---- payments -----------------------------------------------------------------------------------------------------
function safeMetadata(m) {
  const out = {}; if (!m || typeof m !== 'object') return out;
  for (const [k, v] of Object.entries(m).slice(0, 10)) if (typeof v === 'string' && v.length <= 200) out[k] = v;
  return out;
}
// Written once per paid invoice (subscription first payment, renewal). Charge details come from Stripe; no card number is read.
export async function recordInvoicePaid(user, invoice, charge, subId) {
  const card = (charge && charge.payment_method_details && charge.payment_method_details.card) || {};
  const outcome = (charge && charge.outcome) || {};
  const tds = card.three_d_secure || null;
  const paidAt = isoOf((charge && charge.created) || (invoice.status_transitions && invoice.status_transitions.paid_at) || invoice.created) || nowIso();
  const uid = uidOf(user.email);
  const rec = {
    k: 'payment', status: 'paid', uid, email: user.email, accountCreated: user.created || null,
    stripeCustomerId: user.stripeCustomerId || idOf(invoice.customer),
    invoice: invoice.id, orderRef: invoice.number || invoice.id, paymentIntent: idOf(invoice.payment_intent),
    charge: charge ? charge.id : idOf(invoice.charge), subscription: subId || idOf(invoice.subscription),
    product: 'PricePocketAsset Member (weekly membership)', tier: 'Pro',
    amount: (invoice.amount_paid != null ? invoice.amount_paid : invoice.amount_due || 0) / 100, currency: invoice.currency || null,
    paidAt, metadata: safeMetadata(invoice.metadata),
    risk: { riskLevel: outcome.risk_level || null, riskScore: outcome.risk_score == null ? null : outcome.risk_score, networkStatus: outcome.network_status || null, outcomeType: outcome.type || null },
    threeDSecure: tds ? { authenticated: !!tds.authenticated, result: tds.result || null, version: tds.version || null } : null,
    card: { brand: card.brand || null, country: card.country || null, funding: card.funding || null, fingerprint: card.fingerprint || null },
    recordedAt: nowIso()
  };
  const wrote = await appendOnce('ev_' + uid + '__pay_' + invoice.id, rec);
  if (rec.charge) await appendOnce('chg_' + rec.charge, { uid, email: user.email, invoice: invoice.id, paidAt, amount: rec.amount, currency: rec.currency, subscription: rec.subscription, fingerprint: rec.card.fingerprint || null });
  if (rec.card.fingerprint) await appendOnce('fp_' + rec.card.fingerprint + '__' + uid, { uid, at: nowIso() });
  return wrote;
}
export async function recordPaymentFailed(user, invoice) {
  const uid = uidOf(user.email);
  return appendOnce('ev_' + uid + '__payfail_' + invoice.id + '_' + (invoice.attempt_count || 1), {
    k: 'payment', status: 'failed', uid, email: user.email, invoice: invoice.id, orderRef: invoice.number || invoice.id,
    amount: (invoice.amount_due || 0) / 100, currency: invoice.currency || null, at: nowIso(), attempt: invoice.attempt_count || 1
  });
}
// A refund (full or partial) on a charge. A normal refund is recorded as REFUNDED / PARTIALLY REFUNDED, never as a dispute.
export async function recordRefund(user, charge) {
  const refunded = charge.amount_refunded || 0, total = charge.amount || 0, uid = uidOf(user.email);
  return appendOnce('ev_' + uid + '__ref_' + charge.id + '_' + refunded, {
    k: 'refund', uid, email: user.email, charge: charge.id, amount: total / 100, refunded: refunded / 100, currency: charge.currency || null,
    full: refunded >= total, status: refunded >= total ? 'REFUNDED' : 'PARTIALLY REFUNDED', at: nowIso(), source: 'Stripe refund webhook'
  });
}
export async function chargeOwner(chargeId) { return chargeId ? auth.kvGet('chg_' + chargeId) : null; }

// ---- terms and refund policy acceptance (exact version at the time of purchase; never edited) -----------------------
export async function recordTerms(user, { ip, ua, kind = 'subscription' }) {
  const at = nowIso(), uid = uidOf(user.email);
  return append('ev_' + uid, {
    k: 'terms', uid, email: user.email, at, human: humanTime(at), kind,
    termsVersion: P.POLICY_VERSION, refundPolicyVersion: P.POLICY_VERSION,
    acceptance: 'Terms of Service and Refund Policy accepted at checkout (box ticked before any charge)',
    ip: ip || null, ua: ua || null
  });
}
export async function recordTermsLink(user, { subscription, session }) {
  return append('ev_' + uidOf(user.email), { k: 'terms_link', uid: uidOf(user.email), email: user.email, at: nowIso(), subscription: subscription || null, session: session || null });
}
// Subscription cancellation requested (cancel at period end) or ended. One record per subscription and type.
export async function recordSubscriptionEvent(user, type, subId) {
  const uid = uidOf(user.email), at = nowIso();
  return appendOnce('ev_' + uid + '__' + type + '_' + subId, { k: 'activity', type, uid, email: user.email, at, human: humanTime(at), subscription: subId, result: 'ok', detail: 'Stripe subscription ' + subId });
}
// Early fraud warning from the card network (Stripe radar.early_fraud_warning.created). Recorded as a warning, not as a dispute.
export async function recordWarning(user, warningId, chargeId) {
  const uid = uidOf(user.email);
  return appendOnce('ev_' + uid + '__warn_' + warningId, { k: 'warning', type: 'fraud_warning', uid, email: user.email, at: nowIso(), charge: chargeId || null, warningId });
}
// A Stripe event whose customer is not linked to any member account. Kept so nothing is silently lost.
export async function recordUnmatched(eventType, objectId, customerId) {
  return append('unmatched', { k: 'unmatched', eventType, objectId: objectId || null, customerId: customerId || null, at: nowIso() });
}
export async function unmatchedList() { return readAll('unmatched__'); }

// ---- disputes (Stripe charge.dispute.* events) ----------------------------------------------------------------------
export async function recordDispute(d, type, extra = {}) {
  const at = nowIso();
  return append('dsp_' + d.id, {
    k: 'dispute', type, disputeId: d.id, chargeId: idOf(d.charge), paymentIntent: idOf(d.payment_intent),
    status: d.status || null, reason: d.reason || null, amount: (d.amount || 0) / 100, currency: d.currency || null,
    dueBy: isoOf(d.evidence_details && d.evidence_details.due_by), stripeCreated: isoOf(d.created), at, ...extra
  });
}
export async function disputeIds() { return [...new Set((await auth.kvList('dsp_')).map(k => k.slice(4).split('__')[0]))]; }
export async function disputeEvents(id) { return readAll('dsp_' + id + '__'); }
// A dispute-related event that is not a Stripe event (for example an Admin restoring access). Appended, never edited.
export async function disputeLog(disputeId, type, extra = {}) { return append('dsp_' + disputeId, { k: 'dispute', type, disputeId, at: nowIso(), ...extra }); }

// Admin notes: private, separate from the evidence records (never change them).
export async function addNote(disputeId, text, adminEmail) {
  return append('note_' + disputeId, { k: 'note', disputeId, text: String(text || '').slice(0, 2000), by: adminEmail, at: nowIso() });
}
export async function notes(disputeId) { return readAll('note_' + disputeId + '__'); }
// Audit trail for every admin change: original value, new value, admin, time, reason.
export async function audit(action, adminEmail, { target, original, next, reason }) {
  return append('audit', { k: 'audit', action, by: adminEmail, at: nowIso(), target: target || null, original: original == null ? null : original, next: next == null ? null : next, reason: reason || null });
}
export async function auditTrail() { return readAll('audit__'); }

// Access suspension. Only the paid access funded by the disputed payment: family access codes and the owner are not touched.
export async function suspendForDispute(user, disputeId) {
  const original = user.disputeHold || null;
  user.disputeHold = { disputeId, at: nowIso() };
  await auth.saveUser(user);
  return original;
}
export async function restoreAccess(user, { by, reason, automatic }) {
  const original = user.disputeHold || null;
  delete user.disputeHold;
  await auth.saveUser(user);
  await audit(automatic ? 'access_restored_automatic' : 'access_restored', by || 'system', { target: user.email, original, next: null, reason });
  return original;
}

// ---- risk flags (internal only; each flag names the exact fact that triggered it) -------------------------------------
const RANK = { LOW: 0, MEDIUM: 1, HIGH: 2, 'MANUAL REVIEW': 3 };
export function overallRisk(flags) {
  if (!flags.length) return 'LOW';
  return flags.reduce((a, f) => (RANK[f.status] > RANK[a] ? f.status : a), 'LOW');
}
const fmtDay = iso => (iso ? new Date(iso).toISOString().slice(0, 10) : 'an unknown date');

export async function computeFlags(c) {
  const s = c.settings, flags = [], dl = c.downloads;
  const after = c.paidAt ? dl.filter(d => d.at >= c.paidAt && (Date.parse(d.at) - Date.parse(c.paidAt)) <= s.burstHours * 3600e3) : [];
  const nAfter = after.reduce((n, d) => n + (d.count || 1), 0);
  if (nAfter >= s.burstFiles) flags.push({ code: 'LARGE_DOWNLOADS_AFTER_PAYMENT', status: nAfter >= s.burstFiles * 5 ? 'HIGH' : 'MEDIUM',
    reason: nAfter + ' files were downloaded within ' + s.burstHours + ' hours after the payment of ' + fmtDay(c.paidAt) + '.' });
  for (let i = 0; i + s.rapidFiles - 1 < dl.length; i++) {
    const a = dl[i], b = dl[i + s.rapidFiles - 1];
    if (Date.parse(b.at) - Date.parse(a.at) <= s.rapidSeconds * 1000) { flags.push({ code: 'RAPID_DOWNLOADS', status: 'MANUAL REVIEW', reason: s.rapidFiles + ' downloads were recorded within ' + s.rapidSeconds + ' seconds (first at ' + a.human + ').' }); break; }
  }
  if (c.disputeAt) {
    const before = dl.filter(d => d.at <= c.disputeAt && (Date.parse(c.disputeAt) - Date.parse(d.at)) <= 14 * 864e5);
    const nBefore = before.reduce((n, d) => n + (d.count || 1), 0);
    if (nBefore >= s.burstFiles) flags.push({ code: 'DOWNLOADS_BEFORE_DISPUTE', status: 'MEDIUM', reason: nBefore + ' files were downloaded in the 14 days before the dispute was opened on ' + fmtDay(c.disputeAt) + '.' });
    const em = c.activity.filter(a => a.type === 'email_changed' && a.at <= c.disputeAt && (Date.parse(c.disputeAt) - Date.parse(a.at)) <= 14 * 864e5);
    if (em.length) flags.push({ code: 'EMAIL_CHANGED_BEFORE_DISPUTE', status: 'MANUAL REVIEW', reason: 'The account email was changed on ' + fmtDay(em[0].at) + ', within 14 days before the dispute.' });
    const fails = c.activity.filter(a => a.type === 'login_failed' && a.at <= c.disputeAt && (Date.parse(c.disputeAt) - Date.parse(a.at)) <= 864e5);
    if (fails.length >= 10) flags.push({ code: 'FAILED_LOGIN_BURST', status: 'MEDIUM', reason: fails.length + ' failed sign-in attempts were recorded in the 24 hours before the dispute.' });
  }
  if (c.disputeCount >= 2) flags.push({ code: 'MULTIPLE_DISPUTES_SAME_ACCOUNT', status: 'HIGH', reason: c.disputeCount + ' disputes are recorded for this account.' });
  if (c.refundCount >= 2) flags.push({ code: 'REPEATED_REFUNDS', status: 'MEDIUM', reason: c.refundCount + ' refunds are recorded for this account.' });
  if (c.failedPayments >= 2) flags.push({ code: 'FAILED_PAYMENTS', status: 'MEDIUM', reason: c.failedPayments + ' failed payment attempts are recorded for this account.' });
  if (c.sharedFingerprint) flags.push({ code: 'SAME_CARD_OTHER_ACCOUNTS', status: 'MEDIUM', reason: 'The same card (Stripe fingerprint) was used on ' + c.sharedFingerprint + ' other account(s) on this site.' });
  const sessions = new Set(c.activity.filter(a => a.type === 'login_success' && a.session && (!c.disputeAt || a.at <= c.disputeAt)).map(a => a.session));
  if (sessions.size >= 5) flags.push({ code: 'MANY_SESSIONS', status: 'MANUAL REVIEW', reason: sessions.size + ' different sign-in sessions are recorded for this account.' });
  return flags;
}

// ---- the case: built only from recorded events -------------------------------------------------------------------------
const FEATURE_TYPES = ['ai_question', 'premium_search', 'report_generated', 'export_created', 'file_download', 'premium_view', 'property_opened', 'dashboard_view'];
export async function buildCase(id, { settings } = {}) {
  const evs = await disputeEvents(id); if (!evs.length) return null;
  const st = settings || await getSettings();
  const opened = evs.find(e => e.type === 'opened') || evs[0];
  // the status comes from Stripe's dispute events only (admin and hold entries never change the status)
  const STATE = ['opened', 'updated', 'closed', 'funds_withdrawn', 'funds_reinstated'];
  const latest = evs.filter(e => STATE.includes(e.type)).pop() || evs[evs.length - 1];
  const closed = evs.filter(e => e.type === 'closed').pop() || null;
  const uid = opened.uid || null, email = opened.email || null;
  const user = email ? await auth.getUser(email) : null;
  const ev = uid ? await userEvents(uid) : [];
  const activity = ev.filter(e => e.k === 'activity');
  const pays = ev.filter(e => e.k === 'payment');
  const paid = pays.filter(p => p.status === 'paid');
  const payment = paid.find(p => p.charge === opened.chargeId) || paid[0] || null;
  const paidAt = payment ? payment.paidAt : null;
  const disputeAt = opened.at;
  const termsList = ev.filter(e => e.k === 'terms');
  const refunds = ev.filter(e => e.k === 'refund');
  const downloads = activity.filter(a => a.type === 'file_download');
  const afterPay = activity.filter(a => !paidAt || a.at >= paidAt);
  const logins = activity.filter(a => a.type === 'login_success');
  const lastLogin = logins.length ? logins[logins.length - 1] : null;
  const loginsAfter = paidAt ? logins.filter(a => a.at >= paidAt) : [];
  // other disputes on the same account, and this card on other accounts
  let previous = 0;
  for (const other of await disputeIds()) { if (other === id) continue; const o = (await disputeEvents(other)).find(e => e.type === 'opened'); if (o && uid && o.uid === uid) previous++; }
  let shared = 0;
  if (payment && payment.card && payment.card.fingerprint) {
    shared = (await auth.kvList('fp_' + payment.card.fingerprint + '__')).filter(k => !k.endsWith('__' + uid)).length;
  }
  const refundCount = refunds.length, failedPayments = pays.filter(p => p.status === 'failed').length;
  const c = {
    settings: st, paidAt, disputeAt, activity, downloads: downloads.map(d => ({ ...d, count: d.count || 1 })), disputeCount: previous + 1, refundCount,
    failedPayments, sharedFingerprint: shared
  };
  const flags = await computeFlags(c);
  // payment status (spec 17): dispute states are kept separate from ordinary refunds
  const fullRefund = refunds.some(r => r.full), anyRefund = refunds.length > 0;
  let paymentStatus = 'PAID';
  if (latest.type !== 'closed') paymentStatus = 'DISPUTED';
  else if (latest.status === 'won') paymentStatus = 'CHARGEBACK WON';
  else if (latest.status === 'lost') paymentStatus = 'CHARGEBACK LOST';
  else paymentStatus = 'OTHER FINAL STATUS: ' + (latest.status || 'unknown');
  if (latest.type === 'closed' && !['won', 'lost'].includes(latest.status) && anyRefund) paymentStatus = fullRefund ? 'REFUNDED' : 'PARTIALLY REFUNDED';

  // timeline: real records only, from payment through dispute (plus the terms accepted at checkout)
  const rows = [];
  for (const p of paid) if (!paidAt || p.paidAt === paidAt) rows.push({ at: p.paidAt, text: 'Payment successfully completed: ' + money(p.amount, p.currency) + ' (invoice ' + p.invoice + ')' });
  for (const t of termsList) rows.push({ at: t.at, text: 'Accepted Terms of Service version ' + t.termsVersion + ' and Refund Policy version ' + t.refundPolicyVersion + ' (' + t.kind + ' checkout)' });
  for (const a of activity) if ((!paidAt || a.at >= paidAt) && (!disputeAt || a.at <= disputeAt)) rows.push({ at: a.at, text: ACTIVITY_TEXT(a) });
  for (const r of refunds) rows.push({ at: r.at, text: (r.status === 'REFUNDED' ? 'Refunded' : 'Partially refunded') + ': ' + money(r.refunded, r.currency) });
  for (const w of ev.filter(e => e.k === 'warning')) if (!paidAt || w.at >= paidAt) rows.push({ at: w.at, text: 'Early fraud warning received from the card network' });
  for (const e of evs) rows.push({ at: e.at, text: DISPUTE_TEXT(e) });
  rows.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

  const dueBy = latest.dueBy || opened.dueBy || null;
  return {
    id, status: latest.status || opened.status || null, paymentStatus, reason: opened.reason || null,
    amount: opened.amount, currency: opened.currency, chargeId: opened.chargeId, paymentIntent: opened.paymentIntent,
    customerEmail: email, uid, matched: !!uid, userStatus: userStatus(user),
    invoice: payment ? payment.invoice : null, orderRef: payment ? payment.orderRef : null,
    subscriptionId: payment ? payment.subscription : null, stripeCustomerId: payment ? payment.stripeCustomerId : null,
    purchasedAt: paidAt, disputedAt: disputeAt, dueBy, closedAt: closed ? closed.at : null,
    accountCreated: user ? user.created : null, lastLogin: lastLogin ? lastLogin.at : null,
    paidLogins: loginsAfter.length, firstLoginAfterPayment: loginsAfter[0] ? loginsAfter[0].at : null,
    downloadCount: c.downloads.reduce((n, d) => n + d.count, 0), downloadsAfterPayment: c.downloads.filter(d => !paidAt || d.at >= paidAt).reduce((n, d) => n + d.count, 0),
    premiumFeatures: [...new Set(afterPay.map(a => a.type).filter(t => FEATURE_TYPES.includes(t)))],
    refunds: refunds.map(r => ({ at: r.at, status: r.status, refunded: r.refunded, currency: r.currency })), previousDisputes: previous,
    terms: termsList.map(t => ({ at: t.at, termsVersion: t.termsVersion, refundPolicyVersion: t.refundPolicyVersion, kind: t.kind, ip: t.ip || null, ua: t.ua || null })),
    riskStatus: overallRisk(flags), flags, timeline: rows,
    accessHold: user && user.disputeHold ? user.disputeHold : null,
    events: evs.map(e => ({ type: e.type, at: e.at, status: e.status || null, eventId: e.eventId || null }))
  };
}
function userStatus(user) {
  if (!user) return 'No matching member account';
  if (user.revoked) return 'Account deactivated by owner';
  if (user.disputeHold) return 'Paid access suspended during a dispute (account preserved)';
  return user.owner ? 'Owner account' : (user.family ? 'Family access' : 'Member');
}
export function money(amount, currency) { return (amount == null ? 'Not recorded' : '$' + Number(amount).toFixed(2) + ' ' + String(currency || 'usd').toUpperCase()); }
function ACTIVITY_TEXT(a) {
  const f = a.file ? ' (' + a.file + ')' : '';
  switch (a.type) {
    case 'login_success': return 'Customer signed in' + (a.device ? ' on ' + a.device : '');
    case 'login_failed': return 'Failed sign-in attempt';
    case 'logout': return 'Customer signed out';
    case 'file_download': return 'Downloaded file' + f;
    case 'export_created': return 'Created ' + (a.detail || 'export') + ' with ' + (a.count == null ? 'Not recorded' : a.count) + ' item(s)';
    case 'report_generated': return 'Generated report' + (a.resource ? ' ' + a.resource : '');
    case 'premium_search': return 'Used premium search';
    case 'ai_question': return 'Used the AI question box';
    case 'email_changed': return 'Account email changed';
    case 'subscription_cancel_requested': return 'Cancellation requested (ends at the end of the paid period)';
    case 'subscription_ended': return 'Subscription ended';
    default: return a.type.replace(/_/g, ' ');
  }
}
function DISPUTE_TEXT(e) {
  switch (e.type) {
    case 'opened': return 'Payment dispute opened (' + (e.reason || 'reason not given') + ')';
    case 'updated': return 'Dispute updated by Stripe (status: ' + (e.status || 'not recorded') + ')';
    case 'closed': return 'Dispute closed by Stripe (status: ' + (e.status || 'not recorded') + ')';
    case 'funds_withdrawn': return 'Disputed amount withdrawn from the account by Stripe';
    case 'funds_reinstated': return 'Disputed amount returned by Stripe';
    case 'access_suspended': return 'Paid access suspended while the payment is under review';
    case 'access_restored': return 'Paid access restored';
    case 'review_required': return 'Access kept suspended: manual review required';
    case 'fraud_warning': return 'Early fraud warning received from the card network';
    default: return e.type;
  }
}

// ---- evidence packet (a clean page for the owner to review before anything is sent to Stripe) ---------------------------
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const nr = v => (v == null || v === '' || (Array.isArray(v) && !v.length) ? 'Not recorded' : esc(Array.isArray(v) ? v.join(', ') : v));
const row = (k, v, raw) => '<tr><th>' + esc(k) + '</th><td>' + (raw ? v : nr(v)) + '</td></tr>';
export function packetHtml(c) {
  const h = humanTime;
  const tl = c.timeline.length ? c.timeline.map(r => '<li><b>' + esc(h(r.at)) + '</b> ' + esc(r.text) + '</li>').join('') : '<li>Not recorded</li>';
  const flagRows = c.flags.length ? c.flags.map(f => '<li><b>' + esc(f.status) + '</b>: ' + esc(f.reason) + ' <i>(' + esc(f.code) + ')</i></li>').join('') : '<li>No internal risk flags recorded</li>';
  const terms = c.terms.length ? c.terms.map(t => 'Terms of Service version ' + esc(t.termsVersion) + ', Refund Policy version ' + esc(t.refundPolicyVersion) + ', accepted ' + esc(h(t.at))).join('<br>') : 'Not recorded';
  const refunds = c.refunds.length ? c.refunds.map(r => esc(r.status) + ' ' + esc(money(r.refunded, r.currency)) + ' on ' + esc(h(r.at))).join('<br>') : 'None recorded';
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Evidence packet ' + esc(c.id) + '</title><style>body{font:15px/1.5 -apple-system,Segoe UI,sans-serif;max-width:820px;margin:24px auto;padding:0 16px;color:#111}h1{font-size:22px}h2{font-size:17px;border-bottom:1px solid #ccc;padding-bottom:4px;margin-top:26px}table{width:100%;border-collapse:collapse}th{text-align:left;width:38%;color:#444;font-weight:600;vertical-align:top;padding:4px 8px 4px 0}td{padding:4px 0}li{margin:4px 0}.muted{color:#666}</style></head><body>'
    + '<h1>Evidence packet: dispute ' + esc(c.id) + '</h1><p class="muted">Draft for owner review. Built only from recorded records. Not submitted to Stripe. Generated ' + esc(h(nowIso())) + '.</p>'
    + '<h2>Customer information</h2><table>' + row('Customer name', null) + row('Email', c.customerEmail) + row('User ID', c.uid) + row('Account created', h(c.accountCreated)) + '</table>'
    + '<h2>Payment information</h2><table>' + row('Product purchased', 'PricePocketAsset Member (weekly membership)') + row('Subscription tier', c.subscriptionId ? 'Pro (weekly)' : null) + row('Payment date', h(c.purchasedAt)) + row('Amount', money(c.amount, c.currency)) + row('Invoice', c.invoice) + row('Order reference', c.orderRef) + row('Stripe customer', c.stripeCustomerId) + row('Stripe payment intent', c.paymentIntent) + row('Stripe charge', c.chargeId) + row('Stripe subscription', c.subscriptionId) + row('Payment status', c.paymentStatus) + '</table>'
    + '<h2>Dispute</h2><table>' + row('Stripe dispute ID', c.id) + row('Reason', c.reason) + row('Stripe status', c.status) + row('Dispute opened', h(c.disputedAt)) + row('Evidence due', h(c.dueBy)) + row('Account status', c.userStatus) + '</table>'
    + '<h2>Account access evidence</h2><table>' + row('Last sign-in', h(c.lastLogin)) + row('First sign-in after payment', h(c.firstLoginAfterPayment)) + row('Sign-ins after payment', c.paidLogins) + '</table>'
    + '<h2>Product usage evidence</h2><table>' + row('Files downloaded (total)', c.downloadCount) + row('Files downloaded after payment', c.downloadsAfterPayment) + row('Premium features used after payment', c.premiumFeatures) + '</table>'
    + '<h2>Terms evidence</h2><p>' + terms + '</p>'
    + '<h2>Refund and support evidence</h2><table>' + row('Refunds', refunds, true) + row('Previous disputes on this account', c.previousDisputes) + '</table>'
    + '<h2>Chronological timeline</h2><ul>' + tl + '</ul>'
    + '<h2>Internal risk review (not for submission)</h2><p>Overall: <b>' + esc(c.riskStatus) + '</b></p><ul>' + flagRows + '</ul>'
    + '</body></html>';
}

// Payment & Trust History for one customer (owner view).
export async function trustSummary(email) {
  const user = await auth.getUser(email); if (!user) return null;
  const uid = uidOf(email), ev = await userEvents(uid), acts = ev.filter(e => e.k === 'activity');
  const pays = ev.filter(e => e.k === 'payment'), paid = pays.filter(p => p.status === 'paid');
  const logins = acts.filter(a => a.type === 'login_success'), dls = acts.filter(a => a.type === 'file_download');
  const terms = ev.filter(e => e.k === 'terms'), refunds = ev.filter(e => e.k === 'refund');
  const disputes = [];
  for (const id of await disputeIds()) { const o = (await disputeEvents(id)).find(e => e.type === 'opened'); if (o && o.uid === uid) disputes.push({ id, at: o.at }); }
  const last = a => (a.length ? a[a.length - 1].at : null);
  return {
    email, uid, accountCreated: user.created || null, userStatus: userStatus(user),
    lifetimeTotal: paid.reduce((n, p) => n + (p.amount || 0), 0), currency: (paid[0] && paid[0].currency) || 'usd',
    currentSubscription: user.sub ? { status: user.sub.status, id: user.sub.id, periodEnd: user.sub.periodEnd || null, cancelAtPeriodEnd: !!user.sub.cancelAtPeriodEnd } : null,
    payments: paid.map(p => ({ at: p.paidAt, amount: p.amount, currency: p.currency, invoice: p.invoice })),
    failedPayments: pays.filter(p => p.status === 'failed').length,
    refunds: refunds.map(r => ({ at: r.at, status: r.status, refunded: r.refunded })),
    disputes, downloadCount: dls.reduce((n, d) => n + (d.count || 1), 0), lastDownload: last(dls),
    lastPremiumActivity: last(acts.filter(a => FEATURE_TYPES.includes(a.type))), lastLogin: last(logins),
    terms: terms.map(t => ({ at: t.at, termsVersion: t.termsVersion, refundPolicyVersion: t.refundPolicyVersion }))
  };
}
