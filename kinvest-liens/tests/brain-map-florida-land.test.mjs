import assert from 'node:assert/strict';
import test from 'node:test';
import {approveLandReview,filterLandReview,importLandBatch,landSummary,LAND_SOURCES} from '../../netlify/lib/brain-florida-land.mjs';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as land from '../../netlify/lib/brain-florida-land.mjs';

async function loadRoute(){
 const context=vm.createContext({URL,Response,Buffer});
 const createModule=exports=>new vm.SyntheticModule(Object.keys(exports),function(){
  for(const [name,value] of Object.entries(exports))this.setExport(name,value);
 },{context});
 const dependency=createModule(land),auth=createModule({withBrainStore:handler=>handler});
 const file=new URL('../../netlify/functions/owner-brain-florida-land.mjs',import.meta.url);
 const endpoint=new vm.SourceTextModule(await readFile(file,'utf8'),{context});
 await endpoint.link(path=>path.endsWith('/brain-auth.mjs')?auth:dependency);
 await endpoint.evaluate();
 return endpoint.namespace.createHandler;
}

const now=Date.parse('2026-11-22T12:00:00Z');
const date='2026-11-21T12:00:00Z';
const ring=[[-80.3,25.8],[-80.299,25.8],[-80.299,25.801],[-80.3,25.801],[-80.3,25.8]];
const parcelId='0030520750060';
const parcel={attributes:{CO_NO:23,PARCELNO:parcelId,PHY_ADDR1:'741 SITE RD',CLASSIFICATION:'surface'},geometry:{rings:[ring]}};
const sale={GEOID:'12086',FDOR_CODE:'23',PARCEL_ID:'00-3052-075-0060',SITUS_ADDRESS:'741 Site Rd',
 LISTING_ID:'listing-001',EVENT_ID:'event-01',STATUS:'available',AVAILABLE:'true',ASKING_PRICE:'10000',
 EVIDENCE_URL:new URL('/fixture-notice.pdf',LAND_SOURCES['miami-surplus'].url).href};
const batch=(sourceId,rows,rest={})=>({sourceId,geoid:'12086',format:sourceId==='floridagio'?'arcgis':'csv',
 retrievedAt:date,fixture:true,wkid:sourceId==='floridagio'?4326:null,rows,...rest});
const apply=(state,source,rows,rest)=>importLandBatch(state,batch(source,rows,rest),{now}).state;
const summary=state=>landSummary(state,now);
const assessment={CO_NO:'23',PARCEL_ID:parcelId,CLASSIFICATION:'surface',LEGAL_REFERENCE:'LOT 12 BLOCK 6'};

test('exact county, folio and situs preserve leading zeros and fixtures cannot be approved',()=>{
 let state=apply(null,'floridagio',[parcel]);
 state=apply(state,'miami-surplus',[sale]);
 const result=summary(state);
 const [record]=result.records;
 assert.equal(record.item.parcelId,parcelId);
 assert.equal(record.item.originalParcelId,sale.PARCEL_ID);
 assert.equal(record.verifiedPolygon,true);
 assert.equal(record.eligible,false);
 assert.equal(result.matched,1);
 assert.equal(result.requests,0);
 assert.equal(result.published,0);
 assert.equal(filterLandReview(result.records,{verifiedOnly:true,type:'surplus',minimumPrice:9999}).length,1);
 assert.equal(filterLandReview(result.records,{maximumPrice:9999}).length,0);
 assert.throws(()=>approveLandReview(state,{...record,reviewer:'test'},now),/stale_or_unverified/);
});

