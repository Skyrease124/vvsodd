'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { checkExistingParcelDataset } = require('../scripts/check-existing-parcels');
test('validates actual existing parcel geometry shape without modifying records', () => {
  const dataset = { county: 'Tuscaloosa County', source: 'county GIS', p: { '632403050000005004': { st: 'matched', bb: [-87.2, 33.1, -87.1, 33.2], g: [[[-87.2, 33.1]]] } } };
  const before = JSON.stringify(dataset);
  const result = checkExistingParcelDataset(dataset, 'AL');
  assert.equal(result.summary.accepted, 1);
  assert.equal(result.readyToPublish, true);
  assert.equal(JSON.stringify(dataset), before);
});
test('rejects invalid bounding boxes', () => {
  const result = checkExistingParcelDataset({ county: 'Tuscaloosa County', p: { A: { bb: [1, 2] } } }, 'AL');
  assert.equal(result.readyToPublish, false);
  assert.equal(result.summary.rejected, 1);
});
