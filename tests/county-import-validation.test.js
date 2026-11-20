'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { validateCountyImport } = require('../netlify/lib/county-import-validation');

test('accepts valid parcel and preserves source fields', () => {
  const result = validateCountyImport([{ parcel_id: '001-002', tax_owed: '$1,200.50', lat: 26.5, lng: -81.9, source: 'county' }], { state: 'FL', county: 'Lee' });
  assert.equal(result.summary.accepted, 1);
  assert.equal(result.accepted[0].taxOwed, 1200.5);
  assert.equal(result.accepted[0].source, 'county');
  assert.equal(result.readyToPublish, true);
});
test('rejects duplicates and invalid coordinates without blocking other rows', () => {
  const result = validateCountyImport([
    { apn: 'A' }, { apn: 'A' }, { apn: 'B', latitude: 200 }, { apn: 'C' }
  ], { state: 'AZ', county: 'Pinal' });
  assert.equal(result.summary.accepted, 2);
  assert.equal(result.summary.rejected, 2);
  assert.equal(result.readyToPublish, false);
});
test('rejects missing metadata and malformed input', () => {
  assert.throws(() => validateCountyImport([], { state: 'Florida', county: 'Lee' }));
  assert.throws(() => validateCountyImport(null, { state: 'FL', county: 'Lee' }));
});
