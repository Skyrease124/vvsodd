// Pure tests for the reusable parcel matcher (netlify/lib/parcel-match.mjs), the source configuration and the
// import planner (netlify/lib/parcel-import.mjs). No network, no store: every official feature is a fixture.
// Run from the repo root: node tests/parcel-match.test.mjs
// Kept outside kinvest-liens: it checks official Rochester spellings that are restricted until the Pro window ends.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normSbl, canonicalStreet, parseAddress, addressMatch, closeRing, pointInRing, representativePoint, checkRing,
  resolveRecord, indexFeatures, matchDataset, leadingSbl, metersBetween,
} from '../netlify/lib/parcel-match.mjs';
import {buildImportPlan} from '../netlify/lib/parcel-import.mjs';
import {SOURCES, sourcesFor, ADDRESS_ARTIFACT_FIXES} from '../netlify/lib/gis-sources.mjs';

const NOW = new Date('2026-11-24T12:00:00.000Z');
const ROCHESTER_BOX = [-77.85, 43.0, -77.45, 43.3];

// A real official polygon from the City layer: a thin sliver whose centroid lies outside the parcel.
const SLIVER = [[-77.57670585771143, 43.176754733774075], [-77.57671256004176, 43.17686264912881],
  [-77.57626125273123, 43.1768791246887], [-77.5762561601819, 43.17679727746983],
  [-77.57626287598696, 43.17677003740187], [-77.57670585771143, 43.176754733774075]];

// A C-shaped parcel (the centroid of a C falls outside it).
const C_SHAPE = [[0, 0], [3, 0], [3, 1], [1, 1], [1, 2], [3, 2], [3, 3], [0, 3], [0, 0]];

// Fixture for the City source as the owner endpoints see it: attributes plus a WGS84 ring.
const cityFeature = (over = {}, rings) => ({
  attributes: {PARCELID: '12074000020130000000', PRINTKEY: '120.74-2-13', SITEADDRESS: '81 Aberdeen St', STREET_NAME: 'Aberdeen St',
    STREET_NUM: '81', LOW_STREET_NUM: '81', HIGH_STREET_NUM: '81', ZIP5: '14619', SHAPEACRES: 0.12, ...over},
  geometry: {rings: rings || [[[-77.6, 43.14], [-77.5995, 43.14], [-77.5995, 43.1405], [-77.6, 43.1405], [-77.6, 43.14]]]},
});
const cityIndex = features => indexFeatures(SOURCES['city-of-rochester-tax-parcels'], features);
const cityRecord = (over = {}) => ({parcel: '120.74-2-13', address: '81 Aberdeen St, Rochester NY 14619', amount: 11154, acreage: 0.124, category: 'tax_deed', ...over});

test('an SBL is normalized to one key whatever its leading zeros or sub-lot spelling', () => {
  assert.equal(normSbl('120.74-2-13'), '120.74-2-13');
  assert.equal(normSbl('0120.74-02-013'), '120.74-2-13');
  assert.equal(normSbl('095.02-2-4.002'), '95.02-2-4.2');
  assert.equal(normSbl('091.75-2-25./HOME'), null, 'trailing text is not an SBL by itself');
  assert.equal(leadingSbl('091.75-2-25./HOME'), '091.75-2-25');
  assert.equal(normSbl('not a parcel'), null);
});

test('street names compare after suffix and direction normalization', () => {
  assert.equal(canonicalStreet('Avenue A'), 'AVE A');
  assert.equal(canonicalStreet('Aberdeen St'), canonicalStreet('ABERDEEN STREET'));
  assert.equal(canonicalStreet('West Main Road'), 'W MAIN RD');
  assert.equal(canonicalStreet('Averill Ave'), 'AVERILL AVE');
});

test('an address is read with its number range and ZIP', () => {
  assert.deepEqual(parseAddress('262-264 Aveenue C, Rochester NY 14621').numbers, [262, 264]);
  assert.equal(parseAddress('81 Aberdeen St, Rochester NY 14619').zip, '14619');
  assert.equal(parseAddress('0081 ABERDEEN ST').low, 81);
});

