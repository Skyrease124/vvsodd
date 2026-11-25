// Guarded owner-approved Brain-to-Map publication pilot for Detroit city parcels.
// Uses official current GIS polygon (not geocoded positions) and explicit staging review.
// Writes only the dynamic map overlay store, not static parcel data / tax sale status.
import * as auth from '../lib/brain-auth.mjs';
import {publishable} from '../lib/brain-approvals.mjs';
import {releaseTimes} from '../lib/update-release.mjs';
const APPROVALS='owner-brain-approvals-v1',STATUS='brain-map-publication-status-v1';
const OVERLAY='brain-map-county-v1-MI-wayne';
const HISTORY='brain-map-history-v1', QUEUE='owner-brain-scanner-v1';

// Start from the deploy seed if the persistent preview has no value yet.
async function update(key, mutate){
 for(let attempt=0;attempt<8;attempt++){
  const snapshot=await auth.kvGetVersioned(key);
  const current=snapshot?snapshot.data:await auth.kvGet(key);
  const next=mutate(current);
  if(next===undefined)return false;
  if(await auth.kvPutVersioned(key,next,snapshot?snapshot.etag:null))return true;
 }
 throw Error('Publication storage busy: '+key);
}
async function reconcile(record){
 const at=record.verifiedAt;
 await update(HISTORY,current=>{
  const entries=current?.entries||[];
  if(entries.some(x=>x.action==='published'&&x.dataset==='MI-wayne'&&x.recordId===record.i&&x.reviewCase===record.caseKey&&x.at===at))return;
  const event={dataset:'MI-wayne',recordId:record.i,parcelId:record.p,action:'published',source:'official Detroit current parcel GIS',reviewCase:record.caseKey,at};
  return {...current,entries:[event,...entries].slice(0,300)};
 });
 await update(APPROVALS,current=>{
  const entries=current?.entries||[];
  const match=x=>x.caseKey===record.caseKey&&x.dataset==='MI-wayne'&&x.recordId===record.i&&x.decision==='approved_for_staging';
  if(!entries.some(x=>match(x)&&(x.publishStatus!=='published'||x.publishedAt!==at)))return;
  return {...current,entries:entries.map(x=>match(x)?{...x,publishStatus:'published',publishedAt:at}:x)};
 });
 await update(QUEUE,current=>{
  const match=x=>x.dataset==='MI-wayne'&&x.recordId===record.i&&x.review?.decision==='approved_for_staging'&&
   (!x.review.caseKey||x.review.caseKey===record.caseKey);
  if(!current?.queue?.some(x=>match(x)&&x.review.publishStatus!=='published'))return;
  return {...current,queue:current.queue.map(x=>match(x)?{...x,review:{...x.review,publishStatus:'published'}}:x)};
 });
 // The polygon and its pending marker were committed together. Clear the
 // marker only after every secondary write has completed.
 await update(OVERLAY,current=>{
  const saved=current?.records?.[record.i];
  if(!saved?.publicationPending||saved.caseKey!==record.caseKey||saved.verifiedAt!==at)return;
  const {publicationPending,...completed}=saved;
  return {...current,records:{...current.records,[record.i]:completed}};
 });
}

