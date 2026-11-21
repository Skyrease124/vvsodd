import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync('netlify/functions/owner-brain-wayne-run.mjs','utf8');
const ui=fs.readFileSync('kinvest-liens/owner/brain/preview-test.js','utf8');

async function setup({paused=false,failedGIS=false,owner=true,preview=true,existing=false,cursor=0}={}){
 const store=new Map();
 if(existing)store.set('brain-map-county-v1-MI-wayne',{records:{r1:{verifiedGeometry:true},r2:{verifiedGeometry:true},r3:{verifiedGeometry:true}}});
 if(cursor)store.set('owner-brain-wayne-worker-v1',{cursor,day:new Date().toISOString().slice(0,10),dailyUsed:0,runs:2,verified:3,published:3,needsReview:0,failures:0,recent:[]});
 if(paused)store.set('owner-brain-scanner-v1',{status:'paused'});
 const rows=[{i:'r1',p:'01002754',a:'100 Test St, Detroit MI'},{i:'r2',p:'01002830',a:'102 Test St, Detroit MI'},
 {i:'r3',p:'01003357',a:'104 Test St, Detroit MI'},{i:'r4',p:'01004444',a:'106 Test St, Detroit MI'}];
 let calls=0,publications=0;
 const context=vm.createContext({Response,Request,URL,URLSearchParams,AbortSignal,Buffer,Date,console,crypto:undefined,
 fetch:async u=>{
  const url=new URL(u);if(url.hostname==='pricepocketasset.com')return Response.json({recs:rows});
  calls++;if(failedGIS)throw Error('Simulated provider outage');
  const id=(url.searchParams.get('where').match(/010[0-9]{5}/)||[])[0];
  return Response.json({features:[{attributes:{parcel_number:id+'.',address:'100 TEST ST',object_id:100},geometry:{rings:[[[-83.1,42.3],[-83.099,42.3],[-83.099,42.301],[-83.1,42.3]]]}}]});
 }});
 const auth=new vm.SyntheticModule(['userFromCookie','kvGet','kvPut','withBrainStore','isBrainPreview'],function(){
  this.setExport('userFromCookie',async()=>owner?{owner:true}:null);
  this.setExport('kvGet',async k=>structuredClone(store.get(k)));
  this.setExport('kvPut',async(k,v)=>store.set(k,structuredClone(v)));
  this.setExport('withBrainStore',fn=>fn);
  this.setExport('isBrainPreview',()=>preview);
 },{context});
 const verify=new vm.SyntheticModule(['verifyOfficial','DETROIT_GIS'],function(){
  this.setExport('DETROIT_GIS','https://services2.arcgis.com/example/FeatureServer/0');
  this.setExport('verifyOfficial',(r,features)=>{
   if(!features.length||r.p!=='01002754')throw Error('No exact verified feature');
   return {officialObjectId:100,evidenceUrl:'https://services2.arcgis.com/example',notes:'Verified',checks:[],
    cx:[-83.0995,42.3005]};
  });
 },{context});
 const publisher=new vm.SyntheticModule(['default'],function(){
  this.setExport('default',async()=>{
   publications++;
   const approvals=store.get('owner-brain-approvals-v1')?.entries||[];
   const map=store.get('brain-map-county-v1-MI-wayne')||{records:{}};
   for(const x of approvals)map.records[x.recordId]={verifiedGeometry:true};
   store.set('brain-map-county-v1-MI-wayne',map);
  });
 },{context});
 const cryptoModule=new vm.SyntheticModule(['default'],function(){
  this.setExport('default',{randomUUID:()=>String('fixed-run'),createHash:()=>({update:()=>({digest:()=>String('a').repeat(32)})})});
 },{context});
 const module=new vm.SourceTextModule(code,{context});
 await module.link(s=>s.includes('brain-auth')?auth:s.includes('brain-official')?verify:s.includes('publish-auto')?publisher:cryptoModule);
 await module.evaluate();
 const url='https://preview.test/.netlify/functions/owner-brain-wayne-run';
 const invoke=(method='POST',origin='https://preview.test',deploy='deploy-preview')=>
  module.namespace.default(new Request(url,{method,headers:{origin},...(method==='POST'?{body:JSON.stringify({action:'run-wayne-batch',confirmed:true})}:{})}),{deploy:{context:deploy}});
 return {store,invoke,reads:()=>calls,publications:()=>publications};
}
test('preview-only owner and same-origin guards run before GIS queries',async()=>{
 const noOwner=await setup({owner:false});assert.equal((await noOwner.invoke()).status,401);assert.equal(noOwner.reads(),0);
 const noPreview=await setup({preview:false});assert.equal((await noPreview.invoke()).status,404);
 const h=await setup();assert.equal((await h.invoke('POST','https://other.example')).status,403);
 assert.equal((await h.invoke('POST',undefined,'production')).status,404);
});
test('paused worker makes no external GIS calls or map writes',async()=>{
 const h=await setup({paused:true});assert.equal((await h.invoke()).status,409);
 assert.equal(h.reads(),0);assert.equal(h.publications(),0);
});
test('one run advances completed records, saves review failures, publishes only verified',async()=>{
 const h=await setup();const data=await (await h.invoke()).json();
 assert.equal(data.attempted,3);assert.equal(data.verified,1);
 assert.equal(data.published,1);assert.equal(data.needsReview,2);
 assert.equal(data.cursor,3);assert.equal(h.publications(),1);
 const second=await (await h.invoke()).json();
 assert.equal(second.attempted,1);assert.equal(second.cursor,4);
 assert.equal(h.store.get('owner-brain-wayne-worker-v1').dailyUsed,4);
});
test('existing published polygons skip duplicate GIS requests and do not republish',async()=>{
 const h=await setup({existing:true});
 const result=await (await h.invoke()).json();
 assert.equal(result.attempted,1);
 assert.equal(result.cursor,4);
 assert.equal(result.published,0);
 assert.equal(h.reads(),1);
 assert.equal(h.store.get('brain-map-county-v1-MI-wayne').records.r1.verifiedGeometry,true);
});
test('saved cursor resumes later source row rather than reprocessing earlier parcels',async()=>{
 const h=await setup({existing:true,cursor:3});
 const result=await (await h.invoke()).json();
 assert.equal(result.attempted,1);
 assert.equal(result.cursor,4);
 assert.equal(h.reads(),1);
 assert.equal(h.store.get('owner-brain-wayne-worker-v1').runs,3);
});
test('transient GIS outage schedules backoff without skipping or publishing',async()=>{
 const h=await setup({failedGIS:true});const result=await (await h.invoke()).json();
 assert.equal(result.state,'retry_wait');assert.equal(result.cursor,0);
 assert.equal(result.failures,1);assert.equal(h.publications(),0);
 assert.equal(result.retry.attempts,1);
 assert.ok(Date.parse(result.retry.nextAt)>Date.now());
 assert.equal(h.store.get('owner-brain-wayne-worker-v1').dailyUsed,1);
 const held=await (await h.invoke()).json();
 assert.equal(held.state,'retry_wait');assert.equal(held.attempted,0);
 assert.equal(held.cursor,0);assert.equal(h.reads(),1);
 assert.equal(h.store.get('owner-brain-wayne-worker-v1').dailyUsed,1);
});
test('backoff retries three times with quota accounting and then stops for review',async()=>{
 const h=await setup({failedGIS:true});
 await h.invoke();
 for(let attempt=2;attempt<=3;attempt++){
  const saved=h.store.get('owner-brain-wayne-worker-v1');
  saved.retry.nextAt=new Date(Date.now()-1000).toISOString();
  h.store.set('owner-brain-wayne-worker-v1',saved);
  const data=await (await h.invoke()).json();
  assert.equal(data.retry.attempts,attempt);
  assert.equal(data.cursor,0);
 }
 const terminal=h.store.get('owner-brain-wayne-worker-v1');
 assert.equal(terminal.retry.exhausted,true);
 assert.equal(terminal.dailyUsed,3);
 assert.equal(terminal.state,'provider_error');
 assert.equal((await h.invoke()).status,409);
 assert.equal(h.reads(),3);assert.equal(h.publications(),0);
});
test('owner UI explicitly exposes next bounded preview run',()=>{
 assert.match(ui,/Run next Wayne batch \(up to 3\)/);
 assert.match(ui,/owner-brain-wayne-run/);
 assert.match(code,/MAX_PER_DAY=30/);
 assert.match(code,/controlNow\?\.status==='paused'/);
 assert.match(code,/await publish\(req,context\)/);
});
