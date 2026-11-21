// Local smoke tests: zero external calls, no Netlify deploy or credits.
// Run: node --test tests/brain-map-contract.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const map=fs.readFileSync('kinvest-liens/map/parcel-map.js','utf8');
const html=fs.readFileSync('kinvest-liens/map/index.html','utf8');
const tiler=fs.readFileSync('kinvest-liens/owner/maptiler/index.html','utf8');
const merge=fs.readFileSync('kinvest-liens/map/brain-map-merge.js','utf8');
const fn=fs.readFileSync('netlify/functions/brain-map-county.mjs','utf8');
const publish=fs.readFileSync('netlify/functions/brain-map-publish-auto.mjs','utf8');
test('public and embedded Workshop load the same correction merger first',()=>{
 assert.match(html,/<script src="brain-map-merge\.js" defer><\/script>\s*<script src="parcel-map\.js" defer><\/script>/);
 assert.match(map,/await window\.PPABrainMap\.apply\(ds\)/);
});
test('owner MapTiler preview merges before drawing',()=>{
 assert.match(tiler,/src="\/map\/brain-map-merge\.js"/);
 assert.match(tiler,/await window\.PPABrainMap\.apply\(data\)/);
});
test('corrections never replace existing mapped boundaries',()=>{
 assert.match(merge,/r\.g\|\|r\.cx/);
 assert.match(merge,/p\.verifiedGeometry/);
 assert.match(merge,/norm\(p\.p\)!==norm\(r\.p\)/);
});
test('read-only map endpoint and official approval gate',()=>{
 assert.match(fn,/req\.method!=='GET'/);
 assert.match(publish,/approved_for_staging/);
 assert.match(publish,/independentlyChecked!==true/);
 assert.match(publish,/officialPolygon/);
 assert.doesNotMatch(publish,/geoapify\.com|photon\.komoot\.io/);
});
