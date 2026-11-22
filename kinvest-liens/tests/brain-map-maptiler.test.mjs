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
