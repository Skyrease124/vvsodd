import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const schedule=fs.readFileSync('netlify/functions/brain-wayne-scheduled.mjs','utf8');
const worker=fs.readFileSync('netlify/functions/owner-brain-wayne-run.mjs','utf8');
test('published scheduled runner defaults off and requires explicit Netlify env opt in',()=>{
 assert.match(schedule,/schedule:'\*\/30 \* \* \* \*'/);
 assert.match(schedule,/owner-brain-wayne-scheduler-control-v1/);
 assert.match(schedule,/setting\?\.enabled===true/);
 assert.match(schedule,/setting\?\.approvedForProduction===true/);
 assert.match(schedule,/context\.deploy\.published!==true/);
 assert.match(schedule,/context\?\.deploy\?\.context!=='production'/);
});
test('scheduled runner invokes same guarded worker as owner-triggered force button',()=>{
 assert.match(schedule,/import \{runScheduledWayne\} from '\.\/owner-brain-wayne-run\.mjs'/);
 assert.match(schedule,/await runScheduledWayne\(synthetic,context\)/);
 assert.match(worker,/export const runScheduledWayne=auth\.withBrainStore/);
 assert.match(worker,/waynePublisherInternal:true,chargeWayneGisRequest:async/);
 assert.match(worker,/MAX_ATTEMPTS=3, MAX_PER_DAY=30/);
 assert.match(worker,/controlNow\?\.status==='paused'/);
 assert.match(worker,/auth\.kvGet\(OVERLAY\)/);
});

