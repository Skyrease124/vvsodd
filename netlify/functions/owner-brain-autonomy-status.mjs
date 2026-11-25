// Read-only owner release gate for the unattended Wayne pilot.
// No GIS calls, map changes, schedule changes, or credit usage.
import * as auth from '../lib/brain-auth.mjs';
// Same value as WAYNE_DAILY_LIMIT in lib/brain-wayne-gis-quota.mjs (kept local so this module's test mocks stay valid).
const WAYNE_DAILY_LIMIT=300;
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
 const now=Date.now();
 const pending=Object.values(overlay?.records||{}).some(r=>r?.publicationPending===true);
 const remaining=quota.active?Math.max(0,WAYNE_DAILY_LIMIT-quota.count):null;
 const utcRollover=new Date(now);
 utcRollover.setUTCHours(24,0,0,0);
 const readyAt=[quota.resumeAt,worker?.retry?.nextAt,worker?.sourcePause?.nextAt,worker?.lockedUntil,
  remaining!==null&&remaining<3?utcRollover.toISOString():null]
  .map(value=>Date.parse(value)).filter(value=>value>now).sort((a,b)=>b-a)[0];
 const blockers=[
  [!preview,'Pilot is available only in preview'],
  [control?.status==='paused','Automation paused'],
  [pending,'Publication recovery required'],
  [worker?.retry?.exhausted,'Exhausted retry requires review'],
  [Date.parse(worker?.lockedUntil)>now,'Worker running'],
  [[worker?.retry?.nextAt,worker?.sourcePause?.nextAt].some(value=>Date.parse(value)>now),'GIS cooldown active'],
  [!quota.active,'Shared GIS budget is inactive'],
  [quota.active&&remaining<3,'Fewer than three shared GIS requests remain']
 ].filter(([blocked])=>blocked).map(([,reason])=>reason);
 const steps=[
  {key:'preview_validation',name:'Preview GIS and publisher verified',ready:!!worker?.published&&!!worker?.cursor},
  {key:'safety',name:WAYNE_DAILY_LIMIT+'-request daily cap and owner pause',ready:quota.active},
  {key:'schedule',name:'Production scheduled runner enabled',ready:!preview&&configured},
  {key:'county_scope',name:'County connectors beyond Detroit',ready:false},
  {key:'preview_scheduler',name:'Unattended processing on Deploy Preview',ready:false}
 ];
 return reply(200,{ok:true,preview,environment:context?.deploy?.context||'unknown',
  unattendedProductionEnabled:!preview&&configured,scheduledFrequencyMinutes:30,
  previewRequiresOpenDashboard:true,websiteControlledSchedule:true,
  worker:{cursor:Number(worker?.cursor||0),published:Number(worker?.published||0),verifiedOverlayCount,publicationCountMeaning:'worker total excludes earlier pilot and other confirmed overlay entries',state:String(worker?.state||'not_started'),
   publicationPending:pending,
   lastStarted:worker?.lastStarted||null,lockedUntil:worker?.lockedUntil||null,
   mapVersion:overlay?.version??0,lastPilot:worker?.lastPilot||null,
   progress:worker?.progress||null,sourcePause:worker?.sourcePause||null,
   reviewQueue:Object.entries(worker?.reviewQueue||{})
    .filter(([,entry])=>!entry.resolvedAt&&overlay?.records?.[entry.recordId]?.verifiedGeometry!==true)
    .map(([index,entry])=>({index:Number(index),parcelId:entry.parcelId,reason:entry.reason,checkedAt:entry.checkedAt})),
   paused:control?.status==='paused',retryExhausted:worker?.retry?.exhausted===true,
   retryNextAt:worker?.retry?.nextAt||null,retryParcel:worker?.retry?.parcelId||null,retryAttempt:Number(worker?.retry?.attempts||0),retryLastError:worker?.retry?.lastError||null,
   lastSuccessfulBatch:worker?.lastSuccessfulBatch||null,lastError:worker?.state==='error'?worker.lastError||null:null,
   lastCompleted:worker?.lastCompleted||null,dailyUsed:quota.active?quota.count:null,legacyDailyUsed:quota.active?undefined:Number(worker?.dailyUsed||0),quotaActive:quota.active,quotaResumeAt:quota.resumeAt,dailyLimit:WAYNE_DAILY_LIMIT},
  pilotReadiness:{eligible:blockers.length===0,blockers,remaining,nextEligibleAt:readyAt?new Date(readyAt).toISOString():null},
  lastScheduledRun:audit?.last||null,scheduledRuns:Number(audit?.runs||0),
  nextCountyAutomatic:false,allCountiesConfigured:false,checks:steps,
  waynePilotReady:steps.filter(x=>['preview_validation','safety'].includes(x.key)).every(x=>x.ready),
  nationwideReady:false,releaseReady:steps.every(x=>x.ready)});
}
export default auth.withBrainStore(handler);
