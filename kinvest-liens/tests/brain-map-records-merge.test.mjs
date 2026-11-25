// Repo test for the map side of approved property records (kinvest-liens/map/brain-map-merge.js).
// Runs the real script in a VM with a fake fetch. Checks: a new parcel is added once; an existing parcel is
// corrected in place, never duplicated; withdrawal restores or removes; unlocated records keep no position;
// malformed records are ignored; search text follows the corrected fields; the geometry overlay still runs.
// Run from the repo root: node kinvest-liens/tests/brain-map-records-merge.test.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const src = fs.readFileSync('kinvest-liens/map/brain-map-merge.js', 'utf8');
function load(feed) {
  const calls = [];
  const window = {};
  const fetch = async url => {
    calls.push(url);
    if (url.includes('brain-map-county')) return {ok: true, json: async () => ({ok: true, dataset: 'MI-wayne', version: 1, records: {}})};
    if (url.includes('brain-map-records')) return feed.fail ? {ok: false, json: async () => ({})} : {ok: true, json: async () => ({ok: true, records: structuredClone(feed.records)})};
    throw new Error('unexpected ' + url);
  };
  vm.runInNewContext(src, {window, fetch, URL, URLSearchParams, WeakMap, Map, Set, JSON, Math, Number, String, Array, Object, Error});
  return {api: window.PPABrainMap, calls};
}
const dataset = () => ({id: 'MI-wayne', state: 'MI', county: 'Wayne', recs: [
  {i: 'MI|Wayne|01002263|', p: '01002263', c: 'tax_deed', a: '90 Chandler, Detroit MI 48202', o: 'Owner A', amt: 14500, _d: 'MI-wayne', _n: 'x'},
  {i: 'MI|Wayne|01002754|', p: '01002754', c: 'tax_deed', a: '434 King, Detroit MI 48202', o: 'Owner B', amt: 95000, _d: 'MI-wayne', _n: 'y'},
]});
const located = {p: 'NEW-1', c: 'land_bank', a: '5 New St', o: null, amt: 1000, ac: 0.2, v: 1, t: 'Owner-approved update', st: 'New parcel', src: 'Owner-verified', fr: 'Approved 2026-11-24',
  cx: [-83.05, 42.35], g: null, bb: null, why: null, approved: {releaseId: 'rel-a'}};
const unlocated = {...located, p: 'NEW-2', a: '7 Other St', cx: null, why: 'Location not verified yet. Listed without a map position; nothing is guessed.'};
const correction = {p: '01-002263', c: 'tax_deed', a: '90 Chandler Street, Detroit MI 48202', o: null, amt: 12000, ac: null, v: 1, cx: null, g: null, bb: null, why: 'x', approved: {releaseId: 'rel-c'}};

test('a new approved parcel is added once, with search text, and stays unique across refreshes', async () => {
  const feed = {records: [located]};
  const {api} = load(feed);
  const ds = dataset();
  await api.apply(ds);
  await api.apply(ds);
  const added = ds.recs.filter(r => r.p === 'NEW-1');
  assert.equal(added.length, 1);
  assert.equal(added[0].i, 'MI|Wayne|NEW-1|');
  assert.equal(added[0]._d, 'MI-wayne');
  assert.match(added[0]._n, /5 new st/);
  assert.deepEqual(added[0].cx, [-83.05, 42.35]);
  assert.equal(ds.recs.length, 3);
});

test('an unlocated approved parcel is listed without a position and keeps its reason', async () => {
  const {api} = load({records: [unlocated]});
  const ds = dataset();
  await api.apply(ds);
  const r = ds.recs.find(x => x.p === 'NEW-2');
  assert.equal(r.cx, null);
  assert.equal(r.g, null);
  assert.match(r.why, /Location not verified/);
});

test('an approval for an existing parcel corrects that record in place; no duplicate is created', async () => {
  const {api} = load({records: [correction]});
  const ds = dataset();
  await api.apply(ds);
  assert.equal(ds.recs.length, 2, 'no second record for the same parcel');
  const r = ds.recs[0];
  assert.equal(r.amt, 12000);
  assert.equal(r.a, '90 Chandler Street, Detroit MI 48202');
  assert.equal(r.o, 'Owner A', 'fields the correction does not carry are kept');
  assert.match(r._n, /chandler street/);
});

test('withdrawal restores the corrected record and removes the added one', async () => {
  const feed = {records: [correction, located]};
  const {api} = load(feed);
  const ds = dataset();
  await api.apply(ds);
  feed.records = [];
  const result = await api.apply(ds);
  assert.equal(result.changed, true);
  assert.equal(ds.recs.length, 2);
  assert.equal(ds.recs[0].amt, 14500);
  assert.equal(ds.recs[0].a, '90 Chandler, Detroit MI 48202');
  assert.equal(ds.recs[0].__approved, undefined);
  assert.equal(ds.recs.some(r => r.p === 'NEW-1'), false);
});

test('a newer correction replaces the previous correction instead of stacking on it', async () => {
  const feed = {records: [correction]};
  const {api} = load(feed);
  const ds = dataset();
  await api.apply(ds);
  feed.records = [{...correction, a: null, amt: 11000}];
  await api.apply(ds);
  assert.equal(ds.recs[0].amt, 11000);
  assert.equal(ds.recs[0].a, '90 Chandler, Detroit MI 48202', 'the earlier correction no longer applies');
});

test('malformed records are ignored: unknown category, a position outside the US, a boundary without a box', async () => {
  const {api} = load({records: [{...located, p: 'BAD-1', c: 'castle'}, {...located, p: 'BAD-2', cx: [2.35, 48.85]},
    {...located, p: 'BAD-3', g: [[[-83, 42], [-83.1, 42], [-83.1, 42.1], [-83, 42]]], bb: null}]});
  const ds = dataset();
  await api.apply(ds);
  assert.equal(ds.recs.length, 2);
});

test('when the approved-records feed fails, the county keeps its records and the geometry overlay still runs', async () => {
  const {api, calls} = load({fail: true, records: []});
  const ds = dataset();
  const result = await api.apply(ds);
  assert.equal(ds.recs.length, 2);
  assert.equal(result.version, 1);
  assert.ok(calls.some(u => u.includes('brain-map-county')));
  assert.ok(calls.some(u => u.includes('state=MI') && u.includes('county=Wayne')));
});
