import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const scope={module:{exports:{}},globalThis:{}};
vm.runInNewContext(fs.readFileSync('kinvest-liens/owner/maptiler/preview-utils.js','utf8'),scope);
const {count,errorMessage}=scope.module.exports;
test('MapTiler county count includes verified corrections, respects total records and rollback',()=>{
 const dataset={id:'MI-wayne',mapped:0,records:4161};
 assert.equal(count(dataset,{'MI-wayne':1}),1);
 assert.equal(count(dataset,{'MI-wayne':0}),0);
 assert.equal(count({...dataset,mapped:4161},{'MI-wayne':1}),4161);
});
test('provider diagnostics identify HTTP errors and remove browser key values',()=>{
 assert.match(errorMessage({status:403},'https://preview.example'),/HTTP 403.*https:\/\/preview.example/);
 assert.match(errorMessage({status:401},'https://preview.example'),/rejected the API key/);
 assert.match(errorMessage({status:404},''),/not found/);
 assert.match(errorMessage({status:429},''),/quota/);
 assert.match(errorMessage({message:'Failed to initialize WebGL'},''),/WebGL graphics/);
 assert.doesNotMatch(errorMessage({message:'Error at https://api.maptiler.com/style?key=example-private-key'},'','example-private-key'),/example-private-key/);
});
async function endpoint(user){
 const context=vm.createContext({URL,Request,Response});let reads=0;let forwarded;
 const auth=new vm.SyntheticModule(['userFromCookie','kvGet','withBrainStore'],function(){this.setExport('userFromCookie',async()=>user);this.setExport('kvGet',async()=>{reads++;return {entries:[{dataset:'MI-wayne'},{dataset:'MI-wayne'},{dataset:'invalid/path'}]};});this.setExport('withBrainStore',h=>h);},{context});
 const keys=new vm.SyntheticModule(['load','keyOf'],function(){this.setExport('load',async()=>{});this.setExport('keyOf',()=>null);},{context});
 const feed=new vm.SyntheticModule(['default'],function(){this.setExport('default',async(req,ctx)=>{forwarded=ctx;return Response.json({ok:true,records:{r1:{verifiedGeometry:true}}});});},{context});
 const module=new vm.SourceTextModule(fs.readFileSync('netlify/functions/owner-maptiler-preview.mjs','utf8'),{context});
 await module.link(s=>s.includes('brain-auth')?auth:s.includes('apikeys')?keys:feed);await module.evaluate();
 return {handler:module.namespace.default,reads:()=>reads,forwarded:()=>forwarded};
}
test('owner configuration returns validated feed counts in the same deployment context even without a provider key',async()=>{
 const h=await endpoint({owner:true}),ctx={deploy:{context:'deploy-preview'}};
 const response=await h.handler(new Request('https://preview.test/config'),ctx),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.configured,false);assert.deepEqual(body.correctionCounts,{'MI-wayne':1});assert.equal(h.forwarded(),ctx);
});
test('MapTiler configuration rejects non-owners before reading correction data',async()=>{
 for(const user of [null,{owner:false}]){const h=await endpoint(user);assert.equal((await h.handler(new Request('https://preview.test/config'))).status,user?403:401);assert.equal(h.reads(),0);}
});


test('MapTiler includes verified corrections beyond the static drawing cap',()=>{
 const {visibleParcels}=scope.module.exports;
 const baseline=Array.from({length:300},(_,i)=>({i,g:[[i]],cx:[i,0]}));
 const correction={i:'verified',g:[[[1,2]]],cx:[1,2],__brainMap:true};
 const more=Array.from({length:251},(_,i)=>({...correction,i:'c'+i}));
 assert.equal(visibleParcels([...baseline,correction]).length,250);
 assert.equal(visibleParcels([...baseline,correction])[0],correction);
 assert.equal(visibleParcels([...baseline,...more]).length,251);
});


test('private map inspects parcel boundaries even when MapTiler style returns HTTP 403',()=>{
 const page=fs.readFileSync('kinvest-liens/owner/maptiler/index.html','utf8');
 assert.match(page,/boundaryOnly=true/);
 assert.match(page,/error\.status!==401&&error\.status!==403&&error\.status!==429/);
 assert.match(page,/version:8,sources:\{\},layers:\[/);
 assert.match(page,/Boundary-only map loaded/);
 assert.match(page,/if\(boundaryOnly\|\|!map\|\|!map\.isStyleLoaded\(\)\)return/);
 assert.match(page,/MapTiler key not configured\. Boundary-only inspection remains available/);
 assert.match(page,/overlay\(\)/);
});


test('boundary-only map provides parcel-specific camera and does not jump on refresh',()=>{
 const page=fs.readFileSync('kinvest-liens/owner/maptiler/index.html','utf8');
 assert.match(page,/id="parcelFocus"/);
 assert.match(page,/id="focusParcel"/);
 assert.match(page,/function focusSelectedParcel\(features\)/);
 assert.match(page,/map\.fitBounds\(bounds,\{padding:55,maxZoom:19,duration:0\}\)/);
 assert.match(page,/if\(focusedDataset!==currentData\)/);
 assert.match(page,/\$\('focusParcel'\)\.onclick=/);
});


test('parcel selection is above the interactive map and hidden until parcels load',()=>{
 const html=fs.readFileSync('kinvest-liens/owner/maptiler/index.html','utf8');
 const controls=html.indexOf('id="parcelControls"');
 const map=html.indexOf('id="map"');
 const detail=html.indexOf('id="details"');
 assert.ok(controls>0&&controls<map&&map<detail);
 assert.match(html,/id="parcelControls" class="panel" hidden/);
 assert.match(html,/\$\('parcelControls'\)\.hidden=!feats\.length/);
 assert.match(html,/\$\('parcelControls'\)\.hidden=true/);
 assert.equal((html.match(/id="parcelFocus"/g)||[]).length,1);
});


test('parcel inspector identifies original versus Brain-corrected geometry for cross-map review',()=>{
 const page=fs.readFileSync('kinvest-liens/owner/maptiler/index.html','utf8');
 assert.match(page,/id="parcelEvidence"/);
 assert.match(page,/function selectedParcelEvidence\(\)/);
 assert.match(page,/record\.__brainMap\?'Verified Brain correction':'Original mapped county dataset'/);
 assert.match(page,/Public and Workshop maps use the same county dataset and correction feed/);
 assert.match(page,/selectedParcelEvidence\(\);/);
});


test('owner can run read-only automatic county parcel parity check with explicit limits',()=>{
 const page=fs.readFileSync('kinvest-liens/owner/maptiler/index.html','utf8');
 assert.match(page,/id="auditCounty"/);
 assert.match(page,/async function auditCounty\(\)/);
 assert.match(page,/await window\.PPABrainMap\.apply\(fresh\)/);
 assert.match(page,/const fields=\['p','g','cx','bb','__brainMap'\]/);
 assert.match(page,/Wayne 01002263:/);
 assert.match(page,/not each remote map rendering/);
 assert.match(page,/\$\('auditCounty'\)\.onclick=auditCounty/);
});
