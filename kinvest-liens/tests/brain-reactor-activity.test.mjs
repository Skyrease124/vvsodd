import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('netlify/functions/owner-brain-activity.mjs','utf8');
const page=fs.readFileSync('kinvest-liens/owner/brain/activity/index.html','utf8');
const brain=fs.readFileSync('kinvest-liens/owner/brain/index.html','utf8');
async function create(owner){
 const store=new Map([
  ['owner-brain-wayne-worker-v1',{cursor:7,runs:2,verified:5,published:5,needsReview:0,failures:0,dailyUsed:5,state:'idle',lastCompleted:'2026-11-21T20:00:00.000Z',recent:[{parcelId:'01002754',status:'published'}]}],
  ['brain-map-history-v1',{entries:[{dataset:'MI-wayne',parcelId:'01002754',action:'published',source:'official GIS',at:'2026-11-21T20:00:00.000Z'}]}],
 ]);
 const context=vm.createContext({Response,console,Date});
 const auth=new vm.SyntheticModule(['userFromCookie','kvGet','withBrainStore','isBrainPreview'],function(){
  this.setExport('userFromCookie',async()=>owner?{owner:true}:null);
  this.setExport('kvGet',async k=>structuredClone(store.get(k)));
  this.setExport('withBrainStore',fn=>fn);
  this.setExport('isBrainPreview',()=>true);
 },{context});
 const mod=new vm.SourceTextModule(source,{context});
 await mod.link(()=>auth);await mod.evaluate();
 return mod.namespace.default;
}
test('owner alone reads actual saved worker and publication events',async()=>{
 const run=await create(true),res=await run(new Request('https://preview.test/.netlify/functions/owner-brain-activity'));
 const d=await res.json();
 assert.equal(res.status,200);assert.equal(d.summary.cursor,7);
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
 assert.match(worker,/status:'needs_review',checkedAt:new Date\(\)\.toISOString\(\)/);
 assert.match(worker,/status:'retry_later',checkedAt:new Date\(\)\.toISOString\(\)/);
 assert.match(worker,/status:success\?'published':'publish_pending',checkedAt:new Date\(\)\.toISOString\(\)/);
 assert.match(source,/const precise=date\(r\.checkedAt\)/);
 assert.match(source,/approximateTime:!precise/);
 assert.match(source,/type:'verification_result'/);
});
