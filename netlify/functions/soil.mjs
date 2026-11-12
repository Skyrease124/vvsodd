// Soil Type: USDA NRCS Soil Data Access (SSURGO) map units intersected with the verified parcel outline.
//   POST { rings }  ->  { ok:true, units:[{mukey,musym,name,kind,pct,acres,drainage,hydgrp,hydricPct,flood,pond,wtFt,bedrockFt,septic,dwellings}], coveredPct, parcelAcres, queried }
//   or  { ok:false, reason:'coverage'|'lookup' }     (the page shows "Soil data unavailable")
// pct is the share of the LOT outline inside each map unit (planar area ratio, accurate at lot scale). Map units are mixtures of soils mapped at county scale.
import { pc, SQM_ACRE, json, limited, proj, multiArea, esriToMulti, readOutline, outlineKey } from '../lib/geo.mjs';
const SDA = 'https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest';
const cache = new Map();

async function sda(query) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), 9000);
  try {
    const r = await fetch(SDA, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, format: 'JSON+COLUMNNAME' }), signal: c.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status); const d = await r.json();
    if (d == null || d.Table === undefined) return [];            // SDA answers {} when a query matches nothing
    if (!Array.isArray(d.Table) || !Array.isArray(d.Table[0])) throw new Error('bad result');
    const cols = d.Table[0]; return d.Table.slice(1).map(row => Object.fromEntries(cols.map((k, i) => [k, row[i]])));
  } finally { clearTimeout(t); }
}
const wkt = mp => 'MULTIPOLYGON(' + mp.map(poly => '(' + poly.map(r => '(' + r.map(p => p[0].toFixed(7) + ' ' + p[1].toFixed(7)).join(', ') + ')').join(', ') + ')').join(', ') + ')';
const txt = v => (v == null || v === '' || v === 'null') ? '' : String(v).trim();
const numOrNull = v => { const n = Number(v); return v == null || v === '' || !isFinite(n) ? null : n; };

export async function analyze(rings) {
  const pts = rings.flat(), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const lng0 = (Math.min(...xs) + Math.max(...xs)) / 2, lat0 = (Math.min(...ys) + Math.max(...ys)) / 2, P = proj(lng0, lat0), mp = esriToMulti(rings), parcelM2 = multiArea(mp, P);
  if (!mp.length || !(parcelM2 > 0)) throw new Error('bad parcel');
  const W = wkt(mp);
  const areas = await sda(`~DeclareGeometry(@aoi)~ select @aoi = geometry::STGeomFromText('${W}', 4326).MakeValid(); SELECT mp.mukey, SUM(@aoi.STIntersection(mp.mupolygongeo).STArea()) AS a, @aoi.STArea() AS aoi FROM mupolygon mp WHERE mp.mupolygonkey IN (SELECT * FROM SDA_Get_Mupolygonkey_from_intersection_with_WktWgs84('${W}')) GROUP BY mp.mukey`);
  const rows = areas.map(r => ({ mukey: String(r.mukey), a: Number(r.a), aoi: Number(r.aoi) })).filter(r => r.a > 0 && r.aoi > 0);
  if (!rows.length) return { ok: false, reason: 'coverage' };
  const keys = rows.map(r => r.mukey); if (!keys.every(k => /^\d{1,9}$/.test(k))) throw new Error('bad key');
  const det = await sda(`SELECT mu.mukey, mu.musym, mu.muname, mu.mukind, ma.drclassdcd, ma.hydgrpdcd, ma.hydclprs, ma.flodfreqdcd, ma.pondfreqprs, ma.wtdepannmin, ma.brockdepmin, ma.engstafdcd, ma.engdwobdcd FROM mapunit mu LEFT JOIN muaggatt ma ON ma.mukey = mu.mukey WHERE mu.mukey IN (${keys.join(',')})`);
  const byKey = Object.fromEntries(det.map(r => [String(r.mukey), r]));
  const round = (v, d) => Number(v.toFixed(d)), cm2ft = v => v == null ? null : round(v / 30.48, 1);
  const units = rows.map(r => { const d = byKey[r.mukey]; if (!d) return null; const pct = Math.min(100, r.a / r.aoi * 100);
    return { mukey: r.mukey, musym: txt(d.musym), name: txt(d.muname), kind: txt(d.mukind), pct: round(pct, 2), acres: round(pct / 100 * parcelM2 / SQM_ACRE, 4),
      drainage: txt(d.drclassdcd), hydgrp: txt(d.hydgrpdcd), hydricPct: numOrNull(d.hydclprs), flood: txt(d.flodfreqdcd), pond: numOrNull(d.pondfreqprs), wtFt: cm2ft(numOrNull(d.wtdepannmin)), bedrockFt: cm2ft(numOrNull(d.brockdepmin)), septic: txt(d.engstafdcd), dwellings: txt(d.engdwobdcd) }; }).filter(u => u && u.name).sort((a, b) => b.pct - a.pct);
  if (!units.length) return { ok: false, reason: 'coverage' };
  return { ok: true, units, coveredPct: round(Math.min(100, units.reduce((s, u) => s + u.pct, 0)), 1), parcelAcres: round(parcelM2 / SQM_ACRE, 4), queried: new Date().toISOString().slice(0, 10) };
}

export default async function handler(req, context) {
  const ip = req.headers.get('x-nf-client-connection-ip') || (context && context.ip) || 'x';
  if (req.method !== 'POST') return json(405, { ok: false, error: 'POST only.' });
  if (limited('s' + ip, 40, 60000)) return json(429, { ok: false, error: 'Too many requests.' });
  const inp = await readOutline(req); if (inp.error) return inp.error; const rings = inp.rings, key = outlineKey(rings);
  const hit = cache.get(key); if (hit && Date.now() - hit.t < 24 * 3600e3) return json(200, hit.v);
  let v; try { v = await analyze(rings); } catch (e) { return json(200, { ok: false, reason: 'lookup' }); }
  if (cache.size > 300) cache.clear(); cache.set(key, { t: Date.now(), v }); return json(200, v);
}
