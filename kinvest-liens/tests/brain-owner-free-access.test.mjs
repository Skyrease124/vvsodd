// Owner/Free/Pro permission matrix. No network calls, no live data, no GIS budget.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {pureModule} from './support/policy-linker.mjs';

const users=[
 {label:'anonymous',value:null,expected:401},
 {label:'free',value:{owner:false,paidThrough:null},expected:403},
 {label:'pro',value:{owner:false,paidThrough:'2099-01-01'},expected:403},
 {label:'family',value:{owner:false,family:true},expected:403},
];
const request=(method='GET',body)=>new Request('https://preview.test/.netlify/functions/owner-brain-review',{
 method,headers:method==='POST'?{'origin':'https://preview.test','content-type':'application/json'}:{},
 ...(body?{body:JSON.stringify(body)}:{})
});
async function reviewEndpoint(user){
 let reads=0,writes=0;
 const ctx=vm.createContext({Request,Response,URL,Date,console});
 const auth=new vm.SyntheticModule(['userFromCookie','kvGet','kvPut','withBrainStore'],function(){
  this.setExport('userFromCookie',async()=>user);
  this.setExport('kvGet',async()=>{reads++;return {entries:[]};});
  this.setExport('kvPut',async()=>{writes++;});
  this.setExport('withBrainStore',f=>f);
 },{context:ctx});
 const cryptoModule=new vm.SyntheticModule(['default'],function(){
  this.setExport('default',{createHash:()=>({update:()=>({digest:()=> 'test-hash'})})});
 },{context:ctx});
 const module=new vm.SourceTextModule(fs.readFileSync('netlify/functions/owner-brain-review.mjs','utf8'),{context:ctx});
 const publisherStub=new vm.SyntheticModule(['default'],function(){this.setExport('default',async()=>{throw Error('publisher must not run in this access test');});},{context:ctx});
 await module.link(async s=>{if(s==='node:crypto')return cryptoModule;if(s.includes('brain-map-publish-auto'))return publisherStub;return (await pureModule(s,ctx))||auth;});
 await module.evaluate();
 return {handler:module.namespace.default,reads:()=>reads,writes:()=>writes};
}
for(const who of users){
 test(who.label+' cannot list private approval ledger',async()=>{
  const app=await reviewEndpoint(who.value);
  const r=await app.handler(request());
  assert.equal(r.status,who.expected);
  assert.equal(app.reads(),0);
  assert.equal(app.writes(),0);
 });
 test(who.label+' cannot submit owner review, including a spoofed approval',async()=>{
  const app=await reviewEndpoint(who.value);
  const r=await app.handler(request('POST',{owner:true,action:'approve',dataset:'MI-wayne',
   recordId:'MI|Wayne|01002263|',confirmed:true,officialSourceConfirmed:true,
   evidenceUrl:'https://example.gov/parcel',notes:'I verified this county parcel'}));
  assert.equal(r.status,who.expected);
  assert.equal(app.reads(),0);
  assert.equal(app.writes(),0);
 });
}
test('owner can read the private approval ledger, but cross-origin writes are rejected',async()=>{
 const app=await reviewEndpoint({owner:true});
 const ok=await app.handler(request());
 assert.equal(ok.status,200);
 assert.equal(app.reads(),1);
 const forged=new Request('https://preview.test/.netlify/functions/owner-brain-review',{
  method:'POST',headers:{origin:'https://attacker.example','content-type':'application/json'},
  body:JSON.stringify({action:'approve',confirmed:true})});
 const blocked=await app.handler(forged);
 assert.equal(blocked.status,403);
 // A cross-origin request is refused before the approval ledger is read.
 assert.equal(app.reads(),1);
 assert.equal(app.writes(),0);
});
test('owner-only activity endpoint rejects non-owner roles before reading internal state',()=>{
 const page=fs.readFileSync('netlify/functions/owner-brain-activity.mjs','utf8');
 assert.match(page,/if\(!user\?\.owner\)return respond\(user\?403:401/);
 const map=fs.readFileSync('netlify/functions/owner-maptiler-preview.mjs','utf8');
 assert.match(map,/if\(!me\?\.owner\)return out\(me\?403:401/);
});
test('preview batch publisher requires owner, preview context, and exact-origin confirmation',()=>{
 const source=fs.readFileSync('netlify/functions/owner-brain-batch-publish.mjs','utf8');
 assert.match(source,/context\?\.deploy\?\.context!=='deploy-preview'/);
 assert.match(source,/if\(!user\?\.owner\)return json\(user\?403:401/);
 assert.match(source,/req\.headers\.get\('origin'\)!==new URL\(req\.url\)\.origin/);
 assert.match(source,/input\.confirmed!==true/);
});
