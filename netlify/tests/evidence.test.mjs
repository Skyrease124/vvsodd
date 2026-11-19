// Run: node netlify/tests/evidence.test.mjs
// Payment & trust evidence: records, timeline, flags, suspension, restore, refunds vs disputes, webhook dedupe, owner-only admin.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Stripe from 'stripe';
process.env.USERS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'evidence-'));
process.env.OWNER_EMAIL = 'owner@example.com';

const auth = await import('../lib/auth.mjs');
const EV = await import('../lib/evidence.mjs');
const S = await import('../lib/stripe.mjs');
const WH = await import('../functions/stripe-webhook.mjs');
const DS = await import('../functions/disputes.mjs');
const PW = await import('../lib/paywall.mjs');

const T = Math.floor(Date.now() / 1000);
const HOUR = 3600;
const ago = s => T - s;
let n = 0; const ok = msg => { n++; console.log('ok - ' + msg); };

// one member, linked to a Stripe customer
const user = await auth.createUser('member@example.com', 'password123', false);
await S.linkCustomer(user, 'cus_1');

// fake Stripe for the webhook logic (no network). charges are keyed by id.
const charges = {
  ch_1: { id: 'ch_1', created: ago(2 * HOUR), amount: 550, currency: 'usd', customer: 'cus_1', outcome: { risk_level: 'normal', risk_score: 12, network_status: 'approved_by_network', type: 'authorized' }, payment_method_details: { card: { brand: 'visa', country: 'US', funding: 'credit', fingerprint: 'FP_A' } } },
  ch_2: { id: 'ch_2', created: ago(60), amount: 550, currency: 'usd', customer: 'cus_1', outcome: { risk_level: 'normal', risk_score: 9, network_status: 'approved_by_network', type: 'authorized' }, payment_method_details: { card: { brand: 'visa', country: 'US', funding: 'credit', fingerprint: 'FP_A' } } }
};
const fake = {
  charges: { retrieve: async id => { if (!charges[id]) throw Object.assign(new Error('No such charge'), { code: 'resource_missing' }); return charges[id]; } },
  subscriptions: { retrieve: async id => ({ id, status: 'active', items: { data: [{ current_period_end: T + 7 * 864e2 }] }, cancel_at_period_end: false }) }
};
const invoice = (id, charge, created) => ({ id, object: 'invoice', customer: 'cus_1', charge, subscription: 'sub_1', amount_paid: 550, amount_due: 550, currency: 'usd', number: 'NUM-' + id, status_transitions: { paid_at: created }, created, metadata: { plan: 'weekly' }, parent: { subscription_details: { subscription: 'sub_1' } } });
const ev = (id, type, object) => ({ id, object: 'event', type, data: { object } });
const dispute = (id, charge, status = 'needs_response') => ({ id, object: 'dispute', charge, payment_intent: 'pi_' + charge, amount: 550, currency: 'usd', reason: 'fraudulent', status, created: T, evidence_details: { due_by: T + 7 * 864e2 } });

// 1. Payment evidence is written once; a re-sent invoice does not duplicate it
await WH.process_(fake, ev('evt_inv1', 'invoice.paid', invoice('in_1', 'ch_1', ago(2 * HOUR))));
await WH.process_(fake, ev('evt_inv1b', 'invoice.paid', invoice('in_1', 'ch_1', ago(2 * HOUR))));
const u1 = EV.uidOf('member@example.com');
const pays = (await auth.kvList('ev_' + u1 + '__pay_')).length;
assert.equal(pays, 1); ok('one payment record per invoice, even if the event is delivered twice');
const pr = await auth.kvGet('ev_' + u1 + '__pay_in_1');
assert.equal(pr.amount, 5.5); assert.equal(pr.card.brand, 'visa'); assert.equal(pr.card.last4, undefined);
assert.equal(JSON.stringify(pr).includes('4242'), false); ok('payment record holds the amount, Stripe IDs and card brand, never card numbers');

// 2. Subscriber pays but never logs in: the packet says so, nothing is invented
await WH.process_(fake, ev('evt_d1', 'charge.dispute.created', dispute('dp_1', 'ch_1')));
let c = await EV.buildCase('dp_1');
assert.equal(c.lastLogin, null); assert.equal(c.paidLogins, 0); assert.equal(c.downloadCount, 0);
const packetNoLogin = EV.packetHtml(c);
assert.ok(packetNoLogin.includes('Not recorded')); assert.equal(c.timeline.some(r => /signed in/i.test(r.text)), false);
ok('a subscriber who never logged in: no sign-in appears in the timeline; the packet shows Not recorded');

