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
test('three map consumers update when publication recovery changes visible feed without version bump',async()=>{
 const ring=[[-83.1,42.3],[-83.099,42.3],[-83.099,42.301],[-83.1,42.3]];
 const approved={i:'r1',p:'01002263',verifiedGeometry:true,g:[ring],
  cx:[-83.0995,42.3005],bb:[-83.1,42.3,-83.099,42.301],evidenceUrl:'https://example.gov/parcel'};
 let body={ok:true,dataset:'MI-wayne',version:13,records:{}};
 const scope={window:{},URL,URLSearchParams,fetch:async()=>({ok:true,json:async()=>body})};
 vm.runInNewContext(merge,scope);
 const consumers=Array.from({length:3},()=>({id:'MI-wayne',recs:[{i:'r1',p:'01002263',why:'missing'}]}));
 for(const dataset of consumers)assert.equal((await scope.window.PPABrainMap.apply(dataset)).changed,false);
 // An unfinished publication is hidden by the server. Once recovery clears its
 // marker, the server can expose it even though polygon version 13 is unchanged.
 body={...body,records:{r1:approved}};
 for(const dataset of consumers){
  const updated=await scope.window.PPABrainMap.apply(dataset);
  assert.equal(updated.version,13);
  assert.equal(updated.changed,true);
  assert.deepEqual(dataset.recs[0].g,[ring]);
  assert.equal((await scope.window.PPABrainMap.apply(dataset)).changed,false);
 }
 body={...body,records:{}};
 for(const dataset of consumers){
  assert.equal((await scope.window.PPABrainMap.apply(dataset)).changed,true);
  assert.equal(dataset.recs[0].g,null);
 }
});

test('read-only map endpoint and official approval gate',()=>{
 assert.match(fn,/req\.method!=='GET'/);
 assert.match(publish,/approved_for_staging/);
 assert.match(publish,/independentlyChecked!==true/);
 assert.match(publish,/officialPolygon/);
 assert.doesNotMatch(publish,/geoapify\.com|photon\.komoot\.io/);
});



test('shared public and Workshop maps rotate all loaded counties and isolate feed failures',()=>{
 const source=fs.readFileSync('kinvest-liens/map/parcel-map.js','utf8');
 assert.match(source,/let overlayRefreshRunning=false,overlayRefreshCursor=0/);
 assert.match(source,/counties\[\(overlayRefreshCursor\+i\)%counties\.length\]/);
 assert.match(source,/overlayRefreshCursor=\(overlayRefreshCursor\+8\)%counties\.length/);
 assert.match(source,/for\(let i=0;i<Math\.min\(8,counties\.length\);i\+\+\)/);
 assert.match(source,/catch\(_\)\{\/\* Keep existing polygons until the source recovers/);
 assert.match(source,/setInterval\(refreshVerifiedOverlays,120000\)/);
});


test('public correction feed hides pending publications and malformed geometry without GIS calls',async()=>{
 let reads=0;
 const auth={
  kvGet:async()=>{reads++;return {version:12,records:{
   pending:{i:'pending',p:'01002754',verifiedGeometry:true,publicationPending:true,
    evidenceUrl:'https://example.gov',g:[[[-83.1,42.3],[-83.099,42.3],[-83.1,42.301],[-83.1,42.3]]],
    bb:[-83.1,42.3,-83.099,42.301],cx:[-83.0995,42.3005]},
   invalid:{i:'invalid',p:'01002830',verifiedGeometry:true,evidenceUrl:'https://example.gov',
    g:[[[-83.1,42.3],[-83.099,42.3],[-83.1,42.301]]],bb:[-83.1,42.3,-83.099,42.301],cx:[-83.0995,42.3005]},
   good:{i:'good',p:'01003357',verifiedGeometry:true,evidenceUrl:'https://example.gov',
    g:[[[-83.1,42.3],[-83.099,42.3],[-83.1,42.301],[-83.1,42.3]]],
    bb:[-83.1,42.3,-83.099,42.301],cx:[-83.0995,42.3005]}
  }}},
  withBrainStore:handler=>handler
 };
 // Evaluate the real endpoint handler without experimental vm.Module flags.
 const executable=fn.replace(/^import .*;$/gm,'').replace(/export default auth\.withBrainStore\(handler\);?/,'');
 const handler=vm.runInNewContext(executable+';handler',{Response,Request,URL,auth,Number,Object,Array,Math});
 const response=await handler(new Request('https://preview.test/.netlify/functions/brain-map-county?dataset=MI-wayne'));
 assert.equal(response.status,200);
 const data=await response.json();
 assert.equal(data.version,12);
 assert.deepEqual(Object.keys(data.records),['good']);
 assert.equal(reads,1);
 const rejected=await handler(new Request('https://preview.test/.netlify/functions/brain-map-county?dataset=bad'));
 assert.equal(rejected.status,400);
 assert.equal(reads,1);
 const mutation=await handler(new Request('https://preview.test/.netlify/functions/brain-map-county?dataset=MI-wayne',{method:'POST'}));
 assert.equal(mutation.status,405);
 assert.equal(reads,1);
});


test('offscreen county updates do not redraw mobile map or rebuild results',()=>{
 const source=fs.readFileSync('kinvest-liens/map/parcel-map.js','utf8');
 assert.match(source,/if\(result\.changed&&\(!active\.size\|\|active\.has\(ds\.id\)\)\)visibleChanged=true/);
 assert.match(source,/if\(visibleChanged\)\{refresh\(\);/);
 assert.match(source,/if\(sel&&loaded\[sel\._d\]&&\(!active\.size\|\|active\.has\(sel\._d\)\)\)popup\(sel\)/);
});
