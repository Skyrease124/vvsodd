import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {countyOperation,createCountyConnector,inspectFields} from '../../netlify/lib/brain-gis-universal.mjs';
import {countyPilotDefinition,eligiblePilotRows} from '../../netlify/lib/brain-gis-pilot-registry.mjs';
import {publishCountyCorrection} from '../../netlify/lib/brain-gis-county-publication.mjs';
import {countyCheckpointKey,reserveCountyRequest,runCountyResearch} from '../../netlify/lib/brain-gis-county-worker.mjs';

const now=()=>Date.parse('2026-11-22T05:00:00Z');
const shape=[[-83.1,42.3],[-83.099,42.3],[-83.099,42.301],[-83.1,42.3]];
const property={APN:'0007',Site_Address:'100 Main Street',Acres:'1',Zone:'R1'};
const geo=(rows=[property])=>({type:'FeatureCollection',features:rows.map(properties=>({type:'Feature',properties,
 geometry:{type:'Polygon',coordinates:[shape]}}))});
const config=(format,id='MI-demo')=>({id,format,source:'https://parcels.example.gov/'+
 ({'feature-server':'rest/FeatureServer/0','map-server':'rest/MapServer/3',geojson:'parcels.geojson',csv:'parcels.csv'}[format]),
 reviewedOrigin:'https://parcels.example.gov',authority:'https://example.gov/assessor',bounds:[-84,41,-82,43],
 mode:'preview-research',enabled:true,requestLimit:8});
const parcel=(p='0007',dataset='MI-demo')=>({i:'row-'+p,p,a:'100 Main St',dataset});
function memory(){
 const values=new Map();
 let counter=0;
 return {read:async key=>structuredClone(values.get(key)||null),write:async(key,data,expected)=>{
  if((values.get(key)?.etag??null)!==expected)return null;
  const etag=String(++counter);
  values.set(key,{etag,data:structuredClone(data)});
  return etag;
 }};
}
const arcMeta={geometryType:'esriGeometryPolygon',capabilities:'Map,Query',maxRecordCount:250,
 advancedQueryCapabilities:{supportsPagination:true},fields:[
  {name:'APN',type:'esriFieldTypeString'},{name:'Site_Address',type:'esriFieldTypeString'}]};
const arcResult=(attributes=property,rings=[shape])=>({spatialReference:{wkid:4326},features:[{attributes,geometry:{rings}}]});

for(const format of ['feature-server','map-server'])test(format+' discovers reviewed schema and returns exact research evidence',async()=>{
 let calls=0;
 const c=createCountyConnector(config(format),{reserve:async()=>{calls++;},fetcher:async url=>{
  if(!url.pathname.endsWith('/query'))return Response.json(arcMeta);
  assert.equal(url.searchParams.get('where'),"APN = '0007'");
  assert.equal(url.searchParams.get('outSR'),'4326');
  return Response.json(arcResult());
 }});
 const discovery=await c.discover();
 assert.equal(discovery.capabilities.maxRecordCount,250);
 assert.equal(discovery.capabilities.pagination,true);
 const result=await c.verify(parcel(),discovery);
 assert.equal(result.parcelId,'0007');
 assert.equal(result.publicationAllowed,false);
 assert.equal(result.verifiedGeometry,undefined);
 assert.equal(calls,2);
});

test('schema inference requires unique identifier and address fields',()=>{
 assert.equal(inspectFields(['APN','parcel_number','Address']).compatible,false);
 assert.equal(inspectFields(['APN','parcel_number','Address'],{parcel:'APN'}).compatible,true);
 assert.equal(inspectFields(['APN']).compatible,false);
 assert.equal(inspectFields(['PROPERTY_ID','SITE_ADDRESS','ACRES','ZONE']).fields.zoning,'ZONE');
});

test('GeoJSON preserves zeros and rejects matching addresses with other IDs or duplicate IDs',async()=>{
 let calls=0;
 const c=createCountyConnector(config('geojson'),{reserve:async()=>{calls++;},
  fetcher:async()=>Response.json(geo([property,{...property,APN:'9'},{...property,APN:'9'}]))});
 const source=await c.discover();
 assert.equal((await c.verify(parcel(),source)).parcelId,'0007');
 await assert.rejects(c.verify(parcel('7'),source),{code:'missing'});
 await assert.rejects(c.verify(parcel('9'),source),{code:'duplicate'});
 assert.equal(calls,1);
});