test('address verification needs the number, the street and, when both have one, the ZIP', () => {
  const feature = {low: 81, high: 81, street: 'ABERDEEN ST', zip: '14619'};
  assert.equal(addressMatch('81 Aberdeen St, Rochester NY 14619', feature).ok, true);
  assert.equal(addressMatch('82 Aberdeen St, Rochester NY 14619', feature).reason, 'address_number_mismatch');
  assert.equal(addressMatch('81 Aberdeen Ave, Rochester NY 14619', feature).reason, 'address_street_mismatch');
  assert.equal(addressMatch('81 Aberdeen St, Rochester NY 14608', feature).reason, 'address_zip_mismatch');
  assert.equal(addressMatch('81 Aberdeen St', feature).ok, true, 'a ZIP that is missing on one side is not compared');
  assert.equal(addressMatch('81-83 Aberdeen St', {low: 81, high: 81, street: 'ABERDEEN ST'}).ok, false, 'a range wider than the parcel does not match');
  assert.equal(addressMatch('81-83 Aberdeen St', {low: 80, high: 84, street: 'ABERDEEN ST'}).ok, true, 'a range inside the parcel range matches');
});

test('a thin sliver gets an interior point, and so does a C-shaped parcel whose centroid is outside it', () => {
  const p = representativePoint(closeRing(SLIVER));
  assert.ok(p && pointInRing(p, closeRing(SLIVER)), 'the sliver point lies inside the parcel');
  const c = representativePoint(closeRing(C_SHAPE));
  assert.ok(c && pointInRing(c, closeRing(C_SHAPE)), 'the C-shape point lies inside the parcel');
});

test('boundaries are checked before use: closed, enough points, inside the United States and the county, not empty', () => {
  assert.equal(checkRing([[0, 0], [1, 0], [0, 0]], null), 'too_few_points');
  assert.equal(checkRing([[-77.6, 43.1], [-77.59, 43.1], [-77.59, 43.11], [-77.6, 43.11]], null), 'not_closed');
  assert.equal(checkRing([[2.35, 48.85], [2.36, 48.85], [2.36, 48.86], [2.35, 48.86], [2.35, 48.85]], null), 'outside_united_states');
  assert.equal(checkRing([[-80, 26], [-79.99, 26], [-79.99, 26.01], [-80, 26.01], [-80, 26]], ROCHESTER_BOX), 'outside_county');
  assert.equal(checkRing([[-77.6, 43.1], [-77.6, 43.1], [-77.6, 43.1], [-77.6, 43.1], [-77.6, 43.1]], null), 'zero_area');
  assert.equal(checkRing(closeRing([[-77.6, 43.14], [-77.5995, 43.14], [-77.5995, 43.1405]]), ROCHESTER_BOX), null);
});

test('a parcel matched on its SBL and verified address gets a position inside its own boundary', () => {
  const src = cityIndex([cityFeature()]);
  const out = resolveRecord(cityRecord(), [src]);
  assert.equal(out.status, 'matched');
  assert.equal(out.reason, 'verified');
  assert.equal(out.source, 'city-of-rochester-tax-parcels');
  assert.ok(pointInRing(out.point, out.boundary));
  assert.equal(out.official.printKey, '120.74-2-13');
  assert.match(out.evidenceUrl, /^https:\/\/maps\.cityofrochester\.gov\/.*PRINTKEY/);
});

test('an SBL that matches with a different address is a conflict and never falls back to another source', () => {
  const primary = cityIndex([cityFeature({SITEADDRESS: '90 Aberdeen St', STREET_NAME: 'Aberdeen St', STREET_NUM: '90', LOW_STREET_NUM: '90', HIGH_STREET_NUM: '90'})]);
  const other = indexFeatures(SOURCES['monroe-county-public-parcels'], [{attributes: {PRINTKEY: '120.74-2-13', PARCELADDRESSNUMBER: '81',
    PARCELADDRESSSTREETNAME: 'ABERDEEN', PARCELADDRESSSTREETSUFFIX: 'ST', PARCELADDRESSZIPCODE: '14619'}, geometry: {rings: [[[-77.6, 43.14], [-77.5995, 43.14], [-77.5995, 43.1405], [-77.6, 43.14]]]}}]);
  const out = resolveRecord(cityRecord(), [primary, other]);
  assert.equal(out.status, 'pending');
  assert.equal(out.reason, 'conflict_address_number_mismatch');
});

test('an SBL that appears twice with the same address is ambiguous and stays pending', () => {
  const src = cityIndex([cityFeature(), cityFeature({PARCELID: 'OTHER'})]);
  assert.equal(resolveRecord(cityRecord(), [src]).reason, 'sbl_ambiguous');
});

