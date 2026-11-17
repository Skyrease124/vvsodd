// Paid members: GET ?lat=&lng=  -> RentCast property record near the spot (states without site data only). The owner may add &force=1 for Florida.
import * as auth from '../lib/auth.mjs';
import { requirePaid } from '../lib/paywall.mjs';
import * as RC from '../lib/rentcast.mjs';
const json = (c, b) => new Response(JSON.stringify(b), { status: c, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export default async function handler(req) {
  if (req.method !== 'GET') return json(405, { ok: false });
  const deny = await requirePaid(req); if (deny) return deny;
  const me = await auth.userFromCookie(req.headers.get('cookie')), u = new URL(req.url), lat = Number(u.searchParams.get('lat')), lng = Number(u.searchParams.get('lng'));
  if (!(lat >= 18 && lat <= 72 && lng >= -180 && lng <= -60)) return json(400, { ok: false });
  try { return json(200, await RC.lookup(lat, lng, { force: !!(me && me.owner && u.searchParams.get('force')) })); } catch (e) { console.log('rentcast', e.message); return json(200, { ok: false, reason: 'lookup' }); }
}
