// Nearby Cleanup Sites: proxies the free Florida DEP Cleanup Sites layer (it sends no CORS headers, so browsers cannot call it directly).
//   GET ?xmin=&ymin=&xmax=&ymax=   (WGS84 degrees)  ->  { ok: true, sites: [...] }   or   { ok: false, error }   when the lookup fails.
// An empty list with ok:true means the query SUCCEEDED and found nothing. A failure is never reported as an empty list.
const DEP = 'https://ags.dep.state.fl.us/arcgis/rest/services/OpenData/CLEANUP_SP/MapServer/0/query';
const FIELDS = 'DEP_CLEANUP_SITE_KEY,SOURCE_DATABASE_NAME,SOURCE_DATABASE_ID,CLCC_CLEANUP_CATEGORY_KEY,CPAC_PROGRAM_AREA_ID,RSC2_REMEDIATION_STATUS_KEY,BUSINESS_NAME,ADDRESS1,CITY,PC2_PROXIMITY_ID,CALC_COORD_ACCURACY_LEVEL_ID,DOCUMENTS,DATA_LOAD_DATE';
const json = (code, body) => new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': code === 200 && body.ok ? 'public, max-age=1800' : 'no-store' } });
const cache = new Map(), hits = new Map();
const limited = (k, n, ms) => { const now = Date.now(), r = (hits.get(k) || []).filter(t => now - t < ms); if (r.length >= n) return true; r.push(now); hits.set(k, r); return false; };
const clean = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

export default async function handler(req, context) {
  const ip = req.headers.get('x-nf-client-connection-ip') || (context && context.ip) || 'x';
  if (limited('c' + ip, 120, 60000)) return json(429, { ok: false, error: 'Too many requests.' });
  const q = new URL(req.url).searchParams, [x0, y0, x1, y1] = ['xmin', 'ymin', 'xmax', 'ymax'].map(k => Number(q.get(k)));
  // Florida only, and a window no larger than about 3 miles, so this cannot be used to pull the whole layer
  if (![x0, y0, x1, y1].every(Number.isFinite) || x0 < -88 || x1 > -79.5 || y0 < 24 || y1 > 31.1 || x1 <= x0 || y1 <= y0 || (x1 - x0) > 0.1 || (y1 - y0) > 0.1) return json(400, { ok: false, error: 'Bad area.' });
  const key = [x0, y0, x1, y1].map(v => v.toFixed(4)).join(',');
  const hit = cache.get(key); if (hit && Date.now() - hit.t < 6 * 3600e3) return json(200, hit.v);
  try {
    const url = DEP + '?' + new URLSearchParams({ f: 'json', where: '1=1', geometry: [x0, y0, x1, y1].join(','), geometryType: 'esriGeometryEnvelope', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: FIELDS, returnGeometry: 'true', outSR: '4326', resultRecordCount: '2000' });
    const c = new AbortController(), t = setTimeout(() => c.abort(), 15000);
    const r = await fetch(url, { signal: c.signal }).finally(() => clearTimeout(t));
    if (!r.ok) throw new Error('HTTP ' + r.status); const d = await r.json();
    if (d.error || !Array.isArray(d.features)) throw new Error('service error'); if (d.exceededTransferLimit) throw new Error('too many results');
    const sites = d.features.filter(f => f.geometry && Number.isFinite(f.geometry.x)).map(f => { const a = f.attributes; return {
      key: a.DEP_CLEANUP_SITE_KEY, id: clean(a.SOURCE_DATABASE_ID), db: clean(a.SOURCE_DATABASE_NAME), name: clean(a.BUSINESS_NAME), addr: [clean(a.ADDRESS1), clean(a.CITY)].filter(Boolean).join(', '),
      status: clean(a.RSC2_REMEDIATION_STATUS_KEY), cat: clean(a.CLCC_CLEANUP_CATEGORY_KEY), prog: clean(a.CPAC_PROGRAM_AREA_ID), prox: clean(a.PC2_PROXIMITY_ID), acc: a.CALC_COORD_ACCURACY_LEVEL_ID,
      docs: /^https:\/\/prodenv\.dep\.state\.fl\.us\//.test(a.DOCUMENTS || '') ? a.DOCUMENTS.trim() : '', loaded: a.DATA_LOAD_DATE ? new Date(a.DATA_LOAD_DATE).toISOString().slice(0, 10) : '', x: f.geometry.x, y: f.geometry.y }; });
    const v = { ok: true, sites, queried: new Date().toISOString().slice(0, 10) };
    if (cache.size > 400) cache.clear(); cache.set(key, { t: Date.now(), v }); return json(200, v);
  } catch (e) { return json(200, { ok: false, error: 'DEP lookup failed' }); }
}
