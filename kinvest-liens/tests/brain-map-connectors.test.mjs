import { reconciliationCase, reconciliationQueue } from '../../netlify/lib/brain-parcel-reconciliation.mjs';
import { canDiagnoseLarimer, lookupLarimerAddress, larimerReconciliation } from '../../netlify/lib/brain-larimer-address-diagnostic.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs/promises';
import { connectorFor, connectorReadiness, connectorCoverage, verifyTrial } from '../../netlify/lib/brain-gis-connectors.mjs';
import { runConnectorTrial, rearmConnectorTrial } from '../../netlify/lib/brain-gis-trial-checkpoint.mjs';

const dataset='CO-larimer';
const record={i:'CO|Larimer|9701400014|',p:'9701400014',a:'741 Lindenmeier Rd, Fort Collins, CO 80524'};
const ring=[[-105.07,40.60],[-105.069,40.60],[-105.069,40.601],[-105.07,40.601],[-105.07,40.60]];
const feature={attributes:{PARCELNUM:record.p,LOCADDRESS:'741 LINDENMEIER ROAD',OBJECTID_1:10},geometry:{rings:[ring]}};
const layer=(features=[feature],wkid=4326)=>Response.json({spatialReference:{wkid},features});
const verify=(reply=layer(),row=record)=>verifyTrial({dataset,record:row,reserve:async()=>{},fetcher:async()=>reply});