test('CSV handles quoted multiline fields and leading zeros without inventing geometry',async()=>{
 const raw='APN,Site_Address,GeoJSON,Note\r\n0007,100 Main Street,"'+
  JSON.stringify({type:'Polygon',coordinates:[shape]}).replaceAll('"','""')+'","quoted\nline"\r\n0008,100 Main Street,,""';
 const c=createCountyConnector(config('csv'),{reserve:async()=>{},fetcher:async()=>new Response(raw)});
 const source=await c.discover();
 assert.equal((await c.verify(parcel(),source)).parcelId,'0007');
 await assert.rejects(c.verify(parcel('0008'),source),{code:'invalid_polygon'});
});

test('malformed layer responses pause the source and invalid polygon remains parcel-specific',async()=>{
 let body=arcResult(property,[shape.slice(1)]);
 const c=createCountyConnector(config('map-server'),{reserve:async()=>{},fetcher:async url=>
  Response.json(url.pathname.endsWith('/query')?body:arcMeta)});
 const source=await c.discover();
 await assert.rejects(c.verify(parcel(),source),{code:'invalid_polygon',scope:'parcel'});
 body={...arcResult(),exceededTransferLimit:true};
 await assert.rejects(c.verify(parcel(),source),{code:'incomplete_results',scope:'source'});
 body={...arcResult(),spatialReference:{wkid:3857}};
 await assert.rejects(c.verify(parcel(),source),{code:'unsupported_crs',scope:'source'});
});

const args=(storage,id='MI-demo')=>({config:config('feature-server',id),rows:['0001','0002','0003','0007'].map(p=>parcel(p,id)),
 storage,revision:'fixture-v1',authorization:{owner:true,preview:true,confirmed:true,dataset:id},now});
const fetcher=async url=>{
 if(!url.pathname.endsWith('/query'))return Response.json(arcMeta);
 const p=url.searchParams.get('where').split("'")[1];
 if(p==='0001')return Response.json({spatialReference:{wkid:4326},features:[]});
 if(p==='0002')return Response.json({spatialReference:{wkid:4326},features:[...arcResult().features,...arcResult().features]});
 if(p==='0003')return Response.json(arcResult({...property,APN:p},[shape.slice(1)]));
 return Response.json(arcResult({...property,APN:p}));
};
test('checkpoint carries review reasons through restart and leaves research isolated from map publication',async()=>{
 const storage=memory(),options={...args(storage),fetcher};
 const first=await runCountyResearch(options);
 assert.equal(first.cursor,3);
 assert.deepEqual(Object.values(first.review).map(row=>row.code),['missing','duplicate','invalid_polygon']);
 const restarted=await runCountyResearch(options);
 assert.equal(restarted.cursor,4);
 assert.equal(restarted.evidence[3].parcelId,'0007');
 assert.equal(restarted.evidence[3].publicationAllowed,false);
 assert.equal(await storage.read('brain-map-county-v1-MI-demo'),null);
 assert.equal((await runCountyResearch(options)).events.length,restarted.events.length);
 const review=first.review[0];
 await assert.rejects(runCountyResearch({...options,retry:{index:0,parcelId:'0002',checkedAt:review.checkedAt}}),{code:'stale_review'});
 const retry=await runCountyResearch({...options,retry:{index:0,parcelId:review.parcelId,checkedAt:review.checkedAt}});
 assert.equal(retry.cursor,4);
 assert.equal(retry.review[0].previous.length,1);
 await assert.rejects(runCountyResearch({...options,revision:'fixture-v2'}),{code:'dataset_changed'});
});

