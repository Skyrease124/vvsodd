// Cloudflare second opinion tested against a LOCAL MOCK of the Workers AI API. No request leaves the machine, no real token
// is used, and the dummy token must never appear in any result or error.
// Run from the repo root: node --test kinvest-liens/tests/cloudflare-opinion.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import {ask, buildPayload, verifyOpinions, SYSTEM, DEFAULT_MODEL} from '../../netlify/lib/cloudflare-opinion.mjs';
import {cloudflareCaps, reserveCloudflare, cloudflareUsedToday, CF_CEILING} from '../../netlify/lib/cloudflare-limits.mjs';

const TOKEN = 'test-dummy-cloudflare-token-0000', ACCOUNT = 'a'.repeat(32);
const receipt = {id: 'r1', outcome: 'completed', proposals: [
  {parcelId: 'C0050-21', dataset: 'IA-scott', summary: 'Official match for acreage 12.50.', facts: {acres: '12.50', location: {lat: 41.5, lon: -90.5}, lat: 41.5, jurisdiction: 'Davenport'},
   sources: [{ref: 'H1', source: 'validator', status: 'pending_owner_review', evidenceUrl: 'https://x.gov/a'}]},
  {parcelId: 'C0050-22', dataset: 'IA-scott', summary: 'Second.', facts: {}, sources: [{ref: 'H2', source: 'parcel-match', status: 'matched'}]}]};
let mode = 'good', sent = [];
const server = http.createServer((req, res) => {
  let b = ''; req.on('data', c => b += c); req.on('end', () => {
    sent.push({url: req.url, auth: req.headers.authorization, body: b});
    const reply = (code, o) => { res.writeHead(code, {'Content-Type': 'application/json'}); res.end(typeof o === 'string' ? o : JSON.stringify(o)); };
    if (mode === '429') return reply(429, 'limit ' + TOKEN);
    if (mode === '500') return reply(500, 'oops');
    const answer = {
      good: {opinions: [{parcelId: 'C0050-21', verdict: 'supported', reason: 'Acreage 12.50 matches the validator source.'}, {parcelId: 'C0050-22', verdict: 'partly', reason: 'Only a parcel match backs it.'}]},
      invented: {opinions: [{parcelId: 'C0050-21', verdict: 'supported', reason: 'The county lists 99887 acres.'}, {parcelId: 'C9999', verdict: 'supported', reason: 'Unknown parcel.'}, {parcelId: 'C0050-22', verdict: 'approve', reason: 'Bad verdict.'}]}
    }[mode];
    if (mode === 'badjson') return reply(200, {choices: [{message: {content: 'nope'}}]});
    if (mode === 'resultshape') return reply(200, {result: {response: 'Here: ' + JSON.stringify({opinions: [{parcelId: 'C0050-22', verdict: 'not_supported', reason: 'Nothing official.'}]})}});
    reply(200, {choices: [{message: {content: JSON.stringify(answer)}}]});
  });
});
let base;
test.before(async () => { await new Promise(r => server.listen(0, '127.0.0.1', r)); base = 'http://127.0.0.1:' + server.address().port; });
test.after(() => server.close());
const run = (m, extra = {}) => { mode = m; sent = []; return ask({token: TOKEN, accountId: ACCOUNT, model: DEFAULT_MODEL, payload: buildPayload(receipt), base, ...extra}); };

