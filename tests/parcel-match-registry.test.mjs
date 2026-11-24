// Every parcel-match audit in the data folder is registered, so the owner dashboard can select it. Pure: no network.
// Run from the repo root: node --test tests/parcel-match-registry.test.mjs
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {MATCHES, datasetById, datasetList} from '../netlify/lib/parcel-matches-registry.mjs';

const DIR = new URL('../netlify/lib/data/parcel-matches/', import.meta.url);

test('every matches audit in the data folder is registered, and each is selectable by its id', () => {
  const audits = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(new URL(f, DIR), 'utf8')).dataset).sort();
  assert.deepEqual(Object.keys(MATCHES).sort(), audits, 'a new audit must be registered in netlify/lib/parcel-matches-registry.mjs');
  for (const id of audits) assert.equal(datasetById(id).dataset, id);
});

test('the dashboard list is ordered by state and then county, and unknown ids are refused', () => {
  const list = datasetList();
  const sorted = [...list].sort((a, b) => a.state.localeCompare(b.state) || a.county.localeCompare(b.county));
  assert.deepEqual(list.map(d => d.id), sorted.map(d => d.id));
  assert.equal(datasetById('../etc'), null);
  assert.equal(datasetById(undefined), null);
  assert.equal(datasetById('constructor'), null, 'no inherited keys');
});
