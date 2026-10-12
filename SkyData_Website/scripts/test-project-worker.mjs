import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
// Built Worker + Miniflare D1/R2: real routing, membership, owner checks, real upload API, R2 ranges/multipart.
// External inference is mocked; the HP runner is simulated by direct device-token requests (no execution).
const dir=fs.readdirSync('node_modules/.pnpm').find(n=>n.startsWith('miniflare@'));const {Miniflare}=await import('../node_modules/.pnpm/'+dir+'/node_modules/miniflare/dist/src/index.js');const root=process.cwd()+'/dist/server/';
let prompt='';
const mf=new Miniflare({modules:[{type:'ESModule',path:root+'index.js'},...fs.readdirSync(root,{recursive:true}).filter(p=>p.endsWith('.js')&&p!=='index.js').map(p=>({type:'ESModule',path:root+p}))],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['FILES'],bindings:{GEMINI_API_KEY:'synthetic-key',GEMINI_FREE_TIER_CONFIRMED:'true'},
 outboundService:async req=>{const b=await req.json();prompt=JSON.stringify(b);return Response.json({candidates:[{content:{role:'model',parts:[{text:'Fix below. Tests NOT_RUN.\n\n```js file=src/math.mjs\nexport const add=(a,b)=>Number(a)+Number(b);\n```\n\n```js file=test/add.test.mjs\nimport assert from \'node:assert/strict\';\nimport {add} from \'../src/math.mjs\';\nimport _ from \'lodash\';\nassert.equal(add(\'2\',2),4);\n```\n\n```js file=README.md\n# not sent in full\n```'}]},finishReason:'STOP'}]});}});
