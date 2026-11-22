import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {verifyOfficial,DETROIT_GIS} from '../../netlify/lib/brain-official-verification.mjs';
const source=fs.readFileSync('netlify/functions/owner-brain-batch-test.mjs','utf8');
async function setup({owner=true,preview=true}={}){
 const saved=new Map();
 let calls=0,writes=0;
 const records=[
  {i:'r1',p:'01002263',a:'90 Chandler, Detroit MI'},
  {i:'r2',p:'01002264',a:'92 Chandler, Detroit MI'},
  {i:'r3',p:'01002265',a:'94 Chandler, Detroit MI'},
  {i:'r4',p:'01002266',a:'96 Chandler, Detroit MI'}
 ];
 const ring=[[-83.074,42.374],[-83.073,42.374],[-83.073,42.375],[-83.074,42.374]];
 const context=vm.createContext({Response,URL,URLSearchParams,AbortSignal,Buffer,console,fetch:async url=>{
  calls++;
  const u=new URL(url);
  if(u.hostname==='pricepocketasset.com')return Response.json({recs:records});
  const where=u.searchParams.get('where')||'';
  if(where.includes('01002264'))return Response.json({features:[]});
  const id=(where.match(/0100[0-9]{4}/)||[])[0];
  return Response.json({features:[{attributes:{parcel_number:id+'.',address:id==='01002263'?'90 CHANDLER':'94 CHANDLER',object_id:279374},geometry:{rings:[ring]}}]});
 }});
 const auth=new vm.SyntheticModule(['userFromCookie','kvGet','kvPut','withBrainStore','isBrainPreview','fetchWayneGis'],function(){
  this.setExport('userFromCookie',async()=>owner?{owner:true}:null);
  this.setExport('kvGet',async k=>structuredClone(saved.get(k)));
  this.setExport('kvPut',async()=>{writes++;});
  this.setExport('withBrainStore',h=>h);
  this.setExport('fetchWayneGis',context.fetch);
  this.setExport('isBrainPreview',()=>preview);
 },{context});
 const verification=new vm.SyntheticModule(['verifyOfficial','DETROIT_GIS'],function(){
  this.setExport('verifyOfficial',verifyOfficial);
  this.setExport('DETROIT_GIS',DETROIT_GIS);
 },{context});
 const m=new vm.SourceTextModule(source,{context});
 await m.link(s=>s.includes('brain-auth')?auth:verification);await m.evaluate();
 const url='https://preview.test/.netlify/functions/owner-brain-batch-test';
 const invoke=(origin='https://preview.test',deploy='deploy-preview')=>m.namespace.default(new Request(url,{method:'POST',headers:{origin},body:JSON.stringify({action:'test-wayne-batch',confirmed:true})}),{deploy:{context:deploy}});
 return {invoke,reads:()=>calls,writes:()=>writes,saved};
}
test('three real-formatted missing records verified conservatively with no state writes',async()=>{
 const h=await setup();
 const response=await h.invoke();const body=await response.json();
 assert.equal(response.status,200);
 assert.equal(body.attempted,3);
 assert.equal(body.verified,2);
 assert.equal(body.needsReview,1);
 assert.equal(h.reads(),4);
 assert.equal(h.writes(),0);
 assert.equal(h.saved.size,0);
});
test('preview-only owner checks precede GIS access',async()=>{
 for(const opts of [{owner:false},{preview:false}]){
  const h=await setup(opts);const res=await h.invoke();
  assert.equal(res.status,opts.owner===false?401:404);
  assert.equal(h.reads(),0);
 }
 const h=await setup();
 assert.equal((await h.invoke('https://untrusted.test')).status,403);
 assert.equal((await h.invoke(undefined,'production')).status,404);
 assert.equal(h.reads(),0);
});
test('batch UI discloses dry-run scope and never invokes publisher',()=>{
 const ui=fs.readFileSync('kinvest-liens/owner/brain/preview-test.js','utf8');
 assert.match(ui,/Test 3 Wayne parcels \(no AI credits\)/);
 assert.match(ui,/owner-brain-batch-test/);
 assert.doesNotMatch(source,/auth\.kvPut\(/);
});
