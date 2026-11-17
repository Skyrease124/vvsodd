// Weather for signed-in members.
//   GET ?mode=me              -> widget: approximate location from the connection (Netlify geo), no browser popup; never stored
//   GET ?mode=me&lat=&lng=    -> widget: the member tapped "Use my exact location"; used for this one lookup only, never stored
//   GET ?mode=spot&lat=&lng=  -> "Weather & air" on a lot / spot (paid members)
// Adds official National Weather Service alerts for the point when there are any.
import * as auth from '../lib/auth.mjs';
import { requirePaid } from '../lib/paywall.mjs';
import * as W from '../lib/wx.mjs';
import { lookup as nwsAlerts } from './weather.mjs';
const json = (c, b) => new Response(JSON.stringify(b), { status: c, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const hits = new Map();
export default async function handler(req, context) {
  if (req.method !== 'GET') return json(405, { ok: false });
  const u = new URL(req.url), mode = u.searchParams.get('mode') || 'me';
  if (mode === 'spot') { const deny = await requirePaid(req); if (deny) return deny; }
  else { const me = await auth.userFromCookie(req.headers.get('cookie')); if (!me) return json(401, { ok: false, error: 'Sign in first.' }); }
  const ip = req.headers.get('x-nf-client-connection-ip') || (context && context.ip) || 'x', now = Date.now(), r = (hits.get(ip) || []).filter(t => now - t < 60e3);
  if (r.length >= 20) return json(429, { ok: false, error: 'Too many requests.' }); r.push(now); hits.set(ip, r);
  let lat = Number(u.searchParams.get('lat')), lng = Number(u.searchParams.get('lng')), approx = false, exact = u.searchParams.has('lat');
  if (!exact) { const g = (context && context.geo) || {}; lat = Number(g.latitude); lng = Number(g.longitude); approx = true;
    if (!(g.country && g.country.code === 'US') || !Number.isFinite(lat)) return json(200, { ok: false, reason: 'nolocation' }); }
  if (!(lat >= 18 && lat <= 72 && lng >= -180 && lng <= -60)) return json(200, { ok: false, reason: 'nolocation' });
  try {
    const v = await W.forecast(lat, lng, mode === 'spot' ? 2 : 1, mode === 'spot' ? 3600e3 : 2 * 3600e3);
    if (!v.ok) return json(200, v);
    let alerts = []; try { const a = await nwsAlerts(lat, lng); if (a && a.ok) alerts = (a.alerts || []).slice(0, 3).map(x => ({ event: x.event, headline: x.headline, link: x.link })); } catch (e) { /* alerts optional */ }
    return json(200, Object.assign({}, v, { approx, alerts }));
  } catch (e) { return json(200, { ok: false, reason: 'lookup' }); }
}