test('registered pilot is disabled and records exact, scoped evidence only',async()=>{
 assert.equal(connectorFor(dataset).enabled,false);
 assert.equal(connectorReadiness({id:dataset}).status,'Connector Ready');
 assert.equal(connectorReadiness({id:'XX-unknown'}).status,'Unsupported');
 const proof=await verify();
 assert.equal(proof.objectId,10);
 assert.equal(proof.recordId,record.i);
 assert.equal(proof.geometry.acres>0,true);
 assert.equal(proof.verifiedGeometry,undefined);
});
test('trials reject wrong county, missing IDs, ambiguous responses, and bad evidence',async()=>{
 await assert.rejects(verify(layer(),{...record,i:'CO|Boulder|9701400014|'}),/Wrong county/);
 await assert.rejects(verify(layer(),{...record,p:''}),/invalid parcel ID/);
 await assert.rejects(verify(layer([])),/No official parcel/);
 await assert.rejects(verify(layer([feature,feature])),/Multiple official parcels/);
 await assert.rejects(verify(layer([feature],2876)),/coordinate/);
 await assert.rejects(verify(layer([{...feature,geometry:{rings:[ring.slice(0,4)]}}])),/Open polygon/);
 await assert.rejects(verify(layer([{...feature,attributes:{...feature.attributes,LOCADDRESS:'742 LINDENMEIER RD'}}])),/address mismatch/);
});
test('provider throttling and outage are retryable, with reservation before dispatch',async()=>{
 let reserved=0;
 for(const reply of [429,503,null]){
  await assert.rejects(verifyTrial({dataset,record,reserve:async()=>{reserved++;},fetcher:async()=>{
   assert.ok(reserved);if(reply===null)throw Error('offline');return new Response(null,{status:reply});
  }}),{retryable:true});
 }
 assert.equal(reserved,3);
});
test('correction completion excludes base-mapped, mismatched, duplicate and orphan evidence',()=>{
 const b={i:'b',p:'2'},c={i:'c',p:'3',cx:[-105,40]},d={i:'d',p:'4'};
 const result=connectorCoverage([record,b,c,d,d],{records:{
  [record.i]:{...record,g:[ring],verifiedGeometry:true},b:{i:'b',p:'999',g:[ring],verifiedGeometry:true},
  d:{...d,g:[ring],verifiedGeometry:true},x:{i:'x',p:'5',g:[ring],verifiedGeometry:true}
 }});
 assert.deepEqual(result,{available:4,mapped:1,verified:1,remaining:2,completion:100/3});
});
test('trial lease serializes concurrent starts and retains source position on failure',async()=>{
 const map=new Map();let v=0,calls=0,t=0;
 const storage={read:async k=>structuredClone(map.get(k)??null),write:async(k,data,etag)=>{
  if((map.get(k)?.etag??null)!==etag)return null;
  const next=String(++v);map.set(k,{etag:next,data});return next;
 }};
 const params={environment:'deploy-preview',dataset,revision:'fixture-v1',records:[record],storage,
  reserve:async()=>{},now:()=>new Date(t),fetcher:async()=>{calls++;return new Response(null,{status:429});}};
 const results=await Promise.all([runConnectorTrial(params),runConnectorTrial(params)]);
 assert.deepEqual(results.map(r=>r.status).sort(),['busy','retry_hold']);
 assert.equal(calls,1);
 assert.equal((await runConnectorTrial(params)).cursor,0);
 t=61000;
 const success=await runConnectorTrial({...params,fetcher:async()=>layer()});
 assert.equal(success.cursor,1);
 assert.equal((await runConnectorTrial(params)).status,'complete');
 assert.equal(map.size,1);
 await assert.rejects(runConnectorTrial({...params,environment:'production'}),/Preview trial only/);
 await assert.rejects(runConnectorTrial({...params,revision:'fixture-v2'}),/Source revision changed/);
});
test('deployed dashboard enforces owner reads and never writes or probes GIS',async()=>{
 const context=vm.createContext({Response,URL,process});
 const synthetic=exports=>new vm.SyntheticModule(Object.keys(exports),function(){
  for(const [key,val] of Object.entries(exports))this.setExport(key,val);
 },{context});
 let user=null;
 const source=await fs.readFile('netlify/functions/owner-brain-connectors.mjs','utf8');
 const handler=new vm.SourceTextModule(source,{context});
 const modules={
  'node:fs/promises':synthetic({readFile:fs.readFile}),
  'node:path':synthetic({join:(await import('node:path')).join}),
  '../lib/brain-auth.mjs':synthetic({withBrainStore:h=>h,isBrainPreview:()=>true,userFromCookie:async()=>user,kvGet:async()=>null}),
  '../lib/brain-gis-connectors.mjs':synthetic({connectorFor,connectorReadiness,connectorCoverage}),
  '../lib/brain-gis-universal.mjs':synthetic(await import('../../netlify/lib/brain-gis-universal.mjs')),
  '../lib/brain-gis-county-worker.mjs':synthetic(await import('../../netlify/lib/brain-gis-county-worker.mjs')),
  '../lib/brain-gis-florida-registry.mjs':synthetic(await import('../../netlify/lib/brain-gis-florida-registry.mjs')),
  '../lib/brain-gis-pilot-registry.mjs':synthetic(await import('../../netlify/lib/brain-gis-pilot-registry.mjs'))
 };
 await handler.link(s=>modules[s]);await handler.evaluate();
 const request=(method='GET')=>handler.namespace.default(new Request('https://preview.test/api?dataset=CO-larimer',{method}));
 assert.equal((await request()).status,401);
 user={owner:false};assert.equal((await request()).status,403);
 user={owner:true};assert.equal((await request('POST')).status,405);
 const response=await request();assert.equal(response.status,200);
 const data=await response.json();
 assert.equal(data.county.automationEnabled,false);
 assert.equal(data.operation.mode,'research-only');
 const broward=await handler.namespace.default(new Request('https://preview.test/api?dataset=FL-broward'));
 assert.equal(broward.status,200);
 const planned=await broward.json();
 assert.equal(planned.county.automationEnabled,false);
 assert.equal(planned.coverage.available,0);
 assert.equal(planned.operation.mode,'pilot-prepared');
 assert.equal(planned.county.status,'Awaiting eligible parcel data');
 const list=await (await handler.namespace.default(new Request('https://preview.test/api'))).json();
 assert.equal(list.counties.filter(row=>row.state==='FL').length,67);
});

