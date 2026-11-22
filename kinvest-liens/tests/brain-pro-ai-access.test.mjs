// Offline Pro-only access enforcement. No LLM calls, external requests or billing mutations.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const roles={
 anonymous:null,
 free:{email:'free@example.test',owner:false},
 family:{email:'family@example.test',owner:false,family:true},
 expired:{email:'expired@example.test',owner:false,paidThrough:'2020-01-01'},
 disputed:{email:'disputed@example.test',owner:false,paidThrough:'2099-01-01',disputeHold:true},
 pro:{email:'pro@example.test',owner:false,paidThrough:'2099-01-01'},
 owner:{email:'owner@example.test',owner:true},
};
function isPro(u){
 if(!u)return false;
 if(u.owner)return true;
 if(u.disputeHold)return false;
 return !!u.paidThrough&&/^\d{4}-\d{2}-\d{2}$/.test(u.paidThrough)&&u.paidThrough>=new Date().toISOString().slice(0,10);
}
async function reportFor(me){
 let reads=0,charges=0;
 const ctx=vm.createContext({Request,Response,URL,Date});
 const auth=new vm.SyntheticModule(['userFromCookie','isPro'],function(){
  this.setExport('userFromCookie',async()=>me);
  this.setExport('isPro',isPro);
 },{context:ctx});
 const limit=new vm.SyntheticModule(['hit'],function(){
  this.setExport('hit',async()=>{charges++;return {ok:true};});
 },{context:ctx});
 const privateRoll=new vm.SyntheticModule(['get'],function(){this.setExport('get',()=>null);},{context:ctx});
 const report=new vm.SyntheticModule(['build','toCsv'],function(){
  this.setExport('build',()=>({ok:true}));
  this.setExport('toCsv',()=> 'ok');
 },{context:ctx});
 const screen=new vm.SyntheticModule(['loadLiens','FILES'],function(){
  this.setExport('loadLiens',()=>{reads++;return [{parcel:'01002263'}];});
  this.setExport('FILES',{Wayne:'MI-wayne.json'});
 },{context:ctx});
 const ask=new vm.SyntheticModule(['_loadData'],function(){this.setExport('_loadData',()=>({STATES:[]}));},{context:ctx});
 const ai=new vm.SyntheticModule(['COUNTY_STATE'],function(){this.setExport('COUNTY_STATE',{Wayne:'MI'});},{context:ctx});
 const mod=new vm.SourceTextModule(fs.readFileSync('netlify/functions/aireport.mjs','utf8'),{context:ctx});
 await mod.link(s=>s.includes('/auth.mjs')?auth:s.includes('/ratelimit.mjs')?limit:
  s.includes('/privateroll.mjs')?privateRoll:s.includes('/aireport.mjs')?report:
  s.includes('/screen.mjs')?screen:s.includes('/ask.mjs')?ask:ai);
 await mod.evaluate();
 return {run:mod.namespace.default,reads:()=>reads,charges:()=>charges};
}
for(const [role,me] of Object.entries(roles)){
 test('research report access: '+role,async()=>{
  const h=await reportFor(me);
  const r=await h.run(new Request('https://preview.test/.netlify/functions/aireport?county=Wayne&parcel=01002263'));
  const permitted=role==='pro'||role==='owner';
  assert.equal(r.status,permitted?200:role==='anonymous'?401:402);
  assert.equal(h.reads(),permitted?1:0);
  assert.equal(h.charges(),permitted?1:0);
 });
}
test('report and primary AI routes share strict Pro requirement',()=>{
 const report=fs.readFileSync('netlify/functions/aireport.mjs','utf8');
 const ai=fs.readFileSync('netlify/functions/ai.mjs','utf8');
 assert.match(report,/if \(!auth\.isPro\(me\)\) return json\(402/);
 assert.doesNotMatch(report,/auth\.isPaid\(me\)/);
 assert.match(ai,/if \(!auth\.isPro\(me\)\) return json\(402/);
});
