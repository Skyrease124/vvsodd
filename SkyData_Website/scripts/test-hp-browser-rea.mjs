// Docker CLI, browser worker and REA runner MOCKED: the website-investigation REA step uses the full REA limits and a bounded input.
import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';import {createHash} from 'node:crypto';
import {BROWSER_PREFIX,REA_BROWSER_BYTES,executeBrowser} from '../runner-package/browser-job.mjs';
import {REA_LIMITS,REA_IMAGE,executeRea} from '../runner-package/rea-job.mjs';
const sha=t=>createHash('sha256').update(t).digest('hex');
const id='10000000-0000-4000-8000-000000000002',bundle={url:'https://example.com/',goal:'Inspect scripts',engine:'rea',relayToken:'b'.repeat(64)},job={id,expires:Date.now()+600000,code:BROWSER_PREFIX+JSON.stringify(bundle)};
const script=(i,kb)=>{const text='/*'+i+'*/'+'x'.repeat(kb*1024);return {path:'public/script-'+i+'.js',url:'https://example.com/s'+i+'.js',sha256:sha(text),text};};
const reaImage=JSON.stringify([{Id:'sha256:'+'c'.repeat(64),Config:{Labels:{'org.skydata.rea.version':'6.4.0','org.skydata.adapter.version':'1'},User:'1000:1000',Entrypoint:['node','/opt/rea/adapter.mjs']}}]);
async function run(scripts,reaStatus,{chunk=0}={}){
 let networkExists=false;const sent={};
 const docker=async args=>{if(args[0]==='image'&&args[2]===REA_IMAGE)return {ok:true,ms:1,stdout:reaImage,stderr:''};if(args[0]==='network'&&args[1]==='create')networkExists=true;if(args[0]==='network'&&args[1]==='rm')networkExists=false;if(args[0]==='network'&&args[1]==='inspect')return networkExists?{ok:true,ms:1,stdout:'[{"Internal":true}]',stderr:''}:{ok:false,ms:1,stderr:'network not found'};return {ok:true,ms:1,stdout:'',stderr:''};};
 const spawnProcess=()=>{const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.stdin=new EventEmitter();child.kill=()=>{};child.stdin.end=()=>setTimeout(()=>{const out=Buffer.from(JSON.stringify({type:'result',stagehandVersion:'4.2.1',browserExecuted:true,pages:[{id:'page-0'}],scripts,screenshots:[],limitations:['base']})+'\n');if(chunk)for(let i=0;i<out.length;i+=chunk)child.stdout.emit('data',out.subarray(i,i+chunk));else child.stdout.emit('data',out);child.emit('close',0);},1);return child;};
 const reaRunner=async(request,imageId,options)=>{sent.files=request.files;sent.limits=options.limits;sent.imageId=imageId;
  // Like the real adapter: refuse files whose text no longer matches the approved SHA-256.
  const bad=request.files.find(f=>sha(f.text)!==f.sha256);if(bad)return {status:'rejected',diagnostics:{cleanupConfirmed:true},adapter:{status:'rejected',error:bad.path+' does not match its approved SHA-256 fingerprint.'}};
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
// Non-ASCII script text split into 7-byte chunks (multi-byte characters cut in half) still reaches REA unchanged.
{const text=Array.from({length:400},(_,i)=>'var s'+i+'="سینما جوائے 🎬 '+i+'";').join('');const s={path:'public/script-0.js',url:'https://example.com/u.js',sha256:sha(text),text};
 const {result,sent}=await run([s],'partial',{chunk:7});assert.equal(sent.files[0].text,text);assert.equal(result.status,'complete');}
// A failed REA check is named in the error.
{const {result}=await run([script(0,10)],'rejected');assert.equal(result.status,'failed');assert.match(result.error,/integrity checks \(REA status rejected/);}
{const s=script(0,10);s.text+='x';const {result}=await run([s],'partial');assert.match(result.error,/integrity checks \(REA status rejected: public\/script-0.js does not match its approved SHA-256 fingerprint\.\)/);}
// REA adapter output split mid-character is decoded intact.
{const adapterOut=Buffer.from(JSON.stringify({adapter:'1',status:'partial',note:'سینما 🎬'}));
 const spawnProcess=()=>{const c=new EventEmitter();c.stdout=new EventEmitter();c.stderr=new EventEmitter();c.stdin=new EventEmitter();c.kill=()=>{};c.stdin.end=()=>setTimeout(()=>{for(let i=0;i<adapterOut.length;i+=5)c.stdout.emit('data',adapterOut.subarray(i,i+5));c.emit('close',0);},1);return c;};
 const r=await executeRea({name:'x',operation:'analyze-javascript-application',files:[]},'sha256:'+'c'.repeat(64),{dockerCommand:async()=>({ok:true,ms:1,stdout:'',stderr:''}),removeContainer:async()=>({phase:'cleanup',ok:true,ms:1}),spawnProcess,limits:{...REA_LIMITS,deadlineMs:2000}});
 assert.equal(r.adapter.note,'سینما 🎬');}
console.log('PASS HP browser REA step (Docker CLI, worker and REA MOCKED): full 180 s REA limits, 384 KB input cap with matching evidence scripts and a stated limitation, honest timeout message, UTF-8 split across output chunks kept intact (browser and REA output), failed REA check named.');
