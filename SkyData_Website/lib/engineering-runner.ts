import {BROWSER_PREFIX,BROWSER_VERSION,BROWSER_ADAPTER,browserSchema} from './hp-browser';
import {loadRunnerProject,selectRunnerFiles,loadProposalBundle,type BundleFile} from './runner-project';
import {PROJECT_PREFIX} from '../runner-package/project.mjs';
import {isSiteAdmin} from './site-admin';
import {buildReaSelection,REA_PREFIX,REA_VERSION,REA_ADAPTER,REA_OPERATION,REA_SELECTION_LIMITS} from './rea-selection';
import {reaResultChecks,reaRunUsable} from './rea-explain';
const reaKey=(projectId:string,id:string)=>'projects/'+projectId+'/rea/'+id+'.json';
import type {SecretEnv} from './secret-store';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const json=(v:unknown,status=200)=>Response.json(v,{status,headers});
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),x=>x.toString(16).padStart(2,'0')).join('');
const REA_STATUSES=['complete','partial','failed','timeout','output_limit','declined','unavailable','rejected','incompatible','workspace_changed','infrastructure_error'];
const FINAL=['passed','failed','timeout','declined','infrastructure_error','output_limit',...REA_STATUSES,'invalid_result','cancelled','cancel_requested'],PHASES=['docker_check','container_start','executing','cleanup','rea_analysis','browser_launching','browser_connecting','browser_inspecting','browser_functionality','browser_collecting','browser_technologies'],HISTORY_KEEP=50;
export async function runnerSchema(db:D1Database){
 await browserSchema(db);
 for(const sql of [
 'CREATE TABLE IF NOT EXISTS engineering_runner_pair (owner TEXT PRIMARY KEY, code_hash TEXT UNIQUE NOT NULL, expires INTEGER NOT NULL)',
 'CREATE TABLE IF NOT EXISTS engineering_runner_device (owner TEXT PRIMARY KEY, id TEXT UNIQUE NOT NULL, token_hash TEXT UNIQUE NOT NULL, expires INTEGER NOT NULL, last_seen INTEGER NOT NULL, ready INTEGER NOT NULL)',
 'CREATE TABLE IF NOT EXISTS engineering_runner_job (owner TEXT PRIMARY KEY, id TEXT UNIQUE NOT NULL, device TEXT NOT NULL, code TEXT NOT NULL, status TEXT NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL, result TEXT)',
 // Test history keeps fingerprints and results after the job row is reused; source text itself is not kept.
 'CREATE TABLE IF NOT EXISTS engineering_runner_history (id TEXT PRIMARY KEY, owner TEXT NOT NULL, created INTEGER NOT NULL, kind TEXT NOT NULL, project_id TEXT, project_name TEXT, proposal_id TEXT, entry TEXT, files TEXT NOT NULL, payload_sha256 TEXT NOT NULL, status TEXT NOT NULL, phase TEXT, phase_at INTEGER, claimed INTEGER, completed INTEGER, result TEXT)',
 'CREATE INDEX IF NOT EXISTS engineering_runner_history_owner ON engineering_runner_history(owner, created)',
 // REA capability as last reported by the HP runner (v2.3+): prepared image, REA and adapter versions.
 'CREATE TABLE IF NOT EXISTS engineering_runner_rea (owner TEXT PRIMARY KEY, available INTEGER NOT NULL, rea_version TEXT, adapter_version TEXT, image_id TEXT, detail TEXT, checked INTEGER, updated INTEGER NOT NULL)',
 'CREATE TABLE IF NOT EXISTS engineering_runner_health (owner TEXT PRIMARY KEY, version TEXT, docker_ok INTEGER, docker_checked INTEGER, docker_detail TEXT, updated INTEGER NOT NULL)'
 ])await db.prepare(sql).run();
}
async function body(req:Request,max=90000){
 if(!req.headers.get('content-type')?.includes('application/json'))throw Error('Send JSON.');
 const reader=req.body?.getReader();if(!reader)throw Error('Send JSON.');let raw='',size=0;const decoder=new TextDecoder();
 try{for(;;){const p=await reader.read();if(p.done)break;size+=p.value.length;if(size>max){await reader.cancel();throw Error('Request too large.');}raw+=decoder.decode(p.value,{stream:true});}}finally{reader.releaseLock();}
 const b=JSON.parse(raw+decoder.decode());if(!b||Array.isArray(b)||typeof b!=='object')throw Error('Send an object.');return b;
}
async function limited(db:D1Database,key:string,n:number){const row=await db.prepare('INSERT INTO request_limits(id,window,count) VALUES(?,?,1) ON CONFLICT(id) DO UPDATE SET window=excluded.window,count=CASE WHEN request_limits.window=excluded.window THEN request_limits.count+1 ELSE 1 END RETURNING count').bind(key,Math.floor(Date.now()/60000)).first<{count:number}>();return !row||row.count>n;}
type Diagnostics={runner:string;executionStatus?:string;cleanupConfirmed?:boolean;totalMs?:number;phases:{phase:string;command?:string;ms:number;ok:boolean;code?:string;detail?:string}[]};
// Runner-reported phase timings, bounded and reduced to known fields. Still self-reported by the HP.
function diagnostics(d:unknown):Diagnostics|null|false{
 if(d===undefined)return null;const v=d as Record<string,unknown>;if(!v||typeof v!=='object'||Array.isArray(v)||JSON.stringify(v).length>12000||typeof v.runner!=='string'||v.runner.length>20)return false;
 const phases=v.phases===undefined?[]:v.phases;if(!Array.isArray(phases)||phases.length>12)return false;
 const str=(x:unknown,n:number)=>typeof x==='string'?x.slice(0,n):undefined;
 if(phases.some(p=>!p||typeof p.phase!=='string'||typeof p.ok!=='boolean'||!Number.isFinite(p.ms)||p.ms<0))return false;
 return {runner:v.runner,executionStatus:str(v.executionStatus,40),cleanupConfirmed:typeof v.cleanupConfirmed==='boolean'?v.cleanupConfirmed:undefined,totalMs:Number.isFinite(v.totalMs)?Number(v.totalMs):undefined,phases:phases.map(p=>({phase:p.phase.slice(0,40),command:str(p.command,120),ms:Math.round(p.ms),ok:p.ok,code:str(p.code,60),detail:str(p.detail,800)}))};
}
async function queue(db:D1Database,owner:string,payload:string,projectTest:boolean,record:{kind:string;projectId?:string;projectName?:string;proposalId?:string;entry?:string;files:BundleFile[]|{path:string;sha256:string;bytes:number;source:string}[]}){
 const now=Date.now(),id=crypto.randomUUID();
 const added=await db.prepare("INSERT INTO engineering_runner_job(owner,id,device,code,status,created,expires,result) SELECT owner,?,id,?,'pending',?,?,NULL FROM engineering_runner_device WHERE owner=? AND ready>=? AND last_seen>? AND expires>? ON CONFLICT(owner) DO UPDATE SET id=excluded.id,device=excluded.device,code=excluded.code,status='pending',created=excluded.created,expires=excluded.expires,result=NULL WHERE engineering_runner_job.status NOT IN ('pending','running','receiving_browser') OR engineering_runner_job.expires<=?").bind(id,payload,now,now+600000,owner,projectTest?2:1,now-30000,now,now).run();
 if(added.meta.changes!==1)return json({error:'Runner offline, not ready, or a test is already waiting.'},409);
 const fingerprint=await hash(payload);
 await db.batch([db.prepare("INSERT INTO engineering_runner_history(id,owner,created,kind,project_id,project_name,proposal_id,entry,files,payload_sha256,status) VALUES(?,?,?,?,?,?,?,?,?,?,'waiting_for_hp')").bind(id,owner,now,record.kind,record.projectId??null,record.projectName??null,record.proposalId??null,record.entry??null,JSON.stringify(record.files),fingerprint),
  db.prepare('DELETE FROM engineering_runner_history WHERE owner=? AND id NOT IN (SELECT id FROM engineering_runner_history WHERE owner=? ORDER BY created DESC LIMIT ?)').bind(owner,owner,HISTORY_KEEP)]);
 return json({queued:true,id,fingerprint});
}
export async function handleRunnerOwner(req:Request,env:SecretEnv,path:string){
 try{
 if(!await isSiteAdmin(req,env))return json({error:'Owner access required.'},403);
 const db=env.DB!;await runnerSchema(db);const owner=req.headers.get('oai-authenticated-user-id')!,now=Date.now();
 if(path==='/api/engineering-runner/project'&&req.method==='GET'){try{return json(await loadRunnerProject(env,owner,new URL(req.url).searchParams.get('id')||''));}catch(e){return json({error:e instanceof Error?e.message:'Project unavailable.'},400);}}
 if(path==='/api/engineering-runner/status'&&req.method==='GET'){
 const device=await db.prepare('SELECT id,last_seen,ready,expires FROM engineering_runner_device WHERE owner=?').bind(owner).first<{id:string;last_seen:number;ready:number;expires:number}>();
 const job=await db.prepare('SELECT id,status,created,expires,result FROM engineering_runner_job WHERE owner=?').bind(owner).first<{id:string;status:string;created:number;expires:number;result:string|null}>();
 const health=await db.prepare('SELECT version,docker_ok,docker_checked,docker_detail,updated FROM engineering_runner_health WHERE owner=?').bind(owner).first<{version:string|null;docker_ok:number|null;docker_checked:number|null;docker_detail:string|null;updated:number}>();
 const rea=await db.prepare('SELECT available,rea_version,adapter_version,image_id,detail,checked FROM engineering_runner_rea WHERE owner=?').bind(owner).first<{available:number;rea_version:string|null;adapter_version:string|null;image_id:string|null;detail:string|null;checked:number|null}>();
 const rows=(await db.prepare('SELECT id,created,kind,project_id,project_name,proposal_id,entry,files,payload_sha256,status,phase,phase_at,claimed,completed,result FROM engineering_runner_history WHERE owner=? ORDER BY created DESC LIMIT 20').bind(owner).all<Record<string,unknown>>()).results;
 const live=job&&['pending','running'].includes(job.status)&&job.expires>now?job.id:null;
 const history=rows.map(r=>({id:r.id,created:r.created,kind:r.kind,projectId:r.project_id,projectName:r.project_name,proposalId:r.proposal_id,entry:r.entry,files:JSON.parse(String(r.files)),fingerprint:r.payload_sha256,status:FINAL.includes(String(r.status))||r.id===live?r.status:'expired',phase:r.phase,phaseAt:r.phase_at,claimed:r.claimed,completed:r.completed,result:r.result?JSON.parse(String(r.result)):null}));
 return json({device:device?{online:device.expires>now&&device.last_seen>now-30000,lastSeen:device.last_seen,ready:device.ready>=1,projectReady:device.ready===2,expires:device.expires,runnerVersion:health?.version||null,docker:health?.docker_checked?{ok:health.docker_ok===1,checkedAt:health.docker_checked,detail:health.docker_detail}:null,rea:rea?{available:rea.available===1,reaVersion:rea.rea_version,adapterVersion:rea.adapter_version,imageId:rea.image_id,detail:rea.detail,checkedAt:rea.checked}:null}:null,reaExpected:{reaVersion:REA_VERSION,adapterVersion:REA_ADAPTER},job:job?{...job,status:['pending','running'].includes(job.status)&&job.expires<=now?'expired':job.status,result:job.result?JSON.parse(job.result):null,phase:history.find(h=>h.id===job.id)?.phase??null}:null,history});
 }
 if(path==='/api/engineering-runner/rea-run'&&req.method==='GET'){
 const id=new URL(req.url).searchParams.get('id')||'';if(!/^[a-f0-9-]{36}$/.test(id))return json({error:'Choose an REA analysis.'},400);
 const row=await db.prepare("SELECT project_id,status,result FROM engineering_runner_history WHERE id=? AND owner=? AND kind='rea'").bind(id,owner).first<{project_id:string|null;status:string;result:string|null}>();if(!row)return json({error:'Analysis not found.'},404);
 const stored=row.project_id&&env.FILES?await env.FILES.get(reaKey(row.project_id,id)):null;
 const analysis=stored?await stored.json<Record<string,unknown>>():null;
 return json({id,status:row.status,summary:row.result?JSON.parse(row.result):null,analysis,usable:reaRunUsable(row.status,analysis)});
 }
 if(req.method!=='POST')return json({error:'Use POST.'},405);
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Origin rejected.'},403);
 if(await limited(db,'runner-owner:'+owner,12))return json({error:'Wait a minute and try again.'},429);
 if(path==='/api/engineering-runner/code'){
 const code=random(),expires=now+600000;await db.prepare('INSERT INTO engineering_runner_pair VALUES(?,?,?) ON CONFLICT(owner) DO UPDATE SET code_hash=excluded.code_hash,expires=excluded.expires').bind(owner,await hash(code),expires).run();return json({code,expires});
 }
 if(path==='/api/engineering-runner/disconnect'){
 await db.batch([db.prepare('DELETE FROM engineering_runner_device WHERE owner=?').bind(owner),db.prepare('DELETE FROM engineering_runner_pair WHERE owner=?').bind(owner),db.prepare('DELETE FROM engineering_runner_job WHERE owner=?').bind(owner),db.prepare('DELETE FROM engineering_runner_health WHERE owner=?').bind(owner)]);return json({disconnected:true});
 }
 if(path==='/api/engineering-runner/rea-preview'||path==='/api/engineering-runner/rea-analyze'){
 const b=await body(req,200000),send=path.endsWith('/rea-analyze');
 if(Object.keys(b).some(k=>!['projectId','paths','approved','fingerprint'].includes(k))||send&&(b.approved!==true||typeof b.fingerprint!=='string'))return json({error:'Preview the exact files, then approve that preview.'},400);
 let sel;try{sel=await buildReaSelection(env,owner,b.projectId,b.paths);}catch(e){return json({error:e instanceof Error?e.message:'Project unavailable.'},400);}
 const payloadBytes=new TextEncoder().encode(sel.payload).length,tooLarge=payloadBytes>REA_SELECTION_LIMITS.payloadBytes;
 const view={project:sel.project,operation:REA_OPERATION,reaVersion:REA_VERSION,adapterVersion:REA_ADAPTER,files:sel.files.map(({text:_t,...f})=>f),excluded:sel.excluded,totalBytes:sel.totalBytes,payloadBytes,omitted:sel.omitted,fingerprint:sel.fingerprint,limits:REA_SELECTION_LIMITS};
 if(!send)return json({...view,...(tooLarge?{error:'The encoded request is too large; select fewer files.'}:{})});
 if(b.fingerprint!==sel.fingerprint)return json({error:'The files changed since your preview. Preview again and re-approve.'},409);
 if(!sel.files.length)return json({error:'No analyzable files remain after exclusions.'},400);
 if(tooLarge)return json({error:'The encoded request is too large; select fewer files.'},400);
 const cap=await db.prepare('SELECT available FROM engineering_runner_rea WHERE owner=?').bind(owner).first<{available:number}>();
 if(cap?.available!==1)return json({error:'The HP runner has not reported a verified REA '+REA_VERSION+' image (adapter '+REA_ADAPTER+'). Run Prepare_REA on the HP and restart the runner.'},409);
 return queue(db,owner,sel.payload,true,{kind:'rea',projectId:sel.project.id,projectName:sel.project.name,entry:REA_OPERATION,files:sel.files.map(f=>({path:f.path,sha256:f.sha256,bytes:f.bytes,source:'original'}))});
 }
 if(path==='/api/engineering-runner/proposal-preview'||path==='/api/engineering-runner/proposal-test'){
 const b=await body(req),send=path.endsWith('/proposal-test');
 if(Object.keys(b).some(k=>!['projectId','proposalId','paths','entry','approved'].includes(k))||send&&b.approved!==true)return json({error:'Review and approve the exact files first.'},400);
 let loaded;try{loaded=await loadProposalBundle(env,owner,b.projectId,b.proposalId,b.paths,b.entry);}catch(e){return json({error:e instanceof Error?e.message:'Proposal unavailable.'},400);}
 const payload=PROJECT_PREFIX+JSON.stringify(loaded.bundle);if(new TextEncoder().encode(payload).length>900000)return json({error:'Selected source is too large for a test.'},400);
 if(!send)return json({files:loaded.meta,analysis:loaded.analysis,sources:loaded.bundle.files,entry:loaded.bundle.entry,fingerprint:await hash(payload)});
 return queue(db,owner,payload,true,{kind:'proposal',projectId:b.projectId,projectName:loaded.bundle.name,proposalId:b.proposalId,entry:String(loaded.bundle.entry),files:loaded.meta});
 }
 if(path==='/api/engineering-runner/test'||path==='/api/engineering-runner/project-test'){
 const b=await body(req);let payload='';const projectTest=path.endsWith('/project-test');let record:Parameters<typeof queue>[4];
 if(projectTest){if(b.approved!==true||typeof b.projectId!=='string'||Object.keys(b).some(k=>!['projectId','paths','entry','approved'].includes(k)))return json({error:'Review and approve the selected project files.'},400);try{const bundle=selectRunnerFiles(await loadRunnerProject(env,owner,b.projectId),b.paths,b.entry);payload=PROJECT_PREFIX+JSON.stringify(bundle);if(new TextEncoder().encode(payload).length>900000)throw Error('Selected source is too large for a test.');record={kind:'project',projectId:b.projectId,projectName:bundle.name,entry:bundle.entry as string,files:await Promise.all(bundle.files.map(async f=>({path:f.path,sha256:await hash(f.text),bytes:new TextEncoder().encode(f.text).length,source:'upload_index'})))};}catch(e){return json({error:e instanceof Error?e.message:'Project unavailable.'},400);}}
 else if(b.approved!==true||typeof b.code!=='string'||!b.code.trim()||new TextEncoder().encode(b.code).length>16000||Object.keys(b).some(k=>!['code','approved'].includes(k)))return json({error:'Approve a JavaScript snippet up to 16 KB.'},400);
 if(!projectTest){payload=b.code;record={kind:'snippet',files:[{path:'(snippet)',sha256:await hash(b.code),bytes:new TextEncoder().encode(b.code).length,source:'snippet'}]};}
 return queue(db,owner,payload,projectTest,record!);
 }
 return json({error:'Not found.'},404);
 }catch{return json({error:'Runner request could not complete.'},503);}
}
export async function handleRunnerDevice(req:Request,env:SecretEnv,path:string){
 try{
 if(req.method!=='POST')return json({error:'Use POST.'},405);if(!env.DB)return json({error:'Storage unavailable.'},503);const db=env.DB;await runnerSchema(db);const now=Date.now();
 if(path==='/api/engineering-runner/pair'){
 const ip=req.headers.get('cf-connecting-ip')||'shared';if(await limited(db,'runner-pair:'+await hash(ip),6))return json({error:'Too many pairing attempts.'},429);
 const b=await body(req);if(typeof b.code!=='string'||!/^[a-f0-9]{64}$/.test(b.code))return json({error:'Invalid pairing code.'},400);
 const pair=await db.prepare('DELETE FROM engineering_runner_pair WHERE code_hash=? AND expires>? RETURNING owner').bind(await hash(b.code),now).first<{owner:string}>();if(!pair)return json({error:'Pairing code expired or already used.'},401);
 const token=random(),id=crypto.randomUUID();await db.batch([db.prepare('INSERT INTO engineering_runner_device VALUES(?,?,?,?,?,0) ON CONFLICT(owner) DO UPDATE SET id=excluded.id,token_hash=excluded.token_hash,expires=excluded.expires,last_seen=excluded.last_seen,ready=0').bind(pair.owner,id,await hash(token),now+7*86400000,now),db.prepare('DELETE FROM engineering_runner_job WHERE owner=?').bind(pair.owner)]);return json({token,expires:now+7*86400000});
 }
 const bearer=req.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/);if(!bearer)return json({error:'Unauthorized.'},401);const tokenHash=await hash(bearer[1]);
 const device=await db.prepare('SELECT owner,id FROM engineering_runner_device WHERE token_hash=? AND expires>?').bind(tokenHash,now).first<{owner:string;id:string}>();if(!device)return json({error:'Runner expired or revoked.'},401);
 if(await limited(db,'runner-device:'+device.id,30))return json({error:'Slow down.'},429);
 const b=await body(req,['/api/engineering-runner/rea-result','/api/engineering-runner/browser-result'].includes(path)?8000000:90000);
 if(path==='/api/engineering-runner/poll'){
 if(typeof b.ready!=='boolean')return json({error:'Send readiness.'},400);await db.prepare('UPDATE engineering_runner_device SET last_seen=?,ready=? WHERE id=? AND token_hash=?').bind(now,b.ready?(b.protocol===2?2:1):0,device.id,tokenHash).run();
 // v2.2+ reports when it last verified Docker; older runners only checked once at start-up.
 const version=typeof b.version==='string'&&/^[0-9.]{1,10}$/.test(b.version)?b.version:null,dock=b.docker&&typeof b.docker==='object'&&typeof b.docker.ok==='boolean'&&Number.isFinite(b.docker.checkedAt)?b.docker:null;
 await db.prepare('INSERT INTO engineering_runner_health(owner,version,docker_ok,docker_checked,docker_detail,updated) VALUES(?,?,?,?,?,?) ON CONFLICT(owner) DO UPDATE SET version=excluded.version,docker_ok=excluded.docker_ok,docker_checked=excluded.docker_checked,docker_detail=excluded.docker_detail,updated=excluded.updated').bind(device.owner,version,dock?(dock.ok?1:0):null,dock&&dock.checkedAt>0?Math.min(Number(dock.checkedAt),now):null,dock&&typeof dock.detail==='string'?dock.detail.slice(0,300):null,now).run();
 // A job is handed to a runner only if its last poll reported a verified image with the expected REA and adapter versions.
 const cap=b.capabilities&&typeof b.capabilities==='object'?b.capabilities.rea:null,reaCapable=!!cap&&cap.available===true&&cap.reaVersion===REA_VERSION&&cap.adapterVersion===REA_ADAPTER;
 if(cap&&typeof cap==='object')await db.prepare('INSERT INTO engineering_runner_rea(owner,available,rea_version,adapter_version,image_id,detail,checked,updated) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(owner) DO UPDATE SET available=excluded.available,rea_version=excluded.rea_version,adapter_version=excluded.adapter_version,image_id=excluded.image_id,detail=excluded.detail,checked=excluded.checked,updated=excluded.updated').bind(device.owner,reaCapable?1:0,typeof cap.reaVersion==='string'?cap.reaVersion.slice(0,20):null,typeof cap.adapterVersion==='string'?cap.adapterVersion.slice(0,10):null,typeof cap.imageId==='string'?cap.imageId.slice(0,80):null,typeof cap.detail==='string'?cap.detail.slice(0,300):null,Number.isFinite(cap.checkedAt)?Math.min(Number(cap.checkedAt),now):null,now).run();
 else await db.prepare('DELETE FROM engineering_runner_rea WHERE owner=?').bind(device.owner).run();
 const browser=b.capabilities?.browser, browserCapable=!!browser&&browser.available===true&&browser.stagehandVersion===BROWSER_VERSION&&browser.adapterVersion===BROWSER_ADAPTER&&browser.selfTestPassed===true;
 if(browser&&typeof browser==='object')await db.prepare('INSERT INTO engineering_runner_browser(owner,available,stagehand_version,adapter_version,rea,detail,checked,updated) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(owner) DO UPDATE SET available=excluded.available,stagehand_version=excluded.stagehand_version,adapter_version=excluded.adapter_version,rea=excluded.rea,detail=excluded.detail,checked=excluded.checked,updated=excluded.updated').bind(device.owner,browserCapable?1:0,BROWSER_VERSION,BROWSER_ADAPTER,reaCapable?1:0,typeof browser.detail==='string'?browser.detail.slice(0,300):null,Number.isFinite(browser.checkedAt)?Math.min(browser.checkedAt,now):null,now).run();
 else await db.prepare('DELETE FROM engineering_runner_browser WHERE owner=?').bind(device.owner).run();
 const cancellation=await db.prepare("SELECT j.id FROM engineering_runner_job j JOIN engineering_runner_history h ON j.id=h.id WHERE j.owner=? AND j.device=? AND j.status='running' AND h.kind='website' AND h.status='cancel_requested'").bind(device.owner,device.id).first<{id:string}>();
 const job=b.ready?await db.prepare("UPDATE engineering_runner_job SET status='running',expires=? WHERE owner=? AND device=? AND status='pending' AND expires>? AND (instr(code,?)!=1 OR ?=2) AND (instr(code,?)!=1 OR ?=1) AND (instr(code,?)!=1 OR ?=1) AND EXISTS(SELECT 1 FROM engineering_runner_device WHERE id=? AND token_hash=? AND expires>?) RETURNING id,code,expires").bind(now+600000,device.owner,device.id,now,PROJECT_PREFIX,b.protocol===2?2:1,REA_PREFIX,reaCapable?1:0,BROWSER_PREFIX,browserCapable?1:0,device.id,tokenHash,now).first<{id:string}>():null;
 if(job)await db.prepare("UPDATE engineering_runner_history SET status='awaiting_local_approval',claimed=? WHERE id=? AND owner=?").bind(now,job.id,device.owner).run();
 return json({job,cancelId:cancellation?.id||null});
 }
 if(path==='/api/engineering-runner/browser-control'){
  await db.prepare('UPDATE engineering_runner_device SET last_seen=? WHERE id=? AND token_hash=?').bind(now,device.id,tokenHash).run();
  const row=await db.prepare("SELECT h.status,j.expires FROM engineering_runner_history h JOIN engineering_runner_job j ON j.id=h.id WHERE j.owner=? AND j.device=? AND j.id=? AND j.code LIKE ? AND j.status='running'").bind(device.owner,device.id,b.id,BROWSER_PREFIX+'%').first<{status:string;expires:number}>();
  if(!row)return json({cancel:true});return json({cancel:row.status==='cancel_requested'||row.expires<=now});
 }
 if(path==='/api/engineering-runner/browser-result'){
  const stored=await db.prepare("SELECT j.code,h.status AS history_status FROM engineering_runner_job j JOIN engineering_runner_history h ON h.id=j.id WHERE j.owner=? AND j.device=? AND j.id=? AND j.status='running' AND j.expires>?").bind(device.owner,device.id,b.id,now).first<{code:string;history_status:string}>();
  if(!stored?.code.startsWith(BROWSER_PREFIX))return json({error:'No running browser request with that id.'},409);
  const result=b.result;if(!result||!['complete','failed','timeout','output_limit','declined','unavailable','cancelled','infrastructure_error'].includes(result.status))return json({error:'Invalid browser result.'},400);
  const expected=JSON.parse(stored.code.slice(BROWSER_PREFIX.length));let e=result.evidence,status=stored.history_status==='cancel_requested'?'cancelled':result.status;
  if(status==='complete'){
   const valid=e?.browserExecuted===true&&e?.cleanupConfirmed===true&&e?.stagehandVersion===BROWSER_VERSION&&Array.isArray(e.pages)&&e.pages.length>0&&e.pages.length<=3&&e.requestFingerprint===await hash(JSON.stringify({url:expected.url,goal:expected.goal,engine:expected.engine}))&&Array.isArray(e.scripts)&&e.scripts.every((f:{text?:unknown;path:string;sha256:string})=>f.text===undefined&&typeof f.path==='string'&&/^[a-f0-9]{64}$/.test(f.sha256||''));
   const rea=e?.rea,staged=Array.isArray(rea?.staged)?rea.staged.map((f:{path:string;sha256:string})=>f.path+'\0'+f.sha256).sort():null,files=e?.scripts?.map((f:{path:string;sha256:string})=>f.path+'\0'+f.sha256).sort();
   if(!valid||expected.engine==='rea'&&(!rea?.findings||!['complete','partial'].includes(rea.status)||rea.workspaceUnchanged!==true||rea.cleanupConfirmed!==true||rea.rea?.version!=='6.4.0'||rea.rea?.operation!=='analyze-javascript-application'||!files?.length||JSON.stringify(staged)!==JSON.stringify(files)))status='invalid_result';
  }
  if(result.cleanupConfirmed!==true&&['complete','timeout','cancelled','failed'].includes(status))status='infrastructure_error';
  const receipt=await db.prepare("UPDATE engineering_runner_job SET status='receiving_browser' WHERE owner=? AND device=? AND id=? AND status='running' AND expires>? AND EXISTS(SELECT 1 FROM engineering_runner_device WHERE id=? AND token_hash=? AND expires>?)").bind(device.owner,device.id,b.id,now,device.id,tokenHash,now).run();
  if(receipt.meta.changes!==1)return json({error:'Browser request completed, expired, or revoked.'},409);
  if(status==='complete'&&env.FILES)await env.FILES.put('engineering-browser/'+device.owner+'/'+b.id+'/evidence.json',JSON.stringify(e));
  const summary=JSON.stringify({status,error:status==='invalid_result'?'Browser result failed integrity checks.':typeof result.error==='string'?result.error.slice(0,400):undefined,cleanupConfirmed:result.cleanupConfirmed===true,evidence:'Reported by the paired HP browser runner; not independently verified by the website.'});
  await db.batch([db.prepare("UPDATE engineering_runner_job SET status=?,result=?,code='' WHERE owner=? AND device=? AND id=? AND status='receiving_browser'").bind(status,summary,device.owner,device.id,b.id),db.prepare('UPDATE engineering_runner_history SET status=?,completed=?,result=?,phase=NULL WHERE id=? AND owner=?').bind(status,now,summary,b.id,device.owner),db.prepare('DELETE FROM engineering_browser_relay WHERE id=? AND owner=?').bind(b.id,device.owner)]);
  return json({accepted:true,status,usable:status==='complete'});
 }
 if(path==='/api/engineering-runner/progress'){
 if(typeof b.id!=='string'||!PHASES.includes(b.phase))return json({error:'Invalid progress.'},400);
 const updated=await db.prepare("UPDATE engineering_runner_history SET phase=?,phase_at=? WHERE id=? AND owner=? AND EXISTS(SELECT 1 FROM engineering_runner_job WHERE owner=? AND device=? AND id=? AND status='running' AND expires>?)").bind(b.phase,now,b.id,device.owner,device.owner,device.id,b.id,now).run();
 return updated.meta.changes===1?json({accepted:true}):json({error:'No running test with that id.'},409);
 }
 if(path==='/api/engineering-runner/rea-result'){
 const r=b.result,diag=r&&diagnostics(r.diagnostics);
 if(typeof b.id!=='string'||!r||typeof r!=='object'||!REA_STATUSES.includes(r.status)||!diag||r.adapter!==null&&(typeof r.adapter!=='object'||r.adapter.adapter!==REA_ADAPTER)||typeof r.stderr!=='string'||r.stderr.length>8000)return json({error:'Invalid REA result.'},400);
 const stored=await db.prepare('SELECT code FROM engineering_runner_job WHERE owner=? AND device=? AND id=? AND status=\'running\'').bind(device.owner,device.id,b.id).first<{code:string}>();
 if(!stored?.code.startsWith(REA_PREFIX))return json({error:'No running REA analysis with that id.'},409);
 const approved=JSON.parse(stored.code.slice(REA_PREFIX.length)).files.map((f:{path:string;sha256:string})=>f.path+'\0'+f.sha256).sort();
 const staged=Array.isArray(r.adapter?.staged)?r.adapter.staged.map((f:{path:string;sha256:string})=>f.path+'\0'+f.sha256).sort():null;
 const stagedMatchesApproval=staged?JSON.stringify(staged)===JSON.stringify(approved):null;
 const f=r.adapter?.findings,history=await db.prepare('SELECT project_id FROM engineering_runner_history WHERE id=? AND owner=?').bind(b.id,device.owner).first<{project_id:string|null}>();
 const count=(x:{total?:number}|undefined)=>typeof x?.total==='number'?x.total:null;
 // A reported complete/partial analysis becomes usable findings only if every integrity check holds; otherwise it is
 // recorded (diagnostics preserved) as invalid_result and is never eligible for AI explanation.
 const failedChecks=['complete','partial'].includes(r.status)?reaResultChecks({reaVersion:r.adapter?.rea?.version,operation:r.adapter?.rea?.operation,stagedMatchesApproval,workspaceUnchanged:r.adapter?.workspaceUnchanged,cleanupConfirmed:diag.cleanupConfirmed,hasFindings:!!f&&typeof f==='object'}):[];
 const status=failedChecks.length?'invalid_result':r.status,usable=['complete','partial'].includes(status);
 const summary={status,reportedStatus:r.status,usable,failedChecks,reaVersion:typeof r.adapter?.rea?.version==='string'?r.adapter.rea.version:null,operation:REA_OPERATION,evidenceId:typeof f?.evidenceId==='string'?f.evidenceId:null,coverage:typeof f?.graphCoverage?.status==='string'?f.graphCoverage.status:null,counts:f?{modules:count(f.modules),imports:count(f.imports),endpoints:count(f.endpoints),endpointCalls:count(f.endpointCalls),storage:count(f.storage),entrypoints:count(f.entrypoints),unknowns:count(f.unknowns)}:null,stagedMatchesApproval,workspaceUnchanged:typeof r.adapter?.workspaceUnchanged==='boolean'?r.adapter.workspaceUnchanged:null,diagnostics:diag,evidence:'Reported by the paired HP runner (REA adapter '+REA_ADAPTER+'); not independently verified by the server.'};
 const updated=await db.prepare("UPDATE engineering_runner_job SET status=?,result=?,code='' WHERE owner=? AND device=? AND id=? AND status='running' AND expires>? AND EXISTS(SELECT 1 FROM engineering_runner_device WHERE id=? AND token_hash=? AND expires>?)").bind(status,JSON.stringify(summary),device.owner,device.id,b.id,now,device.id,tokenHash,now).run();
 if(updated.meta.changes!==1)return json({error:'Analysis expired, completed, or connection revoked.'},409);
 if(history?.project_id&&env.FILES)await env.FILES.put(reaKey(history.project_id,b.id),JSON.stringify({...summary,adapter:r.adapter,stderr:r.stderr,receivedAt:now}),{httpMetadata:{contentType:'application/json'}});
 await db.prepare('UPDATE engineering_runner_history SET status=?,completed=?,result=?,phase=NULL WHERE id=? AND owner=?').bind(status,now,JSON.stringify(summary),b.id,device.owner).run();
 return json({accepted:true,status,usable,failedChecks,stagedMatchesApproval});
 }
 if(path==='/api/engineering-runner/result'){
 const r=b.result;if(typeof b.id!=='string'||!r||!['passed','failed','timeout','declined','infrastructure_error','output_limit'].includes(r.status)||!(r.exitCode===null||Number.isInteger(r.exitCode)&&r.exitCode>=0&&r.exitCode<=255)||typeof r.stdout!=='string'||typeof r.stderr!=='string'||r.stdout.length+r.stderr.length>65000||!Number.isFinite(r.durationMs)||r.durationMs<0||r.durationMs>60000||r.status==='passed'&&r.exitCode!==0)return json({error:'Invalid test result.'},400);
 const diag=diagnostics(r.diagnostics);if(diag===false)return json({error:'Invalid runner diagnostics.'},400);
 const stored=await db.prepare('SELECT code FROM engineering_runner_job WHERE owner=? AND device=? AND id=?').bind(device.owner,device.id,b.id).first<{code:string}>();
 if(stored?.code.startsWith(BROWSER_PREFIX))return json({error:'Browser results require the browser result endpoint.'},409);
 if(stored?.code.startsWith(REA_PREFIX))return json({error:'REA analysis results use the REA result endpoint.'},409);
 let project=null;if(stored?.code.startsWith(PROJECT_PREFIX)){const bundle=JSON.parse(stored.code.slice(PROJECT_PREFIX.length));project={name:bundle.name,entry:bundle.entry,paths:bundle.files.map((f:{path:string})=>f.path),sha256:await hash(stored.code)};}
 const result=JSON.stringify({project,status:r.status,exitCode:r.exitCode,stdout:r.stdout,stderr:r.stderr,durationMs:r.durationMs,...(diag?{diagnostics:diag}:{}),evidence:'Reported by paired HP runner; not independently verified by the server.'});
 const updated=await db.prepare("UPDATE engineering_runner_job SET status=?,result=?,code='' WHERE owner=? AND device=? AND id=? AND status='running' AND expires>? AND EXISTS(SELECT 1 FROM engineering_runner_device WHERE id=? AND token_hash=? AND expires>?)").bind(r.status,result,device.owner,device.id,b.id,now,device.id,tokenHash,now).run();
 if(updated.meta.changes===1)await db.prepare('UPDATE engineering_runner_history SET status=?,completed=?,result=?,phase=NULL WHERE id=? AND owner=?').bind(r.status,now,result,b.id,device.owner).run();
 return updated.meta.changes===1?json({accepted:true}):json({error:'Test expired, completed, or connection revoked.'},409);
 }
 return json({error:'Not found.'},404);
 }catch{return json({error:'Runner request could not complete.'},503);}
}
