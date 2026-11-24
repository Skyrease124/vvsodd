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
let PREVIEW = true;
const authMock = syn(['userFromCookie', 'kvGet', 'kvPut', 'kvGetVersioned', 'kvPutVersioned', 'withBrainStore', 'isBrainPreview'], s => {
  s.setExport('withBrainStore', h => h);
  s.setExport('isBrainPreview', () => PREVIEW);
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
const jsonCache = new Map();
const resolveFor = (spec, parent) => {
  if (spec === 'node:crypto') return cryptoSyn;
  if (/(^|\/)(brain-auth|auth)\.mjs$/.test(spec)) return authMock;
  if (spec.endsWith('certificate-review.mjs')) return certMock;
  if (spec.endsWith('.json')) {
    const file = path.resolve(path.dirname(parent), spec);
    if (!jsonCache.has(file)) jsonCache.set(file, syn(['default'], x => x.setExport('default', JSON.parse(fs.readFileSync(file, 'utf8')))));
    return jsonCache.get(file);
  }
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
const recordsMod = await loadLib(ROOT + 'netlify/functions/brain-map-records.mjs');
await intakeMod.evaluate();
await feedMod.evaluate();
await recordsMod.evaluate();
const mapRecords = async (who, county = 'Palm Beach', state = 'FL') => { const r = await recordsMod.namespace.default(new Request(ORIGIN + '/.netlify/functions/brain-map-records?state=' + state + '&county=' + encodeURIComponent(county), {headers: who ? {cookie: 'sess=' + who} : {}})); return {status: r.status, ...(await r.json())}; };
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

const prop = (over = {}) => ({kind: 'new_property', category: 'land_bank', origin: 'owner-manual', state: 'FL', county: 'Palm Beach', parcelId: 'PB-100200',
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
  const again = await (await act({action: 'submit', items: [prop(), prop({parcelId: 'PB-100201', title: 'A different parcel title'})]})).json();
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
  const open = await submitOne(prop({parcelId: 'PB-100299', title: 'Another parcel update title'}));
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

test('the intake reports which store it writes to, so the owner can confirm isolation before any write', async () => {
  fresh();
  const get = async () => (await (await call(intake, 'GET', 'owner-property-intake', {who: 'owner'})).json()).storage;
  PREVIEW = true; assert.equal(await get(), 'preview-isolated');
  PREVIEW = false; assert.equal(await get(), 'production');
  PREVIEW = true;
});

test('an approved property becomes a map record for its county, Pro first and Free after 48 hours, never while pending', async () => {
  fresh();
  const sub = await submitOne(prop({address: '1 Ocean Ave', amount: 5000, longitude: -80.05, latitude: 26.71}));
  assert.equal((await mapRecords('pro')).records.length, 0, 'nothing while awaiting verification');
  await act(verify(sub.id, {checklist: {officialSource: true, identityMatched: true, locationVerified: true}}));
  assert.equal((await mapRecords('pro')).records.length, 0, 'nothing while awaiting approval');
  await act({action: 'approve', id: sub.id, releaseMode: 'pro_first_48h'});
  const pro = await mapRecords('pro');
  assert.equal(pro.records.length, 1);
  const rec = pro.records[0];
  assert.deepEqual({p: rec.p, c: rec.c, a: rec.a, amt: rec.amt, cx: rec.cx, why: rec.why}, {p: 'PB-100200', c: 'land_bank', a: '1 Ocean Ave', amt: 5000, cx: [-80.05, 26.71], why: null});
  assert.equal((await mapRecords('free')).records.length, 0, 'Free waits');
  assert.equal((await mapRecords(null)).records.length, 0, 'anonymous waits');
  assert.equal((await mapRecords('pro', 'Broward')).records.length, 0, 'other counties are untouched');
  NOW = T0 + 48 * H;
  assert.equal((await mapRecords(null)).records.length, 1, 'anonymous sees it at 48 hours');
  // The research feed flags it as a map record, so the map draws no second research pin for it.
  assert.equal((await publicFeed(null)).records[0].mapRecord, true);
});

test('coordinates are published only when the location check was ticked; otherwise the property is listed as unlocated', async () => {
  fresh();
  const sub = await submitOne(prop({longitude: -80.05, latitude: 26.71, boundary: [[-80.06, 26.70], [-80.04, 26.70], [-80.04, 26.72], [-80.06, 26.72], [-80.06, 26.70]]}));
  await act(verify(sub.id));
  await act({action: 'approve', id: sub.id, releaseMode: 'immediate_critical', criticalConfirmed: true, criticalReason: 'Test of an unverified location being withheld from the map.'});
  const rec = (await mapRecords(null)).records[0];
  assert.equal(rec.cx, null, 'no position without the location check');
  assert.equal(rec.g, null, 'no boundary without the location check');
  assert.match(rec.why, /Location not verified/);
});

test('a verified boundary is published with its box; a boundary that does not contain the centre is dropped', async () => {
  fresh();
  const ring = [[-80.06, 26.70], [-80.04, 26.70], [-80.04, 26.72], [-80.06, 26.72], [-80.06, 26.70]];
  const a = await submitOne(prop({longitude: -80.05, latitude: 26.71, boundary: ring}));
  const b = await submitOne(prop({parcelId: 'PB-777', longitude: -81.5, latitude: 27.5, boundary: ring}));
  for (const id of [a.id, b.id]) {
    await act(verify(id, {checklist: {officialSource: true, identityMatched: true, locationVerified: true}}));
    await act({action: 'approve', id, releaseMode: 'immediate_critical', criticalConfirmed: true, criticalReason: 'Test of boundary publication rules on the map.'});
  }
  const recs = (await mapRecords(null)).records;
  const inside = recs.find(r => r.p === 'PB-100200'), outside = recs.find(r => r.p === 'PB-777');
  assert.deepEqual(inside.bb, [-80.06, 26.7, -80.04, 26.72]);
  assert.equal(inside.g.length, 1);
  assert.equal(outside.g, null, 'inconsistent boundary is not drawn');
  assert.deepEqual(outside.cx, [-81.5, 27.5], 'the verified point still stands');
});

test('a second approval for the same parcel is a correction of one record, and withdrawing it restores the earlier version', async () => {
  fresh();
  const first = await submitOne(prop({address: '1 Ocean Ave', amount: 5000}));
  await act(verify(first.id));
  await act({action: 'approve', id: first.id, releaseMode: 'immediate_critical', criticalConfirmed: true, criticalReason: 'First version of the record released for this test.'});
  NOW = T0 + 3600e3;
  const second = await submitOne(prop({title: 'Corrected amount for the parcel', amount: 4200}));
  await act(verify(second.id));
  await act({action: 'approve', id: second.id, releaseMode: 'immediate_critical', criticalConfirmed: true, criticalReason: 'The earlier amount was inaccurate and could mislead bidders.'});
  let recs = (await mapRecords(null)).records;
  assert.equal(recs.length, 1, 'one record per state, county and parcel');
  assert.equal(recs[0].amt, 4200);
  assert.equal((await act({action: 'withdraw', id: second.id, reason: 'Correction withdrawn: the earlier amount was right.'})).status, 200);
  recs = (await mapRecords(null)).records;
  assert.equal(recs.length, 1);
  assert.equal(recs[0].amt, 5000, 'the earlier approved version is shown again');
  await act({action: 'withdraw', id: first.id, reason: 'Whole record withdrawn by the owner for this test.'});
  assert.equal((await mapRecords(null)).records.length, 0, 'gone for every viewer');
  assert.equal((await mapRecords('pro')).records.length, 0);
});

test('one open item per parcel: a second submission for the same state, county and parcel waits', async () => {
  fresh();
  await submitOne(prop());
  const again = await (await act({action: 'submit', items: [prop({title: 'Different wording, same parcel', county: 'palm beach'})]})).json();
  assert.equal(again.created, 0);
  assert.match(again.duplicates[0].why, /already has an item awaiting review/);
});

test('a new property needs a category and coordinates inside the United States', async () => {
  fresh();
  assert.equal((await act({action: 'submit', items: [prop({category: undefined})]})).status, 400);
  assert.equal((await act({action: 'submit', items: [prop({longitude: 2.35, latitude: 48.85})]})).status, 400);
  assert.equal((await act({action: 'submit', items: [prop({boundary: [[-80, 26], [-80.1, 26], [-80, 26.1]]})]})).status, 400);
});

test('the map records feed refuses malformed counties', async () => {
  const r = await recordsMod.namespace.default(new Request(ORIGIN + '/.netlify/functions/brain-map-records?state=Florida&county=x'));
  assert.equal(r.status, 400);
});

test('the matches summary is owner-only and carries no geometry', async () => {
  fresh();
  const owner = await (await call(intake, 'GET', 'owner-property-intake', {who: 'owner', search: '?scope=matches'})).json();
  assert.equal(owner.ok, true);
  assert.equal(owner.summary.records, 191);
  assert.equal(JSON.stringify(owner).includes('"boundary"'), false, 'no polygon in the summary');
  assert.equal((await call(intake, 'GET', 'owner-property-intake', {who: 'free', search: '?scope=matches'})).status, 403);
  assert.equal((await call(intake, 'GET', 'owner-property-intake', {search: '?scope=matches'})).status, 401);
});

test('importing the matches queues all 191 for approval with verification and attribution; a repeat import adds nothing', async () => {
  fresh();
  const first = await (await act({action: 'import-matches'})).json();
  assert.equal(first.created, 191);
  assert.equal(first.awaitingApproval, 191);
  assert.equal(first.pendingInvestigation, 0);
  const items = await listItems();
  assert.equal(items.length, 191);
  assert.ok(items.every(i => i.status === 'awaiting_approval' && i.origin === 'gis-import' && i.locationVerified && i.property.hasCoordinates && i.property.hasBoundary));
  const again = await (await act({action: 'import-matches'})).json();
  assert.equal(again.created, 0);
  assert.equal(again.skipped, 191);
  assert.equal((await listItems()).length, 191);
});

test('batch approval releases up to 50 at once, Pro first, with a separate audit entry for each record', async () => {
  fresh();
  await act({action: 'import-matches'});
  const ids = (await listItems()).slice(0, 50).map(i => i.id);
  const res = await act({action: 'batch-approve', ids, batchId: 'batch-test-0001'});
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.approved, 50);
  assert.equal(body.refused, 0);
  assert.ok(body.results.every(r => r.ok && r.releaseId));
  const after = await listItems();
  assert.equal(after.filter(i => i.status === 'released').length, 50);
  assert.equal(after.filter(i => i.status === 'awaiting_approval').length, 141);
  for (const i of after.filter(x => ids.includes(x.id))) {
    const entries = i.audit.filter(a => a.action === 'approved');
    assert.equal(entries.length, 1, 'one approval entry per record');
    assert.match(entries[0].note, /batch-test-0001 · pro_first_48h/);
  }
  const again = await (await act({action: 'batch-approve', ids: [ids[0], '00000000-0000-4000-8000-000000000000']})).json();
  assert.equal(again.approved, 0);
  assert.equal(again.results[0].ok, false, 'an already released item is refused, not released twice');
  assert.equal((await act({action: 'batch-approve', ids: ids.slice(0, 2), releaseMode: 'immediate_critical'})).status, 400, 'no critical batch');
  assert.equal((await act({action: 'batch-approve', ids: Array.from({length: 51}, (_, n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0'))})).status, 400, 'at most 50');
});

test('approved positions reach the map Pro first and Free after 48 hours, with the source wording and the official spelling', async () => {
  fresh();
  await act({action: 'import-matches'});
  const ids = (await listItems()).map(i => i.id);
  for (let k = 0; k < ids.length; k += 50) assert.equal((await (await act({action: 'batch-approve', ids: ids.slice(k, k + 50)})).json()).approved, Math.min(50, ids.length - k));
  const pro = await mapRecords('pro', 'City of Rochester', 'NY');
  assert.equal(pro.records.length, 191);
  // The first corrected parcel and its official spelling come from the corrections manifest, so no restricted text is written here.
  const first = JSON.parse(fs.readFileSync(new URL('../../tools/rochester-ny/address-corrections.json', import.meta.url), 'utf8')).corrections[0];
  const r = pro.records.find(x => x.p === first.parcel);
  assert.ok(r.cx && r.g && r.bb, 'a located record with a boundary');
  assert.equal(r.a, first.corrected, 'the official spelling replaces the list artifact');
  assert.match(r.src, /City of Rochester Tax Parcels/);
  assert.match(r.src, /modified for use from its original source, which is the official website of the City of Rochester/);
  assert.equal((await mapRecords('free', 'City of Rochester', 'NY')).records.length, 0, 'Free waits');
  assert.equal((await mapRecords(null, 'City of Rochester', 'NY')).records.length, 0, 'anonymous waits');
  NOW = T0 + 48 * H;
  assert.equal((await mapRecords(null, 'City of Rochester', 'NY')).records.length, 191, 'anonymous sees them at 48 hours');
});
