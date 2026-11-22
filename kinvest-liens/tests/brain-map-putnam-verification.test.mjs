import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import * as putnam from '../../netlify/lib/brain-gis-putnam.mjs';

const now=()=>Date.parse('2026-11-22T18:00:00Z');
const budgetKey='brain-gis-operations-budget-v1-2026-11-22';
const ring=[[-81.9,29.6],[-81.8998,29.6],[-81.8998,29.6002],[-81.9,29.6002],[-81.9,29.6]];
const feature={type:'Feature',properties:{PARCEL_ID:putnam.PUTNAM.parcelId,PARCELNO:'041024645000600240',CO_NO:64,
 DOR_UC:'0000',S_LEGAL:'OAK HILLS ESTATES S/D, MB4 P45 BLK F LOT 24',LND_SQFOOT:4791.6},
 geometry:{type:'Polygon',coordinates:[ring]}};
const collection=(...features)=>({type:'FeatureCollection',features});
function memory(){
 const data=new Map();
 let i=0;
 return {data,read:async k=>structuredClone(data.get(k)),write:async(k,value,etag)=>{
  if((data.get(k)?.etag??null)!==etag)return null;
  const next=String(++i);data.set(k,{data:structuredClone(value),etag:next});return next;
 }};
}
test('exact county, leading zero, vacant legal match and WGS84 area are checked independently',()=>{
 const result=putnam.validatePutnam(collection(feature));
 assert.equal(result.status,'verified');
 assert.equal(result.situs,null);
 assert.ok(Math.abs(result.sourceAcres-0.11)<1e-10);
 assert.ok(result.polygonAcres>0);
 assert.notEqual(result.polygonAcres,result.sourceAcres);
 assert.deepEqual(result.geometry,feature.geometry);
 assert.equal(result.crs,'EPSG:4326');
 for(const patch of [{CO_NO:65},{PARCEL_ID:feature.properties.PARCELNO},{PARCEL_ID:feature.properties.PARCEL_ID.slice(1)}])
  assert.equal(putnam.validatePutnam(collection({...feature,properties:{...feature.properties,...patch}})).status,'no_exact_match');
 for(const patch of [{S_LEGAL:'OAK HILLS ESTATES BLK F LOT 25'},{DOR_UC:'99'}])
  assert.equal(putnam.validatePutnam(collection({...feature,properties:{...feature.properties,...patch}})).status,'needs_review');
});
test('zero, multiple, projected, open, and overlapping shapes fail closed',()=>{
 assert.equal(putnam.validatePutnam(collection()).status,'no_exact_match');
 assert.equal(putnam.validatePutnam(collection(feature,feature)).status,'ambiguous_match');
 assert.equal(putnam.validatePutnam({...collection(feature),spatialReference:{wkid:6439}}).status,'invalid_geometry');
 for(const geometry of [{type:'Polygon',coordinates:[ring.slice(1)]},{type:'MultiPolygon',coordinates:[[ring],[ring]]}])
  assert.equal(putnam.validatePutnam(collection({...feature,geometry})).status,'invalid_geometry');
 const other=ring.map(([x,y])=>[x+0.001,y]);
 assert.equal(putnam.validatePutnam(collection({...feature,geometry:{type:'MultiPolygon',coordinates:[[ring],[other]]}})).status,'verified');
});
test('concurrent clicks and retries dispatch exactly once and save the raw private receipt',async()=>{
 const store=memory();
 let calls=0;
 const fetcher=async target=>{
  calls++;
  const url=new URL(target);
  assert.equal(url.searchParams.get('where'),"CO_NO = 64 AND PARCEL_ID = '04-10-24-6450-0060-0240'");
  assert.equal(url.searchParams.get('resultRecordCount'),'2');
  assert.equal(url.searchParams.get('outSR'),'4326');
  assert.equal(url.searchParams.get('f'),'geojson');
  assert.equal(store.data.get(budgetKey).data.total,1);
  return Response.json(collection(feature));
 };
 await Promise.all(Array.from({length:8},()=>putnam.verifyPutnamOnce(store,{now,fetcher})));
 const viewed=await putnam.verifyPutnamOnce(store,{now,fetcher});
 assert.equal(viewed.status,'verified');
 assert.equal(viewed.result.geometry,undefined);
 assert.equal(calls,1);
 assert.equal(viewed.remaining,29);
 const evidence=[...store.data].find(([k])=>k.includes('putnam-verification'))[1].data;
 assert.deepEqual(evidence.raw,collection(feature));
 assert.deepEqual(evidence.quotaReceipt,{day:'2026-11-22',total:1,county:1,reserved:1});
 assert.deepEqual((await putnam.putnamStatus(store,now,{includeGeometry:true})).result.geometry,feature.geometry);
 assert.equal(store.data.size,2,'no publication or existing checkpoint keys touched');
});
test('exhausted quotas stop dispatch and an interrupted reserved checkpoint is never replayed',async()=>{
 const store=memory();
 await store.write(budgetKey,{total:30,counties:{}},null);
 const fetcher=()=>assert.fail('Blocked request dispatched');
 assert.equal((await putnam.putnamStatus(store,now)).status,'quota_unavailable');
 await assert.rejects(putnam.verifyPutnamOnce(store,{now,fetcher}),/GIS request limit/);
 const interrupted=memory();
 const original=interrupted.write;
 interrupted.write=async (...args)=>{
  if(args[1]?.quotaReceipt)throw Error('interrupted');
  return original(...args);
 };
 await assert.rejects(putnam.verifyPutnamOnce(interrupted,{now,fetcher}),/interrupted/);
 const later=()=>now()+70000;
 assert.equal((await putnam.verifyPutnamOnce(interrupted,{now:later,fetcher})).status,'needs_review');
 assert.equal(interrupted.data.get(budgetKey).data.total,1);
});
test('timeout receipt stays charged and cannot trigger a second request',async()=>{
 const store=memory();
 let calls=0;
 const fetcher=async(_url,{signal})=>{
  assert.ok(signal instanceof AbortSignal);
  calls++;
  throw new DOMException('timed out','TimeoutError');
 };
 const result=await putnam.verifyPutnamOnce(store,{now,fetcher});
 assert.equal(result.status,'source_unavailable');
 assert.equal(result.reason,'Provider request timed out');
 assert.equal((await putnam.verifyPutnamOnce(store,{now,fetcher})).status,'source_unavailable');
 assert.equal(calls,1);
 assert.equal(store.data.get(budgetKey).data.total,1);
});
test('owner route rejects anonymous, member, cross-origin and unconfirmed requests',async()=>{
 const context=vm.createContext({URL,Response,Buffer});
 const synthetic=exports=>new vm.SyntheticModule(Object.keys(exports),function(){
  for(const [key,value] of Object.entries(exports))this.setExport(key,value);
 },{context});
 const file=new URL('../../netlify/functions/owner-brain-putnam-verification.mjs',import.meta.url);
 const route=new vm.SourceTextModule(await readFile(file,'utf8'),{context});
 await route.link(spec=>spec.endsWith('brain-auth.mjs')?synthetic({withBrainStore:fn=>fn}):synthetic(putnam));
 await route.evaluate();
 const store=memory();
 let user=null,calls=0;
 const handler=route.namespace.createHandler({isBrainPreview:()=>true,userFromCookie:async()=>user,
  kvGetVersioned:store.read,kvPutVersioned:store.write},{now,fetcher:async()=>{calls++;return Response.json(collection());}});
 const origin='https://deploy-preview-454--pricepocketasset.netlify.app';
 const url=origin+'/.netlify/functions/owner-brain-putnam-verification';
 const preview={deploy:{context:'deploy-preview'}};
 const send=(body,extra={})=>handler(new Request(url,body?{method:'POST',body:JSON.stringify(body),
  headers:{origin,...extra}}:undefined),preview);
 assert.equal((await handler(new Request(url),{deploy:{context:'production'}})).status,404);
 assert.equal((await send()).status,401);
 user={owner:false};assert.equal((await send()).status,403);
 user={owner:true};
 const confirmation={confirmed:true,requestId:putnam.PUTNAM.requestId};
 assert.equal((await send(confirmation,{origin:'https://elsewhere.example'})).status,403);
 assert.equal((await send({...confirmation,where:'anything'})).status,400);
 assert.equal((await (await send()).json()).canRun,true);
 assert.equal(calls,0);
 assert.equal((await (await send(confirmation)).json()).status,'no_exact_match');
 assert.equal(calls,1);
});

test('appraiser access evidence appears without writing GIS checkpoints or budget',async()=>{
 const store=memory();
 const status=await putnam.putnamStatus(store,now);
 assert.equal(status.appraiserReview.status,'unavailable');
 assert.equal(status.appraiserReview.checkedOn,'2026-11-22');
 assert.equal(store.data.size,0);
});
