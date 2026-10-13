// Docker CLI, browser worker and REA runner MOCKED: the website-investigation REA step uses the full REA limits and a bounded input.
import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';import {createHash} from 'node:crypto';
import {BROWSER_PREFIX,REA_BROWSER_BYTES,executeBrowser} from '../runner-package/browser-job.mjs';
import {REA_LIMITS,REA_IMAGE} from '../runner-package/rea-job.mjs';
const sha=t=>createHash('sha256').update(t).digest('hex');
const id='10000000-0000-4000-8000-000000000002',bundle={url:'https://example.com/',goal:'Inspect scripts',engine:'rea',relayToken:'b'.repeat(64)},job={id,expires:Date.now()+600000,code:BROWSER_PREFIX+JSON.stringify(bundle)};
const script=(i,kb)=>{const text='/*'+i+'*/'+'x'.repeat(kb*1024);return {path:'public/script-'+i+'.js',url:'https://example.com/s'+i+'.js',sha256:sha(text),text};};
const reaImage=JSON.stringify([{Id:'sha256:'+'c'.repeat(64),Config:{Labels:{'org.skydata.rea.version':'6.4.0','org.skydata.adapter.version':'1'},User:'1000:1000',Entrypoint:['node','/opt/rea/adapter.mjs']}}]);
async function run(scripts,reaStatus){
 let networkExists=false;const sent={};
 const docker=async args=>{if(args[0]==='image'&&args[2]===REA_IMAGE)return {ok:true,ms:1,stdout:reaImage,stderr:''};if(args[0]==='network'&&args[1]==='create')networkExists=true;if(args[0]==='network'&&args[1]==='rm')networkExists=false;if(args[0]==='network'&&args[1]==='inspect')return networkExists?{ok:true,ms:1,stdout:'[{"Internal":true}]',stderr:''}:{ok:false,ms:1,stderr:'network not found'};return {ok:true,ms:1,stdout:'',stderr:''};};
 const spawnProcess=()=>{const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.stdin=new EventEmitter();child.kill=()=>{};child.stdin.end=()=>setTimeout(()=>{child.stdout.emit('data',Buffer.from(JSON.stringify({type:'result',stagehandVersion:'4.2.1',browserExecuted:true,pages:[{id:'page-0'}],scripts,screenshots:[],limitations:['base']})+'\n'));child.emit('close',0);},1);return child;};
 const reaRunner=async(request,imageId,options)=>{sent.files=request.files;sent.limits=options.limits;sent.imageId=imageId;
  return {status:reaStatus,diagnostics:{cleanupConfirmed:true},adapter:{rea:{version:'6.4.0',operation:'analyze-javascript-application'},workspaceUnchanged:true,staged:request.files.map(f=>({path:f.path,sha256:f.sha256})),findings:{graphCoverage:{status:'partial'}}}};};
 const result=await executeBrowser(job,bundle,{available:true,imageId:'sha256:'+'d'.repeat(64),proxyId:'sha256:'+'e'.repeat(64)},{dockerCommand:docker,removeContainer:async()=>({phase:'cleanup',ok:true,ms:1}),spawnProcess,cleanEnv:()=>({}),reaRunner,limits:{deadlineMs:2000,createMs:20,cleanupMs:10,graceMs:2,resultBytes:8000000}});
 return {result,sent};
}
// Over the cap: 200 KB + 200 KB + 100 KB -> the second script does not fit and is left out.
{const {result,sent}=await run([script(0,200),script(1,200),script(2,100)],'partial');
 assert.equal(sent.limits,REA_LIMITS);assert.equal(sent.limits.deadlineMs,180000);
 assert.deepEqual(sent.files.map(f=>f.path),['public/script-0.js','public/script-2.js']);assert.ok(sent.files.reduce((n,f)=>n+Buffer.byteLength(f.text),0)<=REA_BROWSER_BYTES);
 assert.equal(result.status,'complete');assert.deepEqual(result.evidence.scripts.map(s=>s.path),['public/script-0.js','public/script-2.js']);
 assert.deepEqual(result.evidence.rea.staged.map(s=>s.path).sort(),result.evidence.scripts.map(s=>s.path).sort());assert.ok(result.evidence.scripts.every(s=>!('text' in s)));
 assert.ok(result.evidence.limitations.some(l=>l.startsWith('REA analysed 2 of 3 captured scripts')));}
// Under the cap: everything is sent and no limitation is added.
{const {result,sent}=await run([script(0,100),script(1,100)],'complete');assert.equal(sent.files.length,2);assert.equal(result.status,'complete');assert.deepEqual(result.evidence.limitations,['base']);}
// A REA timeout is reported as a timeout, not as an integrity failure.
{const {result}=await run([script(0,100)],'timeout');assert.equal(result.status,'timeout');assert.equal(result.evidence,null);assert.match(result.error,/did not finish within the 180-second REA limit/);}
console.log('PASS HP browser REA step (Docker CLI, worker and REA MOCKED): full 180 s REA limits, 384 KB input cap with matching evidence scripts and a stated limitation, honest timeout message.');