test('concurrent claims, disabled counties and source outages cannot consume unrelated county progress',async()=>{
 const storage=memory();
 const options={...args(storage),fetcher:async()=>new Response(null,{status:503})};
 const results=await Promise.allSettled([runCountyResearch(options),runCountyResearch(options)]);
 assert.equal(results.filter(r=>r.status==='rejected').length,1);
 const first=(await storage.read(countyCheckpointKey('MI-demo'))).data;
 assert.equal(first.sourceHealth.status,'source_paused');
 assert.equal(first.cursor,0);
 assert.deepEqual(first.review,{});
 assert.equal((await runCountyResearch(options)).sourceHealth.attempt,1);
 assert.equal((await runCountyResearch({...args(storage,'OH-demo'),fetcher})).cursor,3);
 await assert.rejects(runCountyResearch({...options,config:{...options.config,enabled:false}}),{code:'not_authorized'});
 assert.equal(countyOperation('MI-wayne').enabled,false);
 assert.equal(countyOperation('CO-larimer').mode,'research-only');
});

test('shared quota reservation is atomic across counties',async()=>{
 const storage=memory();
 const limits={shared:2,county:2};
 const outcomes=await Promise.allSettled(['MI-demo','OH-demo','CO-demo'].map(id=>reserveCountyRequest(storage,id,limits,now)));
 assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,2);
 assert.equal(outcomes.find(r=>r.status==='rejected').reason.code,'quota_reached');
});

test('no request dispatches when shared reservation refuses it',async()=>{
 let calls=0;
 const c=createCountyConnector(config('geojson'),{reserve:async()=>{throw Object.assign(Error('Full'),{scope:'quota'});},
  fetcher:async()=>{calls++;}});
 await assert.rejects(c.discover(),{scope:'quota'});
 assert.equal(calls,0);
});


test('future publication requires separate approval, independently verifies, and preserves one receipt',async()=>{
 const storage=memory(),record=parcel(),cfg={...config('feature-server'),mode:'preview-publication'};
 const at=new Date(now()).toISOString();
 const evidence={type:'county_research_evidence',dataset:cfg.id,recordId:record.i,parcelId:record.p,source:cfg.source,checkedAt:at,
  geometry:{rings:[[['fixture must not be published']]]}};
 const authorization={owner:true,preview:true,confirmed:true,dataset:cfg.id,recordId:record.i,parcelId:record.p,evidenceAt:at};
 const options={config:cfg,record,evidence,authorization,storage,fetcher,now};
 await assert.rejects(publishCountyCorrection({...options,config:{...cfg,mode:'preview-research'}}),{code:'publication_denied'});
 await assert.rejects(publishCountyCorrection({...options,authorization:{...authorization,confirmed:false}}),{code:'publication_denied'});
 await assert.rejects(publishCountyCorrection({...options,record:{...record,g:[shape]}}),{code:'publication_denied'});
 assert.equal(await storage.read('brain-map-county-v1-MI-demo'),null);
 const result=await publishCountyCorrection(options);
 const saved=(await storage.read('brain-map-county-v1-MI-demo')).data;
 assert.equal(result.status,'published');
 assert.deepEqual(saved.records[record.i].g,[shape]);
 assert.equal(saved.records[record.i].verifiedGeometry,true);
 assert.equal((await publishCountyCorrection(options)).status,'already_published');
 assert.equal(saved.publicationHistory.length,1);
 const merger=await fs.readFile('kinvest-liens/map/brain-map-merge.js','utf8');
 const context={window:{},URLSearchParams,fetch:async()=>Response.json({
  ok:true,dataset:cfg.id,version:saved.version,records:saved.records})};
 vm.runInNewContext(merger,context);
 for(const surface of ['Public','Workshop','MapTiler']){
  const dataset={id:cfg.id,recs:[{...record}]};
  const applied=await context.window.PPABrainMap.apply(dataset);
  assert.equal(applied.count,1,surface);
  assert.equal(dataset.recs[0].p,'0007',surface);
  assert.deepEqual(dataset.recs[0].g,[shape],surface);
 }
});


