// Bundle lib/blender-pairing.ts to ESM, then pass its absolute path as argument 1.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {handleBlenderOwner,handleBlenderDevice}=await import(pathToFileURL(process.argv[2]).href);
const sqlite=new DatabaseSync(':memory:');
for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+file,'utf8'));
sqlite.exec("INSERT INTO site_admin (id,owner) VALUES ('owner','owner-id')");
class Prepared{
 constructor(sql,args=[]){this.sql=sql;this.args=args;}
 bind(...args){return new Prepared(this.sql,args);}
 async first(){return sqlite.prepare(this.sql).get(...this.args)??null;}
 async run(){const r=sqlite.prepare(this.sql).run(...this.args);return {success:true,meta:{changes:Number(r.changes)}};}
}
const env={DB:{prepare:sql=>new Prepared(sql),batch:async statements=>{
 sqlite.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}
}}};
const origin='https://skydata.test';
function owner(path,method='GET',user='owner-id',requestOrigin=origin,payload={}){return handleBlenderOwner(new Request(origin+path,{method,headers:{'oai-authenticated-user-id':user,origin:requestOrigin,'content-type':'application/json'},...(method==='POST'?{body:JSON.stringify(payload)}:{})}),env,path);}
function pc(path,payload,token){return handleBlenderDevice(new Request(origin+path,{method:'POST',headers:{'content-type':'application/json','cf-connecting-ip':'127.0.0.1',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(payload)}),env,path);}
assert.equal((await owner('/api/blender/status','GET','member-id')).status,403);
assert.equal((await owner('/api/blender/code','POST','owner-id','https://other.test')).status,403);
const first=await (await owner('/api/blender/code','POST')).json();
assert.match(first.code,/^[A-F0-9]{4}(?:-[A-F0-9]{4}){5}$/);
const second=await (await owner('/api/blender/code','POST')).json();
assert.equal((await pc('/api/blender/pair',{code:first.code,name:'HP'})).status,401);
const pairing=await pc('/api/blender/pair',{code:second.code,name:'HP'});assert.equal(pairing.status,200);const credentials=await pairing.json();
assert.equal((await pc('/api/blender/pair',{code:second.code,name:'Other PC'})).status,401);
const saved=sqlite.prepare('SELECT * FROM blender_device').get();assert.notEqual(saved.token_hash,credentials.token);
assert.equal((await pc('/api/blender/heartbeat',{blenderReady:true},'0'.repeat(64))).status,401);
assert.equal((await pc('/api/blender/heartbeat',{blenderReady:true},credentials.token)).status,200);
const status=await (await owner('/api/blender/status')).json();assert.equal(status.device.online,true);assert.equal(status.device.blenderReady,true);assert.equal(status.pairingExpires,null);assert.equal('token' in status.device,false);

// An old connector remains paired but cannot receive scene requests.
assert.equal((await owner('/api/blender/scene','POST')).status,409);
assert.equal((await pc('/api/blender/heartbeat',{blenderReady:true,protocolVersion:2},credentials.token)).status,200);
assert.equal((await owner('/api/blender/scene','POST','member-id')).status,403);
assert.equal((await owner('/api/blender/scene','POST','owner-id','https://other.test')).status,403);
const requested=await (await owner('/api/blender/scene','POST')).json();
assert.equal(requested.sceneCheck.status,'pending');
assert.equal((await owner('/api/blender/scene','POST')).status,409);
const pulse=await (await pc('/api/blender/heartbeat',{blenderReady:true,protocolVersion:2},credentials.token)).json();
assert.equal(pulse.command.id,requested.sceneCheck.id);assert.equal(pulse.command.type,'scene-read');
assert.equal((await pc('/api/blender/result',{requestId:pulse.command.id,scene:{}},credentials.token)).status,400);
const scene={name:'Scene',totalObjects:1,selectedObjects:1,activeObject:'Cube',frame:1,truncated:false,objects:[{name:'Cube',type:'MESH',location:[0,0,0],rotation:[0,0,0],scale:[1,1,1],selected:true}]};
assert.equal((await pc('/api/blender/result',{requestId:pulse.command.id,scene},'0'.repeat(64))).status,401);
assert.equal((await pc('/api/blender/result',{requestId:pulse.command.id,scene},credentials.token)).status,200);
assert.equal((await pc('/api/blender/result',{requestId:pulse.command.id,scene},credentials.token)).status,200);
const checked=await (await owner('/api/blender/status')).json();
assert.equal(checked.sceneCheck.status,'complete');assert.deepEqual(checked.sceneCheck.scene,scene);
assert.equal((await (await pc('/api/blender/heartbeat',{blenderReady:true,protocolVersion:2},credentials.token)).json()).command,undefined);
sqlite.exec('DELETE FROM request_limits');
await owner('/api/blender/scene','POST');sqlite.exec('UPDATE blender_scene_request SET expires=0');
assert.equal((await (await owner('/api/blender/status')).json()).sceneCheck.status,'expired');
assert.equal((await pc('/api/blender/result',{requestId:sqlite.prepare('SELECT id FROM blender_scene_request').get().id,scene},credentials.token)).status,409);
await owner('/api/blender/scene','POST');
const failedId=sqlite.prepare('SELECT id FROM blender_scene_request').get().id;
assert.equal((await pc('/api/blender/result',{requestId:failedId,error:'scene_unavailable'},credentials.token)).status,200);
assert.equal((await (await owner('/api/blender/status')).json()).sceneCheck.status,'failed');
// Modeling requests require version 5 and are delivered at most once.
sqlite.exec('DELETE FROM request_limits');
assert.equal((await owner('/api/blender/command','POST','owner-id',origin,{prompt:'Build a chair'})).status,409);
await pc('/api/blender/heartbeat',{blenderReady:true,protocolVersion:3},credentials.token);
assert.equal((await owner('/api/blender/command','POST','owner-id',origin,{prompt:'Build a chair'})).status,409);
await pc('/api/blender/heartbeat',{blenderReady:true,protocolVersion:5},credentials.token);
assert.equal((await owner('/api/blender/command','POST','member-id',origin,{prompt:'Build a chair'})).status,403);
assert.equal((await owner('/api/blender/command','POST','owner-id','https://other.test',{prompt:'Build a chair'})).status,403);
assert.equal((await owner('/api/blender/command','POST','owner-id',origin,{prompt:''})).status,400);
env.NVIDIA_API_KEY='test-key';
const plan={summary:'Create a chair seat',operations:[{op:'create',name:'Chair',primitive:'empty'},{op:'create',name:'Chair frame',primitive:'curve',parent:'Chair',points:[[0,0,0],[0,1,1],[0,2,1]],radius:.02,cyclic:false},{op:'create',name:'Chair leg',primitive:'mesh',parent:'Chair',vertices:[[0,0,0],[1,0,0],[0,1,0],[0,0,1]],faces:[[0,2,1],[0,1,3],[1,2,3],[2,0,3]],bevel:.001},{op:'create',name:'Chair seat',primitive:'cube',parent:'Chair',location:[0,0,1],scale:[.5,.5,.1],material:{type:'wood',color:[.4,.2,.1,1],grainAxis:'X',roughness:.4},bevel:.003,smooth:false}]};
let upstreamCalls=0;
const realFetch=globalThis.fetch;
globalThis.fetch=async(url,init)=>{assert.equal(url,'https://integrate.api.nvidia.com/v1/chat/completions');upstreamCalls++;return Response.json({choices:[{message:{content:JSON.stringify(plan)}}]});};
const queued=await owner('/api/blender/command','POST','owner-id',origin,{prompt:'Build a chair'});assert.equal(queued.status,200);
const commandId=(await queued.json()).requestId;
assert.equal((await owner('/api/blender/command','POST','owner-id',origin,{prompt:'Build another chair'})).status,409);
assert.equal(upstreamCalls,1);
assert.equal((await (await pc('/api/blender/heartbeat',{blenderReady:true,protocolVersion:2},credentials.token)).json()).command,undefined);
assert.equal((await (await pc('/api/blender/heartbeat',{blenderReady:true,protocolVersion:3},credentials.token)).json()).command,undefined);
const delivery=await (await pc('/api/blender/heartbeat',{blenderReady:true,protocolVersion:5},credentials.token)).json();assert.equal(delivery.command.type,'modeling');assert.equal(delivery.command.id,commandId);assert.deepEqual(delivery.command.plan,plan);
const [retry1,retry2]=await Promise.all([pc('/api/blender/heartbeat',{blenderReady:true,protocolVersion:5},credentials.token),pc('/api/blender/heartbeat',{blenderReady:true,protocolVersion:5},credentials.token)]);
assert.equal((await retry1.json()).command,undefined);assert.equal((await retry2.json()).command,undefined);
assert.equal((await pc('/api/blender/result',{kind:'modeling',requestId:commandId,success:true,message:'2 objects created.',scene:{}},credentials.token)).status,400);
const result={kind:'modeling',requestId:commandId,success:true,message:'2 objects created.',scene};
assert.equal((await pc('/api/blender/result',result,'0'.repeat(64))).status,401);
assert.equal((await pc('/api/blender/result',result,credentials.token)).status,200);
assert.equal((await pc('/api/blender/result',result,credentials.token)).status,200);
assert.equal((await (await owner('/api/blender/status')).json()).command.status,'complete');
sqlite.exec('DELETE FROM request_limits');
// An invalid AI plan is rejected without reaching Blender.
globalThis.fetch=async()=>Response.json({choices:[{message:{content:JSON.stringify({summary:'Execute code',operations:[{op:'execute-python',name:'evil',code:'print(1)'}]})}}]});
assert.equal((await owner('/api/blender/command','POST','owner-id',origin,{prompt:'Run code'})).status,502);
assert.equal((await (await owner('/api/blender/status')).json()).command.status,'failed');
assert.equal((await (await pc('/api/blender/heartbeat',{blenderReady:true,protocolVersion:5},credentials.token)).json()).command,undefined);
globalThis.fetch=realFetch;
await owner('/api/blender/disconnect','POST');assert.equal((await pc('/api/blender/heartbeat',{blenderReady:true},credentials.token)).status,401);
assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM blender_scene_request').get().n,0);
const expired=await (await owner('/api/blender/code','POST')).json();sqlite.exec('UPDATE blender_pairing SET expires=0');assert.equal((await pc('/api/blender/pair',{code:expired.code,name:'HP'})).status,401);
await owner('/api/blender/code','POST');await owner('/api/blender/cancel','POST');assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM blender_pairing').get().n,0);
console.log('Pairing checks passed: owner-only access, cross-origin rejection, code replacement, single-use redemption, hashed credentials, expiry, heartbeat, revocation, cancellation; scene capability checks, owner access, validated results, replay safety, timeout and failure states.');
