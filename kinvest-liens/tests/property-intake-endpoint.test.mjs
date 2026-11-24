// Repo test. Runs the REAL netlify/functions/owner-property-intake.mjs and the REAL public research feed
// (netlify/functions/research-updates.mjs) in a VM against one in-memory store with versioned writes, a fake
// clock and mocked sessions. Library modules load from disk; only the auth store, the certificate module and
// node:crypto are mocked. Nothing here calls an external service.
// Run from the repo root: node --experimental-vm-modules --test kinvest-liens/tests/property-intake-endpoint.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const ROOT = process.cwd().replace(/\/?$/, '/');
const T0 = Date.parse('2026-11-20T15:00:00.000Z');
const H = 3600e3;
let NOW = T0;
const store = new Map();
const versions = new Map();
const bump = k => versions.set(k, (versions.get(k) || 0) + 1);
const put = (k, v) => { store.set(k, structuredClone(v)); bump(k); };
const fresh = () => { store.clear(); versions.clear(); NOW = T0; };
const FakeDate = class extends Date { constructor(...a) { if (a.length) super(...a); else super(NOW); } static now() { return NOW; } };
const context = vm.createContext({Response, URL, Request, console, Date: FakeDate, JSON, Math, Object, Array, String, Number, Promise, Error, RegExp, Set, Map});
const mk = src => new vm.SourceTextModule(src, {context});
const syn = (names, fill) => new vm.SyntheticModule(names, function () { fill(this); }, {context});

const sessions = {free: {paidThrough: null}, pro: {paidThrough: '2026-12-31'}, owner: {owner: true, email: 'owner@example.com'}};
const authMock = syn(['userFromCookie', 'kvGet', 'kvPut', 'kvGetVersioned', 'kvPutVersioned', 'withBrainStore'], s => {
  s.setExport('withBrainStore', h => h);
  s.setExport('userFromCookie', async c => { const k = (c || '').replace('sess=', ''); return sessions[k] ? {...sessions[k]} : null; });
  s.setExport('kvGet', async k => (store.has(k) ? structuredClone(store.get(k)) : null));
  s.setExport('kvPut', async (k, v) => put(k, v));
  s.setExport('kvGetVersioned', async k => (store.has(k) ? {data: structuredClone(store.get(k)), etag: String(versions.get(k) || 0)} : null));
  s.setExport('kvPutVersioned', async (k, v, etag) => {
    const exists = store.has(k);
    if (etag === null ? exists : (!exists || String(versions.get(k) || 0) !== etag)) return false;
    put(k, v); return true;
  });
});
const certMock = syn(['getSnapshot'], s => s.setExport('getSnapshot', async () => { throw new Error('not used'); }));
const nodeCrypto = await import('node:crypto');
const cryptoSyn = syn(['default'], s => s.setExport('default', nodeCrypto.default));

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
  const m = mk(fs.readFileSync(file, 'utf8'));
  libCache.set(file, m);
  await m.link(spec => resolveFor(spec, file));
  return m;
}
const intakeMod = await loadLib(ROOT + 'netlify/functions/owner-property-intake.mjs');
const feedMod = await loadLib(ROOT + 'netlify/functions/research-updates.mjs');
await intakeMod.evaluate();
await feedMod.evaluate();
const intake = intakeMod.namespace.default;
const feed = feedMod.namespace.default;

const ORIGIN = 'https://preview.test';
const call = (fn, method, name, {who = null, body, origin = ORIGIN, search = ''} = {}) => fn(new Request(ORIGIN + '/.netlify/functions/' + name + search, {
  method, headers: {cookie: who ? 'sess=' + who : '', origin, 'content-type': 'application/json'},
  body: method === 'GET' ? undefined : JSON.stringify(body)}));
const act = (body, o = {}) => call(intake, 'POST', 'owner-property-intake', {who: 'owner', body: {confirmed: true, ...body}, ...o});
const publicFeed = (who, type = '') => call(feed, 'GET', 'research-updates', {who, search: type ? '?type=' + type : ''}).then(async r => ({status: r.status, records: (await r.json()).records || []}));
const listItems = async () => (await (await call(intake, 'GET', 'owner-property-intake', {who: 'owner'})).json()).items;
const releaseList = () => (store.get('approved-research-releases-v1') || {list: []}).list;

const prop = (over = {}) => ({kind: 'new_property', origin: 'owner-manual', state: 'FL', county: 'Palm Beach', parcelId: 'PB-100200',
  title: 'Palm Beach parcel record update', description: 'Official county record reviewed against the source.', ...over});
const lien = (over = {}) => ({kind: 'tax_lien', origin: 'county-dataset', state: 'FL', county: 'Palm Beach', parcelId: 'PB-200300',
  certificateNumber: '2026-0042', title: 'Palm Beach tax lien update', description: 'Certificate listed on the county tax collector site.', ...over});
