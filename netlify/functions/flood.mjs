// Flood Zone: intersects a Florida parcel outline with FEMA's National Flood Hazard Layer (NFHL) flood hazard zones.
//   POST { rings }  ->  { ok:true, parcelAcres, zones:[{zone,subty,risk,sfha,acres,pct,bfe,depth}], sfhaPct, highPct, panelEff, geom:[{zone,subty,risk,geom}], queried }
//   or  { ok:false, reason:'coverage'|'lookup' }   (the page shows "Flood zone unavailable")
// risk: 'high' (Special Flood Hazard Area, SFHA_TF = T), 'moderate' (shaded X / 0.2% annual chance / levee-reduced), 'minimal' (X, minimal hazard), 'undetermined' (D), 'water'.
// A lot is reported only if the FEMA zone polygons cover (at least) 98% of it; otherwise "unavailable", never a guessed zone.
import { pc, SQM_ACRE, json, limited, proj, multiArea, esriToMulti, readOutline, outlineKey } from '../lib/geo.mjs';
const NFHL = 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/';
const cache = new Map();

async function get(layer, params, ms = 8000) {   // Netlify stops a function at 10 s by default: fail fast so the page can offer "Try again"
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(NFHL + layer + '/query?' + new URLSearchParams(Object.assign({ f: 'json', where: 'OBJECTID>0', inSR: '4326', geometryType: 'esriGeometryEnvelope', spatialRel: 'esriSpatialRelIntersects' }, params)), { signal: c.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status); const d = await r.json(); if (d.error) throw new Error('service error'); return d;
  } finally { clearTimeout(t); }
}
export const riskOf = a => {
  const z = String(a.FLD_ZONE || '').trim().toUpperCase(), sub = String(a.ZONE_SUBTY || '').toUpperCase();
  if (a.SFHA_TF === 'T' || /^(A|AE|AH|AO|AR|A99|V|VE)$/.test(z)) return 'high';
  if (z === 'OPEN WATER') return 'water'; if (z === 'D') return 'undetermined';
  if (z === 'X' && /MINIMAL/.test(sub)) return 'minimal';
  if (z === 'X') return 'moderate';   // 0.2 PCT ANNUAL CHANCE, reduced risk due to levee, future-conditions shading
  return 'undetermined';
};
const num = v => (typeof v === 'number' && v > -9000) ? v : null;

export async function analyze(rings) {
  const pts = rings.flat(), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), env = [x0, y0, x1, y1].join(',');
  const feats = []; for (let off = 0, n = 0; n < 4; n++, off += 500) {
    const w = await get('28', { geometry: env, outFields: 'FLD_ZONE,ZONE_SUBTY,SFHA_TF,STATIC_BFE,DEPTH', returnGeometry: 'true', outSR: '4326', geometryPrecision: '7', maxAllowableOffset: '0.00001', resultOffset: String(off), resultRecordCount: '500' });
    if (!Array.isArray(w.features)) throw new Error('bad result'); feats.push(...w.features); if (!w.exceededTransferLimit) { feats.done = true; break; }
  }
  if (!feats.done) throw new Error('too many flood polygons');
  const lng0 = (x0 + x1) / 2, lat0 = (y0 + y1) / 2, P = proj(lng0, lat0), parcel = esriToMulti(rings), parcelM2 = multiArea(parcel, P); if (!(parcelM2 > 0)) throw new Error('bad parcel');
  const groups = {}, all = [];
  for (const f of feats) {
    if (!f.geometry || !f.geometry.rings || !f.attributes) continue; const zm = esriToMulti(f.geometry.rings); if (!zm.length) continue;
    const hit = pc.intersection(parcel, zm); if (!hit.length) continue; const a = multiArea(hit, P); if (!(a > 0)) continue;
    const at = f.attributes, zone = String(at.FLD_ZONE || '').trim() || '?', subty = String(at.ZONE_SUBTY || '').trim(), key = zone + '|' + subty;
    const g = groups[key] || (groups[key] = { zone, subty, risk: riskOf(at), pieces: [], bfe: num(at.STATIC_BFE), depth: num(at.DEPTH) }); g.pieces.push(...hit); all.push(...hit);
  }
  const covered = all.length ? multiArea(pc.union(all[0], ...all.slice(1)), P) : 0;
  if (covered / parcelM2 < 0.98) return { ok: false, reason: 'coverage' };
  const round = (v, d) => Number(v.toFixed(d));
  const zones = [], geom = [];
  for (const g of Object.values(groups)) {
    const u = pc.union(g.pieces[0], ...g.pieces.slice(1)), a = multiArea(u, P); if (!(a > 0)) continue;
    zones.push({ zone: g.zone, subty: g.subty, risk: g.risk, sfha: g.risk === 'high', acres: round(a / SQM_ACRE, 4), pct: round(Math.min(100, a / parcelM2 * 100), 2), bfe: g.bfe, depth: g.depth });
    if (g.risk === 'high' || g.risk === 'moderate') geom.push({ zone: g.zone, subty: g.subty, risk: g.risk, geom: u.map(poly => poly.map(r => r.map(p => [round(p[0], 7), round(p[1], 7)]))) });
  }
  zones.sort((a, b) => b.pct - a.pct);
  const sum = r => round(Math.min(100, zones.filter(z => z.risk === r).reduce((s, z) => s + z.pct, 0)), 2);
  let panelEff = ''; try { const pn = await get('3', { geometry: lng0 + ',' + lat0, geometryType: 'esriGeometryPoint', outFields: 'EFF_DATE,FIRM_PAN', returnGeometry: 'false' }, 2500); const e = pn.features && pn.features[0] && pn.features[0].attributes; if (e && e.EFF_DATE) panelEff = new Date(e.EFF_DATE).toISOString().slice(0, 10); } catch (e) { /* optional */ }
  return { ok: true, parcelAcres: round(parcelM2 / SQM_ACRE, 4), zones, sfhaPct: sum('high'), modPct: sum('moderate'), panelEff, geom, queried: new Date().toISOString().slice(0, 10) };
}

export default async function handler(req, context) {
  const ip = req.headers.get('x-nf-client-connection-ip') || (context && context.ip) || 'x';
  if (req.method !== 'POST') return json(405, { ok: false, error: 'POST only.' });
  if (limited('f' + ip, 40, 60000)) return json(429, { ok: false, error: 'Too many requests.' });
  const inp = await readOutline(req); if (inp.error) return inp.error; const rings = inp.rings, key = outlineKey(rings);
  const hit = cache.get(key); if (hit && Date.now() - hit.t < 6 * 3600e3) return json(200, hit.v);
  let v; try { v = await analyze(rings); } catch (e) { return json(200, { ok: false, reason: 'lookup' }); }
  if (cache.size > 200) cache.clear(); if (v.ok || v.reason === 'coverage') cache.set(key, { t: Date.now(), v }); return json(200, v);
}
