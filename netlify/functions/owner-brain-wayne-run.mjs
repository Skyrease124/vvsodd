// Preview-only bounded Wayne County worker. Each owner-triggered run resumes its cursor.
// No paid AI. Official Detroit parcels only; ambiguous records are flagged, not geocoded.
import * as auth from '../lib/brain-auth.mjs';
import {verifyOfficial,DETROIT_GIS} from '../lib/brain-official-verification.mjs';
import publish from './brain-map-publish-auto.mjs';
import crypto from 'node:crypto';

const DATA='https://pricepocketasset.com/map/data/MI-wayne.json';
const STORE='owner-brain-wayne-worker-v1', OVERLAY='brain-map-county-v1-MI-wayne';
const CONTROL='owner-brain-scanner-v1', APPROVALS='owner-brain-approvals-v1';
const MAX_ATTEMPTS=3, MAX_PER_DAY=30, LEASE_MS=90000;
const RETRY_DELAYS_MS=[60000,180000];
const PILOT_REQUEST_LIMIT=3;
const SOURCE_COOLDOWN_MS=15*60000;
const response=(code,body)=>new Response(JSON.stringify(body),{status:code,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Cookie','X-Robots-Tag':'noindex, nofollow'}});
const today=()=>new Date().toISOString().slice(0,10);
const valid=r=>r?.i&&/^[0-9]{8}\.?$/.test(String(r.p||''))&&!r.g&&!r.cx&&
  /^\s*\d{1,6}\s+[A-Za-z0-9][^,]{2,75},?\s+Detroit\b/i.test(String(r.a||''));
async function get(url,max=12000000,timeout=8500,redirect='follow'){
 const res=await fetch(url,{signal:AbortSignal.timeout(timeout),redirect});
 if(!res.ok)throw Error('Source HTTP '+res.status);
 const raw=await res.text();
 if(Buffer.byteLength(raw)>max)throw Error('Source too large');
 const parsed=JSON.parse(raw);
 if(parsed.error)throw Error('Official GIS provider error');
 return parsed;
}
function state(value){
 return value&&Number.isSafeInteger(value.cursor)&&value.cursor>=0?value:
 {cursor:0,day:today(),dailyUsed:0,runs:0,verified:0,published:0,needsReview:0,failures:0,recent:[]};
}
async function handler(req,context){
 let reviewRequest=null,pilot=null;
 const scheduled=context?.internalScheduled===true;
 if(scheduled){
  if(context?.deploy?.context!=='production')return response(404,{ok:false,error:'Scheduled execution requires published production deployment'});
 }else if(context?.deploy?.context!=='deploy-preview'||!auth.isBrainPreview())return response(404,{ok:false,error:'Deploy preview only'});
 if(req.method!=='GET'&&req.method!=='POST')return response(405,{ok:false,error:'GET or POST only'});
 if(!scheduled){
  const user=await auth.userFromCookie(req.headers.get('cookie')||'');
  if(!user?.owner)return response(user?403:401,{ok:false,error:'Owner access required'});
 }
 if(req.method==='GET'&&!scheduled){
  const s=state(await auth.kvGet(STORE));
  const quota=await auth.readWayneGisQuota();
  return response(200,{ok:true,previewOnly:true,...s,dailyUsed:quota.active?quota.count:null,legacyDailyUsed:quota.active?undefined:s.dailyUsed,quotaActive:quota.active,quotaResumeAt:quota.resumeAt,lockedUntil:s.lockedUntil||null,maxAttempts:MAX_ATTEMPTS,dailyLimit:MAX_PER_DAY});
 }
 if(!scheduled&&req.headers.get('origin')!==new URL(req.url).origin)return response(403,{ok:false,error:'Invalid origin'});
 if(!scheduled){
  let body;try{const raw=await req.text();if(raw.length>500)throw Error();body=JSON.parse(raw);}catch{return response(400,{ok:false,error:'Invalid request'});}
  if(body?.confirmed!==true||!['run-wayne-batch','retry-skipped-parcel','run-live-wayne-pilot'].includes(body.action))
   return response(400,{ok:false,error:'Explicit confirmation required'});
  if(body.action==='run-live-wayne-pilot'){
   if(!Number.isSafeInteger(body.cursor)||body.cursor<0||!(body.lastStarted===null||typeof body.lastStarted==='string'))
    return response(400,{ok:false,error:'Refresh the saved pilot checkpoint before confirming'});
   pilot=body;
  }
  if(body.action==='retry-skipped-parcel'){
   if(!Number.isSafeInteger(body.index)||body.index<0||typeof body.parcelId!=='string'||typeof body.checkedAt!=='string')
    return response(400,{ok:false,error:'Select an exact saved review entry'});
   reviewRequest=body;
  }
 }
 const control=await auth.kvGet(CONTROL);
 if(control?.status==='paused')return response(409,{ok:false,error:'Automation paused'});
 const snapshot=await auth.kvGetVersioned(STORE);
 let s=state(snapshot?.data);
 if(s.lockedUntil&&Date.parse(s.lockedUntil)>Date.now())return response(409,{ok:false,error:'Another batch run is in progress'});
 if(s.day!==today())s={...s,day:today(),dailyUsed:0};
 const quota=await auth.readWayneGisQuota();
 if(quota.active)s.dailyUsed=quota.count;
 const existingOverlay=await auth.kvGet(OVERLAY)||{records:{}};
 const recoveryPending=Object.values(existingOverlay.records||{}).some(record=>record?.publicationPending===true);
 if(pilot){
  if(pilot.cursor!==s.cursor||pilot.lastStarted!==(s.lastStarted||null))
   return response(409,{ok:false,error:'Pilot checkpoint changed; refresh before confirming'});
  if(recoveryPending||s.retry?.exhausted||[s.sourcePause?.nextAt,s.retry?.nextAt].some(at=>Date.parse(at)>Date.now()))
   return response(409,{ok:false,error:'Resolve the publication or retry hold before the live pilot'});
  if(!quota.active||MAX_PER_DAY-quota.count<PILOT_REQUEST_LIMIT)
   return response(429,{ok:false,error:'The live pilot needs three available shared GIS requests'});
 }
 if(!recoveryPending&&quota.active&&s.dailyUsed>=MAX_PER_DAY)return response(429,{ok:false,error:'Official GIS daily cap reached'});
 const review=reviewRequest&&s.reviewQueue?.[reviewRequest.index];
 if(reviewRequest&&(!review||review.resolvedAt||review.parcelId!==reviewRequest.parcelId||review.checkedAt!==reviewRequest.checkedAt))
  return response(409,{ok:false,error:'Review entry changed; refresh before retrying'});
 const nextAt=s.sourcePause?.nextAt||(!review&&s.retry?.nextAt);
 if(!recoveryPending&&Date.parse(nextAt)>Date.now())return response(200,{
  ok:true,previewOnly:!scheduled,state:s.sourcePause?'source_paused':'retry_wait',cursor:s.cursor,
  attempted:0,verified:0,published:0,needsReview:0,failures:0,
  dailyUsed:s.dailyUsed,dailyLimit:MAX_PER_DAY,retry:s.retry,sourcePause:s.sourcePause,rows:[]
 });
 const token=crypto.randomUUID();
 s={...s,token,lockedUntil:new Date(Date.now()+LEASE_MS).toISOString(),lastStarted:new Date().toISOString(),state:'running'};
 let version=await auth.kvPutVersioned(STORE,s,snapshot ? snapshot.etag : null);
 if(!version)return response(409,{ok:false,error:'Worker state changed; refresh before running'});
 async function saveProgress(value){
  if(Date.parse(s.lockedUntil)<=Date.now())throw Error('Batch lease expired');
  version=await auth.kvPutVersioned(STORE,value,version);
  if(!version)throw Error('Batch lost its lease');
 }
 let pilotRequests=0, savedRows=0;
 const result={attempted:0,verified:0,published:0,needsReview:0,failures:0,rows:[]};
 function saveRecent(){
  const fresh=result.rows.slice(savedRows);
  if(!fresh.length)return;
  s.recent=[...fresh.reverse(),...(s.recent||[]).filter(row=>row.checkedAt)].slice(0,40);
  savedRows=result.rows.length;
 }
 try{
  if(recoveryPending){
   await publish(req,{...context,waynePublisherInternal:true,wayneRecoveryOnly:true,
    chargeWayneGisRequest:async()=>{throw Error('Recovery cannot dispatch GIS');}});
   const records=(await auth.kvGet(OVERLAY))?.records||{};
   const recovered=Object.values(existingOverlay.records||{}).filter(record=>record?.publicationPending
    &&records[record.i]?.verifiedAt===record.verifiedAt&&!records[record.i]?.publicationPending);
   s.state=Object.values(records).some(record=>record?.publicationPending)?'publish_pending':'idle';
   s.lastCompleted=new Date().toISOString();
   return response(200,{ok:true,state:s.state,cursor:s.cursor,attempted:0,verified:0,
    published:0,recovered:recovered.length,dailyUsed:s.dailyUsed,dailyLimit:MAX_PER_DAY,retry:s.retry||null,rows:[],
    message:'Recovered '+recovered.length+' saved publication records without another GIS lookup'});
  }
  const ds=await get(DATA);
  const rows=(ds.recs||[]).map(r=>{
   const decoded={...r};
   for(const [field,dictionary] of Object.entries(ds.dict||{}))
    if(decoded[field]!=null)decoded[field]=dictionary[decoded[field]];
   return decoded;
  });
  const overlay=await auth.kvGet(OVERLAY)||{records:{}};
  let i=review?reviewRequest.index:Math.min(s.cursor,rows.length);
  const activeRetry=()=>review?s.reviewRetry:s.retry;
  function setRetry(retry){
   if(review)s.reviewRetry=retry;
   else s.retry=retry;
  }
  s.reviewQueue={...s.reviewQueue};
  if(review&&overlay.records?.[review.recordId]?.verifiedGeometry===true)
   return response(409,{ok:false,error:'Parcel already has saved verified geometry'});
  if(review&&(!valid(rows[i])||rows[i].i!==review.recordId||String(rows[i].p).replace(/\.$/,'')!==review.parcelId))
   return response(409,{ok:false,error:'Dataset row changed; review the parcel before retrying'});
  async function checkpoint(){
   if(!review)s.cursor=i;
   saveRecent();
   await saveProgress(s);
  }
  async function skip(r,id,reason,stage,trace,failed=false){
   const entry={recordId:r.i,parcelId:id,status:'skipped',checkedAt:new Date().toISOString(),
    reason,failedStage:stage,gisTrace:trace,failed};
   const prior=s.reviewQueue[i]||review;
   if(prior)entry.previousEvidence=[...(prior.previousEvidence||[]),
    {checkedAt:prior.checkedAt,reason:prior.reason,failedStage:prior.failedStage,gisTrace:prior.gisTrace}];
   s.reviewQueue[i]=entry;
   result.rows.push(entry);
   result.needsReview++;
   setRetry(null);
   i++;
   await checkpoint();
  }

  // Netlify scheduled invocations have a shorter 30-second limit.
  // Keep their batch to one parcel, using exactly the same verification path.
  const maxThisRun=scheduled||review?1:MAX_ATTEMPTS;
  // Charge every actual GIS HTTP request, including fallback, to the daily cap.
  // Diagnostics record the stage, duration and outcome, never request URLs or private keys.
  // A request is counted before dispatch; its outcome is preserved with the batch.
  let trace=[];
  async function charge(recordIndex,stage){
   if(pilot&&pilotRequests>=PILOT_REQUEST_LIMIT)throw Object.assign(Error('Live pilot GIS request limit reached'),{code:'QUOTA',quotaState:'pilot_limit',stage});
   if(quota.active&&s.dailyUsed>=MAX_PER_DAY)throw Object.assign(Error('Daily GIS request limit reached'),{code:'QUOTA',stage});
   if((await auth.kvGet(CONTROL))?.status==='paused')throw Object.assign(Error('Automation paused'),{code:'PAUSED',stage});
   await saveProgress({...s,cursor:review?s.cursor:recordIndex});
   s.dailyUsed=await auth.reserveWayneGisRequest();
   if(pilot)pilotRequests++;
  }
  async function officialGet(url,recordIndex,timeout=6500,stage='direct_polygon'){
   await charge(recordIndex,stage);
   const started=Date.now();
   try{
    const data=await get(url,1000000,timeout,'error');
    trace.push({stage,status:'ok',durationMs:Date.now()-started,at:new Date().toISOString()});
    return data;
   }catch(e){
    const reason=e.name==='TimeoutError'||e.name==='AbortError'||/timeout|aborted/i.test(String(e.message))?'timeout':
      /HTTP 429/.test(String(e.message))?'rate_limited':/HTTP 5\d\d/.test(String(e.message))?'server_error':'provider_error';
    trace.push({stage,status:reason,durationMs:Date.now()-started,at:new Date().toISOString()});
    e.stage=stage;
    throw e;
   }
  }
  function queryUrl(params){return DETROIT_GIS+'/query?'+new URLSearchParams({f:'json',outFields:'parcel_number,address,object_id',...params});}
  async function lookupWithObjectId(parcelId,recordIndex){
   // Lightweight identifier-only request, then indexed geometry lookup.
   // Never choose an arbitrary object ID or fallback to coordinates/geocoding.
   const bare=parcelId.replace(/\.$/,'');
   const ids=await officialGet(queryUrl({where:"parcel_number IN ('"+bare+"','"+bare+".')",returnIdsOnly:'true',returnGeometry:'false'}),recordIndex,5500,'object_id_resolution');
   const objectIds=ids.objectIds;
   if(ids.exceededTransferLimit||!Array.isArray(objectIds))throw Error('Official GIS identifier response malformed');
   if(objectIds.length!==1||!Number.isSafeInteger(objectIds[0])||objectIds[0]<=0)
    throw Object.assign(Error(objectIds.length===0?'Parcel missing from official GIS':'Official object ID invalid or ambiguous'),{code:'AMBIGUOUS'});
   const official=await officialGet(queryUrl({objectIds:String(objectIds[0]),returnGeometry:'true',outSR:'4326',resultRecordCount:'2'}),recordIndex,6500,'indexed_polygon');
   if(official.exceededTransferLimit||!Array.isArray(official.features))throw Error('Official GIS geometry response malformed');
   if(official.features.length!==1||
      official.features[0]?.attributes?.object_id!==objectIds[0])
    throw Object.assign(Error('Official object ID lookup mismatch'),{code:'AMBIGUOUS'});
   return official;
  }
  while(i<rows.length&&result.attempted<maxThisRun&&(!quota.active||s.dailyUsed<MAX_PER_DAY)&&(!review||i===reviewRequest.index)&&(!pilot||pilotRequests<PILOT_REQUEST_LIMIT)){
   const controlNow=await auth.kvGet(CONTROL);
   if(controlNow?.status==='paused'){s.state='paused';break;}
   const r=rows[i];
   if(!valid(r)||overlay.records?.[r?.i]||(!review&&s.reviewQueue[i]?.recordId===r.i)){i++;continue;}
   const id=String(r.p).replace(/\.$/,'');
   if(activeRetry()&&(activeRetry().parcelId!==id||activeRetry().cursor!==i))setRetry(null);
   if(activeRetry()?.exhausted){
    if(activeRetry().parcelSpecific===true){
     await skip(r,id,activeRetry().lastError,activeRetry().failedStage,activeRetry().gisTrace||[],true);
     continue;
    }
    setRetry(null); // Legacy provider hold gets a bounded source probe.
   }
   if(Date.parse(activeRetry()?.nextAt)>Date.now()){s.state='retry_wait';break;}
   // Count one parcel attempt; GIS request usage is counted separately.
   result.attempted++;
   trace=[];
   const url=queryUrl({where:"parcel_number IN ('"+id+"','"+id+".')",
    returnGeometry:'true',outSR:'4326',resultRecordCount:'3'});
   let official,verified,method='indexed_object_id';
   try{
    try{
     // Resolve the indexed official object ID first, avoiding a heavy polygon scan.
     official=await lookupWithObjectId(id,i);
    }catch(primary){
     if(/HTTP (401|403|402|429|5\d\d)\b/.test(String(primary.message)))throw primary;
     if(primary.code==='PAUSED'||primary.code==='QUOTA'||primary.code==='AMBIGUOUS')throw primary;
     // Fall back only for transient provider failures, never ambiguous identity.
     if(primary.name!=='TimeoutError'&&primary.name!=='AbortError'&&
        !/timed?\s*out|aborted|HTTP (429|5\d\d)/i.test(String(primary.message)))
      throw primary;
     method='direct';
     official=await officialGet(url,i,6500,'direct_polygon');
     if(official.exceededTransferLimit||!Array.isArray(official.features))throw Error('Official GIS geometry response malformed');
    }
   }catch(e){
    if(e.code==='PAUSED'){s.state='paused';break;}
    if(e.code==='QUOTA'){
     s.state=e.quotaState||'quota_reached';
     if(!trace.length)result.attempted--;
     break;
    }
    if(e.code==='AMBIGUOUS'){
     s.sourcePause=null;
     await skip(r,id,String(e.message).slice(0,110),e.stage||'object_id_validation',trace.slice());
     continue;
    }
    result.failures++;
    const attempts=(activeRetry()?.attempts||0)+1;
    // A successful ID query plus an indexed polygon HTTP 404 is evidence
    // about this parcel. Timeouts, access errors and 5xx can affect the source.
    const parcelSpecific=e.stage==='indexed_polygon'&&/HTTP 404\b/.test(String(e.message));
    const reason=String(e.message).slice(0,110);
    if(parcelSpecific&&attempts>=MAX_ATTEMPTS){
     s.sourcePause=null;
     await skip(r,id,reason,e.stage,trace.slice(),true);
     continue;
    }
    const sourcePause=!parcelSpecific&&(attempts>=MAX_ATTEMPTS||/HTTP (401|402|403|429|5\d\d)\b/.test(reason));
    const nextAt=new Date(Date.now()+(sourcePause?SOURCE_COOLDOWN_MS:RETRY_DELAYS_MS[attempts-1])).toISOString();
    s.sourcePause=sourcePause?{nextAt,reason}:null;
    setRetry({parcelId:id,cursor:i,attempts:sourcePause?0:attempts,maxAttempts:MAX_ATTEMPTS,
     nextAt,exhausted:false,lastError:reason,failedStage:e.stage||'unknown',gisTrace:trace.slice(),parcelSpecific});
    s.state=sourcePause?'source_paused':'retry_wait';
    result.rows.push({parcelId:id,status:'retry_later',checkedAt:new Date().toISOString(),reason,
     retryAttempt:attempts,nextRetryAt:nextAt,failedStage:e.stage||'unknown',gisTrace:trace.slice()});
    await checkpoint();
    break;
   }
   s.sourcePause=null;
   setRetry(null);
   try{
    verified=verifyOfficial(r,official.features);
    if(!Number.isSafeInteger(verified.officialObjectId)||verified.officialObjectId<=0)throw Error('Official object ID unavailable');
   }catch(e){
    await skip(r,id,String(e.message).slice(0,110),'parcel_verification',trace.slice());
    continue;
   }
   result.verified++;
   const now=new Date().toISOString();
   const caseKey=crypto.createHash('sha256').update('MI-wayne\n'+r.i).digest('hex').slice(0,28);
   const item={caseKey,dataset:'MI-wayne',recordId:r.i,parcelId:r.p,state:'MI',county:'Wayne',
    decision:'approved_for_staging',reviewedAt:now,reviewedBy:'preview-wayne-batch-validator',
    reviewMethod:'exact_identity_address_polygon',independentlyChecked:true,officialObjectId:verified.officialObjectId,
    evidenceUrl:verified.evidenceUrl,notes:verified.notes,checks:verified.checks,
    proposedPosition:{lat:verified.cx[1],lon:verified.cx[0]},publishStatus:'not_published'};
   const beforeWrite=await auth.kvGet(CONTROL);
   if(beforeWrite?.status==='paused'){s.state='paused';break;}
   const approvals=await auth.kvGet(APPROVALS)||{entries:[]};
   const priorApproval=approvals.entries.find(x=>x.caseKey===caseKey);
   if(!priorApproval||(review&&priorApproval.reviewedBy==='preview-wayne-batch-validator')){
    await auth.kvPut(APPROVALS,{...approvals,entries:[...approvals.entries.filter(x=>x!==priorApproval),item].slice(-250)});
   }
   // Existing guarded publisher independently checks the official polygon and
   // the shared pause switch; the saved overlay is authoritative for success.
   let publicationRejection,publicationUnavailable=false,publicationHold;
   const wayneHeldRecords=new Set(Object.values(s.reviewQueue).filter(entry=>!entry.resolvedAt&&entry.recordId!==r.i).map(entry=>entry.recordId));
   await publish(req,{...context,wayneCurrentRecord:r.i,wayneHeldRecords,
    waynePublicationUnavailable:()=>{publicationUnavailable=true;},
    wayneRecordRejected:(recordId,reason)=>{if(recordId===r.i)publicationRejection=reason;},
    wayneCurrentOnly:!!pilot,
    waynePublisherInternal:true,chargeWayneGisRequest:async()=>{
     try{await charge(i,'independent_publication_check');}
     catch(error){publicationHold=error;throw error;}
   }});
   const published=await auth.kvGet(OVERLAY)||{records:{}};
   const saved=published.records?.[r.i];
   const success=saved?.verifiedGeometry===true&&!saved.publicationPending;
   if(!success&&publicationRejection&&!saved?.publicationPending){
    await skip(r,id,publicationRejection,'independent_publication_check',trace.slice());
    continue;
   }
   result.rows.push({parcelId:id,status:success?'published':'publish_pending',lookupMethod:method,checkedAt:new Date().toISOString(),gisTrace:trace.slice()});
   if(success){
    result.published++;
    if(review)s.reviewQueue[i]={...review,resolvedAt:now};
   }
   else {
    s.state=pilot&&publicationHold?(publicationHold.quotaState||(publicationHold.code==='PAUSED'?'paused':'quota_reached')):'publish_pending';
    if(publicationUnavailable&&!saved?.publicationPending){
     s.sourcePause={nextAt:new Date(Date.now()+SOURCE_COOLDOWN_MS).toISOString(),reason:'Independent GIS publication check unavailable'};
     s.state='source_paused';
    }
    break;
   }
   i++;
   await checkpoint();
  }
  if(!review)s.cursor=i;
  const finalOverlay=await auth.kvGet(OVERLAY);
  const records=finalOverlay?.records||{};
  let total=0,verifiedCount=0,skipped=0,failed=0,legacyProcessed=0;
  rows.forEach((record,index)=>{
   if(!valid(record))return;
   total++;
   if(records[record.i]?.verifiedGeometry===true&&!records[record.i].publicationPending)verifiedCount++;
   else if(s.reviewQueue[index]?.recordId===record.i){
    skipped++;
    if(s.reviewQueue[index].failed)failed++;
   }else if(index<s.cursor)legacyProcessed++;
  });
  const percent=count=>total?Math.round(10000*count/total)/100:0;
  s.progress={total,verified:verifiedCount,skipped,failed,legacyProcessed,
   pending:total-verifiedCount-skipped-legacyProcessed,
   processingPercent:percent(verifiedCount+skipped+legacyProcessed),verifiedPercent:percent(verifiedCount)};

  s.runs=(s.runs||0)+1;
  for(const k of ['verified','published','needsReview','failures'])s[k]=(s[k]||0)+result[k];
  s.lastBatch=result;
  // Persist each completed request outcome as its own immutable event.
  // The prior implementation restamped historic results with lastCompleted.
  saveRecent();
  if(s.state==='running')s.state=s.cursor>=rows.length?'source_scanned':pilot&&pilotRequests===PILOT_REQUEST_LIMIT?'pilot_limit':'idle';
  s.lastCompleted=new Date().toISOString();
  if(result.published+result.needsReview>0)s.lastSuccessfulBatch=s.lastCompleted;
  if(pilot)s.lastPilot={at:s.lastCompleted,state:s.state,cursor:s.cursor,requests:pilotRequests,requestLimit:PILOT_REQUEST_LIMIT,
   remaining:Math.max(0,MAX_PER_DAY-s.dailyUsed),source:DETROIT_GIS,mapVersion:finalOverlay?.version??0,
   attempted:result.attempted,processed:result.published+result.needsReview,verified:result.verified,
   skipped:result.needsReview,published:result.published,rows:result.rows};
  return response(200,{ok:true,previewOnly:true,cursor:s.cursor,sourceRecords:rows.length,
   ...(pilot?{pilot:s.lastPilot}:{}),
   dailyUsed:quota.active?s.dailyUsed:null,legacyDailyUsed:quota.active?undefined:s.dailyUsed,quotaActive:quota.active,dailyLimit:MAX_PER_DAY,state:s.state,retry:activeRetry()||null,sourcePause:s.sourcePause,progress:s.progress,...result,
   message:scheduled?'Scheduled bounded official GIS batch; no paid AI calls':'Owner-triggered preview batch; no paid AI calls or production writes'});
 }catch(e){
  s.state='error';s.lastError=String(e.message||e).slice(0,130);
  return response(502,{ok:false,error:'Batch interrupted: '+s.lastError,cursor:s.cursor});
 }finally{
  // Release only this run's lease. Preview uses its isolated persistent store.
  if(version)await auth.kvPutVersioned(STORE,{...s,token:null,lockedUntil:null},version);
 }
}
export default auth.withBrainStore(handler);

// Only the separately deployed scheduled Netlify function imports this entry.
// Both scheduled and Force Auto Run execute the same verifier, publisher, cursor and limits.
export const runScheduledWayne=auth.withBrainStore((req,context)=>handler(req,{...context,internalScheduled:true}));
