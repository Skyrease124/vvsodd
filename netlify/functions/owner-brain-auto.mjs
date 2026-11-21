// Netlify scheduled automation. No user traffic or page required.
// Discovers missing Wayne records and fills verified official evidence and staged decisions. The separate guarded publisher applies polygons; no credits are purchased.
import * as auth from '../lib/brain-auth.mjs';
import crypto from 'node:crypto';
import {verifyOfficial} from '../lib/brain-official-verification.mjs';
const STORE='owner-brain-scanner-v1', STATUS='owner-brain-automatic-status-v1';
const ROOT='https://pricepocketasset.com', LAYER='https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Parcels_Current/FeatureServer/0';
const norm=s=>String(s??'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const tidy=s=>String(s??'').toUpperCase().replace(/[^A-Z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const limit=(s,n=160)=>String(s??'').slice(0,n);
const fetchJson=async (url,timeout=7000)=>{
 const r=await fetch(url,{signal:AbortSignal.timeout(timeout)});if(!r.ok)throw Error('Source HTTP '+r.status);
 const raw=await r.text();if(Buffer.byteLength(raw,'utf8')>10_000_000)throw Error('Dataset too large');
 const data=JSON.parse(raw);if(data.error)throw Error(limit(data.error.message,90));return data;
};
async function exact(item){
 const id=String(item.parcelId||'');if(!/^[0-9A-Za-z.-]{4,32}$/.test(id))return {status:'unsupported',note:'Parcel ID not eligible for exact lookup'};
 const bare=id.replace(/\.$/,'');
 const where=/^[0-9]{8}$/.test(bare)?"parcel_number IN ('"+bare+"','"+bare+".')":"parcel_number = '"+id+"'";
 const params=new URLSearchParams({f:'json',where,outFields:'parcel_number,address,zip_code,total_acreage,object_id',returnGeometry:'true',outSR:'4326',resultRecordCount:'3'});
 const data=await fetchJson(LAYER+'/query?'+params,6500);
 const rows=(data.features||[]).filter(f=>norm(f.attributes?.parcel_number)===norm(id));
 if(rows.length!==1||(data.features||[]).length!==1)return {status:'no_exact_match',verified:false,note:'No unique exact ID match in Detroit assessor GIS',foundAt:new Date().toISOString()};
 const f=rows[0],pts=Array.isArray(f.geometry?.rings)?f.geometry.rings.flat().filter(p=>Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1])):[];
 if(pts.length<4)return {status:'no_geometry',verified:false,note:'Exact parcel ID found but usable geometry absent',foundAt:new Date().toISOString()};
 const lon=pts.reduce((a,p)=>a+p[0],0)/pts.length,lat=pts.reduce((a,p)=>a+p[1],0)/pts.length;
 if(lon < -83.4||lon > -82.8||lat < 42.2||lat > 42.5)return {status:'out_of_bounds',verified:false,note:'Geometry outside Detroit safety limits',foundAt:new Date().toISOString()};
 return {status:'candidate_found',verified:false,objectId:f.attributes.object_id,parcelId:id,matchedId:limit(f.attributes.parcel_number,40),address:limit(f.attributes.address),zipCode:limit(f.attributes.zip_code,12),acreage:Number.isFinite(f.attributes.total_acreage)?f.attributes.total_acreage:null,centroidApprox:{lat:Number(lat.toFixed(6)),lon:Number(lon.toFixed(6))},sourceUrl:LAYER,sourceType:'City of Detroit Assessor Parcels Current',geometryPoints:pts.length,note:'Automatic research candidate only; independent official verification required. No map changes.',foundAt:new Date().toISOString()};
}
async function address(item,rec){
 const a=String(rec?.a||'');
 const match=/^\s*(\d{1,6})\s+([a-z][a-z0-9 .'-]{2,65}?),?\s*,?\s*Detroit\b/i.exec(a);
 if(!match)return {status:'address_unavailable',verified:false,checkedAt:new Date().toISOString(),note:'No usable Detroit address'};
 const street=tidy(match[2]).replace(/\s+(ST|STREET|AVE|AVENUE|RD|ROAD|BLVD|BOULEVARD)$/,'');
 if(!street)return {status:'address_unavailable',verified:false,checkedAt:new Date().toISOString(),note:'Incomplete street'};
 const prefix=match[1]+' '+street;
 const params=new URLSearchParams({f:'json',where:"address LIKE '%"+match[1]+"%"+street.replace(/ /g,'%')+"%'",outFields:'parcel_number,address,zip_code,object_id',returnGeometry:'false',resultRecordCount:'12'});
 const data=await fetchJson(LAYER+'/query?'+params,6500);
 const candidates=(data.features||[]).map(f=>f.attributes||{}).filter(x=>tidy(x.address).startsWith(prefix+' ')||tidy(x.address)===prefix).slice(0,8).map(x=>({parcelId:limit(x.parcel_number,50),address:limit(x.address),zipCode:limit(x.zip_code,12)}));
 return {status:candidates.length?'address_candidates_unverified':'no_address_match',sourceAddress:limit(a),streetSearched:prefix,candidates,sourceUrl:LAYER,checkedAt:new Date().toISOString(),verified:false,approvable:false,note:'Automated address search only. Parcel identifiers must be checked; no location inferred.'};
}


async function handler(){
 const started=new Date().toISOString();
 const prior=await auth.kvGet(STATUS)||{runs:0,checked:0};
 const state={...prior,lastStarted:started,runs:(prior.runs||0)+1,state:'running',lastError:null};
 await auth.kvPut(STATUS,state);
 try{
 let q=await auth.kvGet(STORE)||{status:'idle',queue:[],nextRecord:0};
  if(q?.status==='paused'){state.state='paused';state.lastCompleted=new Date().toISOString();await auth.kvPut(STATUS,state);return}
  const ds=await fetchJson(ROOT+'/map/data/MI-wayne.json',8000);
  for(const r of ds.recs||[])for(const [k,dict] of Object.entries(ds.dict||{}))if(r[k]!=null)r[k]=dict[r[k]];
  if(!(q.queue||[]).some(r=>!r.review)){
   const saved=await auth.kvGet('brain-map-county-v1-MI-wayne')||{records:{}};
   const queue=[];let cursor=q.nextRecord||0;
   while(cursor<ds.recs.length&&queue.length<50){const r=ds.recs[cursor++];if(r.g||r.cx||saved.records?.[r.i])continue;queue.push({dataset:'MI-wayne',state:'MI',county:'Wayne',recordId:r.i,parcelId:r.p,issue:'Missing verified geometry'});}
   q={...q,queue,nextRecord:cursor,updatedAt:new Date().toISOString()};await auth.kvPut(STORE,q);
  }
  if(!q.queue.length){state.state='scan_complete';return;}
  const eligible=q.queue.filter(r=>r.state==='MI'&&/^(Wayne|Wayne County)$/i.test(r.county)&&!r.review&&!r.verification?.checkedAt&&(r.detroit?.status==='candidate_found'||!r.detroit?.foundAt||!r.detroitAddress?.checkedAt));
  if(!eligible.length){state.state='idle';state.note='No remaining eligible Wayne GIS cases. Geocoder runs independently every 6 hours.';state.lastCompleted=new Date().toISOString();await auth.kvPut(STATUS,state);return}
  const index=new Map((ds.recs||[]).map(r=>[r.i,r]));
  let processed=0,found=0,errors=0;
  for(const item of eligible.slice(0,1)){
    const latest=await auth.kvGet(STORE);
    if(latest?.status==='paused')break;
    const target=latest?.queue?.find(x=>x.dataset===item.dataset&&x.recordId===item.recordId);
    if(!target||target.review)continue;
    try{
      if(!target.detroit?.foundAt){target.detroit=await exact(target);if(target.detroit.status==='candidate_found')found++;}
      else if(!target.detroitAddress?.checkedAt){const rec=index.get(target.recordId);if(!rec||rec.p!==target.parcelId)throw Error('Source record changed');target.detroitAddress=await address(target,rec);}
      processed++;
      latest.updatedAt=new Date().toISOString();
      // Re-read immediately before saving: pause and owner queue actions take precedence.
      const check=await auth.kvGet(STORE);
      if(check?.status==='paused')break;
      const slot=check?.queue?.find(x=>x.dataset===target.dataset&&x.recordId===target.recordId);
      if(!slot||slot.review)continue;
      if(target.detroit)slot.detroit=target.detroit;
      if(target.detroit?.status==='candidate_found'){
       try{
        // Refresh the official feature by indexed ID; compare it to the county listing.
        const objectId=target.detroit.objectId;if(!Number.isInteger(objectId))throw Error('Official object ID unavailable');
        const url=LAYER+'/query?'+new URLSearchParams({f:'json',where:'object_id='+objectId,outFields:'parcel_number,address,object_id',returnGeometry:'true',outSR:'4326',resultRecordCount:'3'});
        const official=await fetchJson(url,6500),verified=verifyOfficial(index.get(target.recordId),official.features);
        const stamp=new Date().toISOString(),caseKey=crypto.createHash('sha256').update(target.dataset+'\n'+target.recordId).digest('hex').slice(0,28);
        const log=await auth.kvGet('owner-brain-approvals-v1')||{entries:[]};
        if(!log.entries.some(e=>e.caseKey===caseKey)){
         const entry={caseKey,dataset:target.dataset,recordId:target.recordId,parcelId:target.parcelId,state:'MI',county:'Wayne',decision:'approved_for_staging',reviewedAt:stamp,reviewedBy:'automated-official-source-validator',reviewMethod:'exact_identity_address_polygon',evidenceUrl:verified.evidenceUrl,notes:verified.notes,checks:verified.checks,independentlyChecked:true,proposedPosition:{lat:verified.cx[1],lon:verified.cx[0]},publishStatus:'not_published'};
         log.entries=[...log.entries,entry].slice(-250);await auth.kvPut('owner-brain-approvals-v1',log);
         slot.verification=entry;slot.review={decision:entry.decision,reviewedAt:stamp,caseKey};
        }
       }catch(e){slot.verification={status:'needs_review',checkedAt:new Date().toISOString(),notes:limit(e.message,180),evidenceUrl:LAYER};}
      }
      if(target.detroitAddress)slot.detroitAddress=target.detroitAddress;
      check.updatedAt=latest.updatedAt;
      await auth.kvPut(STORE,check);
    }catch(e){errors++;state.lastError=limit(e.message,140);break;}
  }
  state.checked=(state.checked||0)+processed;state.candidates=(state.candidates||0)+found;state.errors=(state.errors||0)+errors;
  state.state=errors?'partial_error':'idle';state.lastCompleted=new Date().toISOString();
  state.note=processed+' free GIS checks, '+found+' GIS candidate(s). No public map changes.';
  await auth.kvPut(STATUS,state);
 }catch(e){state.state='error';state.lastError=limit(e.message,140);state.lastCompleted=new Date().toISOString();await auth.kvPut(STATUS,state);}
}
export const config={schedule:'0 */4 * * *'};

export default auth.withBrainStore(handler);
