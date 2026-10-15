// Run only against a dedicated staging backend and an authorized public fixture.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const base=process.env.SKYDATA_BROWSER_TEST_ENDPOINT,token=process.env.SKYDATA_BROWSER_SERVICE_TOKEN,fixture=process.env.SKYDATA_BROWSER_FIXTURE_URL;
if(!base||!token||!fixture){console.log('BLOCKED: real Stagehand integration requires a running isolated backend, its service token and an authorized public fixture URL. No browser/AI execution was verified.');process.exitCode=2;}else{
 const api=async(path,method='GET',body)=>{const r=await fetch(new URL(path,base),{method,headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(20000)});const data=await r.json();assert.ok(r.ok,JSON.stringify(data));return data;};
 for(const engine of ['superpowers','rea']){
  const id=randomUUID();await api('/jobs','POST',{id,url:fixture,goal:'Inspect public navigation, metadata and responsive layouts. Do not submit forms or play media.',engine});
  try{
   const deadline=Date.now()+210000;let job;
   do{await new Promise(r=>setTimeout(r,2000));job=await api('/jobs/'+id);if(!['queued','running'].includes(job.status))break;}while(Date.now()<deadline);
   assert.equal(job.status,'complete',JSON.stringify({status:job.status,error:job.error}));const e=job.result;
   assert.equal(e.browserExecuted,true);assert.equal(e.cleanupConfirmed,true);assert.equal(e.stagehandVersion,'4.2.1');assert.ok(e.pages.length>0);assert.ok(e.screenshots.some(s=>s.width===390&&s.png.startsWith('iVBOR')));assert.ok(e.screenshots.some(s=>s.width===1440));assert.ok(e.usage.calls>0,'real Stagehand model callback executed');assert.ok(e.usage.inputTokens>0,'provider reported token usage');
   if(engine==='rea'){assert.equal(e.rea.rea.version,'6.5.0');assert.equal(e.rea.workspaceUnchanged,true);assert.equal(e.rea.cleanupConfirmed,true);assert.ok(e.rea.findings);}
   console.log('PASS real isolated Stagehand evidence collection: '+engine+'; '+e.pages.length+' pages, '+e.interactions.length+' navigation interactions. This script does not verify the final Sites report or hostile-site confinement.');
  }finally{await api('/jobs/'+id,'DELETE');}
 }
}
