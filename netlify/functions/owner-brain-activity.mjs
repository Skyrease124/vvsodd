// Private read-only event feed derived solely from persisted agent state.
import * as auth from '../lib/brain-auth.mjs';
const respond=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Cookie','X-Robots-Tag':'noindex, nofollow'}});
const clean=s=>String(s??'').slice(0,160);
const date=s=>{const t=Date.parse(s||'');return Number.isFinite(t)?new Date(t).toISOString():null};
async function handler(req){
 if(req.method!=='GET')return respond(405,{ok:false,error:'GET only'});
 const user=await auth.userFromCookie(req.headers.get('cookie')||'');
 if(!user?.owner)return respond(user?403:401,{ok:false,error:'Owner access required'});
 try{
  const [worker,history,publication,control,photon,geo,automatic]=await Promise.all([
   'owner-brain-wayne-worker-v1','brain-map-history-v1','brain-map-publication-status-v1',
   'owner-brain-scanner-v1','owner-brain-photon-status-v1','owner-brain-geoapify-status-v1',
   'owner-brain-automatic-status-v1'].map(k=>auth.kvGet(k)));
  const events=[];
  // Publication history is the authoritative receipt. Never claim an AI model
  // performed the work when the record identifies only official GIS.
  for(const [i,h] of (history?.entries||[]).slice(0,100).entries()){
   const at=date(h.at);if(!at)continue;
   events.push({id:'pub-'+clean(h.dataset)+'-'+clean(h.recordId||h.parcelId)+'-'+at,at,agent:'Mapping',from:'GIS Publisher',to:'Mapping',type:h.action==='published'?'published':'publication',
    message:(h.action==='published'?'Verified polygon published':'Map event')+' · '+clean(h.dataset)+' · parcel '+clean(h.parcelId),
    parcelId:clean(h.parcelId),county:clean(h.dataset),status:h.action==='published'?'success':'info'});
  }
  const recent=Array.isArray(worker?.recent)?worker.recent.slice(0,25):[];
  for(const [i,r] of recent.entries()){
   // The worker stores latest batch timestamp, not per-parcel timestamps.
   // Mark that time as approximate rather than inventing event timestamps.
   const precise=date(r.checkedAt);
   const at=precise||date(worker?.lastCompleted||worker?.lastStarted);
   if(!at)continue;
   events.push({id:'gis-'+clean(r.parcelId)+'-'+clean(r.status)+'-'+at,at,approximateTime:!precise,agent:'Official GIS',
    from:'Official GIS',to:'NVIDIA',type:'verification_result',message:'Parcel '+clean(r.parcelId)+' · '+clean(r.status).replaceAll('_',' ')+(r.reason?' · '+clean(r.reason):''),
    parcelId:clean(r.parcelId),county:'MI-wayne',status:r.status==='published'?'success':r.status==='needs_review'?'warning':r.status==='retry_later'?'error':'info'});
  }
  const sources=[['Photon',photon],['Geoapify',geo],['GIS Agent',automatic],['Publisher',publication]];
  for(const [name,s] of sources){
   const at=date(s?.lastCompleted);if(!at)continue;
   events.push({id:'agent-'+name+'-'+at,at,agent:name,from:name,to:'NVIDIA',type:'run_complete',
    message:name+' · '+clean(s.state||'completed')+' · '+Number(s.checked||s.published||0)+' checked/published total',status:s.state==='error'?'error':'info'});
  }
  events.sort((a,b)=>b.at.localeCompare(a.at));
  return respond(200,{ok:true,preview:auth.isBrainPreview(),source:'persisted_agent_status',
   capturedAt:new Date().toISOString(),county:'Wayne, Michigan',
   summary:{cursor:Number(worker?.cursor||0),runs:Number(worker?.runs||0),verified:Number(worker?.verified||0),published:Number(worker?.published||0),
    needsReview:Number(worker?.needsReview||0),failures:Number(worker?.failures||0),dailyUsed:Number(worker?.dailyUsed||0),dailyLimit:30,
    state:clean(worker?.state||'not_started'),paused:control?.status==='paused',
    lastCompleted:date(worker?.lastCompleted)},
   agents:{'Official GIS':automatic?.state||worker?.state||'not_started',Photon:photon?.state||'not_started',Geoapify:geo?.state||'not_started',
    Mapping:publication?.state||'not_started',Gemini:'no_recorded_activity',OpenAI:'no_recorded_activity',Groq:'no_recorded_activity',NVIDIA:'orchestration_display'},
   events:events.slice(0,90)});
 }catch(e){return respond(503,{ok:false,error:'Agent activity temporarily unavailable'});}
}
export default auth.withBrainStore(handler);
