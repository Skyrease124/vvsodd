import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {createHash} from 'node:crypto';
import {REA_PREFIX,REA_LIMITS,parseReaJob,validReaBundle,reaContainerArgs,checkReaImage,executeRea,safeReaPath} from '../runner-package/rea-job.mjs';
import {validJob,reaJob} from '../runner-package/runner.mjs';
// MOCKED docker CLI: REA job contract on the runner side. Real REA is exercised in test-rea-real.mjs.
const sha=t=>createHash('sha256').update(t).digest('hex');
const file=(path,text='export const a=1;\n')=>({path,text,sha256:sha(text)});
const bundle={name:'p.zip',operation:'analyze-javascript-application',files:[file('src/a.js'),file('src/b.mjs')]};
const job=(b=bundle,extra={})=>({id:crypto.randomUUID(),code:REA_PREFIX+JSON.stringify(b),expires:Date.now()+60000,...extra});
// Payload validation and separation from test jobs.
assert.ok(parseReaJob(job()));assert.equal(validJob(job()),false,'REA payloads are never JavaScript test jobs');
for(const bad of [{...bundle,operation:'run-shell'},{...bundle,files:[file('../x.js')]},{...bundle,files:[file('/abs.js')]},{...bundle,files:[file('a\\b.js')]},{...bundle,files:[file('C:/x.js')]},{...bundle,files:[file('a.js'),file('A.js')]},{...bundle,files:[{...file('a.js'),sha256:'0'.repeat(64)}]},{...bundle,files:[file('big.js','x'.repeat(REA_LIMITS.fileBytes+1))]},{...bundle,files:[]}])assert.equal(validReaBundle(bad),false,JSON.stringify(bad).slice(0,80));
assert.equal(parseReaJob(job(bundle,{expires:Date.now()-1})),null);assert.equal(parseReaJob({...job(),code:REA_PREFIX+'{bad'}),null);assert.equal(parseReaJob({...job(),code:'console.log(1)'}),null);
for(const p of ['a/../b.js','a//b.js','./a.js','a.js/'])assert.equal(safeReaPath(p),false,p);
// Fixed, isolated container arguments: no command, mounts, env, privileges or network.
const args=reaContainerArgs('n','sha256:'+'a'.repeat(64));
assert.equal(args[0],'create');assert.equal(args.at(-1),'sha256:'+'a'.repeat(64),'image is the last argument: no command override');
for(const [flag,value] of [['--network','none'],['--user','1000:1000'],['--cap-drop','ALL'],['--pull','never'],['--security-opt','no-new-privileges'],['--pids-limit','64'],['--memory','1024m'],['--memory-swap','1024m']])assert.equal(args[args.indexOf(flag)+1],value,flag);
assert.ok(args.includes('--read-only')&&args.includes('--rm'));assert.ok(!args.some(a=>/^(-v|--volume|--mount|--privileged|-e|--env|--env-file|--cap-add|--entrypoint)$/.test(a)));
// Image verification: missing, incompatible versions and a good image.
const inspect=(labels,{user='1000:1000',entry=['node','/opt/rea/adapter.mjs'],ok=true}={})=>async a=>a[0]==='image'?(ok?{ok:true,ms:3,stdout:JSON.stringify([{Id:'sha256:'+'b'.repeat(64),Config:{User:user,Entrypoint:entry,Labels:labels}}]),stderr:'',code:0}:{ok:false,ms:3,stdout:'',stderr:'Error: No such image: skydata-rea:6.5.0-a1',code:1}):{ok:true,ms:1,stdout:'',stderr:'',code:0};
const good={'org.skydata.rea.version':'6.5.0','org.skydata.adapter.version':'1'};
assert.equal((await checkReaImage(inspect(good))).available,true);
const missing=await checkReaImage(inspect(good,{ok:false}));assert.equal(missing.available,false);assert.match(missing.detail,/not prepared.*Prepare_REA/);
const old=await checkReaImage(inspect({...good,'org.skydata.rea.version':'6.3.0'}));assert.equal(old.available,false);assert.match(old.detail,/REA 6\.3\.0 \(needs 6\.5\.0\)/);
assert.equal((await checkReaImage(inspect({...good,'org.skydata.adapter.version':'2'}))).available,false);
assert.match((await checkReaImage(inspect(good,{user:'0:0'}))).detail,/user/);assert.match((await checkReaImage(inspect(good,{entry:['sh']}))).detail,/entrypoint/);
// Execution contract with a fake docker start.
function fakeStart({reply,hang=false,big=false}={}){return (cmd,a,o)=>{assert.equal(cmd,'docker');assert.deepEqual(a.slice(0,3),['start','-a','-i']);assert.equal(o.shell,false);const c=new EventEmitter();c.stdout=new PassThrough();c.stderr=new PassThrough();c.stdin=new PassThrough();let input='';c.stdin.on('data',d=>input+=d);
 c.stdin.on('finish',()=>{const req=JSON.parse(input);assert.equal(req.operation,'analyze-javascript-application');assert.equal(req.protocol,'skydata-rea-v1');assert.deepEqual(req.files.map(f=>f.path),bundle.files.map(f=>f.path));if(hang)return;setImmediate(()=>{c.stdout.write(big?'x'.repeat(500):JSON.stringify(reply));c.emit('close',0);});});c.kill=()=>{setImmediate(()=>c.emit('close',null));return true;};return c;};}
