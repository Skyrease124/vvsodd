// Owner-entered API keys (stored server-side in Netlify Blobs; the value is never sent back to a browser).
// A key in Netlify environment variables still wins if both are set.
import * as auth from './auth.mjs';
export const NAMES = { GA511_KEY: '511GA (Georgia DOT cameras)', AZ511_KEY: 'AZ511 (Arizona DOT cameras)', FIRMS_MAP_KEY: 'NASA FIRMS (active fires)', NLR_API_KEY: 'NLR energy data (solar, power rates, EV charging)', WEATHERAPI_KEY: 'WeatherAPI.com (weather widget, weather & air)', DATAGOV_KEY: 'api.data.gov (FBI crime data, National Park Service)', GOOGLE_VISION_KEY: 'Google Cloud (maps, Street View, places nearby, PDF reading)' };
let cache = { t: 0, v: {} };
export async function load(force) {
  if (!force && Date.now() - cache.t < 60e3) return cache.v;
  const v = {}; for (const n of Object.keys(NAMES)) { try { const r = await auth.kvGet('apikey-' + n); if (r && r.v) v[n] = r.v; } catch (e) { /* keep going */ } }
  cache = { t: Date.now(), v }; return v;
}
export const keyOf = n => process.env[n] || cache.v[n] || '';
export async function save(n, value) { await auth.kvPut('apikey-' + n, { v: value, t: new Date().toISOString() }); await load(true); }
export async function remove(n) { await auth.kvPut('apikey-' + n, { v: '', t: new Date().toISOString() }); await load(true); }