// 3. Downloads after payment: counted and flagged with the exact count
for (let i = 0; i < 12; i++) await EV.logActivity(user, 'file_download', { file: 'ppa-properties-' + i + '.csv', resource: 'property export', count: 1, at: undefined });
c = await EV.buildCase('dp_1');
assert.equal(c.downloadsAfterPayment, 12);
const burst = c.flags.find(f => f.code === 'LARGE_DOWNLOADS_AFTER_PAYMENT');
assert.ok(burst && burst.status === 'MEDIUM' && burst.reason.includes('12 files')); ok('12 downloads after payment: counted, flagged with the exact count');
const rapid = c.flags.find(f => f.code === 'RAPID_DOWNLOADS');
assert.ok(rapid && rapid.status === 'MANUAL REVIEW' && rapid.reason.includes('within 60 seconds')); ok('downloads in a burst are flagged for manual review with the time');

// 4. Normal cancellation: recorded, no dispute, no case
await WH.process_(fake, ev('evt_c1', 'customer.subscription.updated', { id: 'sub_1', object: 'subscription', customer: 'cus_1', status: 'active', cancel_at_period_end: true, items: { data: [{ current_period_end: T + 864e2 }] } }));
await WH.process_(fake, ev('evt_c2', 'customer.subscription.deleted', { id: 'sub_1', object: 'subscription', customer: 'cus_1', status: 'canceled', cancel_at_period_end: false, items: { data: [] } }));
const cancelKeys = await auth.kvList('ev_' + u1 + '__subscription_cancel_requested_');
const endKeys = await auth.kvList('ev_' + u1 + '__subscription_ended_');
assert.equal(cancelKeys.length, 1); assert.equal(endKeys.length, 1); ok('cancellation request and end of subscription are recorded once each');

// 5. Heavy use, then a dispute: access suspended, neutral message, premium use listed
await EV.logActivity(user, 'export_created', { detail: 'csv', count: 14, resource: 'property export' });
await EV.logActivity(user, 'report_generated', { resource: 'Palm Beach 1234' });
await EV.logActivity(user, 'ai_question', {});
await EV.logActivity(user, 'login_success', { session: 'sess_A', device: 'mobile', ip: '203.0.113.5', ua: 'iPhone' });
await WH.process_(fake, ev('evt_d2', 'charge.dispute.created', dispute('dp_2', 'ch_2')));
c = await EV.buildCase('dp_2');
assert.equal(c.paymentStatus, 'DISPUTED'); assert.ok(c.premiumFeatures.includes('export_created') && c.premiumFeatures.includes('report_generated'));
const held = await auth.getUser('member@example.com'); assert.ok(held.disputeHold && held.disputeHold.disputeId === 'dp_2');
assert.equal(auth.isPaid(held), false);
const denied = await PW.requirePaid(new Request('https://x.test/', { headers: { cookie: await cookieFor('member@example.com') } }));
assert.equal(denied.status, 402); const body = await denied.json();
assert.ok(body.error.includes('temporarily unavailable while the payment associated with this membership is under review'));
assert.equal(/fraud|scam/i.test(body.error), false); ok('dispute: paid access suspended; member sees the neutral message, no accusation');

// 6. Stolen-card style case: the packet states what was recorded, not a conclusion
const packet = EV.packetHtml(c);
assert.ok(packet.includes('Payment status') && packet.includes('Internal risk review (not for submission)') && !/is a scammer|proves fraud|confirmed fraud/i.test(packet));
ok('the evidence packet states recorded facts and never concludes fraud');

// 7. Normal refund: REFUNDED, not a dispute
await WH.process_(fake, ev('evt_r1', 'charge.refunded', { ...charges.ch_1, amount_refunded: 550, refunded: true }));
const refunds = (await EV.trustSummary('member@example.com')).refunds;
assert.equal(refunds.length, 1); assert.equal(refunds[0].status, 'REFUNDED'); ok('a normal full refund is recorded as REFUNDED, not as a dispute');

