import {loadRunnerProject,selectRunnerFiles,loadProposalBundle,type BundleFile} from './runner-project';
import {PROJECT_PREFIX} from '../runner-package/project.mjs';
import {isSiteAdmin} from './site-admin';
import type {SecretEnv} from './secret-store';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const json=(v:unknown,status=200)=>Response.json(v,{status,headers});
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),x=>x.toString(16).padStart(2,'0')).join('');
const FINAL=['passed','failed','timeout','declined','infrastructure_error','output_limit'],PHASES=['docker_check','container_start','executing','cleanup'],HISTORY_KEEP=50;
async function schema(db:D1Database){
 for(const sql of [
 'CREATE TABLE IF NOT EXISTS engineering_runner_pair (owner TEXT PRIMARY KEY, code_hash TEXT UNIQUE NOT NULL, expires INTEGER NOT NULL)',
 'CREATE TABLE IF NOT EXISTS engineering_runner_device (owner TEXT PRIMARY KEY, id TEXT UNIQUE NOT NULL, token_hash TEXT UNIQUE NOT NULL, expires INTEGER NOT NULL, last_seen INTEGER NOT NULL, ready INTEGER NOT NULL)',
 'CREATE TABLE IF NOT EXISTS engineering_runner_job (owner TEXT PRIMARY KEY, id TEXT UNIQUE NOT NULL, device TEXT NOT NULL, code TEXT NOT NULL, status TEXT NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL, result TEXT)',
 // Test history keeps fingerprints and results after the job row is reused; source text itself is not kept.
 'CREATE TABLE IF NOT EXISTS engineering_runner_history (id TEXT PRIMARY KEY, owner TEXT NOT NULL, created INTEGER NOT NULL, kind TEXT NOT NULL, project_id TEXT, project_name TEXT, proposal_id TEXT, entry TEXT, files TEXT NOT NULL, payload_sha256 TEXT NOT NULL, status TEXT NOT NULL, phase TEXT, phase_at INTEGER, claimed INTEGER, completed INTEGER, result TEXT)',
 'CREATE INDEX IF NOT EXISTS engineering_runner_history_owner ON engineering_runner_history(owner, created)',
 'CREATE TABLE IF NOT EXISTS engineering_runner_health (owner TEXT PRIMARY KEY, version TEXT, docker_ok INTEGER, docker_checked INTEGER, docker_detail TEXT, updated INTEGER NOT NULL)'
 ])await db.prepare(sql).run();
}
async function body(req:Request){
 if(!req.headers.get('content-type')?.includes('application/json'))throw Error('Send JSON.');
 const reader=req.body?.getReader();if(!reader)throw Error('Send JSON.');let raw='',size=0;const decoder=new TextDecoder();
 try{for(;;){const p=await reader.read();if(p.done)break;size+=p.value.length;if(size>90000){await reader.cancel();throw Error('Request too large.');}raw+=decoder.decode(p.value,{stream:true});}}finally{reader.releaseLock();}
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
 const added=await db.prepare("INSERT INTO engineering_runner_job(owner,id,device,code,status,created,expires,result) SELECT owner,?,id,?,'pending',?,?,NULL FROM engineering_runner_device WHERE owner=? AND ready>=? AND last_seen>? AND expires>? ON CONFLICT(owner) DO UPDATE SET id=excluded.id,device=excluded.device,code=excluded.code,status='pending',created=excluded.created,expires=excluded.expires,result=NULL WHERE engineering_runner_job.status NOT IN ('pending','running') OR engineering_runner_job.expires<=?").bind(id,payload,now,now+600000,owner,projectTest?2:1,now-30000,now,now).run();
 if(added.meta.changes!==1)return json({error:'Runner offline, not ready, or a test is already waiting.'},409);
 const fingerprint=await hash(payload);
 await db.batch([db.prepare("INSERT INTO engineering_runner_history(id,owner,created,kind,project_id,project_name,proposal_id,entry,files,payload_sha256,status) VALUES(?,?,?,?,?,?,?,?,?,?,'waiting_for_hp')").bind(id,owner,now,record.kind,record.projectId??null,record.projectName??null,record.proposalId??null,record.entry??null,JSON.stringify(record.files),fingerprint),
  db.prepare('DELETE FROM engineering_runner_history WHERE owner=? AND id NOT IN (SELECT id FROM engineering_runner_history WHERE owner=? ORDER BY created DESC LIMIT ?)').bind(owner,owner,HISTORY_KEEP)]);
 return json({queued:true,id,fingerprint});
}
export async function handleRunnerOwner(req:Request,env:SecretEnv,path:string){
 try{
 if(!await isSiteAdmin(req,env))return json({error:'Owner access required.'},403);
 const db=env.DB!;await schema(db);const owner=req.headers.get('oai-authenticated-user-id')!,now=Date.now();
 if(path==='/api/engineering-runner/project'&&req.method==='GET'){try{return json(await loadRunnerProject(env,owner,new URL(req.url).searchParams.get('id')||''));}catch(e){return json({error:e instanceof Error?e.message:'Project unavailable.'},400);}}
 if(path==='/api/engineering-runner/status'&&req.method==='GET'){
 const device=await db.prepare('SELECT id,last_seen,ready,expires FROM engineering_runner_device WHERE owner=?').bind(owner).first<{id:string;last_seen:number;ready:number;expires:number}>();
 const job=await db.prepare('SELECT id,status,created,expires,result FROM engineering_runner_job WHERE owner=?').bind(owner).first<{id:string;status:string;created:number;expires:number;result:string|null}>();
 const health=await db.prepare('SELECT version,docker_ok,docker_checked,docker_detail,updated FROM engineering_runner_health WHERE owner=?').bind(owner).first<{version:string|null;docker_ok:number|null;docker_checked:number|null;docker_detail:string|null;updated:number}>();
 const rows=(await db.prepare('SELECT id,created,kind,project_id,project_name,proposal_id,entry,files,payload_sha256,status,phase,phase_at,claimed,completed,result FROM engineering_runner_history WHERE owner=? ORDER BY created DESC LIMIT 20').bind(owner).all<Record<string,unknown>>()).results;
 const live=job&&['pending','running'].includes(job.status)&&job.expires>now?job.id:null;
 const history=rows.map(r=>({id:r.id,created:r.created,kind:r.kind,projectId:r.project_id,projectName:r.project_name,proposalId:r.proposal_id,entry:r.entry,files:JSON.parse(String(r.files)),fingerprint:r.payload_sha256,status:FINAL.includes(String(r.status))||r.id===live?r.status:'expired',phase:r.phase,phaseAt:r.phase_at,claimed:r.claimed,completed:r.completed,result:r.result?JSON.parse(String(r.result)):null}));
 return json({device:device?{online:device.expires>now&&device.last_seen>now-30000,lastSeen:device.last_seen,ready:device.ready>=1,projectReady:device.ready===2,expires:device.expires,runnerVersion:health?.version||null,docker:health?.docker_checked?{ok:health.docker_ok===1,checkedAt:health.docker_checked,detail:health.docker_detail}:null}:null,job:job?{...job,status:['pending','running'].includes(job.status)&&job.expires<=now?'expired':job.status,result:job.result?JSON.parse(job.result):null,phase:history.find(h=>h.id===job.id)?.phase??null}:null,history});
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
 if(req.method!=='POST')return json({error:'Use POST.'},405);if(!env.DB)return json({error:'Storage unavailable.'},503);const db=env.DB;await schema(db);const now=Date.now();
 if(path==='/api/engineering-runner/pair'){
 const ip=req.headers.get('cf-connecting-ip')||'shared';if(await limited(db,'runner-pair:'+await hash(ip),6))return json({error:'Too many pairing attempts.'},429);
 const b=await body(req);if(typeof b.code!=='string'||!/^[a-f0-9]{64}$/.test(b.code))return json({error:'Invalid pairing code.'},400);
 const pair=await db.prepare('DELETE FROM engineering_runner_pair WHERE code_hash=? AND expires>? RETURNING owner').bind(await hash(b.code),now).first<{owner:string}>();if(!pair)return json({error:'Pairing code expired or already used.'},401);
 const token=random(),id=crypto.randomUUID();await db.batch([db.prepare('INSERT INTO engineering_runner_device VALUES(?,?,?,?,?,0) ON CONFLICT(owner) DO UPDATE SET id=excluded.id,token_hash=excluded.token_hash,expires=excluded.expires,last_seen=excluded.last_seen,ready=0').bind(pair.owner,id,await hash(token),now+7*86400000,now),db.prepare('DELETE FROM engineering_runner_job WHERE owner=?').bind(pair.owner)]);return json({token,expires:now+7*86400000});
 }
 const bearer=req.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/);if(!bearer)return json({error:'Unauthorized.'},401);const tokenHash=await hash(bearer[1]);
 const device=await db.prepare('SELECT owner,id FROM engineering_runner_device WHERE token_hash=? AND expires>?').bind(tokenHash,now).first<{owner:string;id:string}>();if(!device)return json({error:'Runner expired or revoked.'},401);
 if(await limited(db,'runner-device:'+device.id,30))return json({error:'Slow down.'},429);
 const b=await body(req);
 if(path==='/api/engineering-runner/poll'){
 if(typeof b.ready!=='boolean')return json({error:'Send readiness.'},400);await db.prepare('UPDATE engineering_runner_device SET last_seen=?,ready=? WHERE id=? AND token_hash=?').bind(now,b.ready?(b.protocol===2?2:1):0,device.id,tokenHash).run();
 // v2.2+ reports when it last verified Docker; older runners only checked once at start-up.
 const version=typeof b.version==='string'&&/^[0-9.]{1,10}$/.test(b.version)?b.version:null,dock=b.docker&&typeof b.docker==='object'&&typeof b.docker.ok==='boolean'&&Number.isFinite(b.docker.checkedAt)?b.docker:null;
 await db.prepare('INSERT INTO engineering_runner_health(owner,version,docker_ok,docker_checked,docker_detail,updated) VALUES(?,?,?,?,?,?) ON CONFLICT(owner) DO UPDATE SET version=excluded.version,docker_ok=excluded.docker_ok,docker_checked=excluded.docker_checked,docker_detail=excluded.docker_detail,updated=excluded.updated').bind(device.owner,version,dock?(dock.ok?1:0):null,dock&&dock.checkedAt>0?Math.min(Number(dock.checkedAt),now):null,dock&&typeof dock.detail==='string'?dock.detail.slice(0,300):null,now).run();
 const job=b.ready?await db.prepare("UPDATE engineering_runner_job SET status='running',expires=? WHERE owner=? AND device=? AND status='pending' AND expires>? AND (instr(code,?)!=1 OR ?=2) AND EXISTS(SELECT 1 FROM engineering_runner_device WHERE id=? AND token_hash=? AND expires>?) RETURNING id,code,expires").bind(now+600000,device.owner,device.id,now,PROJECT_PREFIX,b.protocol===2?2:1,device.id,tokenHash,now).first<{id:string}>():null;
 if(job)await db.prepare("UPDATE engineering_runner_history SET status='awaiting_local_approval',claimed=? WHERE id=? AND owner=?").bind(now,job.id,device.owner).run();
 return json({job});
 }
 if(path==='/api/engineering-runner/progress'){
 if(typeof b.id!=='string'||!PHASES.includes(b.phase))return json({error:'Invalid progress.'},400);
 const updated=await db.prepare("UPDATE engineering_runner_history SET phase=?,phase_at=? WHERE id=? AND owner=? AND EXISTS(SELECT 1 FROM engineering_runner_job WHERE owner=? AND device=? AND id=? AND status='running' AND expires>?)").bind(b.phase,now,b.id,device.owner,device.owner,device.id,b.id,now).run();
 return updated.meta.changes===1?json({accepted:true}):json({error:'No running test with that id.'},409);
 }
 if(path==='/api/engineering-runner/result'){
 const r=b.result;if(typeof b.id!=='string'||!r||!['passed','failed','timeout','declined','infrastructure_error','output_limit'].includes(r.status)||!(r.exitCode===null||Number.isInteger(r.exitCode)&&r.exitCode>=0&&r.exitCode<=255)||typeof r.stdout!=='string'||typeof r.stderr!=='string'||r.stdout.length+r.stderr.length>65000||!Number.isFinite(r.durationMs)||r.durationMs<0||r.durationMs>60000||r.status==='passed'&&r.exitCode!==0)return json({error:'Invalid test result.'},400);
 const diag=diagnostics(r.diagnostics);if(diag===false)return json({error:'Invalid runner diagnostics.'},400);
 const stored=await db.prepare('SELECT code FROM engineering_runner_job WHERE owner=? AND device=? AND id=?').bind(device.owner,device.id,b.id).first<{code:string}>();
 let project=null;if(stored?.code.startsWith(PROJECT_PREFIX)){const bundle=JSON.parse(stored.code.slice(PROJECT_PREFIX.length));project={name:bundle.name,entry:bundle.entry,paths:bundle.files.map((f:{path:string})=>f.path),sha256:await hash(stored.code)};}
 const result=JSON.stringify({project,status:r.status,exitCode:r.exitCode,stdout:r.stdout,stderr:r.stderr,durationMs:r.durationMs,...(diag?{diagnostics:diag}:{}),evidence:'Reported by paired HP runner; not independently verified by the server.'});
 const updated=await db.prepare("UPDATE engineering_runner_job SET status=?,result=?,code='' WHERE owner=? AND device=? AND id=? AND status='running' AND expires>? AND EXISTS(SELECT 1 FROM engineering_runner_device WHERE id=? AND token_hash=? AND expires>?)").bind(r.status,result,device.owner,device.id,b.id,now,device.id,tokenHash,now).run();
 if(updated.meta.changes===1)await db.prepare('UPDATE engineering_runner_history SET status=?,completed=?,result=?,phase=NULL WHERE id=? AND owner=?').bind(r.status,now,result,b.id,device.owner).run();
 return updated.meta.changes===1?json({accepted:true}):json({error:'Test expired, completed, or connection revoked.'},409);
 }
 return json({error:'Not found.'},404);
 }catch{return json({error:'Runner request could not complete.'},503);}
}
