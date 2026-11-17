// api.data.gov sources for a spot:
//  crime: FBI Crime Data Explorer. The nearest reporting police agency (city police or sheriff) and its last full calendar year of
//         violent and property crime: counts, and rates per 100,000 people next to the state and US rates. Agency-wide, not the lot.
//  parks: National Park Service units (parks, monuments, trails, seashores...) nearest the spot.
import * as KEYS from './apikeys.mjs';
const UA = 'PricePocketAsset parcel research site (https://pricepocketasset.com)';
const FBI = process.env.FBI_BASE || 'https://api.usa.gov/crime/fbi/cde', NPS = process.env.NPS_BASE || 'https://developer.nps.gov/api/v1';
const R = 3958.8, rad = d => d * Math.PI / 180;
const miles = (a, b, c, d) => 2 * R * Math.asin(Math.sqrt(Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2));
const cache = new Map(); const memo = async (k, ttl, f) => { const h = cache.get(k); if (h && Date.now() - h.t < ttl) return h.v; const v = await f(); if (cache.size > 800) cache.clear(); cache.set(k, { t: Date.now(), v }); return v; };
const getJ = async u => { const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(12000) }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); };
const key = async () => { await KEYS.load(); return KEYS.keyOf('DATAGOV_KEY'); };
export async function stateAt(lat, lng) {
  return memo('st' + lat.toFixed(2) + lng.toFixed(2), 864e5, async () => {
    const u = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/0/query?' + new URLSearchParams({ geometry: lng + ',' + lat, geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: 'STUSAB', returnGeometry: 'false', f: 'json' });
    const d = await getJ(u); const a = d.features && d.features[0] && d.features[0].attributes; return a ? a.STUSAB : null; });
}
export async function crime(lat, lng) {
  const k = await key(); if (!k) return { ok: false, reason: 'nokey' };
  const st = await stateAt(lat, lng); if (!st) return { ok: false, reason: 'nostate' };
  const byCounty = await memo('ag' + st, 864e5, () => getJ(FBI + '/agency/byStateAbbr/' + st + '?API_KEY=' + encodeURIComponent(k)));
  const ags = Object.values(byCounty).flat().filter(a => a && a.latitude && a.longitude && /^(City|County)$/.test(a.agency_type_name)).map(a => Object.assign({}, a, { mi: miles(lat, lng, a.latitude, a.longitude) })).sort((a, b) => a.mi - b.mi);
  if (!ags.length) return { ok: true, none: true };
  const y = new Date().getFullYear() - 1, from = '01-' + y, to = '12-' + y;
  for (const ag of ags.slice(0, 3)) {
    try {
      const out = {};
      for (const [name, code] of [['violent', 'violent-crime'], ['property', 'property-crime']]) {
        const d = await memo('cr' + ag.ori + code + y, 864e5 * 7, () => getJ(FBI + '/summarized/agency/' + ag.ori + '/' + code + '?from=' + from + '&to=' + to + '&API_KEY=' + encodeURIComponent(k)));
        const o = d.offenses || {}, act = Object.entries(o.actuals || {}).find(([n]) => / Offenses$/.test(n)), rt = o.rates || {};
        const sum = m => m ? Object.values(m).reduce((s, v) => s + (Number(v) || 0), 0) : null, months = act ? Object.keys(act[1]).length : 0;
        const agRate = Object.entries(rt).find(([n]) => n === (act && act[0]));
        const stRate = Object.entries(rt).find(([n]) => / Offenses$/.test(n) && !/United States/.test(n) && n !== (act && act[0]));
        out[name] = { count: act ? Math.round(sum(act[1])) : null, months, rate: agRate ? Math.round(sum(agRate[1])) : null, state: stRate ? Math.round(sum(stRate[1])) : null, us: rt['United States Offenses'] ? Math.round(sum(rt['United States Offenses'])) : null };
      }
      if (out.violent.count == null && out.property.count == null) continue;
      return { ok: true, year: y, state: st, agency: { name: ag.agency_name, type: ag.agency_type_name, county: ag.counties, miles: Math.round(ag.mi * 10) / 10 }, violent: out.violent, property: out.property, source: 'FBI Crime Data Explorer' };
    } catch (e) { /* try the next agency */ }
  }
  return { ok: true, none: true, state: st };
}
export async function parks(lat, lng) {
  const k = await key(); if (!k) return { ok: false, reason: 'nokey' };
  const all = await memo('nps', 864e5, async () => (await getJ(NPS + '/parks?limit=600&fields=latitude,longitude&api_key=' + encodeURIComponent(k))).data || []);
  const list = all.filter(p => p.latitude && p.longitude).map(p => ({ name: p.fullName, type: p.designation || '', url: p.url, states: p.states, miles: Math.round(miles(lat, lng, Number(p.latitude), Number(p.longitude)) * 10) / 10, lat: Number(p.latitude), lng: Number(p.longitude) }))
    .filter(p => p.miles <= 120).sort((a, b) => a.miles - b.miles).slice(0, 6);
  return { ok: true, parks: list, source: 'National Park Service' };
}
