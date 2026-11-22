import * as audit from '../../netlify/lib/brain-reconciliation-audit.mjs';
import * as documentPlans from '../../netlify/lib/brain-reconciliation-document-plans.mjs';
import { randomUUID } from 'node:crypto';
import * as sourceAdapters from '../../netlify/lib/brain-reconciliation-source-adapters.mjs';
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
 let owner=false,writes=0,manualRuns=0,sourceRuns=0,completed=false;
 const auth=synthetic({withBrainStore:h=>h,isBrainPreview:()=>true,userFromCookie:async()=>owner?{owner:true}:null,
  kvGetVersioned:async()=>completed?{data:{...newResearchState(),paused:false,planningTest:{completedAt:'2026-11-22T00:00:00Z'}}}:null,kvPutVersioned:async key=>{assert.equal(key,researchKey);writes++;return 'v';}});
 const code=await fs.readFile('netlify/functions/owner-brain-reconciliation-research.mjs','utf8');
 const mod=new vm.SourceTextModule(code,{context});
 const researchModule=synthetic({...research,runParcelResearch:async args=>{
  assert.deepEqual({...args.expected},{id:'assessor',used:0});
  sourceRuns++;
  return {status:'metadata'};
 }});
 const planningModule=synthetic({...planning,runOnePlanningTest:async({confirmed,environment})=>{
  assert.equal(confirmed,true);assert.equal(environment,'deploy-preview');manualRuns++;return {status:'completed',outcome:'document'};
 }});
 const adaptersModule=synthetic(sourceAdapters),cryptoModule=synthetic({randomUUID});
 const auditModule=synthetic(audit),plansModule=synthetic(documentPlans);
 await mod.link(path=>path==='node:crypto'?cryptoModule:path.includes('audit')?auditModule:path.includes('document-plans')?plansModule:path.includes('source-adapters')?adaptersModule:
  path.includes('brain-auth')?auth:path.includes('planning-test')?planningModule:researchModule);await mod.evaluate();
 const origin='https://deploy-preview-454--pricepocketasset.netlify.app';
 const invoke=(method='GET',action='resume',deploy='deploy-preview',from=origin,confirmed=true)=>
  mod.namespace.default(new Request(origin+'/research',{method,headers:{origin:from},
   ...(method==='POST'?{body:JSON.stringify({confirmed,action,sourceId:'assessor',used:0})}:{})}),{deploy:{context:deploy}});
 assert.equal((await invoke()).status,401);
 owner=true;
 const readback=await (await invoke()).json();
 assert.equal(readback.audit.length,4);
 assert.equal(readback.documentPlans.every(plan=>!plan.executionEnabled),true);
 assert.equal((await invoke('POST','run-document-search')).status,400);
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
 const next='run-next-source';
 assert.equal((await invoke('POST',next)).status,409);
 assert.equal(sourceRuns,0);
 completed=true;
 assert.equal((await invoke('POST',next,'deploy-preview',origin,false)).status,400);
 assert.equal((await invoke('POST',next)).status,200);
 assert.equal(sourceRuns,1);
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


test('public county adapters extract only source metadata and do not follow portals',async()=>{
 const {collectSourceMetadata,sourceDescriptors}=sourceAdapters;
 assert.deepEqual(sourceDescriptors.map(s=>s.id),['assessor','treasurer','recorder','planning','gis']);
 for(const [index,title] of ['Free Property Search','Tax Lien Sale','Easy Access'].entries()){
  const source=larimerSources[index];
  const result=await collectSourceMetadata(source,pilot,{fetcher:async(url,options)=>{
   assert.equal(url,source.url);assert.equal(options.redirect,'manual');assert.equal(options.credentials,'omit');
   return page('<h1>'+title+'</h1><script>secret</script>');
  }});
  assert.equal(result.status,'metadata');
  assert.equal(result.metadata.imageAccess,source.id==='recorder'?'authorized_access_required':'not_checked');
  assert.doesNotMatch(JSON.stringify(result),/secret/);
 }
 await assert.rejects(collectSourceMetadata({id:'recorder',url:'https://example.test'},pilot,{fetcher:async()=>assert.fail('dispatched')}),/not approved/);
 assert.equal((await collectSourceMetadata(larimerSources[2],pilot,{fetcher:async()=>new Response(null,{status:302})})).status,'restricted');
});

test('owner confirmation is bound to the next source and its reservation count',async()=>{
 let state={etag:'1',data:{...newResearchState(),paused:false}},calls=0;
 const storage={read:async()=>structuredClone(state),write:async(key,data,etag)=>{
  assert.equal(key,researchKey);
  if(state.etag!==etag)return null;
  const next=String(Number(etag)+1);state={etag:next,data};return next;
 }};
 const params={environment:'deploy-preview',enabled:true,key:researchKey,record:pilot,sources:larimerSources,storage,
  expected:{id:'assessor',used:0},collect:async()=>{calls++;return {status:'metadata',httpStatus:200,metadata:{title:'Free Property Search'}};}};
 assert.equal((await runParcelResearch(params)).status,'metadata');
 assert.equal((await runParcelResearch(params)).status,'stale');
 assert.equal(calls,1);
 assert.equal(state.data.events[0].outcome,'started');
 assert.equal(state.data.events[1].outcome,'metadata');
 assert.equal(state.data.events[1].httpStatus,200);
 assert.equal(state.data.reservations.assessor,1);
 assert.equal(state.data.reservations.recorder,undefined);
 assert.equal(summarizeResearch(pilot,state.data.evidence,state.data.lastAttempt).status,'Unresolved');
});

