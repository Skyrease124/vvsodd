// Scott County, Iowa (IA-scott): checks on the official-parcel audit, and on the matching rules it uses.
// Pure: no network. The audit and the list are read from the repository. Run from the repo root:
//   node --test tests/scott-county-match.test.mjs
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {matchDataset, indexFeatures, sourceFromConfig, addressMatch, pointInRing} from '../netlify/lib/parcel-match.mjs';
import {SOURCES} from '../netlify/lib/gis-sources.mjs';

const CONFIG = SOURCES['scott-county-ia-parcels'];
const AUDIT = JSON.parse(fs.readFileSync(new URL('../netlify/lib/data/parcel-matches/IA-scott.json', import.meta.url), 'utf8'));
const LIST = JSON.parse(fs.readFileSync(new URL('../kinvest-liens/map/data/IA-scott.json', import.meta.url), 'utf8')).recs;

test('the audit covers each list record once, against the Scott County parcel layer', () => {
  assert.equal(AUDIT.dataset, 'IA-scott');
  assert.equal(AUDIT.state, 'IA');
  assert.equal(AUDIT.county, 'Scott');
  assert.equal(AUDIT.records.length, LIST.length);
  assert.equal(new Set(AUDIT.records.map(r => r.parcel)).size, LIST.length, 'no parcel appears twice');
  const listed = new Set(LIST.map(r => r.p));
  for (const r of AUDIT.records) assert.ok(listed.has(r.parcel), r.parcel + ' is a list record');
  assert.equal(AUDIT.sources[0].id, CONFIG.id);
  assert.equal(AUDIT.sources[0].layerUrl, CONFIG.layerUrl);
  assert.ok(AUDIT.sources[0].disclaimer.length > 20, 'the attribution travels with the audit');
});

test('each matched record agrees with the layer: exact PIN, address crosscheck, and a polygon that holds its point', () => {
  const matched = AUDIT.records.filter(r => r.status === 'matched');
  assert.equal(AUDIT.summary.matched, matched.length);
  const src = sourceFromConfig(CONFIG);
  const [x0, y0, x1, y1] = CONFIG.bbox;
  for (const r of matched) {
    assert.equal(r.official.printKey, r.parcel, r.parcel + ': the official PIN is the list parcel');
    assert.equal(addressMatch(r.address, src.toAddress({PropertyAddress: r.official.siteAddress})).ok, true, r.parcel + ': address agrees');
    assert.ok(Array.isArray(r.boundary) && r.boundary.length >= 4, r.parcel + ': has a boundary');
    assert.deepEqual(r.boundary[0], r.boundary[r.boundary.length - 1], r.parcel + ': the ring is closed');
    assert.equal(pointInRing(r.point, r.boundary), true, r.parcel + ': the point is inside its polygon');
    assert.ok(r.point[0] >= x0 && r.point[0] <= x1 && r.point[1] >= y0 && r.point[1] <= y1, r.parcel + ': inside the county bounds');
    assert.ok(r.evidenceUrl.startsWith(CONFIG.layerUrl + '/query?where=PIN%3D'), r.parcel + ': the evidence link is the layer query');
  }
});

test('records that stay pending give a reason, and a same-address lead never changes the status', () => {
  const pending = AUDIT.records.filter(r => r.status !== 'matched');
  assert.equal(AUDIT.summary.pending, pending.length);
  for (const r of pending) assert.ok(['address_missing', 'sbl_not_found'].includes(r.reason), r.parcel + ': ' + r.reason);
  for (const r of pending.filter(x => x.candidates)) assert.equal(r.status, 'pending', r.parcel);
});

// The rules, on fixtures in the layer's own field names.
const FEATURE = (attrs, ring) => ({attributes: {AlternateID: 'ALT-' + attrs.PIN, Gross_AC: 1, ...attrs}, geometry: {rings: [ring]}});
const square = (x, y) => [[x, y], [x + 0.001, y], [x + 0.001, y + 0.001], [x, y + 0.001], [x, y]];
const FIXTURES = [
  FEATURE({PIN: 'C0050-21', PropertyAddress: '2031 IOWA ST'}, square(-90.6, 41.55)),
  FEATURE({PIN: 'C0050-22', PropertyAddress: '2033 IOWA ST'}, square(-90.61, 41.55)),
  FEATURE({PIN: 'FAR-1', PropertyAddress: '9 TEST RD'}, square(-95.0, 41.6)),
];
const RECORDS = [
  {parcel: 'C0050-21', address: '2031 Iowa Street, Davenport'},
  {parcel: 'C0050-22', address: '2045 Iowa St'},
  {parcel: 'c0050-21', address: '2031 Iowa St'},
  {parcel: 'FAR-1', address: '9 Test Rd'},
  {parcel: 'C0050-21', address: ''},
];

test('the matching rules hold on fixtures: exact PIN, address number and street, county bounds, no address', () => {
  const audit = matchDataset({dataset: {id: 'IA-fixture', state: 'IA', county: 'Scott'}, records: RECORDS,
    sources: [indexFeatures(sourceFromConfig(CONFIG), FIXTURES)]});
  const [verified, numberMismatch, caseDiffers, outside, noAddress] = audit.records;
  assert.equal(verified.status, 'matched');
  assert.equal(verified.official.siteAddress, '2031 IOWA ST');
  assert.equal(verified.official.parcelId, 'ALT-C0050-21');
  assert.equal(verified.official.acres, 1);
  assert.equal(verified.boundary.length, 5);
  assert.equal(numberMismatch.reason, 'conflict_address_number_mismatch');
  assert.equal(caseDiffers.reason, 'sbl_not_found', 'the PIN is compared as written');
  assert.equal(outside.reason, 'conflict_outside_county');
  assert.equal(noAddress.reason, 'address_missing', 'nothing is guessed without an address');
});
