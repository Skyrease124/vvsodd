// Run: node netlify/tests/support-wording.test.mjs   (temporary member folder; Stripe is stubbed, no outside network)
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import assert from 'node:assert/strict';
process.env.USERS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ppa-support-')); process.env.SESSION_SECRET = 't'; process.env.STRIPE_SECRET_KEY = 'sk_test_support'; process.env.STRIPE_USE_FETCH = '1';
let stripeCalls = []; globalThis.fetch = async (u) => { stripeCalls.push(String(u)); return new Response(JSON.stringify({ error: { type: 'invalid_request_error', message: 'stubbed' } }), { status: 400, headers: { 'content-type': 'application/json' } }); };
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok -', m); };
const { kindOf } = await import('../functions/owner-payments.mjs');
const D = await import('../lib/donate.mjs');
const { default: donate } = await import('../functions/donate.mjs');

// 1. Owner dashboard classification: both donation descriptions count as donations; subscriptions and other payments do not change
ok(kindOf({ payment_intent: { description: 'PricePocketAsset donation', metadata: {} } }) === 'donations', 'the earlier description "PricePocketAsset donation" is still classified as a donation');
ok(kindOf({ payment_intent: { description: 'PricePocketAsset voluntary support', metadata: {} } }) === 'donations', 'the new description "PricePocketAsset voluntary support" is classified as a donation');
ok(kindOf({ payment_intent: { description: null, metadata: { kind: 'donation' } } }) === 'donations', 'the donation tag in the metadata still classifies a donation');
ok(kindOf({ invoice: 'in_1', payment_intent: { description: 'PricePocketPro weekly', metadata: {} } }) === 'pro', 'a Pro subscription invoice is still Pro revenue');
ok(kindOf({ payment_intent: { description: 'Something else', metadata: {} } }) === 'other', 'unrelated payments stay under Other');

// 2. Customer-facing Stripe product description for new contributions
const sp = D.sessionParams(1000, 'https://pricepocketasset.com', '2026-11-23T00:00:00Z');
ok(sp.line_items[0].price_data.product_data.description === 'A voluntary contribution to support the development and maintenance of PricePocketAsset.', 'the Stripe product description is the customer-facing wording');
ok(sp.line_items[0].price_data.unit_amount === 1000 && sp.mode === 'payment' && sp.submit_type === 'donate' && sp.payment_intent_data.metadata.kind === 'donation', 'the amount, payment mode and donation tag are unchanged');

// 3. Validation: the wording changed, the rules did not
const send = body => donate(new Request('http://x/.netlify/functions/donate', { method: 'POST', headers: { 'content-type': 'application/json', 'x-nf-client-connection-ip': '7.7.7.' + Math.floor(Math.random() * 250) }, body: JSON.stringify(body) }));
stripeCalls = [];
let r = await send({ amount: 10 }); let d = await r.json();
ok(r.status === 400 && d.needConsent === true && /optional voluntary contribution/.test(d.error) && /Support Terms/.test(d.error), 'a contribution without the confirmation is refused, with the new wording');
ok(stripeCalls.length === 0, 'nothing reaches Stripe without the confirmation');
r = await send({ amount: 10, ack: { optional: true, version: '2026-11-18' } }); d = await r.json();
ok(r.status === 400 && d.needConsent === true && d.version === '2026-11-23' && stripeCalls.length === 0, 'the earlier terms version is still refused (validation rule unchanged)');
r = await send({ amount: 10, ack: { optional: false, version: '2026-11-23' } });
ok(r.status === 400 && stripeCalls.length === 0, 'an unticked confirmation is still refused');
r = await send({ amount: 10, ack: { optional: true, version: '2026-11-23' } });
ok(r.status === 502 && stripeCalls.length >= 1, 'a valid confirmation reaches Stripe (stubbed here; nothing is charged)');
console.log('passed', n);
