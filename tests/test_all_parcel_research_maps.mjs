import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const js=fs.readFileSync('kinvest-liens/liens/states/research-parcel-overlays.js','utf8');
const ctx={module:{exports:{}},globalThis:{}};
vm.runInNewContext(js,ctx,{timeout:1000});
const {matching}=ctx.module.exports;
const row=(v={})=>({id:'r1',type:'lien',state:'FL',county:'Palm Beach',parcelId:'P-001',
 researchOnly:true,availableForPurchase:false,...v});
test('county/state/parcel exact matching tolerates suffix but never partial IDs',()=>{
 assert.equal(matching([row()],{state:'FL',county:'Palm Beach County',parcel:'P-001'}).length,1);
 assert.equal(matching([row()],{state:'FL',county:'Palm Beach',parcel:'P-00'}).length,0);
 assert.equal(matching([row()],{state:'GA',county:'Palm Beach',parcel:'P-001'}).length,0);
 assert.equal(matching([row()],{state:'FL',county:'Orange',parcel:'P-001'}).length,0);
 assert.equal(matching([row()],{state:'FL',county:null,parcel:'P-001'}).length,0);
});
test('state, county, parcel details and state land maps load shared approved feed',()=>{
 const lien=fs.readFileSync('kinvest-liens/liens/states/lien-ui.js','utf8');
 const land=fs.readFileSync('kinvest-liens/liens/states/land-map.js','utf8');
 assert.equal((lien.match(/PPAResearchParcelOverlay\.attach/g)||[]).length,2);
 assert.equal((land.match(/PPAResearchParcelOverlay\.attach/g)||[]).length,1);
 for(const page of ['kinvest-liens/liens/states/state/index.html',
   'kinvest-liens/liens/states/county/index.html','kinvest-liens/liens/parcel/index.html']){
  const html=fs.readFileSync(page,'utf8');
  assert.ok(html.indexOf('research-parcel-overlays.js')>=0);
  assert.ok(html.indexOf('research-parcel-overlays.js')<html.indexOf('lien-ui.js'));
 }
});
test('Arkansas and Alabama satellite previews include county context',()=>{
 assert.match(fs.readFileSync('kinvest-liens/liens/states/al-state-land-ui.js','utf8'),/county:c\.county/);
 assert.match(fs.readFileSync('kinvest-liens/liens/states/ar-cosl-ui.js','utf8'),/county:x\[0\]/);
});
test('no guessed locations or public early access data are introduced',()=>{
 assert.match(js,/\.netlify\/functions\/research-updates/);
 assert.match(js,/credentials:'same-origin'/);
 assert.match(js,/researchOnly===true/);
 assert.match(js,/availableForPurchase===false/);
 assert.doesNotMatch(js,/geocode|nominatim/i);
 const map=fs.readFileSync('kinvest-liens/map/parcel-map.js','utf8');
 const home=fs.readFileSync('kinvest-liens/index.html','utf8');
 assert.match(map,/\.netlify\/functions\/research-updates/);
 assert.match(home,/\/map\/\?embed=1&home=1/);
});
