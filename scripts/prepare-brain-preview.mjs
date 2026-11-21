// Netlify uploads these as deploy-specific Blobs, never the production site-wide store.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {verifyOfficial,DETROIT_GIS} from '../netlify/lib/brain-official-verification.mjs';
if(process.env.CONTEXT!=='deploy-preview')throw Error('Autonomous preview preparation requires deploy-preview context');
async function read(url){
 const r=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Official source HTTP '+r.status);
 const raw=await r.text();if(raw.length>12000000)throw Error('Source too large');
 const body=JSON.parse(raw);if(body.error)throw Error(body.error.message);return body;
}
const ds=JSON.parse(fs.readFileSync('kinvest-liens/map/data/MI-wayne.json','utf8'));
const id='MI|Wayne|01002263|',raw=ds.recs.find(r=>r.i===id);if(!raw)throw Error('Preview parcel missing from source dataset');
const record={...raw};for(const [key,dict] of Object.entries(ds.dict||{}))if(record[key]!=null)record[key]=dict[record[key]];
const sourceUrl=DETROIT_GIS+'/query?'+new URLSearchParams({f:'json',where:'object_id=279374',outFields:'parcel_number,address,object_id',returnGeometry:'true',outSR:'4326'});
const source=await read(sourceUrl),verified=verifyOfficial(record,source.features);
const refreshed=await read(sourceUrl);verifyOfficial(record,refreshed.features);
if(JSON.stringify(source.features)!==JSON.stringify(refreshed.features))throw Error('Official source changed during verification');
const at=new Date().toISOString(),caseKey=crypto.createHash('sha256').update('MI-wayne\n'+id).digest('hex').slice(0,28);
const entry={caseKey,dataset:'MI-wayne',recordId:id,parcelId:record.p,state:'MI',county:'Wayne',decision:'approved_for_staging',reviewedAt:at,reviewedBy:'automated-official-source-validator',reviewMethod:'exact_identity_address_polygon',notes:verified.notes,evidenceUrl:sourceUrl,independentlyChecked:true,proposedPosition:{lat:verified.cx[1],lon:verified.cx[0]},publishStatus:'published',checks:verified.checks};
const patch={i:id,p:record.p,g:verified.g,bb:verified.bb,cx:verified.cx,verifiedGeometry:true,verifiedAt:at,evidenceUrl:sourceUrl,caseKey};
const store={
 'brain-source-events-v1':{entries:[{sourceId:'detroit-official-parcel-01002263',url:sourceUrl,checkedAt:at,changed:false,status:'verified_official_polygon'}]},
 'owner-brain-scanner-v1':{status:'idle',built:ds.built||at,updatedAt:at,queue:[{dataset:'MI-wayne',recordId:id,parcelId:record.p,state:'MI',county:'Wayne',issue:'Verified automatically from official GIS',verification:entry,review:{decision:entry.decision,reviewedAt:at,caseKey,publishStatus:'published'}}]},
 'owner-brain-approvals-v1':{entries:[entry]},
 'brain-map-county-v1-MI-wayne':{version:1,updatedAt:at,records:{[id]:patch}},
 'brain-map-history-v1':{entries:[{dataset:'MI-wayne',recordId:id,parcelId:record.p,action:'published',source:'automated official Detroit GIS verification',reviewCase:caseKey,at}]},
 'brain-map-publication-status-v1':{state:'idle',runs:1,published:1,skipped:0,lastCompleted:at,lastBatch:{published:1,skipped:0},mode:'autonomous-preview',checks:verified.checks}
};
const dir='.netlify/blobs/deploy';fs.mkdirSync(dir,{recursive:true});
for(const [key,value] of Object.entries(store))fs.writeFileSync(path.join(dir,key),JSON.stringify(value));
console.log('Autonomous preview: official parcel '+record.p+' verified; source URL, notes, decision, correction and history saved to deploy-specific storage.');
