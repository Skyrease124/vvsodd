// Owner approval gate, end to end, on the REAL owner review route, guarded publisher and public feed.
// Each world runs the production source in a vm context with an isolated in-memory store and a
// mocked official GIS. No network access and no credentials are used.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {pureModule} from './support/policy-linker.mjs';
import {caseKeyFor, publishable, DECISION} from '../../netlify/lib/brain-approvals.mjs';

const GIS_HOST = 'https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Parcels_Current/FeatureServer/0';
const RING = [[-83.1, 42.3], [-83.099, 42.3], [-83.099, 42.301], [-83.1, 42.301], [-83.1, 42.3]];
const CENTER = {lat: 42.3005, lon: -83.0995};
const hoursAgo = h => new Date(Date.now() - h * 3600e3).toISOString();
const LEDGER = 'owner-brain-approvals-v1', OVERLAY = 'brain-map-county-v1-MI-wayne';

async function world({quotaExhausted = false} = {}) {
  const store = new Map(), etags = new Map();
  let reservations = 0;
  const context = vm.createContext({URL, URLSearchParams, Request, Response, Buffer, AbortSignal, Date, JSON, Math, Number, Object, Array, String, Set, Map, Promise, Error, RegExp, console,
    fetch: async url => {
      const u = new URL(url);
      if (u.hostname === 'pricepocketasset.com') return Response.json({recs: [{i: 'r1', p: '01002754', a: '100 Test St, Detroit MI'}]});
      return Response.json({features: [{attributes: {parcel_number: '01002754.', address: '100 TEST ST', object_id: 100}, geometry: {rings: [RING]}}]});
    }});
  const sessions = {owner: {owner: true}, free: {}};
  const auth = new vm.SyntheticModule(['userFromCookie', 'kvGet', 'kvPut', 'kvGetVersioned', 'kvPutVersioned', 'withBrainStore', 'reserveWayneGisRequest', 'readWayneGisQuota', 'isBrainPreview'], function () {
    this.setExport('userFromCookie', async cookie => { const k = String(cookie || '').replace('sess=', ''); return sessions[k] ? {...sessions[k]} : null; });
    this.setExport('kvGet', async k => structuredClone(store.get(k) ?? null));
    this.setExport('kvPut', async (k, v) => { store.set(k, structuredClone(v)); });
    this.setExport('kvGetVersioned', async k => store.has(k) ? {data: structuredClone(store.get(k)), etag: etags.get(k)} : null);
    this.setExport('kvPutVersioned', async (k, v, etag) => {
      if (etag === null ? store.has(k) : etags.get(k) !== etag) return null;
      const next = 'e' + Math.random().toString(36).slice(2); store.set(k, structuredClone(v)); etags.set(k, next); return next;
    });
    this.setExport('withBrainStore', fn => fn);
    this.setExport('reserveWayneGisRequest', async () => { if (quotaExhausted) throw Object.assign(Error('quota'), {code: 'QUOTA'}); reservations++; });
    this.setExport('readWayneGisQuota', async () => ({active: true, count: reservations}));
    this.setExport('isBrainPreview', () => true);
  }, {context});
  const cryptoModule = new vm.SyntheticModule(['default'], function () { this.setExport('default', crypto); }, {context});
  const linker = (publisherStub) => async s => {
    if (s === 'node:crypto') return cryptoModule;
    if (s.includes('brain-auth')) return auth;
    if (s.includes('brain-map-publish-auto')) return publisherStub;
    const pure = await pureModule(s, context);
    if (!pure) throw Error('unexpected import ' + s);
    return pure;
  };
  const publisherModule = new vm.SourceTextModule(fs.readFileSync('netlify/functions/brain-map-publish-auto.mjs', 'utf8'), {context});
  await publisherModule.link(linker(null));
  await publisherModule.evaluate();
  const publish = publisherModule.namespace.default;
  const publisherStub = new vm.SyntheticModule(['default'], function () { this.setExport('default', publish); }, {context});
  const load = async file => {
    const m = new vm.SourceTextModule(fs.readFileSync(file, 'utf8'), {context});
    await m.link(linker(publisherStub));
    await m.evaluate();
    return m.namespace.default;
  };
  const review = await load('netlify/functions/owner-brain-review.mjs');
  const feed = await load('netlify/functions/brain-map-county.mjs');
  return {store, publish, review, feed, reservations: () => reservations};
}

