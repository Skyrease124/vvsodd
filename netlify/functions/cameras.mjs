// Nearby Cameras: official public camera feeds near a parcel, matched by straight-line distance (works across state lines).
//   GET ?lat=&lng=&radius=10&limit=5
//     -> { ok:true, radius, cameras:[Camera + miles], providers:[{id,name,state,status:'ok'|'unavailable'|'viewer', viewer}], checked }
//   GET ?meta=1&src=fl&id=123  -> { ok:true, lastModified:'...'|null }   (image update time from the image server's Last-Modified header)
// Camera = { src, id, name, road, direction, lat, lng, kind:'snapshot'|'video'|'viewer', type:'Traffic camera'|'Beach cam'|'Weather cam',
//            image, video, viewer, operator, sourceMeta }
// Each provider has its own cache and its own failure state, so one outage never hides the others. Keys (when added) stay on the server.
import { BEACH_CAMS } from '../lib/beach-cams.mjs';
import { requirePaid } from '../lib/paywall.mjs';
import * as KEYS from '../lib/apikeys.mjs';

const UA = 'PricePocketAsset parcel research site (https://pricepocketasset.com)';
const TTL = 15 * 60e3, FAIL_TTL = 2 * 60e3;
const json = (code, body, cache) => new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': cache || 'no-store' } });