const miami=countyPilotDefinition('FL-miami-dade');
const miamiMeta={...arcMeta,extent:{spatialReference:{wkid:102658,latestWkid:2236}},supportsDatumTransformation:true,fields:[{name:'FOLIO',type:'esriFieldTypeString',length:13},{name:'TRUE_SITE_ADDR',type:'esriFieldTypeString'}]};
const miamiShape=[[-80.3,25.7],[-80.299,25.7],[-80.299,25.701],[-80.3,25.7]];
const fixtureRaw={id:miami.id,recs:Array.from({length:10},(_,i)=>({
 i:'m'+i,p:'00-1000-123-'+String(i+1).padStart(4,'0'),a:'100 Main Street'
}))};
const miamiRows=eligiblePilotRows(miami,fixtureRaw);
function miamiResult(id,ring=miamiShape){
 return {spatialReference:{wkid:4326},features:[{attributes:{FOLIO:id,TRUE_SITE_ADDR:'100 MAIN ST'},geometry:{rings:[ring]}}]};
}
test('ten Miami-Dade fixtures process through skip, source pause, retry and restart without publishing',async()=>{
 const storage=memory();
 let time=now(),firstTimeout=true;
 const source=async url=>{
  if(!url.pathname.endsWith('/query'))return Response.json(miamiMeta);
  const id=url.searchParams.get('where').split("'")[1];
  assert.match(id,/^001000123\d{4}$/);
  switch(Number(id.slice(-4))){
   case 1:return Response.json({spatialReference:{wkid:4326},features:[]});
   case 2:return Response.json({...miamiResult(id),features:[...miamiResult(id).features,...miamiResult(id).features]});
   case 3:return Response.json(miamiResult(id,miamiShape.slice(1)));
   case 5:if(firstTimeout){firstTimeout=false;throw new Error('mock timeout');}break;
  }
  return Response.json(miamiResult(id));
 };
 const options={storage,rows:miamiRows,revision:'miami-fixture',fetcher:source,now:()=>time,
  config:{...miami,enabled:true,requestLimit:20,operationMode:'fixture'},
  authorization:{owner:true,preview:true,confirmed:true,dataset:miami.id}};
 const first=await runCountyResearch(options);
 assert.equal(first.cursor,3);
 assert.deepEqual(Object.values(first.review).map(row=>row.code),['missing','duplicate','invalid_polygon']);
 assert.equal((await runCountyResearch(options)).cursor,4);
 assert.equal((await runCountyResearch(options)).sourceHealth.status,'source_paused');
 time+=60001;
 let last;
 for(let i=0;i<2;i++)last=await runCountyResearch(options);
 assert.equal(last.cursor,10);
 assert.equal(Object.keys(last.evidence).length,7);
 assert.equal(last.evidence[9].parcelId,miamiRows[9].p);
 assert.equal(last.evidence[9].publicationAllowed,false);
 assert.equal(await storage.read('brain-map-county-v1-'+miami.id),null);
});

test('one Miami pilot approval cap spans discovery, verification and independent publication',async()=>{
 const storage=memory(),approval={id:'fixture-approval',day:'2026-11-22'};
 const config={...miami,enabled:true,approval};
 let calls=0;
 const mock=async url=>{
  calls++;
  return Response.json(url.pathname.endsWith('/query')?miamiResult(url.searchParams.get('where').split("'")[1]):miamiMeta);
 };
 const authorization={owner:true,preview:true,confirmed:true,dataset:miami.id,permitId:approval.id,cursor:0};
 const options={config,rows:miamiRows,revision:'miami-fixture',storage,authorization,fetcher:mock,now};
 await assert.rejects(runCountyResearch({...options,config:miami}),{code:'not_authorized'});
 const first=await runCountyResearch(options);
 assert.equal(calls,2);
 assert.equal(first.cursor,1);
 assert.equal(first.sourceHealth.status,'quota_wait');
 const record=miamiRows[0],evidence=first.evidence[0];
 const publication={...options,config:{...config,mode:'preview-publication'},record,evidence,discovery:first.discovery,
  authorization:{...authorization,recordId:record.i,parcelId:record.p,evidenceAt:evidence.checkedAt}};
 await assert.rejects(publishCountyCorrection({...publication,authorization:{...publication.authorization,confirmed:false}}),{code:'publication_denied'});
 assert.equal((await publishCountyCorrection(publication)).status,'published');
 assert.equal(calls,3);
 assert.equal((await publishCountyCorrection(publication)).status,'already_published');
 const next=await runCountyResearch({...options,authorization:{...authorization,cursor:1}});
 assert.equal(next.cursor,1);
 assert.equal(calls,3);
 await assert.rejects(reserveCountyRequest(storage,miami.id,{shared:30,county:3,
  permit:{...approval,phase:'research'}},()=>now()+86400000),{code:'quota_reached'});
});

