// MOCKED (no Docker or Chromium): runs the real worker.mjs with stub Stagehand/Playwright modules to check slow viewport handling.
import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtemp} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
const dir=new URL('..',import.meta.url).pathname;
async function run(mode){
 const home=await mkdtemp(join(tmpdir(),'vp-'));
 const child=spawn(process.execPath,['--import','./test/fixtures/viewport-register.mjs','worker.mjs'],{cwd:dir,env:{PATH:process.env.PATH,HOME:home,MOCK_VIEWPORT:mode},stdio:['pipe','pipe','pipe']});
 child.stdin.end(JSON.stringify({url:'https://example.com/',goal:'Check layout',relayToken:'0'.repeat(64),model:'test'}));
 let out='',err='';child.stdout.on('data',c=>out+=c);child.stderr.on('data',c=>err+=c);
 const started=Date.now();const code=await new Promise(r=>child.on('close',r));
 const lines=out.trim().split('\n').map(l=>JSON.parse(l));
 return {code,err,ms:Date.now()-started,final:lines.at(-1),phases:lines.filter(l=>l.type==='phase').map(l=>l.phase)};
}
test('a viewport that applies after Stagehand RPC timeout is still captured',async()=>{
 const {final}=await run('slow');
 assert.equal(final.type,'result');assert.equal(final.status,'complete');
 assert.deepEqual(final.screenshots.map(s=>s.width),[1440,390]);
 const v=final.viewports.find(v=>v.width===390);assert.equal(v.applied,true);assert.ok(v.ms>=1400&&v.ms<5000,'waited '+v.ms);
 assert.ok(!final.limitations.some(l=>/viewport/.test(l)));
});
test('a viewport that never applies skips only that screenshot, within the bound',async()=>{
 const {final}=await run('never');
 assert.equal(final.type,'result');assert.equal(final.status,'complete');
 assert.deepEqual(final.screenshots.map(s=>s.width),[1440]);
 const v=final.viewports.find(v=>v.width===390);assert.equal(v.applied,false);assert.ok(v.ms>=20000&&v.ms<27000,'waited '+v.ms);
 assert.ok(final.limitations.some(l=>l.startsWith('The 390px viewport did not finish resizing')));
});
test('a screenshot that hits the extension TimeoutError is skipped and the busy page is not navigated further',async()=>{
 const {final,err,phases}=await run('shot');
 assert.equal(final.type,'result');assert.equal(final.status,'complete');
 assert.deepEqual(final.screenshots.map(s=>s.width),[390]);
 assert.equal(final.viewports.find(v=>v.width===1440).screenshot,'timed out');
 assert.ok(final.limitations.some(l=>l.startsWith('The 1440px screenshot did not finish')));
 assert.ok(final.limitations.some(l=>l.startsWith('The page stayed busy')));
 assert.ok(!err.includes('OBSERVE_CALLED'));assert.ok(!phases.includes('Examining functionality'));
});
test('other viewport errors still fail the investigation',async()=>{
 const {final,code}=await run('error');
 assert.equal(final.type,'error');assert.equal(final.error,'Target closed');assert.equal(final.failingPhase,'Collecting evidence');assert.equal(code,1);
});