// 8. Partial refund
await WH.process_(fake, ev('evt_r2', 'charge.refunded', { ...charges.ch_2, amount_refunded: 200 }));
const refunds2 = (await EV.trustSummary('member@example.com')).refunds;
assert.ok(refunds2.some(r => r.status === 'PARTIALLY REFUNDED')); ok('a partial refund is recorded as PARTIALLY REFUNDED');

// 9. Duplicate dispute webhook: same dispute, different delivery, one case
await WH.process_(fake, ev('evt_d2b', 'charge.dispute.created', dispute('dp_2', 'ch_2')));
const opens = (await EV.disputeEvents('dp_2')).filter(e => e.type === 'opened');
assert.equal(opens.length, 1); ok('a duplicate dispute delivery does not create a second case');

// 10. Renewal dispute: the disputed charge is matched to its own renewal payment
await WH.process_(fake, ev('evt_inv2', 'invoice.paid', invoice('in_2', 'ch_2', ago(60))));
const c2 = await EV.buildCase('dp_2');
assert.equal(c2.invoice, 'in_2'); ok('a renewal dispute is matched to the renewal payment and its subscription');

// 11. Email changed shortly before the dispute: flagged for manual review
{ const d = await EV.disputeEvents('dp_2'); const opened = d.find(e => e.type === 'opened');
  await auth.kvPut('ev_' + u1 + '__email_changed_test', { k: 'activity', type: 'email_changed', uid: u1, email: 'member@example.com', at: new Date(Date.parse(opened.at) - 3 * 864e5).toISOString() }); }
const c3 = await EV.buildCase('dp_2');
assert.ok(c3.flags.some(f => f.code === 'EMAIL_CHANGED_BEFORE_DISPUTE')); ok('an email change before a dispute is flagged for manual review');

// 12. Dispute lost: payment stays invalid, hold stays, review required
await WH.process_(fake, ev('evt_cl1', 'charge.dispute.closed', dispute('dp_2', 'ch_2', 'lost')));
let lost = await EV.buildCase('dp_2');
assert.equal(lost.paymentStatus, 'CHARGEBACK LOST');
assert.ok((await auth.getUser('member@example.com')).disputeHold); assert.ok(lost.timeline.some(r => /manual review required/.test(r.text)));
ok('dispute lost: CHARGEBACK LOST, access stays suspended until an Admin reviews it');

// 13. Dispute won (manual setting): hold stays until the Admin restores it
await WH.process_(fake, ev('evt_d3', 'charge.dispute.created', dispute('dp_3', 'ch_1')));
await WH.process_(fake, ev('evt_cw1', 'charge.dispute.closed', dispute('dp_3', 'ch_1', 'won')));
assert.equal((await EV.buildCase('dp_3')).paymentStatus, 'CHARGEBACK WON');
assert.ok((await auth.getUser('member@example.com')).disputeHold);
ok('dispute won (manual setting): CHARGEBACK WON, access stays suspended until the Admin restores it');

// 14. Automatic restore on win (setting ON) and suspension OFF
await WH.process_(fake, ev('evt_cl0', 'charge.dispute.closed', dispute('dp_1', 'ch_1', 'lost')));
await EV.setSettings({ restoreOnWin: 'auto' });
await WH.process_(fake, ev('evt_d4', 'charge.dispute.created', dispute('dp_4', 'ch_1')));
await WH.process_(fake, ev('evt_cw2', 'charge.dispute.closed', dispute('dp_4', 'ch_1', 'won')));
const afterWin = await auth.getUser('member@example.com');
assert.ok(!afterWin.disputeHold || afterWin.disputeHold.disputeId !== 'dp_4');
const auditAll = await EV.auditTrail();
assert.ok(auditAll.some(a => a.action === 'access_restored_automatic')); ok('dispute won with auto-restore: access restored automatically and recorded');
await EV.setSettings({ restoreOnWin: 'manual', suspendDuringDispute: false });
await WH.process_(fake, ev('evt_d5', 'charge.dispute.created', dispute('dp_5', 'ch_1')));
assert.equal((await auth.getUser('member@example.com')).disputeHold, undefined);
await EV.setSettings({ suspendDuringDispute: true }); ok('suspension OFF: a dispute does not suspend access');