test('wrong county, numeric identifiers, malformed polygons and missing evidence do not stop the next row',()=>{
 const state=apply(null,'floridagio',[
  {...parcel,attributes:{...parcel.attributes,CO_NO:86}},
  {...parcel,attributes:{...parcel.attributes,PARCELNO:30520750060}},
  {...parcel,geometry:{rings:[ring.slice(0,-1)]}},parcel
 ]);
 assert.equal(state.parcels.length,1);
 assert.deepEqual(state.skipped.map(r=>r.reason),['county_identifier_mismatch','invalid_parcel_identifier','invalid_source_record']);
 assert.throws(()=>apply(state,'floridagio',[parcel],{wkid:6439}),/invalid_import_manifest/);
 assert.throws(()=>apply(state,'floridagio',[parcel],{format:'unsupported'}),/invalid_import_manifest/);
 const bad=apply(state,'miami-surplus',[{...sale,EVIDENCE_URL:'https://not-official.example/a'}, {...sale,GEOID:'12099'}]);
 assert.equal(summary(bad).records.length,0);
 assert.equal(bad.skipped.length,5);
});

test('duplicates do not inflate results, conflicting geometry and situs require review',()=>{
 let state=apply(null,'floridagio',[parcel,parcel]);
 state=apply(state,'miami-surplus',[sale,sale]);
 assert.equal(summary(state).records.length,1);
 assert.equal(summary(state).matched,1);
 state=apply(state,'floridagio',[{...parcel,attributes:{...parcel.attributes,PHY_ADDR1:'742 SITE RD'}}]);
 assert.equal(summary(state).records[0].reason,'ambiguous_parcel');
 const conflict=apply(apply(null,'floridagio',[parcel]),'miami-surplus',[{...sale,SITUS_ADDRESS:'742 SITE RD'}]);
 assert.equal(summary(conflict).records[0].reason,'conflicting_identity_evidence');
});

test('missing situs needs separate assessment and matching documentary evidence; mineral rights remain separate',()=>{
 const vacant={...parcel,attributes:{...parcel.attributes,PHY_ADDR1:'',VACANT:true,LEGAL_REFERENCE:assessment.LEGAL_REFERENCE}};
 const offering={...sale,SITUS_ADDRESS:'',CLASSIFICATION:'surface',LEGAL_REFERENCE:assessment.LEGAL_REFERENCE};
 let state=apply(apply(null,'floridagio',[vacant]),'miami-surplus',[offering]);
 assert.equal(summary(state).records[0].reason,'insufficient_identity_evidence');
 state=apply(state,'fdor-nal',[assessment]);
 assert.equal(summary(state).records[0].verifiedPolygon,true);
 state=apply(state,'fdor-nal',[{...assessment,CLASSIFICATION:'mineral'}],{retrievedAt:'2026-11-22T10:00:00Z'});
 assert.equal(summary(state).records[0].reason,'mineral_rights');
});

test('exact owner approval is revision-bound; later cancellation preserves history and revokes eligibility',()=>{
 let state=apply(null,'floridagio',[parcel],{fixture:false});
 state=apply(state,'miami-surplus',[sale],{fixture:false});
 const [row]=summary(state).records;
 assert.equal(row.eligible,true);
 assert.throws(()=>approveLandReview(state,{...row,revision:'stale',reviewer:'test'},now),/stale_or_unverified/);
 const changed=apply(state,'floridagio',[{...parcel,attributes:{...parcel.attributes,ZONING:'Changed'}}],
  {fixture:false,retrievedAt:'2026-11-22T10:00:00Z'});
 assert.throws(()=>approveLandReview(changed,{...row,reviewer:'test'},now),/stale_or_unverified/);
 state=approveLandReview(state,{...row,reviewer:'test'},now);
 assert.equal(summary(state).approved,1);
 assert.equal(summary(state).published,0);
 state=apply(state,'miami-surplus',[{...sale,STATUS:'canceled'}],{fixture:false,retrievedAt:'2026-11-22T10:00:00Z'});
 assert.equal(summary(state).expiredOrCanceled,1);
 assert.equal(summary(state).approved,0);
 assert.equal(summary(state).records[0].versions,2);
 const expired=apply(state,'miami-surplus',[{...sale,DEADLINE:date,EVENT_ID:'other'}],{fixture:false});
 assert.equal(summary(expired).expiredOrCanceled,2);
});

