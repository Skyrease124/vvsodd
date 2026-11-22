import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs/promises';
import { connectorFor, connectorReadiness, connectorCoverage, verifyTrial } from '../../netlify/lib/brain-gis-connectors.mjs';
import { runConnectorTrial } from '../../netlify/lib/brain-gis-trial-checkpoint.mjs';

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
 await assert.rejects(verify(layer([])),/ambiguous/);
 await assert.rejects(verify(layer([feature,feature])),/ambiguous/);
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
  '../lib/brain-gis-connectors.mjs':synthetic({connectorFor,connectorReadiness,connectorCoverage})
 };
 await handler.link(s=>modules[s]);await handler.evaluate();
 const request=(method='GET')=>handler.namespace.default(new Request('https://preview.test/api?dataset=CO-larimer',{method}));
 assert.equal((await request()).status,401);
 user={owner:false};assert.equal((await request()).status,403);
 user={owner:true};assert.equal((await request('POST')).status,405);
 const response=await request();assert.equal(response.status,200);
 assert.equal((await response.json()).county.automationEnabled,false);
});
