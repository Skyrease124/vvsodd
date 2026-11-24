// The location coverage documents match the published map data, and every count adds up.
// Run from the repo root: node tests/location-coverage.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {datasetRows, buildCoverage, DATA_DIR, MD_FILE, CSV_FILE} from '../tools/coverage/location-coverage.mjs';

const rows = datasetRows();
const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));

test('every published dataset file has one row, and each row adds up', () => {
  assert.equal(rows.length, files.length);
  for (const r of rows) {
    assert.equal(r.located + r.unlocated, r.records, r.dataset + ': located and unlocated make the records');
    assert.ok(r.boundary <= r.located, r.dataset + ': an outline needs a position');
  }
});

test('the Rochester list has no published positions; its matches stay on the server until the window ends', () => {
  const r = rows.find(x => x.dataset === 'NY-city-of-rochester');
  assert.equal(r.records, 191);
  assert.equal(r.located, 0);
  assert.deepEqual(r.sources, ['city-of-rochester-tax-parcels', 'monroe-county-public-parcels']);
  assert.equal(r.server.matched, 191);
});

test('no published dataset stores positions or outlines in a dictionary, so they can be read directly', () => {
  for (const f of files) {
    const dict = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8')).dict || {};
    assert.ok(!('cx' in dict) && !('g' in dict), f);
  }
});

test('the committed documents are the current output of the tool', () => {
  const {md, csv} = buildCoverage(rows);
  assert.equal(fs.readFileSync(MD_FILE, 'utf8'), md, 'docs/location-coverage.md is out of date: run node tools/coverage/location-coverage.mjs');
  assert.equal(fs.readFileSync(CSV_FILE, 'utf8'), csv, 'docs/location-coverage.csv is out of date: run node tools/coverage/location-coverage.mjs');
});

test('the CSV has a header and one line per dataset', () => {
  const {csv} = buildCoverage(rows);
  assert.equal(csv.trim().split('\n').length, rows.length + 1);
});
