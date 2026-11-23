// One-time donations through Stripe Checkout. Separate from the weekly membership: no account needed, no access is granted, nothing in the member records changes.
export const MIN_USD = 1, MAX_USD = 500, PRESETS = [5, 10, 25, 50];
// Returns whole cents, or null when the amount is not a whole-dollar-or-cents number between $1 and $500.
export function cents(v) {
  const n = typeof v === 'number' ? v : parseFloat(String(v || '').replace(/[$,\s]/g, ''));
  if (!Number.isFinite(n)) return null; const c = Math.round(n * 100);
  return c >= MIN_USD * 100 && c <= MAX_USD * 100 ? c : null;
}
import * as P from './policy.mjs';
export function sessionParams(c, site, ack) {
  const meta = { kind: 'donation', policy_version: P.SUPPORT_TERMS_VERSION, ack_at: ack || '' };
  return {
    mode: 'payment', submit_type: 'donate',
    line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: c, product_data: { name: 'Support PricePocketAsset', description: 'A voluntary donation to help keep the website running. It does not unlock any features.' } } }],
    success_url: site + '/donate/?thanks=1', cancel_url: site + '/donate/',
    payment_intent_data: { description: 'PricePocketAsset voluntary support', metadata: meta }, metadata: meta,
    custom_text: { submit: { message: P.donationCheckoutText(site) } }, payment_method_options: { card: { request_three_d_secure: 'automatic' } },
    billing_address_collection: 'auto', allow_promotion_codes: false
  };
}