test('Larimer trial gates owner, origin and deployment and caps preview reservations at three',async()=>{
 const {join}=await import('node:path');
 const {createHash}=await import('node:crypto');
 const context=vm.createContext({Response,URL,process});
 const synthetic=exports=>new vm.SyntheticModule(Object.keys(exports),function(){
  for(const [key,val] of Object.entries(exports))this.setExport(key,val);
 },{context});
 const budgetKey='brain-gis-trial-budget-v1-CO-larimer';
 const trialKey='brain-gis-trial-v1-CO-larimer';
 const writes=new Map();
 let user=null,reads=0,runs=0,diagnoses=0;
 const diagnosticKey='brain-gis-address-diagnostic-v1-CO-larimer';
 const storage={
  kvGetVersioned:async key=>{reads++;return writes.get(key)??null;},
  kvPutVersioned:async(key,data,etag)=>{
   assert.ok([budgetKey,diagnosticKey].includes(key));
   if((writes.get(key)?.etag??null)!==etag)return null;
   const next=String(data.reserved??'diagnostic');
   writes.set(key,{data,etag:next});
   return next;
  }
 };
 const handler=new vm.SourceTextModule(await fs.readFile('netlify/functions/owner-brain-larimer-trial.mjs','utf8'),{context});
 const modules={
  'node:fs/promises':synthetic({readFile:fs.readFile}),
  'node:path':synthetic({join}),
  'node:crypto':synthetic({createHash}),
  '../lib/brain-auth.mjs':synthetic({...storage,withBrainStore:h=>h,isBrainPreview:()=>true,userFromCookie:async()=>user,
   kvGet:async key=>{assert.equal(key,'brain-map-county-v1-CO-larimer');return null;}}),
  '../lib/brain-parcel-reconciliation.mjs':synthetic({reconciliationCase,reconciliationQueue}),
  '../lib/brain-larimer-address-diagnostic.mjs':synthetic({canDiagnoseLarimer,larimerReconciliation,lookupLarimerAddress:async()=>{
   diagnoses++;return {kind:'address_research_only',status:'research_lead'};
  }}),
  '../lib/brain-gis-trial-checkpoint.mjs':synthetic({rearmConnectorTrial:async()=>{throw Error('Unexpected review action');},runConnectorTrial:async params=>{
   assert.equal(params.environment,'deploy-preview');
   assert.equal(params.dataset,'CO-larimer');
   assert.deepEqual(Array.from(params.records,r=>r.p),['9701400014','8510310018','8510339002']);
   await params.reserve();
   runs++;
   return {status:'recorded'};
  }})
 };
 await handler.link(s=>modules[s]);await handler.evaluate();
 const origin='https://deploy-preview-454--pricepocketasset.netlify.app';
 const invoke=({method='POST',deploy='deploy-preview',host=origin,from=origin,confirmed=true,action='verify-next-larimer'}={})=>
  handler.namespace.default(new Request(host+'/trial',{method,headers:{origin:from},
   ...(method==='POST'?{body:JSON.stringify({action,confirmed})}:{})}),{deploy:{context:deploy}});
 assert.equal((await invoke()).status,401);
 user={owner:false};assert.equal((await invoke()).status,403);
 user={owner:true};
 assert.equal((await invoke({deploy:'production'})).status,404);
 assert.equal((await invoke({host:'https://deploy-preview-453--pricepocketasset.netlify.app'})).status,404);
 assert.equal((await invoke({from:'https://unrelated.example'})).status,403);
 assert.equal((await invoke({confirmed:false})).status,400);
 assert.equal(reads,0);
 assert.equal(writes.size,0);
 assert.equal((await (await invoke({method:'GET'})).json()).used,0);
 assert.equal(writes.size,0);
 for(let i=0;i<3;i++)assert.equal((await invoke()).status,200);
 assert.equal((await invoke()).status,429);
 assert.equal(runs,3);
 assert.equal(writes.get(budgetKey).data.reserved,3);
 assert.equal(writes.has(trialKey),false); // The runner's checkpoint is tested separately.
 const held={etag:'held',data:{cursor:0,retry:{recordId:record.i,exhausted:true,diagnostics:{reasonCode:'zero_results'}},evidence:[]}};
 writes.set(trialKey,held);
 writes.set(budgetKey,{etag:'two',data:{reserved:2}});
 const action='diagnose-larimer-address';
 assert.equal((await invoke({action,confirmed:false})).status,400);
 assert.equal((await invoke({action,deploy:'production'})).status,404);
 assert.equal((await invoke({action,from:'https://unrelated.example'})).status,403);
 assert.equal((await (await invoke({method:'GET'})).json()).canRunAddressDiagnostic,true);
 assert.equal(diagnoses,0);
 const results=await Promise.all([invoke({action}),invoke({action})]);
 assert.equal(results.filter(r=>r.status===200).length,1);
 assert.equal(diagnoses,1);
 assert.equal(writes.get(budgetKey).data.reserved,3);
 assert.deepEqual(writes.get(trialKey),held);
 assert.equal(writes.get(diagnosticKey).data.kind,'address_research_only');
 assert.equal((await invoke({action})).status,409);
 assert.equal(diagnoses,1);
});


