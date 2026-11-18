// Paid members: GET ?county=Palm%20Beach&parcel=74-43-44-04-24-000-0243 -> the Pro-only tax roll fields for ONE parcel on our lists.
// (owner mailing address, absentee flag, fiduciary, last sale). The data is not in any public file.
import { requirePaid } from '../lib/paywall.mjs';
import * as auth from '../lib/auth.mjs';
import * as PR from '../lib/privateroll.mjs';
const json = (c, b) => new Response(JSON.stringify(b), { status: c, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } });
const hits = new Map();
const limited = (k, n, ms) => { const now = Date.now(), r = (hits.get(k) || []).filter(t => now - t < ms); if (r.length >= n) return true; r.push(now); hits.set(k, r); return false; };
export default async function handler(req) {
  if (req.method !== 'GET') return json(405, { ok: false });
  const deny = await requirePaid(req); if (deny) return deny;
  const me = await auth.userFromCookie(req.headers.get('cookie') || '');
  if (limited('roll' + (me && me.email), 120, 3600e3)) return json(429, { ok: false, error: 'Too many lookups. Please wait a bit.' });
  const u = new URL(req.url), county = String(u.searchParams.get('county') || '').slice(0, 40), parcel = String(u.searchParams.get('parcel') || '').slice(0, 60);
  if (!county || !parcel) return json(400, { ok: false });
  const rec = PR.get(county, parcel);
  return json(200, { ok: true, found: !!rec, roll: rec || {} });
}