test('only bounded proposal fields are sent: no position, no boundary, no evidence link, no token in the body', async () => {
  const p = buildPayload(receipt), s = JSON.stringify(p.items);
  assert.equal(/41\.5|-90\.5|lat|lon|location|evidenceUrl|https:/i.test(s), false);
  assert.deepEqual(Object.keys(p.items[0].facts).sort(), ['acres', 'jurisdiction']);
  const r = await run('good');
  assert.equal(r.ok, true); assert.equal(sent[0].auth, 'Bearer ' + TOKEN);
  assert.match(sent[0].url, new RegExp('^/client/v4/accounts/' + ACCOUNT + '/ai/v1/chat/completions$'));
  assert.equal(sent[0].body.includes(TOKEN), false);
  assert.match(SYSTEM, /untrusted data/);
  assert.equal(JSON.stringify(r).includes(TOKEN), false);
});
test('good opinions are kept; unknown parcels, bad verdicts and invented numbers are dropped', async () => {
  assert.deepEqual((await run('good')).opinions.map(o => o.verdict), ['supported', 'partly']);
  const r = await run('invented');
  assert.equal(r.ok, false); assert.match(r.error, /No opinion passed/); assert.equal(r.dropped.length, 3);
  assert.deepEqual(Object.keys((await run('good')).opinions[0]).sort(), ['parcelId', 'reason', 'verdict'], 'nothing can approve or add a proposal');
});
test('the older result shape and prose around the JSON are accepted', async () => {
  const r = await run('resultshape'); assert.equal(r.ok, true); assert.equal(r.opinions[0].verdict, 'not_supported');
});
test('provider errors stop the job and never echo the token; bad JSON and bad settings save nothing', async () => {
  const a = await run('429'); assert.equal(a.stop, true); assert.equal(JSON.stringify(a).includes(TOKEN), false);
  const b = await run('500'); assert.equal(!!b.stop, false);
  assert.match((await run('badjson')).error, /not valid JSON/);
  sent = []; assert.match((await run('good', {model: '../x'})).error, /Invalid model/); assert.match((await run('good', {accountId: 'zz'})).error, /account ID/); assert.equal(sent.length, 0);
});
test('a receipt with no proposals, or too large, has nothing to send', () => {
  assert.equal(buildPayload({proposals: []}), null); assert.equal(buildPayload({}), null);
  assert.equal(buildPayload({proposals: Array.from({length: 10}, (_, i) => ({parcelId: 'P' + i, summary: 'x'.repeat(300), facts: Object.fromEntries(Array.from({length: 10}, (_, k) => ['k' + k, 'v'.repeat(80)])), sources: Array.from({length: 6}, () => ({ref: 'H1', source: 'validator'}))}))}), null);
});

function fakeRL() { const n = new Map(); return {hit: async (k, l) => { const c = n.get(k) || 0; if (c >= l) return {ok: false}; n.set(k, c + 1); return {ok: true}; }, peek: async k => ({used: n.get(k) || 0})}; }
test('the allowance is tiny, shared and never above the reviewed ceiling', async () => {
  assert.deepEqual(CF_CEILING, {daily: 3, minute: 1});
  assert.deepEqual(cloudflareCaps({cloudflareDailyCap: 500}), {enabled: true, daily: 3, minute: 1});
  assert.equal(cloudflareCaps({cloudflareEnabled: false}).enabled, false); assert.equal(cloudflareCaps({cloudflareDailyCap: 0}).enabled, false);
  const RL = fakeRL(), caps = cloudflareCaps(null);
  assert.equal((await reserveCloudflare(RL, caps)).ok, true);
  const two = await reserveCloudflare(RL, caps); assert.equal(two.ok, false); assert.match(two.error, /per-minute/);
  assert.equal(await cloudflareUsedToday(RL, caps), 1, 'a refused request does not use the daily allowance');
});

const src = f => fs.readFileSync(new URL('../../' + f, import.meta.url), 'utf8');
test('endpoint source: owner only, same origin, confirmed, one per receipt, completed receipts only, counted before the request, no schedule', () => {
  const s = src('netlify/functions/owner-brain-second-opinion.mjs');
  assert.match(s, /me\?\.owner/); assert.match(s, /Invalid origin/); assert.match(s, /!body\.confirmed/);
  assert.match(s, /already has a second opinion/); assert.match(s, /receipt\.outcome !== 'completed'/);
  assert.ok(s.indexOf('reserveCloudflare') < s.indexOf('CO.ask('));
  assert.deepEqual([...new Set([...s.matchAll(/kvPut\(([A-Za-z_]+)/g)].map(m => m[1]))], ['STORE']);
  assert.doesNotMatch(s.replace(/\/\/.*$/gm, ''), /schedule|cron|fetch\(|approved|RECEIPTS,/);
});
