// Checks the committed Rochester parcel-match audit document (netlify/lib/data/parcel-matches/NY-city-of-rochester.json),
// the file the owner imports. It must account for every record in the City dataset, carry only positions that lie
// inside their own official boundary, and never duplicate an official parcel. It must stay out of the public site.
// Run from the repo root: node kinvest-liens/tests/rochester-matches-output.test.mjs
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {pointInRing, normSbl} from '../../netlify/lib/parcel-match.mjs';
import {SOURCES} from '../../netlify/lib/gis-sources.mjs';

const FILE = 'netlify/lib/data/parcel-matches/NY-city-of-rochester.json';
const DATASET = JSON.parse(fs.readFileSync('kinvest-liens/map/data/NY-city-of-rochester.json', 'utf8'));
const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const BOX = [-77.85, 43.0, -77.45, 43.3];

test('the audit document accounts for every record of the City dataset, once each', () => {
  assert.equal(doc.records.length, DATASET.recs.length);
  assert.deepEqual(doc.records.map(r => r.parcel), DATASET.recs.map(r => r.p), 'same parcels, same order');
  assert.equal(doc.summary.records, DATASET.recs.length);
  assert.equal(doc.summary.matched + doc.summary.pending, doc.summary.records);
});

test('every matched record has a position inside its own boundary, inside the City, and a valid identifier', () => {
  for (const r of doc.records.filter(x => x.status === 'matched')) {
    assert.ok(r.point && r.boundary, r.parcel + ' has a position and a boundary');
    assert.ok(pointInRing(r.point, r.boundary), r.parcel + ' point is inside its boundary');
    assert.ok(r.point[0] >= BOX[0] && r.point[0] <= BOX[2] && r.point[1] >= BOX[1] && r.point[1] <= BOX[3], r.parcel + ' point is inside the City');
    assert.equal(r.boundary[0][0], r.boundary.at(-1)[0], r.parcel + ' ring is closed');
    assert.ok(normSbl(r.parcel) || r.identifierNote, r.parcel + ' identifier is readable');
    assert.equal(r.reason, 'verified');
  }
});

test('no official parcel is claimed by two records, and every official identifier is recorded', () => {
  const printKeys = doc.records.filter(r => r.status === 'matched').map(r => r.official.printKey);
  assert.equal(new Set(printKeys).size, printKeys.length);
  for (const r of doc.records.filter(x => x.status === 'matched')) assert.match(r.evidenceUrl, /^https:\/\/maps\.cityofrochester\.gov\//);
});

test('addresses the City list stored with a known defect carry the official spelling, and the listed text is kept', () => {
  const fixed = doc.records.filter(r => r.addressAsListed);
  assert.equal(fixed.length, 11);
  for (const r of fixed) {
    assert.match(r.addressAsListed, /Aveenue|Aveerill|Aveis/);
    assert.doesNotMatch(r.official.siteAddress, /Aveenue|Aveerill|Aveis/);
  }
});

test('the sources are recorded with their dates, coverage, terms and the required wording', () => {
  assert.equal(doc.sources.length, 2);
  const city = doc.sources.find(s => s.id === 'city-of-rochester-tax-parcels');
  assert.equal(city.disclaimer, SOURCES['city-of-rochester-tax-parcels'].disclaimer);
  assert.equal(city.coverage.requested, 190, 'one identifier carries trailing text and is queried as written');
  assert.match(city.terms.url, /^https:\/\/data\.cityofrochester\.gov\//);
  assert.ok(city.dataDate && city.retrievedAt);
  const monroe = doc.sources.find(s => s.id === 'monroe-county-public-parcels');
  assert.equal(monroe.coverage.foundParcelNumbers, 0, 'the secondary layer has none of these parcels, as recorded');
});

test('the audit document holds no key-like strings and is not inside the published site', () => {
  const text = fs.readFileSync(FILE, 'utf8');
  assert.doesNotMatch(text, /nvapi-|sk-[A-Za-z0-9]{12,}|apiKey|Bearer /);
  assert.ok(FILE.startsWith('netlify/lib/'), 'stored with the server code, outside the published kinvest-liens folder');
  assert.equal(fs.existsSync('kinvest-liens/' + FILE.split('/').pop()), false);
});