const verify = (id, over = {}) => ({action: 'verify', id, evidenceUrl: 'https://www.pbcgov.org/records/' + id.slice(0, 8),
  notes: 'Checked the official record; identity matches.', checklist: {officialSource: true, identityMatched: true}, ...over});

async function submitOne(item) {
  const res = await act({action: 'submit', items: [item]});
  assert.equal(res.status, 200);
  return (await res.json()).items[0];
}
async function verifiedItem(item) {
  const sub = await submitOne(item);
  assert.equal((await act(verify(sub.id))).status, 200);
  return sub.id;
}

test('nothing is public before verification and approval; anonymous and free viewers cannot reach the intake', async () => {
  fresh();
  assert.equal((await call(intake, 'GET', 'owner-property-intake', {})).status, 401);
  assert.equal((await call(intake, 'GET', 'owner-property-intake', {who: 'free'})).status, 403);
  assert.deepEqual(await listItems(), []);
  const res = await act({action: 'submit', items: [prop(), lien()]});
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.created, 2);
  assert.ok(body.items.every(i => i.status === 'awaiting_verification'));
  assert.equal(store.has('approved-research-releases-v1'), false, 'no release index is written by a submission');
  assert.equal((await publicFeed(null)).records.length, 0);
  assert.equal((await publicFeed('pro')).records.length, 0);
});

test('a batch is accepted whole or not at all, and every write needs owner, origin and confirmation', async () => {
  fresh();
  const bad = await act({action: 'submit', items: [prop(), prop({parcelId: 'x'})]});
  assert.equal(bad.status, 400);
  assert.equal((await act({action: 'submit', items: Array.from({length: 51}, (_, i) => prop({title: 'Parcel update number ' + i}))})).status, 400);
  assert.equal((await call(intake, 'POST', 'owner-property-intake', {who: 'owner', body: {action: 'submit', items: [prop()]}})).status, 400, 'confirmation required');
  assert.equal((await act({action: 'submit', items: [prop()]}, {origin: 'https://evil.example'})).status, 403);
  assert.equal((await call(intake, 'POST', 'owner-property-intake', {who: 'free', body: {confirmed: true, action: 'submit', items: [prop()]}})).status, 403);
  assert.equal((await call(intake, 'POST', 'owner-property-intake', {body: {confirmed: true, action: 'submit', items: [prop()]}})).status, 401);
  assert.deepEqual(await listItems(), [], 'refused batches store nothing');
  assert.equal((await act({action: 'submit', items: [lien({certificateNumber: ''})]})).status, 400, 'a tax lien needs its certificate number');
});

test('identical open items and identical released items are refused as duplicates', async () => {
  fresh();
  const first = await (await act({action: 'submit', items: [prop()]})).json();
  assert.equal(first.created, 1);
  const again = await (await act({action: 'submit', items: [prop(), prop({title: 'A different parcel title'})]})).json();
  assert.equal(again.created, 1);
  assert.equal(again.duplicates.length, 1);
  assert.equal((await listItems()).length, 2);
  await act(verify(first.items[0].id));
  await act({action: 'approve', id: first.items[0].id, releaseMode: 'pro_first_48h'});
  const afterRelease = await (await act({action: 'submit', items: [prop()]})).json();
  assert.equal(afterRelease.created, 0, 'a released identical update is not submitted again');
});

test('verification needs an HTTPS official source, both checklist ticks and notes of at least 15 characters', async () => {
  fresh();
  const sub = await submitOne(prop());
  assert.equal((await act({action: 'verify', id: sub.id, evidenceUrl: 'https://www.pbcgov.org/x', notes: 'Checked the official record.', checklist: {officialSource: true}})).status, 400);
  assert.equal((await act(verify(sub.id, {evidenceUrl: 'http://www.pbcgov.org/x'}))).status, 400);
  assert.equal((await act(verify(sub.id, {notes: 'short'}))).status, 400);
  assert.equal((await act(verify(sub.id))).status, 200);
  const after = (await listItems()).find(i => i.id === sub.id);
  assert.equal(after.status, 'awaiting_approval');
  assert.equal(after.verification.evidenceUrl.startsWith('https://'), true);
});

test('approval releases Pro first; Free and anonymous viewers see the item only after 48 hours, through the real public feed', async () => {
  fresh();
  const id = await verifiedItem(prop());
  const res = await act({action: 'approve', id, releaseMode: 'pro_first_48h'});
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.item.status, 'released');
  assert.equal(body.releaseId, 'rel-' + id);
  const release = releaseList().find(r => r.id === 'rel-' + id);
  assert.equal(release.releaseMode, 'pro_first_48h');
  assert.equal(release.proReleaseAt, new Date(NOW).toISOString());
  assert.equal((await publicFeed('pro')).records.length, 1, 'Pro sees it at approval');
  assert.equal((await publicFeed('free')).records.length, 0, 'Free does not');
  assert.equal((await publicFeed(null)).records.length, 0, 'anonymous does not');
  NOW = T0 + 48 * H - 1;
  assert.equal((await publicFeed('free')).records.length, 0, 'Free still waits one millisecond before 48 hours');
  NOW = T0 + 48 * H;
  assert.equal((await publicFeed('free')).records.length, 1, 'Free sees it at exactly 48 hours');
  assert.equal((await publicFeed(null)).records.length, 1, 'anonymous sees it at 48 hours');
});

