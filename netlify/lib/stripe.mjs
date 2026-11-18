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

// The customer saved on the account, if it still exists in the current Stripe mode. A customer made in test mode does not exist
// in live mode ("No such customer"); such a stale ID is dropped from the account instead of breaking billing.
export async function liveCustomer(stripe, user) {
  if (!user.stripeCustomerId) return null;
  try {
    const c = await stripe.customers.retrieve(user.stripeCustomerId);
    if (c && !c.deleted) return c.id;
  } catch (e) {
    if (!(e && (e.code === 'resource_missing' || e.statusCode === 404))) throw e;
  }
  const u = await getUser(user.email);
  if (u && u.stripeCustomerId === user.stripeCustomerId) { u.staleStripeCustomerId = u.stripeCustomerId; delete u.stripeCustomerId; await saveUser(u); }
  delete user.stripeCustomerId;
  return null;
}
export async function ensureCustomer(stripe, user) {
  const existing = await liveCustomer(stripe, user); if (existing) return existing;
  const c = await stripe.customers.create({ email: user.email }, { idempotencyKey: 'ppa-cust-' + crypto.createHash('sha256').update(user.email).digest('hex').slice(0, 24) });
  await linkCustomer(user, c.id);
  return c.id;
}

export async function findPriceId(stripe) {
  if (process.env.STRIPE_PRICE_ID) return process.env.STRIPE_PRICE_ID;
  const r = await stripe.prices.list({ lookup_keys: [LOOKUP_KEY], active: true, limit: 1 });
  return r.data[0] ? r.data[0].id : null;
}

// The Customer Portal is where members cancel, update their card and see invoices. Creates Stripe's default portal configuration if (and only if) none exists.
// Cancellation is at the end of the paid period, as the Billing policy says. Returns 'existing' or 'created'.
export async function ensurePortal(stripe) {
  const cfgs = await stripe.billingPortal.configurations.list({ is_default: true, limit: 1 });
  if (cfgs.data.length) return 'existing';
  const site = siteUrl();
  await stripe.billingPortal.configurations.create({
    business_profile: { headline: 'Manage your PricePocketAsset membership', privacy_policy_url: site + '/legal/privacy/', terms_of_service_url: site + '/legal/terms/' },
    features: {
      subscription_cancel: { enabled: true, mode: 'at_period_end' },
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
      customer_update: { enabled: true, allowed_updates: ['email'] }
    }
  });
  return 'created';
}
// True when Stripe refused to open a portal only because no default portal configuration exists yet.
export const noPortalConfig = e => !!e && e.type === 'StripeInvalidRequestError' && /configuration/i.test(e.message || '') && /(default|provided|not been created|no configuration)/i.test(e.message || '');

// Creates the Product and weekly Price (and a default Customer Portal) if they do not exist yet. Safe to run twice.
export async function ensurePlan(stripe) {
  let priceId = await findPriceId(stripe);
  if (!priceId) {
    const product = await stripe.products.create({ name: 'PricePocketAsset Member', description: 'AI question box and AI lien screener' });
    const price = await stripe.prices.create({ product: product.id, unit_amount: 550, currency: 'usd', recurring: { interval: 'week' }, nickname: 'Weekly member', lookup_key: LOOKUP_KEY });
    priceId = price.id;
  }
  const portal = await ensurePortal(stripe);
  return { priceId, portal };
}
