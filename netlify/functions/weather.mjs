// Active Weather Alerts: proxies the free National Weather Service alerts API for ONE point (a point inside the parcel outline).
//   GET ?lat=&lng=  ->  { ok:true, alerts:[{id,event,severity,headline,area,sender,sent,expires,ends,link}], point:{lat,lng}, queried:<iso> }   or   { ok:false }
// An empty alerts list with ok:true means the lookup SUCCEEDED and found nothing; a failure is never reported as an empty list.
// NWS asks API clients to identify themselves in the User-Agent, so every call carries one (site name and URL only). Results are cached briefly.
import { json, limited } from '../lib/geo.mjs';
const UA = 'PricePocketAsset parcel research site (https://pricepocketasset.com)';
const cache = new Map(), TTL = 120e3;
const clean = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const iso = s => { const d = new Date(s); return s && isFinite(d) ? d.toISOString() : ''; };
const nws = u => /^https:\/\/api\.weather\.gov\/alerts\/[A-Za-z0-9._:%-]+$/.test(u || '') ? u : '';

export async function lookup(lat, lng) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), 8000);
  let d; try {
    const r = await fetch('https://api.weather.gov/alerts/active?point=' + lat + ',' + lng, { headers: { 'User-Agent': UA, Accept: 'application/geo+json' }, signal: c.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status); d = await r.json();
  } finally { clearTimeout(t); }
  if (!d || !Array.isArray(d.features)) throw new Error('bad result');
  const now = Date.now(), pageLink = 'https://forecast.weather.gov/MapClick.php?lat=' + lat + '&lon=' + lng;
  const alerts = d.features.filter(f => f && f.properties && f.properties.event && (!f.properties.status || f.properties.status === 'Actual')).map(f => { const p = f.properties; return {
    id: clean(p.id), event: clean(p.event), severity: clean(p.severity), headline: clean(p.headline), area: clean(p.areaDesc), sender: clean(p.senderName), sent: iso(p.sent), expires: iso(p.expires || p.ends), ends: iso(p.ends),
    link: nws(f.id) || pageLink }; }).filter(a => !a.expires || Date.parse(a.expires) > now);
  const rank = { Extreme: 0, Severe: 1, Moderate: 2, Minor: 3 }; alerts.sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9) || Date.parse(a.expires) - Date.parse(b.expires));
  return { ok: true, alerts, point: { lat, lng }, pageLink, queried: new Date().toISOString() };
}

export default async function handler(req, context) {
  const ip = req.headers.get('x-nf-client-connection-ip') || (context && context.ip) || 'x';
  if (limited('wx' + ip, 90, 60000)) return json(429, { ok: false, error: 'Too many requests.' });
  const q = new URL(req.url).searchParams, lat = Number(q.get('lat')), lng = Number(q.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 24 || lat > 31.1 || lng < -88 || lng > -79.5) return json(400, { ok: false, error: 'Bad point.' });
  const la = Number(lat.toFixed(4)), ln = Number(lng.toFixed(4)), key = la + ',' + ln;
  const hit = cache.get(key); if (hit && Date.now() - hit.t < TTL) { const r = json(200, hit.v); r.headers.set('Cache-Control', 'public, max-age=60'); return r; }
  try {
    const v = await lookup(la, ln); if (cache.size > 500) cache.clear(); cache.set(key, { t: Date.now(), v });
    const r = json(200, v); r.headers.set('Cache-Control', 'public, max-age=60'); return r;
  } catch (e) { return json(200, { ok: false, error: 'NWS lookup failed' }); }
}
