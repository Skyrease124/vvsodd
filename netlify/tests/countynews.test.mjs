// Run: node netlify/tests/countynews.test.mjs   (mocked GDELT; TEST FIXTURE headlines)
import assert from 'node:assert/strict'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
process.env.USERS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'news-'));
const N = await import('../lib/news.mjs'); const { default: api, _setTrigger, _resetStarting } = await import('../functions/countynews.mjs'); const { default: bgApi } = await import('../functions/countynews-background.mjs');
let pass = 0; const ok = (c, msg) => { assert.ok(c, msg); pass++; console.log('ok -', msg); };
N._setKnown(new Set(['FL|Volusia', 'FL|Lee', 'FL|Palm Beach', 'FL|Duval'])); N._setGap(5);
const A = (title, url, domain = 'example-news.test', seendate = '20261110T120000Z') => ({ title, url, domain, seendate });
let mode = 'ok', calls = 0, lastQuery = '', limitOnce = false;
const feed = [
  A('Volusia County Council approves rezoning for 400-home subdivision near DeLand', 'https://example-news.test/a?utm_source=x'),
  A('Volusia County Council approves rezoning for 400-home subdivision near DeLand - Example News', 'https://mirror.test/copy', 'mirror.test'),
  A('Road construction on I-95 in Volusia County to last through spring', 'https://example-news.test/b'),
  A('Cheap flights from Orlando this weekend', 'https://example-news.test/c'),
  A('Flooding closes roads after heavy rain', 'https://example-news.test/d', 'local.test', '20261112T080000Z'),
  A('Ocean City council debates parking', 'https://example-news.test/a?utm_medium=y'),
];
N._setFetch(async (u) => { u = String(u); calls++; lastQuery = decodeURIComponent(u.replace(/\+/g, ' '));
  if (mode === 'down') throw new Error('net');
  if (limitOnce) { limitOnce = false; return { ok: true, status: 200, text: async () => 'Please limit requests to one every 5 seconds or contact' }; }
  if (mode === 'limit') return { ok: false, status: 429, text: async () => 'Please limit requests to one every 5 seconds' };
  if (mode === 'empty') return { ok: true, status: 200, text: async () => '{}' };
  if (mode === 'blank') return { ok: true, status: 200, text: async () => '' };
  return { ok: true, status: 200, text: async () => JSON.stringify({ articles: feed }) }; });
let bg = null, triggers = 0; _setTrigger(async (s, c) => { triggers++; bg = N.refresh(s, c, { timeoutMs: 2000, retryMs: 5 }); });   // stands in for the background function
const call = async (q, ip = '1.1.1.1') => { const r = await api(new Request('http://x/n?' + q, { headers: { 'x-nf-client-connection-ip': ip } }), {}); return { s: r.status, j: await r.json() }; };
const settle = async () => { if (bg) await bg; bg = null; };

