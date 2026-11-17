// County news (web request): serves the cached stories for ONE county and, when there are none yet, starts the background lookup.
//   GET ?state=FL&county=Volusia  ->  { ok:true, state, county, articles:[{title,url,domain,date,topics,scope:'county'}], fetchedAt, stale }
//                                 or  { ok:true, pending:true }   (the lookup has started; ask again in a few seconds)
//                                 or  { ok:false, reason:'lookup' }
// A story is never parcel-specific: this function takes no parcel ID and every story is "county" scope.
import * as N from '../lib/news.mjs';
const json = (code, body) => new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const hits = new Map();
const limited = ip => { const now = Date.now(), r = (hits.get(ip) || []).filter(t => now - t < 60e3); if (r.length >= 40) return true; r.push(now); hits.set(ip, r); return false; };
let trigger = null;
export const _setTrigger = f => { trigger = f; };

const starting = new Set();
export const _resetStarting = () => starting.clear();
export async function news(state, county, origin) {
  const c = await N.readCache(state, county), shape = (x, stale) => ({ ok: true, state, county, articles: x.articles, fetchedAt: new Date(x.t).toISOString(), stale });
  if (c && c.fresh) return shape(c, false);
  const { failKey } = N.keys(state, county), fail = await N.auth.kvGet(failKey), failed = fail && Date.now() - fail.t < N.FAIL_TTL;
  const { key: ck, reqKey } = N.keys(state, county);
  if (await N.shouldRefresh(state, county) && !starting.has(ck)) {
    starting.add(ck); setTimeout(() => starting.delete(ck), 60e3); await N.auth.kvPut(reqKey, { t: Date.now() });
    try { await (trigger ? trigger(state, county) : fetch(origin + '/.netlify/functions/countynews-background', { method: 'POST', body: JSON.stringify({ state, county }), signal: AbortSignal.timeout(4000) })); } catch (e) { /* the next visit tries again */ }
    if (c && c.usable) return shape(c, true);
    return { ok: true, pending: true, state, county };
  }
  if (c && c.usable) return shape(c, true);
  if (failed) return { ok: false, reason: 'lookup', detail: fail.why || '' };
  return { ok: true, pending: true, state, county };            // a lookup is already running
}

export default async function handler(req, context) {
  if (req.method !== 'GET') return json(405, { ok: false, error: 'GET only.' });
  const ip = req.headers.get('x-nf-client-connection-ip') || (context && context.ip) || 'x';
  if (limited('n' + ip)) return json(429, { ok: false, error: 'Too many requests.' });
  const u = new URL(req.url), state = String(u.searchParams.get('state') || '').toUpperCase(), county = String(u.searchParams.get('county') || '').trim();
  if (!N.STATE_NAMES[state] || !/^[A-Za-z][A-Za-z .'\-]{1,39}$/.test(county) || !N.knownCounties().has(state + '|' + county)) return json(400, { ok: false, error: 'Unknown county.' });
  return json(200, await news(state, county, u.origin));
}
