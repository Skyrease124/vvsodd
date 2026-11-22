// Offline integration test. Does not establish live GIS or deployed storage behavior.
// Run from repository root: node --experimental-vm-modules kinvest-liens/tests/brain-map-pipeline.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const GIS='https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Parcels_Current/FeatureServer/0';
const KEY='brain-map-county-v1-MI-wayne';
const approval=()=>({decision:'approved_for_staging',dataset:'MI-wayne',state:'MI',county:'Wayne',
 recordId:'test-record',parcelId:'01002263',independentlyChecked:true,
 evidenceUrl:GIS,caseKey:'test-review',proposedPosition:{lat:42.3005,lon:-83.0995}});
const ring=[[-83.1,42.3],[-83.099,42.3],[-83.099,42.301],[-83.1,42.301],[-83.1,42.3]];
async function harness({review=approval(),features,record,offline=false,pauseDuringGIS=false,failWrite}={}){
 const store=new Map([['owner-brain-approvals-v1',{entries:[review]}]]);
 store.set('owner-brain-scanner-v1',{status:'running',queue:[{dataset:'MI-wayne',recordId:'test-record',
  review:{caseKey:'test-review',decision:'approved_for_staging'}}]});
 const etags=new Map();
 let failed=false;
 const county={id:'MI-wayne',recs:[record||{i:'test-record',p:'01002263',why:'missing'}]};
 const calls=[];
 const context=vm.createContext({URL,URLSearchParams,Response,AbortSignal,Buffer,console,
  fetch:async url=>{
   const u=new URL(url);calls.push(u);
   if(u.hostname==='pricepocketasset.com'&&u.pathname==='/map/data/MI-wayne.json')return Response.json(county);
   assert.equal(u.origin+u.pathname,GIS+'/query');
   assert.equal(u.searchParams.get('where'),review.officialObjectId?'object_id='+review.officialObjectId:"parcel_number IN ('01002263','01002263.')");
   assert.equal(u.searchParams.get('outSR'),'4326');
   assert.equal(u.searchParams.get('geometryType'),review.officialObjectId?null:'esriGeometryEnvelope');
   if(offline)throw Error('Simulated GIS outage');
   if(pauseDuringGIS)store.set('owner-brain-scanner-v1',{status:'paused',queue:[]});
   return Response.json({features:features??[{attributes:{parcel_number:'01002263'},geometry:{rings:[ring]}}]});
  }});
 const auth=new vm.SyntheticModule(['kvGet','kvPut','kvGetVersioned','kvPutVersioned','withBrainStore'],function(){
  this.setExport('withBrainStore',handler=>handler);this.setExport('kvGet',async key=>structuredClone(store.get(key)));
  this.setExport('kvPut',async(key,value)=>store.set(key,structuredClone(value)));
  this.setExport('kvGetVersioned',async key=>store.has(key)?{data:structuredClone(store.get(key)),etag:etags.get(key)||'0'}:null);
  this.setExport('kvPutVersioned',async(key,value,etag)=>{
   const current=store.has(key)?etags.get(key)||'0':null;
   if(current!==etag)return null;
   if(!failed&&key===failWrite){failed=true;throw Error('Simulated interrupted write');}
   const next=String(Number(current)+1);
   etags.set(key,next);store.set(key,structuredClone(value));return next;
  });
 },{context});
 async function module(path){
  const m=new vm.SourceTextModule(fs.readFileSync(path,'utf8'),{context});
  await m.link(specifier=>{assert.equal(specifier,'../lib/brain-auth.mjs');return auth;});
  await m.evaluate();return m.namespace.default;
 }
 const publish=await module('netlify/functions/brain-map-publish-auto.mjs');
 const feed=await module('netlify/functions/brain-map-county.mjs');
 // The publisher is now internal-only; tests must use the same guarded context as the Wayne worker.
 const guardedPublish=(recovery=false)=>publish(new Request('https://preview.test/.netlify/functions/brain-map-publish-auto'),{
  waynePublisherInternal:true,wayneRecoveryOnly:recovery,
  chargeWayneGisRequest:async()=>{assert.equal(recovery,false);const used=store.get('test-gis-usage')||0;if(used>=30)throw Error('Daily GIS request limit reached');store.set('test-gis-usage',used+1);}
 });
 return {store,county,publish:guardedPublish,feed,calls};
}
test('publication flows through saved feed to three independent map datasets, with history and idempotency',async()=>{
 const h=await harness();await h.publish();
 assert.equal(h.store.get(KEY).version,1);
 assert.equal(h.store.get('brain-map-publication-status-v1').lastBatch.published,1);
 assert.equal(h.store.get('brain-map-history-v1').entries[0].reviewCase,'test-review');
 const request=()=>new Request('https://preview.test/.netlify/functions/brain-map-county?dataset=MI-wayne');
 for(let i=0;i<3;i++){
  const ds=structuredClone(h.county);
  const scope={window:{},URLSearchParams,fetch:()=>h.feed(request())};
  vm.runInNewContext(fs.readFileSync('kinvest-liens/map/brain-map-merge.js','utf8'),scope);
  assert.equal((await scope.window.PPABrainMap.apply(ds)).changed,true);
  assert.deepEqual(ds.recs[0].g,[ring]);
  assert.equal((await scope.window.PPABrainMap.apply(ds)).changed,false);
 }
 await h.publish();
 assert.equal(h.store.get(KEY).version,1);
 assert.equal(h.store.get('brain-map-history-v1').entries.length,1);
 assert.equal((await h.feed(new Request(request(),{method:'POST'}))).status,405);
});
test('unreviewed candidates, wrong parcel identity, and ambiguous official results stay unpublished',async()=>{
 for(const options of [
  {review:{...approval(),decision:'pending'}},
  {review:{...approval(),independentlyChecked:false}},
  {review:{...approval(),proposedPosition:{lat:'invalid',lon:-83.1}}},
  {record:{i:'test-record',p:'OTHER'}},
  {features:[]},
  {features:[{attributes:{parcel_number:'OTHER'},geometry:{rings:[ring]}}]},
  {features:[{},{},{}]},
  {features:[{attributes:{parcel_number:'01002263'},geometry:{rings:[ring,ring]}}]},
  {offline:true}
 ]){
  const h=await harness(options);await h.publish();
  assert.equal(h.store.has(KEY),false);
  assert.equal(h.store.has('brain-map-history-v1'),false);
 }
});
test('captured official Detroit parcel with trailing period publishes under the county parcel ID',async()=>{
 const fixture=JSON.parse(fs.readFileSync('kinvest-liens/tests/fixtures/detroit-01002263.json','utf8'));
 assert.equal(fixture.feature.attributes.parcel_number,'01002263.');
 assert.equal(fixture.feature.attributes.address,'90 CHANDLER');
 const h=await harness({features:[fixture.feature],review:{...approval(),proposedPosition:{lat:42.37441065,lon:-83.073996}}});
 await h.publish();
 assert.equal(h.store.get(KEY)?.records['test-record'].p,'01002263');
 assert.deepEqual(h.store.get(KEY).records['test-record'].g,fixture.feature.geometry.rings);
});

