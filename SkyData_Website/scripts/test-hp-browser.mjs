import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {SITE} from '../runner-package/site.mjs';
import {BROWSER_PREFIX,BROWSER_IMAGE,PROXY_IMAGE,parseBrowserJob,checkBrowserImages,executeBrowser,activeBrowserResources} from '../runner-package/browser-job.mjs';
import {validJob,hpBrowserJob} from '../runner-package/runner.mjs';
const imageId='sha256:'+'1'.repeat(64),proxyId='sha256:'+'2'.repeat(64);
const id='10000000-0000-4000-8000-000000000001',bundle={url:'https://example.com/',goal:'Inspect public navigation',engine:'superpowers',relayToken:'a'.repeat(64)},job={id,expires:Date.now()+600000,code:BROWSER_PREFIX+JSON.stringify(bundle)};
assert.deepEqual(parseBrowserJob(job),bundle);assert.equal(validJob(job),false,'browser payload is never a JavaScript test');
for(const changed of [{url:'http://127.0.0.1'},{url:'http://2130706433'},{url:'https://u:p@example.com'},{engine:'unknown'},{command:'rm -rf /'},{relayToken:'bad'}])assert.equal(parseBrowserJob({...job,code:BROWSER_PREFIX+JSON.stringify({...bundle,...changed})}),null);
const meta=(id,name)=>({Id:id,Config:{User:'1000:1000',Entrypoint:['node',name===BROWSER_IMAGE?'worker.mjs':'proxy.mjs'],Labels:name===BROWSER_IMAGE?{'org.skydata.stagehand.version':'4.2.1','org.skydata.browser.adapter':'2','org.skydata.stagehand.init-timeout':'150'}:{'org.skydata.proxy.adapter':'2','org.skydata.proxy.site':'env'}}});
const inspect=async args=>({ok:true,ms:1,stdout:JSON.stringify([meta(args[2]===BROWSER_IMAGE?imageId:proxyId,args[2])]),stderr:''});
const fresh=JSON.stringify({passed:true,imageId,proxyId,at:Date.now()});
const cap=await checkBrowserImages(inspect,{readStamp:async()=>fresh});assert.equal(cap.available,true);assert.equal((await checkBrowserImages(inspect,{readStamp:async()=>JSON.stringify({passed:true,imageId:'wrong',proxyId,at:Date.now()})})).available,false);
assert.equal((await checkBrowserImages(async()=>({ok:false,stderr:'not found'}))).available,false);
async function runCase({reason,clean=true,engine='superpowers',cancel=false,overflow=false,startupFailure=false}={}){
 let networkExists=false;const calls=[],phases=[];
 const docker=async args=>{calls.push(args);if(args[0]==='network'&&args[1]==='create')networkExists=true;if(args[0]==='network'&&args[1]==='rm')networkExists=false;if(args[0]==='network'&&args[1]==='inspect')return networkExists?{ok:true,ms:1,stdout:'[{"Internal":true}]',stderr:''}:{ok:false,ms:1,stderr:'network not found'};return {ok:true,ms:1,stdout:'',stderr:''};};
 const controller=new AbortController();
 const spawnProcess=(_bin,args,options)=>{assert.equal(options.shell,false);const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.stdin=new EventEmitter();child.kill=()=>{};child.stdin.end=text=>{
  const input=JSON.parse(text);assert.equal(input.url,bundle.url);assert.equal(input.relayToken,bundle.relayToken);assert.equal(input.command,undefined);
  if(cancel){setTimeout(()=>controller.abort(),2);return;}
  if(reason)return;
  setTimeout(()=>{if(startupFailure){child.stdout.emit('data',Buffer.from(JSON.stringify({type:'error',error:'Chrome exited with signal SIGTRAP',startupDiagnostics:'Crashpad cannot write '+bundle.relayToken})+'\n'));child.emit('close',1);return;}child.stdout.emit('data',Buffer.from(JSON.stringify({type:'phase',phase:'Inspecting interface'})+'\n'));child.stdout.emit('data',Buffer.from(overflow?'x'.repeat(10000):JSON.stringify({type:'result',stagehandVersion:'4.2.1',browserExecuted:true,pages:[{id:'page-0'}],scripts:[],screenshots:[]})+'\n'));if(!overflow)child.emit('close',0);},1);
 };return child;};
 const result=await executeBrowser(job,{...bundle,engine},cap,{dockerCommand:docker,removeContainer:async()=>({phase:'cleanup',ok:clean,ms:1}),spawnProcess,cleanEnv:()=>({}),report:p=>phases.push(p),signal:controller.signal,limits:{deadlineMs:15,createMs:20,cleanupMs:10,graceMs:2,resultBytes:1000}});
 const creates=calls.filter(a=>a[0]==='create');assert.equal(creates.length,2);assert.ok(creates.some(c=>c.includes('SKYDATA_SITE='+SITE)),'the egress proxy is told which site to relay model calls to');for(const args of creates){assert.ok(args.includes('--read-only'));assert.ok(args.includes('no-new-privileges'));assert.ok(args.includes('--pull'));assert.ok(args.includes('never'));assert.ok(args.includes('--cap-drop'));assert.ok(!args.includes('--privileged'));assert.ok(!args.includes('-v'));assert.ok(args.includes('--memory-swap'));}
 assert.ok(calls.some(a=>a[0]==='network'&&a[1]==='create'&&a.includes('--internal')));assert.ok(calls.some(a=>a[0]==='network'&&a[1]==='connect'&&a[2]==='bridge'&&a[3].startsWith('skydata-browser-egress-')));assert.ok(!calls.some(a=>a[0]==='network'&&a[1]==='connect'&&a[3]?.startsWith('skydata-browser-')&&!a[3].startsWith('skydata-browser-egress-')));
 if(clean)assert.equal(activeBrowserResources.size,0);else activeBrowserResources.clear();return result;
}
assert.equal((await runCase()).status,'complete');assert.equal((await runCase({reason:'timeout'})).status,'timeout');assert.equal((await runCase({cancel:true})).status,'cancelled');assert.equal((await runCase({overflow:true})).status,'output_limit');assert.equal((await runCase({clean:false})).status,'infrastructure_error');
const startupFailure=await runCase({startupFailure:true});assert.equal(startupFailure.status,'failed');assert.equal(startupFailure.cleanupConfirmed,true);assert.match(startupFailure.startupDiagnostics,/Crashpad cannot write \[redacted\]/);assert.ok(!startupFailure.startupDiagnostics.includes(bundle.relayToken));
const calls=[];await hpBrowserJob(job,{question:async()=> 'no'},'paired-token',{apiCall:async(path,b)=>{calls.push({path,b});return {accepted:true,status:'declined'};},checkImages:async()=>cap,executeJob:async()=>{throw Error('Must not run after decline');}});assert.equal(calls.at(-1).path,'browser-result');assert.equal(calls.at(-1).b.result.status,'declined');
console.log('PASS HP browser contract (Docker CLI mocked): payload separation, public URL policy, self-test/image binding, internal network, fixed isolated args, success, timeout, cancellation, output cap, failed cleanup and local decline. No real Chrome/Docker verification.');
