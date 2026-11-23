// Repo test. Runs the REAL netlify/functions/research-updates.mjs in a VM with an in-memory store,
// a fake clock and mocked sessions. Checks the Pro-first 48-hour rule at exact boundaries, owner-only writes,
// and that an owner withdrawal removes the item for every viewer.
// Run from the repo root: node --experimental-vm-modules kinvest-liens/tests/brain-research-release-feed.test.mjs
import fs from 'node:fs'; import vm from 'node:vm';
const ROOT = process.cwd().replace(/\/?$/, '/');
const T0 = Date.parse('2026-11-20T15:00:00.000Z');
let NOW = T0;
const store = new Map();
const FakeDate = class extends Date { constructor(...a) { if (a.length) super(...a); else super(NOW); } static now() { return NOW; } };
const context = vm.createContext({Response, URL, Request, console, Date: FakeDate, JSON, Math, Object, Array, String, Number, Promise, Error, RegExp, Set, Map});
const mk = (src, ctx) => new vm.SourceTextModule(src, {context: ctx});
const syn = (names, fill) => new vm.SyntheticModule(names, function () { fill(this); }, {context});
// Real research-releases library (pure functions) loaded as a module.
const releases = mk(fs.readFileSync(ROOT + 'netlify/lib/research-releases.mjs', 'utf8'), context);
await releases.link(() => { throw new Error('no imports expected'); }); await releases.evaluate();
const R = releases.namespace;
const sessions = {free: {paidThrough: null}, pro: {paidThrough: '2026-12-31'}, owner: {owner: true, email: 'owner@example.com'}};
const authMock = syn(['userFromCookie', 'kvGet', 'kvPut'], s => {
  s.setExport('kvPut', async (k, v) => { store.set(k, structuredClone(v)); });
  s.setExport('userFromCookie', async c => { const k = (c || '').replace('sess=', ''); return sessions[k] ? {...sessions[k]} : null; });
  s.setExport('kvGet', async k => structuredClone(store.get(k)));
});
const certMock = syn(['getSnapshot'], s => s.setExport('getSnapshot', async () => { throw new Error('not used'); }));
const nodeCrypto = await import('node:crypto');
const cryptoSyn = syn(['default'], s => s.setExport('default', nodeCrypto.default));
const handlerSrc = fs.readFileSync(ROOT + 'netlify/functions/research-updates.mjs', 'utf8');
const handlerMod = mk(handlerSrc, context);
await handlerMod.link(spec => {
  if (spec === 'node:crypto') return cryptoSyn;
  if (spec.endsWith('/lib/auth.mjs')) return authMock;
  if (spec.endsWith('certificate-review.mjs')) return certMock;
  if (spec.endsWith('research-releases.mjs')) return releases;
  throw new Error('unexpected import ' + spec);
});
await handlerMod.evaluate();
const handler = handlerMod.namespace.default;
// One approved, owner-released research item released at T0 (created by the real makeRelease).
const item = R.makeRelease({id: 'release-0001-test', type: 'land', state: 'FL', county: 'Palm Beach', parcelId: 'PB-100200',
  title: 'Palm Beach land parcel update', description: 'Official county land record reviewed against the source.',
  evidenceUrl: 'https://www.pbcgov.org/records', approvedForResearch: true}, new Date(T0), 'owner@example.com');
store.set('approved-research-releases-v1', {schemaVersion: 1, list: [item]});
const get = async (who, at) => { NOW = at; const r = await handler(new Request('https://preview.test/.netlify/functions/research-updates?type=land', {headers: who ? {cookie: 'sess=' + who} : {}})); const j = await r.json(); return {status: r.status, access: j.access, count: (j.records || []).length, leaksId: JSON.stringify(j).includes('release-0001-test')}; };
const cases = [
  ['1 hour before release', T0 - 3600e3, {pro: 0, free: 0, anon: 0}],
  ['at release', T0, {pro: 1, free: 0, anon: 0}],
  ['47h59m59.999s after', T0 + 48 * 3600e3 - 1, {pro: 1, free: 0, anon: 0}],
  ['at 48h (anonymous treated as Free)', T0 + 48 * 3600e3, {pro: 1, free: 1, anon: 1}],
];
const rows = [];
let ok = true;
for (const [label, at, want] of cases) {
  const pro = await get('pro', at), free = await get('free', at), anon = await get(null, at);
  const pass = pro.count === want.pro && free.count === want.free && anon.count === want.anon
    && (free.count === 0 ? !free.leaksId : true) && (anon.count === 0 ? !anon.leaksId : true);
  ok = ok && pass;
  rows.push({label, pro: pro.count, free: free.count, anon: anon.count, freeLeaksIdBeforeExpiry: free.count === 0 ? free.leaksId : false, pass});
}
// Write access: non-owner and wrong-origin POSTs are refused.
NOW = T0 + 49 * 3600e3;
const post = async (who, origin) => (await handler(new Request('https://preview.test/.netlify/functions/research-updates', {method: 'POST', headers: {cookie: who ? 'sess=' + who : '', origin, 'content-type': 'application/json'}, body: JSON.stringify({action: 'release'})}))).status;
const writes = {freeUser: await post('free', 'https://preview.test'), anonymous: await post(null, 'https://preview.test'), ownerWrongOrigin: await post('owner', 'https://evil.example')};
const writesOk = writes.freeUser === 403 && writes.anonymous === 401 && writes.ownerWrongOrigin === 403;
import test from 'node:test';
import assert from 'node:assert/strict';
test('Pro-first boundaries and owner-only writes on the research release feed', () => {
  assert.equal(ok, true, JSON.stringify(rows));
  assert.equal(writesOk, true, JSON.stringify(writes));
});
test('an owner withdrawal removes the release for every viewer and is refused for non-owners', async () => {
  NOW = T0 + 49 * 3600e3;
  const before = await get('owner', NOW);
  assert.equal(before.count, 1, 'visible before withdrawal');
  const denied = await (await handler(new Request('https://preview.test/.netlify/functions/research-updates', {method: 'POST', headers: {cookie: 'sess=free', origin: 'https://preview.test', 'content-type': 'application/json'}, body: JSON.stringify({action: 'withdraw', id: 'release-0001-test'})}))).status;
  assert.equal(denied, 403);
  const res = await handler(new Request('https://preview.test/.netlify/functions/research-updates', {method: 'POST', headers: {cookie: 'sess=owner', origin: 'https://preview.test', 'content-type': 'application/json'}, body: JSON.stringify({action: 'withdraw', id: 'release-0001-test'})}));
  assert.equal(res.status, 200);
  for (const who of ['owner', 'pro', 'free', null]) {
    const seen = await get(who, NOW);
    assert.equal(seen.count, 0, 'withdrawn for ' + (who || 'anonymous'));
    assert.equal(seen.leaksId, false);
  }
});