test('Larimer response diagnostics separate four lookup outcomes and drop unapproved data',async()=>{
 const sensitive='session=secret-value';
 const badFeature={...feature,attributes:{PARCELNUM:sensitive,LOCADDRESS:sensitive,token:sensitive}};
 const cases=[
  [{features:[]},'zero_results',0,[],false],
  [{features:[feature,badFeature]},'multiple_matches',2,[record.p],false],
  [{note:sensitive},'missing_feature_array',null,[],false],
  [{features:[feature],exceededTransferLimit:true},'transfer_limit',1,[record.p],true]
 ];
 for(const [body,reasonCode,resultCount,returnedParcelIds,transferLimit] of cases){
  await assert.rejects(verify(Response.json(body,{headers:{'X-Session':sensitive}})),error=>{
   assert.equal(error.retryable,false);
   const {checkedAt,...fields}=error.diagnostics;
   assert.ok(Number.isFinite(Date.parse(checkedAt)));
   assert.deepEqual(fields,{stage:'match_count',reasonCode,httpStatus:200,arcgisStatus:null,
    resultCount,returnedParcelIds,transferLimit});
   assert.ok(!JSON.stringify(error).includes(sensitive));
   return true;
  });
 }
});

test('trial persists diagnostics without advancing or re-running a held parcel',async()=>{
 let saved=null,epoch=0,reserved=0;
 const storage={read:async()=>structuredClone(saved),write:async(key,data,etag)=>{
  assert.equal(key,'brain-gis-trial-v1-CO-larimer');
  if((saved?.etag??null)!==etag)return null;
  const next=String(++epoch);saved={data,etag:next};return next;
 }};
 const args={environment:'deploy-preview',dataset,revision:'review-fixture',records:[record],storage,
  reserve:async()=>{reserved++;},fetcher:async()=>layer([])};
 const result=await runConnectorTrial(args);
 assert.equal(result.cursor,0);
 assert.equal(saved.data.retry.exhausted,true);
 assert.equal(saved.data.retry.diagnostics.reasonCode,'zero_results');
 assert.equal(saved.data.evidence.length,0);
 assert.equal((await runConnectorTrial(args)).status,'retry_hold');
 assert.equal(reserved,1);
});

test('exact owner-approved Larimer re-arm preserves cursor, evidence and budget while rejecting stale review',async()=>{
  let writes=0,revision='review-fixture',budget=1;
  let snapshot={etag:'v1',data:{revision,cursor:0,lockUntil:null,evidence:[],
    retry:{recordId:record.i,exhausted:true,attempts:1,reason:'Missing or ambiguous parcel match',
      diagnostics:null}}};
  const storage={
    read:async()=>structuredClone(snapshot),
    write:async(key,value,etag)=>{
      assert.equal(key,'brain-gis-trial-v1-CO-larimer');
      if(snapshot.etag!==etag)return null;
      writes++;snapshot={etag:'v'+(writes+1),data:structuredClone(value)};
      return snapshot.etag;
    }
  };
  const args={environment:'deploy-preview',dataset,revision,recordId:record.i,storage};
  await assert.rejects(rearmConnectorTrial({...args,recordId:'CO|Larimer|DIFFERENT|'}),/Exact exhausted/);
  await assert.rejects(rearmConnectorTrial({...args,revision:'other'}),/source changed/);
  await assert.rejects(rearmConnectorTrial({...args,environment:'production'}),/Preview trial/);
  assert.equal(writes,0);
  const result=await rearmConnectorTrial(args);
  assert.equal(result.rearmed,true);
  assert.equal(result.cursor,0);
  assert.equal(result.previousAttemptCount,1);
  assert.equal(snapshot.data.cursor,0);
  assert.equal(snapshot.data.retry,null);
  assert.equal(snapshot.data.lastOwnerRecovery.recordId,record.i);
  assert.equal(budget,1);
  assert.equal(writes,1);
  await assert.rejects(rearmConnectorTrial(args),/Exact exhausted/);
  assert.equal(writes,1);
});

