// Paid members: GET ?kind=crime|parks&lat=&lng=
import { requirePaid } from '../lib/paywall.mjs';
import * as G from '../lib/govdata.mjs';
const json = (c, b) => new Response(JSON.stringify(b), { status: c, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const hits = new Map();
export default async function handler(req, context) {
  if (req.method !== 'GET') return json(405, { ok: false });
  const deny = await requirePaid(req); if (deny) return deny;
  const ip = req.headers.get('x-nf-client-connection-ip') || (context && context.ip) || 'x', now = Date.now(), r = (hits.get(ip) || []).filter(t => now - t < 60e3);
  if (r.length >= 20) return json(429, { ok: false, error: 'Too many requests.' }); r.push(now); hits.set(ip, r);
  const u = new URL(req.url), lat = Number(u.searchParams.get('lat')), lng = Number(u.searchParams.get('lng')), kind = u.searchParams.get('kind');
  if (!(lat >= 18 && lat <= 72 && lng >= -180 && lng <= -60) || !/^(crime|parks)$/.test(kind)) return json(400, { ok: false });
  try { return json(200, await (kind === 'crime' ? G.crime(lat, lng) : G.parks(lat, lng))); } catch (e) { return json(200, { ok: false, reason: 'lookup' }); }
}
