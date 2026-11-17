// Active fires near a point (paid members). GET ?lat=&lng=&radius=25&days=3
//  -> { ok:true, radius, days, total, fires:[{lat,lng,date,time,conf,frp,miles}], partial, checked, source }  or { ok:false, reason:'nokey'|'lookup' }
import { requirePaid } from '../lib/paywall.mjs';
import * as F from '../lib/firms.mjs';
const json = (c, b) => new Response(JSON.stringify(b), { status: c, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const hits = new Map();
export default async function handler(req, context) {
  if (req.method !== 'GET') return json(405, { ok: false });
  const deny = await requirePaid(req); if (deny) return deny;
  const ip = req.headers.get('x-nf-client-connection-ip') || (context && context.ip) || 'x', now = Date.now(), r = (hits.get(ip) || []).filter(t => now - t < 60e3);
  if (r.length >= 30) return json(429, { ok: false, error: 'Too many requests.' }); r.push(now); hits.set(ip, r);
  const u = new URL(req.url), lat = Number(u.searchParams.get('lat')), lng = Number(u.searchParams.get('lng'));
  const radius = Math.min(50, Math.max(5, Number(u.searchParams.get('radius')) || 25)), days = Math.min(7, Math.max(1, Number(u.searchParams.get('days')) || 3));
  if (!(lat >= 18 && lat <= 72 && lng >= -180 && lng <= -60)) return json(400, { ok: false, error: 'Bad location.' });
  try { return json(200, await F.nearby(lat, lng, radius, days)); } catch (e) { return json(200, { ok: false, reason: 'lookup' }); }
}
