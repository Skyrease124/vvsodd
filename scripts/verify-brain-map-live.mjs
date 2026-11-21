// Opt-in isolated development verification; never writes to Netlify.
// Run at repo root with a parcel and an independently checked position:
// node --experimental-vm-modules scripts/verify-brain-map-live.mjs 01002263 42.37441065 -83.073996
// The review below is TEST-ONLY, not an owner approval or production publication.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const [parcel,latitude,longitude]=process.argv.slice(2);
assert.match(parcel||'',/^[0-9]{8}$/);
const lat=Number(latitude),lon=Number(longitude);
assert.ok(Number.isFinite(lat)&&Number.isFinite(lon));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'brain-map-live-'));
const file=key=>path.join(dir,encodeURIComponent(key)+'.json');
const kvGet=async key=>fs.existsSync(file(key))?JSON.parse(fs.readFileSync(file(key),'utf8')):null;
const kvPut=async(key,value)=>fs.writeFileSync(file(key),JSON.stringify(value));
const evidence=[];
const context=vm.createContext({URL,URLSearchParams,Response,AbortSignal,Buffer,console,
 fetch:async url=>{
  const u=new URL(url);
  assert.ok((u.origin==='https://pricepocketasset.com'&&u.pathname==='/map/data/MI-wayne.json')||
   (u.origin==='https://services2.arcgis.com'&&u.pathname==='/qvkbeam7Wirps6zC/arcgis/rest/services/Parcels_Current/FeatureServer/0/query'));
  const start=Date.now();
  const raw=execFileSync('curl',['-fsS','--max-time','9',String(url)],{encoding:'utf8',maxBuffer:12000000});
  const body=JSON.parse(raw);assert.ok(!body.error,JSON.stringify(body.error));
  evidence.push({url:String(url),durationMs:Date.now()-start,body});
  return new Response(raw);
 }});
const auth=new vm.SyntheticModule(['kvGet','kvPut'],function(){this.setExport('kvGet',kvGet);this.setExport('kvPut',kvPut);},{context});
async function module(filename){
 const m=new vm.SourceTextModule(fs.readFileSync(filename,'utf8'),{context});
 await m.link(specifier=>{assert.equal(specifier,'../lib/auth.mjs');return auth;});
 await m.evaluate();return m.namespace.default;
}
const recordId='MI|Wayne|'+parcel+'|';
await kvPut('owner-brain-approvals-v1',{entries:[{dataset:'MI-wayne',state:'MI',county:'Wayne',recordId,
 parcelId:parcel,decision:'approved_for_staging',independentlyChecked:true,proposedPosition:{lat,lon},
 evidenceUrl:'https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Parcels_Current/FeatureServer/0',caseKey:'LOCAL-TEST-ONLY'}]});
const publish=await module('netlify/functions/brain-map-publish-auto.mjs');
const feed=await module('netlify/functions/brain-map-county.mjs');
await publish();
const key='brain-map-county-v1-MI-wayne';
const saved=await kvGet(key),status=await kvGet('brain-map-publication-status-v1');
assert.equal(status.lastBatch?.published,1,JSON.stringify(status));
assert.equal(saved.records[recordId].verifiedGeometry,true);
const dataset=evidence.find(e=>e.url.includes('/map/data/')).body;
const source=dataset.recs.find(r=>r.i===recordId);assert.ok(source);
const official=evidence.find(e=>e.url.includes('/query?')).body.features;
assert.equal(official.length,1);
assert.equal(official[0].attributes.parcel_number.replace(/\.$/,''),parcel);
const result={parcel,recordId,officialAddress:official[0].attributes.address,objectId:official[0].attributes.object_id,
 store:dir,review:'LOCAL-TEST-ONLY; no owner approval created',surfaces:[]};
const readers=[];
for(const surface of ['Public Map merger','Workshop Map merger','MapTiler Preview merger']){
 const ds={id:'MI-wayne',recs:[structuredClone(source)]};
 const scope={window:{},URLSearchParams,fetch:()=>feed(new Request('https://development.test/.netlify/functions/brain-map-county?dataset=MI-wayne'))};
 vm.runInNewContext(fs.readFileSync('kinvest-liens/map/brain-map-merge.js','utf8'),scope);
 const apply=()=>scope.window.PPABrainMap.apply(ds);
 assert.equal((await apply()).changed,true);
 assert.deepEqual(ds.recs[0].g,official[0].geometry.rings);
 for(const field of ['k','st','t','amt'])assert.equal(ds.recs[0][field],source[field]);
 readers.push({ds,apply});result.surfaces.push({surface,geometryMatches:true,saleStatusPreserved:true});
}
await publish();assert.equal((await kvGet(key)).version,1);
assert.equal((await kvGet('brain-map-history-v1')).entries.length,1);
await kvPut(key,{version:2,records:{}});
for(const {ds,apply} of readers){assert.equal((await apply()).changed,true);assert.equal(ds.recs[0].g,null);}
result.rollback=true;result.idempotent=true;result.checkedAt=new Date().toISOString();
fs.writeFileSync(path.join(dir,'source-evidence.json'),JSON.stringify(evidence,null,2));
fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
