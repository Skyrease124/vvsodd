// Scott County, Iowa: the cross-check rules and the audit they produced. Pure: no network, no store.
// Run from the repo root: node --test tests/scott-crosscheck.test.mjs
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../tools/parcel-match/crosscheck-core.mjs';
import {pointInRing, checkRing, parseAddress} from '../netlify/lib/parcel-match.mjs';
import {SOURCES} from '../netlify/lib/gis-sources.mjs';

const CONFIG = SOURCES['scott-county-ia-parcels'];
const AUDIT = JSON.parse(fs.readFileSync(new URL('../netlify/lib/data/parcel-matches/IA-scott.json', import.meta.url), 'utf8'));
const LIST = JSON.parse(fs.readFileSync(new URL('../kinvest-liens/map/data/IA-scott.json', import.meta.url), 'utf8')).recs;
const REASONS = ['identifier_only', 'manufactured_home_address_point', 'manufactured_home_no_address_point',
  'lot_address_ambiguous', 'retired_parcel_number', 'no_official_record', 'lot_number_missing'];
const [X0, Y0, X1, Y1] = CONFIG.bbox;
const inCounty = p => p[0] >= X0 && p[0] <= X1 && p[1] >= Y0 && p[1] <= Y1;
const owner = pin => LIST.find(x => x.p === pin).o;
const byCheck = r => Object.fromEntries(r.crossChecks.map(c => [c.check, c.result]));

test('every record has one reason, and the counts add up to the audit', () => {
  assert.equal(AUDIT.records.length, 144);
  for (const r of AUDIT.records) assert.ok(r.reason === 'verified' || REASONS.includes(r.reason), r.parcel + ': ' + r.reason);
  const counts = {};
  for (const r of AUDIT.records) counts[r.reason] = (counts[r.reason] || 0) + 1;
  assert.deepEqual(counts, AUDIT.summary.byReason);
  assert.equal(AUDIT.summary.matched + AUDIT.summary.pending, 144);
});

test('the 22 matched records are untouched by the cross-check: no candidate, no lot or identifier check', () => {
  const matched = AUDIT.records.filter(r => r.status === 'matched');
  assert.equal(matched.length, 22);
  for (const r of matched) {
    assert.equal(r.reason, 'verified');
    assert.equal(r.candidate, undefined, r.parcel);
    assert.equal(r.crossChecks.length, 0, r.parcel);
  }
});

test('identifier candidates: the official polygon holds its point, its acreage comes from the polygon, and the PIN is the list PIN', () => {
  const ids = AUDIT.records.filter(r => r.reason === 'identifier_only');
  assert.equal(ids.length, 23);
  for (const r of ids) {
    const c = r.candidate;
    assert.equal(c.precision, 'parcel_polygon', r.parcel);
    assert.equal(checkRing(c.boundary, CONFIG.bbox), null, r.parcel + ': a usable ring');
    assert.ok(pointInRing(c.point, c.boundary), r.parcel + ': the point is inside the polygon');
    assert.equal(c.acres, Math.round(core.polygonAcres(c.boundary) * 10000) / 10000, r.parcel + ': acreage from the polygon');
    assert.equal(c.official.printKey, r.parcel, r.parcel + ': the official PIN is the list PIN');
    assert.ok(c.evidenceUrl.startsWith(CONFIG.layerUrl + '/query?where=PIN%3D'), r.parcel + ': the evidence link is the layer query');
    assert.equal(byCheck(r).parcel_number, 'agrees', r.parcel);
    assert.ok(['found', 'not_found'].includes(byCheck(r).tax_deed_layer), r.parcel + ': the tax-deed layer was checked too');
  }
});

test('each identifier check agrees with the list or the official record, and the strength follows the checks', () => {
  for (const r of AUDIT.records.filter(x => x.reason === 'identifier_only')) {
    const checks = byCheck(r);
    assert.equal(core.ownerAgrees(owner(r.parcel), r.candidate.official.owner), checks.owner === 'agrees', r.parcel + ': owner');
    assert.equal(core.acreageAgrees(r.candidate.acres, r.candidate.official.grossAcres), checks.acreage === 'agrees', r.parcel + ': acreage');
    const strong = ['owner', 'acreage', 'legal', 'jurisdiction'].every(k => checks[k] === 'agrees');
    assert.equal(r.candidate.strength, strong ? 'strong' : 'review', r.parcel + ': strength');
  }
  assert.equal(AUDIT.summary.candidates.strong + AUDIT.summary.candidates.review, 23);
});

test('address-point candidates are an official address point for the same lot: never a polygon, never a land parcel', () => {
  const pts = AUDIT.records.filter(r => r.reason === 'manufactured_home_address_point');
  assert.equal(pts.length, 65);
  for (const r of pts) {
    const c = r.candidate;
    assert.equal(c.precision, 'address_point', r.parcel);
    assert.equal(c.boundary, undefined, r.parcel + ': a home position has no polygon');
    assert.ok(inCounty(c.point), r.parcel + ': inside the county');
    const listed = core.splitLot(r.address);
    const official = core.splitLot(c.address.replace(/ LOT /i, ' Lot '));
    assert.ok(listed && official, r.parcel + ': both carry a lot number');
    assert.equal(parseAddress(listed.base).number, parseAddress(official.base).number, r.parcel + ': same number');
    assert.equal(parseAddress(listed.base).street, parseAddress(official.base).street, r.parcel + ': same street');
    assert.equal(listed.unit, official.unit, r.parcel + ': same lot');
    assert.equal(byCheck(r).home_identity, 'not_available', r.parcel + ': the home is not verified by free GIS');
    for (const p of r.landContext) assert.deepEqual(Object.keys(p).sort(), ['owner', 'pin', 'propClass'], 'land context is text only');
  }
});