async function getJson(url, ms = 8000, opt = {}) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, Object.assign({ headers: { 'User-Agent': UA }, signal: c.signal }, opt)); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const validLL = (lat, lng) => lat != null && lng != null && Math.abs(lat) > 1 && Math.abs(lng) > 1 && lat >= 17 && lat <= 72 && lng >= -180 && lng <= -60;
const https = u => (typeof u === 'string' && /^https:\/\//.test(u.trim())) ? u.trim() : '';

// 511 platform (AZ511, 511GA): GET {base}/api/v2/get/cameras?key=...&format=json -> [{Id, Roadway, Direction, Latitude, Longitude, Location, Views:[{Id, Url, Status, Description}]}]
// (format documented at https://az511.com/help/endpoint/cameras). Throttled to 10 calls/60 s by the provider: one call returns every camera and is cached.
function ibi511(base, src, operator, viewer) {
  return async function load() {
    const key = KEYS.keyOf(this.keyEnv); if (!key) throw new Error('no key');
    const d = await getJson(base + '/api/v2/get/cameras?' + new URLSearchParams({ key, format: 'json' }), 9000);
    if (!Array.isArray(d)) throw new Error('bad 511 answer');
    const out = [];
    for (const c of d) { const lat = num(c.Latitude), lng = num(c.Longitude); if (!validLL(lat, lng) || c.Id == null) continue;
      for (const v of (Array.isArray(c.Views) ? c.Views : [])) { const img = https(v.Url); if (!img || (v.Status && v.Status !== 'Enabled')) continue;
        out.push({ src, id: c.Id + (c.Views.length > 1 ? '-' + v.Id : ''), name: String(v.Description || c.Location || '').trim() || src.toUpperCase() + ' camera ' + c.Id, road: String(c.Roadway || '').trim(),
          direction: /^(Unknown|None)$/i.test(c.Direction || '') ? '' : String(c.Direction || '').trim(), lat, lng, kind: 'snapshot', type: 'Traffic camera', image: img, video: '', viewer, operator, sourceMeta: '' }); } }
    if (!out.length) throw new Error('511 returned no cameras');
    return out;
  };
}

// ---- providers ----------------------------------------------------------------------------------------------
const FL511 = 'https://services.arcgis.com/3wFbqsFPLeKqOlIK/ArcGIS/rest/services/FL511_Traffic_Cameras/FeatureServer/0/query';
const CALTRANS = d => `https://cwwp2.dot.ca.gov/data/d${d}/cctv/cctvStatusD${String(d).padStart(2, '0')}.json`;

export const PROVIDERS = {
  fl: { name: 'FL511 (Florida Department of Transportation)', state: 'FL', bbox: [-87.7, 24.4, -79.9, 31.1], viewer: 'https://www.fl511.com/cctv',
    async load() {
      const out = [];
      for (let off = 0; off < 20000; off += 2000) {
        const d = await getJson(FL511 + '?' + new URLSearchParams({ where: '1=1', outFields: 'ID,DESCRIPT,COUNTY,HIGHWAY,DIRECTION,LATITUDE,LONGITUDE,TIMESTAMP,IMAGE', returnGeometry: 'false', orderByFields: 'OBJECTID_1', resultOffset: String(off), resultRecordCount: '2000', f: 'json' }));
        if (!Array.isArray(d.features)) throw new Error('bad FL511 answer');
        for (const f of d.features) { const a = f.attributes || {}, lat = num(a.LATITUDE), lng = num(a.LONGITUDE), img = https(a.IMAGE);
          if (!validLL(lat, lng) || !img || a.ID == null) continue;
          out.push({ src: 'fl', id: String(a.ID), name: String(a.DESCRIPT || '').trim() || 'FL511 camera ' + a.ID, road: String(a.HIGHWAY || '').trim(), direction: String(a.DIRECTION || '').trim(), lat, lng,
            kind: 'snapshot', type: 'Traffic camera', image: img, video: '', viewer: 'https://www.fl511.com/cctv', operator: 'FL511 / Florida DOT', sourceMeta: a.TIMESTAMP ? 'Directory record ' + a.TIMESTAMP : '' }); }
        if (!d.exceededTransferLimit && d.features.length < 2000) break;
      }
      if (!out.length) throw new Error('FL511 returned no cameras');
      return out;
    } },
  ca: { name: 'Caltrans (California Department of Transportation)', state: 'CA', bbox: [-124.5, 32.5, -114.1, 42.1], viewer: 'https://quickmap.dot.ca.gov/',
    async load() {
      const res = await Promise.allSettled(Array.from({ length: 12 }, (_, i) => getJson(CALTRANS(i + 1), 9000)));
      const out = []; let okCount = 0;
      res.forEach((r, i) => { if (r.status !== 'fulfilled' || !Array.isArray(r.value.data)) return; okCount++;
        for (const x of r.value.data) { const c = x.cctv || {}, loc = c.location || {}, im = c.imageData || {}, lat = num(loc.latitude), lng = num(loc.longitude), img = https(im.static && im.static.currentImageURL);
          if (c.inService === 'false' || !validLL(lat, lng) || !img) continue;
          const vid = https(im.streamingVideoURL);
          out.push({ src: 'ca', id: 'D' + (i + 1) + '-' + (c.index || loc.locationName), name: String(loc.locationName || '').trim() || 'Caltrans camera', road: String(loc.route || '').trim(), direction: String(loc.direction || '').trim(), lat, lng,
            kind: vid ? 'video' : 'snapshot', type: 'Traffic camera', image: img, video: vid, viewer: 'https://quickmap.dot.ca.gov/', operator: 'Caltrans District ' + (i + 1),
            sourceMeta: c.recordTimestamp && c.recordTimestamp.recordDate ? 'Directory record ' + c.recordTimestamp.recordDate + ' ' + (c.recordTimestamp.recordTime || '') : '' }); } });
      if (!okCount) throw new Error('no Caltrans district answered');
      out.partial = okCount < 12; return out;
    } },
  atx: { name: 'City of Austin Transportation & Public Works (traffic cameras)', state: 'TX', bbox: [-98.2, 29.9, -97.3, 30.8], viewer: 'https://data.austintexas.gov/d/b4k4-adkb',
    // Open-data directory (Socrata, no key). Only cameras the city marks TURNED_ON; each has its own public snapshot URL.
    async load() {
      const d = await getJson('https://data.austintexas.gov/resource/b4k4-adkb.json?' + new URLSearchParams({ '$where': "camera_status='TURNED_ON'", '$select': 'camera_id,location_name,primary_st,cross_st,location,screenshot_address,modified_date', '$limit': '2000' }), 12000);
      if (!Array.isArray(d)) throw new Error('bad Austin answer');
      const out = [];
      for (const x of d) { const co = x.location && x.location.coordinates, lng = co ? num(co[0]) : null, lat = co ? num(co[1]) : null, img = https(x.screenshot_address);
        if (!validLL(lat, lng) || !img || x.camera_id == null) continue;
        const name = String(x.location_name || '').replace(/\s+/g, ' ').trim() || 'Austin camera ' + x.camera_id;
        out.push({ src: 'atx', id: String(x.camera_id), name, road: String(x.primary_st || '').trim(), direction: '', lat, lng, kind: 'snapshot', type: 'Traffic camera', image: img, video: '', viewer: 'https://data.austintexas.gov/d/b4k4-adkb',
          operator: 'City of Austin Transportation & Public Works', sourceMeta: x.modified_date ? 'Directory record ' + String(x.modified_date).slice(0, 10) : '' }); }
      if (!out.length) throw new Error('Austin returned no cameras');
      return out;
    } },
  fmy: { name: 'Visit Fort Myers official webcams (Lee County VCB)', state: 'FL', bbox: [-82.4, 26.2, -81.6, 26.9], viewer: 'https://www.visitfortmyers.com/webcams',
    async load() { return BEACH_CAMS; } },
  // Key-based feeds: switched on only when the key is set on the server AND a real record has been verified (see VERIFIED below).
  az: { name: 'AZ511 (Arizona DOT)', state: 'AZ', bbox: [-114.9, 31.3, -109.0, 37.0], viewer: 'https://az511.com/cctv', keyEnv: 'AZ511_KEY', keyed: ibi511('https://az511.com', 'az', 'AZ511 / Arizona DOT', 'https://az511.com/cctv') },
  ga: { name: '511GA (Georgia DOT)', state: 'GA', bbox: [-85.7, 30.3, -80.8, 35.1], viewer: 'https://511ga.org/cctv', keyEnv: 'GA511_KEY', keyed: ibi511('https://511ga.org', 'ga', '511GA / Georgia DOT', 'https://511ga.org/cctv') },
  ny: { name: '511NY (New York State DOT)', state: 'NY', bbox: [-79.8, 40.4, -71.8, 45.1], viewer: 'https://511ny.org/cctv', keyEnv: 'NY511_KEY' },   // adapter not built: different API, developer access pending
  // Viewer-only states: official viewer link, no integrated feed.
  hou: { name: 'Houston TranStar (Houston-area transportation partners)', state: 'TX', bbox: [-96.2, 29.2, -94.6, 30.5], viewer: 'https://traffic.houstontranstar.org/' },
  tx: { name: 'DriveTexas (Texas DOT: Dallas, Fort Worth, San Antonio, El Paso and statewide)', state: 'TX', bbox: [-106.7, 25.8, -93.5, 36.6], viewer: 'https://drivetexas.org/' },
  tn: { name: 'TDOT SmartWay (Tennessee DOT)', state: 'TN', bbox: [-90.4, 34.9, -81.6, 36.7], viewer: 'https://smartway.tn.gov/' },
  mi: { name: 'Mi Drive (Michigan DOT)', state: 'MI', bbox: [-90.5, 41.6, -82.1, 48.4], viewer: 'https://www.michigan.gov/drive' },
  al: { name: 'ALGO Traffic (Alabama DOT)', state: 'AL', bbox: [-88.5, 30.1, -84.8, 35.1], viewer: 'https://algotraffic.com/Cameras' },
};
// Key-based providers are integrated only after a real record was checked with the key. Until then they show the official viewer link.
// To switch one on: add the key in Netlify (AZ511_KEY / GA511_KEY), run tools/cameras/verify.mjs with that key, check the record and preview, then set it true here.
const VERIFIED = { az: false, ga: true, ny: false };   // ga: verified 2026-11-17 by the owner key test (4,330 cameras, live JPEG preview)
export const _verified = VERIFIED;   // tests only
const isLive = id => { const p = PROVIDERS[id]; return !!p.load || !!(p.keyed && p.keyEnv && KEYS.keyOf(p.keyEnv) && VERIFIED[id]); };

const cache = {};   // per provider: { t, list, err }
async function provider(id) {
  const p = PROVIDERS[id], c = cache[id];
  if (c && Date.now() - c.t < (c.err ? FAIL_TTL : TTL)) { if (c.err) throw c.err; return c.list; }
  if (c && c.p) return c.p;
  const run = (p.load || p.keyed).call(p).then(list => { cache[id] = { t: Date.now(), list }; return list; }, err => { cache[id] = { t: Date.now(), err }; throw err; });
  cache[id] = Object.assign({}, c || { t: 0 }, { p: run }); return run;
}
export function _reset() { for (const k of Object.keys(cache)) delete cache[k]; }

const R = 3958.8;
export function miles(a, b, c, d) { const r = x => x * Math.PI / 180, dLat = r(c - a), dLng = r(d - b); const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.min(1, Math.sqrt(h))); }
function nearBox(lat, lng, bb, radius) { const cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v)); return miles(lat, lng, cl(lat, bb[1], bb[3]), cl(lng, bb[0], bb[2])) <= radius; }

