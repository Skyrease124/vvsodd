// Matcher tests for a county that is not in the product: a fictional layer with its own identifiers and field names.
// They show that a new county needs a configuration, not new matching code. Pure: no network, every feature is a fixture.
// Run from the repo root: node tests/parcel-match-county.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {matchDataset, indexFeatures, identifierKey, keyFor, sourceFromConfig} from '../netlify/lib/parcel-match.mjs';
import {SOURCES} from '../netlify/lib/gis-sources.mjs';
import {buildReport, reportText} from '../tools/parcel-match/report.mjs';

// A fictional county, "Testland" in the fictional state ZZ. Its layer names the parcel field TAXID and its address fields
// differently from the Rochester layers, and compares identifiers with the alphanumeric normalizer.
const LAYER = {
  id: 'testland-county-parcels', label: 'Testland County parcel layer (fictional, for tests only)', priority: 1,
  covers: [{state: 'ZZ', county: 'Testland'}], layerUrl: 'https://layers.example.invalid/testland/FeatureServer/0',
  parcelField: 'TAXID', normalize: 'alphanumeric', bbox: [-100.0, 40.0, -99.0, 41.0],
  fields: {parcel: 'TAXID', siteAddress: 'SITE', low: 'LOWNUM', high: 'HIGHNUM', street: 'STREET', zip: 'ZIP',
    parcelId: 'OBJECTID_TXT', printKey: 'TAXID', acres: 'ACRES'},
};
const DATASET = {id: 'ZZ-testland', state: 'ZZ', county: 'Testland'};

const square = (x, y, s = 0.002) => [[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]];
const feature = (attrs, rings) => ({attributes: {ZIP: '99001', ACRES: 0.5, OBJECTID_TXT: 'OID-' + attrs.TAXID, ...attrs}, geometry: {rings}});

const FEATURES = [
  feature({TAXID: '12-34/5a', SITE: '100 MAIN ST', LOWNUM: 100, HIGHNUM: 100, STREET: 'MAIN STREET'}, [square(-99.5, 40.5)]),
  feature({TAXID: '77.1 b', SITE: '200 OAK AVENUE', LOWNUM: 200, HIGHNUM: 210, STREET: 'OAK AVENUE'}, [square(-99.2, 40.2)]),
  feature({TAXID: 'MP-9', SITE: '300 PINE RD', LOWNUM: 300, HIGHNUM: 300, STREET: 'PINE ROAD'}, [square(-99.8, 40.8), square(-99.79, 40.81)]),
  feature({TAXID: 'ZZ1', SITE: '400 ELM ST', LOWNUM: 400, HIGHNUM: 400, STREET: 'ELM STREET', ZIP: '99002'}, [square(-99.6, 40.1)]),
  feature({TAXID: 'DUP1', SITE: '500 CEDAR ST', LOWNUM: 500, HIGHNUM: 500, STREET: 'CEDAR STREET'}, [square(-99.3, 40.3)]),
  feature({TAXID: 'DUP1', SITE: '500 CEDAR ST', LOWNUM: 500, HIGHNUM: 500, STREET: 'CEDAR STREET'}, [square(-99.35, 40.35)]),
  feature({TAXID: 'OUT-1', SITE: '600 BIRCH ST', LOWNUM: 600, HIGHNUM: 600, STREET: 'BIRCH STREET'}, [square(-98.5, 40.5)]),
];

const RECORDS = [
  {parcel: '12.34/5A', address: '100 Main Street, Testland 99001'},     // same parcel as 12-34/5a
  {parcel: '77-1B', address: '205 Oak Ave, Testland 99001'},            // same parcel as "77.1 b"; 205 is in 200-210
  {parcel: 'MP-9', address: '300 Pine Road, Testland 99001'},           // several polygon parts: a point, no boundary
  {parcel: 'ZZ1', address: '400 Elm Street, Testland 99001'},           // the ZIP disagrees with the layer
  {parcel: 'DUP1', address: '500 Cedar Street, Testland 99001'},        // two features with the same identifier
  {parcel: 'OUT-1', address: '600 Birch Street, Testland 99001'},       // the polygon lies outside the county
  {parcel: 'NONE-1', address: '700 Maple Street, Testland 99001'},      // not in the layer
  {parcel: ' / ', address: '800 Spruce Street, Testland 99001'},         // no readable identifier
  {parcel: '12-34/5a', address: ''},                                     // no address: nothing is guessed
];

function auditFor(config, features, records, dataset = DATASET) {
  const src = indexFeatures(sourceFromConfig(config), features);
  return matchDataset({dataset, records, sources: [src]});
}

test('identifiers are compared with the normalizer each source names', () => {
  assert.equal(identifierKey('alphanumeric', '12-34/5a'), '12345A');
  assert.equal(identifierKey('alphanumeric', '12.34/5A'), '12345A');
  assert.equal(identifierKey('alphanumeric', ' / '), null);
  assert.equal(identifierKey('exact', ' AB-1 '), 'AB-1');
  assert.notEqual(identifierKey('exact', 'ab-1'), identifierKey('exact', 'AB-1'));
  assert.equal(keyFor('ny-sbl', '0120.74-02-013').key, '120.74-2-13');
  assert.equal(keyFor(undefined, '0120.74-02-013').key, '120.74-2-13', 'the default normalizer is ny-sbl');
  assert.throws(() => identifierKey('soundex', 'AB1'), /Unknown identifier normalizer/);
  assert.throws(() => sourceFromConfig({...LAYER, normalize: 'nope'}), /unknown identifier normalizer/);
});

