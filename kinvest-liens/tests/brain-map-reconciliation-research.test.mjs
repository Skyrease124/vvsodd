import * as planning from '../../netlify/lib/brain-reconciliation-planning-test.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs/promises';
import * as research from '../../netlify/lib/brain-reconciliation-research.mjs';
const {researchKey,pilot,larimerSources,newResearchState,summarizeResearch,runParcelResearch}=research;
const pairs={originalParcel:pilot.originalParcel,originalSchedule:pilot.originalSchedule,
 candidateParcel:pilot.candidateParcel,candidateSchedule:pilot.candidateSchedule};
const plat={type:'recorded_plat',receptionNumber:'FIXTURE-PLAT',legalDescription:'Lot 1 fixture',...pairs};
const history={type:'assessor_history',reference:'FIXTURE-HISTORY',relationship:'split',...pairs};
const summary=(...docs)=>summarizeResearch(pilot,docs.map(document=>({document})),null);

test('missing, incorrect or contradictory evidence cannot support a relationship',()=>{
 assert.equal(summary().status,'Research Lead');
 assert.equal(summarizeResearch(pilot,[],{outcome:'restricted'}).status,'Unresolved');
 assert.equal(summary(plat).status,'Document Found');
 assert.equal(summary(plat,{...history,candidateSchedule:'999'}).status,'Unresolved');
 assert.equal(summary(plat,history,{...history,relationship:'successor'}).status,'Unresolved');
 const supported=summary(plat,history);
 assert.equal(supported.status,'Relationship Supported');
 assert.equal(supported.relationship,'split');
 assert.equal(supported.publicationAllowed,false);
 assert.equal(supported.ownerReview,true);
});

test('runner is gated, serializes attempts, backs off, and records actual source outcomes',async()=>{
 let value={etag:'1',data:{...newResearchState(),paused:false}},t=0,calls=0;
 const storage={read:async()=>structuredClone(value),write:async(key,data,etag)=>{
  assert.equal(key,researchKey);
  if(value.etag!==etag)return null;
  const next=String(Number(etag)+1);value={etag:next,data:structuredClone(data)};return next;
 }};
 const args={environment:'deploy-preview',key:researchKey,record:pilot,sources:larimerSources,storage,
  collect:async()=>{calls++;throw Error('offline');},now:()=>new Date(t)};
 await assert.rejects(runParcelResearch(args),/disabled/);
 await assert.rejects(runParcelResearch({...args,enabled:true,environment:'production'}),/disabled/);
 await assert.rejects(runParcelResearch({...args,enabled:true,sources:[{...larimerSources[0],url:'https://example.test'}]}),/not approved/);
 const active={...args,enabled:true};
 const competing=await Promise.all([runParcelResearch(active),runParcelResearch(active)]);
 assert.deepEqual(competing.map(x=>x.status).sort(),['busy','unavailable']);
 assert.equal(calls,1);
 assert.equal((await runParcelResearch(active)).status,'backoff');
 t=61000;
 assert.equal((await runParcelResearch(active)).status,'unavailable');
 assert.equal(value.data.evidence.length,1);
 assert.equal(value.data.events.length,2);
 assert.equal(value.data.reservations.assessor,2);
 const restricted=await runParcelResearch({...active,collect:async()=>({status:'restricted'})});
 assert.equal(restricted.status,'restricted');
 assert.equal(value.data.events.at(-1).outcome,'restricted');
 assert.equal(value.data.cursor,2);
});

test('an interrupted research reservation is retained and never fabricated as completion',async()=>{
 let t=0,calls=0,writes=0;
 let value={etag:'base',data:{...newResearchState(),paused:false}};
 const storage={read:async()=>structuredClone(value),write:async(key,data,etag)=>{
  if(value.etag!==etag)return null;
  writes++;
  if(writes===2)throw Error('checkpoint write interrupted');
  const next=String(writes);value={etag:next,data:structuredClone(data)};return next;
 }};
 const args={environment:'deploy-preview',enabled:true,key:researchKey,record:pilot,sources:larimerSources,storage,
  collect:async()=>{calls++;return {status:'missing'};},now:()=>new Date(t)};
 await assert.rejects(runParcelResearch(args),/interrupted/);
 assert.equal(value.data.events.length,0);
 assert.equal(value.data.reservations.assessor,1);
 assert.equal((await runParcelResearch(args)).status,'busy');
 t=61000;
 assert.equal((await runParcelResearch(args)).status,'missing');
 assert.equal(calls,2);
 assert.equal(value.data.events.length,1);
 assert.equal(value.data.reservations.assessor,2);
});