test('a critical release needs confirmation and a reason of at least 40 characters, then is visible to everyone at approval', async () => {
  fresh();
  const id = await verifiedItem(lien());
  assert.equal((await act({action: 'approve', id, releaseMode: 'immediate_critical', criticalReason: 'x'.repeat(40)})).status, 400, 'confirmation required');
  assert.equal((await act({action: 'approve', id, releaseMode: 'immediate_critical', criticalConfirmed: true, criticalReason: 'too short'})).status, 400, 'reason too short');
  assert.equal(releaseList().length, 0, 'a refused critical approval writes no release');
  const ok = await act({action: 'approve', id, releaseMode: 'immediate_critical', criticalConfirmed: true,
    criticalReason: 'The published certificate was inaccurate and could mislead bidders.'});
  assert.equal(ok.status, 200);
  assert.equal((await publicFeed(null, 'lien')).records.length, 1, 'anonymous sees a critical release at once');
});

test('an approved item cannot be approved, rejected or withdrawn in the wrong state', async () => {
  fresh();
  const id = await verifiedItem(prop());
  await act({action: 'approve', id, releaseMode: 'pro_first_48h'});
  assert.equal((await act({action: 'approve', id, releaseMode: 'pro_first_48h'})).status, 409, 'approved twice');
  assert.equal((await act({action: 'reject', id, notes: 'Changing my mind after release.'})).status, 409, 'reject after release');
  const open = await submitOne(prop({title: 'Another parcel update title'}));
  assert.equal((await act({action: 'withdraw', id: open.id, reason: 'Never released, cannot withdraw.'})).status, 409, 'withdraw before release');
  assert.equal((await act({action: 'approve', id: open.id, releaseMode: 'pro_first_48h'})).status, 409, 'approve before verification');
});

test('a rejection needs a reason of at least 15 characters and applies only to open items', async () => {
  fresh();
  const sub = await submitOne(prop());
  assert.equal((await act({action: 'reject', id: sub.id, notes: 'no'})).status, 400);
  const res = await act({action: 'reject', id: sub.id, notes: 'Source is a third-party site, not the county.'});
  assert.equal(res.status, 200);
  assert.equal((await res.json()).item.status, 'rejected');
  assert.equal((await act({action: 'approve', id: sub.id, releaseMode: 'pro_first_48h'})).status, 409, 'a rejected item cannot be approved');
  assert.equal((await publicFeed(null)).records.length, 0);
});

test('a withdrawal needs a reason, removes the item from the public feed, and keeps the audit trail', async () => {
  fresh();
  const id = await verifiedItem(prop());
  await act({action: 'approve', id, releaseMode: 'pro_first_48h'});
  NOW = T0 + 49 * H;
  assert.equal((await publicFeed('pro')).records.length, 1, 'visible before withdrawal');
  assert.equal((await act({action: 'withdraw', id, reason: 'short'})).status, 400);
  const res = await act({action: 'withdraw', id, reason: 'Owner withdrew: parcel number was copied in error.'});
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.withdrawnAt, new Date(NOW).toISOString());
  for (const who of ['owner', 'pro', 'free', null]) assert.equal((await publicFeed(who)).records.length, 0, 'gone for ' + (who || 'anonymous'));
  const item = (await listItems()).find(i => i.id === id);
  assert.equal(item.status, 'withdrawn');
  assert.ok(item.audit.some(a => a.action === 'withdrawn' && a.by === 'owner'));
  const row = releaseList().find(r => r.id === 'rel-' + id);
  assert.equal(row.withdrawn, true);
  assert.equal(row.withdrawal.reason, 'Owner withdrew: parcel number was copied in error.');
  assert.equal((await act({action: 'withdraw', id, reason: 'Withdrawn a second time.'})).status, 409);
  assert.equal((await act({action: 'approve', id, releaseMode: 'pro_first_48h'})).status, 409, 'a withdrawn item cannot be approved again');
});

test('an approval retried after a partial write does not publish the same item twice', async () => {
  fresh();
  const id = await verifiedItem(prop());
  await act({action: 'approve', id, releaseMode: 'pro_first_48h'});
  // Simulate a crash after the release was written but before the intake item was marked released.
  const current = store.get('property-intake-v1');
  const idx = current.items.findIndex(i => i.id === id);
  current.items[idx] = {...current.items[idx], status: 'awaiting_approval', releaseId: null};
  put('property-intake-v1', current);
  const retry = await act({action: 'approve', id, releaseMode: 'pro_first_48h'});
  assert.equal(retry.status, 200);
  assert.equal(releaseList().filter(r => r.id === 'rel-' + id).length, 1, 'exactly one release for the item');
});
