import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {execute,containerArgs,validJob,cleanup,checkDocker,VERSION} from '../runner-package/runner.mjs';
const args=containerArgs('test','sha256:abc','MARK');
for(const flag of ['--network','--memory','--memory-swap','--cpus','--pids-limit','--read-only','--cap-drop','--security-opt','--user','--pull','--rm','--tmpfs'])assert.ok(args.includes(flag),flag);
assert.equal(args[0],'create');assert.equal(args[args.indexOf('--network')+1],'none');assert.equal(args[args.indexOf('--pull')+1],'never');assert.equal(args[args.indexOf('--cap-drop')+1],'ALL');assert.equal(args[args.indexOf('--user')+1],'1000:1000');
assert.ok(!args.some(a=>/^(-v|--volume|--mount|--privileged|--env|-e|--env-file|--cap-add|--network=host)$/.test(a)),'no mounts, env, privileges or extra capabilities');
assert.equal(args.at(-1),'-');assert.equal(decodeURIComponent(args.at(-2).slice('data:text/javascript,'.length)),'process.stderr.write("MARK\\n")','preload only writes the start marker');
assert.ok(validJob({id:crypto.randomUUID(),code:'console.log(4)',expires:Date.now()+10000}));assert.ok(!validJob({id:'anything',code:'',expires:0}));assert.ok(!validJob({id:crypto.randomUUID(),code:'x'.repeat(16001),expires:Date.now()+10000}));
// Fake docker CLI: create/inspect/rm/kill results are scripted; `start` emits the marker then behaves as asked.
function fakeDocker({create=true,rm=true,gone=true,info='linux 29.5.3',calls=[]}={}){return async(a,timeout)=>{calls.push(a[0]+' '+(a[1]||''));assert.ok(timeout>0);
 if(a[0]==='create')return create===true?{ok:true,ms:5,stdout:'id',stderr:'',code:0}:{ok:false,ms:60000,stdout:'',stderr:create,timedOut:create==='',code:create===''?'ETIMEDOUT':1};
 if(a[0]==='rm')return rm?{ok:true,ms:3,stdout:'',stderr:'',code:0}:{ok:false,ms:30000,stdout:'',stderr:'',timedOut:true,code:'ETIMEDOUT'};
 if(a[0]==='container')return gone?{ok:false,ms:2,stdout:'',stderr:'Error: No such container: x',code:1}:{ok:true,ms:2,stdout:'removing',stderr:'',code:0};
 if(a[0]==='info')return info?{ok:true,ms:9,stdout:info,stderr:'',code:0}:{ok:false,ms:90000,stdout:'',stderr:'',timedOut:true,code:'ETIMEDOUT'};
 return {ok:true,ms:1,stdout:'',stderr:'',code:0};};}
function fakeStart({exit=0,text='PASS',hang=false,large=false,error=false,noMarker=false,delay=0}={}){return (cmd,a,o)=>{assert.equal(cmd,'docker');assert.deepEqual(a.slice(0,3),['start','-a','-i']);assert.equal(o.shell,false);assert.ok(!Object.keys(o.env).some(k=>/TOKEN|KEY|SECRET/.test(k)));
 const c=new EventEmitter();c.stdout=new PassThrough();c.stderr=new PassThrough();c.stdin=new PassThrough();c.kill=()=>{setImmediate(()=>c.emit('close',null));return true;};
 setTimeout(()=>{if(error)return c.emit('error',Error('fail'));if(!noMarker)c.stderr.write(markerFrom(o)+'\n');if(large)c.stdout.write(Buffer.alloc(61000));else c.stdout.write(text);if(!hang&&!large)setImmediate(()=>c.emit('close',exit));},delay);return c;};}