export async function nearby(lat, lng, radius = 10, limit = 5, preferSnapshots = false, preferVideo = false) {
  const ids = Object.keys(PROVIDERS).filter(id => nearBox(lat, lng, PROVIDERS[id].bbox, radius));
  const providers = [], all = [];
  await Promise.all(ids.map(async id => {
    const p = PROVIDERS[id];
    if (!isLive(id)) { providers.push({ id, name: p.name, state: p.state, status: 'viewer', viewer: p.viewer }); return; }
    try {
      const list = await provider(id); const seen = new Set();
      for (const c of list) { const k = c.src + '|' + c.id; if (seen.has(k)) continue; seen.add(k); const mi = miles(lat, lng, c.lat, c.lng); if (mi <= radius) all.push(Object.assign({}, c, { miles: Math.round(mi * 100) / 100 })); }
      providers.push({ id, name: p.name, state: p.state, status: 'ok', partial: !!list.partial, viewer: p.viewer });
    } catch (e) { providers.push({ id, name: p.name, state: p.state, status: 'unavailable', viewer: p.viewer }); }
  }));
  const priority = camera => preferVideo && camera.video ? 2 : preferSnapshots && camera.image ? 1 : 0;
  all.sort((a, b) => priority(b) - priority(a) || a.miles - b.miles || a.name.localeCompare(b.name));
  providers.sort((a, b) => a.id.localeCompare(b.id));
  return { ok: true, radius, limit, cameras: all.slice(0, limit), totalInRadius: all.length, providers, checked: new Date().toISOString() };
}

