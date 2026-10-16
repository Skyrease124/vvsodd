import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
// Built Worker + Miniflare D1/R2: REA file analysis (.NET / archive / SQLite). The HP is simulated with device-token requests.
const dir=fs.readdirSync('node_modules/.pnpm').find(n=>n.startsWith('miniflare@'));const {Miniflare}=await import('../node_modules/.pnpm/'+dir+'/node_modules/miniflare/dist/src/index.js');const root=process.cwd()+'/dist/server/';
const mf=new Miniflare({modules:[{type:'ESModule',path:root+'index.js'},...fs.readdirSync(root,{recursive:true}).filter(p=>p.endsWith('.js')&&p!=='index.js').map(p=>({type:'ESModule',path:root+p}))],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['FILES'],bindings:{NVIDIA_API_KEY:'synthetic'}});
const tmp=fs.mkdtempSync(os.tmpdir()+'/skydata-rea-files-'),fx='runner-package/rea/fixture-files/',sha=b=>createHash('sha256').update(b).digest('hex');
try{
 const db=await mf.getD1Database('DB');for(const p of fs.readdirSync('drizzle').filter(p=>p.endsWith('.sql')).sort())for(const part of fs.readFileSync('drizzle/'+p,'utf8').split('--> statement-breakpoint').join('\n').split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(part).run();
 await db.prepare("INSERT INTO site_admin VALUES('owner','owner')").run();
 const call=(path,{method='GET',body,user='owner',type='application/json',token}={})=>mf.dispatchFetch('http://localhost'+path,{method,headers:{origin:'http://localhost',...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':'skyariasa@gmail.com'}:{}),...(body!==undefined?{'content-type':type}:{}),...(token?{authorization:'Bearer '+token}:{})},...(body!==undefined?{body:typeof body==='string'||body instanceof Uint8Array?body:JSON.stringify(body)}:{})});
 const ok=async(r,status=200)=>{const t=await r.text();assert.equal(r.status,status,t.slice(0,300));return t?JSON.parse(t):null;};
 const py=spawnSync('python3',['-I','-c',`import zipfile,sys
fx=sys.argv[2]
with zipfile.ZipFile(sys.argv[1],'w') as z:
  z.write(fx+'sample-assembly.dll','bin/app.dll',zipfile.ZIP_STORED)
  z.write(fx+'sample.db','data/app.db',zipfile.ZIP_DEFLATED)
  z.write(fx+'sample.zip','inner/sample.zip',zipfile.ZIP_STORED)
  z.writestr('data/fake.db','not a database',zipfile.ZIP_STORED)
  z.writestr('notes.txt','hello')`,tmp+'/p.zip',fx]);assert.equal(py.status,0,String(py.stderr));
 const zip=fs.readFileSync(tmp+'/p.zip');const {id}=await ok(await call('/api/projects',{method:'POST',body:{name:'p.zip',size:zip.length}}));
 await ok(await call('/api/projects/'+id+'/part?number=1',{method:'POST',body:new Uint8Array(zip),type:'application/octet-stream'}));await ok(await call('/api/projects/'+id+'/complete',{method:'POST',body:{}}));
 await ok(await call('/api/projects/'+id+'/ready',{method:'POST',body:{files:[{path:'bin/app.dll',size:1},{path:'notes.txt',size:5}]}}));
 const {code}=await ok(await call('/api/engineering-runner/code',{method:'POST',body:{}}));const {token}=await ok(await call('/api/engineering-runner/pair',{method:'POST',body:{code},user:null}));
 const device=(path,body)=>call('/api/engineering-runner/'+path,{method:'POST',body,user:null,token});
 const caps=(files)=>({rea:{available:true,reaVersion:'6.5.0',adapterVersion:'1',checkedAt:Date.now(),detail:'t'},...(files?{reaFiles:{available:true,reaVersion:'6.5.0',imageId:'sha256:x',checkedAt:Date.now(),detail:'ok'}}:{})});
 const poll=files=>({ready:true,protocol:2,version:'2.6.0',capabilities:caps(files)});
 await ok(await device('poll',poll(false)));
 const own=(p,b)=>call('/api/engineering-runner/'+p,{method:'POST',body:b});
 // Previews: supported types, exact fingerprints; unsupported or mislabelled input is refused.
 const dll=fs.readFileSync(fx+'sample-assembly.dll');
 const pv=await ok(await own('rea-file-preview',{projectId:id,path:'bin/app.dll'}));assert.equal(pv.file.kind,'dotnet');assert.equal(pv.file.sha256,sha(dll));assert.equal(pv.file.bytes,dll.length);
 const pdb=await ok(await own('rea-file-preview',{projectId:id,path:'data/app.db'}));assert.equal(pdb.file.kind,'sqlite');assert.equal(pdb.file.sha256,sha(fs.readFileSync(fx+'sample.db')),'deflated member is read back exactly');
 assert.equal((await ok(await own('rea-file-preview',{projectId:id,path:'inner/sample.zip'}))).file.kind,'archive');
 assert.equal((await ok(await own('rea-file-preview',{projectId:id,path:null}))).file.kind,'archive');
 await ok(await own('rea-file-preview',{projectId:id,path:'notes.txt'}),400);await ok(await own('rea-file-preview',{projectId:id,path:'data/fake.db'}),400);await ok(await own('rea-file-preview',{projectId:id,path:'missing.dll'}),400);
 await ok(await own('rea-file-preview',{projectId:id,path:'bin/app.dll',extra:1}),400);
 // The HP must have reported file analysis; a runner without it never receives file jobs.
 await ok(await own('rea-file-analyze',{projectId:id,path:'bin/app.dll',approved:true,fingerprint:pv.fingerprint}),409);
 await ok(await device('poll',poll(true)));
 await ok(await own('rea-file-analyze',{projectId:id,path:'bin/app.dll',approved:true,fingerprint:'0'.repeat(64)}),409);
 await ok(await own('rea-file-analyze',{projectId:id,path:'bin/app.dll',approved:false,fingerprint:pv.fingerprint}),400);
 const queued=async(path,preview)=>{await db.prepare('DELETE FROM request_limits').run();return ok(await own('rea-file-analyze',{projectId:id,path,approved:true,fingerprint:preview.fingerprint}));};
 let q=await queued('bin/app.dll',pv);
 const old=await ok(await device('poll',poll(false)));assert.equal(old.job,null,'a runner without file analysis is not handed the job');
 await ok(await device('rea-file',{id:q.id,index:0}),409); // not claimed yet
 const {job}=await ok(await device('poll',poll(true)));assert.equal(job.id,q.id);assert.ok(job.code.startsWith('SKYDATA_REAF_V1\n'));
 const payload=JSON.parse(job.code.slice('SKYDATA_REAF_V1\n'.length));assert.equal(payload.sha256,sha(dll));assert.equal(payload.chunks,1);assert.ok(!job.code.includes('TVq'),'the payload carries identity only');
 const chunk=await ok(await device('rea-file',{id:job.id,index:0}));assert.equal(sha(Buffer.from(chunk.data,'base64')),sha(dll),'downloaded bytes match the approved file');
 await ok(await device('rea-file',{id:job.id,index:1}),409);
 // Result integrity. The first job is finished with a deliberately inconsistent result to free the slot.
 const phases=[{phase:'container_run',ms:5,ok:true},{phase:'cleanup',ms:2,ok:true}];
 const valid=(over={})=>({status:'complete',stderr:'',adapter:{adapter:'1',mode:'file',status:'complete',kind:'dotnet',input:{sha256:sha(dll),bytes:dll.length},rea:{version:'6.5.0',operations:['inspect-managed-artifact','inspect-managed-native-boundaries','inspect-managed-members'].map(operation=>({operation,ok:true}))},workspaceUnchanged:true,results:{artifact:{assembly:{name:'x'}},boundaries:{},members:{}},phases:[]},diagnostics:{runner:'rea-file/1',executionStatus:'complete',cleanupConfirmed:true,totalMs:5,phases},...over});
 const bad=async(label,result,check)=>{await db.prepare('DELETE FROM request_limits').run();const q2=await queued('bin/app.dll',pv);const {job:j}=await ok(await device('poll',poll(true)));assert.equal(j.id,q2.id);
  const r=await ok(await device('rea-file-result',{id:j.id,result}));assert.equal(r.status,'invalid_result',label);assert.equal(r.usable,false,label);assert.ok(r.failedChecks.includes(check),label+' → '+r.failedChecks);
  const run=await ok(await call('/api/engineering-runner/rea-run?id='+j.id));assert.equal(run.usable,false,label);};
 await ok(await device('rea-file-result',{id:job.id,result:valid({adapter:{...valid().adapter,workspaceUnchanged:false}})}));
 await bad('other file',valid({adapter:{...valid().adapter,input:{sha256:'f'.repeat(64),bytes:dll.length}}}),'analysed file differs from the approved file');
 await bad('wrong kind',valid({adapter:{...valid().adapter,kind:'sqlite'}}),'file type differs from the approved request');
 await bad('workspace changed',valid({adapter:{...valid().adapter,workspaceUnchanged:false}}),'workspace changed or unchecked');
 await bad('cleanup unconfirmed',valid({diagnostics:{...valid().diagnostics,cleanupConfirmed:false}}),'container removal not confirmed');
 await bad('wrong REA',valid({adapter:{...valid().adapter,rea:{...valid().adapter.rea,version:'6.4.0'}}}),'unexpected REA version');
 await bad('no results',valid({adapter:{...valid().adapter,results:{}}}),'required REA result missing');
 await bad('missing operation',valid({adapter:{...valid().adapter,rea:{version:'6.5.0',operations:[{operation:'inspect-managed-artifact',ok:true}]}}}),'operation list incomplete');
 // Control: the consistent result is accepted, stored and usable; a JavaScript result endpoint cannot be used for it.
 await db.prepare('DELETE FROM request_limits').run();const q3=await queued('bin/app.dll',pv);const {job:j3}=await ok(await device('poll',poll(true)));
 await ok(await device('rea-result',{id:j3.id,result:valid()}),409);await ok(await device('result',{id:j3.id,result:{status:'passed',exitCode:0,stdout:'',stderr:'',durationMs:1}}),409);
 const good=await ok(await device('rea-file-result',{id:j3.id,result:valid()}));assert.equal(good.status,'complete');assert.equal(good.usable,true);
 const run=await ok(await call('/api/engineering-runner/rea-run?id='+j3.id));assert.equal(run.kind,'reafile');assert.equal(run.usable,true);assert.equal(run.analysis.adapter.results.artifact.assembly.name,'x');
 const status=await ok(await call('/api/engineering-runner/status'));assert.equal(status.device.reaFiles.available,true);assert.ok(status.history.some(h=>h.id===j3.id&&h.kind==='reafile'));
 await ok(await device('rea-file-result',{id:j3.id,result:valid()}),409);
 // Whole-ZIP archive, multi-chunk: a 7 MB stored file in a project.
 const big=Buffer.alloc(7*1024*1024,7);big.write('SQLite format 3\0',0,'latin1');
 fs.writeFileSync(tmp+'/big.bin',big);spawnSync('python3',['-I','-c',`import zipfile,sys
with zipfile.ZipFile(sys.argv[1],'w') as z: z.writestr('big.sqlite',open(sys.argv[2],'rb').read(),zipfile.ZIP_STORED)`,tmp+'/b.zip',tmp+'/big.bin']);
 const bz=fs.readFileSync(tmp+'/b.zip'),{id:id2}=await ok(await call('/api/projects',{method:'POST',body:{name:'b.zip',size:bz.length}}));
 for(let n=1,off=0;off<bz.length;n++,off+=8*1024*1024)await ok(await call('/api/projects/'+id2+'/part?number='+n,{method:'POST',body:new Uint8Array(bz.subarray(off,off+8*1024*1024)),type:'application/octet-stream'}));
 await ok(await call('/api/projects/'+id2+'/complete',{method:'POST',body:{}}));await ok(await call('/api/projects/'+id2+'/ready',{method:'POST',body:{files:[{path:'big.sqlite',size:big.length}]}}));
 const pbr=await own("rea-file-preview",{projectId:id2,path:"big.sqlite"});const pb=JSON.parse(await pbr.text());assert.equal(pb.file.chunks,3);
 await db.prepare('DELETE FROM request_limits').run();const q4=await ok(await own('rea-file-analyze',{projectId:id2,path:'big.sqlite',approved:true,fingerprint:pb.fingerprint}));const {job:j4}=await ok(await device('poll',poll(true)));
 const parts=[];for(let i=0;i<3;i++)parts.push(Buffer.from((await ok(await device('rea-file',{id:j4.id,index:i}))).data,'base64'));assert.equal(sha(Buffer.concat(parts)),sha(big),'chunks reassemble to the approved file');
 // The stored original changed after approval: the chunk is refused.
 console.log('PASS REA file analysis (built Worker + Miniflare; HP simulated): previews for .NET, SQLite (deflated member), nested and whole-project archives with exact SHA-256; refusal of unsupported, mislabelled, missing or extra-field requests; capability gating (runner without file analysis never gets the job; site refuses to queue); payload carries identity only; chunked download reassembles exactly; seven integrity checks make mismatched results invalid_result; JavaScript endpoints cannot submit file results.');
}finally{await mf.dispose();fs.rmSync(tmp,{recursive:true,force:true});}
