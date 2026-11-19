// Paid-member gate for data functions. Returns a 402 Response when the visitor is not a paid (or owner / family-access) member, else null.
import * as auth from './auth.mjs';
export async function requirePaid(req) {
  const me = await auth.userFromCookie(req.headers.get('cookie') || '');
  if (auth.isPaid(me)) return null;
  const held = !!(me && me.disputeHold);
  return new Response(JSON.stringify({ ok: false, needPaid: true, signedIn: !!me, error: held ? 'Your paid access is temporarily unavailable while the payment associated with this membership is under review.' : 'This feature is for PricePocketPro members.' }), { status: 402, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
