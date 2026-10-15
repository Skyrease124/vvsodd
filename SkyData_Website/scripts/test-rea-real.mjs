import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import {spawnSync,execFileSync} from 'node:child_process';
import {reaJob} from '../runner-package/runner.mjs';
import {REA_IMAGE,REA_LIMITS,executeRea,checkReaImage} from '../runner-package/rea-job.mjs';
import {docker,cleanup} from '../runner-package/runner.mjs';
import {createHash} from 'node:crypto';
// REAL REA path: built Worker + Miniflare D1/R2 → runner reaJob (scripted "yes") → real Docker → real REA 6.5.0
// → rea-result → stored findings → AI explanation (Gemini mocked). Not the Windows HP. Skips without Docker/REA image.
try{execFileSync('docker',['image','inspect',REA_IMAGE],{stdio:'ignore',timeout:20000});}catch{console.log('SKIP real REA test: Docker or the '+REA_IMAGE+' image is not available here. Nothing was verified.');process.exit(0);}
const dir=fs.readdirSync('node_modules/.pnpm').find(n=>n.startsWith('miniflare@'));const {Miniflare}=await import('../node_modules/.pnpm/'+dir+'/node_modules/miniflare/dist/src/index.js');const root=process.cwd()+'/dist/server/';
let prompts=[];
const mf=new Miniflare({modules:[{type:'ESModule',path:root+'index.js'},...fs.readdirSync(root,{recursive:true}).filter(p=>p.endsWith('.js')&&p!=='index.js').map(p=>({type:'ESModule',path:root+p}))],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['FILES'],bindings:{NVIDIA_API_KEY:'synthetic-nvidia'},
 outboundService:async req=>{prompts.push(JSON.stringify(await req.json()));return Response.json({choices:[{message:{role:'assistant',content:'REA reported: GET /health at src/server.js:7. Interpretation: model advice. Tests NOT_RUN.'},finish_reason:'stop'}]});}});
