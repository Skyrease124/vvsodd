// Run: node netlify/tests/donate.test.mjs   (no outside network)
import assert from 'node:assert/strict'; import * as D from '../lib/donate.mjs';
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok -', m); };
ok(D.cents(5) === 500 && D.cents('$25') === 2500 && D.cents('12.50') === 1250 && D.cents(' 10 ') === 1000, 'amounts become whole cents');
ok(D.cents(0.5) === null && D.cents(0) === null && D.cents(-5) === null && D.cents('abc') === null && D.cents(null) === null && D.cents(501) === null && D.cents(NaN) === null, 'under $1, over $500 and junk are refused');
ok(D.cents(1) === 100 && D.cents(500) === 50000, '$1 and $500 are allowed');
const p = D.sessionParams(2500, 'https://pricepocketasset.com');
ok(p.mode === 'payment' && p.submit_type === 'donate' && p.line_items.length === 1 && p.line_items[0].price_data.unit_amount === 2500 && p.line_items[0].price_data.currency === 'usd', 'one-time payment, one line, USD');
ok(!JSON.stringify(p).includes('subscription') && !p.customer && !p.line_items[0].price, 'not a subscription and not tied to the membership price or any customer');
ok(p.success_url === 'https://pricepocketasset.com/donate/?thanks=1' && p.cancel_url === 'https://pricepocketasset.com/donate/', 'returns to the donate page');
ok(p.metadata.kind === 'donation', 'tagged as a donation');
// the existing webhook only acts on subscription checkouts, so a donation changes no member
import fs from 'node:fs'; const wh = fs.readFileSync(new URL('../functions/stripe-webhook.mjs', import.meta.url), 'utf8'); ok(/o\.mode !== 'subscription'/.test(wh), 'webhook ignores non-subscription checkouts');
// function: validation and not-configured behaviour
process.env.USERS_DIR = fs.mkdtempSync(new URL('file:///tmp/').pathname + 'ppa-don-'); delete process.env.STRIPE_SECRET_KEY;
const { default: fn } = await import('../functions/donate.mjs'); const call = (m, b) => fn(new Request('http://x/.netlify/functions/donate', { method: m, headers: { 'content-type': 'application/json' }, body: m === 'POST' ? JSON.stringify(b || {}) : undefined }));
let r = await call('GET'); ok((await r.json()).configured === false, 'reports not configured when Stripe has no key');
r = await call('POST', { amount: 10 }); ok(r.status === 503, 'no key: a friendly "not switched on" answer, nothing charged');
console.log('passed', n);