test('Larimer re-arm uses two separate owner confirmations and never dispatches GIS during checkpoint release',async()=>{
 const endpoint=await fs.readFile('netlify/functions/owner-brain-larimer-trial.mjs','utf8');
 const frontend=await fs.readFile('kinvest-liens/owner/brain/connectors/dashboard.js','utf8');
 assert.match(endpoint,/rearm-larimer-review/);
 assert.match(endpoint,/body\.recordId!==records\[cursor\]\.i/);
 assert.match(endpoint,/snapshot\?\.data\?\.retry\?\.exhausted!==true/);
 assert.match(endpoint,/rearmConnectorTrial\(\{environment:/);
 assert.match(frontend,/Approve retry of same Larimer parcel/);
 assert.match(frontend,/does NOT send a GIS request now/);
 assert.match(frontend,/action:'rearm-larimer-review',confirmed:true/);
 assert.match(frontend,/action:'verify-next-larimer',confirmed:true/);
});


test('address diagnostic sends a fixed two-row attributes-only query and records research leads',async()=>{
 const attrs={PARCELNUM:'1234567890',SCHEDNUM:'0155675',LOCADDRESS:'741 LINDENMEIER RD',LOCCITY:'FORT COLLINS',
  OBJECTID_1:42,NAME:'private-name',TOKEN:'session-token'};
 let calls=0;
 const result=await lookupLarimerAddress({fetcher:async(url,options)=>{
  calls++;
  const query=new URL(url);
  assert.equal(query.origin,'https://maps1.larimer.org');
  assert.equal(query.pathname,'/arcgis/rest/services/MapServices/Parcels/MapServer/3/query');
  assert.equal(query.searchParams.get('where'),"LOCADDRESS = '741 LINDENMEIER RD' AND LOCCITY = 'FORT COLLINS'");
  assert.equal(query.searchParams.get('outFields'),'PARCELNUM,SCHEDNUM,LOCADDRESS,LOCCITY,OBJECTID_1');
  assert.equal(query.searchParams.get('returnGeometry'),'false');
  assert.equal(query.searchParams.get('resultRecordCount'),'2');
  assert.equal(options.redirect,'error');
  return Response.json({features:[{attributes:attrs,geometry:{secret:'discard'}}]});
 }});
 assert.equal(calls,1);
 assert.equal(result.status,'research_lead');
 assert.equal(result.kind,'address_research_only');
 assert.deepEqual(result.rows,[{parcelId:'1234567890',schedule:'0155675',address:'741 LINDENMEIER RD',city:'FORT COLLINS',objectId:42}]);
 assert.doesNotMatch(JSON.stringify(result),/private-name|session-token|geometry|verifiedGeometry/);
 for(const [body,status] of [
  [{features:[]},'no_results'],
  [{features:[{attributes:attrs},{attributes:attrs}]},'ambiguous'],
  [{features:[{attributes:attrs}],exceededTransferLimit:true},'incomplete'],
  [{features:[{attributes:{...attrs,LOCADDRESS:'742 LINDENMEIER RD'}}]},'address_mismatch']
 ]){
  const check=await lookupLarimerAddress({fetcher:async()=>Response.json(body)});
  assert.equal(check.status,status);
  assert.equal(check.kind,'address_research_only');
 }
});


test('subdivision evidence and a saved address match leave the parcel identifiers unresolved',()=>{
 const diagnostic={kind:'address_research_only',recordId:record.i,status:'research_lead',resultCount:1,
  transferLimit:false,source:connectorFor(dataset).source,checkedAt:'2026-11-22T02:00:00Z',
  rows:[{parcelId:'9701484001',schedule:'1688587',objectId:5665923,address:'741 LINDENMEIER RD',city:'FORT COLLINS'}]};
 const before=structuredClone(diagnostic);
 const result=larimerReconciliation(diagnostic);
 assert.equal(result.status,'unresolved');
 assert.deepEqual(result.original,{parcelId:'9701400014',schedule:'0155675'});
 assert.deepEqual(result.candidate,{parcelId:'9701484001',schedule:'1688587',objectId:5665923});
 assert.equal(result.sources.at(-1).date,diagnostic.checkedAt);
 assert.match(result.sources[1].finding,/BDR240012/);
 assert.match(result.sources[1].finding,/136 feet west, 43 north/);
 assert.equal(result.sources[2].url,'https://www.larimer.gov/clerk/recording/easy-access');
 assert.equal(result.sources[3].url,'https://www.larimer.gov/assessor/search');
 assert.match(result.nextEvidence,/reception number/);
 assert.match(result.explanation,/whole-parcel renumbering.*a split.*different legal parcel/);
 assert.deepEqual(diagnostic,before);
 assert.equal(larimerReconciliation({...diagnostic,status:'ambiguous'}),null);
 assert.equal(larimerReconciliation({...diagnostic,transferLimit:true}),null);
 assert.equal(larimerReconciliation({...diagnostic,rows:[{...diagnostic.rows[0],parcelId:'9701400014'}]}),null);
 assert.equal(larimerReconciliation(null),null);
});

test('generic parcel reconciliation queue retains unresolved cross-county identity and blocks publication',()=>{
 const lead={
  dataset:'CO-larimer',recordId:'CO|Larimer|9701400014|',
  original:{parcelId:'9701400014',schedule:'0155675'},
  candidate:{parcelId:'9701484001',schedule:'1688587',objectId:5665923},
  checkedAt:'2026-11-22T02:05:34.546Z',
  sources:[{authority:'Larimer GIS',url:connectorFor(dataset).source,findinG:'Address-only research lead'}]
 };
 const item=reconciliationCase(lead);
 assert.equal(item.status,'unresolved_owner_review');
 assert.equal(item.publicationAllowed,false);
 assert.equal(item.identifierChangeAllowed,false);
 assert.equal(item.automationEnabled,false);
 assert.equal(item.candidate.objectId,5665923);
 assert.equal(item.missingEvidence.length,3);
 assert.deepEqual(reconciliationQueue([item,item]),[item]);
 assert.equal(reconciliationCase({...lead,recordId:'FL|Wrong|9701400014|'}),null);
 assert.equal(reconciliationCase({...lead,candidate:{parcelId:'9701400014'}}),null);
});

test('even an explicit official identifier cross reference requires separate owner legal review',()=>{
 const lead={dataset:'CO-larimer',recordId:'CO|Larimer|9701400014|',
  original:{parcelId:'9701400014',schedule:'0155675'},
  candidate:{parcelId:'9701484001',schedule:'1688587'},
  documents:[{type:'official_parcel_cross_reference',url:'https://larimer.gov/record/1',
    receptionNumber:'123',originalParcel:'9701400014',currentParcel:'9701484001',
    originalSchedule:'0155675',currentSchedule:'1688587'}]};
 const item=reconciliationCase(lead);
 assert.equal(item.status,'documented_link_pending_owner_review');
 assert.equal(item.publicationAllowed,false);
 assert.equal(item.identifierChangeAllowed,false);
 const wrong=reconciliationCase({...lead,documents:[{...lead.documents[0],currentSchedule:'wrong'}]});
 assert.equal(wrong.status,'unresolved_owner_review');
});
