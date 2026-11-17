// County news: recent stories about rezoning, road construction, flooding, infrastructure and development in ONE county, found with the free GDELT DOC API.
//   GET ?state=FL&county=Volusia  ->  { ok:true, state, county, articles:[{title,url,domain,date,topics,scope:'county'}], fetchedAt, stale }   or  { ok:false, reason:'lookup' }
// Every story is "county" scope: it matched the county + state search, not a parcel. This function never takes a parcel ID, so a story can never be shown as parcel-specific.
// GDELT allows one request every 5 seconds, so each county is cached (shared, 12 h), requests are spaced out, and the last good copy is served when GDELT does not answer.
import * as auth from '../lib/auth.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GDELT = 'https://api.gdeltproject.org/api/v2/doc/doc';
const UA = 'PricePocketAsset parcel research site (https://pricepocketasset.com)';
const TTL = 12 * 3600e3, STALE_MAX = 14 * 24 * 3600e3, FAIL_TTL = 10 * 60e3;
let GAP = 5500;
export const _setGap = ms => { GAP = ms; };
export const STATE_NAMES = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming' };
// what we ask GDELT for, and how a headline is tagged
const QUERY_TOPICS = '(rezoning OR zoning OR "road construction" OR flooding OR infrastructure OR development)';
export const TOPICS = {
  zoning: /rezon|zoning|land[- ]use|variance|comprehensive plan/i,
  roads: /\broad|highway|interstate|\bI-\d+|\bSR[- ]?\d+|\bUS[- ]?\d+|bridge|construction|intersection|roundabout|lane closure|widening/i,
  flood: /flood|hurricane|tropical storm|storm surge|stormwater|drainage|sea level|evacuat/i,
  infra: /infrastructure|water line|water main|sewer|wastewater|utilit|broadband|septic|power line|pipeline|reservoir/i,
  development: /develop|subdivision|housing|apartment|warehouse|mixed-use|annex|master[- ]plan|homes|resort|site plan/i,
};
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const json = (code, body) => new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---- known counties: the registry already shipped with upcoming-sales.json (add a county there and it is allowed here) ----
let known = null;
export function _setKnown(k) { known = k; }
function knownCounties() {
  if (known) return known;
  const HERE = path.dirname(fileURLToPath(import.meta.url)), root = process.env.LAMBDA_TASK_ROOT || process.cwd();
  const f = [path.join(root, 'kinvest-liens/liens/states/upcoming-sales.json'), path.join(HERE, '../../kinvest-liens/liens/states/upcoming-sales.json'), path.join(process.cwd(), 'kinvest-liens/liens/states/upcoming-sales.json')].find(x => fs.existsSync(x));
  known = new Set();
  if (f) { try { const d = JSON.parse(fs.readFileSync(f, 'utf8')); for (const [c, v] of Object.entries(d.counties || {})) known.add((v.state || 'FL') + '|' + c); } catch (e) { /* none */ } }
  return known;
}

// ---- cleaning ----
export function canonUrl(u) { try { const x = new URL(u); if (!/^https?:$/.test(x.protocol)) return ''; x.hash = ''; ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'ref'].forEach(k => x.searchParams.delete(k)); return (x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/+$/, '') + x.search).toLowerCase(); } catch (e) { return ''; } }
export const normTitle = t => String(t).toLowerCase().replace(/\s+[-|–—]\s+[^-|–—]{2,40}$/, '').replace(/[^a-z0-9]+/g, ' ').trim();
const isoDate = s => { const m = /^(\d{4})(\d{2})(\d{2})/.exec(String(s || '')); return m ? m[1] + '-' + m[2] + '-' + m[3] : null; };
const cleanTitle = t => String(t || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);

