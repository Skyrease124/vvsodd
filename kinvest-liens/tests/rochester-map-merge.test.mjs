// Runs the real map merge script (kinvest-liens/map/brain-map-merge.js) on the REAL published Rochester dataset
// (kinvest-liens/map/data/NY-city-of-rochester.json). The approved-records feed is built from the committed match
// audit document with the same fields the server sends (netlify/lib/approved-records.mjs mapRecord), so the map side
// is tested against real data. Checks: 191 records, no duplicates, positions only from official boundaries, the
// official spelling of the corrected addresses, the required source wording on each record, and a full rollback.
// Run from the repo root: node kinvest-liens/tests/rochester-map-merge.test.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import {SOURCES} from '../../netlify/lib/gis-sources.mjs';

const DATASET_FILE = 'kinvest-liens/map/data/NY-city-of-rochester.json';
const MATCHES = JSON.parse(fs.readFileSync('netlify/lib/data/parcel-matches/NY-city-of-rochester.json', 'utf8'));
const source = SOURCES['city-of-rochester-tax-parcels'];
const norm = x => String(x ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// The published dataset stores some fields as dictionary indexes; decode them as the map does.
function decoded() {
  const ds = JSON.parse(fs.readFileSync(DATASET_FILE, 'utf8'));
  const D = ds.dict;
  ds.recs.forEach(r => { for (const k in D) if (r[k] != null) r[k] = D[k][r[k]]; });
  return ds;
}

// The feed the server sends for approved, visible records (mapRecord in netlify/lib/approved-records.mjs).
function feedFromMatches(doc) {
  return doc.records.filter(r => r.status === 'matched').map(r => {
    const o = r.official || {};
    return {p: r.parcel, c: 'tax_deed', a: o.siteAddress + ', Rochester NY ' + (o.zip || ''), o: null, amt: r.amount ?? null, ac: o.acres ?? null, v: 1,
      t: 'Owner-approved update', st: 'Official parcel position: ' + o.siteAddress, sl: null,
      src: source.label + ' (data ' + source.dataDate + '). ' + source.disclaimer, fr: 'Approved 2026-11-24',
      cx: r.point, g: [r.boundary], bb: r.bbox, why: null,
      approved: {releaseId: 'rel-' + r.parcel, approvedAt: '2026-11-24T12:00:00.000Z', description: 'Official position.', evidenceUrl: r.evidenceUrl, located: true}};
  });
}

// One merge script instance with a feed the test can change between merges (as withdrawals change the feed).
function mergeWithFeed() {
  let feed = [];
  const window = {};
  const fetch = async url => {
    if (url.includes('brain-map-county')) return {ok: true, json: async () => ({ok: true, dataset: 'NY-city-of-rochester', version: 1, records: {}})};
    if (url.includes('brain-map-records')) return {ok: true, json: async () => ({ok: true, records: structuredClone(feed)})};
    throw new Error('unexpected ' + url);
  };
  vm.runInNewContext(fs.readFileSync('kinvest-liens/map/brain-map-merge.js', 'utf8'),
    {window, fetch, URL, URLSearchParams, WeakMap, Map, Set, JSON, Math, Number, String, Array, Object, Error});
  return {api: window.PPABrainMap, set: f => { feed = f; }};
}

test('the published dataset keeps all 191 records, and each approved position is applied once', async () => {
  const ds = decoded();
  const before = ds.recs.length;
  const m = mergeWithFeed();
  m.set(feedFromMatches(MATCHES));
  await m.api.apply(ds);
  assert.equal(ds.recs.length, before, 'no record is added or removed');
  const counts = new Map();
  for (const r of ds.recs) counts.set(norm(r.p), (counts.get(norm(r.p)) || 0) + 1);
  assert.ok([...counts.values()].every(n => n === 1), 'no parcel appears twice');
  for (const x of MATCHES.records.filter(r => r.status === 'matched')) {
    const r = ds.recs.find(y => y.p === x.parcel);
    assert.deepEqual(r.cx, x.point, x.parcel + ' position');
    assert.deepEqual(r.g, [x.boundary], x.parcel + ' boundary');
    assert.match(r.__approved.sourceLine, /modified for use from its original source, which is the official website of the City of Rochester/, x.parcel + ' wording');
    assert.equal(r.why, null, x.parcel + ' no longer marked unlocated');
  }
});

test('the corrected addresses show the official spelling on the map', async () => {
  const ds = decoded();
  const m = mergeWithFeed();
  m.set(feedFromMatches(MATCHES));
  await m.api.apply(ds);
  assert.equal(ds.recs.find(x => x.p === '106.22-4-23').a, '363 Avenue A, Rochester NY 14621');
  assert.equal(ds.recs.filter(x => /Aveenue|Aveerill|Aveis/.test(x.a || '')).length, 0);
});

test('withdrawing every approval restores each original record exactly', async () => {
  const ds = decoded();
  const original = new Map(ds.recs.map(r => [r.p, {a: r.a, cx: r.cx ?? null, g: r.g ?? null, bb: r.bb ?? null, why: r.why ?? null}]));
  const m = mergeWithFeed();
  m.set(feedFromMatches(MATCHES));
  await m.api.apply(ds);
  assert.ok(ds.recs.some(r => r.__approved), 'approvals are applied first');
  m.set([]);
  await m.api.apply(ds);
  for (const r of ds.recs) {
    const o = original.get(r.p);
    assert.equal(r.__approved, undefined, r.p + ' is no longer marked approved');
    assert.equal(r.cx ?? null, o.cx, r.p + ' position restored');
    assert.equal(r.g ?? null, o.g, r.p + ' boundary restored');
    assert.equal(r.a, o.a, r.p + ' address restored to the listed text');
  }
  assert.equal(ds.recs.length, original.size);
});