test('county pilot endpoint is owner-only and denies dispatch before activation',async()=>{
 const context=vm.createContext({Response,URL,process});
 const synthetic=exports=>new vm.SyntheticModule(Object.keys(exports),function(){
  for(const [key,value] of Object.entries(exports))this.setExport(key,value);
 },{context});
 let user=null,writes=0;
 const modules={
  'node:crypto':synthetic(await import('node:crypto')),
  'node:fs/promises':synthetic({readFile:fs.readFile}),
  'node:path':synthetic(await import('node:path')),
  '../lib/brain-auth.mjs':synthetic({withBrainStore:handler=>handler,isBrainPreview:()=>true,
   userFromCookie:async()=>user,kvGet:async()=>null,kvGetVersioned:async()=>null,kvPutVersioned:async()=>{writes++;}}),
  '../lib/brain-gis-pilot-registry.mjs':synthetic(await import('../../netlify/lib/brain-gis-pilot-registry.mjs')),
  '../lib/brain-gis-county-worker.mjs':synthetic(await import('../../netlify/lib/brain-gis-county-worker.mjs'))
 };
 const source=await fs.readFile('netlify/functions/owner-brain-county-pilot.mjs','utf8');
 const mod=new vm.SourceTextModule(source,{context});
 await mod.link(specifier=>modules[specifier]);
 await mod.evaluate();
 const origin='https://deploy-preview-454--pricepocketasset.netlify.app';
 const get=(method='GET',deploy='deploy-preview')=>mod.namespace.default(new Request(origin+'/.netlify/functions/owner-brain-county-pilot?dataset=FL-miami-dade',{
  method,...(method==='POST'?{headers:{origin},body:JSON.stringify({confirmed:true,action:'run',cursor:0})}:{})
 }),{deploy:{context:deploy}});
 assert.equal((await get()).status,401);
 user={owner:false};
 assert.equal((await get()).status,403);
 user={owner:true};
 assert.equal((await get('GET','production')).status,404);
 const status=await (await get()).json();
 assert.equal(status.eligible,10);
 assert.equal(status.active,false);
 assert.equal(status.runAllowed,false);assert.equal(status.pilotRemaining,null);
 assert.equal(status.schemaAt,null);assert.equal(status.wgs84ValidatedAt,null);
 assert.equal((await get('POST')).status,409);
 assert.equal(writes,0);
});


test('Miami-Dade requires explicit CRS and validates actual longitude/latitude',async()=>{
 let response;
 let metadata=miamiMeta;
 const c=createCountyConnector(miami,{reserve:async()=>{},fetcher:async url=>
  Response.json(url.pathname.endsWith('/query')?response:metadata)});
 const discovery=await c.discover();
 assert.equal(discovery.capabilities.nativeWkid,2236);
 assert.equal(discovery.capabilities.datumTransformation,true);
 const record=miamiRows[0],id=record.p.replaceAll('-','');
 response={features:[]};
 await assert.rejects(c.verify(record,discovery),{code:'missing',scope:'parcel'});
 response=miamiResult(id);
 assert.equal((await c.verify(record,discovery)).outputWkid,4326);
 delete response.spatialReference;
 await assert.rejects(c.verify(record,discovery),{code:'unsupported_crs'});
 response=miamiResult(id);
 response.features[0].geometry.spatialReference={wkid:2236};
 await assert.rejects(c.verify(record,discovery),{code:'unsupported_crs'});
 response={...miamiResult(id),spatialReference:{wkid:2236,latestWkid:4326}};
 await assert.rejects(c.verify(record,discovery),{code:'unsupported_crs'});
 response=miamiResult(id,miamiShape.map(([x,y])=>[x*10000,y*10000]));
 await assert.rejects(c.verify(record,discovery),{code:'invalid_polygon'});
 metadata={...miamiMeta,extent:{spatialReference:{wkid:3857}}};
 await assert.rejects(c.discover(),{code:'native_crs_mismatch'});
});