const decisionFor = (recordId = 'r1', extra = {}) => ({
  caseKey: caseKeyFor('MI-wayne', recordId), dataset: 'MI-wayne', recordId, parcelId: '01002754', state: 'MI', county: 'Wayne',
  decision: DECISION.pending, reviewedBy: 'preview-wayne-batch-validator', reviewedAt: hoursAgo(1),
  reviewMethod: 'exact_identity_address_polygon', independentlyChecked: true, officialObjectId: 100,
  evidenceUrl: GIS_HOST, notes: 'validator evidence', checks: ['identity', 'address', 'polygon'],
  proposedPosition: CENTER, publishStatus: 'not_published', ...extra,
});
const REVIEW_URL = 'https://preview.test/.netlify/functions/owner-brain-review';
const post = (h, body, {cookie = 'sess=owner', origin = 'https://preview.test'} = {}) =>
  h(new Request(REVIEW_URL, {method: 'POST', headers: {cookie, origin, 'content-type': 'application/json'}, body: JSON.stringify(body)}));
const get = (h, {cookie = 'sess=owner'} = {}) => h(new Request(REVIEW_URL, {method: 'GET', headers: {cookie}}));
const approveBody = (overrides = {}) => ({action: 'approve', dataset: 'MI-wayne', recordId: 'r1', confirmed: true, officialSourceConfirmed: true,
  evidenceUrl: GIS_HOST, notes: 'Checked the official county record against the address and parcel number.', releaseMode: 'pro_first_48h', ...overrides});
const rejectBody = (notes = 'The address does not match the official parcel record.') => ({action: 'reject', dataset: 'MI-wayne', recordId: 'r1', confirmed: true, notes});
const feedFor = async (feed, cookie) => {
  const res = await feed(new Request('https://preview.test/.netlify/functions/brain-map-county?dataset=MI-wayne', {headers: cookie ? {cookie} : {}}));
  return (await res.json()).records;
};

test('a validator decision is pending: the real publisher does not publish it and does not charge GIS', async () => {
  const w = await world();
  w.store.set(LEDGER, {entries: [decisionFor()]});
  assert.equal(publishable(decisionFor()), false);
  const charged = [];
  await w.publish(new Request('https://preview.test/internal'), {
    waynePublisherInternal: true, wayneCurrentOnly: false, wayneHeldRecords: new Set(),
    chargeWayneGisRequest: async () => { charged.push(1); }});
  assert.equal(w.store.get(OVERLAY), undefined, 'no public overlay write from a validator decision');
  assert.equal(charged.length, 0, 'no GIS dispatch for a decision nobody approved');
  assert.deepEqual(Object.keys(await feedFor(w.feed)), [], 'nothing is public before owner approval');
});

test('a validator-created approval that was never published still cannot publish: only an owner decision can', async () => {
  const w = await world();
  w.store.set(LEDGER, {entries: [decisionFor('r1', {decision: DECISION.approved, publishStatus: 'not_published'})]});
  assert.equal(publishable(decisionFor('r1', {decision: DECISION.approved})), false);
  const charged = [];
  await w.publish(new Request('https://preview.test/internal'), {
    waynePublisherInternal: true, wayneCurrentOnly: false, wayneHeldRecords: new Set(),
    chargeWayneGisRequest: async () => { charged.push(1); }});
  assert.equal(w.store.get(OVERLAY), undefined, 'a validator approval does not reach the public overlay');
  assert.equal(charged.length, 0, 'and does not spend the GIS budget');
});

test('owner approves a pending validator decision: it publishes on the Pro-first schedule from approval time', async () => {
  const w = await world();
  w.store.set(LEDGER, {entries: [decisionFor()]});
  const res = await post(w.review, approveBody());
  const body = await res.json();
  assert.equal(res.status, 200, JSON.stringify(body));
  assert.equal(body.publication, 'published');
  const record = w.store.get(OVERLAY).records.r1;
  assert.equal(record.releaseMode, 'pro_first_48h');
  assert.equal(record.approvedBy, 'owner');
  assert.equal(Date.parse(record.freeReleaseAt) - Date.parse(record.proReleaseAt), 48 * 3600e3);
  const entry = w.store.get(LEDGER).entries[0];
  assert.equal(entry.reviewedBy, 'owner');
  assert.equal(entry.validatorDecision.reviewedBy, 'preview-wayne-batch-validator', 'the validator record is kept');
  assert.deepEqual(Object.keys(await feedFor(w.feed, 'sess=free')), [], 'Free does not see a fresh approval for 48 hours');
  assert.deepEqual(Object.keys(await feedFor(w.feed, 'sess=owner')), ['r1'], 'Pro and owner see it immediately');
});

