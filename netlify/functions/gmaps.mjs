// Paid members: Google tiles / Street View image / places nearby.
//   GET ?t=satellite|roadmap&z=&x=&y=   -> image (or 204 when capped / not set up: the browser shows the free map instead)
//   GET ?sv=1&lat=&lng=                 -> image/jpeg, or JSON {ok:true,none:true}
//   GET ?nearby=1&lat=&lng=             -> JSON
import { requirePaid } from '../lib/paywall.mjs';
import * as G from '../lib/gmaps.mjs';
const json = (c, b) => new Response(JSON.stringify(b), { status: c, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export default async function handler(req) {
  if (req.method !== 'GET') return json(405, { ok: false });
  const deny = await requirePaid(req); if (deny) return deny;
  const u = new URL(req.url), q = k => u.searchParams.get(k);
  try {
    if (q('t')) {
      const t = q('t'), z = Number(q('z')), x = Number(q('x')), y = Number(q('y'));
      if (!/^(satellite|roadmap)$/.test(t) || !(z >= 0 && z <= 21) || !Number.isInteger(x) || !Number.isInteger(y)) return json(400, { ok: false });
      if (!G.spend('tiles')) return new Response(null, { status: 503 });
      const im = await G.tile(t, z, x, y); if (!im) return new Response(null, { status: 503 });
      return new Response(im.body, { status: 200, headers: { 'Content-Type': im.type, 'Cache-Control': 'private, max-age=86400' } });
    }
    const lat = Number(q('lat')), lng = Number(q('lng'));
    if (!(lat >= 18 && lat <= 72 && lng >= -180 && lng <= -60)) return json(400, { ok: false });
    if (q('sv')) { if (!G.spend('street')) return json(200, { ok: false, reason: 'cap' }); const r = await G.street(lat, lng); if (!r.ok || r.none) return json(200, r);
      return new Response(r.body, { status: 200, headers: { 'Content-Type': r.type, 'Cache-Control': 'private, max-age=86400', 'X-SV-Date': r.date } }); }
    if (q('nearby')) { if (!G.spend('nearby')) return json(200, { ok: false, reason: 'cap' }); return json(200, await G.nearby(lat, lng)); }
    return json(400, { ok: false });
  } catch (e) { console.log('gmaps', e.message); return q('t') ? new Response(null, { status: 503 }) : json(200, { ok: false, reason: 'lookup' }); }
}
