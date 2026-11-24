// Private read-only event feed derived solely from persisted agent state.
import * as auth from '../lib/brain-auth.mjs';
import {countyOperation,operationCountyIds} from '../lib/brain-gis-universal.mjs';
import {putnamActivity} from '../lib/brain-gis-putnam.mjs';
import {countyCheckpointKey} from '../lib/brain-gis-county-worker.mjs';
import * as RL from '../lib/ratelimit.mjs';
import * as GL from '../lib/gemini-limits.mjs';
const respond=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Cookie','X-Robots-Tag':'noindex, nofollow'}});
const clean=s=>String(s??'').slice(0,160);
// Explicit states: active, idle, completed, failed, quota_limited, not_connected. Derived from stored state only.
function agentStates({worker,quota,photon,geo,publication,nvidiaReceipts,queue,gemini,now}){
 const st=(state,detail,lastAt=null)=>({state,detail,lastAt:date(lastAt)});
 const workerRunning=!!worker?.lockedUntil&&Date.parse(worker.lockedUntil)>now&&worker?.state==='running';
 const gisCount=quota?.active?Number(quota.count)||0:0;
 const gis=workerRunning?st('active','Official GIS batch running',worker?.lastStarted):
  gisCount>=30?st('quota_limited','Shared official GIS budget used for today',worker?.lastCompleted):
  worker?.retry?.exhausted||['provider_error','error','publish_pending'].includes(worker?.state)?st('failed',clean(worker?.lastError||worker?.state),worker?.lastCompleted):
  worker?.lastCompleted?st('completed','Last Wayne batch finished',worker.lastCompleted):st('idle','No Wayne batch recorded',null);
 const pState=(s,limited)=>s?.state==='running'?st('active','Address lookup running',s.lastStarted):
  limited?st('quota_limited',clean(limited),s?.lastCompleted):
  s?.lastError?st('failed',clean(s.lastError),s?.lastCompleted):
  s?.lastCompleted?st('completed','Last lookup batch finished',s.lastCompleted):st('idle','No lookup recorded',null);
 const photonLimited=photon?.lastWarning&&/denied|rate|limit/i.test(photon.lastWarning)?photon.lastWarning:null;
 const geoLimited=(Number(geo?.dailyUsage)||0)>=(Number(geo?.dailyLimit)||300)?'Geoapify daily allowance used':null;
 // Groq triage is a real, owner-confirmed tool. Its stored, unverified results are counted here; NVIDIA reads them as context only.
 const triaged=(Array.isArray(queue)?queue:[]).filter(x=>x?.triage?.status==='complete'&&date(x.triage.createdAt));
 const lastTriage=triaged.map(x=>date(x.triage.createdAt)).sort().at(-1)||null;
 const latest=nvidiaReceipts[0];
 const groqRead=Number(latest?.inputs?.sources?.groq)||0;
 const groq=triaged.length?st('completed',triaged.length+' unverified triage result(s) stored. '+(groqRead?'Last NVIDIA run read '+groqRead+' as context only':'Not yet read by NVIDIA'),lastTriage):st('idle','Triage tool. No result stored. NVIDIA reads results as context only',null);
 // Gemini: upload-only document reading. Stored results are unverified until the owner verifies them; NVIDIA reads verified ones as context only.
 const gemResults=Array.isArray(gemini?.doc?.results)?gemini.doc.results:[];
 const gemVerified=gemResults.filter(r=>r?.verified===true&&r.decision==='verified').length;
 const gemRead=Number(latest?.inputs?.sources?.['gemini-document'])||0;
 const gemLast=gemResults.map(r=>date(r?.createdAt)).filter(Boolean).sort().at(-1)||null;
 const geminiState=gemini?.doc?.stopped?st('failed','Stopped after a provider error. Turn it on again in the County PDF Reader',gemLast):
  gemini&&gemini.enabled===false?st('idle','Switched off in API Keys settings',gemLast):
  gemini&&gemini.daily>0&&gemini.used>=gemini.daily?st('quota_limited','Daily allowance used ('+gemini.used+' of '+gemini.daily+')',gemLast):
  gemResults.length?st('completed',gemResults.length+' stored reading(s), '+gemVerified+' verified by you. '+(gemRead?'Last NVIDIA run read '+gemRead+' as context only':'Not yet read by NVIDIA'),gemLast):
  st('idle','Upload only document reader. No result stored yet',null);
 const nvidia=!latest?st('idle','No NVIDIA consolidation run yet',null):
  latest.outcome==='completed'?st('completed',(latest.proposals||[]).length+' proposal(s) awaiting owner approval',latest.at):
  latest.outcome==='failed'?st('failed',clean(latest.error,120),latest.at):
  latest.outcome==='quota_limited'?st('quota_limited','NVIDIA rate or quota limit reached',latest.at):
  st('idle',clean(latest.outcome).replaceAll('_',' '),latest.at);
 return {
  'Official GIS':gis,
  Photon:pState(photon,photonLimited),
  Geoapify:pState(geo,geoLimited),
  Mapping:pState(publication,null),
  NVIDIA:nvidia,
  // Gemini is a real upload-only job: states come from its stored results. OpenAI has a key check only, no job exists.
  Gemini:geminiState,
  OpenAI:st('not_connected','Key check only. No helper job exists and no results reach NVIDIA',null),
  Groq:groq,
 };
}
// Receipts name the datasets they covered. Older receipts predate that field and were Wayne only by construction.
const receiptCounty=r=>{const d=Array.isArray(r?.inputs?.datasets)?r.inputs.datasets:null;return d===null?'MI-wayne':d.length===1?d[0]:d.length?'Multiple counties':'No dataset'};
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
  const nvidiaReceipts=(await auth.kvGet('brain-nvidia-consolidation-v1'))?.receipts||[];
  const caps=GL.geminiCaps(await auth.kvGet('owner-ai-research-api-controls'));
  const gemini={doc:await auth.kvGet('brain-helper-results-v1-gemini'),enabled:caps.enabled,daily:caps.daily,used:await GL.geminiUsedToday(RL,caps).catch(()=>0)};
  const events=auth.isBrainPreview()?await putnamActivity(auth.kvGet):[];
  const research=auth.isBrainPreview()?await auth.kvGet('brain-reconciliation-research-v1-CO-larimer'):null;
  const researchIds=new Set();
  for(const entry of (Array.isArray(research?.events)?research.events:[]).slice(-50)){
   const at=date(entry?.at);
   if(!at||typeof entry.id!=='string'||!['document','missing','restricted','unavailable','metadata','started','paused','resumed','conflict'].includes(entry.outcome)||researchIds.has(entry.id))continue;
   researchIds.add(entry.id);
   events.push({id:'research-'+clean(entry.id),at,agent:'Parcel research',from:'Official records',to:'Stored research',
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
      at,agent:'County connectors',from:'Official source',to:'Stored evidence',type:'county_research',eventType:event.status,
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
   events.push({id:'owner-review-'+clean(review.caseKey)+'-'+at,at,agent:'Owner review',from:'Owner review',to:'Approval ledger',
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
    from:'Official GIS',to:'Stored result',type:'verification_result',
    message:'Parcel '+clean(r.parcelId)+' · '+clean(r.status).replaceAll('_',' ')+
      (stage?' · stage '+stage:'')+(r.reason?' · '+clean(r.reason):''),
    parcelId:clean(r.parcelId),county:'MI-wayne',trace,failedStage:stage,
    status:r.status==='published'?'success':['needs_review','skipped'].includes(r.status)?'warning':r.status==='retry_later'?'error':'info'});
  }
  const pilot=worker?.lastPilot;
  const pilotAt=date(pilot?.at);
  if(pilotAt)events.push({id:'wayne-pilot-'+pilotAt,at:pilotAt,agent:'Official GIS',from:'Official GIS',to:'Stored result',
   type:'run_complete',county:'MI-wayne',status:pilot.state==='source_paused'||pilot.state==='retry_wait'?'warning':'info',
   message:'Live Wayne pilot · '+clean(pilot.state).replaceAll('_',' ')+' · Cursor '+pilot.cursor+
    ' · Attempted '+pilot.attempted+' · Processed '+pilot.processed+' · Verified '+pilot.verified+' · Skipped '+pilot.skipped+
    ' · GIS requests '+pilot.requests+'/'+pilot.requestLimit+' · Shared remaining '+pilot.remaining+' · Map version '+pilot.mapVersion,
   source:pilot.source});
  const sources=[['Photon',photon],['Geoapify',geo],['GIS Agent',automatic],['Publisher',publication]];
  for(const [name,s] of sources){
   const at=date(s?.lastCompleted);if(!at)continue;
   events.push({id:'agent-'+name+'-'+at,at,agent:name,from:name,to:'Stored result',type:'run_complete',
    message:name+' · '+clean(s.state||'completed')+' · '+Number(s.checked||s.published||0)+' checked/published total',status:s.state==='error'?'error':'info'});
  }
  // NVIDIA events exist only for requests that were actually sent (stored receipts).
  for(const r of nvidiaReceipts.slice(0,10)){
   const at=date(r.at);if(!at)continue;
   const count=Number.isInteger(r.inputs?.count)?r.inputs.count:0;
   const sources=Object.entries(r.inputs?.sources||{}).map(([k,v])=>clean(k)+' '+Number(v)).join(', ');
   if(['completed','failed','quota_limited'].includes(r.outcome))
    events.push({id:'nvidia-in-'+clean(r.id),at,agent:'Helper agents',from:'Helper agents',to:'NVIDIA',type:'nvidia_transfer',
     county:receiptCounty(r),count,status:r.outcome==='completed'?'info':'error',
     message:'Helper results sent to NVIDIA · '+count+' items'+(sources?' ('+sources+')':'')+(r.outcome==='completed'?'':' · '+clean(r.outcome).replaceAll('_',' '))});
   if(r.outcome==='completed')
    events.push({id:'nvidia-out-'+clean(r.id),at,agent:'NVIDIA',from:'NVIDIA',to:'Owner review',type:'nvidia_result',county:receiptCounty(r),
     status:(r.conflicts||[]).length?'warning':'info',
     message:'NVIDIA consolidation · '+(r.proposals||[]).length+' proposal(s) await owner approval · '+(r.conflicts||[]).length+' conflict(s) flagged · '+(r.rejected||[]).length+' rejected'});
   if(r.outcome==='failed')
    events.push({id:'nvidia-out-'+clean(r.id),at,agent:'NVIDIA',from:'NVIDIA',to:'Owner review',type:'nvidia_result',county:receiptCounty(r),status:'error',
     message:'NVIDIA consolidation failed · '+clean(r.error,120)});
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
    state==='quota_wait'?(quota.resumeAt?'Shared GIS budget cutover · resumes '+quota.resumeAt:!quota.active?'Shared GIS budget awaiting first owner-confirmed pilot request · first attempt starts UTC cutover; no GIS dispatch until the following UTC day':'Daily shared GIS budget exhausted'):
    state==='complete'?'Available source records scanned':'Waiting for next batch',
    retryParcel:retry?.parcelId||null,retryAttempt:retry?.attempts||0,
    retryMaximum:retry?.maxAttempts||3,nextRetryAt:date(retry?.nextAt),
    failedStage:clean(retry?.failedStage||''),lastGisTrace:(retry?.gisTrace||[]).slice(0,5),
    lastCompleted:date(worker?.lastCompleted),dailyUsed,remaining,dailyLimit:30,quotaActive:quota.active===true,quotaResumeAt:date(quota.resumeAt)};
  return respond(200,{ok:true,preview:auth.isBrainPreview(),source:'persisted_agent_status',health,
   capturedAt:new Date().toISOString(),county:'Wayne, Michigan',
   summary:{verifiedPolygons,processed:progress?progress.total-progress.pending:null,skipped:progress?.skipped??null,pendingReview,
    verifiedCoverage:progress?.verifiedPercent??null,processingCompletion:progress?.processingPercent??null,cursor:Number(worker?.cursor||0),runs:Number(worker?.runs||0),verified:Number(worker?.verified||0),published:Number(worker?.published||0),
    needsReview:Number(worker?.needsReview||0),failures:Number(worker?.failures||0),dailyUsed,remaining,dailyLimit:30,
    state:clean(worker?.state||'not_started'),paused:control?.status==='paused',
    lastSuccessfulBatch:date(worker?.lastSuccessfulBatch),lastCompleted:date(worker?.lastCompleted)},
   agents:agentStates({worker,quota,photon,geo,publication,nvidiaReceipts,queue:control?.queue,gemini,now}),
   eventCount:newest.length,eventWindow,events:newest});
 }catch(e){return respond(503,{ok:false,error:'Agent activity temporarily unavailable'});}
}
export default auth.withBrainStore(handler);