const tmp=fs.mkdtempSync(os.tmpdir()+'/skydata-worker-');
try{
 const db=await mf.getD1Database('DB');for(const p of fs.readdirSync('drizzle').filter(p=>p.endsWith('.sql')).sort())for(const part of fs.readFileSync('drizzle/'+p,'utf8').split('--> statement-breakpoint').join('\n').split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(part).run();
 await db.prepare("INSERT INTO site_admin VALUES('owner','owner')").run();await db.prepare("INSERT INTO members(email,user_id,status,created) VALUES('member@test.com','member','approved',0)").run();
 const who={owner:'skyariasa@gmail.com',member:'member@test.com'};
 const call=(path,{method='GET',body,user='owner',origin='http://localhost',type='application/json',token}={})=>mf.dispatchFetch('http://localhost'+path,{method,headers:{origin,...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':who[user]||user+'@x.test'}:{}),...(body!==undefined?{'content-type':type}:{}),...(token?{authorization:'Bearer '+token}:{})},...(body!==undefined?{body:typeof body==='string'||body instanceof Uint8Array?body:JSON.stringify(body)}:{})});
 const ok=async(r,status=200)=>{const text=await r.text();assert.equal(r.status,status,text);return text?JSON.parse(text):null;};
 // Real ZIP + the real upload endpoints the browser uses (create → part → complete → index → ready).
 const py=spawnSync('python3',['-I','-c',`import zipfile,sys
with zipfile.ZipFile(sys.argv[1],'w',zipfile.ZIP_DEFLATED) as z:
  z.writestr('src/math.mjs','export const add=(a,b)=>a+b;\\n')
  z.writestr('README.md','# Demo\\n'+'line\\n'*200)
  z.writestr('assets/a.png',bytes(range(256)))`,tmp+'/p.zip']);assert.equal(py.status,0,String(py.stderr));
 const zip=fs.readFileSync(tmp+'/p.zip');
 assert.equal((await call('/api/projects/'+crypto.randomUUID()+'/files',{user:null})).status,403,'anonymous denied by membership gate');
 const {id}=await ok(await call('/api/projects',{method:'POST',body:{name:'p.zip',size:zip.length}}));
 await ok(await call('/api/projects/'+id+'/part?number=1',{method:'POST',body:new Uint8Array(zip),type:'application/octet-stream'}));
 await ok(await call('/api/projects/'+id+'/complete',{method:'POST',body:{}}));
 await ok(await call('/api/projects/'+id+'/index',{method:'POST',body:{number:0,files:[{path:'src/math.mjs',text:'export const add=(a,b)=>a+b;\n'},{path:'README.md',text:'# Demo\n',truncated:true}]}}));
 await ok(await call('/api/projects/'+id+'/ready',{method:'POST',body:{files:[{path:'src/math.mjs',size:29,chunk:0},{path:'README.md',size:1007,chunk:0},{path:'assets/a.png',size:256}]}}));
 // Browsing and ownership through the real routing.
 assert.equal((await call('/api/projects/'+id+'/files',{user:'member'})).status,404,'another member cannot see the owner project');
 const files=await ok(await call('/api/projects/'+id+'/files'));assert.deepEqual(files.files.map(f=>[f.path,f.kind]),[['src/math.mjs','text'],['README.md','text'],['assets/a.png','binary']]);
 const math=await ok(await call('/api/projects/'+id+'/file?path=src%2Fmath.mjs'));assert.equal(math.complete,true);
 const readme=await ok(await call('/api/projects/'+id+'/file?path=README.md'));assert.equal(readme.text.split('\n').length,202,'complete file from the archive, although the upload index was truncated');
 assert.equal((await ok(await call('/api/projects/'+id+'/search?q=export'))).matches.length,1);
 // Engineering with explicit selection: the model gets complete files; the response says exactly what it received.
 const eng=await ok(await call('/api/engineering',{method:'POST',body:{mode:'development',approved:true,action:'propose',workflow:'debugging',model:'openai/gpt-oss-20b',messages:[{role:'user',content:'Fix add for strings',project:{id,name:'p.zip',paths:['src/math.mjs','assets/a.png']}}]}}));
 assert.ok(prompt.includes('export const add=(a,b)=>a+b;'),'complete selected file reached the model request');assert.ok(prompt.includes('UNAVAILABLE'));assert.ok(!prompt.includes('line\\nline'),'unselected README content not sent');
 assert.deepEqual(eng.projectFiles.map(f=>[f.path,f.status]),[['src/math.mjs','full'],['assets/a.png','unavailable']]);assert.equal(eng.projectFiles[0].sha256,math.sha256);assert.equal(eng.modificationsApplied,false);
 // Proposal from the AI blocks (math full + new test); README is refused because the model never saw it in full.
 const created=await ok(await call('/api/projects/'+id+'/proposals',{method:'POST',body:{origin:'engineering',taskId:eng.taskId,files:[{path:'src/math.mjs',text:'export const add=(a,b)=>Number(a)+Number(b);\n',originalSha256:eng.projectFiles[0].sha256},{path:'test/add.test.mjs',isNew:true,text:"import assert from 'node:assert/strict';\nimport {add} from '../src/math.mjs';\nimport _ from 'lodash';\nassert.equal(add('2',2),4);\n"}]}}));
 assert.equal((await call('/api/projects/'+id+'/proposals',{method:'POST',body:{origin:'engineering',files:[{path:'README.md',text:'# x\n'}]}})).status,400);
 const pid=created.proposal.id,detail=await ok(await call('/api/projects/'+id+'/proposals/'+pid));
 assert.equal((await call('/api/projects/'+id+'/proposals/'+pid,{user:'member'})).status,404);
 assert.equal((await call('/api/projects/'+id+'/proposals/'+pid+'/decision',{method:'POST',origin:'http://evil.test',body:{path:'src/math.mjs',decision:'approved',proposedSha256:detail.proposal.files[0].proposedSha256}})).status,403);
 for(const f of detail.proposal.files)await ok(await call('/api/projects/'+id+'/proposals/'+pid+'/decision',{method:'POST',body:{path:f.path,decision:'approved',proposedSha256:f.proposedSha256}}));
 const pkg=await ok(await call('/api/projects/'+id+'/proposals/'+pid+'/package',{method:'POST',body:{}}));
 const dl=await call('/api/projects/'+id+'/proposals/'+pid+'/download?package='+pkg.package.id);assert.equal(dl.status,200);assert.equal(dl.headers.get('content-type'),'application/zip');fs.writeFileSync(tmp+'/fixed.zip',Buffer.from(await dl.arrayBuffer()));
 const t=spawnSync('unzip',['-t',tmp+'/fixed.zip'],{encoding:'utf8'});assert.equal(t.status,0,t.stdout);
 const orig=await call('/api/projects/'+id+'/download');assert.deepEqual(Buffer.from(await orig.arrayBuffer()),zip,'original upload unchanged in R2');
 // Runner: pair as v2.2, preview and queue a proposal test, simulate HP progress and diagnostics.
 const {code}=await ok(await call('/api/engineering-runner/code',{method:'POST',body:{}}));const {token}=await ok(await call('/api/engineering-runner/pair',{method:'POST',body:{code},user:null}));
 const device=(path,body)=>call('/api/engineering-runner/'+path,{method:'POST',body,user:null,token});
 await ok(await device('poll',{ready:true,protocol:2,version:'2.2',docker:{ok:true,checkedAt:Date.now(),detail:'Docker 29.5.3 answered in 900 ms'}}));
 let status=await ok(await call('/api/engineering-runner/status'));assert.equal(status.device.runnerVersion,'2.2');assert.equal(status.device.docker.ok,true);
 const sel={projectId:id,proposalId:pid,paths:['src/math.mjs','test/add.test.mjs'],entry:'test/add.test.mjs'};
 const preview=await ok(await call('/api/engineering-runner/proposal-preview',{method:'POST',body:sel}));
 assert.deepEqual(preview.analysis.missingPackages,['lodash']);assert.match(preview.analysis.note,/installation is unavailable/);assert.deepEqual(preview.files.map(f=>f.source),['approved_proposal','approved_proposal']);
 assert.equal((await call('/api/engineering-runner/proposal-test',{method:'POST',body:sel})).status,400,'website approval required');
 assert.equal((await call('/api/engineering-runner/proposal-preview',{method:'POST',body:{...sel,paths:['README.md']}})).status,400,'non-JS-entry / unsupported selections rejected');
 const queued=await ok(await call('/api/engineering-runner/proposal-test',{method:'POST',body:{...sel,approved:true}}));assert.equal(queued.fingerprint,preview.fingerprint);
 status=await ok(await call('/api/engineering-runner/status'));assert.equal(status.history[0].status,'waiting_for_hp');
 const {job}=await ok(await device('poll',{ready:true,protocol:2,version:'2.2'}));assert.equal(job.id,queued.id);
 status=await ok(await call('/api/engineering-runner/status'));assert.equal(status.history[0].status,'awaiting_local_approval');
 await ok(await device('progress',{id:job.id,phase:'container_start'}));assert.equal((await device('progress',{id:job.id,phase:'rm -rf'})).status,400);
 assert.equal((await ok(await call('/api/engineering-runner/status'))).job.phase,'container_start');
 assert.equal((await device('result',{id:job.id,result:{status:'failed',exitCode:1,stdout:'',stderr:'x',durationMs:5,diagnostics:{runner:'2.2',phases:'bad'}}})).status,400,'malformed diagnostics rejected');
 const diag={runner:'2.2',executionStatus:'failed',cleanupConfirmed:true,totalMs:4000,phases:[{phase:'docker_check',command:'docker info',ms:900,ok:true},{phase:'container_start',command:'docker start -a -i',ms:2500,ok:true},{phase:'execution',command:'node (inside container)',ms:300,ok:true},{phase:'cleanup',command:'docker rm -f + docker container inspect',ms:200,ok:true}]};
 await ok(await device('result',{id:job.id,result:{status:'failed',exitCode:1,stdout:'',stderr:"Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'lodash'",durationMs:300,diagnostics:diag}}));
 status=await ok(await call('/api/engineering-runner/status'));const h=status.history[0];
 assert.equal(h.status,'failed');assert.equal(h.kind,'proposal');assert.equal(h.fingerprint,preview.fingerprint);assert.deepEqual(h.files.map(f=>f.path),sel.paths);assert.equal(h.result.diagnostics.phases.length,4);assert.match(h.result.evidence,/not independently verified/);assert.equal(h.phase,null);
 assert.ok(!JSON.stringify(status).includes(token),'token never returned');
 // Older runner (no diagnostics) still accepted; snippet history recorded.
 const snip=await ok(await call('/api/engineering-runner/test',{method:'POST',body:{code:'console.log(1)',approved:true}}));const claimed=await ok(await device('poll',{ready:true,protocol:2}));assert.equal(claimed.job.id,snip.id);
 await ok(await device('result',{id:snip.id,result:{status:'passed',exitCode:0,stdout:'1',stderr:'',durationMs:20}}));status=await ok(await call('/api/engineering-runner/status'));assert.equal(status.history[0].kind,'snippet');assert.equal(status.history[0].status,'passed');assert.equal(status.history.length,2);
 assert.equal(status.device.runnerVersion,null,'version cleared when an older runner polls');
 // Deleting the proposal never deletes the project; deleting the project removes everything under it.
 await ok(await call('/api/projects/'+id+'/proposals/'+pid,{method:'DELETE'}));assert.equal((await ok(await call('/api/projects'))).projects.length,1);
 await ok(await call('/api/projects/'+id,{method:'DELETE'}));const bucket=await mf.getR2Bucket('FILES');assert.equal((await bucket.list({prefix:'projects/'+id+'/'})).objects.length,0);
 console.log('PASS built Worker + Miniflare D1/R2: real upload API, membership/owner/origin gates, complete-file browsing beyond the truncated index, explicit AI selection reaching the model request with FULL/UNAVAILABLE report, AI-block proposal with refusal of unseen files, approvals, corrected ZIP (unzip -t), original unchanged, proposal test preview with missing-package explanation, website approval, HP claim/progress/diagnostics, history with fingerprints, older-runner compatibility, safe deletion. Gemini mocked; HP simulated; nothing executed.');
}finally{await mf.dispose();fs.rmSync(tmp,{recursive:true,force:true});}