let marker='';const markerFrom=()=>marker;
const run=async(opts,dockerOpts,extra={})=>{const calls=[];const dockerCommand=async(a,t)=>{if(a[0]==='create')marker=decodeURIComponent(a.at(-2).split(',')[1]).match(/"(.*)\\n"/)[1];return fakeDocker({...dockerOpts,calls})(a,t);};const r=await execute('test','image',{spawnProcess:fakeStart(opts),dockerCommand,wait:async()=>{},...extra});return {...r,calls};};
const pass=await run();assert.equal(pass.status,'passed');assert.equal(pass.stdout,'PASS');assert.equal(pass.diagnostics.runner,VERSION);assert.deepEqual(pass.diagnostics.phases.map(p=>p.phase),['container_create','container_start','execution','cleanup']);assert.ok(!pass.stderr.includes('SKYDATA_EXEC_START'),'marker stripped');
assert.equal((await run({exit:1})).status,'failed');
const slow=await run({hang:true},{},{limits:{executionMs:20,startupMs:5000,cleanupMs:100,createMs:100,dockerCheckMs:100}});assert.equal(slow.status,'timeout');assert.ok(slow.calls.includes('kill skydata-test-'+slow.calls.find(c=>c.startsWith('kill')).split('skydata-test-')[1]),'container killed, not only the CLI');
assert.equal((await run({large:true})).status,'output_limit');
const spawnFail=await run({error:true});assert.equal(spawnFail.status,'infrastructure_error');assert.equal(spawnFail.diagnostics.executionStatus,'not_started');
const neverStarts=await run({noMarker:true,hang:true},{},{limits:{executionMs:10000,startupMs:20,cleanupMs:100,createMs:100,dockerCheckMs:100}});assert.equal(neverStarts.status,'infrastructure_error');assert.match(neverStarts.stderr,/did not run/);assert.equal(neverStarts.diagnostics.phases.find(p=>p.phase==='container_start').code,'startup_timeout');
const compileError=await run({noMarker:true,exit:1,text:''});assert.equal(compileError.status,'failed','syntax errors are code failures');
const daemon=await run({noMarker:true,exit:1,text:''},{},{}).then(()=>execute('x','image',{spawnProcess:(c,a,o)=>{const p=fakeStart({noMarker:true,exit:1,text:''})(c,a,o);setImmediate(()=>p.stderr.write('Error response from daemon: boom'));return p;},dockerCommand:fakeDocker(),wait:async()=>{}}));assert.equal(daemon.status,'infrastructure_error');
const createFail=await run({},{create:''});assert.equal(createFail.status,'infrastructure_error');assert.equal(createFail.diagnostics.phases[0].code,'ETIMEDOUT');assert.match(createFail.stderr,/container_create/);
// Cleanup is confirmed by inspecting, not by rm's error text; a timed-out rm with the container gone is fine.
const rmSlow=await run({},{rm:false,gone:true});assert.equal(rmSlow.status,'passed');assert.equal(rmSlow.diagnostics.cleanupConfirmed,true);
const stuck=await run({},{rm:false,gone:false});assert.equal(stuck.status,'infrastructure_error');assert.equal(stuck.diagnostics.executionStatus,'passed','the code result is preserved when cleanup fails');assert.equal(stuck.diagnostics.cleanupConfirmed,false);assert.match(stuck.stderr,/Code result before cleanup: passed/);
const c=await cleanup('n',{dockerCommand:fakeDocker({rm:true,gone:false}),wait:async()=>{}});assert.equal(c.ok,false);assert.equal(c.code,'still_present');
assert.equal((await checkDocker({dockerCommand:fakeDocker()})).ok,true);const offline=await checkDocker({dockerCommand:fakeDocker({info:''})});assert.equal(offline.ok,false);assert.equal(offline.code,'ETIMEDOUT');
assert.equal((await checkDocker({dockerCommand:fakeDocker({info:'windows 29.5.3'})})).ok,false,'Windows containers rejected');
// Regression: enforcement must not wait for a slow or hung `docker kill` (review finding: 20 ms limit + 180 ms kill reported ~201 ms).
const fast={executionMs:20,startupMs:5000,cleanupMs:300,createMs:100,dockerCheckMs:100,graceMs:50};
const withKill=behaviour=>async(a,t)=>{if(a[0]==='create')marker=decodeURIComponent(a.at(-2).split(',')[1]).match(/"(.*)\\n"/)[1];if(a[0]==='kill')return behaviour(t);return fakeDocker()(a,t);};
const delayed=await execute('test','image',{spawnProcess:fakeStart({hang:true}),dockerCommand:withKill(()=>new Promise(r=>setTimeout(()=>r({ok:true,ms:180,stdout:'',stderr:'',code:0}),180))),limits:fast,wait:async()=>{}});
assert.equal(delayed.status,'timeout');assert.ok(delayed.durationMs<60,'execution measured to the enforcement moment, not the kill: '+delayed.durationMs+' ms');
const term=delayed.diagnostics.phases.find(p=>p.phase==='termination');assert.equal(term.ok,true);assert.match(term.detail,/confirmed by docker kill/);
let hungAt=Date.now();const hung=await execute('test','image',{spawnProcess:fakeStart({hang:true}),dockerCommand:withKill(()=>new Promise(()=>{})),limits:fast,wait:async()=>{}});
assert.equal(hung.status,'timeout','cleanup confirmed the container is gone, so the code result stands');assert.ok(hung.durationMs<60,String(hung.durationMs));assert.ok(Date.now()-hungAt<fast.cleanupMs+3000,'a hung docker kill is bounded');
const ht=hung.diagnostics.phases.find(p=>p.phase==='termination');assert.equal(ht.ok,false);assert.match(ht.detail,/NOT confirmed.*timed out/);assert.match(hung.stderr,/did not confirm the container stopped/);
const stubborn=(cmd,a,o)=>{const c=fakeStart({hang:true})(cmd,a,o);c.kill=()=>true;return c;};// CLI ignores the kill and never closes
hungAt=Date.now();const ignored=await execute('test','image',{spawnProcess:stubborn,dockerCommand:withKill(async()=>({ok:false,ms:5,stdout:'',stderr:'Error response from daemon: cannot kill',code:1})),limits:fast,wait:async()=>{}});
assert.equal(ignored.status,'timeout');assert.ok(ignored.durationMs<60);assert.ok(Date.now()-hungAt<1500,'finished after the grace period although the CLI never closed');assert.match(ignored.diagnostics.phases.find(p=>p.phase==='termination').detail,/failed \(1\)/);
const stuckHung=await execute('test','image',{spawnProcess:fakeStart({hang:true}),dockerCommand:async(a,t)=>{if(a[0]==='create')marker=decodeURIComponent(a.at(-2).split(',')[1]).match(/"(.*)\\n"/)[1];if(a[0]==='kill')return new Promise(()=>{});return fakeDocker({rm:false,gone:false})(a,t);},limits:fast,wait:async()=>{}});
assert.equal(stuckHung.status,'infrastructure_error','neither kill nor cleanup confirmed: never reported as a plain timeout');assert.equal(stuckHung.diagnostics.executionStatus,'timeout');assert.equal(stuckHung.diagnostics.cleanupConfirmed,false);
console.log('PASS runner '+VERSION+' process contract (docker CLI mocked): restricted create arguments, marker preload, success, failure, timeout with container kill, output limit, spawn failure, start-up timeout, compile errors vs daemon errors, create timeout, enforcement independent of a delayed/hung docker kill and an unresponsive CLI with honest termination reporting, cleanup confirmed by inspect, preserved code result on cleanup failure, Docker check. Real container behaviour is covered by test-runner-docker.mjs; HP behaviour is unverified.');
