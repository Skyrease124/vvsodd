// Active natural hazards (information layer). Source: NASA EONET v3 open events (public, no key).
//   GET -> { ok:true, events:[{id,title,cat,catTitle,lat,lng,date,link,source}], counts:{wildfires,...}, checked } | { ok:false, reason:'lookup' }
// Points are event locations reported by the source agencies. This is NOT a risk score for any parcel.
import { hit } from '../lib/ratelimit.mjs';

const UA = 'PricePocketAsset research (https://pricepocketasset.com)';
const URL_ = c => 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=500&category=' + c;
const TTL = 15 * 60e3, FAIL_TTL = 60e3;
const CATS = { wildfires: 'Wildfire', floods: 'Flood', severeStorms: 'Storm', volcanoes: 'Volcano', landslides: 'Landslide' };
const json = (c, b) => new Response(JSON.stringify(b), { status: c, headers: { 'Content-Type': 'application/json', 'Cache-Control': c === 200 ? 'public, max-age=300' : 'no-store' } });
let cache = null;
export const _reset = () => { cache = null; };
const inUS = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && lat >= 17 && lat <= 72 && lng >= -180 && lng <= -64;
const centroid = ring => { let x = 0, y = 0, n = 0; for (const p of ring) { if (Array.isArray(p) && p.length >= 2) { x += p[0]; y += p[1]; n++; } } return n ? [x / n, y / n] : null; };
const point = g => { if (!g || !g.coordinates) return null; if (g.type === 'Point') return g.coordinates; if (g.type === 'Polygon') return centroid(g.coordinates[0] || []); return null; };
const https = u => (typeof u === 'string' && /^https:\/\//.test(u)) ? u : '';

export function parse(d) {
  const out = [];
  for (const e of (d && Array.isArray(d.events) ? d.events : [])) {
    const cat = e.categories && e.categories[0] && e.categories[0].id; if (!CATS[cat] || e.closed) continue;
    const gs = Array.isArray(e.geometry) ? e.geometry : []; const g = gs[gs.length - 1]; const pt = point(g); if (!pt) continue;
    const lng = Number(pt[0]), lat = Number(pt[1]); if (!inUS(lat, lng)) continue;
    const src = Array.isArray(e.sources) && e.sources[0] ? e.sources[0] : {};
    out.push({ id: String(e.id), title: String(e.title || CATS[cat]).slice(0, 120), cat, catTitle: CATS[cat], lat: +lat.toFixed(4), lng: +lng.toFixed(4), date: g.date || '', link: https(src.url) || https(e.link), source: String(src.id || 'EONET').slice(0, 20) });
  }
  return out;
}
export async function load() {
  if (cache && Date.now() < cache.until) return cache.v;
  const c = new AbortController(), t = setTimeout(() => c.abort(), 9000);
  try {
    // one request per category so a long wildfire list can never push floods/storms out of the result
    const rs = await Promise.allSettled(Object.keys(CATS).map(async k => { const r = await fetch(URL_(k), { headers: { 'User-Agent': UA }, signal: c.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return parse(await r.json()); }));
    if (rs.every(x => x.status === 'rejected')) throw new Error('all categories failed');
    const seen = new Set(), events = []; for (const x of rs) if (x.status === 'fulfilled') for (const e of x.value) if (!seen.has(e.id)) { seen.add(e.id); events.push(e); }
    const counts = {}; events.forEach(x => { counts[x.cat] = (counts[x.cat] || 0) + 1; });
    const v = { ok: true, events, counts, checked: new Date().toISOString(), source: 'NASA EONET (open events reported by NIFC, NWS, USGS and other agencies)' };
    cache = { v, until: Date.now() + TTL }; return v;
  } catch (e) { const v = { ok: false, reason: 'lookup' }; if (cache && cache.v.ok) return Object.assign({}, cache.v, { stale: true }); cache = { v, until: Date.now() + FAIL_TTL }; return v; }
  finally { clearTimeout(t); }
}
export default async function handler(req, context) {
  if (req.method !== 'GET') return json(405, { ok: false });
  const ip = req.headers.get('x-nf-client-connection-ip') || (context && context.ip) || 'x';
  if (!(await hit('hazards:' + ip, 40, 60e3)).ok) return json(429, { ok: false, error: 'Too many requests.' });
  const v = await load(); return json(200, v);
}
