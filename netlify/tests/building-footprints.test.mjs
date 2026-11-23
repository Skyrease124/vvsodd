import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBBox, convertOverpass } from '../functions/building-footprints.mjs';

test('bbox must be small, valid and inside the US', () => {
  assert.deepEqual(validateBBox('-80.2,26.6,-80.19,26.61'), [-80.2, 26.6, -80.19, 26.61]);
  assert.throws(() => validateBBox('-80.2,26.6,-80.0,26.61'));
  assert.throws(() => validateBBox('1,2,3'));
  assert.throws(() => validateBBox('10,10,10.01,10.01'));
  assert.throws(() => validateBBox('a,b,c,d'));
});

test('overpass ways become closed polygons; non-ways and bad rings are skipped', () => {
  const ring = [{lat:1,lon:1},{lat:1,lon:2},{lat:2,lon:2},{lat:1,lon:1}];
  const open = [{lat:1,lon:1},{lat:1,lon:2},{lat:2,lon:2},{lat:2,lon:1}];
  const r = convertOverpass({ elements: [
    { type:'way', id:1, geometry: ring },
    { type:'way', id:2, geometry: open },
    { type:'node', id:3 },
    { type:'way', id:4, geometry: [{lat:1,lon:1},{lat:1,lon:2}] },
    { type:'way', id:5, geometry: [{lat:'x',lon:1},{lat:1,lon:2},{lat:2,lon:2},{lat:1,lon:1}] }
  ]});
  assert.equal(r.features.length, 2);
  for (const f of r.features) { const c = f.geometry.coordinates[0]; assert.deepEqual(c[0], c[c.length - 1]); }
  assert.equal(r.truncated, false);
  assert.throws(() => convertOverpass({}));
});

test('result is flagged truncated at the limit', () => {
  const ring = [{lat:1,lon:1},{lat:1,lon:2},{lat:2,lon:2},{lat:1,lon:1}];
  const r = convertOverpass({ elements: Array.from({length:130},(_, i)=>({type:'way',id:i,geometry:ring})) }, 125);
  assert.equal(r.features.length, 125);
  assert.equal(r.truncated, true);
});