test('interrupted receipts resume idempotently and counties cannot reuse another checkpoint',()=>{
 const input=batch('floridagio',[parcel,{...parcel,attributes:{...parcel.attributes,PARCELNO:'0030520750061'}}]);
 const partial=importLandBatch(null,input,{now,limit:1});
 const next=importLandBatch(JSON.parse(JSON.stringify(partial.state)),input,{now,limit:1});
 assert.equal(next.receipt,partial.receipt);
 assert.equal(next.state.receipts[next.receipt].cursor,2);
 assert.deepEqual(importLandBatch(next.state,input,{now}).state,next.state);
 assert.throws(()=>importLandBatch(next.state,{...input,geoid:'12099'},{now}),/county_checkpoint_mismatch/);
});

test('owner route checks preview, role, origin and CAS without provider or publication calls',async()=>{
 const createHandler=await loadRoute();
 const url='https://deploy-preview-454--pricepocketasset.netlify.app/.netlify/functions/owner-brain-florida-land?geoid=12086';
 const context={deploy:{context:'deploy-preview'}};
 let user=null, stored=null;
 const route=createHandler({isBrainPreview:()=>true,userFromCookie:async()=>user,
  kvGet:async()=>stored?.data,kvGetVersioned:async()=>stored,
  kvPutVersioned:async(key,data,etag)=>{
   assert.equal(key,'brain-florida-land-v1-12086');
   if((stored?.etag??null)!==etag)return null;
   stored={data,etag:'saved'};return 'saved';
  }});
 const get=(ctx=context)=>route(new Request(url),ctx);
 const post=(body,origin=new URL(url).origin)=>route(new Request(url,{method:'POST',headers:{origin},body:JSON.stringify(body)}),context);
 assert.equal((await get({deploy:{context:'production'}})).status,404);
 assert.equal((await get()).status,401);
 user={owner:false};assert.equal((await get()).status,403);
 user={owner:true,email:'owner@example.test'};assert.equal((await get()).status,200);
 assert.equal((await post({action:'import'},'https://wrong.test')).status,403);
 assert.equal((await post({action:'import'})).status,400);
 assert.equal((await post({action:'import',confirmed:true,batch:batch('floridagio',[parcel])})).status,422);
 assert.equal((await post({action:'import',confirmed:true,batch:batch('floridagio',[parcel],{fixture:false})})).status,200);
 assert.equal((await get()).status,200);
 const previous=stored;
 const racing=createHandler({isBrainPreview:()=>true,userFromCookie:async()=>user,
  kvGetVersioned:async()=>previous,kvPutVersioned:async()=>null});
 const request=new Request(url,{method:'POST',headers:{origin:new URL(url).origin},
  body:JSON.stringify({action:'import',confirmed:true,batch:batch('miami-surplus',[sale],{fixture:false})})});
 assert.equal((await racing(request,context)).status,409);
});

test('missing boundary blocks approval and source acreage stays separate from computed acreage',()=>{
 let state=apply(null,'miami-surplus',[sale],{fixture:false});
 const [unmatched]=summary(state).records;
 assert.equal(unmatched.reason,'missing_verified_polygon');
 assert.equal(unmatched.geometryAcres,null);
 assert.throws(()=>approveLandReview(state,{...unmatched,reviewer:'test'},now),/stale_or_unverified/);
 state=apply(state,'floridagio',[{...parcel,attributes:{...parcel.attributes,ACREAGE:'25.5'}}],{fixture:false});
 const [matched]=summary(state).records;
 assert.equal(matched.sourceAcreage,25.5);
 assert.ok(matched.geometryAcres>0);
 assert.notEqual(matched.geometryAcres,matched.sourceAcreage);
});