test('verified object ID is used for indexed publication and rechecked against official identity',async()=>{
 const h=await harness({review:{...approval(),officialObjectId:279374},
  features:[{attributes:{parcel_number:'01002263.',object_id:279374},geometry:{rings:[ring]}}]});
 await h.publish();
 assert.equal(h.store.get(KEY).version,1);
 assert.ok(h.calls.some(u=>u.searchParams.get('where')==='object_id=279374'));
 const mismatch=await harness({review:{...approval(),officialObjectId:279374},
  features:[{attributes:{parcel_number:'01002263.',object_id:279375},geometry:{rings:[ring]}}]});
 await mismatch.publish();
 assert.equal(mismatch.store.has(KEY),false);
});
test('a pause during GIS response blocks all correction and history writes',async()=>{
 const h=await harness({pauseDuringGIS:true});
 await h.publish();
 assert.equal(h.store.get('brain-map-publication-status-v1').state,'paused');
 assert.equal(h.store.has(KEY),false);
 assert.equal(h.store.has('brain-map-history-v1'),false);
});
test('invalid staged official object ID never reaches GIS or publication',async()=>{
 const h=await harness({review:{...approval(),officialObjectId:'279374 OR 1=1'}});
 await h.publish();
 assert.equal(h.store.has(KEY),false);
 assert.equal(h.calls.filter(u=>u.hostname==='services2.arcgis.com').length,0);
});

test('recovery repairs any interrupted publication metadata write without GIS or duplicate history', async () => {
 for (const key of ['brain-map-history-v1','owner-brain-approvals-v1','owner-brain-scanner-v1']) {
  const h=await harness({failWrite:key});
  await h.publish();
  const first=h.store.get(KEY);
  assert.equal(first.records['test-record'].publicationPending,true);
  // A geometry write alone is not a completed publication. All map consumers
  // use this feed, so pending records must stay private until recovery finishes.
  const pendingFeed=await h.feed(new Request('https://preview.test/.netlify/functions/brain-map-county?dataset=MI-wayne'));
  assert.deepEqual((await pendingFeed.json()).records,{});
  assert.equal(h.store.get('brain-map-publication-status-v1').state,'error');
  const calls=h.calls.length;
  await Promise.all([h.publish(true),h.publish(true)]);
  await h.publish(true);
  const saved=h.store.get(KEY);
  assert.equal(saved.version,first.version);
  assert.deepEqual(saved.records['test-record'].g,first.records['test-record'].g);
  assert.equal(saved.records['test-record'].publicationPending,undefined);
  const readyFeed=await h.feed(new Request('https://preview.test/.netlify/functions/brain-map-county?dataset=MI-wayne'));
  assert.ok((await readyFeed.json()).records['test-record']);
  assert.equal(h.store.get('brain-map-history-v1').entries.length,1);
  assert.equal(h.store.get('owner-brain-approvals-v1').entries[0].publishStatus,'published');
  assert.equal(h.store.get('owner-brain-scanner-v1').queue[0].review.publishStatus,'published');
  assert.equal(h.calls.length,calls);
 }
});
