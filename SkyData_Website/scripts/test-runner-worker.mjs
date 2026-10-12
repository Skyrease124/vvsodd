import assert from 'node:assert/strict';
import fs from 'node:fs';
const dir=fs.readdirSync('node_modules/.pnpm').find(n=>n.startsWith('miniflare@'));const {Miniflare}=await import('../node_modules/.pnpm/'+dir+'/node_modules/miniflare/dist/src/index.js');const root=process.cwd()+'/dist/server/';
const mf=new Miniflare({modules:[{type:'ESModule',path:root+'index.js'},...fs.readdirSync(root,{recursive:true}).filter(p=>p.endsWith('.js')&&p!=='index.js').map(p=>({type:'ESModule',path:root+p}))],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['FILES']});
try{
 const db=await mf.getD1Database('DB');for(const p of fs.readdirSync('drizzle').filter(p=>p.endsWith('.sql')).sort()){for(const part of fs.readFileSync('drizzle/'+p,'utf8').split('--> statement-breakpoint').join('\n').split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(part).run();}
 await db.prepare("INSERT INTO site_admin VALUES('owner','owner')").run();
 const call=(path,b,user=null,token=null)=>mf.dispatchFetch('http://localhost/api/engineering-runner/'+path,{method:b===null?'GET':'POST',headers:{origin:'http://localhost','content-type':'application/json',...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':'skyariasa@gmail.com'}:{}),...(token?{authorization:'Bearer '+token}:{})},...(b===null?{}:{body:JSON.stringify(b)})});
 assert.equal((await call('status',null)).status,403);assert.equal((await call('poll',{ready:true})).status,401);
 const pairResponse=await call('code',{},'owner');assert.equal(pairResponse.status,200);const {code}=await pairResponse.json();const paired=await call('pair',{code});assert.equal(paired.status,200);const {token}=await paired.json();
 await call('poll',{ready:true},null,token);const queued=await call('test',{approved:true,code:'console.log(4)'},'owner');assert.equal(queued.status,200);const {id}=await queued.json();const {job}=await (await call('poll',{ready:true},null,token)).json();assert.equal(job.id,id);
 const done=await call('result',{id,result:{status:'passed',exitCode:0,stdout:'4',stderr:'',durationMs:25}},null,token);assert.equal(done.status,200);assert.equal((await (await call('status',null,'owner')).json()).job.status,'passed');

 const bucket=await mf.getR2Bucket('FILES'),projectId=crypto.randomUUID();
 await db.prepare('INSERT INTO projects(id,owner,name,size,status,upload,key,chunks,created) VALUES(?,?,?,?,?,?,?,?,?)').bind(projectId,'owner','fixture.zip',100,'ready','none','fixture',1,Date.now()).run();
 const files=[{path:'src/math.mjs',text:'export const add=(a,b)=>a+b;'},{path:'src/math.test.mjs',text:"import {add} from './math.mjs';import assert from 'node:assert/strict';assert.equal(add(2,2),4);"},{path:'incomplete.js',text:'partial',truncated:true},{path:'credentials.json',text:'private'}];
 await bucket.put('projects/'+projectId+'/manifest.json',JSON.stringify(files.map(f=>({path:f.path,size:f.text.length,chunk:0}))));await bucket.put('projects/'+projectId+'/code-0.json',JSON.stringify(files));
 const getProject=user=>mf.dispatchFetch('http://localhost/api/engineering-runner/project?id='+projectId,{headers:{'oai-authenticated-user-id':user,'oai-authenticated-user-email':'skyariasa@gmail.com'}});
 assert.equal((await getProject('stranger')).status,403);const loaded=await (await getProject('owner')).json();assert.equal(loaded.files.length,2);assert.ok(loaded.skipped.includes('incomplete.js'));assert.ok(loaded.skipped.includes('credentials.json'));
 const selection={projectId,paths:['src/math.mjs','src/math.test.mjs'],entry:'src/math.test.mjs',approved:true};
 assert.equal((await call('project-test',selection,'owner')).status,409); // v1 runner cannot accept projects
 await call('poll',{ready:true,protocol:2},null,token);
 assert.equal((await call('project-test',{...selection,paths:['incomplete.js'],entry:'incomplete.js'},'owner')).status,400);
 assert.equal((await call('project-test',{...selection,projectId:crypto.randomUUID()},'owner')).status,400);
 const queuedProject=await call('project-test',selection,'owner');assert.equal(queuedProject.status,200);
 assert.equal((await (await call('poll',{ready:true},null,token)).json()).job,null); // old runner never claims a project
 const claimed=await (await call('poll',{ready:true,protocol:2},null,token)).json();assert.ok(claimed.job.code.startsWith('SKYDATA_PROJECT_V1\n'));assert.ok(claimed.job.expires-Date.now()>500000);
 const projectResult=await call('result',{id:claimed.job.id,result:{status:'passed',exitCode:0,stdout:'fixture only',stderr:'',durationMs:25}},null,token);assert.equal(projectResult.status,200);
 const evidence=await (await call('status',null,'owner')).json();assert.deepEqual(evidence.job.result.project.paths,selection.paths);assert.match(evidence.job.result.project.sha256,/^[a-f0-9]{64}$/);
 await call('disconnect',{},'owner');assert.equal((await call('poll',{ready:true},null,token)).status,401);
 console.log('PASS built Worker + real D1: anonymous owner denial, device-token access through routing, pairing, job claim, result display and revocation. Project selection and R2 ownership, incomplete/credential exclusions, v1 compatibility, ten-minute approval, source fingerprint. Container results are fixtures; no live HP claim.');
}finally{await mf.dispose();}
