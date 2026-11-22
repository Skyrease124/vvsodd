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
 const [worker,control,audit,overlay,quota]=await Promise.all([
  auth.kvGet('owner-brain-wayne-worker-v1'),
  auth.kvGet('owner-brain-scanner-v1'),
  auth.kvGet('owner-brain-wayne-schedule-audit-v1'),
  auth.kvGet('brain-map-county-v1-MI-wayne'),
  auth.readWayneGisQuota()
 ]);
 const verifiedOverlayCount=Object.values(overlay?.records||{}).filter(r=>r?.verifiedGeometry===true&&r?.i&&Array.isArray(r.g)&&r.g.length).length;
 const steps=[
  {key:'preview_validation',name:'Preview GIS and publisher verified',ready:!!worker?.published&&!!worker?.cursor},
  {key:'safety',name:'30-request daily cap and owner pause',ready:quota.active},
  {key:'schedule',name:'Production scheduled runner enabled',ready:!preview&&configured},
  {key:'county_scope',name:'County connectors beyond Detroit',ready:false},
  {key:'preview_scheduler',name:'Unattended processing on Deploy Preview',ready:false}
 ];
 return reply(200,{ok:true,preview,environment:context?.deploy?.context||'unknown',
  unattendedProductionEnabled:!preview&&configured,scheduledFrequencyMinutes:30,
  previewRequiresOpenDashboard:true,websiteControlledSchedule:true,
  worker:{cursor:Number(worker?.cursor||0),published:Number(worker?.published||0),verifiedOverlayCount,publicationCountMeaning:'worker total excludes earlier pilot and other confirmed overlay entries',state:String(worker?.state||'not_started'),
   publicationPending:Object.values(overlay?.records||{}).some(r=>r?.publicationPending===true),
   lastStarted:worker?.lastStarted||null,lockedUntil:worker?.lockedUntil||null,
   mapVersion:overlay?.version??0,lastPilot:worker?.lastPilot||null,
   progress:worker?.progress||null,sourcePause:worker?.sourcePause||null,
   reviewQueue:Object.entries(worker?.reviewQueue||{})
    .filter(([,entry])=>!entry.resolvedAt&&overlay?.records?.[entry.recordId]?.verifiedGeometry!==true)
    .map(([index,entry])=>({index:Number(index),parcelId:entry.parcelId,reason:entry.reason,checkedAt:entry.checkedAt})),
   paused:control?.status==='paused',retryExhausted:worker?.retry?.exhausted===true,
   retryNextAt:worker?.retry?.nextAt||null,retryParcel:worker?.retry?.parcelId||null,retryAttempt:Number(worker?.retry?.attempts||0),retryLastError:worker?.retry?.lastError||null,
   lastCompleted:worker?.lastCompleted||null,dailyUsed:quota.active?quota.count:null,legacyDailyUsed:quota.active?undefined:Number(worker?.dailyUsed||0),quotaActive:quota.active,quotaResumeAt:quota.resumeAt,dailyLimit:30},
  lastScheduledRun:audit?.last||null,scheduledRuns:Number(audit?.runs||0),
  nextCountyAutomatic:false,allCountiesConfigured:false,checks:steps,
  waynePilotReady:steps.filter(x=>['preview_validation','safety'].includes(x.key)).every(x=>x.ready),
  nationwideReady:false,releaseReady:steps.every(x=>x.ready)});
}
export default auth.withBrainStore(handler);
