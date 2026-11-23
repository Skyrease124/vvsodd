'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { checkMapDataset } = require('../scripts/check-map-datasets');
test('accepts actual map data structure', () => {
  const data = { state: 'AL', county: 'Baldwin County', dict: { t: [] }, recs: [{ i: 'AL|Baldwin|123', p: '123', amt: 52.17 }] };
  assert.deepEqual(checkMapDataset(data, 'AL-05.json').errors, []);
});
test('accepts negative amounts from county lists (credits and overpayments)', () => {
  const data = { state: 'CO', county: 'Larimer', dict: {}, recs: [{ i: 'CO|Larimer|1432406029|', p: '1432406029', amt: -0.56 }] };
  assert.deepEqual(checkMapDataset(data, 'CO-larimer.json').errors, []);
});
test('rejects duplicate IDs and non-numeric amounts', () => {
  const duplicate = { state: 'AL', county: 'Baldwin County', dict: {}, recs: [{ i: 'x', amt: -1 }, { i: 'x' }] };
  assert.deepEqual(checkMapDataset(duplicate, 'AL-05.json').errors, ['Duplicate record ID at 1']);
  const notANumber = { state: 'AL', county: 'Baldwin County', dict: {}, recs: [{ i: 'x', amt: NaN }] };
  assert.deepEqual(checkMapDataset(notANumber, 'AL-05.json').errors, ['Invalid amount at 0']);
});
