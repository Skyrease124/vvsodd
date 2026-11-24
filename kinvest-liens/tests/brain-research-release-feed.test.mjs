// Repo test. Runs the REAL netlify/functions/research-updates.mjs in a VM with an in-memory store,
// a fake clock and mocked sessions. Real library modules (research-releases, property-intake, brain-approvals,
// update-release) load from disk; only the auth store, the certificate module and node:crypto are mocked.
// Checks the Pro-first 48-hour rule at exact boundaries, owner-only writes, the withdrawal reason rule, the
// audit record, the owner-only listing, and that a withdrawal removes the item for every viewer.
// Run from the repo root: node --experimental-vm-modules --test kinvest-liens/tests/brain-research-release-feed.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const ROOT = process.cwd().replace(/\/?$/, '/');
const T0 = Date.parse('2026-11-20T15:00:00.000Z');
let NOW = T0;
const store = new Map();
const FakeDate = class extends Date { constructor(...a) { if (a.length) super(...a); else super(NOW); } static now() { return NOW; } };
const context = vm.createContext({Response, URL, Request, console, Date: FakeDate, JSON, Math, Object, Array, String, Number, Promise, Error, RegExp, Set, Map});
const mk = (src, ctx) => new vm.SourceTextModule(src, {context: ctx});
const syn = (names, fill) => new vm.SyntheticModule(names, function () { fill(this); }, {context});

const sessions = {free: {paidThrough: null}, pro: {paidThrough: '2026-12-31'}, owner: {owner: true, email: 'owner@example.com'}};
const authMock = syn(['userFromCookie', 'kvGet', 'kvPut'], s => {
  s.setExport('kvPut', async (k, v) => { store.set(k, structuredClone(v)); });
  s.setExport('userFromCookie', async c => { const k = (c || '').replace('sess=', ''); return sessions[k] ? {...sessions[k]} : null; });
  s.setExport('kvGet', async k => (store.has(k) ? structuredClone(store.get(k)) : null));
});
const certMock = syn(['getSnapshot'], s => s.setExport('getSnapshot', async () => { throw new Error('not used'); }));
const nodeCrypto = await import('node:crypto');
const cryptoSyn = syn(['default'], s => s.setExport('default', nodeCrypto.default));

// Loader: real files for the library graph, mocks for the store, the certificate module and node:crypto.
const libCache = new Map();
const resolveFor = (spec, parent) => {
  if (spec === 'node:crypto') return cryptoSyn;
  if (/(^|\/)(brain-auth|auth)\.mjs$/.test(spec)) return authMock;
  if (spec.endsWith('certificate-review.mjs')) return certMock;
  if (spec.startsWith('.')) return loadLib(path.resolve(path.dirname(parent), spec));
  throw new Error('unexpected import ' + spec);
};
async function loadLib(file) {
  if (libCache.has(file)) return libCache.get(file);
  const m = mk(fs.readFileSync(file, 'utf8'), context);
  libCache.set(file, m);
  await m.link(spec => resolveFor(spec, file));
  return m;
}
const releasesMod = await loadLib(ROOT + 'netlify/lib/research-releases.mjs');
await releasesMod.evaluate();
const R = releasesMod.namespace;
const handlerMod = await loadLib(ROOT + 'netlify/functions/research-updates.mjs');
await handlerMod.evaluate();
const handler = handlerMod.namespace.default;

// One approved, owner-released research item released at T0 (created by the real makeRelease).
const item = R.makeRelease({id: 'release-0001-test', type: 'land', state: 'FL', county: 'Palm Beach', parcelId: 'PB-100200',
  title: 'Palm Beach land parcel update', description: 'Official county land record reviewed against the source.',
  evidenceUrl: 'https://www.pbcgov.org/records', approvedForResearch: true}, new Date(T0), 'owner@example.com');
const seedStore = () => store.set('approved-research-releases-v1', {schemaVersion: 1, list: [structuredClone(item)]});
seedStore();

const get = async (who, at) => {
  NOW = at;
  const r = await handler(new Request('https://preview.test/.netlify/functions/research-updates?type=land', {headers: who ? {cookie: 'sess=' + who} : {}}));
  const j = await r.json();
  return {status: r.status, access: j.access, count: (j.records || []).length, leaksId: JSON.stringify(j).includes('release-0001-test')};
};
const post = (who, body, origin = 'https://preview.test') => handler(new Request('https://preview.test/.netlify/functions/research-updates', {
  method: 'POST', headers: {cookie: who ? 'sess=' + who : '', origin, 'content-type': 'application/json'}, body: JSON.stringify(body)}));