test('website scheduler toggle is owner-only, same-origin and production-only',()=>{
 const control=fs.readFileSync('netlify/functions/owner-brain-scheduler-control.mjs','utf8');
 const ownerPage=fs.readFileSync('kinvest-liens/owner/brain/index.html','utf8');
 const ready=fs.readFileSync('netlify/functions/owner-brain-autonomy-status.mjs','utf8');
 assert.match(control,/if\(!user\?\.owner\)/);
 assert.match(control,/if\(!production\)return reply\(403/);
 assert.match(control,/req\.headers\.get\('origin'\)!==new URL\(req\.url\)\.origin/);
 assert.match(control,/body\.confirmed!==true/);
 assert.match(control,/wayne-verified-gis-only/);
 assert.match(control,/enabled:false,approvedForProduction:false/);
 assert.match(ownerPage,/id="unattendedToggle"/);
 assert.match(ownerPage,/owner-brain-scheduler-control/);
 assert.match(ownerPage,/toggle\.hidden=!!d\.preview/);
 assert.match(ready,/websiteControlledSchedule:true/);
});

test('map coverage counter is authoritative, worker total is separately labeled',()=>{
 const status=fs.readFileSync('netlify/functions/owner-brain-autonomy-status.mjs','utf8');
 const page=fs.readFileSync('kinvest-liens/owner/brain/index.html','utf8');
 assert.match(status,/verifiedOverlayCount=Object.values\(overlay\?\.records\|\|\{\}\)/);
 assert.match(status,/r\?\.verifiedGeometry===true/);
 assert.match(status,/publicationCountMeaning/);
 assert.match(page,/Verified map polygons/);
 assert.match(page,/Worker-published/);
 assert.match(status,/waynePilotReady/);
 assert.match(status,/nationwideReady:false/);
});

test('exhausted retry reviewer requires owner, exact parcel, cursor, origin and confirmation',()=>{
 const recovery=fs.readFileSync('netlify/functions/owner-brain-wayne-retry-review.mjs','utf8');
 const page=fs.readFileSync('kinvest-liens/owner/brain/index.html','utf8');
 assert.match(recovery,/if\(!owner\?\.owner\)/);
 assert.match(recovery,/req\.headers\.get\('origin'\)!==new URL\(req\.url\)\.origin/);
 assert.match(recovery,/action\.confirmed!==true/);
 assert.match(recovery,/action\.parcelId!==retry\.parcelId/);
 assert.match(recovery,/action\.cursor!==worker\.cursor/);
 assert.match(recovery,/retry\?\.exhausted/);
 assert.match(recovery,/worker\?\.lockedUntil/);
 assert.match(recovery,/control\?\.status==='paused'/);
 assert.match(recovery,/retry:null/);
 assert.match(recovery,/lastOwnerRecovery/);
 assert.doesNotMatch(recovery,/dailyUsed\s*:\s*0|cursor\s*:\s*worker\.cursor\s*\+/);
 assert.match(page,/id="wayneRetryAlert"/);
 assert.match(page,/owner-brain-wayne-retry-review/);
 assert.match(page,/Retry the same parcel/);
});

async function retryHarness({owner=true,paused=false,exhausted=true}={}){
 const store=new Map();
 const versions=new Map();
 store.set('owner-brain-wayne-worker-v1',{
  cursor:11,day:'2026-11-21',dailyUsed:23,lockedUntil:null,
  retry:exhausted?{parcelId:'01006446',cursor:11,attempts:3,exhausted:true,lastError:'GIS timed out'}:null
 });
 store.set('owner-brain-scanner-v1',{status:paused?'paused':'active'});
 const ctx=vm.createContext({Response,Request,URL,Date});
 const auth=new vm.SyntheticModule(['userFromCookie','kvGet','kvPut','kvGetVersioned','kvPutVersioned','withBrainStore'],function(){
  this.setExport('userFromCookie',async()=>owner?{owner:true}:null);
  this.setExport('kvGet',async k=>structuredClone(store.get(k)));
  this.setExport('kvPut',async(k,v)=>{store.set(k,structuredClone(v));});
  this.setExport('kvGetVersioned',async key=>store.has(key)
   ? {data:structuredClone(store.get(key)),etag:versions.get(key)||'initial'} : null);
  this.setExport('kvPutVersioned',async (key,value,expected)=>{
   const current=store.has(key)?versions.get(key)||'initial':null;
   if(current!==expected)return null;
   const next=(versions.get(key)||'initial')+'-updated';
   versions.set(key,next);
   store.set(key,structuredClone(value));
   return next;
  });
  this.setExport('withBrainStore',fn=>fn);
 },{context:ctx});
 const source=fs.readFileSync('netlify/functions/owner-brain-wayne-retry-review.mjs','utf8');
 const mod=new vm.SourceTextModule(source,{context:ctx});await mod.link(()=>auth);await mod.evaluate();
 const invoke=(body,{origin='https://preview.test',deploy='deploy-preview',method='POST'}={})=>
  mod.namespace.default(new Request('https://preview.test/.netlify/functions/owner-brain-wayne-retry-review',{
   method,headers:{origin},...(method==='POST'?{body:JSON.stringify(body)}:{})
  }),{deploy:{context:deploy}});
 return {store,invoke};
}
test('live recovery handler rejects nonowner, forged origin, stale parcel and paused worker',async()=>{
 const body={action:'rearm-exhausted-parcel',confirmed:true,parcelId:'01006446',cursor:11};
 const guest=await retryHarness({owner:false});
 assert.equal((await guest.invoke(body)).status,401);
 const h=await retryHarness();
 assert.equal((await h.invoke(body,{origin:'https://attacker.test'})).status,403);
 assert.equal((await h.invoke({...body,parcelId:'01099999'})).status,409);
 assert.equal((await h.invoke({...body,cursor:12})).status,409);
 assert.equal((await h.invoke({...body,confirmed:false})).status,400);
 const paused=await retryHarness({paused:true});
 assert.equal((await paused.invoke(body)).status,409);
 assert.equal(paused.store.get('owner-brain-wayne-worker-v1').retry.exhausted,true);
});
test('owner re-arms exact exhausted parcel without moving cursor or resetting quota',async()=>{
 const h=await retryHarness(),body={action:'rearm-exhausted-parcel',confirmed:true,parcelId:'01006446',cursor:11};
 const result=await h.invoke(body),d=await result.json();
 assert.equal(result.status,200);
 assert.equal(d.rearmed,true);
 const saved=h.store.get('owner-brain-wayne-worker-v1');
 assert.equal(saved.cursor,11);
 assert.equal(saved.dailyUsed,23);
 assert.equal(saved.retry,null);
 assert.equal(saved.lastOwnerRecovery.parcelId,'01006446');
 assert.equal(saved.lastOwnerRecovery.exhaustedAttempts,3);
 assert.equal((await h.invoke(body)).status,409);
});


test('scheduler mutation rejects guests, previews, cross-site and unconfirmed requests',async()=>{
 const source=fs.readFileSync('netlify/functions/owner-brain-scheduler-control.mjs','utf8');
 const store=new Map();
 let owner=true,writes=0;
 const auth={
  userFromCookie:async()=>owner?{owner:true}:null,
  kvGet:async key=>store.get(key)||null,
  kvPut:async(key,value)=>{writes++;store.set(key,value);},
  isBrainPreview:()=>false,
  withBrainStore:handler=>handler
 };
 const code=source.replace(/^import .*;$/gm,'').replace(/export default auth\.withBrainStore\(handler\);?/,'');
 const handler=vm.runInNewContext(code+';handler',{auth,Response,Request,URL,Date});
 const url='https://pricepocketasset.com/.netlify/functions/owner-brain-scheduler-control';
 const call=(body,headers={},context='production')=>handler(new Request(url,{method:'POST',headers:{origin:'https://pricepocketasset.com',...headers},body:JSON.stringify(body)}),{deploy:{context,published:true}});
 const enable={action:'enable',confirmed:true,scope:'wayne-verified-gis-only'};
 owner=false;
 assert.equal((await call(enable)).status,401);
 owner=true;
 assert.equal((await call(enable,{},'deploy-preview')).status,403);
 assert.equal((await call(enable,{'sec-fetch-site':'cross-site'})).status,403);
 assert.equal((await call(enable,{origin:'https://attacker.example'})).status,403);
 assert.equal((await call({...enable,confirmed:false})).status,400);
 assert.equal((await call({...enable,scope:'other'})).status,400);
 assert.equal(writes,0);
 assert.equal((await call(enable,{'sec-fetch-site':'same-origin'})).status,200);
 assert.equal(writes,1);
 assert.equal(store.get('owner-brain-wayne-scheduler-control-v1').enabled,true);
});
