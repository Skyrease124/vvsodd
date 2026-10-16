// REA static-analysis jobs for the HP runner (REA adapter 1, rea-agents 6.5.0).
// Separate from JavaScript test jobs: different payload prefix, fixed container image and entrypoint,
// one allowed operation, no user-supplied commands or arguments, and nothing from the project is executed.
import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {StringDecoder} from 'node:string_decoder';
export const REA_PREFIX='SKYDATA_REA_V1\n',REA_IMAGE='skydata-rea:6.5.0-a2',REA_IMAGE_LEGACY='skydata-rea:6.5.0-a1',REA_VERSION='6.5.0',ADAPTER_VERSION='1',REA_OPERATION='analyze-javascript-application';
export const REA_LIMITS={files:200,totalBytes:2*1024*1024,fileBytes:512*1024,payloadBytes:3*1024*1024,resultBytes:4*1024*1024,deadlineMs:180000,createMs:60000,cleanupMs:30000,graceMs:1000};
const sha=t=>createHash('sha256').update(t).digest('hex');
export function safeReaPath(p){return typeof p==='string'&&p.length>0&&p.length<=240&&!p.startsWith('/')&&!p.includes('\\')&&!/^[a-zA-Z]:/.test(p)&&!p.endsWith('/')&&p.split('/').every(s=>s&&s!=='.'&&s!=='..'&&!/[\x00-\x1f<>:"|?*]/.test(s));}
export function validReaBundle(b){
 if(!b||b.operation!==REA_OPERATION||typeof b.name!=='string'||b.name.length>300||!Array.isArray(b.files)||!b.files.length||b.files.length>REA_LIMITS.files)return false;
 const seen=new Set();let total=0;
 for(const f of b.files){if(!f||!safeReaPath(f.path)||typeof f.text!=='string'||typeof f.sha256!=='string'||sha(f.text)!==f.sha256||seen.has(f.path.toLowerCase()))return false;seen.add(f.path.toLowerCase());const n=Buffer.byteLength(f.text);if(n>REA_LIMITS.fileBytes)return false;total+=n;if(total>REA_LIMITS.totalBytes)return false;}
 return true;
}
export function parseReaJob(job){
 if(!job||typeof job.code!=='string'||!job.code.startsWith(REA_PREFIX)||Buffer.byteLength(job.code)>REA_LIMITS.payloadBytes||!/^[a-f0-9-]{36}$/.test(job.id)||!Number.isFinite(job.expires)||job.expires<=Date.now())return null;
 try{const b=JSON.parse(job.code.slice(REA_PREFIX.length));return validReaBundle(b)?b:null;}catch{return null;}
}
// Same isolation as test jobs; memory is 1 GB: REA 6.5.0 sizes its result budget from the container's memory and at 768 MB
// skipped semantic analysis of files that 6.4.0 analysed (REA's analyzer itself needs a V8 heap of 384 MB) and no command is passed:
// the image's fixed entrypoint is the adapter, which accepts only REA_OPERATION.
export function reaContainerArgs(name,imageId,memory='1024m',tmpfs='64m'){return ['create','--name',name,'--pull','never','--rm','--network','none','--memory',memory,'--memory-swap',memory,'--cpus','1','--pids-limit','64','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--user','1000:1000','--tmpfs','/tmp:rw,noexec,nosuid,size='+tmpfs,'--log-driver','none','-i',imageId];}
// Verifies the locally prepared image instead of pulling anything during a job.
export async function checkReaImage(dockerCommand){
 // a2 = JavaScript analysis + file analysis (.NET, archives, SQLite); a1 = JavaScript analysis only (older Prepare_REA).
 const a2=await inspectReaImage(dockerCommand,REA_IMAGE,true);if(a2.available||a2.imageMissing===false)return a2;
 const a1=await inspectReaImage(dockerCommand,REA_IMAGE_LEGACY,false);
 return a1.available?{...a1,detail:a1.detail+' · file analysis (.NET, archives, SQLite) needs Prepare_REA to be run again'}:a2;
}
async function inspectReaImage(dockerCommand,image,files){
 const r=await dockerCommand(['image','inspect',image],60000);
 if(!r.ok){const missing=/no such (image|object)/i.test(r.stderr);return {available:false,imageMissing:missing,files:false,reaVersion:null,adapterVersion:null,imageId:null,checkedAt:Date.now(),detail:missing?'REA image '+image+' is not prepared. Run Prepare_REA.cmd once.':'Image check failed ('+r.code+'): '+r.stderr.slice(0,200)};}
 let meta;try{meta=JSON.parse(r.stdout)[0];}catch{return {available:false,imageMissing:false,files:false,reaVersion:null,adapterVersion:null,imageId:null,checkedAt:Date.now(),detail:'Unreadable image metadata.'};}
 const labels=meta?.Config?.Labels||{},reaVersion=labels['org.skydata.rea.version']??null,adapterVersion=labels['org.skydata.adapter.version']??null;
 const problems=[];if(!/^sha256:[a-f0-9]{64}$/.test(meta?.Id||''))problems.push('invalid image id');if(reaVersion!==REA_VERSION)problems.push('REA '+(reaVersion||'unknown')+' (needs '+REA_VERSION+')');if(adapterVersion!==ADAPTER_VERSION)problems.push('adapter '+(adapterVersion||'unknown')+' (needs '+ADAPTER_VERSION+')');
 if(files&&labels['org.skydata.rea.files']!=='1')problems.push('file analysis support missing');
 if(meta?.Config?.User!=='1000:1000')problems.push('image user is not 1000:1000');if(JSON.stringify(meta?.Config?.Entrypoint)!==JSON.stringify(['node','/opt/rea/adapter.mjs']))problems.push('unexpected entrypoint');
 const requestDeadline=labels['org.skydata.rea.request-deadline']==='1',outputFlush=labels['org.skydata.rea.output-flush']==='1';
 return {available:!problems.length,imageMissing:false,files:!problems.length&&files,image,reaVersion,adapterVersion,requestDeadline,outputFlush,imageId:meta?.Id??null,checkedAt:Date.now(),detail:problems.length?'Incompatible REA image '+image+': '+problems.join('; ')+'. Run Prepare_REA.cmd again.':'REA '+reaVersion+' · adapter '+adapterVersion+' · image '+String(meta.Id).slice(7,19)+(files?' · file analysis (.NET, archives, SQLite)':'')+(requestDeadline?' · extended time limit for website investigations':'')};
}
export async function executeRea(bundle,imageId,{dockerCommand,removeContainer,spawnProcess=spawn,limits=REA_LIMITS,report=()=>{},cleanEnv=()=>({})}){
 const name='skydata-rea-'+randomUUID(),phases=[],t0=Date.now();let stdout='',stderr='',bytes=0;const utf8=new StringDecoder('utf8');// one decoder: chunks may split multi-byte characters
 const created=await dockerCommand(reaContainerArgs(name,imageId,limits.memory,limits.tmpfs),limits.createMs);phases.push({phase:'container_create',command:'docker create (REA image, isolated)',ms:created.ms,ok:created.ok,...(created.ok?{}:{code:String(created.code),detail:(created.stderr||'').slice(0,600)})});
 let run=null,terminationPhase=null;
 if(created.ok){
  report('rea_analysis');
  run=await new Promise(resolve=>{let ended=false,reason='',stoppedAt=0,termination=null,child;const started=Date.now();
   const finish=(code,error)=>{if(ended)return;ended=true;clearTimeout(timer);resolve({code,error,reason,started,stoppedAt,termination,ended:Date.now()});};
   // As in test jobs: enforcement never waits for the docker CLI.
   const stop=why=>{if(reason)return;reason=why;stoppedAt=Date.now();
    const kill=Promise.resolve().then(()=>dockerCommand(['kill',name],limits.cleanupMs)).catch(e=>({ok:false,ms:Date.now()-stoppedAt,stderr:String(e?.message||e),code:'kill_failed'}));
    termination=Promise.race([kill,new Promise(r=>setTimeout(()=>r({ok:false,ms:limits.cleanupMs+1000,stderr:'docker kill did not return.',timedOut:true,code:'ETIMEDOUT'}),limits.cleanupMs+1000))]);
    try{child.kill();}catch{}setTimeout(()=>finish(null,true),limits.graceMs);};
   const timer=setTimeout(()=>stop('timeout'),limits.deadlineMs);
   try{child=spawnProcess('docker',['start','-a','-i',name],{stdio:['pipe','pipe','pipe'],windowsHide:true,shell:false,env:cleanEnv()});}catch(e){stderr='Docker start failed ('+(e.code||'unknown')+')';finish(null,true);return;}
   child.stdout.on('data',d=>{bytes+=d.length;if(bytes>limits.resultBytes){stop('output_limit');return;}stdout+=utf8.write(d);});
   child.stderr.on('data',d=>{if(stderr.length<65536)stderr+=d.toString().slice(0,65536-stderr.length);});
   child.on('error',e=>{stderr+='\nDocker start failed ('+(e.code||'unknown')+')';finish(null,true);});child.on('close',code=>finish(code,code===null));
   child.stdin.on('error',()=>{});child.stdin.end(limits.stdin??JSON.stringify({protocol:'skydata-rea-v1',operation:REA_OPERATION,files:bundle.files,...(Number.isInteger(limits.adapterDeadlineMs)?{deadlineMs:limits.adapterDeadlineMs}:{})}));
  });
  phases.push({phase:'container_run',command:'docker start -a -i (adapter → rea '+(limits.label||REA_OPERATION)+')',ms:(run.stoppedAt||run.ended)-run.started,ok:!run.reason&&!run.error,exitCode:run.code,...(run.reason?{code:run.reason,detail:run.reason==='timeout'?'Stopped at the '+limits.deadlineMs/1000+'-second REA analysis limit.':'Adapter output exceeded '+limits.resultBytes+' bytes.'}:run.error?{code:'container_error',detail:stderr.slice(-400)}:{})});
  if(run.termination){const k=await run.termination;terminationPhase={phase:'termination',command:'docker kill',ms:k.ms,ok:k.ok,detail:k.ok?'Container stop confirmed by docker kill.':'Termination NOT confirmed: docker kill '+(k.timedOut?'timed out':'failed ('+k.code+')')+'. The container may have kept running until cleanup removed it.'};}
 }
 if(terminationPhase)phases.push(terminationPhase);
 report('cleanup');const clean=await removeContainer(name,{dockerCommand});phases.push(clean);
 stdout+=utf8.end();let adapter=null;if(run&&!run.reason&&stdout){try{adapter=JSON.parse(stdout);}catch{adapter=null;}}
 let status;
 if(!created.ok||!run||run.error&&!run.reason)status='infrastructure_error';
 else if(run.reason)status=run.reason;
 else if(!adapter||typeof adapter.status!=='string'){status='infrastructure_error';phases.push({phase:'adapter_output',ok:false,detail:'No readable REA adapter output (container exit '+run.code+(run.code===137?': killed, likely out of memory':run.code===0&&Buffer.byteLength(stdout)===65536?': output cut off at 64 KB':'')+').'});}
 else status=adapter.status;
 if(!clean.ok)status='infrastructure_error';
 return {status,adapter,stderr:stderr.slice(0,4000),diagnostics:{runner:'rea-job/'+ADAPTER_VERSION,executionStatus:adapter?.status??(run?.reason||'not_started'),cleanupConfirmed:clean.ok,totalMs:Date.now()-t0,phases}};
}