test('an older validator approval that was never published becomes an open decision the owner can approve', async () => {
  const w = await world();
  w.store.set(LEDGER, {entries: [decisionFor('r1', {decision: DECISION.approved, publishStatus: 'not_published'})]});
  const res = await post(w.review, approveBody());
  const body = await res.json();
  assert.equal(res.status, 200, JSON.stringify(body));
  assert.equal(body.publication, 'published');
  assert.equal(w.store.get(LEDGER).entries[0].reviewedBy, 'owner');
  assert.equal(w.store.get(OVERLAY).records.r1.releaseMode, 'pro_first_48h');
});

test('owner decisions are final: a second decision on the same case is refused and nothing changes', async () => {
  const w = await world();
  w.store.set(LEDGER, {entries: [decisionFor()]});
  assert.equal((await post(w.review, approveBody())).status, 200);
  const before = structuredClone(w.store.get(LEDGER));
  assert.equal((await post(w.review, approveBody({notes: 'A second attempt to change the same decision.'}))).status, 409);
  assert.equal((await post(w.review, rejectBody('Trying to reject an approved correction now.'))).status, 409);
  assert.deepEqual(w.store.get(LEDGER), before, 'ledger unchanged by refused duplicates');
});

test('owner can reject a pending validator decision, and that rejection is final', async () => {
  const w = await world();
  w.store.set(LEDGER, {entries: [decisionFor()]});
  const res = await post(w.review, rejectBody());
  const body = await res.json();
  assert.equal(res.status, 200); assert.equal(body.publication, 'not_published');
  assert.equal(w.store.get(LEDGER).entries[0].decision, DECISION.rejected);
  assert.equal(w.store.get(OVERLAY), undefined);
  assert.equal((await post(w.review, approveBody())).status, 409, 'a rejected case cannot later be approved');
});

test('approval is refused without the exact validator evidence URL or a source check', async () => {
  const w = await world();
  w.store.set(LEDGER, {entries: [decisionFor()]});
  assert.equal((await post(w.review, approveBody({evidenceUrl: 'https://example.com/other'}))).status, 400);
  assert.equal((await post(w.review, approveBody({officialSourceConfirmed: false}))).status, 400);
  assert.equal((await post(w.review, approveBody({notes: 'short'}))).status, 400);
  assert.equal(w.store.get(LEDGER).entries[0].decision, DECISION.pending, 'refusals leave the case pending');
});

test('only owners can review, and cross-origin writes never reach the ledger', async () => {
  const w = await world();
  w.store.set(LEDGER, {entries: [decisionFor()]});
  assert.equal((await post(w.review, approveBody(), {cookie: 'sess=free'})).status, 403);
  assert.equal((await post(w.review, approveBody(), {cookie: ''})).status, 401);
  assert.equal((await post(w.review, approveBody(), {origin: 'https://attacker.example'})).status, 403);
  assert.equal(w.store.get(LEDGER).entries[0].decision, DECISION.pending);
});

test('a critical release needs confirmation and a real reason, then reaches Free immediately', async () => {
  const w = await world();
  w.store.set(LEDGER, {entries: [decisionFor()]});
  assert.equal((await post(w.review, approveBody({releaseMode: 'immediate_critical'}))).status, 400);
  assert.equal((await post(w.review, approveBody({releaseMode: 'immediate_critical', criticalConfirmed: true, criticalReason: 'too short'}))).status, 400);
  const ok = await post(w.review, approveBody({releaseMode: 'immediate_critical', criticalConfirmed: true,
    criticalReason: 'The published owner name was inaccurate and could mislead bidders.'}));
  assert.equal(ok.status, 200);
  const record = w.store.get(OVERLAY).records.r1;
  assert.equal(record.releaseMode, 'immediate_critical');
  assert.equal(record.freeReleaseAt, record.proReleaseAt);
  assert.deepEqual(Object.keys(await feedFor(w.feed, 'sess=free')), ['r1'], 'Free sees a critical correction at once');
});

