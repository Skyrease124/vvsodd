// Private read-only event feed derived solely from persisted agent state.
import * as auth from '../lib/brain-auth.mjs';
import {countyOperation,operationCountyIds} from '../lib/brain-gis-universal.mjs';
import {putnamActivity} from '../lib/brain-gis-putnam.mjs';
import {countyCheckpointKey} from '../lib/brain-gis-county-worker.mjs';
const respond=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Cookie','X-Robots-Tag':'noindex, nofollow'}});
const clean=s=>String(s??'').slice(0,160);
const date=s=>{const t=Date.parse(s||'');return Number.isFinite(t)?new Date(t).toISOString():null};
async function handler(req){
 if(req.method!=='GET')return respond(405,{ok:false,error:'GET only'});
 const user=await auth.userFromCookie(req.headers.get('cookie')||'');
 if(!user?.owner)return respond(user?403:401,{ok:false,error:'Owner access required'});
 try{
  const [[worker,history,publication,control,photon,geo,automatic,overlay,approvals],quota]=await Promise.all([Promise.all([
   'owner-brain-wayne-worker-v1','brain-map-history-v1','brain-map-publication-status-v1',
   'owner-brain-scanner-v1','owner-brain-photon-status-v1','owner-brain-geoapify-status-v1',
   'owner-brain-automatic-status-v1','brain-map-county-v1-MI-wayne','owner-brain-approvals-v1'].map(k=>auth.kvGet(k))),auth.readWayneGisQuota()]);
  const events=auth.isBrainPreview()?await putnamActivity(auth.kvGet):[];
  const research=auth.isBrainPreview()?await auth.kvGet('brain-reconciliation-research-v1-CO-larimer'):null;
  const researchIds=new Set();
  for(const entry of (Array.isArray(research?.events)?research.events:[]).slice(-50)){
   const at=date(entry?.at);
   if(!at||typeof entry.id!=='string'||!['document','missing','restricted','unavailable','metadata','started','paused','resumed','conflict'].includes(entry.outcome)||researchIds.has(entry.id))continue;
   researchIds.add(entry.id);
   events.push({id:'research-'+clean(entry.id),at,agent:'Parcel research',from:'Official records',to:'NVIDIA',
    type:'parcel_research',message:'Larimer research · '+clean(entry.sourceId)+' · '+entry.outcome+(Number.isInteger(entry.httpStatus)?' · HTTP '+entry.httpStatus:'')+
    (entry.outcome==='metadata'?' · Metadata saved · Owner review required':entry.outcome==='conflict'?' · Conflicting records · Owner review required':''),
    county:'CO-larimer',receiptId:clean(entry.id),source:clean(entry.sourceId),status:entry.outcome==='document'?'success':entry.outcome==='unavailable'?'error':'info'});
  }
  if(auth.isBrainPreview()){
   const ids=operationCountyIds().filter(id=>countyOperation(id).mode!=='existing-worker');
   const operations=await Promise.all(ids.map(async id=>Promise.all([
    auth.kvGet(countyCheckpointKey(id)),auth.kvGet('brain-map-county-v1-'+id)])));
   for(const [index,[checkpoint,overlay]] of operations.entries()){
    const county=ids[index];
    for(const event of (checkpoint?.events||[]).slice(-25)){
     const at=date(event.at);
     if(!at||!['worker_started','schema_checked','request_reserved','evidence_saved','retry_verified','skipped','source_paused','quota_wait','owner_paused','owner_resumed'].includes(event.status))continue;
     events.push({id:'county-operation-'+county+'-'+(event.id??[at,event.parcelId,event.status].join('-')),
      at,agent:'County connectors',from:'Official source',to:'NVIDIA',type:'county_research',eventType:event.status,
      county,parcelId:clean(event.parcelId),source:countyOperation(county)?.source??null,
      quotaImpact:event.status==='request_reserved'?1:null,status:['worker_started','schema_checked','request_reserved','evidence_saved','owner_resumed','retry_verified'].includes(event.status)?'info':'warning',
      message:county+' · '+event.status.replaceAll('_',' ')+(event.parcelId?' · '+clean(event.parcelId):'')+
       (event.stage?' · '+clean(event.stage).replaceAll('_',' '):'')+
       (Number.isInteger(event.sharedUsed)?' · '+event.sharedUsed+' shared requests reserved':'')+
       (Number.isInteger(event.pilotUsed)?' · '+event.pilotUsed+'/3 pilot requests reserved':'')+
       (event.reason?' · '+clean(event.reason):'')});
    }
    for(const receipt of (overlay?.publicationHistory||[]).slice(0,25)){
     const at=date(receipt?.at);
     if(!at||receipt.dataset!==county||receipt.action!=='published'||!receipt.parcelId)continue;
     events.push({id:'county-publication-'+county+'-'+receipt.version,at,agent:'Mapping',from:'GIS Publisher',
      to:'Mapping',type:'published',county,parcelId:clean(receipt.parcelId),status:'success',
      message:'Verified polygon published · '+county+' · parcel '+clean(receipt.parcelId)});
    }
   }
  }
  for(const review of (approvals?.entries||[]).slice(-30)){
   const at=date(review.reviewedAt);
   if(!at||!review.caseKey||!['approved_for_staging','rejected'].includes(review.decision))continue;
   events.push({id:'owner-review-'+clean(review.caseKey)+'-'+at,at,agent:'Owner review',from:'Owner review',to:'NVIDIA',
    type:'owner_review',county:clean(review.dataset),parcelId:clean(review.parcelId),receiptId:clean(review.caseKey),
    status:review.decision==='rejected'?'warning':'info',source:clean(review.sourceProvider)||null,
    message:review.decision==='rejected'?'Rejected by owner':'Owner approved private staging'});
  }
  // Publication history is the authoritative receipt. Never claim an AI model
  // performed the work when the record identifies only official GIS.
  const publicationIds=new Set();
  for(const h of (history?.entries||[]).slice(0,100)){
   const at=date(h.at);if(!at)continue;
   const id='pub-'+clean(h.dataset)+'-'+clean(h.recordId||h.parcelId)+'-'+at;
   if(publicationIds.has(id))continue;
   publicationIds.add(id);
   events.push({id,at,agent:'Mapping',from:'GIS Publisher',to:'Mapping',type:h.action==='published'?'published':'publication',
    message:(h.action==='published'?'Verified polygon published':'Map event')+' · '+clean(h.dataset)+' · parcel '+clean(h.parcelId),
    parcelId:clean(h.parcelId),county:clean(h.dataset),status:h.action==='published'?'success':'info'});
  }
  const recent=Array.isArray(worker?.recent)?worker.recent.slice(0,40):[];
  const recentIds=new Set();
  for(const r of recent){
   // Legacy records have no per-attempt timestamp. Do not restamp and replay them.
   const at=date(r.checkedAt);
   if(!at)continue;
   const stage=clean(r.failedStage||r.gisTrace?.at(-1)?.stage||'');
   const trace=(Array.isArray(r.gisTrace)?r.gisTrace:[]).slice(0,5).map(t=>({
    stage:clean(t.stage),status:clean(t.status),durationMs:Number(t.durationMs||0),at:date(t.at)
   }));
   const id='gis-'+clean(r.parcelId)+'-'+clean(r.status)+'-'+at;
   if(recentIds.has(id))continue;
   recentIds.add(id);
   events.push({id,at,approximateTime:false,agent:'Official GIS',
    from:'Official GIS',to:'NVIDIA',type:'verification_result',
    message:'Parcel '+clean(r.parcelId)+' · '+clean(r.status).replaceAll('_',' ')+
      (stage?' · stage '+stage:'')+(r.reason?' · '+clean(r.reason):''),
    parcelId:clean(r.parcelId),county:'MI-wayne',trace,failedStage:stage,
    status:r.status==='published'?'success':['needs_review','skipped'].includes(r.status)?'warning':r.status==='retry_later'?'error':'info'});
  }
  const pilot=worker?.lastPilot;
  const pilotAt=date(pilot?.at);
  if(pilotAt)events.push({id:'wayne-pilot-'+pilotAt,at:pilotAt,agent:'Official GIS',from:'Official GIS',to:'NVIDIA',
   type:'run_complete',county:'MI-wayne',status:pilot.state==='source_paused'||pilot.state==='retry_wait'?'warning':'info',
   message:'Live Wayne pilot · '+clean(pilot.state).replaceAll('_',' ')+' · Cursor '+pilot.cursor+
    ' · Attempted '+pilot.attempted+' · Processed '+pilot.processed+' · Verified '+pilot.verified+' · Skipped '+pilot.skipped+
    ' · GIS requests '+pilot.requests+'/'+pilot.requestLimit+' · Shared remaining '+pilot.remaining+' · Map version '+pilot.mapVersion,
   source:pilot.source});
  const sources=[['Photon',photon],['Geoapify',geo],['GIS Agent',automatic],['Publisher',publication]];
  for(const [name,s] of sources){
   const at=date(s?.lastCompleted);if(!at)continue;
   events.push({id:'agent-'+name+'-'+at,at,agent:name,from:name,to:'NVIDIA',type:'run_complete',
    message:name+' · '+clean(s.state||'completed')+' · '+Number(s.checked||s.published||0)+' checked/published total',status:s.state==='error'?'error':'info'});
  }
  const unique=[...new Map(events.map(event=>[event.id,event])).values()]
   .sort((a,b)=>b.at.localeCompare(a.at)||a.id.localeCompare(b.id));
  // Only bounded receipts are loaded above; never present this as the all-time event count.
  const newest=unique.slice(0,90);
  const eventWindow={availableCount:unique.length,returnedCount:newest.length,truncated:unique.length>newest.length,completeHistory:false};
  const now=Date.now(), retry=worker?.retry||null;
  const running=!!worker?.lockedUntil&&Date.parse(worker.lockedUntil)>now&&worker?.state==='running';
  const cooling=!!retry?.nextAt&&Date.parse(retry.nextAt)>now&&!retry.exhausted;
  const state=control?.status==='paused'?'paused':
   running?'processing':Date.parse(worker?.sourcePause?.nextAt)>now?'source_paused':cooling?'retrying':
   retry?.exhausted||['provider_error','error','publish_pending'].includes(worker?.state)?'attention':
   worker?.state==='source_scanned'?'complete':!quota.active||quota.count>=30?'quota_wait':'idle';
  const dailyUsed=quota.active?quota.count:null;
  const remaining=dailyUsed===null?null:Math.max(0,30-dailyUsed);
  const pendingReview=Object.values(worker?.reviewQueue||{}).filter(entry=>!entry.resolvedAt&&overlay?.records?.[entry.recordId]?.verifiedGeometry!==true).length;
  const progress=worker?.progress;
  const verifiedPolygons=Object.values(overlay?.records||{}).filter(row=>row?.verifiedGeometry===true&&!row.publicationPending&&Array.isArray(row.g)&&row.g.length).length;
  const health={state,detail:state==='paused'?'County automation paused':
    state==='processing'?'Official GIS batch running':
    state==='source_paused'?'Official GIS source paused until '+worker.sourcePause.nextAt:
    state==='retrying'?'Waiting to retry parcel '+clean(retry?.parcelId):
    state==='attention'?clean(retry?.lastError||worker?.lastError||'Worker needs review'):
    state==='quota_wait'?'Waiting for shared GIS budget':
    state==='complete'?'Available source records scanned':'Waiting for next batch',
    retryParcel:retry?.parcelId||null,retryAttempt:retry?.attempts||0,
    retryMaximum:retry?.maxAttempts||3,nextRetryAt:date(retry?.nextAt),
    failedStage:clean(retry?.failedStage||''),lastGisTrace:(retry?.gisTrace||[]).slice(0,5),
    lastCompleted:date(worker?.lastCompleted),dailyUsed,remaining,dailyLimit:30};
  return respond(200,{ok:true,preview:auth.isBrainPreview(),source:'persisted_agent_status',health,
   capturedAt:new Date().toISOString(),county:'Wayne, Michigan',
   summary:{verifiedPolygons,processed:progress?progress.total-progress.pending:null,skipped:progress?.skipped??null,pendingReview,
    verifiedCoverage:progress?.verifiedPercent??null,processingCompletion:progress?.processingPercent??null,cursor:Number(worker?.cursor||0),runs:Number(worker?.runs||0),verified:Number(worker?.verified||0),published:Number(worker?.published||0),
    needsReview:Number(worker?.needsReview||0),failures:Number(worker?.failures||0),dailyUsed,remaining,dailyLimit:30,
    state:clean(worker?.state||'not_started'),paused:control?.status==='paused',
    lastSuccessfulBatch:date(worker?.lastSuccessfulBatch),lastCompleted:date(worker?.lastCompleted)},
   agents:{'Official GIS':automatic?.state||worker?.state||'not_started',Photon:photon?.state||'not_started',Geoapify:geo?.state||'not_started',
    Mapping:publication?.state||'not_started',Gemini:'no_recorded_activity',OpenAI:'no_recorded_activity',Groq:'no_recorded_activity',NVIDIA:'orchestration_display'},
   eventCount:newest.length,eventWindow,events:newest});
 }catch(e){return respond(503,{ok:false,error:'Agent activity temporarily unavailable'});}
}
export default auth.withBrainStore(handler);