test('a parcel number that is not in any source is reported as not found, with no position', () => {
  const out = resolveRecord(cityRecord({parcel: '999.99-9-99'}), [cityIndex([cityFeature()])]);
  assert.equal(out.status, 'pending');
  assert.equal(out.reason, 'sbl_not_found');
  assert.equal(out.point, null);
});

test('trailing text after the SBL is set aside for matching, and the note says the official layer uses the same identifier', () => {
  const feature = cityFeature({PRINTKEY: '091.75-2-25./HOME', PARCELID: '0917500002025000HOME', SITEADDRESS: '1025 Portland Ave',
    STREET_NAME: 'Portland Ave', STREET_NUM: '1025', LOW_STREET_NUM: '1025', HIGH_STREET_NUM: '1025', ZIP5: '14621'});
  const out = resolveRecord(cityRecord({parcel: '091.75-2-25./HOME', address: '1025 Portland Ave, Rochester NY 14621'}), [cityIndex([feature])]);
  assert.equal(out.status, 'matched');
  assert.match(out.identifierNote, /trailing text after the SBL 091\.75-2-25/);
  assert.match(out.identifierNote, /same identifier/);
});

test('a parcel with several polygon parts is matched by a point only, and no partial boundary is drawn', () => {
  const part = [[-77.6, 43.14], [-77.5995, 43.14], [-77.5995, 43.1405], [-77.6, 43.1405], [-77.6, 43.14]];
  const far = [[-77.59, 43.15], [-77.5895, 43.15], [-77.5895, 43.1505], [-77.59, 43.1505], [-77.59, 43.15]];
  const out = resolveRecord(cityRecord(), [cityIndex([cityFeature({}, [part, far])])]);
  assert.equal(out.status, 'matched');
  assert.equal(out.reason, 'verified_point_only');
  assert.equal(out.boundary, null);
  assert.ok(pointInRing(out.point, part) || pointInRing(out.point, far));
});

test('a second source further than the allowed distance holds the record as a source conflict', () => {
  const first = cityIndex([cityFeature()]);
  const farFeature = {attributes: {PRINTKEY: '120.74-2-13', PARCELADDRESSNUMBER: '81', PARCELADDRESSSTREETNAME: 'ABERDEEN', PARCELADDRESSSTREETSUFFIX: 'ST', PARCELADDRESSZIPCODE: '14619'},
    geometry: {rings: [[[-77.7, 43.14], [-77.6995, 43.14], [-77.6995, 43.1405], [-77.7, 43.1405], [-77.7, 43.14]]]}};
  const second = indexFeatures(SOURCES['monroe-county-public-parcels'], [farFeature]);
  const out = resolveRecord(cityRecord(), [first, second]);
  assert.equal(out.status, 'pending');
  assert.equal(out.reason, 'source_conflict');
  assert.equal(out.crossChecks.at(-1).outcome, 'conflict');
  assert.ok(metersBetween([-77.6, 43.14], [-77.7, 43.14]) > 1000);
});

test('a second source that agrees within the allowed distance corroborates the position', () => {
  const first = cityIndex([cityFeature()]);
  const close = {attributes: {PRINTKEY: '120.74-2-13', PARCELADDRESSNUMBER: '81', PARCELADDRESSSTREETNAME: 'ABERDEEN', PARCELADDRESSSTREETSUFFIX: 'ST', PARCELADDRESSZIPCODE: '14619'},
    geometry: {rings: [[[-77.6001, 43.14], [-77.5996, 43.14], [-77.5996, 43.1405], [-77.6001, 43.1405], [-77.6001, 43.14]]]}};
  const out = resolveRecord(cityRecord(), [first, indexFeatures(SOURCES['monroe-county-public-parcels'], [close])]);
  assert.equal(out.status, 'matched');
  assert.equal(out.crossChecks[0].outcome, 'corroborated');
});

