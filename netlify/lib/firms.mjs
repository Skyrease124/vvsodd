// NASA FIRMS active-fire detections (VIIRS satellites, near real time) around a point.
// API: https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/{SOURCE}/{west,south,east,north}/{days}
// These are satellite heat detections, not official fire perimeters or evacuation orders.
import * as KEYS from './apikeys.mjs';
const BASE = process.env.FIRMS_BASE || 'https://firms.modaps.eosdis.nasa.gov';
export const SOURCES = ['VIIRS_NOAA20_NRT', 'VIIRS_SNPP_NRT'];
const UA = 'PricePocketAsset parcel research site (https://pricepocketasset.com)';
const cache = new Map();
export function parseCsv(text) {
  const lines = String(text || '').trim().split(/\r?\n/); if (lines.length < 1 || !/latitude/i.test(lines[0])) throw new Error(/invalid|key/i.test(text) ? 'FIRMS key rejected' : 'unexpected FIRMS answer');
  const h = lines[0].split(','), ix = k => h.indexOf(k);
  return lines.slice(1).map(l => l.split(',')).map(c => ({ lat: Number(c[ix('latitude')]), lng: Number(c[ix('longitude')]), date: c[ix('acq_date')] || '', time: c[ix('acq_time')] || '', conf: c[ix('confidence')] || '', frp: Number(c[ix('frp')]) || null, sat: c[ix('satellite')] || '', dn: c[ix('daynight')] || '' }))
    .filter(x => Number.isFinite(x.lat) && Number.isFinite(x.lng));
}
const R = 3958.8, rad = d => d * Math.PI / 180;
export const miles = (a, b, c, d) => { const x = Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
async function area(src, bbox, days, key) {
  const url = BASE + '/api/area/csv/' + encodeURIComponent(key) + '/' + src + '/' + bbox.map(v => v.toFixed(3)).join(',') + '/' + days;
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(12000) });
  const t = await r.text(); if (!r.ok) throw new Error('FIRMS HTTP ' + r.status); return parseCsv(t);
}
export async function nearby(lat, lng, radius = 25, days = 3) {
  await KEYS.load(); const key = KEYS.keyOf('FIRMS_MAP_KEY'); if (!key) return { ok: false, reason: 'nokey' };
  const dLat = radius / 69, dLng = radius / (69 * Math.max(.2, Math.cos(rad(lat))));
  const bbox = [lng - dLng, lat - dLat, lng + dLng, lat + dLat], ck = bbox.map(v => v.toFixed(2)).join() + '|' + days, hit = cache.get(ck);
  if (hit && Date.now() - hit.t < 30 * 60e3) return hit.v;
  const got = await Promise.allSettled(SOURCES.map(s => area(s, bbox, days, key)));
  if (got.every(g => g.status === 'rejected')) throw got[0].reason;
  const all = got.flatMap(g => g.status === 'fulfilled' ? g.value : []).map(f => Object.assign(f, { miles: Math.round(miles(lat, lng, f.lat, f.lng) * 10) / 10 })).filter(f => f.miles <= radius).filter((f, i, arr) => arr.findIndex(g => g.lat === f.lat && g.lng === f.lng && g.date === f.date && g.time === f.time) === i).sort((a, b) => a.miles - b.miles);
  const v = { ok: true, radius, days, total: all.length, fires: all.slice(0, 25), partial: got.some(g => g.status === 'rejected'), checked: new Date().toISOString(), source: 'NASA FIRMS (VIIRS NOAA-20 and Suomi NPP, near real time)' };
  if (cache.size > 300) cache.clear(); cache.set(ck, { t: Date.now(), v }); return v;
}
