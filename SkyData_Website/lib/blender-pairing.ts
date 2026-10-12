import { planBlender, validatePlan } from './blender-commands';
import type { SecretEnv } from './secret-store';
import { isSiteAdmin } from './site-admin';
import { validateScene } from './blender-scene';
const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers});
const hex=(bytes:Uint8Array)=>Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
const hash=async(value:string)=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))));
const random=(bytes:number)=>hex(crypto.getRandomValues(new Uint8Array(bytes)));
export const PAIRING_LIFETIME=10*60*1000;
function database(env:SecretEnv){if(!env.DB)throw Error('Blender connection storage unavailable');return env.DB;}
async function body(request:Request,maximum=1024){
 if(!request.headers.get('content-type')?.includes('application/json'))throw Error('Send JSON.');
 if(Number(request.headers.get('content-length')||0)>maximum)throw Error('Request is too large.');
 const reader=request.body?.getReader();if(!reader)throw Error('Send JSON.');let bytes=0,text='';const decoder=new TextDecoder();
 while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>maximum){await reader.cancel();throw Error('Request is too large.');}text+=decoder.decode(part.value,{stream:true});}
 const value=JSON.parse(text+decoder.decode());if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Send a JSON object.');return value as Record<string,unknown>;
}
async function limited(db:D1Database,key:string,maximum:number){
 const row=await db.prepare('INSERT INTO request_limits (id, window, count) VALUES (?, ?, 1) ON CONFLICT(id) DO UPDATE SET window=excluded.window, count=CASE WHEN request_limits.window=excluded.window THEN request_limits.count+1 ELSE 1 END RETURNING count').bind(key,Math.floor(Date.now()/60000)).first<{count:number}>();return !row||row.count>maximum;
}
export async function handleBlenderOwner(request:Request,env:SecretEnv,path:string){
 try{
  if(!await isSiteAdmin(request,env))return json({error:'Only the SkyData owner can connect Blender.'},403);
  const owner=request.headers.get('oai-authenticated-user-id')!,db=database(env),now=Date.now();
  if(path==='/api/blender/status'&&request.method==='GET'){
   const device=await db.prepare('SELECT id,name,created,last_seen,blender_ready,protocol_version FROM blender_device WHERE owner=?').bind(owner).first<{id:string;name:string;created:number;last_seen:number|null;blender_ready:number;protocol_version:number}>();
   const pairing=await db.prepare('SELECT expires FROM blender_pairing WHERE owner=? AND expires>?').bind(owner,now).first<{expires:number}>();
   const check=device?await db.prepare('SELECT id,created,expires,status,completed,snapshot FROM blender_scene_request WHERE owner=? AND device_id=?').bind(owner,device.id).first<{id:string;created:number;expires:number;status:string;completed:number|null;snapshot:string|null}>():null;
   const job=device?await db.prepare('SELECT id,created,expires,status,prompt,plan,completed,message FROM blender_command WHERE owner=? AND device_id=?').bind(owner,device.id).first<{id:string;created:number;expires:number;status:string;prompt:string;plan:string|null;completed:number|null;message:string|null}>():null;
   return json({command:job?{...job,status:['planning','pending','running'].includes(job.status)&&job.expires<=now?'expired':job.status,plan:job.plan?JSON.parse(job.plan):null}:null,device:device?{id:device.id,name:device.name,created:device.created,lastSeen:device.last_seen,online:device.last_seen!==null&&now-device.last_seen<90000,blenderReady:device.blender_ready===1,sceneReadSupported:device.protocol_version>=2,commandSupported:device.protocol_version>=5}:null,pairingExpires:pairing?.expires??null,sceneCheck:check?{id:check.id,created:check.created,expires:check.expires,status:check.status==='pending'&&check.expires<=now?'expired':check.status,completed:check.completed,scene:check.snapshot?JSON.parse(check.snapshot):null}:null});
  }
  if(request.method!=='POST')return json({error:'Use POST.'},405);
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Request origin is not allowed.'},403);
  if(await limited(db,'blender-owner:'+owner,10))return json({error:'Too many changes. Wait a minute and try again.'},429);
  if(path==='/api/blender/command'){
   let value:Record<string,unknown>;try{value=await body(request,8192);}catch{return json({error:'Send a modeling instruction.'},400);}
   const prompt=typeof value.prompt==='string'?value.prompt.trim():'';
   if(!prompt||prompt.length>4000)return json({error:'Use an instruction between 1 and 4,000 characters.'},400);
   const id=crypto.randomUUID(),expires=now+240000;
   const added=await db.prepare("INSERT INTO blender_command (owner,id,device_id,created,expires,status,prompt,plan,completed,message) SELECT owner,?,id,?,?,'planning',?,NULL,NULL,NULL FROM blender_device WHERE owner=? AND last_seen>? AND blender_ready=1 AND protocol_version>=5 ON CONFLICT(owner) DO UPDATE SET id=excluded.id,device_id=excluded.device_id,created=excluded.created,expires=excluded.expires,status='planning',prompt=excluded.prompt,plan=NULL,completed=NULL,message=NULL WHERE blender_command.status NOT IN ('planning','pending','running') OR blender_command.expires<=?").bind(id,now,expires,prompt,owner,now-90000,now).run();
   if(added.meta.changes!==1)return json({error:'A command is already waiting, or Blender needs add-on version 1.4. Open Blender and start the connection.'},409);
   try{
    const snapshot=await db.prepare("SELECT snapshot FROM blender_scene_request WHERE owner=? AND status='complete'").bind(owner).first<{snapshot:string|null}>();
    const plan=await planBlender(prompt,snapshot?.snapshot?JSON.parse(snapshot.snapshot):null,env,request.signal);
    const updated=await db.prepare("UPDATE blender_command SET status='pending',plan=?,expires=? WHERE owner=? AND id=? AND status='planning' AND EXISTS(SELECT 1 FROM blender_device WHERE owner=? AND id=blender_command.device_id)").bind(JSON.stringify(plan),Date.now()+120000,owner,id,owner).run();
    if(updated.meta.changes!==1)return json({error:'The PC connection changed. Send your instruction again.'},409);
    return json({queued:true,requestId:id,summary:plan.summary});
   }catch(error){
    const message=error instanceof Error&&!/decrypt|cipher|secret/i.test(error.message)?error.message.slice(0,300):'Could not prepare this command. Try again.';
    await db.prepare("UPDATE blender_command SET status='failed',completed=?,message=? WHERE owner=? AND id=? AND status='planning'").bind(Date.now(),message,owner,id).run();
    return json({error:message},502);
   }
  }
  if(path==='/api/blender/scene'){
   const pending=await db.prepare("SELECT id FROM blender_scene_request WHERE owner=? AND status='pending' AND expires>?").bind(owner,now).first();
   if(pending)return json({error:'A scene check is already waiting for Blender.'},409);
   const id=crypto.randomUUID(),expires=now+90000;
   const result=await db.prepare("INSERT INTO blender_scene_request (owner,id,device_id,created,expires,status,completed,snapshot) SELECT owner,?,id,?,?,'pending',NULL,NULL FROM blender_device WHERE owner=? AND last_seen>? AND blender_ready=1 AND protocol_version>=2 ON CONFLICT(owner) DO UPDATE SET id=excluded.id,device_id=excluded.device_id,created=excluded.created,expires=excluded.expires,status='pending',completed=NULL,snapshot=NULL WHERE blender_scene_request.status!='pending' OR blender_scene_request.expires<=?").bind(id,now,expires,owner,now-90000,now).run();
   if(result.meta.changes!==1)return json({error:'Open Blender and start the updated connector before checking the scene.'},409);
   return json({sceneCheck:{id,created:now,expires,status:'pending',completed:null,scene:null}});
  }
  if(path==='/api/blender/code'){
   const raw=random(12).toUpperCase(),expires=now+PAIRING_LIFETIME;
   await db.prepare('INSERT INTO blender_pairing (owner,code_hash,expires) VALUES (?,?,?) ON CONFLICT(owner) DO UPDATE SET code_hash=excluded.code_hash,expires=excluded.expires').bind(owner,await hash(raw),expires).run();
   return json({code:raw.match(/.{4}/g)!.join('-'),expires});
  }
  if(path==='/api/blender/cancel'){
   await db.prepare('DELETE FROM blender_pairing WHERE owner=?').bind(owner).run();return json({cancelled:true});
  }
  if(path==='/api/blender/disconnect'){
   await db.batch([db.prepare('DELETE FROM blender_device WHERE owner=?').bind(owner),db.prepare('DELETE FROM blender_pairing WHERE owner=?').bind(owner),db.prepare('DELETE FROM blender_scene_request WHERE owner=?').bind(owner),db.prepare('DELETE FROM blender_command WHERE owner=?').bind(owner)]);return json({disconnected:true});
  }
  return json({error:'Not found.'},404);
 }catch{console.warn('Blender owner connection request failed',{path});return json({error:'Blender connection is temporarily unavailable. Please try again.'},503);}
}
export async function handleBlenderDevice(request:Request,env:SecretEnv,path:string){
 try{
  if(request.method!=='POST')return json({error:'Use POST.'},405);
  const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Request origin is not allowed.'},403);
  const db=database(env),now=Date.now();
  if(path==='/api/blender/pair'){
   const ip=request.headers.get('cf-connecting-ip')||'unknown';
   if(await limited(db,'blender-pair:'+await hash(ip),12))return json({error:'Too many pairing attempts. Wait a minute and try again.'},429);
   let value:Record<string,unknown>;try{value=await body(request);}catch{return json({error:'Send a valid pairing code and PC name.'},400);}
   const code=typeof value.code==='string'?value.code.replace(/[\s-]/g,'').toUpperCase():'';
   const name=typeof value.name==='string'?value.name.trim():'';
   if(!/^[A-F0-9]{24}$/.test(code)||!name||name.length>80||/[\x00-\x1f]/.test(name))return json({error:'The pairing code or PC name is invalid.'},400);
   const codeHash=await hash(code),token=random(32),id=crypto.randomUUID();
   // D1 batch is transactional: exactly one redeemer can claim this code.
   const result=await db.batch([
    db.prepare('INSERT INTO blender_device (owner,id,token_hash,name,created,last_seen,blender_ready,protocol_version) SELECT owner,?,?,?,?,NULL,0,1 FROM blender_pairing WHERE code_hash=? AND expires>? ON CONFLICT(owner) DO UPDATE SET id=excluded.id,token_hash=excluded.token_hash,name=excluded.name,created=excluded.created,last_seen=NULL,blender_ready=0,protocol_version=1').bind(id,await hash(token),name,now,codeHash,now),
    db.prepare('DELETE FROM blender_pairing WHERE code_hash=? AND EXISTS (SELECT 1 FROM blender_device WHERE id=?)').bind(codeHash,id),
    db.prepare('DELETE FROM blender_scene_request WHERE owner=(SELECT owner FROM blender_device WHERE id=?)').bind(id),
    db.prepare('DELETE FROM blender_command WHERE owner=(SELECT owner FROM blender_device WHERE id=?)').bind(id)
   ]);
   if(result[0].meta.changes!==1)return json({error:'This pairing code expired or was already used.'},401);
   return json({paired:true,deviceId:id,token,heartbeatIntervalSeconds:30});
  }
  if(path==='/api/blender/heartbeat'||path==='/api/blender/result'){
   const authorization=request.headers.get('authorization')||'',match=/^Bearer ([a-f0-9]{64})$/.exec(authorization);
   if(!match)return json({error:'PC connection is not authorized.'},401);
   // Authenticate before accepting the larger scene payload.
   const device=await db.prepare('SELECT id,owner FROM blender_device WHERE token_hash=?').bind(await hash(match[1])).first<{id:string;owner:string}>();
   if(!device)return json({error:'PC connection is not authorized.'},401);
   if(await limited(db,'blender-device:'+device.id,60))return json({error:'Too many connection requests.'},429);
   let value:Record<string,unknown>;try{value=await body(request,path==='/api/blender/result'?65536:1024);}catch{return json({error:'Send a valid connection payload.'},400);}
   if(path==='/api/blender/result'&&value.kind==='modeling'){
    if(typeof value.requestId!=='string'||typeof value.success!=='boolean'||typeof value.message!=='string'||value.message.length>500)return json({error:'Invalid modeling result.'},400);
    const job=await db.prepare('SELECT status FROM blender_command WHERE owner=? AND device_id=? AND id=?').bind(device.owner,device.id,value.requestId).first<{status:string}>();
    if(!job)return json({error:'Command is no longer active.'},409);
    if(['complete','failed'].includes(job.status))return json({accepted:true});
    if(job.status!=='running')return json({error:'Command was not claimed.'},409);
    let snapshot:string|null=null;
    if(value.scene!==undefined){try{snapshot=JSON.stringify(validateScene(value.scene));}catch{return json({error:'Invalid scene snapshot.'},400);}}
    const result=await db.prepare("UPDATE blender_command SET status=?,completed=?,message=? WHERE owner=? AND device_id=? AND id=? AND status='running' AND EXISTS(SELECT 1 FROM blender_device WHERE id=? AND token_hash=?)").bind(value.success?'complete':'failed',now,value.message,device.owner,device.id,value.requestId,device.id,await hash(match[1])).run();
    if(result.meta.changes!==1)return json({error:'Command is no longer active.'},409);
    if(snapshot)await db.prepare("INSERT INTO blender_scene_request (owner,id,device_id,created,expires,status,completed,snapshot) VALUES (?,?,?,?,?,'complete',?,?) ON CONFLICT(owner) DO UPDATE SET id=excluded.id,device_id=excluded.device_id,created=excluded.created,expires=excluded.expires,status='complete',completed=excluded.completed,snapshot=excluded.snapshot WHERE blender_scene_request.status!='pending' OR blender_scene_request.expires<=?").bind(device.owner,crypto.randomUUID(),device.id,now,now,now,snapshot,now).run();
    return json({accepted:true});
   }
   if(path==='/api/blender/result'){
    if(typeof value.requestId!=='string')return json({error:'Send the scene request ID.'},400);
    const check=await db.prepare('SELECT status,expires FROM blender_scene_request WHERE owner=? AND device_id=? AND id=?').bind(device.owner,device.id,value.requestId).first<{status:string;expires:number}>();
    if(!check)return json({error:'Scene request is no longer active.'},409);
    if(check.status!=='pending')return json({accepted:true});
    if(check.expires<=now)return json({error:'Scene request has expired.'},409);
    let snapshot:string|null=null;
    if(value.error!==undefined){if(value.error!=='scene_unavailable')return json({error:'Invalid scene error.'},400);}
    else{try{snapshot=JSON.stringify(validateScene(value.scene));}catch{return json({error:'Scene snapshot is invalid.'},400);}}
    const result=await db.prepare("UPDATE blender_scene_request SET status=?,completed=?,snapshot=? WHERE owner=? AND device_id=? AND id=? AND status='pending' AND expires>? AND EXISTS(SELECT 1 FROM blender_device WHERE id=? AND token_hash=?)").bind(snapshot?'complete':'failed',now,snapshot,device.owner,device.id,value.requestId,now,device.id,await hash(match[1])).run();
    return result.meta.changes===1?json({accepted:true}):json({error:'Scene request is no longer active.'},409);
   }
   if(typeof value.blenderReady!=='boolean')return json({error:'Send Blender availability.'},400);
   if(value.protocolVersion!==undefined&&value.protocolVersion!==1&&value.protocolVersion!==2&&value.protocolVersion!==3&&value.protocolVersion!==4&&value.protocolVersion!==5)return json({error:'Unsupported connector version.'},400);
   const version=value.protocolVersion===5?5:value.protocolVersion===4?4:value.protocolVersion===3?3:value.protocolVersion===2?2:1;
   const result=await db.prepare('UPDATE blender_device SET last_seen=?,blender_ready=?,protocol_version=? WHERE token_hash=? RETURNING id').bind(now,value.blenderReady?1:0,version,await hash(match[1])).first<{id:string}>();
   if(!result)return json({error:'PC connection is not authorized.'},401);
   if(version>=5&&value.blenderReady){
    const job=await db.prepare("UPDATE blender_command SET status='running',expires=? WHERE owner=? AND device_id=? AND status='pending' AND expires>? AND EXISTS(SELECT 1 FROM blender_device WHERE id=? AND token_hash=?) RETURNING id,expires,plan").bind(now+120000,device.owner,device.id,now,device.id,await hash(match[1])).first<{id:string;expires:number;plan:string}>();
    if(job)return json({connected:true,deviceId:result.id,command:{id:job.id,type:'modeling',expires:job.expires,plan:validatePlan(JSON.parse(job.plan))}});
   }
   const command=version>=2&&value.blenderReady?await db.prepare("SELECT id,expires FROM blender_scene_request WHERE owner=? AND device_id=? AND status='pending' AND expires>?").bind(device.owner,device.id,now).first<{id:string;expires:number}>():null;
   return json({connected:true,deviceId:result.id,...(command?{command:{id:command.id,type:'scene-read',expires:command.expires}}:{})});
  }
  return json({error:'Not found.'},404);
 }catch{console.warn('Blender PC connection request failed',{path});return json({error:'Blender connection is temporarily unavailable. Please try again.'},503);}
}