test('a dataset is matched as a whole, with counts by reason', () => {
  const src = cityIndex([cityFeature(), cityFeature({PRINTKEY: '106.22-4-23', PARCELID: 'B', SITEADDRESS: '363 Avenue A', STREET_NAME: 'Avenue A',
    STREET_NUM: '363', LOW_STREET_NUM: '363', HIGH_STREET_NUM: '363', ZIP5: '14621'})]);
  const out = matchDataset({dataset: {id: 'T', state: 'NY', county: 'City of Rochester'}, sources: [src], records: [
    cityRecord(), cityRecord({parcel: '106.22-4-23', address: '363 Aveenue A, Rochester NY 14621'}), cityRecord({parcel: '999.99-9-99'})]});
  assert.equal(out.summary.records, 3);
  assert.equal(out.summary.matched, 1, 'the Aveenue spelling is not fixed here: it is corrected by the tool, not the matcher');
  assert.equal(out.summary.byReason.sbl_not_found, 1);
});

test('the Rochester artifact fixes restore the official street spellings only', () => {
  const fix = ADDRESS_ARTIFACT_FIXES['NY-city-of-rochester'];
  const apply = text => fix.reduce((t, f) => t.replace(f.pattern, f.to), text);
  assert.equal(apply('363 Aveenue A, Rochester NY 14621'), '363 Avenue A, Rochester NY 14621');
  assert.equal(apply('653 Aveerill Ave, Rochester NY 14607'), '653 Averill Ave, Rochester NY 14607');
  assert.equal(apply('139 Aveis St, Rochester NY 14615'), '139 Avis St, Rochester NY 14615');
  assert.equal(apply('12 Avenue Park, Rochester NY 14600'), '12 Avenue Park, Rochester NY 14600', 'correct spellings are untouched');
});

test('sources are chosen per county: the City first, then the secondary layer that covers it', () => {
  assert.deepEqual(sourcesFor('NY', 'City of Rochester').map(s => s.id), ['city-of-rochester-tax-parcels', 'monroe-county-public-parcels']);
  assert.deepEqual(sourcesFor('NY', 'Nowhere County').map(s => s.id), []);
  for (const s of Object.values(SOURCES)) {
    assert.match(s.layerUrl, /^https:\/\//, s.id + ' uses https');
    assert.ok(s.terms && s.terms.url && s.disclaimer, s.id + ' states its terms and disclaimer');
    assert.ok(s.bbox.length === 4, s.id + ' has a bounding box');
  }
});

test('an import plan puts matched records in the approval queue with the source wording, and keeps pending records out of it', () => {
  const source = SOURCES['city-of-rochester-tax-parcels'];
  const matched = resolveRecord(cityRecord(), [cityIndex([cityFeature()])]);
  const pending = resolveRecord(cityRecord({parcel: '999.99-9-99', address: '5 Nowhere St, Rochester NY 14604'}), [cityIndex([cityFeature()])]);
  const doc = {state: 'NY', county: 'City of Rochester', sources: [{id: source.id}], records: [
    {...matched, source: source.id, amount: 11154, acreage: 0.124},
    {...pending, source: null, amount: 1000, acreage: null, candidates: [{printKey: '120.74-2-14'}]},
  ]};
  const plan = buildImportPlan({matches: doc, existingItems: [], releases: [], now: NOW, actor: 'owner'});
  assert.equal(plan.created.length, 2);
  const [a, b] = plan.created;
  assert.equal(a.status, 'awaiting_approval');
  assert.equal(a.verification.checklist.locationVerified, true);
  assert.equal(a.property.attribution, source.disclaimer, 'attribution comes from the server configuration');
  assert.equal(a.property.sourceLabel, source.label);
  assert.ok(a.property.candidatePoint && a.property.candidateRing, 'the position and boundary are carried');
  assert.equal(b.status, 'awaiting_verification', 'a pending record is not approvable');
  assert.equal(b.property.candidatePoint, null, 'a pending record has no position');
  assert.match(b.audit.at(-1).note, /not found in the official layer/);
  assert.match(b.audit.at(-1).note, /leads, not matches/);
});

test('re-importing the same records creates nothing new', () => {
  const source = SOURCES['city-of-rochester-tax-parcels'];
  const matched = resolveRecord(cityRecord(), [cityIndex([cityFeature()])]);
  const doc = {state: 'NY', county: 'City of Rochester', sources: [{id: source.id}], records: [{...matched, source: source.id, amount: 1, acreage: 0.1}]};
  const first = buildImportPlan({matches: doc, existingItems: [], releases: [], now: NOW, actor: 'owner'});
  const again = buildImportPlan({matches: doc, existingItems: first.created, releases: [], now: NOW, actor: 'owner'});
  assert.equal(again.created.length, 0);
  assert.equal(again.skipped.length, 1);
});