// 15. Suspicious-activity flags with reasons (multiple disputes = HIGH)
const c4 = await EV.buildCase('dp_3');
assert.ok(c4.flags.some(f => f.code === 'MULTIPLE_DISPUTES_SAME_ACCOUNT' && f.status === 'HIGH' && f.reason.includes('disputes are recorded')));
assert.equal(EV.overallRisk(c4.flags), 'MANUAL REVIEW'); ok('suspicious activity: each flag names its exact reason; overall risk is MANUAL REVIEW because a manual-review flag is also present');

// 16. Admin manually restores access (owner only, reason required, audited)
await auth.createUser('owner@example.com', 'password123', true);
await WH.process_(fake, ev('evt_d6', 'charge.dispute.created', dispute('dp_6', 'ch_1')));
const outsider = await DS.default(new Request('https://x.test/.netlify/functions/disputes?settings=1', { headers: { cookie: await cookieFor('member@example.com') } }));
assert.equal(outsider.status, 403); ok('the disputes page is owner-only');
const restore = await DS.default(new Request('https://x.test/.netlify/functions/disputes', { method: 'POST', headers: { cookie: await cookieFor('owner@example.com'), 'content-type': 'application/json' }, body: JSON.stringify({ action: 'restore', email: 'member@example.com', reason: 'Dispute closed as won, verified with Stripe' }) }));
assert.equal(restore.status, 200);
const restored = await auth.getUser('member@example.com');
assert.equal(restored.disputeHold, undefined);
const trail = await EV.auditTrail();
const rec = trail.find(a => a.action === 'access_restored' && a.by === 'owner@example.com');
assert.ok(rec && rec.original && rec.original.disputeId && rec.reason); ok('admin restore: access returns, the original hold and reason are kept in the audit trail');

// 17. Notes never change the evidence
const before = (await EV.disputeEvents('dp_2')).length;
await EV.addNote('dp_2', 'Customer contacted support before the dispute.', 'owner@example.com');
assert.equal((await EV.disputeEvents('dp_2')).length, before);
assert.equal((await EV.notes('dp_2')).length, 1); ok('an admin note is stored separately and does not change evidence');

// 18. Duplicate delivery of the same Stripe event ID is a no-op at the handler
await auth.kvPut('stripe-config', { secretKey: 'sk_test_dummy', webhookSecret: 'whsec_test' });
const payload = JSON.stringify(ev('evt_dupe_1', 'customer.updated', { id: 'cus_1', object: 'customer' }));
const sig = new Stripe('sk_test_dummy').webhooks.generateTestHeaderString({ payload, secret: 'whsec_test' });
const send = () => WH._handle(new Request('https://x.test/.netlify/functions/stripe-webhook', { method: 'POST', body: payload, headers: { 'stripe-signature': sig } }));
assert.equal((await send()).status, 200);
const second = await send(); assert.equal(await second.text(), 'ok (already handled)'); ok('a re-sent Stripe event is handled once (event IDs are stored)');
const bad = await WH._handle(new Request('https://x.test/.netlify/functions/stripe-webhook', { method: 'POST', body: payload, headers: { 'stripe-signature': 'bad' } }));
assert.equal(bad.status, 400); ok('an unsigned or wrongly signed webhook is rejected');

// 19. Webhook processing failure: not marked handled, so Stripe can retry it safely
const failing = { charges: { retrieve: async () => { throw new Error('upstream down'); } }, subscriptions: fake.subscriptions };
await assert.rejects(WH.process_(failing, ev('evt_fail', 'charge.dispute.created', dispute('dp_9', 'ch_missing'))));
assert.equal((await EV.disputeEvents('dp_9')).length, 0); ok('a failed webhook records nothing half-way, so the retry can run cleanly');

// 20. Family access is not suspended by a dispute on a membership
const fam = await auth.createUser('family@example.com', 'password123', false); fam.family = true; fam.disputeHold = { disputeId: 'x', at: '' };
assert.equal(auth.isPaid(fam), true); ok('family access is not affected by a membership dispute');

// 21. Nothing is recorded that the system does not have (no invented sign-ins)
const trust = await EV.trustSummary('member@example.com');
assert.equal(trust.lifetimeTotal, 11); assert.ok(trust.payments.length >= 1); ok('Payment & Trust History totals come from recorded payments');

console.log('\n' + n + ' checks passed.');

async function cookieFor(email) { return (await auth.sessionCookie(email)).split(';')[0]; }
