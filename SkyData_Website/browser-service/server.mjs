import http from 'node:http';
import {timingSafeEqual,createHash} from 'node:crypto';
import {publicUrl,resolvePublic} from './url-policy.mjs';
import {docker,remove,imageId} from './docker.mjs';
const token=process.env.SKYDATA_BROWSER_SERVICE_TOKEN;
if(!token||token.length<32)throw Error('Set a random backend authentication token of at least 32 characters.');
const jobs=new Map();let active=null;
const IMAGE='skydata-stagehand:4.2.1-a1';
async function body(req){let text='';for await(const c of req){text+=c;if(text.length>12000)throw Error('Input limit.');}return JSON.parse(text);}
async function run(job){
 const name='skydata-browser-'+job.id;active=job.id;job.name=name;job.status='running';
 const timer=setTimeout(()=>{job.status='timeout';void docker(['kill',job.name||name]).catch(()=>{});},180000);
 try{
  const browserImage=await imageId(IMAGE,{'org.skydata.stagehand.version':'4.2.1','org.skydata.browser.adapter':'1'},['node','worker.mjs']);
  await publicUrl(job.url);await resolvePublic(new URL(job.url).hostname);
  const opts=['create','-i','--name',name,'--network','skydata-browser-internal','--memory','1g','--cpus','1','--pids-limit','128','--read-only','--tmpfs','/tmp:rw,nosuid,nodev,size=256m,noexec','--cap-drop','ALL','--security-opt','no-new-privileges','--user','1000:1000','--log-driver','none'];
  // Values passed through stdin to docker are not shell-interpreted; no provider credentials in process arguments.
  const envInput=['GEMINI_API_KEY='+process.env.GEMINI_API_KEY,'GEMINI_FREE_TIER_CONFIRMED='+process.env.GEMINI_FREE_TIER_CONFIRMED,'STAGEHAND_MODEL='+(process.env.STAGEHAND_MODEL||'gemini-3.8-flash'),'HTTPS_PROXY=http://egress:8080','HTTP_PROXY=http://egress:8080','NO_PROXY=127.0.0.1,localhost'];
  // Docker's /dev/stdin env-file works on the Linux deployment host only.
  await docker([...opts,'--env-file','/dev/stdin','--pull','never',browserImage],{input:envInput.join('\n')});
  if(job.status==='cancelled'||job.status==='timeout')throw Error('Stopped before browser start.');
  let result;
  await docker(['start','-a','-i',name],{input:JSON.stringify({url:job.url,goal:job.goal}),timeout:185000,onLine:event=>{
   if(event.type==='phase'&&job.status==='running')job.phase=event.phase;
   if(event.type==='result')result=event;
   if(event.type==='error')job.error=event.error;
  }});
  if(job.status!=='running')throw Error('Job stopped.');
  const cleaned=await remove(name);
  if(!result||result.browserExecuted!==true||result.stagehandVersion!=='4.2.1'||!cleaned)throw Error('Browser execution or cleanup could not be confirmed.');
  result.cleanupConfirmed=cleaned;
  if(job.engine==='rea'){
   job.phase='Analyzing public JavaScript with REA';
   if(!result.scripts.length)throw Error('No eligible public JavaScript was captured for real REA analysis.');
   const reaImage=await imageId('skydata-rea:6.5.0-a1',{'org.skydata.rea.version':'6.5.0','org.skydata.adapter.version':'1'},['node','/opt/rea/adapter.mjs']);
   const reaName='skydata-browser-rea-'+job.id;job.name=reaName;
   try{
    await docker(['create','-i','--name',reaName,'--network','none','--memory','768m','--cpus','1','--pids-limit','64','--read-only','--tmpfs','/tmp:rw,noexec,nosuid,nodev,size=64m','--cap-drop','ALL','--security-opt','no-new-privileges','--user','1000:1000','--log-driver','none','--pull','never',reaImage]);
    const raw=await docker(['start','-a','-i',reaName],{input:JSON.stringify({protocol:'skydata-rea-v1',operation:'analyze-javascript-application',files:result.scripts.map(({path,text,sha256})=>({path,text,sha256}))}),timeout:160000,maxBytes:4*1024*1024});
    const rea=JSON.parse(raw);const expected=result.scripts.map(({path,sha256})=>({path,sha256}));
    const matched=JSON.stringify([...(rea.staged||[])].map(({path,sha256})=>({path,sha256})).sort((a,b)=>a.path.localeCompare(b.path)))===JSON.stringify(expected.sort((a,b)=>a.path.localeCompare(b.path)));
    if(!['complete','partial'].includes(rea.status)||rea.rea?.version!=='6.5.0'||rea.workspaceUnchanged!==true||!rea.findings||!matched)throw Error('REA result failed integrity checks.');
    result.rea={...rea,cleanupConfirmed:true};
   }finally{if(!await remove(reaName))throw Error('REA cleanup unconfirmed.');}
  }
  // Do not retain downloaded script source in job status/report payloads.
  result.scripts=result.scripts.map(({text,...meta})=>meta);
  if(job.status!=='running')throw Error('Stopped.');job.result=result;job.status='complete';job.phase='Evidence ready';
 }catch{if(job.status==='running')job.status='failed';job.error=job.error||'Investigation failed; no usable report was produced.';}
 finally{clearTimeout(timer);const cleaned=await remove(job.name||name).catch(()=>false);if(!cleaned){job.status='infrastructure_error';job.error='Container cleanup could not be confirmed.';}active=cleaned?null:job.id;job.finished=Date.now();}
}
const authorized=req=>{const actual=Buffer.from(req.headers.authorization||'');const expected=Buffer.from('Bearer '+token);return actual.length===expected.length&&timingSafeEqual(actual,expected);};
http.createServer(async(req,res)=>{
 const reply=(status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));};
 if(!authorized(req))return reply(401,{error:'Unauthorized.'});
 try{
  const url=new URL(req.url,'http://service');
  if(url.pathname==='/health'&&req.method==='GET'){
   // Administrative verification is also required; image presence is not a browser test.
   await imageId(IMAGE,{'org.skydata.stagehand.version':'4.2.1','org.skydata.browser.adapter':'1'},['node','worker.mjs']);
   const [network]=JSON.parse(await docker(['network','inspect','skydata-browser-internal']));if(network.Internal!==true)throw Error('Browser network must be internal.');
   if(process.env.SKYDATA_REA_VERIFIED==='true')await imageId('skydata-rea:6.5.0-a1',{'org.skydata.rea.version':'6.5.0','org.skydata.adapter.version':'1'},['node','/opt/rea/adapter.mjs']);
   return reply(200,{stagehandVersion:'4.2.1',configured:!!process.env.GEMINI_API_KEY&&process.env.GEMINI_FREE_TIER_CONFIRMED==='true',verified:process.env.SKYDATA_BROWSER_VERIFIED==='true',engines:['superpowers',...(process.env.SKYDATA_REA_VERIFIED==='true'?['rea']:[])],busy:!!active});
  }
  if(url.pathname==='/jobs'&&req.method==='POST'){
   if(process.env.SKYDATA_BROWSER_VERIFIED!=='true')return reply(503,{error:'Real isolated-browser verification is pending.'});
   const input=await body(req);publicUrl(input.url);
   if(!/^[a-f0-9-]{36}$/.test(input.id)||!['rea','superpowers'].includes(input.engine)||typeof input.goal!=='string'||!input.goal.trim()||input.goal.length>8000)throw Error('Invalid job.');
   if(input.engine==='rea'&&process.env.SKYDATA_REA_VERIFIED!=='true')return reply(503,{error:'Hosted REA image verification is pending.'});
   if(jobs.has(input.id))return reply(200,{id:input.id,status:jobs.get(input.id).status});
   if(active)return reply(429,{error:'One browser investigation at a time.'});
   for(const [id,j] of jobs)if(j.finished&&Date.now()-j.finished>3600000)jobs.delete(id);
   if(jobs.size>=50)return reply(429,{error:'History capacity reached. Retry later.'});
   const job={...input,status:'queued',phase:'Queued'};jobs.set(input.id,job);void run(job);return reply(202,{id:input.id,status:'queued'});
  }
  const id=url.pathname.split('/')[2];const job=jobs.get(id);if(!job)return reply(404,{error:'Job not found or expired.'});
  if(req.method==='DELETE'){
   if(['queued','running'].includes(job.status)){job.status='cancelled';if(job.name)await docker(['kill',job.name]).catch(()=>{});}return reply(200,{id,status:job.status});
  }
  if(req.method!=='GET')return reply(405,{error:'Method not supported.'});
  const {name,goal,url:target,...visible}=job;return reply(200,visible);
 }catch{return reply(400,{error:'Invalid request or blocked destination.'});}
}).listen(Number(process.env.PORT||8788),'127.0.0.1');
