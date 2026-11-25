'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  refreshRecords, refreshCounty, batches, queryFor, validRings, statewideId, streetKey, countyCodeFor, fixtureFetcher, LAYER,
} = require('../scripts/florida-parcel-refresh');

const NOW = () => new Date('2026-11-23T12:00:00Z');
const RING = [[-86.1, 30.6], [-86.09, 30.6], [-86.09, 30.61], [-86.1, 30.61], [-86.1, 30.6]];
// ArcGIS returns a list of rings for each parcel.
const RINGS = [RING];
const feature = (parcelno, address = '30 ATWOODS CT', rings = RINGS) => ({ attributes: { PARCELNO: parcelno, PHY_ADDR1: address }, geometry: { rings } });
const dataset = recs => ({
  id: 'FL-walton', state: 'FL', county: 'Walton', updated: '2026-11-01', dict: {},
  outlineSource: { parcels: { name: 'Florida Statewide Parcels', date: '2026-09-30' } }, recs,
});

test('statewide IDs drop dashes and compare case-insensitively; street keys normalise suffixes', () => {
  assert.equal(statewideId('11-3s-19-25010-000-00i0'), '113S192501000000I0');
  assert.equal(streetKey('30 Atwoods Court, Freeport'), '30 ATWOODS CT');
  assert.equal(streetKey('Seventh Av, Hilliard 32046'), 'SEVENTH AVE');
});

test('rings must be closed, finite, and inside Florida', () => {
  assert.equal(validRings(RINGS), true);
  assert.equal(validRings([[[-86.1, 30.6], [-86.09, 30.6], [-86.09, 30.61], [-86.1, 30.61]]]), false, 'open ring');
  assert.equal(validRings([[[0, 0], [1, 0], [1, 1], [0, 0]]]), false, 'outside Florida');
  assert.equal(validRings([[[-86.1, NaN], [-86.09, 30.6], [-86.09, 30.61], [-86.1, NaN]]]), false, 'not finite');
});

test('an exact, unique parcel-ID match draws the boundary and leaves the rest of the record alone', () => {
  const records = [{ i: 'FL|Walton|11-3S-19-25010-000-00I0|1', p: '11-3S-19-25010-000-00I0', a: '30 Atwoods Ct' }];
  const result = refreshRecords(records, [feature('113S192501000000I0', '30 ATWOODS CT')]);
  assert.deepEqual(result.records[0].g, RINGS);
  assert.equal(result.records[0].a, '30 Atwoods Ct');
  assert.equal(result.counts.boundariesAdded, 1);
  assert.deepEqual(result.review, []);
  assert.equal(records[0].g, undefined, 'input record is not mutated');
});

test('unmatched and ambiguous IDs are never drawn; ambiguous ones are listed for review', () => {
  const records = [
    { i: 'a', p: '00-00-00-MINR0-014-0000', a: 'Unknown' },
    { i: 'b', p: '11-11', a: '1 Main St' },
  ];
  const result = refreshRecords(records, [feature('1111', '1 MAIN ST'), feature('1111', '1 MAIN ST')]);
  assert.equal(result.counts.unmatched, 1);
  assert.equal(result.counts.ambiguous, 1);
  assert.equal(result.records[1].g, undefined);
  assert.equal(result.review[0].reason, 'Parcel ID matches more than one statewide feature');
});

test('an existing boundary is kept, and a disagreeing address is listed but does not block drawing', () => {
  const kept = { i: 'c', p: '22', a: '2 Oak Rd', g: [[[0, 0]]] };
  const drawn = { i: 'd', p: '33', a: '3 Elm St' };
  const result = refreshRecords([kept, drawn], [feature('22', '2 OAK RD', [[[-86.1, 30.6], [-86.09, 30.6], [-86.09, 30.61], [-86.1, 30.6]]]), feature('33', '9 PINE ST')]);
  assert.deepEqual(result.records[0].g, [[[0, 0]]], 'existing boundary kept');
  assert.deepEqual(result.records[1].g, RINGS);
  assert.equal(result.counts.alreadyMapped, 1);
  assert.equal(result.counts.addressDiffers, 1);
  assert.equal(result.review[0].reason, 'Layer address differs from the record address');
});

