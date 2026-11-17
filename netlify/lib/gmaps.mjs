// Google Maps Platform for paid members, server-side so the key never reaches a browser.
//  tiles:   Map Tiles API 2D (satellite / roadmap); one session per map type, renewed before it expires
//  street:  Street View Static (metadata first, which is free; image only when imagery exists)
//  nearby:  Places API (New) searchNearby: closest grocery, hospital, school, gas, pharmacy
// A daily cap (per server instance) stops Google calls and the site falls back to the free maps.
import * as KEYS from './apikeys.mjs';
const T = process.env.GTILE_BASE || 'https://tile.googleapis.com/v1', M = process.env.GMAPS_BASE || 'https://maps.googleapis.com/maps/api', P = process.env.GPLACES_BASE || 'https://places.googleapis.com/v1';
const CAP = { tiles: Number(process.env.GTILE_DAILY_CAP || 20000), street: Number(process.env.GSV_DAILY_CAP || 600), nearby: Number(process.env.GPLACES_DAILY_CAP || 400), road: Number(process.env.GROADS_DAILY_CAP || 800) };
let day = '', used = { tiles: 0, street: 0, nearby: 0, road: 0 };
export function spend(kind) { const d = new Date().toISOString().slice(0, 10); if (d !== day) { day = d; used = { tiles: 0, street: 0, nearby: 0, road: 0 }; } if (used[kind] >= CAP[kind]) return false; used[kind]++; return true; }
export const key = async () => { await KEYS.load(); return KEYS.keyOf('GOOGLE_VISION_KEY'); };
const sess = {};
async function session(k, type) {
  const s = sess[type]; if (s && s.exp > Date.now() + 3600e3) return s.id;
  const r = await fetch(T + '/createSession?key=' + encodeURIComponent(k), { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8000), body: JSON.stringify({ mapType: type, language: 'en-US', region: 'US' }) });
  const d = await r.json(); if (!r.ok || !d.session) throw new Error('session ' + r.status + ' ' + ((d.error && d.error.message) || ''));
  sess[type] = { id: d.session, exp: Number(d.expiry) * 1000 || Date.now() + 864e5 }; return d.session;
}
export async function tile(type, z, x, y) {
  const k = await key(); if (!k) return null;
  const s = await session(k, type);
  const r = await fetch(T + '/2dtiles/' + z + '/' + x + '/' + y + '?session=' + s + '&key=' + encodeURIComponent(k), { signal: AbortSignal.timeout(8000) });
  if (r.status === 401 || r.status === 403) { delete sess[type]; }
  if (!r.ok) throw new Error('tile ' + r.status);
  return { type: r.headers.get('content-type') || 'image/jpeg', body: new Uint8Array(await r.arrayBuffer()) };
}
export async function street(lat, lng) {
  const k = await key(); if (!k) return { ok: false, reason: 'nokey' };
  const m = await (await fetch(M + '/streetview/metadata?' + new URLSearchParams({ location: lat + ',' + lng, radius: 80, source: 'outdoor', key: k }), { signal: AbortSignal.timeout(8000) })).json();
  if (m.status !== 'OK') return { ok: true, none: true };
  const r = await fetch(M + '/streetview?' + new URLSearchParams({ size: '640x400', location: m.location.lat + ',' + m.location.lng, radius: 80, source: 'outdoor', fov: 90, key: k }), { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error('sv ' + r.status);
  return { ok: true, date: m.date || '', type: r.headers.get('content-type') || 'image/jpeg', body: new Uint8Array(await r.arrayBuffer()) };
}
const R = 3958.8, rad = d => d * Math.PI / 180, miles = (a, b, c, d) => 2 * R * Math.asin(Math.sqrt(Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2));
export const CATS = [['grocery_store', 'Grocery'], ['supermarket', 'Grocery'], ['hospital', 'Hospital'], ['pharmacy', 'Pharmacy'], ['gas_station', 'Gas'], ['school', 'School']];
const ncache = new Map();
export async function nearby(lat, lng) {
  const k = await key(); if (!k) return { ok: false, reason: 'nokey' };
  const ck = lat.toFixed(3) + ',' + lng.toFixed(3), h = ncache.get(ck); if (h && Date.now() - h.t < 7 * 864e5) return h.v;
  const out = {};
  for (const group of [['grocery_store', 'supermarket', 'pharmacy', 'gas_station'], ['hospital', 'school']]) {
    const r = await fetch(P + '/places:searchNearby', { method: 'POST', signal: AbortSignal.timeout(9000), headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': k, 'X-Goog-FieldMask': 'places.displayName,places.location,places.primaryType,places.types,places.formattedAddress' },
      body: JSON.stringify({ includedTypes: group, maxResultCount: 20, rankPreference: 'DISTANCE', locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: 50000 } } }) });
    const d = await r.json(); if (!r.ok) throw new Error('places ' + r.status + ' ' + ((d.error && d.error.message) || ''));
    for (const p of d.places || []) {
      const cat = CATS.find(([t]) => (p.types || []).includes(t)); if (!cat || out[cat[1]]) continue;
      out[cat[1]] = { name: p.displayName && p.displayName.text, address: p.formattedAddress || '', miles: Math.round(miles(lat, lng, p.location.latitude, p.location.longitude) * 10) / 10, lat: p.location.latitude, lng: p.location.longitude };
    }
  }
  const v = { ok: true, places: ['Grocery', 'Pharmacy', 'Gas', 'Hospital', 'School'].map(c => out[c] ? Object.assign({ cat: c }, out[c]) : { cat: c, none: true }), source: 'Google Places' };
  if (ncache.size > 1000) ncache.clear(); ncache.set(ck, { t: Date.now(), v }); return v;
}
// Roads API nearestRoads: closest road segment Google knows near the spot (center + a ring of points ~60 m out).
// Distance only: a nearby road is not proof of legal access (easement/frontage must be confirmed with the county).
const RD = process.env.GROADS_BASE || 'https://roads.googleapis.com/v1';
export async function road(lat, lng) {
  const k = await key(); if (!k) return { ok: false, reason: 'nokey' };
  const pts = [[lat, lng]]; for (let a = 0; a < 360; a += 45) { const dy = 60 / 111320, dx = 60 / (111320 * Math.cos(rad(lat))); pts.push([lat + dy * Math.cos(rad(a)), lng + dx * Math.sin(rad(a))]); }
  const r = await fetch(RD + '/nearestRoads?points=' + pts.map(p => p[0].toFixed(6) + ',' + p[1].toFixed(6)).join('|') + '&key=' + encodeURIComponent(k), { signal: AbortSignal.timeout(9000) });
  const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error('roads ' + r.status + ' ' + ((d.error && d.error.message) || ''));
  const sp = (d.snappedPoints || []).map(s => ({ lat: s.location.latitude, lng: s.location.longitude, ft: Math.round(miles(lat, lng, s.location.latitude, s.location.longitude) * 5280) })).sort((a, b) => a.ft - b.ft);
  if (!sp.length) return { ok: true, none: true };
  return { ok: true, nearest: sp[0] };
}