const docker=({rm=true,gone=true,kill='ok'}={})=>async a=>{if(a[0]==='create')return {ok:true,ms:2,stdout:'id',stderr:'',code:0};if(a[0]==='kill')return kill==='hang'?new Promise(()=>{}):{ok:true,ms:2,stdout:'',stderr:'',code:0};if(a[0]==='rm')return rm?{ok:true,ms:2,stdout:'',stderr:'',code:0}:{ok:false,ms:30000,stdout:'',stderr:'',timedOut:true,code:'ETIMEDOUT'};if(a[0]==='container')return gone?{ok:false,ms:1,stdout:'',stderr:'Error: No such container',code:1}:{ok:true,ms:1,stdout:'running',stderr:'',code:0};return {ok:true,ms:1,stdout:'',stderr:'',code:0};};
const {cleanup}=await import('../runner-package/runner.mjs');const remove=(name,o)=>cleanup(name,{...o,wait:async()=>{}});
const reply={adapter:'1',status:'partial',rea:{version:'6.5.0'},staged:bundle.files.map(f=>({path:f.path,sha256:f.sha256,bytes:17})),workspaceUnchanged:true,findings:{imports:{items:[],total:0}},phases:[]};
const ok=await executeRea(bundle,'sha256:x',{dockerCommand:docker(),removeContainer:remove,spawnProcess:fakeStart({reply})});assert.equal(ok.status,'partial');assert.equal(ok.diagnostics.cleanupConfirmed,true);assert.equal(ok.adapter.rea.version,'6.5.0');
const fast={...REA_LIMITS,deadlineMs:30,cleanupMs:200,graceMs:30};let t=Date.now();
const slow=await executeRea(bundle,'sha256:x',{dockerCommand:docker({kill:'hang'}),removeContainer:remove,spawnProcess:fakeStart({hang:true}),limits:fast});
assert.equal(slow.status,'timeout');assert.ok(Date.now()-t<3000,'bounded even with a hung docker kill');const term=slow.diagnostics.phases.find(p=>p.phase==='termination');assert.equal(term.ok,false);assert.match(term.detail,/NOT confirmed/);
const big=await executeRea(bundle,'sha256:x',{dockerCommand:docker(),removeContainer:remove,spawnProcess:fakeStart({big:true}),limits:{...REA_LIMITS,resultBytes:100,graceMs:30}});assert.equal(big.status,'output_limit');assert.equal(big.adapter,null,'truncated output is never parsed as findings');
const stuck=await executeRea(bundle,'sha256:x',{dockerCommand:docker({rm:false,gone:false}),removeContainer:remove,spawnProcess:fakeStart({reply})});assert.equal(stuck.status,'infrastructure_error','unconfirmed cleanup is never reported as a completed analysis');assert.equal(stuck.diagnostics.cleanupConfirmed,false);assert.equal(stuck.diagnostics.executionStatus,'partial');
const garbage=await executeRea(bundle,'sha256:x',{dockerCommand:docker(),removeContainer:remove,spawnProcess:fakeStart({reply:'not json'})});assert.equal(garbage.status,'infrastructure_error');
// Interactive HP flow (runner.mjs reaJob) with a scripted answer; the docker CLI here is the real one only for image inspection,
// so this part runs only where no REA image is installed and reports `unavailable` without asking.
const posted=[];const rl={question:async()=>'no'};
const declined=await reaJob(job(),rl,'t'.repeat(64),{apiCall:async(path,body)=>{posted.push([path,body]);return {};}});
assert.ok(declined);const last=posted.find(p=>p[0]==='rea-result');assert.ok(['declined','unavailable'].includes(last[1].result.status),last[1].result.status);
console.log('PASS REA job contract (docker CLI mocked): payload validation (operation, traversal, absolute/drive/backslash paths, case duplicates, SHA-256, size), REA payloads never accepted as test jobs, fixed isolated container arguments with no command override, image checks for missing/incompatible REA or adapter versions, user and entrypoint, success, timeout with hung kill, output limit, unconfirmed cleanup, malformed adapter output, HP decline path ('+last[1].result.status+').');
