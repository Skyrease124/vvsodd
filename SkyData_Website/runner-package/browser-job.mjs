import {spawn} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {StringDecoder} from 'node:string_decoder';
import {executeRea,checkReaImage,REA_LIMITS} from './rea-job.mjs';
export const BROWSER_PREFIX='SKYDATA_BROWSER_V1\n',BROWSER_VERSION='4.2.1',BROWSER_ADAPTER='2';
export const BROWSER_IMAGE='skydata-stagehand:4.2.1-a2',PROXY_IMAGE='skydata-browser-proxy:a2';
const stampPath=join(homedir(),'.skydata-runner','browser-check.json');
export const REA_BROWSER_BYTES=384*1024;
// Measured on Linux Docker with 348 KB of real minified JS: REA peaked at 710 MB RSS plus 33 MB of tmpfs (counted in the same limit), 97% of the
// 768 MB ZIP-REA limit. Website investigations use 1 GB (the HP already runs the 1 GB browser container, which is removed before REA starts).
export const REA_BROWSER_MEMORY='1024m';
export const BROWSER_LIMITS={deadlineMs:180000,createMs:60000,cleanupMs:30000,graceMs:1000,resultBytes:7500000};
export const activeBrowserResources=new Set();
// Tasks (processes + threads) for the browser container. Measured with Chromium 155 + Stagehand 4.2.1 on Linux Docker:
// the self-test peaks at ~200-210 tasks and fails at 128 (pids.events > 0, pthread_create/fork EAGAIN). 512 keeps a hard cap
// with headroom for extra site-isolated renderers on real pages; memory stays capped at 1 GB.
export const BROWSER_PIDS=512;
const sha=text=>createHash('sha256').update(text).digest('hex');
export function parseBrowserJob(job){
 try{
  if(!job||!/^[a-f0-9-]{36}$/.test(job.id)||!Number.isFinite(job.expires)||job.expires<=Date.now()||typeof job.code!=='string'||!job.code.startsWith(BROWSER_PREFIX)||Buffer.byteLength(job.code)>12000)return null;
  const b=JSON.parse(job.code.slice(BROWSER_PREFIX.length));if(typeof b.url!=='string'||b.url.length>2048)return null;const u=new URL(b.url),h=u.hostname;
  if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.port&&!['80','443'].includes(u.port)||!h.includes('.')||/^\[|^[\d.]+$/.test(h)||/(^|\.)(localhost|local|internal|test|invalid|onion)$/.test(h)||!['rea','superpowers'].includes(b.engine)||typeof b.goal!=='string'||!b.goal.trim()||b.goal.length>8000||!/^[a-f0-9]{64}$/.test(b.relayToken||'')||Object.keys(b).some(k=>!['url','goal','engine','relayToken'].includes(k)))return null;
  return b;
 }catch{return null;}
}
async function inspected(dockerCommand,name,labels,entrypoint){
 const r=await dockerCommand(['image','inspect',name],60000);if(!r.ok)throw Error('Image '+name+' is not prepared. Run Prepare_Browser.cmd.');
 const i=JSON.parse(r.stdout)[0];if(!/^sha256:[a-f0-9]{64}$/.test(i?.Id||'')||i.Config?.User!=='1000:1000'||JSON.stringify(i.Config?.Entrypoint)!==JSON.stringify(entrypoint)||Object.entries(labels).some(([k,v])=>i.Config?.Labels?.[k]!==v))throw Error('Image '+name+' has incompatible labels, user or entrypoint.');return i.Id;
}
export async function checkBrowserImages(dockerCommand,{readStamp=()=>readFile(stampPath,'utf8'),ignoreStamp=false}={}){
 try{
  const imageId=await inspected(dockerCommand,BROWSER_IMAGE,{'org.skydata.stagehand.version':BROWSER_VERSION,'org.skydata.browser.adapter':BROWSER_ADAPTER},['node','worker.mjs']);
  const proxyId=await inspected(dockerCommand,PROXY_IMAGE,{'org.skydata.proxy.adapter':BROWSER_ADAPTER},['node','proxy.mjs']);
  let stamp=null;try{stamp=JSON.parse(await readStamp());}catch{}
  const passed=stamp?.passed===true&&stamp.imageId===imageId&&stamp.proxyId===proxyId&&stamp.at>Date.now()-7*86400000;
  return {available:ignoreStamp||passed,stagehandVersion:BROWSER_VERSION,adapterVersion:BROWSER_ADAPTER,imageId,proxyId,selfTestPassed:passed,checkedAt:Date.now(),detail:passed?'Stagehand 4.2.1 browser image and public-network self-test verified on this HP.':'Browser images found. Run Browser_Self_Test.cmd (again after image updates or seven days).'};
 }catch(e){return {available:false,stagehandVersion:BROWSER_VERSION,adapterVersion:BROWSER_ADAPTER,selfTestPassed:false,checkedAt:Date.now(),detail:e.message};}
}
const createArgs=(name,image,network,proxy=false)=>['create','--name',name,'--pull','never','--network',network,'--memory',proxy?'256m':'1g','--memory-swap',proxy?'256m':'1g','--cpus','1','--pids-limit',proxy?'64':String(BROWSER_PIDS),'--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--user','1000:1000','--tmpfs','/tmp:rw,noexec,nosuid,nodev,size=256m','--log-driver','none',...(proxy?['--network-alias','egress']:['-i','-e','NO_PROXY=127.0.0.1,localhost']),image];
const phaseMap={'Launching browser':'browser_launching','Connecting to website':'browser_connecting','Inspecting interface':'browser_inspecting','Examining functionality':'browser_functionality','Collecting evidence':'browser_collecting','Analyzing technologies':'browser_technologies'};
// Keeps the worker's failure context (phase, completed checks, probes, resource snapshot) within a fixed size; tokens redacted.
export function boundedFailure(e){
 const pick=value=>{try{const text=JSON.stringify(value??null).replace(/[a-f0-9]{64}/gi,'[redacted]');return text.length>6000?{truncated:true,preview:text.slice(0,6000)}:JSON.parse(text);}catch{return null;}};
 return {failingPhase:typeof e.failingPhase==='string'?e.failingPhase.slice(0,80):null,completedChecks:pick(e.completedChecks),probes:Array.isArray(e.probes)?pick(e.probes.slice(0,8)):[],resources:pick(e.resources)};
}
// Bounded docker attach, enforcing stop independently of a hung docker CLI and confirming cleanup afterwards.
export async function attachBrowser(name,input,{dockerCommand,spawnProcess=spawn,cleanEnv=()=>({}),report=()=>{},signal,limits=BROWSER_LIMITS}){
 return new Promise(resolve=>{
  let child,ended=false,stdout='',pending='',bytes=0,result=null,errorMessage='',startupDiagnostics='',failure=null,reason='',termination=null;const started=Date.now();
  const finish=(code,error)=>{if(ended)return;ended=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);resolve({result,errorMessage,startupDiagnostics,failure,reason,code,error,termination,ms:Date.now()-started});};
  const stop=why=>{if(reason)return;reason=why;try{child?.kill();}catch{}
   termination=Promise.race([Promise.resolve().then(()=>dockerCommand(['kill',name],limits.cleanupMs)).catch(()=>({ok:false})),new Promise(r=>setTimeout(()=>r({ok:false}),limits.cleanupMs+1000))]);
   setTimeout(()=>finish(null,true),limits.graceMs);
  };
  const cancel=()=>stop('cancelled');const timer=setTimeout(()=>stop('timeout'),limits.deadlineMs);signal?.addEventListener('abort',cancel,{once:true});
  if(signal?.aborted){stop('cancelled');return;}
  try{child=spawnProcess('docker',['start','-a','-i',name],{stdio:['pipe','pipe','pipe'],windowsHide:true,shell:false,env:cleanEnv()});}catch{finish(null,true);return;}
  // One decoder for the whole stream: a multi-byte character split across chunks must not turn into replacement characters (it would break script SHA-256 checks).
  const utf8=new StringDecoder('utf8');
  child.stdout.on('data',d=>{bytes+=d.length;if(bytes>limits.resultBytes){stop('output_limit');return;}pending+=utf8.write(d);const lines=pending.split('\n');pending=lines.pop();for(const line of lines){try{const e=JSON.parse(line);if(e.type==='phase'&&phaseMap[e.phase])report(phaseMap[e.phase]);if(e.type==='result')result=e;if(e.type==='error'){errorMessage=String(e.error||'Browser worker failed.').slice(0,400);startupDiagnostics=String(e.startupDiagnostics||'').slice(0,8192).replace(/[a-f0-9]{64}/gi,'[redacted]');failure=boundedFailure(e);}}catch{}}});
  child.stderr.on('data',d=>{bytes+=d.length;if(bytes>limits.resultBytes)stop('output_limit');});child.on('close',code=>finish(code,code!==0));child.on('error',()=>finish(null,true));child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(input));
 });
}
export async function executeBrowser(job,bundle,cap,{dockerCommand,removeContainer,spawnProcess=spawn,cleanEnv=()=>({}),report=()=>{},signal,limits=BROWSER_LIMITS,reaRunner=executeRea}){
 const suffix=randomUUID(),network='skydata-browser-net-'+suffix,proxy='skydata-browser-egress-'+suffix,name='skydata-browser-'+suffix;
 const phases=[];let run=null,clean=true,error='',status='not_started',evidence=null;
 const command=async(args,timeout=limits.createMs)=>{if(signal?.aborted)throw Error('cancelled');const r=await dockerCommand(args,timeout);if(!r.ok)throw Error('Docker '+args[0]+' failed ('+r.code+').');return r;};
 try{
  activeBrowserResources.add(network);await command(['network','create','--internal',network]);
  const [net]=JSON.parse((await command(['network','inspect',network])).stdout);if(net.Internal!==true)throw Error('Browser network is not internal.');
  activeBrowserResources.add(proxy);
  const args=createArgs(proxy,cap.proxyId,network,true);args.splice(args.length-1,0,'-e','SKYDATA_JOB_TOKEN='+bundle.relayToken,'-e','SKYDATA_JOB_ID='+job.id);
  await command(args);await command(['network','connect','bridge',proxy]);await command(['start',proxy]);
  activeBrowserResources.add(name);await command(createArgs(name,cap.imageId,network));
  report('browser_launching');run=await attachBrowser(name,{url:bundle.url,goal:bundle.goal,relayToken:bundle.relayToken,model:'gemini-3.8-flash',...(bundle.selfTest?{selfTest:true}:{})},{dockerCommand,spawnProcess,cleanEnv,report,signal,limits});
  if(run.termination)await run.termination;
  status=run.reason||(!run.error&&run.result?'complete':'failed');error=run.errorMessage||'';evidence=run.result;
 }catch(e){status=signal?.aborted?'cancelled':'infrastructure_error';error=e.message;}
 finally{
  report('cleanup');for(const container of [name,proxy]){
   const c=await removeContainer(container,{dockerCommand});phases.push(c);clean=clean&&c.ok;if(c.ok)activeBrowserResources.delete(container);
  }
  const removed=await dockerCommand(['network','rm',network],limits.cleanupMs),inspect=await dockerCommand(['network','inspect',network],limits.cleanupMs);
  const gone=!inspect.ok&&/not found|no such network|does not exist/i.test(inspect.stderr||'');clean=clean&&gone;if(gone)activeBrowserResources.delete(network);
  phases.push({phase:'network_cleanup',ok:gone,ms:removed.ms+inspect.ms,command:'docker network rm + inspect'});
 }
 if(!clean)status='infrastructure_error';
 if(status==='complete'&&evidence?.browserExecuted===true){
  evidence.cleanupConfirmed=clean;evidence.requestFingerprint=sha(JSON.stringify({url:bundle.url,goal:bundle.goal,engine:bundle.engine}));
  if(bundle.engine==='rea'){
   if(signal?.aborted)status='cancelled';else{
    const rea=await checkReaImage(dockerCommand);
    if(!rea.available||!evidence.scripts?.length){status='failed';error=!rea.available?rea.detail:'No eligible public JavaScript was captured for REA.';}
    else{
     // REA time grows with input (Linux Docker: 965 KB took 91 s at 1 CPU; at 0.4 CPU 500 KB took 148 s of the adapter's 150 s). 384 KB leaves headroom on a slower HP.
     // Scripts not sent are removed from the evidence, so the website's staged-equals-scripts check still compares exactly what REA analysed.
     let used=0;const chosen=[];for(const s of evidence.scripts){const n=Buffer.byteLength(s.text);if(used+n<=REA_BROWSER_BYTES){used+=n;chosen.push(s);}}
     if(chosen.length<evidence.scripts.length){evidence.limitations=[...(evidence.limitations||[]),'REA analysed '+chosen.length+' of '+evidence.scripts.length+' captured scripts ('+Math.round(used/1024)+' KB); the rest were left out to stay within the REA time limit on this HP.'];evidence.scripts=chosen;}
     report('rea_analysis');const files=evidence.scripts.map(({path,text,sha256})=>({path,text,sha256}));
     let reaContainer=null;const reaDocker=async(args,timeout)=>{if(args[0]==='create'){reaContainer=args[args.indexOf('--name')+1];activeBrowserResources.add(reaContainer);}return dockerCommand(args,timeout);};const stopRea=()=>{if(reaContainer)void dockerCommand(['kill',reaContainer],limits.cleanupMs);};signal?.addEventListener('abort',stopRea,{once:true});
     const r=await reaRunner({name:bundle.url,operation:'analyze-javascript-application',files},rea.imageId,{dockerCommand:reaDocker,removeContainer,spawnProcess,cleanEnv,report,limits:{...REA_LIMITS,memory:REA_BROWSER_MEMORY}});
     signal?.removeEventListener('abort',stopRea);if(r.diagnostics?.cleanupConfirmed&&reaContainer)activeBrowserResources.delete(reaContainer);
     const staged=r.adapter?.staged?.map(f=>f.path+'\0'+f.sha256).sort(),expected=files.map(f=>f.path+'\0'+f.sha256).sort();
     // The first failed check is named in the error so a failure on the HP can be diagnosed from the runner window.
     const failedPhase=(r.diagnostics?.phases||[]).find(p=>p&&p.ok===false);
     const failedCheck=!['complete','partial'].includes(r.status)?'REA status '+r.status+(r.adapter?.error?': '+String(r.adapter.error).slice(0,160):r.adapter?.rea?.error?.message?': '+String(r.adapter.rea.error.message).slice(0,160):failedPhase?' at '+failedPhase.phase+(failedPhase.detail?': '+String(failedPhase.detail).slice(0,160):failedPhase.code?' ('+failedPhase.code+')':''):''):r.adapter?.rea?.version!=='6.4.0'?'REA version '+(r.adapter?.rea?.version||'unknown'):r.adapter?.workspaceUnchanged!==true?'staged files changed':r.diagnostics?.cleanupConfirmed!==true?'REA cleanup not confirmed':JSON.stringify(staged)!==JSON.stringify(expected)?'staged files differ from captured scripts':!r.adapter?.findings?'no findings returned':null;
     if(failedCheck){status=r.diagnostics?.cleanupConfirmed===false?'infrastructure_error':['timeout','output_limit'].includes(r.status)?r.status:'failed';error=r.status==='timeout'?'REA analysis did not finish within the '+REA_LIMITS.deadlineMs/1000+'-second REA limit on this HP.':r.status==='output_limit'?'REA output exceeded its size limit.':'REA capture analysis did not pass integrity checks ('+failedCheck+').';}
     else evidence.rea={...r.adapter,cleanupConfirmed:true};
    }
   }
  }
  evidence.scripts=evidence.scripts.map(({text,...meta})=>meta);
 }else if(status==='complete'){status='invalid_result';error='The browser did not report usable real execution.';}
 if(signal?.aborted&&clean&&status!=='infrastructure_error')status='cancelled';
 return {status,evidence:status==='complete'?evidence:null,cleanupConfirmed:clean,error,phases,startupDiagnostics:run?.startupDiagnostics||'',failure:run?.failure||null};
}
export async function browserSelftest({dockerCommand,removeContainer,cleanEnv,spawnProcess=spawn}){
 const cap=await checkBrowserImages(dockerCommand,{ignoreStamp:true});if(!cap.available)throw Error(cap.detail);
 const result=await executeBrowser({id:randomUUID()},{url:'https://example.com/',goal:'Public fixture connectivity self-test',engine:'superpowers',relayToken:'0'.repeat(64),selfTest:true},cap,{dockerCommand,removeContainer,cleanEnv,spawnProcess});
 const probes=result.evidence?.pages?.[0]?.privateNetworkProbes||[];
 const passed=result.status==='complete'&&result.evidence?.controlOriginGuard===true&&result.cleanupConfirmed&&result.evidence?.pages?.[0]?.title==='Example Domain'&&result.evidence.screenshots?.some(s=>s.width===390)&&probes.length===5&&probes.every(p=>p.blocked);
 const f=result.failure,guard=result.evidence?.controlOriginGuard===true||f?.completedChecks?.controlOriginGuard===true?true:f&&f.completedChecks?.controlOriginGuard===undefined?'not_reached':false;
 await mkdir(join(homedir(),'.skydata-runner'),{recursive:true});await writeFile(stampPath,JSON.stringify({passed,imageId:cap.imageId,proxyId:cap.proxyId,at:Date.now()}));
 await writeFile('browser-selftest-report.txt',JSON.stringify({passed,status:result.status,error:result.error,failingPhase:f?.failingPhase??null,completedChecks:f?.completedChecks??null,resources:f?.resources??null,configuredBrowserPidsLimit:BROWSER_PIDS,viewports:result.evidence?.viewports??f?.completedChecks?.viewports??null,startupDiagnostics:result.startupDiagnostics,phases:result.phases,cleanupConfirmed:result.cleanupConfirmed,probes:probes.length?probes:f?.probes??[],controlOriginGuard:guard,stagehandVersion:BROWSER_VERSION,nativeChromeSandbox:false,note:'Public load, screenshots and private-request probes only; real AI navigation and HP website job require separate live testing.'},null,2));
 if(!passed)throw Error('Browser self-test failed. Send browser-selftest-report.txt (no tokens).');return 'Browser self-test passed: real public Chromium load, two viewport screenshots, private request probes and cleanup. Live AI navigation is still unverified.';
}