test('approval waits for the shared GIS budget and publishes on the next allowed attempt', async () => {
  const w = await world({quotaExhausted: true});
  w.store.set(LEDGER, {entries: [decisionFor()]});
  const body = await (await post(w.review, approveBody())).json();
  assert.equal(body.publication, 'approved_awaiting_publication');
  assert.equal(w.store.get(LEDGER).entries[0].decision, DECISION.approved, 'the owner decision is kept');
  assert.equal(w.store.get(OVERLAY), undefined, 'nothing public while the budget is exhausted');
  const retry = await (await post(w.review, {action: 'publish-approved', confirmed: true})).json();
  assert.equal(retry.publication, 'attempted');
  assert.equal(w.store.get(OVERLAY), undefined, 'still no publication while the budget is exhausted');
});

test('rejecting a correction that is already public withdraws it for every viewer', async () => {
  const w = await world();
  w.store.set(LEDGER, {entries: [decisionFor('r1', {decision: DECISION.approved, publishStatus: 'published'})]});
  w.store.set(OVERLAY, {version: 1, records: {r1: {i: 'r1', p: '01002754', g: [RING], bb: [-83.1, 42.3, -83.099, 42.301], cx: [-83.0995, 42.3005],
    verifiedGeometry: true, verifiedAt: hoursAgo(200), evidenceUrl: GIS_HOST}}});
  assert.deepEqual(Object.keys(await feedFor(w.feed)), ['r1'], 'legacy published corrections stay public');
  const res = await post(w.review, rejectBody('The owner confirmed the published polygon was wrong.'));
  assert.equal((await res.json()).publication, 'withdrawn');
  assert.equal(w.store.get(OVERLAY).records.r1.withdrawn, true);
  assert.deepEqual(Object.keys(await feedFor(w.feed, 'sess=owner')), [], 'withdrawn for owners too');
  assert.deepEqual(Object.keys(await feedFor(w.feed)), [], 'withdrawn for anonymous viewers');
});

test('public feed: Pro sees a fresh approval first, Free waits 48 hours, legacy stays public', async () => {
  const w = await world();
  const approvedAt = hoursAgo(5);
  const release = {releaseMode: 'pro_first_48h', approvedAt, proReleaseAt: approvedAt,
    freeReleaseAt: new Date(Date.parse(approvedAt) + 48 * 3600e3).toISOString()};
  const rec = (id, extra) => ({i: id, p: '0100' + id.slice(1), g: [RING], bb: [-83.1, 42.3, -83.099, 42.301], cx: [-83.0995, 42.3005],
    verifiedGeometry: true, verifiedAt: approvedAt, evidenceUrl: GIS_HOST, ...extra});
  w.store.set(OVERLAY, {version: 2, records: {r1: rec('r1', release), r2: rec('r2', {})}});
  assert.deepEqual(Object.keys(await feedFor(w.feed)), ['r2'], 'anonymous: legacy only');
  assert.deepEqual(Object.keys(await feedFor(w.feed, 'sess=free')), ['r2'], 'free: legacy only inside the 48-hour window');
  assert.deepEqual(Object.keys(await feedFor(w.feed, 'sess=owner')).sort(), ['r1', 'r2'], 'Pro and owner: fresh approval plus legacy');
});

test('public feed: a 49-hour-old approval is open to everyone', async () => {
  const w = await world();
  const approvedAt = hoursAgo(49);
  w.store.set(OVERLAY, {version: 3, records: {r1: {i: 'r1', p: '01002754', g: [RING], bb: [-83.1, 42.3, -83.099, 42.301], cx: [-83.0995, 42.3005],
    verifiedGeometry: true, verifiedAt: approvedAt, evidenceUrl: GIS_HOST, releaseMode: 'pro_first_48h', approvedAt,
    proReleaseAt: approvedAt, freeReleaseAt: new Date(Date.parse(approvedAt) + 48 * 3600e3).toISOString()}}});
  assert.deepEqual(Object.keys(await feedFor(w.feed)), ['r1']);
});

test('approval ledger is readable by owners only', async () => {
  const w = await world();
  w.store.set(LEDGER, {entries: [decisionFor()]});
  assert.equal((await get(w.review, {cookie: 'sess=free'})).status, 403);
  const owner = await get(w.review);
  assert.equal(owner.status, 200);
  assert.equal((await owner.json()).entries.length, 1);
});
