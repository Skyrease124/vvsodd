import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {pureModule} from './support/policy-linker.mjs';
import {PUTNAM,putnamActivity} from '../../netlify/lib/brain-gis-putnam.mjs';
const source=fs.readFileSync('netlify/functions/owner-brain-activity.mjs','utf8');
const page=fs.readFileSync('kinvest-liens/owner/brain/activity/index.html','utf8');
const brain=fs.readFileSync('kinvest-liens/owner/brain/index.html','utf8');
async function create(owner,research=null,quota={active:true,count:21},county=null,putnamReceipt=null){
 const store=new Map([
  ['owner-brain-wayne-worker-v1',{cursor:7,runs:2,verified:5,published:5,needsReview:0,failures:0,dailyUsed:5,state:'idle',lastCompleted:'2026-11-21T20:00:00.000Z',recent:[{parcelId:'01002754',status:'published'}]}],
  ['brain-map-history-v1',{entries:[{dataset:'MI-wayne',parcelId:'01002754',action:'published',source:'official GIS',at:'2026-11-21T20:00:00.000Z'}]}],
 ]);
 if(putnamReceipt)store.set('brain-gis-putnam-verification-v1-'+PUTNAM.requestId,putnamReceipt);
 if(research)store.set('brain-reconciliation-research-v1-CO-larimer',research);
 if(county)store.set('brain-gis-operations-v1-FL-miami-dade',county);
 const context=vm.createContext({Response,console,Date});
 const auth=new vm.SyntheticModule(['userFromCookie','kvGet','withBrainStore','isBrainPreview','readWayneGisQuota'],function(){
  this.setExport('userFromCookie',async()=>owner?{owner:true}:null);
  this.setExport('kvGet',async k=>structuredClone(store.get(k)));
  this.setExport('withBrainStore',fn=>fn);
  this.setExport('isBrainPreview',()=>true);
  this.setExport('readWayneGisQuota',async()=>quota);
 },{context});
 const mod=new vm.SourceTextModule(source,{context});
 const operations=new vm.SyntheticModule(['countyOperation','operationCountyIds','countyCheckpointKey'],function(){
  this.setExport('countyOperation',()=>({mode:'research-only'}));
  this.setExport('operationCountyIds',()=>['CO-larimer','FL-miami-dade']);
  this.setExport('countyCheckpointKey',id=>'brain-gis-operations-v1-'+id);
 },{context});
 const putnam=new vm.SyntheticModule(['putnamActivity'],function(){
  this.setExport('putnamActivity',putnamActivity);
 },{context});
 const rl=new vm.SyntheticModule(['peek','hit'],function(){this.setExport('peek',async()=>({used:0}));this.setExport('hit',async()=>({ok:true}));},{context});
 await mod.link(async specifier=>specifier.includes('ratelimit')?rl:specifier.includes('brain-auth')?auth:specifier.includes('brain-gis-putnam')?putnam:specifier.includes('brain-gis-universal')||specifier.includes('brain-gis-county')?operations:(await pureModule(specifier,context))||operations);await mod.evaluate();
 return mod.namespace.default;
}
test('owner alone reads actual saved worker and publication events',async()=>{
 const run=await create(true),res=await run(new Request('https://preview.test/.netlify/functions/owner-brain-activity'));
 const d=await res.json();
 assert.equal(res.status,200);assert.equal(d.summary.cursor,7);
 assert.equal(d.health.dailyUsed,21);assert.equal(d.health.remaining,279);assert.equal(d.summary.processed,null);
 assert.equal(d.events.filter(e=>e.type==='published').length,1);
 assert.equal(d.events.find(e=>e.type==='published').parcelId,'01002754');
 assert.equal(d.agents.Gemini.state,'idle');assert.equal(d.agents.Cloudflare.state,'idle');
 assert.equal(d.agents.NVIDIA.state,'idle');
});
test('unauthorized user cannot inspect activity',async()=>{
 const run=await create(false);
 assert.equal((await run(new Request('https://preview.test/.netlify/functions/owner-brain-activity'))).status,401);
});
test('UI retains V12-style 256 flowing fibers and shows only genuine events',()=>{
 assert.match(page,/for\(let i=0;i<64;i\+\+\)/);
 assert.match(page,/const positions=\[/);
 assert.match(page,/NVIDIA Pulse Reactor/);
 assert.match(page,/Live Agent Activity/);
 assert.match(page,/Verified Transfers/);
 assert.match(page,/No recorded agent events yet/);
 assert.match(page,/owner-brain-activity/);
 assert.match(page,/setInterval\(\(\)=>/);
 assert.match(page,/20000/);
 assert.doesNotMatch(page,/Extracted parcel IDs · 86 records|DEMO<\/small>/);
 assert.match(brain,/href="\/owner\/brain\/activity\/"/);
});
test('reactor uses distinct event pulses and never replays historical events at first load',()=>{
 assert.match(page,/function classifyEvent\(ev\)/);
 assert.match(page,/pulse-publish/);
 assert.match(page,/pulse-verify/);
 assert.match(page,/pulse-error/);
 assert.match(page,/if\(!active\)\{seenEvents=current;return;\}/);
 assert.match(page,/events\.filter\(e=>!seenEvents\.has\(e\.id\)\)/);
 assert.match(page,/signalQueue\.push/);
 assert.match(page,/body\.classList\.contains\('still'\)/);
 assert.match(page,/prefers-reduced-motion:reduce/);
 assert.match(page,/aria-live="polite"/);
 assert.match(page,/event-reactor/);
 assert.match(page,/id="reactorCanvas"/);
 assert.match(page,/getContext\('2d'\)/);
 assert.match(page,/requestAnimationFrame/);
 assert.match(page,/event-beam/);
 assert.match(page,/event-wave/);
});
test('worker timestamps individual GIS outcomes instead of inventing exact event time',()=>{
 const worker=fs.readFileSync('netlify/functions/owner-brain-wayne-run.mjs','utf8');
 assert.match(worker,/status:'skipped',checkedAt:new Date\(\)\.toISOString\(\)/);
 assert.match(worker,/status:'retry_later',checkedAt:new Date\(\)\.toISOString\(\)/);
 assert.match(worker,/status:publishedNow\?'published':'pending_owner_review',lookupMethod:method,checkedAt:new Date\(\)\.toISOString\(\)/);
 assert.match(source,/const at=date\(r\.checkedAt\)/);
 assert.match(source,/if\(!at\)continue/);
 assert.match(source,/approximateTime:false/);
 assert.match(source,/type:'verification_result'/);
});

test('activity health distinguishes retrying, active, paused, idle and attention',()=>{
 assert.match(source,/const health=\{state,detail:/);
 assert.match(source,/retry\?\.exhausted/);
 assert.match(source,/cooling\?'retrying'/);
 assert.match(source,/nextRetryAt:date\(retry\?\.nextAt\)/);
 assert.match(source,/control\?\.status==='paused'/);
 assert.match(page,/Official GIS Agent Health/);
 assert.match(page,/id="healthState"/);
 assert.match(page,/id="healthMeta"/);
 assert.match(page,/health\.state\.replaceAll/);
 assert.match(page,/health\.nextRetryAt/);
 assert.match(page,/GIS requests today:/);
});

test('activity audit preserves exact retry times and displays GIS stages',()=>{
 assert.match(source,/const recentIds=new Set\(\)/);
 assert.match(source,/recentIds\.has\(id\)/);
 assert.match(source,/gisTrace/);
 assert.match(source,/failedStage/);
 assert.match(page,/className='gis-trace'/);
 assert.match(page,/durationMs\+'ms'/);
 assert.match(page,/Failed stage/);
});


test('Reactor uses only persisted research receipts and deduplicates them',async()=>{
 const receipt={id:'case|recorder|1',at:'2026-11-22T01:00:00Z',sourceId:'recorder',outcome:'restricted'};
 const run=await create(true,{events:[receipt,receipt,{...receipt,id:'invented',outcome:'simulated'}]});
 const body=await (await run(new Request('https://preview.test/activity'))).json();
 assert.equal(body.events.filter(e=>e.type==='parcel_research').length,1);
 assert.match(body.events.find(e=>e.type==='parcel_research').message,/restricted/);
 assert.equal(body.summary.cursor,7);
});


test('source reservation and actual HTTP metadata receipts are distinct Reactor events',async()=>{
 const base={at:'2026-11-22T01:00:00Z',sourceId:'assessor'};
 const run=await create(true,{events:[{...base,id:'start',outcome:'started'},
  {...base,id:'finish',outcome:'metadata',httpStatus:200}]});
 const body=await (await run(new Request('https://preview.test/activity'))).json();
 const rows=body.events.filter(event=>event.type==='parcel_research');
 assert.equal(rows.length,2);
 assert.doesNotMatch(rows.find(e=>e.id==='research-start').message,/HTTP|saved/);
 assert.match(rows.find(e=>e.id==='research-finish').message,/HTTP 200.*Metadata saved/);
});


test('inactive shared quota is shown as unknown even with a historical worker counter',async()=>{
 const run=await create(true,null,{active:false,count:0});
 const d=await (await run(new Request('https://preview.test/activity'))).json();
 assert.equal(d.health.dailyUsed,null);
 assert.equal(d.health.remaining,null);
});


test('Miami-Dade Reactor events distinguish saved request reservations from verified publications',async()=>{
 const at='2026-11-22T00:00:00Z';
 const run=await create(true,null,{active:true,count:21},{events:[
  {id:1,at,status:'request_reserved',stage:'schema',pilotUsed:1,sharedUsed:1},
  {id:2,at,status:'skipped',parcelId:'30-3052-075-0060',reason:'Invalid polygon'},
  {id:3,at,status:'fake_success',parcelId:'mock'}
 ]});
 const d=await (await run(new Request('https://preview.test/activity'))).json();
 const events=d.events.filter(event=>event.county==='FL-miami-dade');
 assert.equal(events.length,2);
 assert.ok(events.some(event=>event.message.includes('1/3 pilot requests reserved')));
 assert.ok(events.some(event=>event.message.includes('Invalid polygon')));
 assert.ok(events.every(event=>event.type==='county_research'));
});

test('finished Putnam receipt uses only recorded time and charges quota once in the feed',async()=>{
 const receipt={requestId:PUTNAM.requestId,checkedAt:'2026-11-22T18:23:49.242Z',httpStatus:200,
  quotaReceipt:{reserved:1},result:{status:'needs_review',geometryValid:true,crs:'EPSG:4326',
   polygonAcres:0.1149,reason:'Missing independent land-use evidence'}};
 const run=await create(true,null,undefined,null,receipt);
 const request=new Request('https://preview.test/.netlify/functions/owner-brain-activity');
 const first=await (await run(request)).json(),second=await (await run(request)).json();
 const recorded=first.events.filter(event=>event.county==='FL-putnam');
 const audit=recorded.find(event=>event.timePrecision==='day');
 assert.equal(audit.at,'2026-11-22');
 assert.match(audit.message,/HTTP 503/);
 const events=recorded.filter(event=>event.receiptId===receipt.requestId);
 assert.equal(events.length,2);
 assert.deepEqual(events,second.events.filter(event=>event.receiptId===receipt.requestId));
 assert.ok(events.every(event=>event.at===receipt.checkedAt&&event.receiptId===receipt.requestId));
 assert.equal(events.filter(event=>event.quotaImpact===1).length,1);
 assert.ok(events.some(event=>event.type==='geometry_validated'));
 assert.ok(events.some(event=>event.status==='warning'));
});


test('replay and simulation retain periodic owner authorization checks',()=>{
 assert.match(page,/if\(document\.hidden\|\|refresh\.busy\)return;refresh\.busy=true;/);
 assert.doesNotMatch(page,/refresh\.busy\|\|mode\(\)!=='live'/);
 assert.match(page,/if\(r\.status===401\|\|r\.status===403\)\{\s*pauseReplay\(\)/);
 assert.match(page,/Owner session expired\. Sign in again/);
 assert.match(page,/if\(mode\(\)==='live'\)render\(d\)/);
});


test('API labels the displayed receipts as a bounded window, not complete historical count',async()=>{
 const run=await create(true);
 const response=await (await run(new Request('https://preview.test/activity'))).json();
 assert.equal(response.eventWindow.completeHistory,false);
 assert.equal(response.eventWindow.returnedCount,response.events.length);
 assert.ok(response.eventWindow.availableCount>=response.eventWindow.returnedCount);
 assert.equal(response.eventWindow.truncated,false);
 assert.equal(response.eventCount,response.eventWindow.returnedCount);
});


test('Activity UI explicitly labels historical replay as a recent-event window',()=>{
 assert.match(page,/id="eventWindow"/);
 assert.match(page,/Historical archive not yet verified/);
 assert.match(page,/windowInfo\.truncated/);
 assert.match(page,/Owner authorization required to inspect recorded events/);
});


test('all 256 thin Reactor fibers animate with original drag and reduced motion support',()=>{
 assert.match(page,/const reactorFibers=\[\],fibersByNode=\[\]/);
 assert.match(page,/function drawFrame\(time\)/);
 assert.match(page,/for\(let i=0;i<64;i\+\+\)/);
 assert.doesNotMatch(page,/\.fiber\.moving\.dense\{animation:none/);
 assert.match(page,/prefers-reduced-motion:reduce/);
 assert.match(page,/function bindNode\(node,position,paths\)/);
});

test('inactive shared quota is identified without falsely reporting available requests',async()=>{
 const run=await create(true,null,{active:false,count:0,resumeAt:'2026-11-23T00:00:00.000Z'});
 const d=await (await run(new Request('https://preview.test/activity'))).json();
 assert.equal(d.health.dailyUsed,null);
 assert.equal(d.health.quotaActive,false);
 assert.equal(d.health.quotaResumeAt,'2026-11-23T00:00:00.000Z');
 assert.match(d.health.detail,/cutover.*resumes/);
});


test('mobile activity cards constrain long GIS receipts and transfer width',()=>{
 assert.match(page,/\.logbody small\{display:block;max-width:100%;overflow-wrap:anywhere/);
 assert.match(page,/\.transfer\{flex:0 0 min\(78vw,290px\)/);
 assert.match(page,/\.log-entry\{display:grid;grid-template-columns:8px minmax\(0,1fr\)/);
});


test('quota wait tells owner about first confirmed run and UTC cutover',()=>{
 assert.match(source,/first owner-confirmed pilot request/);
 assert.match(source,/no GIS dispatch until the following UTC day/);
});