test('owner controls are preview-only and cannot dispatch research',async()=>{
 const context=vm.createContext({Response,URL});
 const synthetic=exports=>new vm.SyntheticModule(Object.keys(exports),function(){
  for(const [key,val] of Object.entries(exports))this.setExport(key,val);
 },{context});
 let owner=false,writes=0,manualRuns=0;
 const auth=synthetic({withBrainStore:h=>h,isBrainPreview:()=>true,userFromCookie:async()=>owner?{owner:true}:null,
  kvGetVersioned:async()=>null,kvPutVersioned:async key=>{assert.equal(key,researchKey);writes++;return 'v';}});
 const code=await fs.readFile('netlify/functions/owner-brain-reconciliation-research.mjs','utf8');
 const mod=new vm.SourceTextModule(code,{context});
 const researchModule=synthetic(research);
 const planningModule=synthetic({...planning,runOnePlanningTest:async({confirmed,environment})=>{
  assert.equal(confirmed,true);assert.equal(environment,'deploy-preview');manualRuns++;return {status:'completed',outcome:'document'};
 }});
 await mod.link(path=>path.includes('brain-auth')?auth:path.includes('planning-test')?planningModule:researchModule);await mod.evaluate();
 const origin='https://deploy-preview-454--pricepocketasset.netlify.app';
 const invoke=(method='GET',action='resume',deploy='deploy-preview',from=origin,confirmed=true)=>
  mod.namespace.default(new Request(origin+'/research',{method,headers:{origin:from},
   ...(method==='POST'?{body:JSON.stringify({confirmed,action})}:{})}),{deploy:{context:deploy}});
 assert.equal((await invoke()).status,401);
 owner=true;
 assert.equal((await invoke('POST','resume','production')).status,404);
 assert.equal((await invoke('POST','resume','deploy-preview','https://example.test')).status,403);
 assert.equal((await invoke('POST','run')).status,400);
 assert.equal(writes,0);
 const res=await invoke('POST');
 assert.equal((await res.json()).executionEnabled,false);
 assert.equal(writes,1);
 const action='run-one-planning-test';
 assert.equal((await invoke('POST',action,'production')).status,404);
 assert.equal((await invoke('POST',action,'deploy-preview','https://example.test')).status,403);
 assert.equal((await invoke('POST',action,'deploy-preview',origin,false)).status,400);
 assert.equal(manualRuns,0);
 assert.equal((await invoke('POST',action)).status,200);
 assert.equal(manualRuns,1);
});


const html='<main><h1>Project BDR240012</h1><p>Glover Estate</p><p>741 Lindenmeier RD</p>'+
 '<p>Parcel 9701400014</p><p>Decision: Approved</p><p>Decision Date: 11/13/2024</p></main>';
const page=(body=html)=>new Response(body,{headers:{'content-type':'text/html; charset=utf-8'}});
test('planning adapter extracts limited metadata and classifies missing or restricted records',async()=>{
 const result=await planning.collectPlanningRecord({fetcher:async(url,options)=>{
  assert.equal(url,planning.planningSource.url);
  assert.equal(options.redirect,'manual');
  assert.equal(options.credentials,'omit');
  return page(html+'<script>session_token=do-not-store</script>');
 }});
 assert.equal(result.document.reference,'BDR240012');
 assert.equal(result.document.decisionDate,'11/13/2024');
 assert.equal(result.document.relationship,null);
 assert.doesNotMatch(JSON.stringify(result),/do-not-store/);
 for(const [fetcher,outcome] of [
  [async()=>page('<script>'+html+'</script>'),'missing'],
  [async()=>page('<p>Sign in to view this record</p>'),'restricted'],
  [async()=>new Response(null,{status:302,headers:{location:'https://example.test/private'}}),'restricted'],
  [async()=>new Response(null,{status:404}),'missing'],
  [async()=>page('x'.repeat(513*1024)),'unavailable'],
  [async()=>{throw new DOMException('timeout','TimeoutError');},'unavailable']
 ]) assert.equal((await planning.collectPlanningRecord({fetcher})).outcome,outcome);
});

test('one-time planning test permits one dispatch and persists one genuine receipt',async()=>{
 let value={etag:'1',data:{...newResearchState(),paused:false}};
 let calls=0;
 const storage={read:async()=>structuredClone(value),write:async(key,data,expected)=>{
  assert.equal(key,researchKey);
  if(value.etag!==expected)return null;
  const etag=String(Number(expected)+1);value={etag,data};return etag;
 }};
 const args={storage,environment:'deploy-preview',confirmed:true,fetcher:async()=>{calls++;return page();}};
 await assert.rejects(planning.runOnePlanningTest({...args,confirmed:false}),/confirmed/);
 await assert.rejects(planning.runOnePlanningTest({...args,environment:'production'}),/preview/);
 assert.equal(calls,0);
 const results=await Promise.all([planning.runOnePlanningTest(args),planning.runOnePlanningTest(args)]);
 assert.deepEqual(results.map(x=>x.status).sort(),['busy','completed']);
 assert.equal((await planning.runOnePlanningTest(args)).status,'completed');
 assert.equal(calls,1);
 assert.equal(value.data.cursor,0);
 assert.equal(value.data.events.length,1);
 assert.equal(value.data.events[0].outcome,'document');
 assert.equal(summarizeResearch(pilot,value.data.evidence).status,'Document Found');
 assert.equal(summarizeResearch(pilot,value.data.evidence).publicationAllowed,false);
});

test('interrupted one-time test keeps its reservation and cannot dispatch again',async()=>{
 let value={etag:'1',data:{...newResearchState(),paused:false}},t=0,calls=0;
 const storage={read:async()=>structuredClone(value),write:async(key,data,expected)=>{
  if(expected==='2')return null;
  value={etag:'2',data};return '2';
 }};
 const args={storage,environment:'deploy-preview',confirmed:true,now:()=>new Date(t),fetcher:async()=>{calls++;return page();}};
 assert.equal((await planning.runOnePlanningTest(args)).status,'interrupted');
 assert.equal(value.data.events.length,0);
 assert.equal((await planning.runOnePlanningTest(args)).status,'running');
 t=16000;
 assert.equal((await planning.runOnePlanningTest(args)).status,'interrupted');
 assert.equal(calls,1);
});