test('unknown record addresses are counted, not reviewed as conflicts', () => {
  const result = refreshRecords([{ i: 'e', p: '44', a: 'Unknown' }], [feature('44', '4 LAKE DR')]);
  assert.equal(result.counts.addressUnknown, 1);
  assert.equal(result.counts.addressDiffers, 0);
  assert.deepEqual(result.review, []);
});

test('blank layer addresses and city-only record addresses are unknown, not conflicts', () => {
  const result = refreshRecords(
    [{ i: 'g', p: '66', a: 'Santa Rosa Beach 32459' }, { i: 'h', p: '77', a: '7 Pine Rd' }],
    [feature('66', ' '), feature('77', ' ')],
  );
  assert.equal(result.counts.addressUnknown, 2);
  assert.equal(result.counts.addressDiffers, 0);
  assert.deepEqual(result.review, []);
});

test('invalid or missing geometry is not drawn and is listed for review', () => {
  const result = refreshRecords([{ i: 'f', p: '55', a: '5 Bay Rd' }], [{ attributes: { PARCELNO: '55', PHY_ADDR1: '5 BAY RD' }, geometry: { rings: [[[0, 0]]] } }]);
  assert.equal(result.counts.invalidGeometry, 1);
  assert.equal(result.records[0].g, undefined);
  assert.equal(result.review[0].reason, 'Layer geometry is missing or outside Florida');
});

test('batches of 50 IDs, and the query carries the county code and dashless IDs', () => {
  const ids = Array.from({ length: 120 }, (_, n) => 'ID' + n);
  assert.deepEqual(batches(ids).map(batch => batch.length), [50, 50, 20]);
  const url = queryFor(76, ['AB-12', "CD'34"]);
  const params = new URL(url).searchParams;
  assert.equal(params.get('where'), "CO_NO = 76 AND PARCELNO IN ('AB-12','CD''34')");
  assert.equal(params.get('outSR'), '4326');
  assert.ok(url.startsWith(LAYER.url + '/query?'));
});

test('a county refresh is staged only when it passes the map data check, and stays within its request budget', async () => {
  const recs = [
    { i: 'FL|Walton|11-3S-19-25010-000-00I0|1', p: '11-3S-19-25010-000-00I0', a: '30 Atwoods Ct' },
    { i: 'FL|Walton|00-00-00-MINR0-014-0000|2', p: '00-00-00-MINR0-014-0000', a: 'Unknown' },
  ];
  const source = dataset(recs);
  const before = JSON.stringify(source);
  const features = [feature('113S192501000000I0', '30 ATWOODS CT')];
  const { report, proposed } = await refreshCounty({ dataset: source, countyCode: 76, fetcher: fixtureFetcher(features), maxRequests: 2, now: NOW });
  assert.equal(report.status, 'ready-for-review');
  assert.equal(report.requests.used, 1);
  assert.equal(report.publication, 'not published');
  assert.deepEqual(proposed.recs[0].g, RINGS);
  assert.equal(proposed.updated, '2026-11-23');
  assert.equal(proposed.outlineSource.parcels.date, '2026-11-23');
  assert.equal(JSON.stringify(source), before, 'the live dataset is not changed');

  let calls = 0;
  const countingFetcher = async url => { calls += 1; return fixtureFetcher(features)(url); };
  const big = dataset(Array.from({ length: 200 }, (_, n) => ({ i: 'x' + n, p: 'P' + n, a: '1 Main St' })));
  const over = await refreshCounty({ dataset: big, countyCode: 76, fetcher: countingFetcher, maxRequests: 2, now: NOW });
  assert.equal(over.report.status, 'over-budget');
  assert.equal(over.proposed, null);
  assert.equal(calls, 0, 'nothing is requested when over budget');
});

test('a county that fails the map data check is not staged for review', async () => {
  const bad = dataset([{ i: 'FL|Walton|1|1', p: '1', a: '1 Main St', amt: NaN }]);
  const { report, proposed } = await refreshCounty({ dataset: bad, countyCode: 76, fetcher: fixtureFetcher([]), maxRequests: 2, now: NOW });
  assert.equal(report.status, 'failed-validation');
  assert.equal(proposed, null);
  assert.match(report.gate.errors[0], /Invalid amount/);
});

test('the registry supplies the county code for a dataset id', () => {
  assert.equal(countyCodeFor('FL-walton'), 76);
  assert.equal(countyCodeFor('FL-miami-dade'), countyCodeFor('FL-miami-dade'));
  assert.equal(countyCodeFor('FL-not-a-county'), null);
});
