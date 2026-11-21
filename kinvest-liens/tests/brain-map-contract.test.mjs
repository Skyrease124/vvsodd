// Local smoke tests: zero external calls, no Netlify deploy or credits.
// Run: node --test tests/brain-map-contract.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
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
test('corrections refresh, roll back, and preserve existing mapped boundaries',async()=>{
 const patch=(x=-83.1)=>({i:'r1',p:'P1',verifiedGeometry:true,
  g:[[[x,42.3],[x+0.001,42.3],[x+0.001,42.301],[x,42.3]]],
  cx:[x+0.0005,42.3005],bb:[x,42.3,x+0.001,42.301]});
 let body={ok:true,dataset:'MI-wayne',version:1,records:{r1:patch()}};
 const scope={window:{},URLSearchParams,fetch:async()=>({ok:true,json:async()=>body})};
 vm.runInNewContext(merge,scope);
 const existing={i:'r1',p:'P1',g:[['original']],cx:[-83,42]};
 const mapped={id:'MI-wayne',recs:[existing]};
 assert.equal((await scope.window.PPABrainMap.apply(mapped)).changed,false);
 assert.deepEqual(existing.g,[['original']]);
 // Separate dataset objects represent the public map, Workshop, and preview.
 const surfaces=Array.from({length:3},()=>({id:'MI-wayne',recs:[{i:'r1',p:'P1',why:'missing'}]}));
 for(const ds of surfaces){
  assert.equal((await scope.window.PPABrainMap.apply(ds)).changed,true);
  assert.equal((await scope.window.PPABrainMap.apply(ds)).changed,false);
 }
 body={...body,version:2,records:{r1:patch(-83.11)}};
 for(const ds of surfaces){
  assert.equal((await scope.window.PPABrainMap.apply(ds)).changed,true);
  assert.deepEqual(ds.recs[0].g,body.records.r1.g);
 }
 body={...body,version:3,records:{}};
 for(const ds of surfaces){
  assert.equal((await scope.window.PPABrainMap.apply(ds)).changed,true);
  assert.equal(ds.recs[0].g,null);
  assert.equal(ds.recs[0].why,'missing');
 }
 body={...body,version:4,records:{r1:{...patch(),verifiedGeometry:false}}};
 assert.equal((await scope.window.PPABrainMap.apply(surfaces[0])).changed,false);
 assert.equal(surfaces[0].recs[0].g,null);
});
test('read-only map endpoint and official approval gate',()=>{
 assert.match(fn,/req\.method!=='GET'/);
 assert.match(publish,/approved_for_staging/);
 assert.match(publish,/independentlyChecked!==true/);
 assert.match(publish,/officialPolygon/);
 assert.doesNotMatch(publish,/geoapify\.com|photon\.komoot\.io/);
});

