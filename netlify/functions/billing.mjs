// Member billing: start a $5.50/week subscription with Stripe Checkout, open the Customer Portal, and re-sync after paying.
import crypto from 'node:crypto';
import * as auth from '../lib/auth.mjs';
import * as S from '../lib/stripe.mjs';

const json = (code, body) => ({ statusCode: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
const tries = new Map();
const rand = n => Array.from(crypto.randomBytes(n), x => 'abcdefghijklmnopqrstuvwxyz'[x % 26]).join('');

async function handle(event) {
  const me = await auth.userFromCookie((event.headers || {}).cookie);
  const cfg = await S.getConfig();
  if (event.httpMethod === 'GET') return json(200, { configured: !!cfg, mode: cfg ? cfg.mode : null, signedIn: !!me, paid: auth.isPaid(me), sub: me && me.sub ? me.sub : null, hasCustomer: !!(me && me.stripeCustomerId) });
  if (event.httpMethod !== 'POST') return json(405, { error: 'Use POST.' });
  if (!me) return json(401, { error: 'Please sign in first.' });
  if (!cfg) return json(503, { error: 'Online payment is not switched on yet.' });
  let b; try { b = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Bad request.' }); }

  const ip = ((event.headers || {})['x-nf-client-connection-ip'] || (event.headers || {})['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  const now = Date.now(), rec = (tries.get(ip) || []).filter(t => now - t < 600000);
  if (rec.length >= 12) return json(429, { error: 'Too many tries. Please wait a few minutes.' });
  rec.push(now); tries.set(ip, rec);

  const stripe = S.client(cfg);
  try {
    if (b.action === 'checkout') {
      if (me.sub && ['active', 'trialing', 'past_due'].includes(me.sub.status) && !me.sub.cancelAtPeriodEnd) return json(400, { error: 'You already have a membership. Use Manage billing.' });
      const price = await S.findPriceId(stripe);
      if (!price) return json(503, { error: 'The membership plan is not set up yet.' });
      const customer = await S.ensureCustomer(stripe, me);
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer,
        line_items: [{ price, quantity: 1 }],
        success_url: S.siteUrl() + '/account/?paid=1',
        cancel_url: S.siteUrl() + '/account/?canceled=1',
        integration_identifier: 'ppa-membership-' + rand(8)
      });
      return json(200, { url: session.url });
    }
    if (b.action === 'portal') {
      if (!me.stripeCustomerId) return json(400, { error: 'You have no billing yet.' });
      const p = await stripe.billingPortal.sessions.create({ customer: me.stripeCustomerId, return_url: S.siteUrl() + '/account/' });
      return json(200, { url: p.url });
    }
    if (b.action === 'sync') {
      // After paying, do not wait for the webhook: ask Stripe for the latest subscription.
      if (!me.stripeCustomerId) return json(200, { paid: auth.isPaid(me) });
      const subs = await stripe.subscriptions.list({ customer: me.stripeCustomerId, status: 'all', limit: 5 });
      const best = subs.data.find(s => ['active', 'trialing'].includes(s.status)) || subs.data[0];
      if (best) await S.applySubscription(me, best);
      return json(200, { paid: auth.isPaid(me), sub: me.sub || null });
    }
    return json(400, { error: 'Unknown action.' });
  } catch (e) {
    console.log('billing error', e && e.type, e && e.message);
    return json(502, { error: 'The payment service had a problem. Please try again.' });
  }
}

async function toEvent(req, context) {
  return { httpMethod: req.method, body: req.method === 'POST' ? await req.text() : null,
    headers: { cookie: req.headers.get('cookie') || '', 'x-nf-client-connection-ip': req.headers.get('x-nf-client-connection-ip') || (context && context.ip) || '', 'x-forwarded-for': req.headers.get('x-forwarded-for') || '' } };
}
export default async (req, context) => {
  const r = await handle(await toEvent(req, context));
  return new Response(r.body, { status: r.statusCode, headers: r.headers });
};
export { handle as _handle };