const tmp=fs.mkdtempSync(os.tmpdir()+'/skydata-rea-');
try{
 const db=await mf.getD1Database('DB');for(const p of fs.readdirSync('drizzle').filter(p=>p.endsWith('.sql')).sort())for(const part of fs.readFileSync('drizzle/'+p,'utf8').split('--> statement-breakpoint').join('\n').split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(part).run();
 await db.prepare("INSERT INTO site_admin VALUES('owner','owner')").run();await db.prepare("INSERT INTO members(email,user_id,status,created) VALUES('member@test.com','member','approved',0)").run();
 const who={owner:'skyariasa@gmail.com',member:'member@test.com'};
 const call=(path,{method='GET',body,user='owner',origin='http://localhost',type='application/json',token}={})=>mf.dispatchFetch('http://localhost'+path,{method,headers:{origin,...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':who[user]||user+'@x.test'}:{}),...(body!==undefined?{'content-type':type}:{}),...(token?{authorization:'Bearer '+token}:{})},...(body!==undefined?{body:typeof body==='string'||body instanceof Uint8Array?body:JSON.stringify(body)}:{})});
 const ok=async(r,status=200)=>{const text=await r.text();assert.equal(r.status,status,text.slice(0,400));return text?JSON.parse(text):null;};
 // Fixture ZIP: the REA fixture plus unsafe, credential, dependency, symlink, duplicate, case-colliding, binary and oversized entries.
 const py=spawnSync('python3',['-I','-c',`import zipfile,sys,os,warnings
warnings.simplefilter('ignore')
root=sys.argv[2]
with zipfile.ZipFile(sys.argv[1],'w',zipfile.ZIP_DEFLATED) as z:
  for d,_,fs in os.walk(root):
    for f in sorted(fs): p=os.path.join(d,f);z.write(p,os.path.relpath(p,root))
  z.writestr('../evil.js','console.log(1)')
  z.writestr('.env','API_KEY=not-a-real-key')
  z.writestr('node_modules/express/index.js','module.exports=1')
  link=zipfile.ZipInfo('src/link.js');link.create_system=3;link.external_attr=(0o120777<<16);z.writestr(link,'../../etc/passwd')
  z.writestr('dup.js','1');z.writestr('dup.js','2')
  z.writestr('Case.js','1');z.writestr('case.js','2')
  z.writestr('assets/logo.png',bytes(range(256)))
  z.writestr('src/huge.js','// '+'x'*(600*1024))`,tmp+'/fixture.zip','runner-package/rea/fixture']);assert.equal(py.status,0,String(py.stderr));
 const zip=fs.readFileSync(tmp+'/fixture.zip');
 const {id}=await ok(await call('/api/projects',{method:'POST',body:{name:'fixture.zip',size:zip.length}}));
 await ok(await call('/api/projects/'+id+'/part?number=1',{method:'POST',body:new Uint8Array(zip),type:'application/octet-stream'}));
 await ok(await call('/api/projects/'+id+'/complete',{method:'POST',body:{}}));
 await ok(await call('/api/projects/'+id+'/index',{method:'POST',body:{number:0,files:[{path:'src/server.js',text:'x'}]}}));
 await ok(await call('/api/projects/'+id+'/ready',{method:'POST',body:{files:[{path:'src/server.js',size:1,chunk:0}]}}));
 const listing=await ok(await call('/api/projects/'+id+'/files'));const all=[...new Set(listing.files.map(f=>f.path))];
 // Owner, membership and origin protections on the new REA endpoints.
 const sel={projectId:id,paths:all};
 assert.equal((await call('/api/engineering-runner/rea-preview',{method:'POST',body:sel,user:null})).status,403);
 assert.equal((await call('/api/engineering-runner/rea-preview',{method:'POST',body:sel,user:'member'})).status,403);
 assert.equal((await call('/api/engineering-runner/rea-preview',{method:'POST',body:sel,origin:'http://evil.test'})).status,403);
 const preview=await ok(await call('/api/engineering-runner/rea-preview',{method:'POST',body:sel}));
 const reasons=Object.fromEntries(preview.excluded.map(x=>[x.path,x.reason]));
 assert.match(reasons['../evil.js'],/Unsafe/);assert.match(reasons['.env'],/credential/);assert.match(reasons['node_modules/express/index.js'],/runtime-state/);assert.match(reasons['src/link.js'],/Symbolic link/);
 assert.match(reasons['dup.js'],/Ambiguous/);assert.match(reasons['Case.js'],/Ambiguous/);assert.match(reasons['assets/logo.png'],/Not a JavaScript/);assert.match(reasons['src/huge.js'],/512 KB/);
 const sent=preview.files.map(f=>f.path).sort();assert.deepEqual(sent,['package.json','public/app.mjs','public/index.html','public/settings.mjs','public/view.mjs','src/broken.js','src/lib/pricing.js','src/routes/users.js','src/server.js']);
 assert.ok(preview.omitted.packages.includes('express'),'omitted dependency reported');
 // Exact approved selection: subset preview, approval bound to its fingerprint.
 const subset=sent;const p2=await ok(await call('/api/engineering-runner/rea-preview',{method:'POST',body:{projectId:id,paths:subset}}));
 assert.equal((await call('/api/engineering-runner/rea-analyze',{method:'POST',body:{projectId:id,paths:subset,fingerprint:p2.fingerprint}})).status,400,'approval required');
 assert.equal((await call('/api/engineering-runner/rea-analyze',{method:'POST',body:{projectId:id,paths:subset,approved:true,fingerprint:'0'.repeat(64)}})).status,409,'approval bound to the previewed fingerprint');
 assert.equal((await call('/api/engineering-runner/rea-analyze',{method:'POST',body:{projectId:id,paths:subset,approved:true,fingerprint:p2.fingerprint}})).status,409,'refused while no runner reports REA');
 // Pair a runner; a v2.2-style poll (no REA capability) must never receive the REA job.
 const {code}=await ok(await call('/api/engineering-runner/code',{method:'POST',body:{}}));const {token}=await ok(await call('/api/engineering-runner/pair',{method:'POST',body:{code},user:null}));
 const apiCall=async(path,body)=>{const r=await call('/api/engineering-runner/'+path,{method:'POST',body,user:null,token});const d=await r.json();if(!r.ok)throw Error(d.error||String(r.status));return d;};
 const capable={ready:true,protocol:2,version:'2.3',capabilities:{rea:{available:true,reaVersion:'6.5.0',adapterVersion:'1',checkedAt:Date.now(),detail:'REA 6.5.0 · adapter 1'}}};
 await apiCall('poll',capable);
 const queued=await ok(await call('/api/engineering-runner/rea-analyze',{method:'POST',body:{projectId:id,paths:subset,approved:true,fingerprint:p2.fingerprint}}));assert.equal(queued.fingerprint,p2.fingerprint);
 assert.equal((await apiCall('poll',{ready:true,protocol:2,version:'2.2'})).job,null,'runner without REA capability cannot claim');
 assert.equal((await apiCall('poll',{...capable,capabilities:{rea:{...capable.capabilities.rea,reaVersion:'6.3.0'}}})).job,null,'incompatible REA version cannot claim');
 const {job}=await apiCall('poll',capable);assert.equal(job.id,queued.id);
 assert.equal((await call('/api/engineering-runner/result',{method:'POST',body:{id:job.id,result:{status:'passed',exitCode:0,stdout:'',stderr:'',durationMs:1}},user:null,token})).status,409,'test result endpoint refuses REA jobs');
 // Real REA through the runner's own job function; the scripted keystroke stands in for typing yes on the HP.
 const answers=['yes'];const rl={question:async q=>{assert.match(q,/Analyze these exact files with REA/);return answers.shift();}};
 const started=Date.now();await reaJob(job,rl,token,{apiCall});const elapsed=Date.now()-started;
 const status=await ok(await call('/api/engineering-runner/status'));const h=status.history.find(x=>x.id===job.id);
 assert.equal(h.kind,'rea');assert.equal(h.status,'partial');assert.equal(h.fingerprint,p2.fingerprint);assert.deepEqual(h.files.map(f=>f.path).sort(),subset);
 const run=await ok(await call('/api/engineering-runner/rea-run?id='+job.id));
 assert.equal((await call('/api/engineering-runner/rea-run?id='+job.id,{user:'member'})).status,403);
 const a=run.analysis,f=a.adapter.findings;
 assert.equal(a.reaVersion,'6.5.0');assert.equal(a.adapter.rea.operation,'analyze-javascript-application');assert.equal(a.stagedMatchesApproval,true,'REA analysed exactly the approved files');
 assert.equal(a.workspaceUnchanged,true,'nothing executed: no canary file, staged files unchanged');assert.ok(!a.adapter.staged.some(s=>s.path.endsWith('EXECUTED.txt')));assert.equal(a.diagnostics.cleanupConfirmed,true);
 assert.equal(f.graphCoverage.status,'partial','partial coverage surfaced');assert.ok(f.unknowns.items.some(u=>u.path==='src/broken.js'));
 const ep=f.endpoints.items.map(e=>e.value+'@'+e.evidence.location.path+':'+e.evidence.location.line);
 for(const want of ['/health@src/server.js:7','/api/orders@src/server.js:9','https://api.example.test/v1/products@public/app.mjs:4'])assert.ok(ep.includes(want),want+' in '+ep.join(', '));
 // REA merges identical endpoint values into one node: 6.4.0 placed '/:id' at its first call (line 2), 6.5.0 at its last (line 3).
 // Both calling sites stay on the `calls` edges, so check those exactly.
 assert.ok(ep.some(e=>/^\/:id@src\/routes\/users\.js:[23]$/.test(e)),'/:id in users.js in '+ep.join(', '));
 const idCalls=f.endpointCalls.items.filter(c=>c.endpoint==='/:id').map(c=>c.mechanism+'@'+c.evidence.location.path+':'+c.evidence.location.line).sort();
 assert.deepEqual(idCalls,['call:router.delete@src/routes/users.js:3','call:router.get@src/routes/users.js:2']);
 assert.ok(f.endpointCalls.items.some(c=>c.mechanism==='call:router.delete'&&c.evidence.location.line===3),'DELETE /:id call site kept');
 const imp=f.imports.items.map(i=>i.specifier+'→'+(i.resolvedPath||'unresolved'));for(const want of ['./routes/users→src/routes/users.js','./view.mjs→public/view.mjs','./settings.mjs→public/settings.mjs','express→unresolved'])assert.ok(imp.includes(want),want);
 assert.ok(f.storage.items.some(s=>s.name==='theme'&&s.evidence.location.path==='public/app.mjs'));assert.ok(f.limitations.some(l=>/never executed|inert/.test(l)));
 assert.ok(a.diagnostics.phases.some(p=>p.phase==='docker_check'&&p.ok)&&a.diagnostics.phases.some(p=>p.phase==='container_run'&&p.ok));
 // Existing model explains the stored findings; the Superpowers default is unchanged.
 const explain=await ok(await call('/api/engineering',{method:'POST',body:{mode:'research',model:'nvidia/nemotron-3-ultra-550b-a55b',investigation:'rea',reaRunId:job.id,messages:[{role:'user',content:'What routes does this project expose?'}]}}));
 assert.equal(explain.investigation,'rea');assert.match(explain.interpretation,/not REA output/);assert.equal(explain.reaRun.reaVersion,'6.5.0');assert.equal(explain.skills.length,0);
 const reaPrompt=prompts.at(-1);assert.ok(reaPrompt.includes('untrusted tool data'));assert.ok(reaPrompt.includes('src/routes/users.js'));assert.ok(!reaPrompt.includes('Superpowers workflow'));
 assert.equal((await call('/api/engineering',{method:'POST',body:{mode:'research',model:'nvidia/nemotron-3-ultra-550b-a55b',investigation:'rea',reaRunId:crypto.randomUUID(),messages:[{role:'user',content:'x'}]}})).status,400);
 assert.equal((await call('/api/engineering',{method:'POST',body:{mode:'research',workflow:'review',model:'nvidia/nemotron-3-ultra-550b-a55b',reaRunId:job.id,messages:[{role:'user',content:'x'}]}})).status,400,'reaRunId only with the REA method');
 const sp=await ok(await call('/api/engineering',{method:'POST',body:{mode:'research',workflow:'review',model:'nvidia/nemotron-3-ultra-550b-a55b',messages:[{role:'user',content:'Review my code'}]}}));
 assert.ok(sp.skills.includes('requesting-code-review'));assert.equal(sp.investigation,undefined);assert.ok(prompts.at(-1).includes('Superpowers'));
 // Real container: the adapter itself rejects unsafe or tampered requests, and a real REA run honours the deadline.
 const rea=await checkReaImage(docker);assert.equal(rea.available,true,rea.detail);
 const t=x=>({path:x.path,text:x.text,sha256:createHash('sha256').update(x.text).digest('hex')});
 const direct=async files=>JSON.parse(execFileSync('docker',['run','--rm','-i','--network','none','--read-only','--cap-drop','ALL','--user','1000:1000','--tmpfs','/tmp:rw,noexec,nosuid,size=64m',rea.imageId],{input:JSON.stringify({protocol:'skydata-rea-v1',operation:'analyze-javascript-application',files}),encoding:'utf8',stdio:['pipe','pipe','ignore']}).toString()||'{}');
 const tryDirect=async files=>{try{return await direct(files);}catch(e){return JSON.parse(String(e.stdout||'{}'));}};
 assert.equal((await tryDirect([t({path:'../escape.js',text:'1'})])).status,'rejected','traversal rejected inside the container');
 assert.equal((await tryDirect([{...t({path:'a.js',text:'1'}),sha256:'0'.repeat(64)}])).status,'rejected','fingerprint mismatch rejected inside the container');
 assert.equal((await tryDirect([t({path:'a.js',text:'1'}),t({path:'A.js',text:'2'})])).status,'rejected','case-insensitive duplicate rejected');
 const slow=await executeRea({name:'deadline',operation:'analyze-javascript-application',files:[t({path:'a.js',text:'export const a=1;'})]},rea.imageId,{dockerCommand:docker,removeContainer:cleanup,limits:{...REA_LIMITS,deadlineMs:800}});
 assert.equal(slow.status,'timeout','real REA run stopped at its deadline');assert.equal(slow.diagnostics.cleanupConfirmed,true);assert.ok(slow.diagnostics.phases.find(p=>p.phase==='termination').ok,'docker kill confirmed');
 assert.equal(execFileSync('docker',['ps','-a','-q','--filter','name=skydata-rea-'],{encoding:'utf8'}).trim(),'','no REA containers left');
 console.log('PASS REAL REA path (built Worker + Miniflare D1/R2 + runner reaJob + real Docker + real REA 6.5.0, '+elapsed+' ms): owner/member/origin protections, exclusions (unsafe path, credential, dependency folder, symlink, duplicate, case collision, non-source, oversized), omitted dependency, fingerprint-bound approval, capability-gated claim (no REA / wrong version), separate result endpoint, staged files = approved files, no execution, partial coverage and unknowns, routes/imports/storage with exact locations, cleanup confirmed, adapter rejections inside the real container (traversal, tampered SHA-256, case duplicate), real deadline with confirmed kill and cleanup, AI explanation labelled as interpretation, Superpowers default unchanged. Simulated: the HP machine and the typed yes; Gemini mocked.');
}finally{await mf.dispose();fs.rmSync(tmp,{recursive:true,force:true});}
