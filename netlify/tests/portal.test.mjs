// Run: node netlify/tests/portal.test.mjs   (Stripe is stubbed; no outside network)
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import assert from 'node:assert/strict';
process.env.USERS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ppa-portal-')); process.env.SESSION_SECRET = 't'; process.env.STRIPE_SECRET_KEY = 'sk_test_portal'; process.env.STRIPE_USE_FETCH = '1';
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok -', m); };
const log = []; let haveConfig = false, sessionOk = false;
const J = (code, body) => new Response(JSON.stringify(body), { status: code, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (u, o) => {
  const url = new URL(String(u)), m = (o && o.method || 'GET').toUpperCase(), body = o && o.body ? String(o.body) : ''; log.push(m + ' ' + url.pathname + (body ? ' ' + body : ''));
  if (m === 'GET' && url.pathname.startsWith('/v1/customers/')) return J(200, { id: 'cus_1', object: 'customer' });
  if (m === 'GET' && url.pathname === '/v1/billing_portal/configurations') return J(200, { object: 'list', data: haveConfig ? [{ id: 'bpc_1', is_default: true }] : [], has_more: false });
  if (m === 'POST' && url.pathname === '/v1/billing_portal/configurations') { haveConfig = true; sessionOk = true; return J(200, { id: 'bpc_1', object: 'billing_portal.configuration' }); }
  if (m === 'POST' && url.pathname === '/v1/billing_portal/sessions') return sessionOk || haveConfig ? J(200, { id: 'bps_1', url: 'https://billing.stripe.com/p/session/test' }) : J(400, { error: { type: 'invalid_request_error', message: 'No configuration provided and your live mode default configuration has not been created. Provide a configuration or create your default by saving your customer portal settings in live mode at https://dashboard.stripe.com/settings/billing/portal.' } });
  return J(404, { error: { type: 'invalid_request_error', message: 'unexpected ' + url.pathname } });
};
const auth = await import('../lib/auth.mjs'); const { default: billing } = await import('../functions/billing.mjs');
const u = await auth.createUser('m@x.com', 'pw-123456', false); u.stripeCustomerId = 'cus_1'; await auth.saveUser(u); const ck = (await auth.sessionCookie('m@x.com')).split(';')[0];
const open = async () => billing(new Request('http://x/.netlify/functions/billing', { method: 'POST', headers: { cookie: ck, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'portal' }) }));
let r = await open(), d = await r.json();
ok(r.status === 200 && d.url === 'https://billing.stripe.com/p/session/test', 'Manage subscription opens even when no portal existed yet');
const created = log.filter(l => l.startsWith('POST /v1/billing_portal/configurations'));
ok(created.length === 1, 'the default portal was created exactly once');
const cfg = decodeURIComponent(created[0]).replace(/\+/g, ' ');
ok(/subscription_cancel\]\[enabled\]=true/.test(cfg) && /subscription_cancel\]\[mode\]=at_period_end/.test(cfg), 'it cancels at the end of the paid period, as the policy says');
ok(/payment_method_update\]\[enabled\]=true/.test(cfg) && /invoice_history\]\[enabled\]=true/.test(cfg), 'it allows updating the card and viewing invoices');
ok(/privacy_policy_url\]=https:\/\/pricepocketasset\.com\/legal\/privacy\//.test(cfg) && /terms_of_service_url\]=https:\/\/pricepocketasset\.com\/legal\/terms\//.test(cfg), 'it links the privacy policy and terms');
log.length = 0; r = await open(); d = await r.json();
ok(r.status === 200 && !log.some(l => l.startsWith('POST /v1/billing_portal/configurations')), 'the next time, nothing is created again (no duplicates)');
// an existing default portal is never overwritten
const S = await import('../lib/stripe.mjs'); const Stripe = (await import('stripe')).default; const st = new Stripe('sk_test_portal', { httpClient: Stripe.createFetchHttpClient() }); log.length = 0;
ok((await S.ensurePortal(st)) === 'existing' && !log.some(l => l.startsWith('POST')), 'an existing portal is left exactly as it is');
ok(S.noPortalConfig({ type: 'StripeInvalidRequestError', message: 'No configuration provided and your live mode default configuration has not been created.' }) && !S.noPortalConfig({ type: 'StripeInvalidRequestError', message: 'No such customer' }) && !S.noPortalConfig(new Error('x')), 'only the missing-portal error triggers the creation');
console.log('passed', n);
