import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {verifyOfficial,DETROIT_GIS} from '../../netlify/lib/brain-official-verification.mjs';
const path='netlify/functions/owner-brain-agent-dry-run.mjs';
const script=fs.readFileSync(path,'utf8');
async function harness({owner=true,preview=true,match=true}={}){
 const store=new Map();
 const record={i:'MI|Wayne|01002263|',p:'01002263',a:'90 Chandler, Detroit MI 48202'};
 const ring=[[-83.074,42.374],[-83.073,42.374],[-83.073,42.375],[-83.074,42.374]];
 const feature={attributes:{parcel_number:'01002263.',address:'90 CHANDLER',object_id:279374},geometry:{rings:[ring]}};
 const verified=verifyOfficial(record,[feature]);
 store.set('brain-map-county-v1-MI-wayne',{records:{[record.i]:{p:'01002263',g:ring&&[ring],verifiedGeometry:match}}});
 store.set('owner-brain-approvals-v1',{entries:[{dataset:'MI-wayne',recordId:record.i,decision:'approved_for_staging'}]});
 store.set('brain-map-history-v1',{entries:[{dataset:'MI-wayne',recordId:record.i,action:'published'}]});
 let gets=0;
 const ctx=vm.createContext({Response,URL,URLSearchParams,AbortSignal,Buffer,console,fetch:async url=>{
  gets++;
  return Response.json(String(url).includes('/map/data/')?{recs:[record]}:{features:[feature]});
 }});
 const auth=new vm.SyntheticModule(['userFromCookie','kvGet','withBrainStore','isBrainPreview'],function(){
  this.setExport('userFromCookie',async()=>owner?{owner:true}:null);
  this.setExport('kvGet',async k=>structuredClone(store.get(k)));
  this.setExport('withBrainStore',fn=>fn);
  this.setExport('isBrainPreview',()=>preview);
 },{context:ctx});
 const verify=new vm.SyntheticModule(['verifyOfficial','DETROIT_GIS'],function(){
  this.setExport('verifyOfficial',verifyOfficial);this.setExport('DETROIT_GIS',DETROIT_GIS);
 },{context:ctx});
 const mod=new vm.SourceTextModule(script,{context:ctx});
 await mod.link(s=>s.includes('brain-auth')?auth:verify);await mod.evaluate();
 const url='https://preview.test/.netlify/functions/owner-brain-agent-dry-run';
 const req=(origin='https://preview.test')=>new Request(url,{method:'POST',headers:{origin},body:JSON.stringify({action:'test-agent',confirmed:true})});
 return {run:(origin,deploy='deploy-preview')=>mod.namespace.default(req(origin),{deploy:{context:deploy}}),store,gets:()=>gets,req};
}
test('dry run checks official GIS without modifying any saved preview state',async()=>{
 const h=await harness();const before=structuredClone([...h.store]);
 const res=await h.run(),data=await res.json();
 assert.equal(res.status,200);assert.equal(data.ready,true);assert.equal(data.passed,5);assert.equal(h.gets(),2);
 assert.deepEqual([...h.store],before);
});
test('GIS mismatch returns needs attention without writing or claiming success',async()=>{
 const h=await harness({match:false});
 const data=await (await h.run()).json();assert.equal(data.ready,false);
 assert.ok(data.checks.some(x=>x.status==='needs_review'));
});
test('preview and owner requirements reject unauthorized calls before all GIS requests',async()=>{
 const h=await harness({owner:false});
 assert.equal((await h.run()).status,401);assert.equal(h.gets(),0);
 const p=await harness({preview:false});assert.equal((await p.run()).status,404);
 const o=await harness();assert.equal((await o.run('https://malicious.test')).status,403);
 assert.equal((await o.run(undefined,'production')).status,404);
});
test('UI offers safe preview-only button without calling publish endpoint',()=>{
 const ui=fs.readFileSync('kinvest-liens/owner/brain/preview-test.js','utf8');
 assert.match(ui,/Test Agent Run \(no AI credits\)/);
 assert.match(ui,/owner-brain-agent-dry-run/);
 assert.match(script,/req\.method!=='POST'/);
 assert.doesNotMatch(script,/auth\.kvPut\(/);
});