test('a county that is not in the product is matched from its configuration alone', () => {
  const audit = auditFor(LAYER, FEATURES, RECORDS);
  const by = new Map(audit.records.map(r => [r.parcel, r]));
  assert.equal(audit.summary.records, 9);
  assert.equal(audit.summary.matched, 3);
  assert.equal(audit.summary.matchedWithBoundary, 2);
  assert.equal(audit.summary.matchedPointOnly, 1);
  assert.equal(audit.summary.pending, 6);
  assert.deepEqual(audit.summary.byReason, {verified: 2, verified_point_only: 1, conflict_address_zip_mismatch: 1, sbl_ambiguous: 1,
    conflict_outside_county: 1, sbl_not_found: 1, identifier_unreadable: 1, address_missing: 1});

  const a = by.get('12.34/5A');
  assert.equal(a.status, 'matched');
  assert.equal(a.reason, 'verified');
  assert.equal(a.sblKey, '12345A');
  assert.equal(a.official.siteAddress, '100 MAIN ST', 'the official text comes from the declared SITE field');
  assert.equal(a.official.parcelId, 'OID-12-34/5a');
  assert.equal(a.official.acres, 0.5);
  assert.equal(a.boundary.length, 5, 'a closed ring');
  assert.deepEqual(a.boundary[0], [-99.5, 40.5]);
  assert.ok(a.evidenceUrl.startsWith(LAYER.layerUrl + '/query?where=TAXID%3D'), 'the evidence link is the layer query');
  assert.equal(by.get('77-1B').status, 'matched', 'the record 77-1B is the layer parcel "77.1 b"');
  assert.equal(by.get('MP-9').reason, 'verified_point_only');
  assert.equal(by.get('MP-9').boundary, null, 'a parcel in several parts gets a point, not a boundary');
  assert.equal(by.get('ZZ1').reason, 'conflict_address_zip_mismatch', 'a disagreeing ZIP holds the record; nothing is guessed');
  assert.equal(by.get('DUP1').reason, 'sbl_ambiguous');
  assert.equal(by.get('OUT-1').reason, 'conflict_outside_county');
  assert.equal(by.get('NONE-1').reason, 'sbl_not_found');
  assert.equal(by.get(' / ').reason, 'identifier_unreadable');
  assert.equal(by.get('12-34/5a').reason, 'address_missing');
});

test('an exact layer matches only identical text', () => {
  const config = {...LAYER, id: 'testland-exact', normalize: 'exact'};
  const features = [feature({TAXID: 'AB-1', SITE: '10 LAKE RD', LOWNUM: 10, HIGHNUM: 10, STREET: 'LAKE ROAD'}, [square(-99.5, 40.5)])];
  const audit = auditFor(config, features, [{parcel: 'AB-1', address: '10 Lake Road, Testland 99001'}, {parcel: 'ab-1', address: '10 Lake Road, Testland 99001'}]);
  assert.equal(audit.records[0].status, 'matched');
  assert.equal(audit.records[1].reason, 'sbl_not_found', 'exact comparison does not fold case');
});

test('the Rochester sources keep the New York section-block-lot normalizer', () => {
  for (const id of ['city-of-rochester-tax-parcels', 'monroe-county-public-parcels']) assert.equal(SOURCES[id].normalize, 'ny-sbl', id);
});

test('the report lists each dataset with its source and audit, and makes no requests', () => {
  const audit = auditFor(LAYER, FEATURES, RECORDS);
  const datasets = [{id: 'ZZ-testland', state: 'ZZ', county: 'Testland', records: 9}, {id: 'ZZ-nowhere', state: 'ZZ', county: 'Nowhere', records: 2}];
  const sourcesFor = (state, county) => (state === 'ZZ' && county === 'Testland' ? [LAYER] : []);
  const rows = buildReport({datasets, audits: new Map([['ZZ-testland', audit]]), sourcesFor});
  assert.deepEqual(rows.map(r => r.id), ['ZZ-nowhere', 'ZZ-testland'], 'sorted by state, county and id');
  const testland = rows.find(r => r.id === 'ZZ-testland');
  assert.equal(testland.status, 'audited');
  assert.equal(testland.matched, 3);
  assert.equal(testland.pending, 6);
  assert.deepEqual(testland.sources, ['testland-county-parcels']);
  assert.equal(rows.find(r => r.id === 'ZZ-nowhere').status, 'no source configured');
  const text = reportText(rows);
  assert.match(text, /ZZ-nowhere \| ZZ \| Nowhere \| 2 \| none \| no source configured/);
  assert.match(text, /2 datasets; 1 with an official source; 1 audited \(3 records matched, 6 pending\)\./);
});