test('records without an official position carry no candidate, and the reason says why', () => {
  for (const r of AUDIT.records.filter(x => x.status !== 'matched' && !x.candidate)) {
    assert.equal(r.candidate, null, r.parcel);
    assert.ok(['manufactured_home_no_address_point', 'retired_parcel_number', 'no_official_record', 'lot_number_missing', 'lot_address_ambiguous'].includes(r.reason), r.parcel);
  }
  assert.ok(AUDIT.records.some(r => r.reason === 'retired_parcel_number' && byCheck(r).parcel_history === 'found'), 'the retired number is shown as found in the history');
});

test('the cross-check sources name their official layers and a retrieval time', () => {
  assert.ok(AUDIT.crossCheckSources.length >= 6);
  for (const s of AUDIT.crossCheckSources) {
    assert.ok(s.layerUrl.startsWith('https://services.arcgis.com/ovln19YRWV44nBqV/'), s.id);
    assert.ok(s.retrievedAt, s.id);
    assert.ok(s.disclaimer.length > 20, s.id);
  }
});

test('polygon acreage: a 0.001 by 0.001 degree square at Iowa latitude is about 2.29 acres', () => {
  const square = [[-90.6, 41.5], [-90.599, 41.5], [-90.599, 41.501], [-90.6, 41.501], [-90.6, 41.5]];
  assert.ok(Math.abs(core.polygonAcres(square) - 2.29) < 0.02, String(core.polygonAcres(square)));
});

test('acreage agrees within 0.001 acre or 2 percent, and no assessor figure gives no answer', () => {
  assert.equal(core.acreageAgrees(0.060, 0.061), true);
  assert.equal(core.acreageAgrees(1.444, 1.445), true);
  assert.equal(core.acreageAgrees(0.014, 0.023), false);
  assert.equal(core.acreageAgrees(0.045, 0.05), false);
  assert.equal(core.acreageAgrees(1.0, null), null);
});

test('owner names agree when every word of the list name is in the official name', () => {
  assert.equal(core.ownerAgrees("TIM'S REMOVAL & RESTORATION LL", "TIM'S REMOVAL & RESTORATION LL"), true);
  assert.equal(core.ownerAgrees('SMITH JOHN', 'JONES MARY'), false);
  assert.equal(core.ownerAgrees('', 'JONES MARY'), false);
});

test('a legal description names a subdivision by its most distinctive word; metes and bounds give no answer', () => {
  assert.equal(core.legalNamesSubdivision('KIMBERLY VILLAGE 1ST ADD Lot: 070', 'Kimberly Village 1st Addition'), true);
  assert.equal(core.legalNamesSubdivision("LECLAIRE'S 13TH ADD", "LeClaire's 13th Addition"), true);
  assert.equal(core.legalNamesSubdivision('Sec:30 Twp:78 Rng:04', 'Venwoods Estates 4th Addition'), false);
  assert.equal(core.legalNamesSubdivision('Sec:30 Twp:78 Rng:04', null), null);
});

test('jurisdiction agrees with city limits: the City of Davenport inside, the township outside', () => {
  assert.equal(core.jurisdictionAgrees('CITY OF DAVENPORT', true), true);
  assert.equal(core.jurisdictionAgrees('PLEASANT VALLEY  TWP', false), true);
  assert.equal(core.jurisdictionAgrees('PLEASANT VALLEY  TWP', true), false);
  assert.equal(core.jurisdictionAgrees(null, true), null);
});

test('the strength is strong only when owner, acreage, legal and jurisdiction all agree', () => {
  assert.equal(core.strengthOf({owner: true, acreage: true, legal: true, jurisdiction: true}), 'strong');
  assert.equal(core.strengthOf({owner: true, acreage: false, legal: true, jurisdiction: true}), 'review');
  assert.equal(core.strengthOf({owner: true, acreage: true, legal: null, jurisdiction: true}), 'review');
});

test('lot numbers are read as written and compared without leading zeros', () => {
  assert.deepEqual(core.splitLot('5112 N Fairmount St Lot 076'), {base: '5112 N Fairmount St', unit: '76'});
  assert.deepEqual(core.splitLot('4422 State St Lot 008B'), {base: '4422 State St', unit: '8B'});
  assert.equal(core.splitLot('3010 W 49Th St Lt 070').unit, '70');
  assert.equal(core.splitLot('3824 Chisholm Trl L0T 045').unit, '45');
  assert.equal(core.splitLot('5 Main St'), null);
  const rows = [{STRADD: '4422 STATE ST LOT 8B', UNITTYP: 'LOT', UNITID: '8B', LAT: 41.5, LONG: -90.5}];
  assert.equal(core.lotPoints(rows, '4422 State St', '8B').length, 1);
  assert.equal(core.lotPoints(rows, '4422 State St', '8').length, 0);
  assert.equal(core.lotPoints(rows, '4423 State St', '8B').length, 0);
});

test('land parcels at the same address are context only and carry no position', () => {
  const rows = [{PIN: 'U0839-01', PropertyAddress: '5112 N FAIRMOUNT ST', DeedHold: 'FIVE SEASONS LLC', PropClass: 'M'}];
  const found = core.parcelsAtAddress(rows, '5112 N Fairmount St');
  assert.deepEqual(found, [{pin: 'U0839-01', owner: 'FIVE SEASONS LLC', propClass: 'M'}]);
});
