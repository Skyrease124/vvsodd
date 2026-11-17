// County news core (used by countynews.mjs, countynews-background.mjs and countynews-refresh.mjs).
// Recent stories about rezoning, road construction, flooding, infrastructure and development in ONE county, found with the free GDELT DOC API.
// Every story is "county" scope: it matched the county + state search, not a parcel. Nothing here ever takes a parcel ID.
// GDELT is slow (often 10 s or more) and allows one request every 5 seconds, so lookups run in a background function and are cached (shared, 12 h).
import * as auth from './auth.mjs';
export { auth };
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GDELT = 'https://api.gdeltproject.org/api/v2/doc/doc';
const UA = 'PricePocketAsset parcel research site (https://pricepocketasset.com)';
export const TTL = 12 * 3600e3, STALE_MAX = 14 * 24 * 3600e3, FAIL_TTL = 10 * 60e3, RUN_TTL = 4 * 60e3;
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
export const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---- known counties: the registry already shipped with upcoming-sales.json (add a county there and it is allowed here) ----
let known = null;
export function _setKnown(k) { known = k; }
export function knownCounties() {
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


// ---- GDELT: one request at a time, at least GAP ms apart (the last call time is shared through the store) ----
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fetchImpl = null;
export const _setFetch = f => { fetchImpl = f; };
async function gap() {
  const last = (await auth.kvGet('news-gap')) || { t: 0 }, w = last.t + GAP - Date.now();
  if (w > 0) await sleep(Math.min(w, 20000));
  await auth.kvPut('news-gap', { t: Date.now() });
}
async function gdelt(county, state, ms) {
  const q = '"' + county + ' County" ' + STATE_NAMES[state] + ' ' + QUERY_TOPICS + ' sourcecountry:US sourcelang:english';
  const url = GDELT + '?' + new URLSearchParams({ query: q, mode: 'ArtList', maxrecords: '40', format: 'json', timespan: '3months', sort: 'DateDesc' });
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try {
    const r = await (fetchImpl || fetch)(url, { headers: { 'User-Agent': UA }, signal: c.signal });
    const txt = await r.text();
    if (!r.ok) throw new Error('HTTP ' + r.status);
    if (!txt.trim()) throw new Error('empty reply');                    // GDELT answers {} when nothing matched; a blank body is a failure, never "no stories"
    let d; try { d = JSON.parse(txt); } catch (e) { throw new Error('not JSON: ' + txt.slice(0, 60)); }   // rate-limit and syntax errors arrive as plain text
    return Array.isArray(d.articles) ? d.articles : [];
  } finally { clearTimeout(t); }
}

export const keys = (state, county) => ({ key: 'news-' + state.toLowerCase() + '-' + slug(county), failKey: 'newsfail-' + state.toLowerCase() + '-' + slug(county), runKey: 'newsrun-' + state.toLowerCase() + '-' + slug(county), reqKey: 'newsreq-' + state.toLowerCase() + '-' + slug(county) });
export async function readCache(state, county) {
  const { key } = keys(state, county); let c = await auth.kvGet(key);
  c = c && c.v === 2 ? c : null;
  return c ? { t: c.t, articles: c.articles, found: c.found, fresh: Date.now() - c.t < TTL, usable: Date.now() - c.t < STALE_MAX } : null;
}
// Look the county up (runs in the background function) and store the result. Two tries when GDELT answers with its rate-limit text or does not answer.
export async function refresh(state, county, { timeoutMs = 50000, retryMs = 7000 } = {}) {
  const { key, failKey, runKey } = keys(state, county);
  await auth.kvPut(runKey, { t: Date.now() });
  try {
    let raw, err;
    for (let attempt = 0; attempt < 2 && raw === undefined; attempt++) {
      try { await gap(); raw = await gdelt(county, state, timeoutMs); } catch (e) { err = e; if (attempt === 0) await sleep(retryMs); }
    }
    if (raw === undefined) throw err;
    const articles = clean(raw, county); await auth.kvPut(key, { v: 2, t: Date.now(), articles, found: raw.length });
    return { ok: true, count: articles.length };
  } catch (e) {
    console.log('countynews: GDELT lookup failed for ' + county + ', ' + state + ': ' + String(e && e.message || e).slice(0, 160));
    await auth.kvPut(failKey, { t: Date.now(), why: String(e && e.message || e).slice(0, 100) }); return { ok: false };
  } finally { await auth.kvPut(runKey, { t: 0 }); }
}
// Should a lookup start now? Not while the cache is fresh, a lookup is already running, or a recent one failed.
export async function shouldRefresh(state, county, { background = false } = {}) {
  const { runKey, failKey, reqKey } = keys(state, county), c = await readCache(state, county);
  if (c && c.fresh) return false;
  const run = await auth.kvGet(runKey); if (run && Date.now() - run.t < RUN_TTL) return false;
  if (!background) { const req = await auth.kvGet(reqKey); if (req && Date.now() - req.t < RUN_TTL) return false; }   // a web request already asked the background function to start
  const fail = await auth.kvGet(failKey); if (fail && Date.now() - fail.t < FAIL_TTL) return false;
  return true;
}
