import {BROWSER_PREFIX,parseBrowserJob,checkBrowserImages,executeBrowser,browserSelftest,activeBrowserResources} from './browser-job.mjs';
import {PROJECT_PREFIX,validBundle,projectScript} from './project.mjs';
import {spawn,execFile,execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,chmod} from 'node:fs/promises';
import {homedir,release,cpus,totalmem} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createInterface} from 'node:readline/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {REA_PREFIX,REA_OPERATION,REA_VERSION,ADAPTER_VERSION,REA_LIMITS,parseReaJob,checkReaImage,executeRea} from './rea-job.mjs';
const SITE='https://skydata-ai.skyrease123.chatgpt.site';
export const VERSION='2.4.3';
const dir=join(homedir(),'.skydata-runner'),configPath=join(dir,'connection.json');
const OUTPUT_LIMIT=60000;
// Code execution is capped at 10 seconds measured from when Node starts running the code inside the
// container. Container start-up and Docker checks have their own separate limits and never run code.
export const LIMITS={executionMs:10000,startupMs:60000,dockerCheckMs:90000,createMs:60000,cleanupMs:30000,graceMs:1000};
let activeContainer=null,dockerHealth={ok:false,checkedAt:0,detail:'Not checked yet.'};
const display=text=>String(text).replace(/[\x00-\x08\x0b-\x1f\x7f]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
function cleanEnv(){return Object.fromEntries(Object.entries(process.env).filter(([key])=>['PATH','SYSTEMROOT','WINDIR','TEMP','TMP','HOME','USERPROFILE','APPDATA','LOCALAPPDATA','PROGRAMDATA','DOCKER_HOST','DOCKER_CONTEXT'].includes(key.toUpperCase())));}
// Same isolation as v2/v2.1. `create` + `start` replaces `run` so start-up is measured separately.
// The --import preload only writes a start marker to stderr before the submitted code is loaded.
export function containerArgs(name,image,marker='SKYDATA_EXEC_START'){return ['create','--name',name,'--pull','never','--rm','--network','none','--memory','256m','--memory-swap','256m','--cpus','1','--pids-limit','64','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--user','1000:1000','--tmpfs','/tmp:rw,noexec,nosuid,size=16m','--log-driver','none','-i',image,'node','--import','data:text/javascript,'+encodeURIComponent('process.stderr.write('+JSON.stringify(marker+'\n')+')'),'-'];}
// REA analysis payloads are a separate job type and are never accepted as JavaScript test jobs.
export function validJob(job){if(!job||typeof job.code==='string'&&(job.code.startsWith(REA_PREFIX)||job.code.startsWith(BROWSER_PREFIX))||!/^[a-f0-9-]{36}$/.test(job.id)||typeof job.code!=='string'||!Number.isFinite(job.expires)||job.expires<=Date.now())return false;if(job.code.startsWith(PROJECT_PREFIX)){try{return Buffer.byteLength(job.code)<=900000&&validBundle(JSON.parse(job.code.slice(PROJECT_PREFIX.length)));}catch{return false;}}return Buffer.byteLength(job.code)>0&&Buffer.byteLength(job.code)<=16000;}
// Runs one docker CLI command and always resolves with timing and the exact failure, never throws.
export function docker(args,timeoutMs,{run=execFile}={}){
 const started=Date.now();
 return new Promise(resolve=>{try{run('docker',args,{encoding:'utf8',timeout:timeoutMs,maxBuffer:200000,windowsHide:true,env:cleanEnv()},(error,stdout,stderr)=>{
  const ms=Date.now()-started,out=String(stdout||'').trim(),err=String(stderr||'').trim();
  if(!error)return resolve({ok:true,ms,stdout:out,stderr:err,code:0});
  const timedOut=error.killed&&ms>=timeoutMs-50||error.code==='ETIMEDOUT';
  resolve({ok:false,ms,stdout:out,stderr:err,timedOut,code:timedOut?'ETIMEDOUT':error.code??'unknown'});
 });}catch(e){resolve({ok:false,ms:Date.now()-started,stdout:'',stderr:String(e?.message||e),code:e?.code||'spawn_failed'});}});
}
const phase=(name,command,r,extra={})=>({phase:name,command,ms:r.ms,ok:r.ok,...(r.ok?{}:{code:String(r.code),detail:(r.timedOut?'Timed out after '+Math.round(r.ms/1000)+' s. ':'')+(r.stderr||r.stdout||'No output from docker.').slice(0,600)}),...extra});
export async function checkDocker({dockerCommand=docker}={}){
 const r=await dockerCommand(['info','--format','{{.OSType}} {{.ServerVersion}}'],LIMITS.dockerCheckMs);
 const ok=r.ok&&r.stdout.startsWith('linux ');dockerHealth={ok,checkedAt:Date.now(),detail:ok?'Docker '+r.stdout.split(' ')[1]+' answered in '+r.ms+' ms':r.ok?'Docker is not using Linux containers: '+r.stdout.slice(0,100):'docker info failed ('+r.code+') after '+r.ms+' ms'};
 return phase('docker_check','docker info',r.ok&&!ok?{...r,ok:false,code:'not_linux',stderr:'Docker answered but is not using Linux containers ('+r.stdout.slice(0,80)+').'}:r);
}
async function pinnedImage(){
 console.log('Checking Docker readiness (up to '+LIMITS.dockerCheckMs/1000+' seconds)...');
 const check=await checkDocker();console.log(check.ok?'  '+dockerHealth.detail:'  FAILED: '+check.detail);if(!check.ok)throw Error('Docker readiness failed: '+check.detail+'\nKeep Docker Desktop running and try again.');
 console.log('Checking cached Node image (up to 60 seconds)...');
 const r=await docker(['image','inspect','node:24-alpine'],60000);if(!r.ok)throw Error('Node image check failed ('+r.code+'): '+(r.stderr||'').slice(0,600)+'\nRun once while online: docker pull node:24-alpine');
 const image=JSON.parse(r.stdout)[0];if(!/^sha256:[a-f0-9]{64}$/.test(image?.Id)||image.Config?.Labels?.['skydata.untrusted'])throw Error('Valid local Node image not found.');console.log('  node:24-alpine '+image.Id.slice(7,19)+' ('+r.ms+' ms)');return image.Id;
}
// Removes the container and then confirms it is gone, instead of guessing from the rm error text.
export async function cleanup(name,{dockerCommand=docker,wait=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 const started=Date.now(),rm=await dockerCommand(['rm','-f',name],LIMITS.cleanupMs);let last;
 for(let attempt=0;attempt<6;attempt++){
  last=await dockerCommand(['container','inspect','--format','{{.State.Status}}',name],LIMITS.cleanupMs);
  if(!last.ok&&/no such (container|object)/i.test(last.stderr))return {phase:'cleanup',command:'docker rm -f + docker container inspect',ms:Date.now()-started,ok:true,...(rm.ok?{}:{detail:'rm reported: '+(rm.stderr||rm.code).slice(0,300)+' (container confirmed absent afterwards)'})};
  if(!last.ok&&last.timedOut)break;await wait(2000);
 }
 return {phase:'cleanup',command:'docker rm -f + docker container inspect',ms:Date.now()-started,ok:false,code:String(last.ok?'still_present':last.code),detail:('rm: '+(rm.ok?'ok':(rm.timedOut?'timed out after '+Math.round(rm.ms/1000)+' s':rm.code)+' '+rm.stderr.slice(0,300))+' | inspect: '+(last.ok?'container still exists ('+last.stdout+')':(last.timedOut?'timed out':last.code)+' '+last.stderr.slice(0,300))).slice(0,600)};
}
export async function execute(code,image,{spawnProcess=spawn,dockerCommand=docker,removeContainer=cleanup,limits=LIMITS,report=()=>{},wait}={}){
 const name='skydata-test-'+randomUUID(),marker='SKYDATA_EXEC_START_'+randomUUID().replace(/-/g,''),phases=[],totalStart=Date.now();
 let terminationPhase=null,executionStatus='not_started',stdout='',stderr='',exitCode=null,durationMs=0;activeContainer=name;
 const created=await dockerCommand(containerArgs(name,image,marker),limits.createMs);phases.push(phase('container_create','docker create (isolated)',created));
 if(created.ok){
  report('container_start');
  const run=await new Promise(resolve=>{
   let bytes=0,started=0,ended=false,reason='',buffered='',child,startTimer,execTimer;const spawnedAt=Date.now();
   let stoppedAt=0,termination=null;
   const finish=(code,error)=>{if(ended)return;ended=true;clearTimeout(startTimer);clearTimeout(execTimer);resolve({code,error,reason,started,spawnedAt,stoppedAt,termination,ended:Date.now()});};
   // Enforcement never waits on the docker CLI: the limit moment is recorded, the CLI process is killed at once,
   // `docker kill` runs concurrently with its own bound, and the run is finished after a fixed grace period.
   const stop=why=>{if(reason)return;reason=why;stoppedAt=Date.now();
    const kill=Promise.resolve().then(()=>dockerCommand(['kill',name],limits.cleanupMs)).catch(e=>({ok:false,ms:Date.now()-stoppedAt,stdout:'',stderr:String(e?.message||e),code:'kill_failed'}));
    termination=Promise.race([kill,new Promise(r=>{setTimeout(()=>r({ok:false,ms:limits.cleanupMs+1000,stdout:'',stderr:'docker kill did not return.',timedOut:true,code:'ETIMEDOUT'}),limits.cleanupMs+1000);})]);
    try{child.kill();}catch{}setTimeout(()=>finish(null,true),limits.graceMs??1000);};
   const collect=(which,data)=>{bytes+=data.length;if(bytes>OUTPUT_LIMIT){void stop('output_limit');return;}if(which==='out')stdout+=data.toString();else{
    if(started){stderr+=data.toString();return;}buffered+=data.toString();const at=buffered.indexOf(marker+'\n');
    if(at>=0){started=Date.now();report('executing');stderr+=buffered.slice(0,at)+buffered.slice(at+marker.length+1);buffered='';clearTimeout(startTimer);execTimer=setTimeout(()=>void stop('timeout'),limits.executionMs);}}};
   try{child=spawnProcess('docker',['start','-a','-i',name],{stdio:['pipe','pipe','pipe'],windowsHide:true,shell:false,env:cleanEnv()});}catch(e){stderr='Docker start failed ('+(e.code||'unknown')+'): '+String(e.message||'').slice(0,2000);finish(null,true);return;}
   child.stdout.on('data',d=>collect('out',d));child.stderr.on('data',d=>collect('err',d));child.on('error',e=>{stderr+='\nDocker start failed ('+(e.code||'unknown')+'): '+String(e.message||'').slice(0,2000);finish(null,true);});
   child.on('close',code=>{if(!started){stderr+=buffered;buffered='';}finish(code,code===null);});child.stdin.on('error',()=>{});child.stdin.end(code);
   startTimer=setTimeout(()=>void stop('startup_timeout'),limits.startupMs);
  });
  exitCode=run.code;durationMs=run.started?Math.max(0,(run.stoppedAt||run.ended)-run.started):0;
  if(run.termination){const k=await run.termination,closedAfter=run.ended-run.stoppedAt;
   terminationPhase=({phase:'termination',command:'docker kill',ms:k.ms,ok:k.ok,detail:(k.ok?'Container stop confirmed by docker kill.':'Termination NOT confirmed: docker kill '+(k.timedOut?'timed out after '+Math.round(k.ms/1000)+' s':'failed ('+k.code+')')+'. The container may have kept running until cleanup removed it. '+(k.stderr||'').slice(0,300))+' Runner stopped waiting '+closedAfter+' ms after the limit.'});
   if(!k.ok)stderr+='\nSkyData runner: the '+run.reason+' limit was enforced on the runner side, but docker kill did not confirm the container stopped; see the cleanup phase.';}
  phases.push({phase:'container_start',command:'docker start -a -i',ms:(run.started||run.ended)-run.spawnedAt,ok:!!run.started,...(run.started?{}:{code:run.reason||'no_start_marker',detail:run.reason==='startup_timeout'?'The container did not start Node within '+limits.startupMs/1000+' s. Your code did not run.':'Node did not reach the submitted code (exit '+run.code+'). '+stderr.slice(-400)})});
  // Node compiles stdin before the preload runs, so a syntax error exits without the marker: that is the code failing, not Docker.
  const dockerError=/Error response from daemon|Cannot connect to the Docker daemon|error during connect|^docker: /im.test(stderr);
  if(!run.started&&!run.reason&&Number.isInteger(run.code)&&![125,126,127].includes(run.code)&&run.code!==0&&!dockerError){
   executionStatus='failed';phases[phases.length-1]={...phases.at(-1),ok:true,detail:'Node rejected the code before running it (exit '+run.code+'), for example a syntax error.'};
   phases.push({phase:'execution',command:'node (inside container)',ms:0,ok:true,detail:'Not started: rejected at compile time.'});
  }
  if(run.started){
   executionStatus=run.reason==='timeout'||run.reason==='output_limit'?run.reason:run.error?'infrastructure_error':run.code===0?'passed':'failed';
   phases.push({phase:'execution',command:'node (inside container)',ms:durationMs,ok:executionStatus==='passed'||executionStatus==='failed',...(executionStatus==='timeout'?{code:'timeout',detail:'Stopped at the '+limits.executionMs/1000+'-second execution limit.'}:{})});
  }
 }
 if(terminationPhase)phases.push(terminationPhase);
 report('cleanup');const clean=await removeContainer(name,{dockerCommand,...(wait?{wait}:{})});phases.push(clean);activeContainer=null;
 const status=!clean.ok||executionStatus==='not_started'||executionStatus==='infrastructure_error'?'infrastructure_error':executionStatus;
 const failed=phases.filter(p=>!p.ok);
 if(status==='infrastructure_error')stderr+='\n--- SkyData runner '+VERSION+' diagnostics ---\n'+failed.map(p=>p.phase+' ['+p.command+'] '+(p.code||'')+': '+(p.detail||'')).join('\n')+(executionStatus!=='not_started'?'\nCode result before cleanup: '+executionStatus:'\nYour code did not run.');
 return {status,exitCode,stdout,stderr,durationMs,diagnostics:{runner:VERSION,executionStatus,cleanupConfirmed:clean.ok,totalMs:Date.now()-totalStart,phases}};
}
async function protectFile(){
 if(process.platform==='win32'){
 const who=execFileSync('whoami',[],{encoding:'utf8',windowsHide:true}).trim();
 execFileSync('icacls',[configPath,'/inheritance:r','/grant:r',who+':F'],{stdio:'ignore',windowsHide:true});
 }else await chmod(configPath,0o600);
}
async function api(path,body,token){
 const r=await fetch(SITE+'/api/engineering-runner/'+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(path==='browser-result'?60000:15000)});
 const d=await r.json();if(!r.ok)throw Error(d.error||'Site request failed ('+r.status+').');return d;
}
// Progress is informational; an older website without this endpoint simply ignores it.
const progress=(token,id)=>phaseName=>{void api('progress',{id,phase:phaseName},token).catch(()=>{});};
async function pair(){const rl=createInterface({input:process.stdin,output:process.stdout});try{
 const code=(await rl.question('Paste the pairing code from SkyData: ')).trim();if(!/^[a-f0-9]{64}$/.test(code))throw Error('Invalid code.');
 const d=await api('pair',{code});if(!/^[a-f0-9]{64}$/.test(d.token))throw Error('Site returned an invalid token.');
 await mkdir(dir,{recursive:true,mode:0o700});await writeFile(configPath,JSON.stringify({token:d.token,expires:d.expires}),{mode:0o600});await protectFile();console.log('Paired. Now run: node runner.mjs start');
 }finally{rl.close();}}
function printPhases(result){for(const p of result.diagnostics.phases)console.log('  '+(p.ok?'ok  ':'FAIL')+' '+p.phase.padEnd(16)+String(p.ms).padStart(7)+' ms  '+p.command+(p.ok?'':'  ['+p.code+'] '+display(p.detail||'')));}
async function start(){
 const config=JSON.parse(await readFile(configPath,'utf8'));if(!/^[a-f0-9]{64}$/.test(config.token)||config.expires<=Date.now())throw Error('Pair again; connection expired.');await protectFile();const image=await pinnedImage();let rea=await checkReaImage(docker),browser=await checkBrowserImages(docker);console.log('Browser investigations: '+browser.detail);console.log('REA static analysis: '+(rea.available?'available · ':'unavailable · ')+rea.detail);
 const rl=createInterface({input:process.stdin,output:process.stdout});console.log('SkyData HP runner v'+VERSION+' connected. Keep this window open. Ctrl+C stops it.\nThe website shows when Docker was last verified; polling alone does not prove Docker is healthy.');
 try{for(;;){
 const {job}=await api('poll',{ready:true,protocol:2,version:VERSION,docker:dockerHealth,capabilities:{browser,rea:{available:rea.available,reaVersion:rea.reaVersion,adapterVersion:rea.adapterVersion,checkedAt:rea.checkedAt,detail:rea.detail}}},config.token);
 if(job&&typeof job.code==='string'&&job.code.startsWith(BROWSER_PREFIX)){await hpBrowserJob(job,rl,config.token);browser=await checkBrowserImages(docker);}
 else if(job&&typeof job.code==='string'&&job.code.startsWith(REA_PREFIX))rea=await reaJob(job,rl,config.token);
 else if(job){if(!validJob(job))throw Error('Invalid or expired test; execution stopped.');const project=job.code.startsWith(PROJECT_PREFIX)?JSON.parse(job.code.slice(PROJECT_PREFIX.length)):null;console.log('\nTEST REQUEST '+job.id+'\n'+(project?'PROJECT: '+display(project.name)+'\nTest entry: '+project.entry+'\n'+project.files.map(f=>'\nFILE: '+f.path+'\n'+display(f.text)).join('\n'):display(job.code))+'\n');console.log('Approve within 10 minutes. Execution still stops after 10 seconds.');
 const answer=await rl.question('Run this exact JavaScript in Docker? Type yes: ');let result;
 if(answer.trim().toLowerCase()==='yes'&&job.expires>Date.now()){
  const report=progress(config.token,job.id);report('docker_check');console.log('Checking Docker before starting (up to '+LIMITS.dockerCheckMs/1000+' s; not part of the 10-second limit)...');
  const check=await checkDocker();
  if(!check.ok)result={status:'infrastructure_error',exitCode:null,stdout:'',stderr:'Docker check failed before the test started: '+check.detail+'\nYour code did not run.',durationMs:0,diagnostics:{runner:VERSION,executionStatus:'not_started',cleanupConfirmed:true,totalMs:check.ms,phases:[check]}};
  else{result=await execute(project?projectScript(project):job.code,image,{report});result.diagnostics.phases.unshift(check);}
 }else result={status:'declined',exitCode:null,stdout:'',stderr:'Declined or expired before local approval.',durationMs:0,diagnostics:{runner:VERSION,executionStatus:'not_started',cleanupConfirmed:true,totalMs:0,phases:[]}};
 if(project&&result.exitCode===124&&result.status==='failed')result.status='timeout';console.log('Result: '+result.status+'\n'+display(result.stdout)+'\n'+display(result.stderr));if(result.diagnostics.phases.length)printPhases(result);
 await api('result',{id:job.id,result},config.token);if(result.status==='infrastructure_error')throw Error('Runner stopped after an infrastructure error. The phase list above names the failing Docker command. It will not retry automatically.');
 }
 await new Promise(resolve=>setTimeout(resolve,5000));
 }}finally{rl.close();}
}
export async function hpBrowserJob(job,rl,token,{apiCall=api,checkImages=checkBrowserImages,executeJob=executeBrowser}={}){
 const bundle=parseBrowserJob(job);if(!bundle)throw Error('Invalid browser job. Runner stopped.');
 console.log('\nWEBSITE INVESTIGATION '+job.id+'\nWebsite: '+display(bundle.url)+'\nEngine: '+bundle.engine+'\nGoal: '+display(bundle.goal)+'\nPublic pages only; no submissions, logins, media downloads or security bypass.');
 const cap=await checkImages(docker);let result;const controller=new AbortController();let controlBusy=false;
 const check=async()=>{if(controlBusy)return;controlBusy=true;try{const d=await apiCall('browser-control',{id:job.id},token);if(d.cancel)controller.abort();}catch{controller.abort();}finally{controlBusy=false;}};
 const timer=setInterval(()=>void check(),5000);
 try{
  if(!cap.available)result={status:'unavailable',cleanupConfirmed:true,error:cap.detail};
  else{
   let answer='';try{answer=(await rl.question('Open this public website in isolated Docker? Type yes: ',{signal:controller.signal})).trim().toLowerCase();}catch{}
   if(controller.signal.aborted)result={status:'cancelled',cleanupConfirmed:true,error:'Cancelled before browser execution.'};
   else if(answer!=='yes'||job.expires<=Date.now())result={status:'declined',cleanupConfirmed:true,error:'Declined or expired before local approval.'};
   else{
    const report=phase=>{void apiCall('progress',{id:job.id,phase},token).catch(()=>controller.abort());};
    const health=await checkDocker();
    if(!health.ok)result={status:'infrastructure_error',cleanupConfirmed:true,error:'Docker check failed before browser execution.'};
    else result=await executeJob(job,bundle,cap,{dockerCommand:docker,removeContainer:cleanup,cleanEnv,report,signal:controller.signal});
   }
  }
  console.log('Website investigation: '+result.status+(result.error?' · '+display(result.error):''));
  // Failure context stays on this HP (window only); the website receives the same result fields as before.
  const {failure,...sent}=result;if(failure)console.log('Stopped at: '+display(failure.failingPhase||'unknown')+' · browser tasks '+(failure.resources?.pids?.current??'?')+'/'+(failure.resources?.pids?.max??'?')+' · task limit hits '+(failure.resources?.pids?.events?.max??'?'));
  const received=await apiCall('browser-result',{id:job.id,result:sent},token);if(received.status==='invalid_result')console.log('The website refused this result after integrity checks.');
  if(result.status==='infrastructure_error')throw Error('Runner stopped after browser infrastructure/cleanup failure. No automatic retry.');
 }finally{clearInterval(timer);}
}
// One REA static-analysis request: re-verify the prepared image, show the exact operation and files, ask locally.
export async function reaJob(job,rl,token,{apiCall=api}={}){
 const rea=await checkReaImage(docker),send=result=>apiCall('rea-result',{id:job.id,result},token);
 const bundle=parseReaJob(job);
 if(!bundle){await send({status:'rejected',adapter:null,stderr:'Invalid or expired REA request.',diagnostics:{runner:'rea-job/'+ADAPTER_VERSION,executionStatus:'not_started',cleanupConfirmed:true,totalMs:0,phases:[]}}).catch(()=>{});throw Error('Invalid or expired REA request; runner stopped.');}
 const total=bundle.files.reduce((s,f)=>s+Buffer.byteLength(f.text),0);
 console.log('\nREA STATIC ANALYSIS REQUEST '+job.id+'\nProject: '+display(bundle.name)+'\nOperation: '+REA_OPERATION+' (rea-agents '+REA_VERSION+', SkyData adapter '+ADAPTER_VERSION+')\nREA reads these files as text. It does not run them, install packages or use the network.\nFiles: '+bundle.files.length+' · '+total+' bytes');
 for(const f of bundle.files)console.log('  '+display(f.path).padEnd(48)+String(Buffer.byteLength(f.text)).padStart(9)+' B  '+f.sha256.slice(0,16));
 if(!rea.available){console.log('Not run: '+rea.detail);await send({status:'unavailable',adapter:null,stderr:rea.detail,diagnostics:{runner:'rea-job/'+ADAPTER_VERSION,executionStatus:'not_started',cleanupConfirmed:true,totalMs:0,phases:[]}});return rea;}
 let answer=(await rl.question('Analyze these exact files with REA in Docker? Type yes (or show to print them first): ')).trim().toLowerCase();
 if(answer==='show'){for(const f of bundle.files)console.log('\nFILE: '+f.path+'\n'+display(f.text));answer=(await rl.question('Analyze these exact files with REA in Docker? Type yes: ')).trim().toLowerCase();}
 if(answer!=='yes'||job.expires<=Date.now()){await send({status:'declined',adapter:null,stderr:'Declined or expired before local approval.',diagnostics:{runner:'rea-job/'+ADAPTER_VERSION,executionStatus:'not_started',cleanupConfirmed:true,totalMs:0,phases:[]}});return rea;}
 const report=phaseName=>{void apiCall('progress',{id:job.id,phase:phaseName},token).catch(()=>{});};report('docker_check');const check=await checkDocker();let result;
 if(!check.ok)result={status:'infrastructure_error',adapter:null,stderr:'Docker check failed: '+check.detail,diagnostics:{runner:'rea-job/'+ADAPTER_VERSION,executionStatus:'not_started',cleanupConfirmed:true,totalMs:check.ms,phases:[check]}};
 else{result=await executeRea(bundle,rea.imageId,{dockerCommand:docker,removeContainer:cleanup,report,cleanEnv});result.diagnostics.phases.unshift(check);}
 console.log('REA result: '+result.status+(result.adapter?.findings?' · '+result.adapter.findings.imports.total+' imports, '+result.adapter.findings.endpoints.total+' endpoints, coverage '+result.adapter.findings.graphCoverage?.status:''));printPhases(result);
 await send(result);if(result.status==='infrastructure_error')throw Error('Runner stopped after an infrastructure error during REA analysis. It will not retry automatically.');
 return rea;
}
async function filesUnder(root,rel=''){const out=[];for(const e of await readdir(join(root,rel),{withFileTypes:true})){const p=rel?rel+'/'+e.name:e.name;if(e.isDirectory())out.push(...await filesUnder(root,p));else if(e.isFile()){const text=await readFile(join(root,p),'utf8');out.push({path:p,text,sha256:createHash('sha256').update(text).digest('hex')});}}return out.sort((a,b)=>a.path<b.path?-1:1);}
// Real REA analysis of the bundled fixture. The fixture writes EXECUTED.txt if anything ever runs it.
async function reaSelftest(){
 const lines=[],log=s=>{console.log(s);lines.push(s);};let failed=0;const expect=(ok,what)=>{log('  '+(ok?'ok  ':'FAIL')+' '+what);if(!ok)failed++;};
 log('SkyData REA self-test · runner '+VERSION+' · '+new Date().toISOString()+' · Node '+process.version+' · '+process.platform+' '+release());
 try{await pinnedImage();const rea=await checkReaImage(docker);log('REA image: '+rea.detail);if(!rea.available)throw Error(rea.detail);
  const files=await filesUnder(fileURLToPath(new URL('./rea/fixture/',import.meta.url)));
  const r=await executeRea({name:'built-in REA fixture',operation:REA_OPERATION,files},rea.imageId,{dockerCommand:docker,removeContainer:cleanup,cleanEnv});
  for(const p of r.diagnostics.phases)log('  phase '+p.phase.padEnd(16)+String(p.ms).padStart(7)+' ms  '+(p.ok?'ok':'FAILED '+(p.code||'')+' '+(p.detail||'')));
  const a=r.adapter,f=a?.findings;expect(a?.rea?.version===REA_VERSION,'REA reported version '+a?.rea?.version);expect(r.diagnostics.cleanupConfirmed,'container removal confirmed');
  expect(a?.workspaceUnchanged===true,'staged files unchanged and no execution canary created');expect(r.status==='partial','status partial (one fixture file is deliberately invalid): '+r.status);
  const eps=new Set((f?.endpoints.items||[]).map(e=>e.value)),specs=new Set((f?.imports.items||[]).map(i=>i.specifier));
  for(const e of ['/health','/api/orders','/:id','https://api.example.test/v1/products'])expect(eps.has(e),'endpoint '+e);
  for(const s of ['./routes/users','./lib/pricing','./view.mjs','./settings.mjs','express'])expect(specs.has(s),'import '+s);
  expect((f?.unknowns.items||[]).some(u=>u.path==='src/broken.js'),'parse failure reported as an explicit unknown');expect((f?.storage.items||[]).some(s=>s.name==='theme'),'localStorage key theme');
 }catch(e){failed++;log('STOPPED: '+e.message);}
 log(failed?'\nREA SELF-TEST FAILED ('+failed+'). Send rea-selftest-report.txt (it contains no tokens).':'\nREA self-test passed: real REA '+REA_VERSION+' analysis through the runner path, no execution, cleanup confirmed.');
 await writeFile('rea-selftest-report.txt',lines.join('\n')+'\n').catch(()=>{});if(failed)process.exitCode=1;
}
async function selftest(){
 const lines=[],log=s=>{console.log(s);lines.push(s);};
 log('SkyData runner '+VERSION+' self-test · '+new Date().toISOString());log('Node '+process.version+' · '+process.platform+' '+release()+' · '+cpus().length+' CPU ('+(cpus()[0]?.model||'unknown').trim()+') · '+Math.round(totalmem()/1073741824)+' GB RAM');
 const ver=await docker(['version','--format','client {{.Client.Version}} / server {{.Server.Version}} ({{.Server.Os}})'],LIMITS.dockerCheckMs);log('docker version: '+(ver.ok?ver.stdout:'FAILED '+ver.code+' after '+ver.ms+' ms: '+ver.stderr.slice(0,300))+' ['+ver.ms+' ms]');
 let failed=0;
 try{const image=await pinnedImage();log('Docker readiness: '+dockerHealth.detail);
  const bundle={name:'built-in project check',entry:'math.test.mjs',files:[{path:'math.mjs',text:'export const add=(a,b)=>a+b;'},{path:'math.test.mjs',text:"import assert from 'node:assert/strict';import {add} from './math.mjs';assert.equal(add(2,2),4);console.log('PASS: project imports');"}]};
  for(const [label,code,expected] of [['passing snippet',"require('node:assert/strict').equal(2+2,4); console.log('PASS');",'passed'],['failing assertion',"require('node:assert/strict').equal(2+2,5);",'failed'],['10-second timeout','while(true){}','timeout'],['project imports',projectScript(bundle),'passed']]){
   log('\n'+label+' (expect '+expected+'):');const r=await execute(code,image);const ok=r.status===expected;if(!ok)failed++;
   log('  result: '+r.status+(ok?' ✓':' ✗ expected '+expected)+' · code result '+r.diagnostics.executionStatus+' · execution '+r.durationMs+' ms · total '+r.diagnostics.totalMs+' ms');
   for(const p of r.diagnostics.phases)log('  '+(p.ok?'ok  ':'FAIL')+' '+p.phase.padEnd(16)+String(p.ms).padStart(7)+' ms  '+p.command+(p.ok?'':'  ['+p.code+'] '+display(p.detail||'')));
   if(!ok&&r.stderr)log('  stderr: '+display(r.stderr.slice(-800)));
  }
 }catch(e){failed++;log('STOPPED: '+e.message);}
 log(failed?'\nSELF-TEST FAILED ('+failed+' problem'+(failed===1?'':'s')+'). Send selftest-report.txt (it contains no tokens).':'\nSelf-test passed: success, failing assertion, timeout and project imports, each with Docker phase timings.');
 await writeFile('selftest-report.txt',lines.join('\n')+'\n').catch(()=>{});console.log('Saved selftest-report.txt in this folder.');if(failed)process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{for(const resource of activeBrowserResources)try{execFileSync('docker',[resource.startsWith('skydata-browser-net-')?'network':'container','rm','-f',resource],{stdio:'ignore',timeout:LIMITS.cleanupMs,windowsHide:true});}catch{console.error('Check Docker Desktop for '+resource);}
 if(activeContainer)try{execFileSync('docker',['rm','-f',activeContainer],{stdio:'ignore',timeout:LIMITS.cleanupMs,windowsHide:true});}catch{console.error('Could not confirm cleanup. Check Docker Desktop for '+activeContainer);}process.exit(130);});
 const mode=process.argv[2];try{if(mode==='pair')await pair();else if(mode==='start')await start();else if(mode==='selftest')await selftest();else if(mode==='rea-selftest')await reaSelftest();else if(mode==='browser-selftest')console.log(await browserSelftest({dockerCommand:docker,removeContainer:cleanup,cleanEnv}));else console.log('Use: node runner.mjs pair | start | selftest | rea-selftest | browser-selftest');}catch(e){console.error(e.message);process.exitCode=1;}
}
