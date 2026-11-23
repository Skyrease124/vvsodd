// One place for the policy version and the consent records. Bump POLICY_VERSION whenever the Terms, Billing policy or Donation terms change in a way people should re-accept.
// The text people see before paying lives on the pages themselves (account page, /donate/, /legal/billing/, /legal/donations/); tests keep the numbers in step with the Stripe price.
export const POLICY_VERSION = '2026-11-18';
export const PLAN = { name: 'PricePocketPro', cents: 550, interval: 'week' };
// Records that a member accepted the terms and authorized recurring billing before being sent to Stripe Checkout. Kept on the member record (no card data, no IP address).
export function consentRecord(kind, extra) { return Object.assign({ kind, version: POLICY_VERSION, at: new Date().toISOString() }, extra || {}); }
export const MAX_CONSENTS = 50;
export function addConsent(user, rec) { user.consents = (user.consents || []).concat([rec]).slice(-MAX_CONSENTS); return user; }
// Text shown on Stripe's hosted Checkout page under the Subscribe button (Stripe allows light markdown links, up to 1,200 characters).
export function subscriptionCheckoutText(site) {
  return 'You are subscribing to PricePocketPro: $5.50 USD per week, charged now and then automatically every week until you cancel. Cancel any time in Account > Manage subscription; you keep access until the end of the week you have paid for. Use only a card or payment method you own or have permission to use. See the [Billing, subscription and refund policy](' + site + '/legal/billing/) and [Terms](' + site + '/legal/terms/).';
}
export function donationCheckoutText(site) {
  return 'This is an optional, one-time contribution to support PricePocketAsset. It does not provide products, services, memberships or special benefits. PricePocketAsset is a for-profit project, and this contribution is not tax-deductible. Use only a card or payment method you own or have permission to use. See the [Support Terms](' + site + '/legal/donations/).';
}