const metaCache = new Map();
export async function imageMeta(src, id) {
  const list = await provider(src); const c = list.find(x => x.id === id); if (!c || !c.image) return { ok: false };
  const k = src + '|' + id, m = metaCache.get(k); if (m && Date.now() - m.t < 30e3) return m.v;
  let lm = null;
  try { const ac = new AbortController(), t = setTimeout(() => ac.abort(), 5000); const r = await fetch(c.image, { method: 'HEAD', headers: { 'User-Agent': UA }, signal: ac.signal }).finally(() => clearTimeout(t));
    const h = r.ok && r.headers.get('last-modified'); const d = h ? new Date(h) : null; if (d && !isNaN(d) && d.getTime() <= Date.now() + 120e3) lm = d.toISOString(); } catch (e) { /* time unavailable */ }
  const v = { ok: true, lastModified: lm }; if (metaCache.size > 500) metaCache.clear(); metaCache.set(k, { t: Date.now(), v }); return v;
}

const hits = new Map();
const limited = ip => { const now = Date.now(), r = (hits.get(ip) || []).filter(t => now - t < 60e3); if (r.length >= 60) return true; r.push(now); hits.set(ip, r); return false; };
export default async function handler(req, context) {
  if (req.method !== 'GET') return json(405, { ok: false, error: 'GET only.' });
  const deny = await requirePaid(req); if (deny) return deny;
  await KEYS.load();
  const ip = req.headers.get('x-nf-client-connection-ip') || (context && context.ip) || 'x'; if (limited(ip)) return json(429, { ok: false, error: 'Too many requests.' });
  const u = new URL(req.url), q = k => u.searchParams.get(k);
  if (q('meta')) { const src = q('src'), id = q('id'); if (!PROVIDERS[src] || !isLive(src) || !id) return json(400, { ok: false });
    try { return json(200, await imageMeta(src, id)); } catch (e) { return json(200, { ok: false }); } }
  const lat = num(q('lat')), lng = num(q('lng'));
  if (!validLL(lat, lng)) return json(400, { ok: false, error: 'Bad location.' });
  const radius = Math.min(50, Math.max(1, num(q('radius')) || 10)), limit = Math.min(20, Math.max(1, Math.round(num(q('limit')) || 5)));
  return json(200, await nearby(lat, lng, radius, limit, q('preview') === '1', q('video') === '1'));
}
