// Environmental Restrictions: Florida DEP Institutional Controls Registry (ICR) mapped areas that overlap a Florida parcel.
//   POST { rings }        -> full-boundary check (overlap measured against the whole lot outline)
//   POST { point:[lng,lat] } -> map pin check only (no verified outline)
//   -> { ok:true, mode:'boundary'|'point', matches:[{siteName, siteId, docs, restrictions:[{code, label|null}], mechanisms, media, engineering, effDates, address, city, pct, geom}], queried }
//   or { ok:false, reason:'lookup' }  (the page shows "Registry check unavailable")
import { pc, json, limited, proj, multiArea, esriToMulti, readOutline, outlineKey } from '../lib/geo.mjs';
// Other states: official state maps where one exists, plus EPA's national Superfund institutional control boundaries.
export const CDPHE = 'https://www.cohealthmaps.dphe.state.co.us/arcgis/rest/services/HMWMD/CDPHE_Institutional_Controls/MapServer/0/query';
export const ARDEQ = 'https://gis.arkansas.gov/arcgis/rest/services/FEATURESERVICES/Environment/FeatureServer/9/query';
export const EPA = 'https://services.arcgis.com/cJ9YHowT8TU7DUyn/arcgis/rest/services/FAC_Superfund_Institutional_Control_Boundaries_EPA_Public/FeatureServer/0/query';
const okUrl = (u, rx) => { u = txt(u); return rx.test(u) ? u : ''; };
const SRC = {
  cdphe: { url: CDPHE, fields: 'Site,Feature_ID,PGM_SYS_ID,Document,Summary', name: 'Colorado Department of Public Health and Environment (CDPHE) institutional controls map (March 31, 2023 snapshot)', agency: 'CDPHE',
    map: a => ({ siteName: txt(a.Site), siteId: txt(a.PGM_SYS_ID), docs: okUrl(a.Document, /^https:\/\/oitco\.hylandcloud\.com\//), summary: okUrl(a.Summary, /^https:\/\/oitco\.hylandcloud\.com\//), restrictions: [], mechanisms: list(a.Feature_ID), media: [], engineering: [], effDates: [], address: '', city: '' }) },
  ardeq: { url: ARDEQ, fields: 'name,afin,permit,comment_', name: 'Arkansas Division of Environmental Quality engineering and institutional controls map (approximate areas)', agency: 'Arkansas DEQ',
    map: a => ({ siteName: txt(a.name), siteId: a.afin ? 'AFIN ' + txt(a.afin) : '', docs: '', restrictions: [], mechanisms: [txt(a.permit), txt(a.comment_)].filter(Boolean), media: [], engineering: [], effDates: [], address: '', city: '' }) },
  epa: { url: EPA, fields: 'SITE_NAME,EPA_ID,SITE_FEATURE_NAME,CITY_NAME,STREET_ADDR_TXT,URL_ALIAS_TXT,FEATURE_INFO_URL', name: 'U.S. EPA Superfund institutional control boundaries', agency: 'EPA',
    map: a => ({ siteName: txt(a.SITE_NAME), siteId: txt(a.EPA_ID), docs: okUrl(a.FEATURE_INFO_URL, /^https:\/\/(www\.|cumulis\.)?epa\.gov\//) || okUrl(a.URL_ALIAS_TXT, /^https:\/\/(www\.)?epa\.gov\//), restrictions: [], mechanisms: list(a.SITE_FEATURE_NAME), media: [], engineering: [], effDates: [], address: txt(a.STREET_ADDR_TXT), city: txt(a.CITY_NAME) }) },
};
// which maps are checked per state, and the state registry we cannot check by map (shown to the member)
export const STATES = {
  CO: { src: ['cdphe', 'epa'] }, AR: { src: ['ardeq', 'epa'] },
  AZ: { src: ['epa'], gap: 'Arizona DEQ keeps Declarations of Environmental Use Restriction (DEUR); its map service did not answer our checks, so state DEURs are not included.', link: 'https://azdeq.gov/DEUR' },
  AL: { src: ['epa'], gap: 'Alabama ADEM keeps a Registry of Environmental Covenants that is not published as a map, so state covenants are not included. ADEM Land Division: 334-271-7730.', link: 'https://adem.alabama.gov/' },
  MS: { src: ['epa'], gap: 'Mississippi DEQ environmental covenants are not published as a map, so state covenants are not included.', link: 'https://www.mdeq.ms.gov/' },
  NM: { src: ['epa'], gap: 'New Mexico Environment Department covenants are not published as a map, so state covenants are not included.', link: 'https://www.env.nm.gov/' },
};
async function querySrc(src, geom) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), 6000);
  try {
    const r = await fetch(src.url, { method: 'POST', body: new URLSearchParams(Object.assign({ f: 'json', where: '1=1', inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: src.fields, returnGeometry: 'true', geometryPrecision: '7' }, geom)), signal: c.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status); const d = await r.json(); if (!d || d.error || !Array.isArray(d.features)) throw new Error('service error'); return d.features;
  } finally { clearTimeout(t); }
}
// Non-Florida check: every source must answer, or the whole result is "unavailable" (never a partial "no overlap").
export async function analyzeState(st, rings, point) {
  const cfg = STATES[st]; if (!cfg) throw new Error('state');
  const geom = rings ? { geometry: JSON.stringify({ rings, spatialReference: { wkid: 4326 } }), geometryType: 'esriGeometryPolygon' } : { geometry: point.join(','), geometryType: 'esriGeometryPoint' };
  const res = await Promise.all(cfg.src.map(async k => { try { return await querySrc(SRC[k], geom); } catch (e) { return await querySrc(SRC[k], geom); } }));
  let P, parcel, parcelM2;
  if (rings) { const pts = rings.flat(), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); P = proj((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2); parcel = esriToMulti(rings); parcelM2 = multiArea(parcel, P); if (!(parcelM2 > 0)) throw new Error('bad parcel'); }
  const out = [];
  res.forEach((feats, i) => { const src = SRC[cfg.src[i]]; for (const f of feats) {
    if (!f.attributes || !f.geometry || !f.geometry.rings) continue; let geomOut, pct = null;
    if (rings) { let hit; try { hit = pc.intersection(parcel, esriToMulti(f.geometry.rings)); } catch (e) { continue; } const a = hit.length ? multiArea(hit, P) : 0; if (!(a > 0.01)) continue; geomOut = roundG(hit); pct = Number(Math.min(100, a / parcelM2 * 100).toFixed(2)); }
    else geomOut = roundG(esriToMulti(f.geometry.rings));
    out.push(Object.assign(src.map(f.attributes), { geom: geomOut, pct, source: src.name, agency: src.agency })); } });
  return { ok: true, mode: rings ? 'boundary' : 'point', usState: st, sources: cfg.src.map(k => SRC[k].name), gap: cfg.gap || '', gapLink: cfg.link || '', matches: dedupe(out.sort((x, y) => (y.pct || 0) - (x.pct || 0))), queried: new Date().toISOString().slice(0, 10) };
}
export const ICR = 'https://ca.dep.state.fl.us/arcgis/rest/services/OpenData/DWM_WASTE_ICR_BACKG/MapServer/12/query';
const cache = new Map();
const FIELDS = 'OBJECTID,PRIMARY_SITE_NAME,PRIMARY_SITE_ID,PRIMARY_SITE_DOCUMENTS,PRIMARY_SITE_ADDRESS_LINE_1,PRIMARY_SITE_CITY,BOUNDARY_RESTRICTIONS,BOUNDARY_MECHANISM_TYPES,BOUNDARY_CONTAMINATED_MEDIA,BOUNDARY_ENGINEERING_CONTROLS,BOUNDARY_MECHANISM_EFF_DATES';
// Restriction names as published in the registry, with plain-English meaning. Anything else is shown as its code with "See DEP records for details."
export const RESTRICTIONS = {
  'Groundwater Use': 'Groundwater use is restricted (for example, no new wells).',
  'Potable Use': 'Groundwater may not be used for drinking water.',
  'Irrigation Use': 'Groundwater may not be used for irrigation.',
  'Surface Water Use': 'Use of surface water is restricted.',
  'Land Use': 'Land use is restricted (for example, no residential use).',
  'Digging': 'Digging or excavation is restricted.',
  'Dewatering': 'Dewatering (pumping out groundwater, for example during construction) is restricted.',
  'Stormwater Features': 'Stormwater ponds, swales or similar features are restricted.',
  'Soil Exposure': 'Contaminated soil must stay covered or may not be exposed.',
  'Construction': 'Construction is restricted.',
  'Access Restriction': 'Access to the site is restricted.',
  'Subdivision': 'Subdividing the property is restricted.',
  'Fishing': 'Fishing is restricted.',
  'Landfill Cover': 'A landfill cover must be kept in place.',
  'Hydraulic Containment': 'A groundwater containment system must be kept in place.',
};
const txt = v => (v == null ? '' : String(v).trim());
const list = v => txt(v).split(',').map(s => s.trim()).filter(s => s && s !== 'None');
const docsUrl = v => { const u = txt(v); return /^https:\/\/prodenv\.dep\.state\.fl\.us\//.test(u) ? u : ''; };

async function query(params) {   // one retry: DEP is sometimes slow on a first request; stays under Netlify's 10 s limit
  try { return await query1(params, 5000); } catch (e) { return await query1(params, 4000); }
}
async function query1(params, ms) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(ICR, { method: 'POST', body: new URLSearchParams(Object.assign({ f: 'json', where: '1=1', inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: FIELDS, returnGeometry: 'true', geometryPrecision: '7' }, params)), signal: c.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status); const d = await r.json(); if (!d || d.error || !Array.isArray(d.features)) throw new Error('service error'); return d.features;
  } finally { clearTimeout(t); }
}
function match(a, geom, pct) {
  return { siteName: txt(a.PRIMARY_SITE_NAME), siteId: txt(a.PRIMARY_SITE_ID), docs: docsUrl(a.PRIMARY_SITE_DOCUMENTS),
    restrictions: list(a.BOUNDARY_RESTRICTIONS).map(code => ({ code, label: RESTRICTIONS[code] || null })),
    mechanisms: list(a.BOUNDARY_MECHANISM_TYPES), media: list(a.BOUNDARY_CONTAMINATED_MEDIA), engineering: list(a.BOUNDARY_ENGINEERING_CONTROLS),
    effDates: list(a.BOUNDARY_MECHANISM_EFF_DATES), address: txt(a.PRIMARY_SITE_ADDRESS_LINE_1), city: txt(a.PRIMARY_SITE_CITY), pct, geom };
}
const roundG = mp => mp.map(poly => poly.map(r => r.map(p => [Number(p[0].toFixed(7)), Number(p[1].toFixed(7))])));
function dedupe(ms) { const seen = new Set(); return ms.filter(m => { const k = m.siteId + '|' + m.restrictions.map(r => r.code).join(','); if (seen.has(k)) return false; seen.add(k); return true; }); }

export async function analyze(rings) {
  const feats = await query({ geometry: JSON.stringify({ rings, spatialReference: { wkid: 4326 } }), geometryType: 'esriGeometryPolygon' });
  const pts = rings.flat(), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const P = proj((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2), parcel = esriToMulti(rings), parcelM2 = multiArea(parcel, P);
  if (!(parcelM2 > 0)) throw new Error('bad parcel');
  const out = [];
  for (const f of feats) {
    if (!f.attributes || !f.geometry || !f.geometry.rings) continue;
    let hit; try { hit = pc.intersection(parcel, esriToMulti(f.geometry.rings)); } catch (e) { continue; }
    const a = hit.length ? multiArea(hit, P) : 0; if (!(a > 0.01)) continue;     // touching edges only is not an overlap
    out.push(match(f.attributes, roundG(hit), Number(Math.min(100, a / parcelM2 * 100).toFixed(2))));
  }
  return { ok: true, mode: 'boundary', matches: dedupe(out.sort((x, y) => y.pct - x.pct)), queried: new Date().toISOString().slice(0, 10) };
}
export async function analyzePoint(lng, lat) {
  const feats = await query({ geometry: lng + ',' + lat, geometryType: 'esriGeometryPoint' });
  const out = feats.filter(f => f.attributes).map(f => match(f.attributes, f.geometry && f.geometry.rings ? roundG(esriToMulti(f.geometry.rings)) : [], null));
  return { ok: true, mode: 'point', matches: dedupe(out), queried: new Date().toISOString().slice(0, 10) };
}

export default async function handler(req, context) {
  const ip = req.headers.get('x-nf-client-connection-ip') || (context && context.ip) || 'x';
  if (req.method !== 'POST') return json(405, { ok: false, error: 'POST only.' });
  if (limited('ic' + ip, 40, 60000)) return json(429, { ok: false, error: 'Too many requests.' });
  let body; try { body = await req.clone().json(); } catch (e) { return json(400, { ok: false, error: 'Bad request.' }); }
  let key, run;
  const st = typeof body.state === 'string' ? body.state.toUpperCase() : 'FL';
  if (st !== 'FL') {
    if (!STATES[st]) return json(400, { ok: false, error: 'State not supported.' });
    const okPt = p => Array.isArray(p) && p.length >= 2 && p[0] >= -125 && p[0] <= -66 && p[1] >= 24 && p[1] <= 50;
    let rings = null, point = null;
    if (Array.isArray(body.point) && okPt(body.point.map(Number))) point = body.point.map(Number);
    else if (Array.isArray(body.rings) && body.rings.length && body.rings.length <= 40 && body.rings.every(r => Array.isArray(r) && r.length >= 4 && r.every(okPt)) && body.rings.flat().length <= 6000) rings = body.rings;
    else return json(400, { ok: false, error: 'Bad outline.' });
    if (rings) { const xs = rings.flat().map(p => p[0]), ys = rings.flat().map(p => p[1]); if (Math.max(...xs) - Math.min(...xs) > 0.1 || Math.max(...ys) - Math.min(...ys) > 0.1) return json(400, { ok: false, error: 'Outline too large.' }); }
    key = st + (rings ? outlineKey(rings) : 'p' + point.join(',')); run = () => analyzeState(st, rings, point);
  } else
  if (body && Array.isArray(body.point)) {
    const [lng, lat] = body.point.map(Number);
    if (!(lng >= -88 && lng <= -79.5 && lat >= 24 && lat <= 31.1)) return json(400, { ok: false, error: 'Bad point.' });
    key = 'p' + lng.toFixed(6) + ',' + lat.toFixed(6); run = () => analyzePoint(lng, lat);
  } else {
    const inp = await readOutline(req); if (inp.error) return inp.error; key = outlineKey(inp.rings); run = () => analyze(inp.rings);
  }
  const hit = cache.get(key); if (hit && Date.now() - hit.t < 6 * 3600e3) return json(200, hit.v);
  let v; try { v = await run(); } catch (e) { return json(200, { ok: false, reason: 'lookup' }); }
  if (cache.size > 300) cache.clear(); cache.set(key, { t: Date.now(), v }); return json(200, v);
}
