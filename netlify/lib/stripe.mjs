// Stripe Billing for the $5.50/week membership. Keys live server-side only: env first, else saved by the owner on /billing/.
import Stripe from 'stripe';
import crypto from 'node:crypto';
import { kvGet, kvPut, getUser, saveUser } from './auth.mjs';

export const LOOKUP_KEY = 'ppa_member_weekly';
const SITE = () => process.env.SITE_URL || 'https://pricepocketasset.com';
export const siteUrl = SITE;

export async function getConfig() {
  const saved = (await kvGet('stripe-config')) || {};
  const secretKey = process.env.STRIPE_SECRET_KEY || saved.secretKey || '';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || saved.webhookSecret || '';
  if (!secretKey) return null;
  return { secretKey, webhookSecret, mode: /^(sk|rk)_live_/.test(secretKey) ? 'live' : 'test', savedAt: saved.savedAt, source: process.env.STRIPE_SECRET_KEY ? 'env' : 'saved' };
}
export async function saveConfig(c) { await kvPut('stripe-config', { ...c, savedAt: new Date().toISOString() }); }
export async function eraseConfig() { await kvPut('stripe-config', {}); }
export function client(cfg) {
  const opts = { maxNetworkRetries: 2 };
  if (process.env.STRIPE_USE_FETCH) opts.httpClient = Stripe.createFetchHttpClient(); // lets local tests go through the sandbox proxy
  return new Stripe(cfg.secretKey, opts);
}

const dateOf = sec => new Date(sec * 1000).toISOString().slice(0, 10);
// Newer API versions keep the billing period on the subscription items.
export function periodEnd(sub) {
  const ends = (sub.items && sub.items.data || []).map(i => i.current_period_end).filter(Boolean);
  const e = ends.length ? Math.max(...ends) : sub.current_period_end;
  return e ? dateOf(e) : '';
}

// Copies a Stripe subscription onto our member record. Access = paidThrough date.
export async function applySubscription(user, sub) {
  const end = periodEnd(sub);
  user.sub = { id: sub.id, status: sub.status, cancelAtPeriodEnd: !!sub.cancel_at_period_end, periodEnd: end, updated: new Date().toISOString() };
  if (['active', 'trialing'].includes(sub.status) && end) user.paidThrough = end;
  // past_due / canceled / unpaid: paidThrough is left alone, so access simply ends on the last paid day.
  await saveUser(user);
  return user;
}

export async function userForCustomer(customerId) {
  const m = await kvGet('cust_' + customerId);
  return m && m.email ? await getUser(m.email) : null;
}
export async function linkCustomer(user, customerId) {
  user.stripeCustomerId = customerId; await saveUser(user);
  await kvPut('cust_' + customerId, { email: user.email });
}

export async function ensureCustomer(stripe, user) {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const c = await stripe.customers.create({ email: user.email }, { idempotencyKey: 'ppa-cust-' + crypto.createHash('sha256').update(user.email).digest('hex').slice(0, 24) });
  await linkCustomer(user, c.id);
  return c.id;
}

export async function findPriceId(stripe) {
  if (process.env.STRIPE_PRICE_ID) return process.env.STRIPE_PRICE_ID;
  const r = await stripe.prices.list({ lookup_keys: [LOOKUP_KEY], active: true, limit: 1 });
  return r.data[0] ? r.data[0].id : null;
}

// Creates the Product and weekly Price (and a default Customer Portal) if they do not exist yet. Safe to run twice.
export async function ensurePlan(stripe) {
  let priceId = await findPriceId(stripe);
  if (!priceId) {
    const product = await stripe.products.create({ name: 'PricePocketAsset Member', description: 'AI question box and AI lien screener' });
    const price = await stripe.prices.create({ product: product.id, unit_amount: 550, currency: 'usd', recurring: { interval: 'week' }, nickname: 'Weekly member', lookup_key: LOOKUP_KEY });
    priceId = price.id;
  }
  let portal = 'existing';
  const cfgs = await stripe.billingPortal.configurations.list({ is_default: true, limit: 1 });
  if (!cfgs.data.length) {
    await stripe.billingPortal.configurations.create({
      business_profile: { headline: 'Manage your PricePocketAsset membership' },
      features: {
        subscription_cancel: { enabled: true, mode: 'at_period_end' },
        payment_method_update: { enabled: true },
        invoice_history: { enabled: true },
        customer_update: { enabled: true, allowed_updates: ['email'] }
      }
    });
    portal = 'created';
  }
  return { priceId, portal };
}
