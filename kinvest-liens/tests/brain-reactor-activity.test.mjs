import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('netlify/functions/owner-brain-activity.mjs','utf8');
const page=fs.readFileSync('kinvest-liens/owner/brain/activity/index.html','utf8');
const brain=fs.readFileSync('kinvest-liens/owner/brain/index.html','utf8');
async function create(owner,research=null,quota={active:true,count:21}){
 const store=new Map([
  ['owner-brain-wayne-worker-v1',{cursor:7,runs:2,verified:5,published:5,needsReview:0,failures:0,dailyUsed:5,state:'idle',lastCompleted:'2026-11-21T20:00:00.000Z',recent:[{parcelId:'01002754',status:'published'}]}],
  ['brain-map-history-v1',{entries:[{dataset:'MI-wayne',parcelId:'01002754',action:'published',source:'official GIS',at:'2026-11-21T20:00:00.000Z'}]}],
 ]);
 if(research)store.set('brain-reconciliation-research-v1-CO-larimer',research);
 const context=vm.createContext({Response,console,Date});
 const auth=new vm.SyntheticModule(['userFromCookie','kvGet','withBrainStore','isBrainPreview','readWayneGisQuota'],function(){
  this.setExport('userFromCookie',async()=>owner?{owner:true}:null);
  this.setExport('kvGet',async k=>structuredClone(store.get(k)));
  this.setExport('withBrainStore',fn=>fn);
  this.setExport('isBrainPreview',()=>true);
  this.setExport('readWayneGisQuota',async()=>quota);
 },{context});
 const mod=new vm.SourceTextModule(source,{context});
 await mod.link(()=>auth);await mod.evaluate();
 return mod.namespace.default;
}
test('owner alone reads actual saved worker and publication events',async()=>{
 const run=await create(true),res=await run(new Request('https://preview.test/.netlify/functions/owner-brain-activity'));
 const d=await res.json();
 assert.equal(res.status,200);assert.equal(d.summary.cursor,7);
 assert.equal(d.health.dailyUsed,21);assert.equal(d.health.remaining,9);assert.equal(d.summary.processed,null);
 assert.equal(d.events.filter(e=>e.type==='published').length,1);
 assert.equal(d.events[0].parcelId,'01002754');
 assert.equal(d.agents.Gemini,'no_recorded_activity');
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
 assert.match(page,/event-beam/);
 assert.match(page,/event-wave/);
});
test('worker timestamps individual GIS outcomes instead of inventing exact event time',()=>{
 const worker=fs.readFileSync('netlify/functions/owner-brain-wayne-run.mjs','utf8');
 assert.match(worker,/status:'skipped',checkedAt:new Date\(\)\.toISOString\(\)/);
 assert.match(worker,/status:'retry_later',checkedAt:new Date\(\)\.toISOString\(\)/);
 assert.match(worker,/status:success\?'published':'publish_pending',lookupMethod:method,checkedAt:new Date\(\)\.toISOString\(\)/);
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
