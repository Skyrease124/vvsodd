import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const js=fs.readFileSync('kinvest-liens/map/parcel-map.js','utf8');
const css=fs.readFileSync('kinvest-liens/map/parcel-map.css','utf8');
test('GIS status reports why outlines are not visible, even with button enabled',()=>{
 assert.match(js,/FL GIS: zoom closer to street level/);
 assert.match(js,/FL GIS: official GIS returned no polygon outlines/);
 assert.match(js,/GIS layer\(s\) unavailable/);
 assert.match(js,/official outlines loaded/);
 assert.match(js,/aria-live','polite'/);
 assert.match(js,/if\(sequence!==flGisRequest\|\|!flGisOn\)return/);
 assert.match(css,/\.pm-gis-status\[hidden\]/);
 assert.doesNotThrow(()=>new vm.Script(js));
});
test('GIS remains opt-in and separate from tax sale research',()=>{
 assert.match(js,/let flGisOn=false/);
 assert.match(js,/map\.addSource\('fl-gis-parcels'/);
 assert.match(js,/map\.addSource\('fl-gis-buildings'/);
 assert.match(js,/map\.on\('moveend',queueFloridaGIS\)/);
 const fn=fs.readFileSync('netlify/functions/florida-gis-overlay.mjs','utf8');
 assert.doesNotMatch(fn,/approved-research-releases|syncReviewedCertificate/);
});
