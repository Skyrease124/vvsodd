// POST {amount} -> { url } to Stripe Checkout for a one-time donation. GET -> { configured }. Open to everyone (no sign-in); limited per visitor.
import * as S from '../lib/stripe.mjs';
import * as D from '../lib/donate.mjs';
import * as RL from '../lib/ratelimit.mjs';
import * as P from '../lib/policy.mjs';
const json = (code, body) => new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export default async (req) => {
  const cfg = await S.getConfig();
  if (req.method === 'GET') return json(200, { configured: !!cfg, min: D.MIN_USD, max: D.MAX_USD, presets: D.PRESETS });
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });
  if (!cfg) return json(503, { error: 'Online donations are not switched on yet.' });
  let b; try { b = JSON.parse(await req.text() || '{}'); } catch (e) { return json(400, { error: 'Bad request.' }); }
  const c = D.cents(b.amount); if (c == null) return json(400, { error: 'Choose an amount from $' + D.MIN_USD + ' to $' + D.MAX_USD + '.' });
  if (!(b.ack && b.ack.optional === true && b.ack.version === P.SUPPORT_TERMS_VERSION)) return json(400, { error: 'Please tick the box to confirm this is an optional voluntary contribution and that you accept the Support Terms.', needConsent: true, version: P.SUPPORT_TERMS_VERSION });
  const ip = (req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
  if (!(await RL.hit('donate:' + ip, 10, 600e3)).ok) return json(429, { error: 'Too many tries. Please wait a few minutes.' });
  try { const s = await S.client(cfg).checkout.sessions.create(D.sessionParams(c, S.siteUrl(), new Date().toISOString())); return json(200, { url: s.url }); }
  catch (e) { return json(502, { error: 'Could not start the donation page. Please try again in a moment.' }); }
};