const ROOT='https://pricepocketasset.com';
const GIS='https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Parcels_Current/FeatureServer/0';
const norm=s=>String(s??'').toUpperCase().replace(/[^A-Z0-9]/g,'');
async function json(url,limit=9000000,redirect='follow'){
 const r=await fetch(url,{signal:AbortSignal.timeout(9000),redirect});
 if(!r.ok)throw Error('HTTP '+r.status);
 const body=await r.text();if(Buffer.byteLength(body)>limit)throw Error('Response too large');
 const data=JSON.parse(body);if(data.error)throw Error(data.error.message||'Provider error');
 return data;
}
function officialPolygon(rings){
 if(!Array.isArray(rings)||rings.length!==1)return null; // no holes or multipart in pilot
 const ring=rings[0];if(!Array.isArray(ring)||ring.length<4||ring.length>6000)return null;
 const coords=[];let minX=180,minY=90,maxX=-180,maxY=-90;
 for(const p of ring){
  if(!Array.isArray(p)||!Number.isFinite(p[0])||!Number.isFinite(p[1]))return null;
  const [x,y]=p;
  if(x< -83.4||x> -82.8||y<42.2||y>42.5)return null;
  minX=Math.min(x,minX);maxX=Math.max(x,maxX);minY=Math.min(y,minY);maxY=Math.max(y,maxY);
  coords.push([x,y]);
 }
 if(coords[0][0]!==coords.at(-1)[0]||coords[0][1]!==coords.at(-1)[1]||maxX-minX>0.02||maxY-minY>0.02)return null;
 if((maxX-minX)<1e-7||(maxY-minY)<1e-7)return null;
 return {g:[coords],bb:[minX,minY,maxX,maxY],cx:[(minX+maxX)/2,(minY+maxY)/2]};
}
async function handler(req,context){
 // Only the guarded Wayne worker may invoke publication. Public function requests cannot publish.
 if(context?.waynePublisherInternal!==true||typeof context.chargeWayneGisRequest!=='function')
  return new Response(JSON.stringify({ok:false,error:'Publisher is internal to guarded Wayne worker'}),{status:403,headers:{'Content-Type':'application/json'}});
 if(context.wayneRecoveryOnly){
  if((await auth.kvGet(QUEUE))?.status==='paused')return;
  const overlay=await auth.kvGet(OVERLAY);
  for(const record of Object.values(overlay?.records||{}).filter(r=>r?.publicationPending===true).slice(0,5)){
   if((await auth.kvGet(QUEUE))?.status==='paused')return;
   await reconcile(record);
  }
  return;
 }
 const last=await auth.kvGet(STATUS)||{runs:0,published:0,skipped:0};
 const status={...last,runs:(last.runs||0)+1,lastStarted:new Date().toISOString(),state:'running',lastError:null};
 await auth.kvPut(STATUS,status);
 let passed=0,skipped=0;
 try{
  const control=await auth.kvGet('owner-brain-scanner-v1');
  if(control?.status==='paused'){status.state='paused';return;}
  const log=await auth.kvGet(APPROVALS)||{entries:[]};
  // Only a decision a human owner made can publish. Validator decisions stay pending.
  const approved=(log.entries||[]).filter(x=>publishable(x)&&x.dataset==='MI-wayne'&&x.state==='MI'&&x.county&&x.recordId&&x.parcelId);
  if(!approved.length){status.state='waiting_for_approved_polygons';return;}
  const county=await json(ROOT+'/map/data/MI-wayne.json',12000000);
  const source=new Map((county.recs||[]).map(r=>[r.i,r]));
  const key=OVERLAY;
  const saved=await auth.kvGet(key)||{version:0,records:{}};
  const heldRecords=context.wayneHeldRecords;
  const eligible=approved.filter(a=>!saved.records[a.recordId]&&!heldRecords?.has(a.recordId));
  const current=eligible.find(a=>a.recordId===context.wayneCurrentRecord);
  const candidates=context.wayneCurrentOnly?(current?[current]:[]):current?[current,...eligible.filter(a=>a!==current)]:eligible;
  for(const a of candidates.slice(0,5)){
   const reject=reason=>{skipped++;context.wayneRecordRejected?.(a.recordId,reason);};
   if(saved.records[a.recordId])continue;
   const lat=a.proposedPosition?.lat,lon=a.proposedPosition?.lon;
   if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<42.2||lat>42.5||lon< -83.4||lon> -82.8){reject('Position outside publisher bounds');continue;}
   const original=source.get(a.recordId);
   if(!original||original.g||original.cx||norm(original.p)!==norm(a.parcelId)){reject('Original dataset identity changed or already mapped');continue;}
   if(!a.evidenceUrl||!/^https:\/\/(?:services2\.arcgis\.com|detroitmi\.gov|data\.detroitmi\.gov)\//i.test(a.evidenceUrl)){reject('Unapproved GIS evidence source');continue;}
   if(a.independentlyChecked!==true){reject('Independent verification is missing');continue;}
   // Detroit GIS uses a trailing period on some tax parcel IDs. Accept only
   // the exact identifier or that known variant; never use a prefix match.
   const parcel=String(a.parcelId);
   if(!/^[0-9]{8}\.?$/.test(parcel)){reject('Publisher parcel number is invalid');continue;}
   const bare=parcel.replace(/\.$/,'');
   // Prefer the indexed object ID already established by the independent
   // verifier. Old owner-reviewed approvals still use the bounded legacy query.
   const objectId=a.officialObjectId;
   const indexed=Number.isSafeInteger(objectId)&&objectId>0;
   if(objectId!=null&&!indexed){reject('Publisher object ID is invalid');continue;}
   const clause=indexed?'object_id='+objectId:"parcel_number IN ('"+bare+"','"+bare+".')";
   const params={f:'json',where:clause,outFields:'parcel_number,address,object_id',returnGeometry:'true',outSR:'4326',resultRecordCount:'3'};
   if(!indexed){
    const envelope=JSON.stringify({xmin:lon-0.002,ymin:lat-0.002,xmax:lon+0.002,ymax:lat+0.002,spatialReference:{wkid:4326}});
    Object.assign(params,{geometry:envelope,geometryType:'esriGeometryEnvelope',inSR:'4326',spatialRel:'esriSpatialRelIntersects'});
   }
   const url=GIS+'/query?'+new URLSearchParams(params);
   let result;
   try{
    // Charge before dispatch, including failed GIS requests. The worker owns the shared daily cap.
    await context.chargeWayneGisRequest();
    result=await json(url,1000000,'error');
   }catch(e){
    status.lastError=String(e.message).slice(0,120);
    if(!['QUOTA','PAUSED'].includes(e.code))context.waynePublicationUnavailable?.();
    break;
   }
   // A pause can happen while awaiting the remote provider. Nothing may
   // publish after the pause, even if the GIS request succeeds.
   const latestControl=await auth.kvGet('owner-brain-scanner-v1');
   if(latestControl?.status==='paused'){status.state='paused';break;}
   if(!Array.isArray(result.features)||result.exceededTransferLimit){status.lastError='Incomplete GIS publication response';context.waynePublicationUnavailable?.();break;}
   const fs=result.features;
   if(fs.length!==1||norm(fs[0].attributes?.parcel_number)!==norm(a.parcelId)||indexed&&fs[0].attributes?.object_id!==objectId){reject('Independent GIS lookup did not confirm exact identity');continue;}
   const poly=officialPolygon(fs[0].geometry?.rings);
   if(!poly){reject('Independent GIS lookup did not return a valid polygon');continue;}
   // Owner's previously reviewed GIS position must be close to the freshly retrieved official polygon.
   if(Math.abs(a.proposedPosition.lat-poly.cx[1])>0.002||Math.abs(a.proposedPosition.lon-poly.cx[0])>0.002){reject('Independent GIS polygon conflicts with verified position');continue;}
   const stamp=new Date().toISOString();
   // The release clock starts at owner approval, not at publication.
   const release=releaseTimes({approvedAt:a.reviewedAt,releaseMode:a.releaseMode||'pro_first_48h'});
   const record={i:a.recordId,p:String(a.parcelId),...poly,verifiedGeometry:true,verifiedAt:stamp,evidenceUrl:GIS,caseKey:a.caseKey,approvedBy:'owner',...release};
   const preWriteControl=await auth.kvGet(QUEUE);
   if(preWriteControl?.status==='paused'){status.state='paused';break;}
   const added=await update(key,value=>{
    const current=value||{version:0,records:{}};
    if(current.records[a.recordId])return;
    return {...current,version:(current.version||0)+1,updatedAt:stamp,records:{
     ...current.records,[a.recordId]:{...record,publicationPending:true}
    }};
   });
   if(!added)continue;
   await reconcile(record);
   passed++;
  }
  status.published=(status.published||0)+passed;
  status.skipped=(status.skipped||0)+skipped;
  status.lastBatch={published:passed,skipped};
  if(status.state==='running')status.state='idle';
 }catch(e){status.state='error';status.lastError=String(e.message).slice(0,140);}
 finally{status.lastCompleted=new Date().toISOString();await auth.kvPut(STATUS,status);}
}
// No independent production schedule: publish only as part of a verified Wayne worker batch.


export default auth.withBrainStore(handler);
