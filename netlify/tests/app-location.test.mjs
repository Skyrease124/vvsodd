import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import where from '../functions/where.mjs';

const require = createRequire(import.meta.url);
const { countyArea, normalize, mapPath, coordinates } = require('../../kinvest-liens/app-location.js');

test('Home uses the actual parcel point or its county data bounds', () => {
  const county = {id:'AZ-cochise',state:'AZ',county:'Cochise',bb:[-110,31,-109,32]};
  const area = countyArea(county);
  assert.deepEqual([area.lat,area.lng],[31.5,-109.5]);
  const parcel = countyArea(county,{p:'001 A',cx:[-109.2,31.1]});
  assert.deepEqual([parcel.lat,parcel.lng],[31.1,-109.2]);
  const href = new URL(mapPath(parcel), 'https://example.test');
  assert.equal(href.searchParams.get('c'),'AZ-cochise');
  assert.equal(href.searchParams.get('p'),'001 A');
});

test('Recent state and approximate point do not invent a county or imply zero coordinates', () => {
  const state = normalize({state:'FL',county:'AZ-cochise',parcel:'1'});
  assert.equal(state.county,'');
  assert.equal(state.parcel,'');
  assert.equal(state.lat,null);
  assert.equal(coordinates(null,null),false);
  assert.equal(normalize({lat:0,lng:0}),null);
  assert.equal(mapPath(state,'/map/?ai=1'),'/map/?ai=1&s=FL');
  assert.equal(mapPath(null),'/map/');
});

test('Approximate location is opt-in to the existing location response shape and stays coarse', async () => {
  const geo = {country:{code:'US'},subdivision:{code:'FL',name:'Florida'},city:'Fort Myers',latitude:26.64308,longitude:-81.87419};
  const base = 'https://example.test/.netlify/functions/where';
  const old = await where(new Request(base),{geo});
  assert.deepEqual(await old.json(),{state:'FL',name:'Florida',source:'connection'});
  const regional = await where(new Request(base+'?regional=1'),{geo});
  assert.deepEqual(await regional.json(),{state:'FL',name:'Florida',source:'connection',lat:26.6,lng:-81.9,city:'Fort Myers'});
  const missing = await where(new Request(base+'?regional=1'),{});
  assert.equal((await missing.json()).state,null);
});
