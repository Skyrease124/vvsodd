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
const response=(code,body)=>new Response(JSON.stringify(body),{status:code,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Cookie','X-Robots-Tag':'noindex, nofollow'}});
const norm=s=>String(s??'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const today=()=>new Date().toISOString().slice(0,10);
const valid=r=>r?.i&&/^[0-9]{8}\.?$/.test(String(r.p||''))&&!r.g&&!r.cx&&
  /^\s*\d{1,6}\s+[A-Za-z0-9][^,]{2,75},?\s+Detroit\b/i.test(String(r.a||''));
async function get(url,max=12000000){
 const res=await fetch(url,{signal:AbortSignal.timeout(8500)});
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
  while(i<rows.length&&result.attempted<maxThisRun&&s.dailyUsed<MAX_PER_DAY){
   const controlNow=await auth.kvGet(CONTROL);
   if(controlNow?.status==='paused'){s.state='paused';break;}
   const r=rows[i];
   if(!valid(r)||overlay.records?.[r?.i]){i++;continue;}
   const id=String(r.p).replace(/\.$/,'');
   // Reserve the quota before each remote request. Advance cursor only after
   // a completed match/mismatch, never after transient HTTP/provider failures.
   s.dailyUsed++;result.attempted++;
   await auth.kvPut(STORE,{...s,cursor:i});
   const url=DETROIT_GIS+'/query?'+new URLSearchParams({f:'json',where:"parcel_number IN ('"+id+"','"+id+".')",
    outFields:'parcel_number,address,object_id',returnGeometry:'true',outSR:'4326',resultRecordCount:'3'});
   let official,verified;
   try{
    official=await get(url,1000000);
   }catch(e){
    result.failures++;s.state='provider_error';
    result.rows.push({parcelId:id,status:'retry_later',reason:String(e.message).slice(0,110)});
    break;
   }
   try{
    verified=verifyOfficial(r,official.features);
    if(!Number.isSafeInteger(verified.officialObjectId)||verified.officialObjectId<=0)throw Error('Official object ID unavailable');
   }catch(e){
    result.needsReview++;i++;
    result.rows.push({parcelId:id,status:'needs_review',reason:String(e.message).slice(0,110)});
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
   result.rows.push({parcelId:id,status:success?'published':'publish_pending'});
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
   dailyUsed:s.dailyUsed,dailyLimit:MAX_PER_DAY,state:s.state,...result,
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
