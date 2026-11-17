// Paid members: GET ?lat=&lng= -> county unemployment rate, trend and labor force (BLS LAUS).
import { requirePaid } from '../lib/paywall.mjs';
import { jobsAt } from '../lib/bls.mjs';
const json = (c, b) => new Response(JSON.stringify(b), { status: c, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export default async function handler(req) {
  if (req.method !== 'GET') return json(405, { ok: false });
  const deny = await requirePaid(req); if (deny) return deny;
  const u = new URL(req.url), lat = Number(u.searchParams.get('lat')), lng = Number(u.searchParams.get('lng'));
  if (!(lat >= 18 && lat <= 72 && lng >= -180 && lng <= -60)) return json(400, { ok: false });
  try { return json(200, await jobsAt(lat, lng)); } catch (e) { console.log('bls', e.message); return json(200, { ok: false, reason: 'lookup' }); }
}
