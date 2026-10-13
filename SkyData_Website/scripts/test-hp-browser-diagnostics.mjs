import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
// The runner stores its stamp under HOME at module load, so the temporary HOME is set before importing it.
const dir=await mkdtemp(join(tmpdir(),'skyb-'));process.env.HOME=dir;
const {BROWSER_PREFIX,BROWSER_IMAGE,BROWSER_PIDS,boundedFailure,executeBrowser,browserSelftest}=await import('../runner-package/browser-job.mjs');
const {hpBrowserJob}=await import('../runner-package/runner.mjs');
// Docker CLI and worker MOCKED: v2.4.3 limits, failure-context retention and self-test reporting. Real Chrome runs are separate.
const token='a'.repeat(64),bundle={url:'https://example.com/',goal:'Inspect',engine:'superpowers',relayToken:token},job={id:'10000000-0000-4000-8000-000000000002',expires:Date.now()+600000,code:BROWSER_PREFIX+JSON.stringify(bundle)};
const cap={available:true,imageId:'sha256:'+'1'.repeat(64),proxyId:'sha256:'+'2'.repeat(64)};
const failureEvent={type:'error',error:'page.goto: net::ERR_ABORTED at https://example.com/',failingPhase:'Self-test public navigation',completedChecks:{controlOriginGuard:true,initialNavigation:{status:200},note:'token '+token},probes:[{url:'http://127.0.0.1/',blocked:true,status:403},{url:'http://[::1]/',blocked:false,error:'page.goto: Target crashed'}],resources:{cgroup:'v2',pids:{current:128,max:128,events:{max:37}},memory:{currentMB:510,events:{oom:0}},shm:{totalMB:64,freeMB:60}},startupDiagnostics:'Zygote could not fork'};
function harness(event){
 let net=false;const calls=[];
 const dockerCommand=async args=>{calls.push(args);if(args[0]==='network'&&args[1]==='create')net=true;if(args[0]==='network'&&args[1]==='rm')net=false;if(args[0]==='network'&&args[1]==='inspect')return net?{ok:true,ms:1,stdout:'[{"Internal":true}]',stderr:''}:{ok:false,ms:1,stdout:'',stderr:'Error: No such network'};if(args[0]==='image')return {ok:true,ms:1,stdout:JSON.stringify([{Id:args[2]===BROWSER_IMAGE?cap.imageId:cap.proxyId,Config:{User:'1000:1000',Entrypoint:['node',args[2]===BROWSER_IMAGE?'worker.mjs':'proxy.mjs'],Labels:args[2]===BROWSER_IMAGE?{'org.skydata.stagehand.version':'4.2.1','org.skydata.browser.adapter':'2'}:{'org.skydata.proxy.adapter':'2'}}}]),stderr:''};return {ok:true,ms:1,stdout:'',stderr:''};};
 const spawnProcess=()=>{const c=new EventEmitter();c.stdout=new EventEmitter();c.stderr=new EventEmitter();c.stdin=new EventEmitter();c.kill=()=>{};c.stdin.end=()=>setTimeout(()=>{c.stdout.emit('data',Buffer.from(JSON.stringify(event)+'\n'));c.emit('close',1);},2);return c;};
 return {calls,dockerCommand,spawnProcess,removeContainer:async()=>({phase:'cleanup',ok:true,ms:1})};
}
// 1. Limits: browser 512 tasks, proxy unchanged at 64; all other isolation flags unchanged.
const h=harness(failureEvent);const r=await executeBrowser(job,bundle,cap,{dockerCommand:h.dockerCommand,removeContainer:h.removeContainer,spawnProcess:h.spawnProcess});
const creates=h.calls.filter(a=>a[0]==='create'),pids=a=>a[a.indexOf('--pids-limit')+1];
const browserArgs=creates.find(a=>a.includes(cap.imageId)),proxyArgs=creates.find(a=>a.includes(cap.proxyId));
assert.equal(BROWSER_PIDS,512);assert.equal(pids(browserArgs),'512');assert.equal(pids(proxyArgs),'64');
for(const [flag,value] of [['--memory','1g'],['--memory-swap','1g'],['--cpus','1'],['--user','1000:1000'],['--cap-drop','ALL'],['--security-opt','no-new-privileges'],['--tmpfs','/tmp:rw,noexec,nosuid,nodev,size=256m'],['--pull','never']])assert.equal(browserArgs[browserArgs.indexOf(flag)+1],value,flag);
assert.ok(browserArgs.includes('--read-only'));assert.ok(!browserArgs.some(a=>/^(--privileged|-v|--volume|--mount|--cap-add|--network=host)$/.test(a)));assert.ok(!browserArgs.includes('host'));
// 2. Failure context is kept (bounded, tokens redacted) and evidence is still withheld from a failed run.
assert.equal(r.status,'failed');assert.equal(r.evidence,null);assert.equal(r.failure.failingPhase,'Self-test public navigation');
assert.equal(r.failure.completedChecks.controlOriginGuard,true);assert.equal(r.failure.resources.pids.events.max,37);assert.ok(!JSON.stringify(r.failure).includes(token),'token redacted');
const big=boundedFailure({failingPhase:'x'.repeat(500),completedChecks:{blob:'y'.repeat(20000)},probes:new Array(50).fill({url:'u'}),resources:null});
assert.equal(big.failingPhase.length,80);assert.equal(big.completedChecks.truncated,true);assert.equal(big.probes.length,8);
// 3. Live job: the website receives the same result fields as before (no failure context), the window prints a summary.
const sent=[];const logs=[];const log=console.log;console.log=(...x)=>logs.push(x.join(' '));
try{await hpBrowserJob(job,{question:async()=>'yes'},'paired',{apiCall:async(path,b)=>{if(path==='browser-result')sent.push(b);return {accepted:true};},checkImages:async()=>cap,executeJob:async()=>r});}finally{console.log=log;}
assert.equal(sent.length,1);assert.equal('failure' in sent[0].result,false);assert.ok(logs.some(l=>/Stopped at: Self-test public navigation · browser tasks 128\/128 · task limit hits 37/.test(l)));
// 4. Self-test report keeps the failing phase, completed checks, probes and resources; guard is "not reached" only if never run.
const cwd=process.cwd();process.chdir(dir);
const rep=async event=>{const k=harness(event);await browserSelftest({dockerCommand:k.dockerCommand,removeContainer:k.removeContainer,cleanEnv:()=>({}),spawnProcess:k.spawnProcess}).catch(e=>{if(!/Browser self-test failed/.test(e.message))throw e;});return JSON.parse(await readFile(join(dir,'browser-selftest-report.txt'),'utf8'));};
try{
 const a=await rep(failureEvent);assert.equal(a.passed,false);assert.equal(a.failingPhase,'Self-test public navigation');assert.equal(a.controlOriginGuard,true,'guard passed before the later navigation failed');assert.equal(a.probes.length,2);assert.equal(a.probes[1].blocked,false,'a crashed probe is not counted as blocked');assert.equal(a.resources.pids.events.max,37);assert.equal(a.configuredBrowserPidsLimit,512);
 const b=await rep({type:'error',error:'Stagehand initialization timed out',failingPhase:'Launching browser',completedChecks:{},probes:[],resources:null});assert.equal(b.controlOriginGuard,'not_reached');
}finally{process.chdir(cwd);}
console.log('PASS HP browser v2.4.3 diagnostics (Docker CLI and worker mocked): browser pids 512 / proxy 64 with other isolation flags unchanged, failure phase + completed checks + probes + resources retained and redacted, evidence still withheld on failure, website result fields unchanged, self-test report distinguishes guard passed / not reached, crashed probe not counted as blocked.');
