import {PROJECT_PREFIX,validBundle,projectScript} from './project.mjs';
import {spawn,execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,chmod} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createInterface} from 'node:readline/promises';
import {pathToFileURL} from 'node:url';
const SITE='https://skydata-ai.skyrease123.chatgpt.site';
const dir=join(homedir(),'.skydata-runner'),configPath=join(dir,'connection.json');
const OUTPUT_LIMIT=60000;
let activeContainer=null;
const display=text=>String(text).replace(/[\x00-\x08\x0b-\x1f\x7f]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
function cleanEnv(){return Object.fromEntries(Object.entries(process.env).filter(([key])=>['PATH','SYSTEMROOT','WINDIR','TEMP','TMP','HOME','USERPROFILE','APPDATA','LOCALAPPDATA'].includes(key.toUpperCase())));}
export function containerArgs(name,image){return ['run','--name',name,'--pull','never','--rm','--network','none','--memory','256m','--memory-swap','256m','--cpus','1','--pids-limit','64','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--user','1000:1000','--tmpfs','/tmp:rw,noexec,nosuid,size=16m','--log-driver','none','-i',image,'node','-'];}
export function validJob(job){if(!job||!/^[a-f0-9-]{36}$/.test(job.id)||typeof job.code!=='string'||!Number.isFinite(job.expires)||job.expires<=Date.now())return false;if(job.code.startsWith(PROJECT_PREFIX)){try{return Buffer.byteLength(job.code)<=900000&&validBundle(JSON.parse(job.code.slice(PROJECT_PREFIX.length)));}catch{return false;}}return Buffer.byteLength(job.code)>0&&Buffer.byteLength(job.code)<=16000;}
function command(args){return execFileSync('docker',args,{stdio:['ignore','pipe','pipe'],encoding:'utf8',timeout:15000,maxBuffer:100000,windowsHide:true,env:cleanEnv()}).trim();}
function removeContainer(name){try{command(['rm','-f',name]);}catch(e){if(!String(e.stderr||'').includes('No such container'))throw e;}}
function pinnedImage(){
 const info=JSON.parse(command(['info','--format','{{json .}}']));if(info.OSType!=='linux')throw Error('Docker must use Linux containers.');
 const image=JSON.parse(command(['image','inspect','node:24-alpine']))[0];if(!/^sha256:[a-f0-9]{64}$/.test(image?.Id)||image.Config?.Labels?.['skydata.untrusted'])throw Error('Valid local Node image not found.');return image.Id;
}
export async function execute(code,image,{spawnProcess=spawn,remove=async name=>removeContainer(name),timeoutMs=10000}={}){
 const started=Date.now(),name='skydata-test-'+randomUUID();let reason='',stdout='',stderr='',bytes=0,child,timer;
 activeContainer=name;
 const result=await new Promise(resolve=>{
 let ended=false;const finish=(exitCode,error)=>{if(ended)return;ended=true;clearTimeout(timer);resolve({status:reason||error||[125,126,127].includes(exitCode)?'infrastructure_error':exitCode===0?'passed':'failed',exitCode,stdout,stderr,durationMs:Date.now()-started});};
 try{child=spawnProcess('docker',containerArgs(name,image),{stdio:['pipe','pipe','pipe'],windowsHide:true,shell:false,env:cleanEnv()});}catch{finish(null,true);return;}
 const stop=why=>{if(reason)return;reason=why;child.kill();setTimeout(()=>finish(null,true),1000).unref();};
 const collect=(which,data)=>{bytes+=data.length;if(bytes>OUTPUT_LIMIT){stop('output_limit');return;}if(which==='out')stdout+=data.toString();else stderr+=data.toString();};
 child.stdout.on('data',d=>collect('out',d));child.stderr.on('data',d=>collect('err',d));child.on('error',()=>finish(null,true));child.on('close',code=>finish(code,code===null));child.stdin.on('error',()=>{});child.stdin.end(code);timer=setTimeout(()=>stop('timeout'),timeoutMs);
 });
 if(reason)result.status=reason;
 try{await remove(name);}catch{result.status='infrastructure_error';result.stderr+='\nContainer cleanup could not be confirmed. Stop the runner and check Docker Desktop.';}
 activeContainer=null;
 // --rm may already have removed the container; only that missing-container
 // response is accepted. Other cleanup failures never report a passing test.
 return result;
}
async function protectFile(){
 if(process.platform==='win32'){
 const who=execFileSync('whoami',[],{encoding:'utf8',windowsHide:true}).trim();
 execFileSync('icacls',[configPath,'/inheritance:r','/grant:r',who+':F'],{stdio:'ignore',windowsHide:true});
 }else await chmod(configPath,0o600);
}
async function api(path,body,token){
 const r=await fetch(SITE+'/api/engineering-runner/'+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(15000)});
 const d=await r.json();if(!r.ok)throw Error(d.error||'Site request failed ('+r.status+').');return d;
}
async function pair(){const rl=createInterface({input:process.stdin,output:process.stdout});try{
 const code=(await rl.question('Paste the pairing code from SkyData: ')).trim();if(!/^[a-f0-9]{64}$/.test(code))throw Error('Invalid code.');
 const d=await api('pair',{code});if(!/^[a-f0-9]{64}$/.test(d.token))throw Error('Site returned an invalid token.');
 await mkdir(dir,{recursive:true,mode:0o700});await writeFile(configPath,JSON.stringify({token:d.token,expires:d.expires}),{mode:0o600});await protectFile();console.log('Paired. Now run: node runner.mjs start');
 }finally{rl.close();}}
