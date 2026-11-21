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
const RETRY_DELAYS_MS=[60000,180000]; // one minute, then three; stop after three provider attempts
const response=(code,body)=>new Response(JSON.stringify(body),{status:code,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Cookie','X-Robots-Tag':'noindex, nofollow'}});
const norm=s=>String(s??'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const today=()=>new Date().toISOString().slice(0,10);
const valid=r=>r?.i&&/^[0-9]{8}\.?$/.test(String(r.p||''))&&!r.g&&!r.cx&&
  /^\s*\d{1,6}\s+[A-Za-z0-9][^,]{2,75},?\s+Detroit\b/i.test(String(r.a||''));
async function get(url,max=12000000,timeout=8500){
 const res=await fetch(url,{signal:AbortSignal.timeout(timeout)});
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
  return response(200,{ok:true,previewOnly:true,...s,lockedUntil:s.lockedUntil||null,maxAttempts:MAX_ATTEMPTS,dailyLimit:MAX_PER_DAY});
 }
 if(!scheduled&&req.headers.get('origin')!==new URL(req.url).origin)return response(403,{ok:false,error:'Invalid origin'});
 if(!scheduled){
  let body;try{const raw=await req.text();if(raw.length>250)throw Error();body=JSON.parse(raw);}catch{return response(400,{ok:false,error:'Invalid request'});}
  if(body?.action!=='run-wayne-batch'||body.confirmed!==true)return response(400,{ok:false,error:'Explicit confirmation required'});
 }
 const control=await auth.kvGet(CONTROL);
 if(control?.status==='paused')return response(409,{ok:false,error:'Automation paused'});
 let s=state(await auth.kvGet(STORE));
 if(s.lockedUntil&&Date.parse(s.lockedUntil)>Date.now())return response(409,{ok:false,error:'Another batch run is in progress'});
 if(s.day!==today())s={...s,day:today(),dailyUsed:0};
 if(s.dailyUsed>=MAX_PER_DAY)return response(429,{ok:false,error:'Official GIS daily cap reached'});
 // Do not consume quota or advance the cursor while a failed parcel is cooling down.
 if(s.retry?.exhausted)return response(409,{ok:false,error:'GIS retry limit reached; owner review required',retry:s.retry,cursor:s.cursor});
 if(s.retry?.nextAt&&Date.parse(s.retry.nextAt)>Date.now())return response(200,{
  ok:true,previewOnly:!scheduled,state:'retry_wait',cursor:s.cursor,
  attempted:0,verified:0,published:0,needsReview:0,failures:0,
  dailyUsed:s.dailyUsed,dailyLimit:MAX_PER_DAY,retry:s.retry,rows:[],
  message:'GIS retry scheduled; no provider request or map write occurred'
 });
 const token=crypto.randomUUID();
 s={...s,token,lockedUntil:new Date(Date.now()+LEASE_MS).toISOString(),lastStarted:new Date().toISOString(),state:'running'};
 await auth.kvPut(STORE,s);
 const result={attempted:0,verified:0,published:0,needsReview:0,failures:0,rows:[]};
 try{
  const ds=await get(DATA);
  const rows=(ds.recs||[]).map(r=>{
   const decoded={...r};
   for(const [field,dictionary] of Object.entries(ds.dict||{}))
    if(decoded[field]!=null)decoded[field]=dictionary[decoded[field]];
   return decoded;
  });
  const overlay=await auth.kvGet(OVERLAY)||{records:{}};
  let i=Math.min(s.cursor,rows.length);
  // Netlify scheduled invocations have a shorter 30-second limit.
  // Keep their batch to one parcel, using exactly the same verification path.
  const maxThisRun=scheduled?1:MAX_ATTEMPTS;
  // Charge every actual GIS HTTP request, including fallback, to the daily cap.
  async function officialGet(url,recordIndex,timeout=6500){
   if(s.dailyUsed>=MAX_PER_DAY)throw Object.assign(Error('Daily GIS request limit reached'),{code:'QUOTA'});
   if((await auth.kvGet(CONTROL))?.status==='paused')throw Object.assign(Error('Automation paused'),{code:'PAUSED'});
   s.dailyUsed++;
   await auth.kvPut(STORE,{...s,cursor:recordIndex});
   return get(url,1000000,timeout);
  }
  function queryUrl(params){return DETROIT_GIS+'/query?'+new URLSearchParams({f:'json',outFields:'parcel_number,address,object_id',...params});}
  async function lookupWithObjectId(parcelId,recordIndex){
   // Lightweight identifier-only request, then indexed geometry lookup.
   // Never choose an arbitrary object ID or fallback to coordinates/geocoding.
   const bare=parcelId.replace(/\.$/,'');
   const ids=await officialGet(queryUrl({where:"parcel_number IN ('"+bare+"','"+bare+".')",returnIdsOnly:'true',returnGeometry:'false'}),recordIndex,5500);
   const objectIds=ids.objectIds;
   if(!Array.isArray(objectIds)||objectIds.length!==1||!Number.isSafeInteger(objectIds[0])||objectIds[0]<=0)
    throw Object.assign(Error('Official object ID missing or ambiguous'),{code:'AMBIGUOUS'});
   const official=await officialGet(queryUrl({objectIds:String(objectIds[0]),returnGeometry:'true',outSR:'4326',resultRecordCount:'2'}),recordIndex,6500);
   if(!Array.isArray(official.features)||official.features.length!==1||
      official.features[0]?.attributes?.object_id!==objectIds[0])
    throw Object.assign(Error('Official object ID lookup mismatch'),{code:'AMBIGUOUS'});
   return official;
  }
  while(i<rows.length&&result.attempted<maxThisRun&&s.dailyUsed<MAX_PER_DAY){
   const controlNow=await auth.kvGet(CONTROL);
   if(controlNow?.status==='paused'){s.state='paused';break;}
   const r=rows[i];
   if(!valid(r)||overlay.records?.[r?.i]){i++;continue;}
   const id=String(r.p).replace(/\.$/,'');
   if(s.retry&&(s.retry.parcelId!==id||s.retry.cursor!==i))s.retry=null;
   // Count one parcel attempt; GIS request usage is counted separately.
   result.attempted++;
   const url=queryUrl({where:"parcel_number IN ('"+id+"','"+id+".')",
    returnGeometry:'true',outSR:'4326',resultRecordCount:'3'});
   let official,verified,method='direct';
   try{
    try{
     official=await officialGet(url,i,6500);
    }catch(primary){
     if(primary.code==='PAUSED'||primary.code==='QUOTA')throw primary;
     // Only a provider timeout triggers the extra official object-ID lookup.
     if(primary.name!=='TimeoutError'&&primary.name!=='AbortError'&&!/timed?\s*out|aborted/i.test(String(primary.message)))
      throw primary;
     method='indexed_object_id';
     official=await lookupWithObjectId(id,i);
    }
   }catch(e){
    if(e.code==='PAUSED'){s.state='paused';break;}
    if(e.code==='QUOTA'){s.state='quota_reached';break;}
    if(e.code==='AMBIGUOUS'){
     result.needsReview++;i++;
     result.rows.push({parcelId:id,status:'needs_review',checkedAt:new Date().toISOString(),reason:String(e.message).slice(0,110)});
     s.retry=null;
     continue;
    }
    result.failures++;
    const attempts=(s.retry?.parcelId===id?s.retry.attempts:0)+1;
    const exhausted=attempts>=3;
    const nextAt=exhausted?null:new Date(Date.now()+RETRY_DELAYS_MS[attempts-1]).toISOString();
    s.retry={parcelId:id,cursor:i,attempts,maxAttempts:3,nextAt,exhausted,lastError:String(e.message).slice(0,110)};
    s.state=exhausted?'provider_error':'retry_wait';
    result.rows.push({parcelId:id,status:'retry_later',checkedAt:new Date().toISOString(),reason:String(e.message).slice(0,110),retryAttempt:attempts,nextRetryAt:nextAt});
    break;
   }
   // A successful provider response clears transient retry state even if parcel identity needs review.
   s.retry=null;
   try{
    verified=verifyOfficial(r,official.features);
    if(!Number.isSafeInteger(verified.officialObjectId)||verified.officialObjectId<=0)throw Error('Official object ID unavailable');
   }catch(e){
    result.needsReview++;i++;
    result.rows.push({parcelId:id,status:'needs_review',checkedAt:new Date().toISOString(),reason:String(e.message).slice(0,110)});
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
   if(!approvals.entries.some(x=>x.caseKey===caseKey)){
    await auth.kvPut(APPROVALS,{...approvals,entries:[...approvals.entries,item].slice(-250)});
   }
   // Existing guarded publisher independently checks the official polygon and
   // the shared pause switch; the saved overlay is authoritative for success.
   await publish(req,context);
   const published=await auth.kvGet(OVERLAY)||{records:{}};
   const success=published.records?.[r.i]?.verifiedGeometry===true;
   result.rows.push({parcelId:id,status:success?'published':'publish_pending',lookupMethod:method,checkedAt:new Date().toISOString()});
   if(success)result.published++;
   else {s.state='publish_pending';break;}
   i++;
  }
  s.cursor=i;
  s.runs=(s.runs||0)+1;
  for(const k of ['verified','published','needsReview','failures'])s[k]=(s[k]||0)+result[k];
  s.lastBatch=result;s.recent=[...result.rows,...(s.recent||[])].slice(0,25);
  if(s.state==='running')s.state=i>=rows.length?'source_scanned':'idle';
  s.lastCompleted=new Date().toISOString();
  return response(200,{ok:true,previewOnly:true,cursor:s.cursor,sourceRecords:rows.length,
   dailyUsed:s.dailyUsed,dailyLimit:MAX_PER_DAY,state:s.state,retry:s.retry||null,...result,
   message:scheduled?'Scheduled bounded official GIS batch; no paid AI calls':'Owner-triggered preview batch; no paid AI calls or production writes'});
 }catch(e){
  s.state='error';s.lastError=String(e.message||e).slice(0,130);
  return response(502,{ok:false,error:'Batch interrupted: '+s.lastError,cursor:s.cursor});
 }finally{
  // Release only this run's lease. Preview uses its isolated persistent store.
  const latest=await auth.kvGet(STORE);
  if(latest?.token===token){
   await auth.kvPut(STORE,{...s,token:null,lockedUntil:null});
  }
 }
}
export default auth.withBrainStore(handler);

// Only the separately deployed scheduled Netlify function imports this entry.
// Both scheduled and Force Auto Run execute the same verifier, publisher, cursor and limits.
export const runScheduledWayne=auth.withBrainStore((req,context)=>handler(req,{...context,internalScheduled:true}));
