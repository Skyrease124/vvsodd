// Run: node netlify/tests/countynews.test.mjs   (mocked GDELT; TEST FIXTURE headlines)
import assert from 'node:assert/strict'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
process.env.USERS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'news-'));
const m = await import('../functions/countynews.mjs'); const { default: api, clean, canonUrl, normTitle, _setKnown, _setGap, _resetPacing } = m;
let pass = 0; const ok = (c, msg) => { assert.ok(c, msg); pass++; console.log('ok -', msg); };
_setKnown(new Set(['FL|Volusia', 'FL|Lee', 'FL|Palm Beach'])); _setGap(5);
const A = (title, url, domain = 'example-news.test', seendate = '20261110T120000Z') => ({ title, url, domain, seendate, language: 'English', sourcecountry: 'United States' });
let mode = 'ok', calls = 0, lastQuery = '';
let feed = [
  A('Volusia County Council approves rezoning for 400-home subdivision near DeLand', 'https://example-news.test/a?utm_source=x'),
  A('Volusia County Council approves rezoning for 400-home subdivision near DeLand - Example News', 'https://mirror.test/copy', 'mirror.test'),   // syndicated copy: same headline
  A('Road construction on I-95 in Volusia County to last through spring', 'https://example-news.test/b'),
  A('Cheap flights from Orlando this weekend', 'https://example-news.test/c'),                                                          // incidental mention: dropped
  A('Flooding closes roads after heavy rain', 'https://example-news.test/d', 'local.test', '20261112T080000Z'),                         // topic only
  A('Ocean City council debates parking', 'https://example-news.test/a?utm_medium=y'),                                                  // same canonical URL as the first story: dropped
];
globalThis.fetch = async (u) => { u = String(u); if (!u.includes('gdeltproject')) throw new Error('unexpected ' + u); calls++; lastQuery = decodeURIComponent(u.replace(/\+/g, ' '));
  if (mode === 'down') throw new Error('net'); if (mode === 'limit') return { ok: false, status: 429, text: async () => 'Please limit requests to one every 5 seconds' };
  if (mode === 'text200') return { ok: true, status: 200, text: async () => 'Please limit requests to one every 5 seconds or contact' };
  if (mode === 'empty') return { ok: true, status: 200, text: async () => '' };
  return { ok: true, status: 200, text: async () => JSON.stringify({ articles: feed }) }; };
const call = async (q, ip = '1.1.1.1') => { const r = await api(new Request('http://x/n?' + q, { headers: { 'x-nf-client-connection-ip': ip } }), {}); return { s: r.status, j: await r.json() }; };

// cleaning
const c = clean(feed, 'Volusia');
ok(c.length === 3 && c[0].title.startsWith('Volusia County Council') && c.every(a => a.scope === 'county'), 'dedupes by URL and by headline, drops incidental mentions, every story is county scope');
ok(c[0].topics.includes('zoning') && c[0].topics.includes('development') && c[1].topics.includes('roads') && c[2].topics.includes('flood') && c[0].date === '2026-11-10', 'headlines are tagged with topics; date taken from the feed');
ok(canonUrl('https://www.x.com/a/?utm_source=1#top') === canonUrl('http://x.com/a') && normTitle('Big story - Local Paper') === normTitle('Big story'), 'URL and headline normalization');
ok(clean([A('Lee Health opens new clinic', 'https://x.test/1'), A('Lee County Commission votes on road widening', 'https://x.test/2')], 'Lee').length === 1 && clean([A('Leeds United wins', 'https://x.test/3')], 'Lee').length === 0, 'short county names need "Lee County" in the headline, so places with the same name are not mixed');
ok(clean([A('Story with bad link', 'javascript:alert(1)'), A('Another bad link story here', 'ftp://x.test/y')], 'Volusia').length === 0, 'non-http links are dropped');
// handler
ok((await call('state=FL&county=Nowhere')).s === 400 && (await call('state=ZZ&county=Volusia')).s === 400 && (await call('state=FL&county=<script>')).s === 400, 'unknown county, state or odd characters refused');
let r = await call('state=FL&county=Volusia');
ok(r.j.ok && r.j.articles.length === 3 && r.j.stale === false && calls === 1, 'first request asks GDELT once');
ok(/"Volusia County" Florida/.test(lastQuery) && /sourcecountry:US/.test(lastQuery) && /rezoning/.test(lastQuery), 'search uses county AND state together, US sources, the five topics');
r = await call('state=FL&county=Volusia&parcel=402500000040'); ok(r.j.articles.length === 3 && calls === 1 && r.j.articles.every(a => a.scope === 'county' && !('parcel' in a)), 'cached for the county (second visit does not call GDELT); a parcel parameter is ignored and no story is ever parcel-scoped');
// failures
mode = 'down'; r = await call('state=FL&county=Lee'); ok(r.j.ok === false && r.j.reason === 'lookup', 'GDELT down and nothing cached: ok:false (page says "County news temporarily unavailable")');
mode = 'limit'; _resetPacing(); r = await call('state=FL&county=Palm%20Beach'); ok(r.j.ok === false, 'GDELT rate-limit reply is a failure, not "no stories"');
mode = 'text200'; const before = calls; r = await call('state=FL&county=Lee', '2.2.2.2'); ok(r.j.ok === false && calls === before, 'a failed county is not retried for 10 minutes (protects the GDELT limit)');
// stale copy served when GDELT fails after expiry
const key = 'news-fl-volusia'; const auth = await import('../lib/auth.mjs'); const old = await auth.kvGet(key); await auth.kvPut(key, { ...old, t: Date.now() - 13 * 3600e3 });
mode = 'down'; r = await call('state=FL&county=Volusia', '3.3.3.3'); ok(r.j.ok && r.j.stale === true && r.j.articles.length === 3, 'expired cache + GDELT down: last good stories shown, marked stale');
// zero results after a successful lookup
mode = 'empty'; _resetPacing(); r = await call('state=FL&county=Palm%20Beach', '4.4.4.4'); ok(r.j.ok === false, 'palm beach still inside its 10 minute failure window');
await auth.kvPut('newsfail-fl-palm-beach', { t: 0 }); r = await call('state=FL&county=Palm%20Beach', '5.5.5.5'); ok(r.j.ok === true && r.j.articles.length === 0, 'successful lookup with zero stories: ok:true and an empty list ("No recent stories found")');
ok((await api(new Request('http://x/n', { method: 'POST' }), {})).status === 405, 'GET only');
console.log('\n' + pass + ' checks passed');
