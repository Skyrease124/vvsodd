// Read-only owner release gate for the unattended Wayne pilot.
// No GIS calls, map changes, schedule changes, or credit usage.
import * as auth from '../lib/brain-auth.mjs';
const reply=(code,body)=>new Response(JSON.stringify(body),{status:code,headers:{'Content-Type':'application/json','Cache-Control':'private,no-store','Vary':'Cookie','X-Robots-Tag':'noindex,nofollow'}});
async function handler(req,context){
 if(req.method!=='GET')return reply(405,{ok:false,error:'GET only'});
 const user=await auth.userFromCookie(req.headers.get('cookie')||'');
 if(!user?.owner)return reply(user?403:401,{ok:false,error:'Owner access required'});
 const preview=auth.isBrainPreview();
 const configuredState=await auth.kvGet('owner-brain-wayne-scheduler-control-v1');
 const configured=configuredState?.enabled===true&&configuredState?.approvedForProduction===true;
 const [worker,control,audit]=await Promise.all([
  auth.kvGet('owner-brain-wayne-worker-v1'),
  auth.kvGet('owner-brain-scanner-v1'),
  auth.kvGet('owner-brain-wayne-schedule-audit-v1')
 ]);
 const steps=[
  {key:'preview_validation',name:'Preview GIS and publisher verified',ready:!!worker?.published&&!!worker?.cursor},
  {key:'safety',name:'30-request daily cap and owner pause',ready:true},
  {key:'schedule',name:'Production scheduled runner enabled',ready:!preview&&configured},
  {key:'county_scope',name:'County connectors beyond Detroit',ready:false},
  {key:'preview_scheduler',name:'Unattended processing on Deploy Preview',ready:false}
 ];
 return reply(200,{ok:true,preview,environment:context?.deploy?.context||'unknown',
  unattendedProductionEnabled:!preview&&configured,scheduledFrequencyMinutes:30,
  previewRequiresOpenDashboard:true,websiteControlledSchedule:true,
  worker:{cursor:Number(worker?.cursor||0),published:Number(worker?.published||0),state:String(worker?.state||'not_started'),
   paused:control?.status==='paused',retryExhausted:worker?.retry?.exhausted===true,
   lastCompleted:worker?.lastCompleted||null,dailyUsed:Number(worker?.dailyUsed||0),dailyLimit:30},
  lastScheduledRun:audit?.last||null,scheduledRuns:Number(audit?.runs||0),
  nextCountyAutomatic:false,allCountiesConfigured:false,checks:steps,
  releaseReady:steps.every(x=>x.ready)});
}
export default auth.withBrainStore(handler);
