// WeatherAPI.com: current conditions, 3-day forecast and air quality for a point. Cached so members in the same area share one lookup.
import * as KEYS from './apikeys.mjs';
const BASE = process.env.WEATHERAPI_BASE || 'https://api.weatherapi.com/v1';
const cache = new Map();
const EPA = ['', 'Good', 'Moderate', 'Unhealthy for sensitive groups', 'Unhealthy', 'Very unhealthy', 'Hazardous'];
export async function forecast(lat, lng, prec = 2, ttl = 2 * 3600e3) {
  await KEYS.load(); const key = KEYS.keyOf('WEATHERAPI_KEY'); if (!key) return { ok: false, reason: 'nokey' };
  const q = lat.toFixed(prec) + ',' + lng.toFixed(prec), hit = cache.get(q); if (hit && Date.now() - hit.t < ttl) return hit.v;
  const r = await fetch(BASE + '/forecast.json?' + new URLSearchParams({ key, q, days: 3, aqi: 'yes', alerts: 'no' }), { signal: AbortSignal.timeout(9000) });
  const d = await r.json().catch(() => null); if (!r.ok || !d || !d.current) throw new Error('WeatherAPI ' + r.status + (d && d.error ? ' ' + d.error.message : ''));
  const c = d.current, aq = c.air_quality || {}, epa = aq['us-epa-index'];
  const v = { ok: true, place: { name: d.location.name, region: d.location.region },
    now: { f: Math.round(c.temp_f), feels: Math.round(c.feelslike_f), text: c.condition.text, icon: 'https:' + c.condition.icon, wind: Math.round(c.wind_mph), windDir: c.wind_dir, humidity: c.humidity, updated: c.last_updated },
    days: (d.forecast.forecastday || []).map(x => ({ date: x.date, hi: Math.round(x.day.maxtemp_f), lo: Math.round(x.day.mintemp_f), text: x.day.condition.text, icon: 'https:' + x.day.condition.icon, rain: x.day.daily_chance_of_rain, inches: x.day.totalprecip_in })),
    air: epa ? { index: epa, label: EPA[epa] || '', pm25: aq.pm2_5 != null ? Math.round(aq.pm2_5 * 10) / 10 : null, ozone: aq.o3 != null ? Math.round(aq.o3) : null } : null,
    checked: new Date().toISOString(), source: 'WeatherAPI.com' };
  if (cache.size > 2000) cache.clear(); cache.set(q, { t: Date.now(), v }); return v;
}