test('County Connectors layout uses compact metrics, sticky navigation and collapsible sections',async()=>{
 const [html,css,js]=await Promise.all(['index.html','dashboard.css','dashboard.js'].map(f=>fs.readFile('kinvest-liens/owner/brain/connectors/'+f,'utf8')));
 assert.match(html,/width=device-width/);
 assert.match(css,/position:sticky/);
 assert.match(css,/min-height:44px/);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(css,/overflow-wrap:anywhere/);
 assert.match(css,/auto-fit,minmax/);
 assert.match(js,/createElement\('details'\)/);
 assert.match(js,/GIS verification/);
 assert.match(js,/Research activity/);
});

test('saved research document cannot shadow the browser DOM in the evidence loop',async()=>{
 const js=await fs.readFile('kinvest-liens/owner/brain/connectors/dashboard.js','utf8');
 const loop=js.slice(js.indexOf('for(const entry of data.evidence'),js.indexOf('const savedSection='));
 assert.match(loop,/const recordDocument=entry\.document/);
 assert.doesNotMatch(loop,/\b(?:const|let|var)\s+document\b/);
 assert.match(loop,/document\.createElement\('li'\)/);
 assert.match(loop,/recordDocument\.reference/);
});


test('audit keeps reservations, upstream results, and parcel evidence distinct',()=>{
 const at='2026-11-22T03:49:36Z';
 const sources=[planning.planningSource,...sourceAdapters.sourceDescriptors];
 const state={
  cursor:3,planningTest:{reservedAt:at,completedAt:at},reservations:{assessor:2,treasurer:1,recorder:1},
  evidence:[
   {sourceId:'fort_collins_planning',at,outcome:'document',httpStatus:200,url:planning.planningSource.url,document:{type:'planning_record',reference:'BDR240012'}},
   {sourceId:'treasurer',at,outcome:'metadata',httpStatus:200,url:larimerSources[1].url,metadata:{title:'Public access'}}
  ],
  events:[
   {id:'r-start',sourceId:'recorder',outcome:'started',at},
   {id:'a-result',sourceId:'assessor',outcome:'unavailable',at,httpStatus:null},
   {id:'t-result',sourceId:'treasurer',outcome:'metadata',at,httpStatus:200},
   {id:'t-result',sourceId:'treasurer',outcome:'metadata',at,httpStatus:200}
 ]};
 const [city,assessor,treasurer,recorder]=audit.auditResearchSources(state,sources);
 assert.equal(city.receipts[0].dataType,'planning_record');
 assert.match(city.receipts[0].usefulness,/no parcel history/);
 assert.equal(assessor.reserved,2);
 assert.equal(assessor.completed,1);
 assert.equal(assessor.upstreamResponses,0);
 assert.equal(treasurer.completed,1);
 assert.equal(treasurer.receipts[0].dataType,'public_access_metadata');
 assert.equal(treasurer.remaining,1);
 assert.equal(recorder.lastReservedAt,at);
 assert.equal(recorder.completed,0);
 assert.equal(recorder.upstreamResponses,0);
});

test('document plans validate county identifiers and never authorize execution',()=>{
 const all=documentPlans.larimerDocumentPlans();
 assert.equal(new Set(all.map(p=>p.id)).size,all.length);
 assert.ok(all.every(p=>p.approvalRequired&&!p.executionEnabled&&!p.publicationAllowed));
 assert.equal(documentPlans.prepareDocumentSearch('assessor','parcel','97014-00-014').term,'9701400014');
 assert.equal(documentPlans.prepareDocumentSearch('assessor','schedule','0155675').term,'0155675');
 assert.throws(()=>documentPlans.prepareDocumentSearch('assessor','parcel',"9701400014' OR 1=1"),/ten-digit/);
 assert.throws(()=>documentPlans.prepareDocumentSearch('recorder','parcel','9701400014'),/unavailable/);
 assert.throws(()=>documentPlans.prepareDocumentSearch('https://evil.example','address','741 Lindenmeier Rd'),/unavailable/);
 assert.match(all.find(p=>p.source==='recorder').restriction,/Authorized access/);
});


test('record evidence accepts exact official provenance and rejects mismatches',()=>{
 const p=documentPlans.prepareDocumentSearch('assessor','schedule','0155675');
 const raw={outcome:'found',matchedTerm:'0155675',sourceUrl:p.url,checkedAt:'2026-11-22T03:00:00Z',
  legalIdentityApproved:true,ownerToken:'do-not-store'};
 const result=documentPlans.reviewDocumentResult(p,raw);
 assert.equal(result.classification,'research_candidate');
 assert.equal(result.publicationAllowed,false);
 assert.doesNotMatch(JSON.stringify(result),/do-not-store|legalIdentityApproved/);
 assert.throws(()=>documentPlans.reviewDocumentResult(p,{...raw,matchedTerm:'1688587'}),/does not match/);
 assert.throws(()=>documentPlans.reviewDocumentResult(p,{...raw,sourceUrl:'https://unrelated.example'}),/Unapproved/);
 assert.throws(()=>documentPlans.reviewDocumentResult(p,{...raw,sourceUrl:p.url+'?token=secret'}),/Unapproved/);
 assert.equal(documentPlans.reviewDocumentResult(p,{...raw,outcome:'restricted',matchedTerm:null}).outcome,'restricted');
});
