'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { checkMapDataset } = require('../scripts/check-map-datasets');
test('accepts actual map data structure', () => {
  const data = { state: 'AL', county: 'Baldwin County', dict: { t: [] }, recs: [{ i: 'AL|Baldwin|123', p: '123', amt: 52.17 }] };
  assert.deepEqual(checkMapDataset(data, 'AL-05.json').errors, []);
});
test('rejects duplicates and invalid amounts', () => {
  const data = { state: 'AL', county: 'Baldwin County', dict: {}, recs: [{ i: 'x', amt: -1 }, { i: 'x' }] };
  assert.equal(checkMapDataset(data, 'AL-05.json').errors.length, 2);
});
