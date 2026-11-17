// Energy facts for a spot from the National Laboratory of the Rockies (NLR, formerly NREL) developer APIs:
//  solar: PVWatts v8 estimate for a 4 kW fixed rooftop-style array (annual AC kWh) + average sun (kWh/m2/day)
//  rates: utility name and average $/kWh (utility_rates v3; the lab's dataset is older, so it is labeled "average, may be out of date")
//  ev:    nearest public EV charging stations within 25 miles (alt-fuel-stations v1)
// Each part fails on its own. Estimates only.
import * as KEYS from './apikeys.mjs';
const BASE = process.env.NLR_BASE || 'https://developer.nlr.gov/api';
const UA = 'PricePocketAsset parcel research site (https://pricepocketasset.com)';
const cache = new Map();
const get = async (path, q) => { const r = await fetch(BASE + path + '?' + new URLSearchParams(q), { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) }); if (!r.ok) throw new Error('NLR HTTP ' + r.status); const d = await r.json(); if (d.errors && d.errors.length) throw new Error(String(d.errors[0]).slice(0, 120)); return d; };
export async function lookup(lat, lng) {
  await KEYS.load(); const key = KEYS.keyOf('NLR_API_KEY'); if (!key) return { ok: false, reason: 'nokey' };
  const ck = lat.toFixed(2) + ',' + lng.toFixed(2), hit = cache.get(ck); if (hit && Date.now() - hit.t < 24 * 3600e3) return hit.v;
  const [pv, ur, ev] = await Promise.allSettled([
    get('/pvwatts/v8.json', { api_key: key, lat, lon: lng, system_capacity: 4, azimuth: 180, tilt: 20, array_type: 1, module_type: 0, losses: 14 }),
    get('/utility_rates/v3.json', { api_key: key, lat, lon: lng }),
    get('/alt-fuel-stations/v1/nearest.json', { api_key: key, latitude: lat, longitude: lng, fuel_type: 'ELEC', radius: 25, limit: 5, status: 'E', access: 'public' })]);
  if ([pv, ur, ev].every(x => x.status === 'rejected')) throw pv.reason;
  const v = { ok: true, checked: new Date().toISOString() };
  v.solar = pv.status === 'fulfilled' && pv.value.outputs ? { kwhYear: Math.round(pv.value.outputs.ac_annual), sun: Math.round(pv.value.outputs.solrad_annual * 10) / 10, size: 4 } : null;
  const o = ur.status === 'fulfilled' && ur.value.outputs;
  v.rates = o && o.utility_name && o.utility_name !== 'no data' ? { utility: o.utility_name, residential: o.residential || null, commercial: o.commercial || null, source: ((ur.value.metadata || {}).sources || []).join(', ') } : (ur.status === 'fulfilled' ? { none: true } : null);
  v.ev = ev.status === 'fulfilled' ? { total: ev.value.total_results || 0, stations: (ev.value.fuel_stations || []).map(s => ({ name: s.station_name, address: [s.street_address, s.city, s.state].filter(Boolean).join(', '), miles: Math.round(s.distance * 10) / 10, l2: s.ev_level2_evse_num || 0, fast: s.ev_dc_fast_num || 0, network: s.ev_network || '' })) } : null;
  if (cache.size > 500) cache.clear(); cache.set(ck, { t: Date.now(), v }); return v;
}
