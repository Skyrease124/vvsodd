// Neighborhood facts from the U.S. Census Bureau American Community Survey (ACS) 5-year estimates.
// The spot's census tract comes from the Census geocoder; the same numbers are fetched for the county and the state to compare.
// County population change compares the newest 5-year release with the one 5 years earlier (tract borders changed in 2020, so tracts are not compared).
import * as KEYS from './apikeys.mjs';
const API = process.env.CENSUS_API || 'https://api.census.gov/data', GEO = process.env.CENSUS_GEO || 'https://geocoding.geo.census.gov/geocoder';
const V = { homeValue: 'B25077_001E', rent: 'B25064_001E', income: 'B19013_001E', units: 'B25002_001E', vacant: 'B25002_003E', occ: 'B25003_001E', owner: 'B25003_002E', pop: 'B01003_001E' };
const cache = new Map(); let YEAR = null;
const memo = async (k, ttl, f) => { const h = cache.get(k); if (h && Date.now() - h.t < ttl) return h.v; const v = await f(); if (cache.size > 1500) cache.clear(); cache.set(k, { t: Date.now(), v }); return v; };
const getJ = async u => { const r = await fetch(u, { signal: AbortSignal.timeout(10000) }); const t = await r.text(); if (!r.ok || !/^\s*\[/.test(t)) throw new Error('census ' + r.status + ' ' + t.slice(0, 80).replace(/\s+/g, ' ')); return JSON.parse(t); };
async function year(key) {
  if (YEAR) return YEAR;
  const now = new Date().getFullYear();
  for (let y = now - 1; y >= now - 4; y--) { try { await getJ(API + '/' + y + '/acs/acs5?get=NAME&for=state:01&key=' + encodeURIComponent(key)); YEAR = y; return y; } catch (e) { if (/key/i.test(e.message)) throw e; } }
  throw new Error('no ACS year');
}
async function row(y, key, forc, inc) {
  const u = API + '/' + y + '/acs/acs5?get=NAME,' + Object.values(V).join(',') + '&for=' + encodeURIComponent(forc) + (inc ? '&in=' + encodeURIComponent(inc) : '') + '&key=' + encodeURIComponent(key);
  const d = await getJ(u); const h = d[0], r = d[1]; if (!r) return null;
  const g = k => { const v = Number(r[h.indexOf(V[k])]); return Number.isFinite(v) && v >= 0 ? v : null; };
  const o = { name: r[h.indexOf('NAME')], homeValue: g('homeValue'), rent: g('rent'), income: g('income'), pop: g('pop') };
  o.vacancy = g('units') ? Math.round(1000 * (g('vacant') || 0) / g('units')) / 10 : null;
  o.ownerPct = g('occ') ? Math.round(1000 * (g('owner') || 0) / g('occ')) / 10 : null;
  return o;
}
export async function tractAt(lat, lng) {
  return memo('tr' + lat.toFixed(4) + lng.toFixed(4), 30 * 864e5, async () => {
    const d = await (await fetch(GEO + '/geographies/coordinates?' + new URLSearchParams({ x: lng, y: lat, benchmark: 'Public_AR_Current', vintage: 'Current_Current', layers: 'Census Tracts', format: 'json' }), { signal: AbortSignal.timeout(10000) })).json();
    const t = d && d.result && d.result.geographies && (d.result.geographies['Census Tracts'] || [])[0]; return t ? { state: t.STATE, county: t.COUNTY, tract: t.TRACT } : null; });
}
export async function neighborhood(lat, lng) {
  await KEYS.load(); const key = KEYS.keyOf('CENSUS_KEY'); if (!key) return { ok: false, reason: 'nokey' };
  const t = await tractAt(lat, lng); if (!t) return { ok: true, none: true };
  return memo('nb' + t.state + t.county + t.tract, 7 * 864e5, async () => {
    const y = await year(key);
    const [tr, co, st, coOld] = await Promise.all([row(y, key, 'tract:' + t.tract, 'state:' + t.state + ' county:' + t.county), row(y, key, 'county:' + t.county, 'state:' + t.state), row(y, key, 'state:' + t.state), row(y - 5, key, 'county:' + t.county, 'state:' + t.state).catch(() => null)]);
    const growth = co && coOld && co.pop && coOld.pop ? Math.round(1000 * (co.pop - coOld.pop) / coOld.pop) / 10 : null;
    return { ok: true, year: y, range: (y - 4) + '–' + y, tract: tr, county: co, state: st, countyGrowth: growth, growthYears: (y - 5) + '→' + y, source: 'U.S. Census Bureau, American Community Survey 5-year estimates' };
  });
}