// Keep a story only if it is about this county (its headline names the county) or about one of our topics; drop incidental mentions. Dedupe by URL and by headline.
export function clean(raw, county) {
  const named = new RegExp('\\b' + esc(county) + '\\s+County\\b', 'i'), seenU = new Set(), seenT = new Set(), out = [];
  for (const a of raw || []) {
    const title = cleanTitle(a.title), cu = canonUrl(a.url), nt = normTitle(title);
    if (!title || !cu || nt.length < 8 || seenU.has(cu) || seenT.has(nt)) continue;
    const topics = Object.keys(TOPICS).filter(k => TOPICS[k].test(title));
    const naming = named.test(title) || (county.length >= 7 && new RegExp('\\b' + esc(county) + '\\b', 'i').test(title));
    if (!naming && !topics.length) continue;
    seenU.add(cu); seenT.add(nt);
    out.push({ title, url: a.url, domain: String(a.domain || '').replace(/^www\./, ''), date: isoDate(a.seendate), topics, scope: 'county', _s: (naming ? 2 : 0) + (topics.length ? 1 : 0) });
  }
  out.sort((x, y) => y._s - x._s || String(y.date || '').localeCompare(String(x.date || '')));
  return out.slice(0, 12).map(({ _s, ...r }) => r);
}

// ---- GDELT, one request at a time and at most one per GAP ms ----
let chain = Promise.resolve(), lastCall = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));
export function _resetPacing() { chain = Promise.resolve(); lastCall = 0; }
function paced(fn) {
  const run = chain.then(async () => { const w = lastCall + GAP - Date.now(); if (w > 3500) throw new Error('busy'); if (w > 0) await sleep(w); lastCall = Date.now(); return fn(); });
  chain = run.catch(() => {}); return run;
}
async function gdelt(county, state) {
  const q = '"' + county + ' County" ' + STATE_NAMES[state] + ' ' + QUERY_TOPICS + ' sourcecountry:US sourcelang:english';
  const url = GDELT + '?' + new URLSearchParams({ query: q, mode: 'ArtList', maxrecords: '40', format: 'json', timespan: '3months', sort: 'DateDesc' });
  const c = new AbortController(), t = setTimeout(() => c.abort(), 6500);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: c.signal });
    const txt = await r.text();
    if (!r.ok) throw new Error('HTTP ' + r.status);
    if (!txt.trim()) return [];                                        // GDELT answers an empty body when nothing matches
    let d; try { d = JSON.parse(txt); } catch (e) { throw new Error('not JSON: ' + txt.slice(0, 60)); }   // rate-limit and syntax errors arrive as plain text
    return Array.isArray(d.articles) ? d.articles : [];
  } finally { clearTimeout(t); }
}

const inflight = new Map(), hits = new Map();
const limited = ip => { const now = Date.now(), r = (hits.get(ip) || []).filter(t => now - t < 60e3); if (r.length >= 30) return true; r.push(now); hits.set(ip, r); return false; };

export async function news(state, county) {
  const key = 'news-' + state.toLowerCase() + '-' + slug(county), failKey = 'newsfail-' + state.toLowerCase() + '-' + slug(county);
  const cached = await auth.kvGet(key);
  if (cached && Date.now() - cached.t < TTL) return { ok: true, state, county, articles: cached.articles, fetchedAt: new Date(cached.t).toISOString(), stale: false };
  const fail = await auth.kvGet(failKey);
  const serveStale = () => cached && Date.now() - cached.t < STALE_MAX ? { ok: true, state, county, articles: cached.articles, fetchedAt: new Date(cached.t).toISOString(), stale: true } : null;
  if (fail && Date.now() - fail.t < FAIL_TTL) return serveStale() || { ok: false, reason: 'lookup' };
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    try {
      const raw = await paced(() => gdelt(county, state)), articles = clean(raw, county), now = Date.now();
      await auth.kvPut(key, { t: now, articles });
      return { ok: true, state, county, articles, fetchedAt: new Date(now).toISOString(), stale: false };
    } catch (e) {
      await auth.kvPut(failKey, { t: Date.now() });
      return serveStale() || { ok: false, reason: 'lookup' };
    } finally { inflight.delete(key); }
  })();
  inflight.set(key, p); return p;
}

export default async function handler(req, context) {
  if (req.method !== 'GET') return json(405, { ok: false, error: 'GET only.' });
  const ip = req.headers.get('x-nf-client-connection-ip') || (context && context.ip) || 'x';
  if (limited('n' + ip)) return json(429, { ok: false, error: 'Too many requests.' });
  const u = new URL(req.url), state = String(u.searchParams.get('state') || '').toUpperCase(), county = String(u.searchParams.get('county') || '').trim();
  if (!STATE_NAMES[state] || !/^[A-Za-z][A-Za-z .'\-]{1,39}$/.test(county) || !knownCounties().has(state + '|' + county)) return json(400, { ok: false, error: 'Unknown county.' });
  return json(200, await news(state, county));
}