async function start(){
 const config=JSON.parse(await readFile(configPath,'utf8'));if(!/^[a-f0-9]{64}$/.test(config.token)||config.expires<=Date.now())throw Error('Pair again; connection expired.');await protectFile();const image=pinnedImage();
 const rl=createInterface({input:process.stdin,output:process.stdout});console.log('SkyData HP runner connected. Keep this window open. Ctrl+C stops it.');
 try{for(;;){
 const {job}=await api('poll',{ready:true,protocol:2},config.token);
 if(job){if(!validJob(job))throw Error('Invalid or expired test; execution stopped.');const project=job.code.startsWith(PROJECT_PREFIX)?JSON.parse(job.code.slice(PROJECT_PREFIX.length)):null;console.log('\nTEST REQUEST '+job.id+'\n'+(project?'PROJECT: '+display(project.name)+'\nTest entry: '+project.entry+'\n'+project.files.map(f=>'\nFILE: '+f.path+'\n'+display(f.text)).join('\n'):display(job.code))+'\n');console.log('Approve within 10 minutes. Execution still stops after 10 seconds.');
 const answer=await rl.question('Run this exact JavaScript in Docker? Type yes: ');
 const result=answer.trim().toLowerCase()==='yes'&&job.expires>Date.now()?await execute(project?projectScript(project):job.code,image):{status:'declined',exitCode:null,stdout:'',stderr:'Declined or expired before local approval.',durationMs:0};
 if(project&&result.exitCode===124)result.status='timeout';console.log('Result: '+result.status+'\n'+display(result.stdout)+'\n'+display(result.stderr));await api('result',{id:job.id,result},config.token);if(result.status==='infrastructure_error')throw Error('Runner stopped after an infrastructure error.');
 }
 await new Promise(resolve=>setTimeout(resolve,5000));
 }}finally{rl.close();}
}
async function selftest(){const image=pinnedImage();for(const [code,expected] of [["require('node:assert/strict').equal(2+2,4); console.log('PASS');",'passed'],["require('node:assert/strict').equal(2+2,5);",'failed'],['while(true){}','timeout']]){const r=await execute(code,image);console.log(JSON.stringify(r));if(r.status!==expected)throw Error('Expected '+expected+', got '+r.status);}console.log('Self-test passed: success, failing assertion, and timeout.');}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{if(activeContainer)try{removeContainer(activeContainer);}catch{console.error('Could not confirm cleanup. Check Docker Desktop for '+activeContainer);}process.exit(130);});
 const mode=process.argv[2];try{if(mode==='pair')await pair();else if(mode==='start')await start();else if(mode==='selftest')await selftest();else console.log('Use: node runner.mjs pair | start | selftest');}catch(e){console.error(e.message);process.exitCode=1;}
}