// cleaning
const c = N.clean(feed, 'Volusia');
ok(c.length === 3 && c[0].title.startsWith('Volusia County Council') && c.every(a => a.scope === 'county'), 'dedupes by URL and by headline, drops incidental mentions, every story is county scope');
ok(c[0].topics.includes('zoning') && c[0].topics.includes('development') && c[1].topics.includes('roads') && c[2].topics.includes('flood') && c[0].date === '2026-11-10', 'headlines are tagged with topics; date taken from the feed');
ok(N.canonUrl('https://www.x.com/a/?utm_source=1#top') === N.canonUrl('http://x.com/a') && N.normTitle('Big story - Local Paper') === N.normTitle('Big story'), 'URL and headline normalization');
ok(N.clean([A('Lee Health opens new clinic', 'https://x.test/1'), A('Lee County Commission votes on road widening', 'https://x.test/2')], 'Lee').length === 1 && N.clean([A('Leeds United wins', 'https://x.test/3')], 'Lee').length === 0, 'short county names need "Lee County" in the headline, so places with the same name are not mixed');
ok(N.clean([A('Story with bad link', 'javascript:alert(1)'), A('Another bad link story here', 'ftp://x.test/y')], 'Volusia').length === 0, 'non-http links are dropped');
// web request
ok((await call('state=FL&county=Nowhere')).s === 400 && (await call('state=ZZ&county=Volusia')).s === 400 && (await call('state=FL&county=<script>')).s === 400, 'unknown county, state or odd characters refused');
let r = await call('state=FL&county=Volusia');
ok(r.j.ok && r.j.pending === true && triggers === 1, 'first visit: nothing cached, so the background lookup starts and the page is told "pending"');
await settle(); r = await call('state=FL&county=Volusia');
ok(r.j.ok && !r.j.pending && r.j.articles.length === 3 && r.j.found === 6 && r.j.stale === false && calls === 1, 'next visit: cached stories (found:6 raw hits, 3 kept), GDELT was asked once');
ok(/"Volusia County" Florida/.test(lastQuery) && /sourcecountry:US/.test(lastQuery) && /rezoning/.test(lastQuery), 'search uses county AND state together, US sources, the five topics');
r = await call('state=FL&county=Volusia&parcel=402500000040'); ok(r.j.articles.length === 3 && calls === 1 && triggers === 1 && r.j.articles.every(a => a.scope === 'county' && !('parcel' in a)), 'cached for the county; a parcel parameter is ignored and no story is ever parcel-scoped');
// duplicate lookups
await Promise.all([call('state=FL&county=Duval', '9.9.9.1'), call('state=FL&county=Duval', '9.9.9.2')]); await settle();
ok(triggers === 2, 'two visitors at once start only one lookup (a "running" marker guards it)');
// GDELT answers with its rate-limit text once: the lookup tries again and succeeds
mode = 'ok'; limitOnce = true; await N.auth.kvPut('news-fl-duval', { v: 2, t: 0, articles: [] }); await N.auth.kvPut('newsrun-fl-duval', { t: 0 }); await N.auth.kvPut('newsreq-fl-duval', { t: 0 }); _resetStarting(); const before = calls;
await call('state=FL&county=Duval', '9.9.9.3'); await settle(); r = await call('state=FL&county=Duval', '9.9.9.4');
ok(calls === before + 2 && r.j.ok && !r.j.pending && r.j.articles.length === 3, 'a rate-limit reply from GDELT is retried once and then succeeds');
// failures
mode = 'down'; r = await call('state=FL&county=Lee'); ok(r.j.pending === true, 'GDELT down: the visit that starts the lookup still gets "pending"'); await settle();
r = await call('state=FL&county=Lee'); ok(r.j.ok === false && r.j.reason === 'lookup', 'after the lookup failed and nothing is cached: ok:false (page says "County news temporarily unavailable")');
const t0 = triggers; await call('state=FL&county=Lee', '3.3.3.3'); ok(triggers === t0, 'a failed county is not retried for 10 minutes (protects the GDELT limit)');
mode = 'limit'; r = await call('state=FL&county=Palm%20Beach'); await settle(); r = await call('state=FL&county=Palm%20Beach'); ok(r.j.ok === false, 'a rate-limit reply (after both tries) is a failure, not "no stories"');
// stale copy served when GDELT fails after expiry
await N.auth.kvPut('newsreq-fl-volusia', { t: 0 }); _resetStarting(); const old = await N.auth.kvGet('news-fl-volusia'); await N.auth.kvPut('news-fl-volusia', { ...old, t: Date.now() - 13 * 3600e3 }); mode = 'down';
r = await call('state=FL&county=Volusia', '4.4.4.4'); await settle(); ok(r.j.ok && r.j.stale === true && r.j.articles.length === 3, 'expired cache + GDELT down: last good stories shown at once, marked stale');
r = await call('state=FL&county=Volusia', '4.4.4.5'); ok(r.j.stale === true && r.j.articles.length === 3, 'and they stay available while the failure window lasts');
// zero results after a successful lookup
mode = 'empty'; await N.auth.kvPut('newsfail-fl-palm-beach', { t: 0 }); await N.auth.kvPut('newsreq-fl-palm-beach', { t: 0 }); _resetStarting(); await call('state=FL&county=Palm%20Beach', '5.5.5.5'); await settle(); r = await call('state=FL&county=Palm%20Beach', '5.5.5.6');
ok(r.j.ok === true && !r.j.pending && r.j.articles.length === 0 && r.j.found === 0, 'GDELT answered {} (nothing matched): ok:true, an empty list and found:0 ("No recent stories found")');
mode = 'blank'; await N.auth.kvPut('news-fl-palm-beach', { v: 2, t: 0, articles: [] }); await N.auth.kvPut('newsfail-fl-palm-beach', { t: 0 }); await N.auth.kvPut('newsreq-fl-palm-beach', { t: 0 }); _resetStarting(); await call('state=FL&county=Palm%20Beach', '6.6.6.6'); await settle(); r = await call('state=FL&county=Palm%20Beach', '6.6.6.7');
ok(r.j.ok === false && r.j.detail === 'empty reply', 'a blank reply from GDELT is a failure ("temporarily unavailable"), never "no stories"');
// background function and method checks
ok((await bgApi(new Request('http://x/b', { method: 'POST', body: JSON.stringify({ state: 'FL', county: 'Nowhere' }) }))).status === 400 && (await bgApi(new Request('http://x/b'))).status === 405, 'background lookup refuses unknown counties and non-POST');
ok((await api(new Request('http://x/n', { method: 'POST' }), {})).status === 405, 'web request is GET only');
console.log('\n' + pass + ' checks passed');
