// Run: node netlify/tests/policy.test.mjs   (temporary member folder; Stripe is stubbed, no outside network)
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import assert from 'node:assert/strict';
process.env.USERS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ppa-pol-')); process.env.SESSION_SECRET = 't'; process.env.STRIPE_SECRET_KEY = 'sk_test_policy'; process.env.STRIPE_USE_FETCH = '1';
let stripeCalls = []; globalThis.fetch = async (u, o) => { stripeCalls.push(String(u)); return new Response(JSON.stringify({ error: { type: 'invalid_request_error', message: 'stubbed' } }), { status: 400, headers: { 'content-type': 'application/json' } }); };
const root = new URL('../../kinvest-liens/', import.meta.url).pathname, read = f => fs.readFileSync(root + f, 'utf8'), text = f => read(f).replace(/<[^>]+>/g, ' ').replace(/&rsquo;/g, '’').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok -', m); };
const auth = await import('../lib/auth.mjs'); const P = await import('../lib/policy.mjs'); const D = await import('../lib/donate.mjs'); const { default: billing } = await import('../functions/billing.mjs'); const { default: donate } = await import('../functions/donate.mjs');
const B = text('legal/billing/index.html'), Dn = text('legal/donations/index.html'), T = text('legal/terms/index.html'), Pv = text('legal/privacy/index.html'), A = read('account/index.html'), At = text('account/index.html');
// --- the pages say what the business actually does ---
const stripeSrc = fs.readFileSync(new URL('../lib/stripe.mjs', import.meta.url), 'utf8');
ok(/unit_amount: 550/.test(stripeSrc) && /interval: 'week'/.test(stripeSrc) && P.PLAN.cents === 550 && P.PLAN.interval === 'week', 'the Stripe price is $5.50 per week and matches the policy constants');
for (const [name, t] of [['billing policy', B], ['account checkout disclosure', At], ['Stripe Checkout text', P.subscriptionCheckoutText('https://x')]]) ok(/\$5\.50/.test(t) && /week/i.test(t), name + ' states $5.50 per week');
ok(/automatic/i.test(B) && /until (you )?cancel/i.test(B) && /no free trial|Free trial.*None/i.test(B), 'billing policy explains automatic weekly renewal until cancelled');
ok(/Manage subscription/.test(B) && /Cancel plan/.test(B) && /end of the week you have already paid for/.test(B) && /end of the week you have already paid for/.test(At), 'cancellation steps and when it takes effect are shown, before payment and in the policy');
ok(/subscription_cancel: \{ enabled: true, mode: 'at_period_end' \}/.test(stripeSrc), 'the Stripe portal really cancels at the end of the paid period');
ok(/original payment method/.test(B) && /original payment method/.test(Dn), 'approved refunds return to the original payment method');
ok(/bank or card issuer/.test(B) && /nothing in this policy asks you to wait or to give that up/.test(B) && /dispute an unauthorized charge/.test(B), 'customers keep the right to contact their bank and dispute charges');
ok(/cannot guarantee that every unauthorized or fraudulent transaction will be detected/.test(B) && /cannot guarantee that every unauthorized transaction will be detected/.test(Dn), 'no guarantee against fraud is claimed');
ok(!/never responsible|not responsible for any|Stripe (assumes|is liable for) all|you waive|waive your right to (dispute|a chargeback)/i.test(B + Dn + T), 'no blanket disclaimers, no waiver of statutory or chargeback rights');
ok(/cannot legally be limited or waived/.test(T) && /cannot legally be limited/.test(B), 'liability limits preserve rights that cannot be waived');
ok(/own, or that the owner has given you permission|own or have permission|own or have its owner/.test(B + Dn + At), 'payment-method ownership and permission is required');
ok(/never see or store/.test(B) && /never see or store/.test(Dn) && /security code/.test(B), 'no card numbers or security codes are stored');
ok(/optional/i.test(Dn) && /one-time/.test(Dn) && /not (described or offered as )?tax-deductible/.test(Dn) && !/tax[- ]deductible/i.test(Dn.replace(/not (described or offered as )?tax-deductible|not tax-deductible|tax-exempt or tax-deductible|should not treat them as deductible/gi, '')), 'donations: optional, one time, and never described as tax deductible');
ok(/received by the owner and operator/.test(Dn) && /cover the cost of running/.test(Dn) && /refund/.test(Dn), 'donations say who receives the money, what it is for, and the refund rule');
ok(/Stripe/.test(Pv) && /policy version/.test(Pv) && /never see or store/.test(Pv), 'privacy policy explains payment data and consent records');
ok(/support\/billing/.test(read('legal/billing/index.html')) && fs.existsSync(root + 'support/billing/index.html') && /data-netlify="true"/.test(read('support/billing/index.html')), 'a billing support contact exists and is linked');
// --- consent is collected before payment and enforced on the server ---
ok(/id="subok"/.test(A) && /authorize PricePocketAsset to charge \$5\.50 every week/.test(At) && /id="subgo"[^>]*disabled/.test(A), 'the account page asks for explicit recurring-billing consent and keeps Continue disabled until ticked');
const js = read('account/account.js'); ok(js.includes("version: POLICY_VERSION") && js.includes("POLICY_VERSION = '" + P.POLICY_VERSION + "'"), 'the page sends the same policy version the server expects');
const dj = read('donate/donate.js'); ok(dj.includes("version: '" + P.SUPPORT_TERMS_VERSION + "'") && /id="dnOk"/.test(read('donate/index.html')), 'the donate page sends the current policy version and requires the box');
ok(B.includes('version ' + P.POLICY_VERSION) && Dn.includes('version ' + P.SUPPORT_TERMS_VERSION), 'the policy pages show the same version');
const u = await auth.createUser('m@x.com', 'pw-123456', false); const ck = (await auth.sessionCookie('m@x.com')).split(';')[0];
const call = async (body) => billing(new Request('http://x/.netlify/functions/billing', { method: 'POST', headers: { cookie: ck, 'content-type': 'application/json' }, body: JSON.stringify(body) }));
let r = await call({ action: 'checkout' }); let d = await r.json(); ok(r.status === 400 && d.needConsent && stripeCalls.length === 0, 'checkout without consent is refused before Stripe is contacted');
r = await call({ action: 'checkout', consent: { terms: true, recurring: false, version: P.POLICY_VERSION } }); ok(r.status === 400 && stripeCalls.length === 0, 'terms without recurring-billing consent is refused');
r = await call({ action: 'checkout', consent: { terms: true, recurring: true, version: 'old' } }); ok(r.status === 400 && stripeCalls.length === 0, 'an out-of-date policy version is refused');
r = await call({ action: 'checkout', consent: { terms: true, recurring: true, version: P.POLICY_VERSION } }); const m = await auth.getUser('m@x.com'); const c = (m.consents || [])[0];
ok(c && c.kind === 'subscription' && c.version === P.POLICY_VERSION && c.recurring === true && c.terms === true && c.priceCents === 550 && c.interval === 'week' && /^\d{4}-\d\d-\d\dT/.test(c.at), 'the accepted version, time and recurring consent are recorded on the member');
ok(!JSON.stringify(c).match(/card|cvc|ip"/i), 'the consent record holds no card data and no IP address');
// --- donations ---
const dc = async (body) => donate(new Request('http://x/.netlify/functions/donate', { method: 'POST', headers: { 'content-type': 'application/json', 'x-nf-client-connection-ip': '9.9.9.' + Math.floor(Math.random() * 250) }, body: JSON.stringify(body) }));
stripeCalls = []; r = await dc({ amount: 10 }); d = await r.json(); ok(r.status === 400 && d.needConsent && stripeCalls.length === 0, 'a donation without the confirmation is refused before Stripe is contacted');
r = await dc({ amount: 10, ack: { optional: true, version: P.SUPPORT_TERMS_VERSION } }); ok(r.status === 502 && stripeCalls.length >= 1, 'with the confirmation the request reaches Stripe (stubbed here)');
const sp = D.sessionParams(1000, 'https://pricepocketasset.com', '2026-11-18T00:00:00Z'); ok(sp.mode === 'payment' && sp.metadata.policy_version === P.SUPPORT_TERMS_VERSION && sp.metadata.ack_at && /not tax-deductible/.test(sp.custom_text.submit.message) && sp.payment_method_options.card.request_three_d_secure === 'automatic', 'donation checkout carries the policy version, confirmation time, a plain notice and automatic 3D Secure');
ok(P.subscriptionCheckoutText('https://pricepocketasset.com').length <= 1200 && P.donationCheckoutText('https://pricepocketasset.com').length <= 1200, 'Stripe Checkout messages fit the 1,200-character limit');
// --- nothing collects raw card details ---
const scan = ['account/account.js', 'account/index.html', 'donate/index.html', 'donate/donate.js', 'plans/index.html'].map(read).join('\n'); ok(!/card-?number|cardnumber|cvc|cvv|autocomplete="cc-/i.test(scan), 'no page or script collects card numbers or security codes');
// --- footers link the policies ---
const home = read('index.html'); ok(/legal\/billing\//.test(home) && /donate\//.test(home), 'the home page footer links the billing policy');
// --- support terms: their own version; the earlier version stays on existing records; subscriptions unchanged ---
ok(P.SUPPORT_TERMS_VERSION === '2026-11-23' && P.SUPPORT_TERMS_PREVIOUS_VERSION === '2026-11-18' && P.POLICY_VERSION === '2026-11-18', 'support terms carry version 2026-11-23, the earlier version is kept, and subscriptions keep POLICY_VERSION');
stripeCalls = []; r = await dc({ amount: 10, ack: { optional: true, version: P.SUPPORT_TERMS_PREVIOUS_VERSION } }); d = await r.json(); ok(r.status === 400 && d.needConsent && d.version === P.SUPPORT_TERMS_VERSION && stripeCalls.length === 0, 'a contribution confirmed against the earlier terms is refused until the current terms are accepted');
ok(sp.metadata.policy_version === '2026-11-23' && sp.payment_intent_data.description === 'PricePocketAsset voluntary support' && sp.payment_intent_data.metadata.kind === 'donation', 'new contributions are described as "PricePocketAsset voluntary support" and keep the donation tag');
ok(B.includes('Last updated') && Dn.includes('Last updated: November 23, 2026 (version 2026-11-23)') && Dn.includes('version 2026-11-18'), 'the Support Terms show the November 23, 2026 version and the earlier version that applies to older contributions');
console.log('passed', n);
