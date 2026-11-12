// Mapped Wetlands: intersects a Florida parcel outline with the U.S. Fish & Wildlife Service National Wetlands Inventory (NWI) polygons.
//   POST { rings: [[[lng,lat],...], ...] }  (the verified parcel outline: outer ring first, then holes)
//   ->  { ok:true, covered:true, parcelAcres, overlapAcres, pct, types:[{type,acres}], geom:<GeoJSON MultiPolygon coordinates>, queried }
//   or  { ok:false, reason:'coverage'|'lookup' }     (the page shows "Wetlands data unavailable")
// "No mapped overlap" (overlapAcres 0) is returned ONLY when the NWI status layer says the whole parcel sits in a digitally mapped area
// AND the wetland query succeeded and clipped to nothing. Coverage missing, a failed call or a truncated result is never reported as "no overlap".
import { pc, SQM_ACRE, json, limited, proj, multiArea, closed, esriToMulti, readOutline, outlineKey } from '../lib/geo.mjs';
const BASE = 'https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/rest/services/';
const cache = new Map();

async function get(layer, params) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), 20000);
  try {
    const r = await fetch(BASE + layer + '/MapServer/0/query?' + new URLSearchParams(Object.assign({ f: 'json', where: 'OBJECTID>0', inSR: '4326', geometryType: 'esriGeometryEnvelope', spatialRel: 'esriSpatialRelIntersects' }, params)), { signal: c.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status); const d = await r.json(); if (d.error) throw new Error('service error'); return d;
  } finally { clearTimeout(t); }
}

export async function analyze(rings) {
  const pts = rings.flat(); const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), env = [x0, y0, x1, y1].join(',');
  // 1. coverage: one digitally mapped status polygon contains the parcel's whole envelope (ArcGIS 'Within' = query geometry within the status polygon)
  const st = await get('Wetlands_Status', { geometry: env, spatialRel: 'esriSpatialRelWithin', outFields: 'STATUS', returnGeometry: 'false' });
  if (!st.features.some(f => f.attributes && f.attributes.STATUS === 'Digital')) return { ok: false, reason: 'coverage' };
  // 2. wetland polygons touching the parcel envelope (paged; a truncated result is a failure, never a partial answer)
  const feats = []; for (let off = 0, n = 0; n < 4; n++, off += 500) {
    const w = await get('Wetlands', { geometry: env, outFields: 'ATTRIBUTE,WETLAND_TYPE', returnGeometry: 'true', outSR: '4326', geometryPrecision: '7', resultOffset: String(off), resultRecordCount: '500' });
    if (!Array.isArray(w.features)) throw new Error('bad result'); feats.push(...w.features); if (!w.exceededTransferLimit) { feats.done = true; break; }
  }
  if (!feats.done) throw new Error('too many wetland polygons');
  // 3. exact intersection with the full parcel boundary
  const lng0 = (x0 + x1) / 2, lat0 = (y0 + y1) / 2, P = proj(lng0, lat0), parcel = esriToMulti(rings);   // even-odd, like the map: separate parts become separate polygons, inner rings become holes
  const parcelM2 = multiArea(parcel, P); if (!(parcelM2 > 0)) throw new Error('bad parcel');
  const byType = {}, pieces = [];
  for (const f of feats) {
    if (!f.geometry || !f.geometry.rings) continue; const wm = esriToMulti(f.geometry.rings); if (!wm.length) continue;
    const hit = pc.intersection(parcel, wm); if (!hit.length) continue;
    const a = multiArea(hit, P); if (!(a > 0)) continue;
    const t = String((f.attributes && f.attributes.WETLAND_TYPE) || 'Wetland').trim() || 'Wetland';
    byType[t] = (byType[t] || 0) + a; pieces.push(...hit);
  }
  const merged = pieces.length ? pc.union(pieces[0], ...pieces.slice(1)) : [], m2 = merged.length ? multiArea(merged, P) : 0;
  const round = (v, d) => Number(v.toFixed(d));
  return { ok: true, covered: true, parcelAcres: round(parcelM2 / SQM_ACRE, 4), overlapAcres: round(m2 / SQM_ACRE, 4), overlapSqFt: Math.round(m2 * 10.7639), pct: round(Math.min(100, m2 / parcelM2 * 100), 2), none: m2 <= 0.01,
    types: Object.entries(byType).map(([type, a]) => ({ type, acres: round(a / SQM_ACRE, 4) })).sort((a, b) => b.acres - a.acres), geom: merged.map(poly => poly.map(r => r.map(p => [round(p[0], 7), round(p[1], 7)]))), queried: new Date().toISOString().slice(0, 10) };
}

export default async function handler(req, context) {
  const ip = req.headers.get('x-nf-client-connection-ip') || (context && context.ip) || 'x';
  if (req.method !== 'POST') return json(405, { ok: false, error: 'POST only.' });
  if (limited('w' + ip, 40, 60000)) return json(429, { ok: false, error: 'Too many requests.' });
  const inp = await readOutline(req); if (inp.error) return inp.error; const rings = inp.rings;
  const key = outlineKey(rings);
  const hit = cache.get(key); if (hit && Date.now() - hit.t < 6 * 3600e3) return json(200, hit.v);
  let v; try { v = await analyze(rings); } catch (e) { return json(200, { ok: false, reason: 'lookup' }); }
  if (cache.size > 200) cache.clear(); if (v.ok || v.reason === 'coverage') cache.set(key, { t: Date.now(), v }); return json(200, v);
}