test('Pro-first boundaries on the research release feed', async () => {
  seedStore();
  const cases = [
    ['1 hour before release', T0 - 3600e3, {pro: 0, free: 0, anon: 0}],
    ['at release', T0, {pro: 1, free: 0, anon: 0}],
    ['47h59m59.999s after', T0 + 48 * 3600e3 - 1, {pro: 1, free: 0, anon: 0}],
    ['at 48h (anonymous treated as Free)', T0 + 48 * 3600e3, {pro: 1, free: 1, anon: 1}],
  ];
  for (const [label, at, want] of cases) {
    const pro = await get('pro', at), free = await get('free', at), anon = await get(null, at);
    assert.equal(pro.count, want.pro, label + ': Pro');
    assert.equal(free.count, want.free, label + ': Free');
    assert.equal(anon.count, want.anon, label + ': anonymous');
    if (free.count === 0) assert.equal(free.leaksId, false, label + ': Free must not see the id');
    if (anon.count === 0) assert.equal(anon.leaksId, false, label + ': anonymous must not see the id');
  }
});

test('owner-only writes: non-owner and wrong-origin POSTs are refused', async () => {
  seedStore();
  NOW = T0 + 49 * 3600e3;
  assert.equal((await post('free', {action: 'release'})).status, 403);
  assert.equal((await post(null, {action: 'release'})).status, 401);
  assert.equal((await post('owner', {action: 'release'}, 'https://evil.example')).status, 403);
});

test('a withdrawal needs a reason of at least 15 characters; a short reason changes nothing', async () => {
  seedStore();
  NOW = T0 + 49 * 3600e3;
  const res = await post('owner', {action: 'withdraw', id: 'release-0001-test', reason: 'too short'});
  assert.equal(res.status, 400);
  assert.equal((await get('owner', NOW)).count, 1, 'still visible after a refused withdrawal');
});

test('an owner withdrawal records reason, actor and timestamp, removes the release for every viewer, and is refused for non-owners', async () => {
  seedStore();
  NOW = T0 + 49 * 3600e3;
  assert.equal((await get('owner', NOW)).count, 1, 'visible before withdrawal');
  assert.equal((await post('free', {action: 'withdraw', id: 'release-0001-test', reason: 'Owner correction: duplicate listing.'})).status, 403);
  const reason = 'Owner correction: duplicate listing, see review 42.';
  const res = await post('owner', {action: 'withdraw', id: 'release-0001-test', reason});
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.withdrawnAt, new Date(NOW).toISOString());
  for (const who of ['owner', 'pro', 'free', null]) {
    const seen = await get(who, NOW);
    assert.equal(seen.count, 0, 'withdrawn for ' + (who || 'anonymous'));
    assert.equal(seen.leaksId, false, 'no id leak for ' + (who || 'anonymous'));
  }
  assert.equal((await post('owner', {action: 'withdraw', id: 'release-0001-test', reason})).status, 409, 'a second withdrawal is refused');
});

test('the owner listing keeps withdrawn releases with their reason, timestamp and audit history; other viewers cannot list', async () => {
  seedStore();
  NOW = T0 + 49 * 3600e3;
  const reason = 'Owner correction: duplicate listing, see review 42.';
  await post('owner', {action: 'withdraw', id: 'release-0001-test', reason});
  const listed = await handler(new Request('https://preview.test/.netlify/functions/research-updates?scope=owner', {headers: {cookie: 'sess=owner'}}));
  assert.equal(listed.status, 200);
  const {releases} = await listed.json();
  const row = releases.find(r => r.id === 'release-0001-test');
  assert.ok(row, 'owner sees the withdrawn release');
  assert.equal(row.withdrawn, true);
  assert.equal(row.withdrawal.reason, reason);
  assert.equal(row.withdrawnAt, new Date(NOW).toISOString());
  assert.ok(row.audit.some(a => a.action === 'withdrawn' && a.by === 'owner'), 'audit records the withdrawal');
  const asFree = await handler(new Request('https://preview.test/.netlify/functions/research-updates?scope=owner', {headers: {cookie: 'sess=free'}}));
  assert.equal(asFree.status, 403);
  const asAnon = await handler(new Request('https://preview.test/.netlify/functions/research-updates?scope=owner'));
  assert.equal(asAnon.status, 401);
});
