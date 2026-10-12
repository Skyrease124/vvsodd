import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
// Built Worker + Miniflare D1/R2: REA result integrity and explanation eligibility. The HP runner is simulated by
// device-token requests; Gemini is mocked and counted so we can prove ineligible runs never reach the model.
const dir=fs.readdirSync('node_modules/.pnpm').find(n=>n.startsWith('miniflare@'));const {Miniflare}=await import('../node_modules/.pnpm/'+dir+'/node_modules/miniflare/dist/src/index.js');const root=process.cwd()+'/dist/server/';
let geminiCalls=0;
const mf=new Miniflare({modules:[{type:'ESModule',path:root+'index.js'},...fs.readdirSync(root,{recursive:true}).filter(p=>p.endsWith('.js')&&p!=='index.js').map(p=>({type:'ESModule',path:root+p}))],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['FILES'],bindings:{GEMINI_API_KEY:'synthetic-key',GEMINI_FREE_TIER_CONFIRMED:'true'},
 outboundService:async()=>{geminiCalls++;return Response.json({candidates:[{content:{role:'model',parts:[{text:'Explanation. Tests NOT_RUN.'}]},finishReason:'STOP'}]});}});
const tmp=fs.mkdtempSync(os.tmpdir()+'/skydata-rea-result-');
try{
 const db=await mf.getD1Database('DB');for(const p of fs.readdirSync('drizzle').filter(p=>p.endsWith('.sql')).sort())for(const part of fs.readFileSync('drizzle/'+p,'utf8').split('--> statement-breakpoint').join('\n').split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(part).run();
 await db.prepare("INSERT INTO site_admin VALUES('owner','owner')").run();
 const call=(path,{method='GET',body,user='owner',type='application/json',token}={})=>mf.dispatchFetch('http://localhost'+path,{method,headers:{origin:'http://localhost',...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':'skyariasa@gmail.com'}:{}),...(body!==undefined?{'content-type':type}:{}),...(token?{authorization:'Bearer '+token}:{})},...(body!==undefined?{body:typeof body==='string'||body instanceof Uint8Array?body:JSON.stringify(body)}:{})});
 const ok=async(r,status=200)=>{const t=await r.text();assert.equal(r.status,status,t.slice(0,300));return t?JSON.parse(t):null;};
 const py=spawnSync('python3',['-I','-c',`import zipfile,sys
with zipfile.ZipFile(sys.argv[1],'w') as z:
  z.writestr('src/a.js',"const b=require('./b');module.exports=b;\\n")
  z.writestr('src/b.js','module.exports=1;\\n')`,tmp+'/p.zip']);assert.equal(py.status,0);
 const zip=fs.readFileSync(tmp+'/p.zip');const {id}=await ok(await call('/api/projects',{method:'POST',body:{name:'p.zip',size:zip.length}}));
 await ok(await call('/api/projects/'+id+'/part?number=1',{method:'POST',body:new Uint8Array(zip),type:'application/octet-stream'}));await ok(await call('/api/projects/'+id+'/complete',{method:'POST',body:{}}));
 await ok(await call('/api/projects/'+id+'/index',{method:'POST',body:{number:0,files:[{path:'src/a.js',text:'x'}]}}));await ok(await call('/api/projects/'+id+'/ready',{method:'POST',body:{files:[{path:'src/a.js',size:1,chunk:0},{path:'src/b.js',size:1}]}}));
 const {code}=await ok(await call('/api/engineering-runner/code',{method:'POST',body:{}}));const {token}=await ok(await call('/api/engineering-runner/pair',{method:'POST',body:{code},user:null}));
 const device=(path,body)=>call('/api/engineering-runner/'+path,{method:'POST',body,user:null,token});
 const poll={ready:true,protocol:2,version:'2.3',capabilities:{rea:{available:true,reaVersion:'6.4.0',adapterVersion:'1',checkedAt:Date.now(),detail:'test'}}};
 await ok(await device('poll',poll));
 const paths=['src/a.js','src/b.js'],preview=await ok(await call('/api/engineering-runner/rea-preview',{method:'POST',body:{projectId:id,paths}}));
 const approvedStaged=preview.files.map(f=>({path:f.path,sha256:f.sha256,bytes:f.bytes}));
 const findings={evidenceId:'ev_x',rootArtifactSha256:'0'.repeat(64),graphCoverage:{status:'partial',truncated:false,omitted_count:null,limits:[]},statistics:{parsed_javascript_files:2,parse_failures:0,relevant_files:2},limitations:['static only'],
  modules:{items:[],total:0,truncatedByAdapter:false},imports:{items:[{from:'src/a.js',to:'src/b.js',specifier:'./b',linkKind:'require',resolvedPath:'src/b.js',evidence:{location:{available:true,path:'src/a.js',line:1}}}],total:1,truncatedByAdapter:false},endpoints:{items:[],total:0,truncatedByAdapter:false},endpointCalls:{items:[],total:0,truncatedByAdapter:false},storage:{items:[],total:0,truncatedByAdapter:false},entrypoints:{items:[],total:0,truncatedByAdapter:false},unknowns:{items:[],total:0,truncatedByAdapter:false}};
 const phases=[{phase:'container_run',command:'docker start',ms:5,ok:true},{phase:'cleanup',command:'docker rm -f',ms:2,ok:true}];
 const valid=()=>({status:'partial',stderr:'',adapter:{adapter:'1',status:'partial',rea:{version:'6.4.0',operation:'analyze-javascript-application',exitCode:0,error:null},staged:approvedStaged,workspaceUnchanged:true,findings,phases:[]},diagnostics:{runner:'rea-job/1',executionStatus:'partial',cleanupConfirmed:true,totalMs:10,phases}});
 // Queue → claim → submit one result; returns the server response, stored run and explanation outcome.
 async function submit(result){
  await db.prepare('DELETE FROM request_limits').run(); // the per-minute owner limit stays in force; this test just exceeds a human's pace
  const q=await ok(await call('/api/engineering-runner/rea-analyze',{method:'POST',body:{projectId:id,paths,approved:true,fingerprint:preview.fingerprint}}));
  const {job}=await ok(await device('poll',poll));assert.equal(job.id,q.id);
  const accepted=await ok(await device('rea-result',{id:job.id,result}));
  const run=await ok(await call('/api/engineering-runner/rea-run?id='+job.id));
  const before=geminiCalls;const explain=await call('/api/engineering',{method:'POST',body:{mode:'research',model:'openai/gpt-oss-20b',investigation:'rea',reaRunId:job.id,messages:[{role:'user',content:'Explain'}]}});
  return {jobId:job.id,accepted,run,explainStatus:explain.status,geminiCalled:geminiCalls>before};
 }
 const expectInvalid=async(label,result,check)=>{const r=await submit(result);
  assert.equal(r.accepted.accepted,true,label+': recorded so diagnostics are preserved');assert.equal(r.accepted.status,'invalid_result',label);assert.equal(r.accepted.usable,false,label);
  if(check)assert.ok(r.accepted.failedChecks.includes(check),label+' → '+r.accepted.failedChecks);
  assert.equal(r.run.status,'invalid_result',label+': stored status is not complete/partial');assert.equal(r.run.usable,false,label);assert.equal(r.run.analysis.reportedStatus,result.status,label+': reported status kept');
  assert.ok(r.run.analysis.diagnostics.phases.length>0,label+': diagnostics preserved');assert.equal(r.explainStatus,400,label+': explanation refused');assert.equal(r.geminiCalled,false,label+': Gemini not called');return r;};
 // Control: a consistent result is usable and explainable.
 const control=await submit(valid());assert.equal(control.accepted.status,'partial');assert.equal(control.accepted.usable,true);assert.deepEqual(control.accepted.failedChecks,[]);assert.equal(control.run.usable,true);assert.equal(control.explainStatus,200);assert.equal(control.geminiCalled,true);
 // Each condition on its own.
 await expectInvalid('wrong staged hash',{...valid(),adapter:{...valid().adapter,staged:approvedStaged.map((f,i)=>i?f:{...f,sha256:'f'.repeat(64)})}},'staged_files_match_approval');
 await expectInvalid('wrong staged paths',{...valid(),adapter:{...valid().adapter,staged:[...approvedStaged,{path:'src/extra.js',sha256:'e'.repeat(64),bytes:1}]}},'staged_files_match_approval');
 await expectInvalid('missing staged list',{...valid(),adapter:{...valid().adapter,staged:undefined}},'staged_files_match_approval');
 await expectInvalid('workspace changed',{...valid(),adapter:{...valid().adapter,workspaceUnchanged:false}},'workspace_unchanged');
 await expectInvalid('cleanup unconfirmed',{...valid(),diagnostics:{...valid().diagnostics,cleanupConfirmed:false}},'cleanup_confirmed');
 await expectInvalid('wrong REA version',{...valid(),adapter:{...valid().adapter,rea:{...valid().adapter.rea,version:'6.3.0'}}},'rea_version');
 await expectInvalid('wrong REA operation',{...valid(),adapter:{...valid().adapter,rea:{...valid().adapter.rea,operation:'trace-application-feature'}}},'rea_operation');
 await expectInvalid('no findings',{...valid(),status:'complete',adapter:{...valid().adapter,status:'complete',findings:null}},'findings_present');
 // The reviewer's combined case.
 const combined=await expectInvalid('combined (complete + mismatch + changed + unconfirmed)',{...valid(),status:'complete',adapter:{...valid().adapter,status:'complete',staged:[{path:'src/a.js',sha256:'0'.repeat(64),bytes:1}],workspaceUnchanged:false},diagnostics:{...valid().diagnostics,cleanupConfirmed:false}});
 for(const c of ['staged_files_match_approval','workspace_unchanged','cleanup_confirmed'])assert.ok(combined.accepted.failedChecks.includes(c),c);
 // A genuine failure keeps its own status and diagnostics and is not explainable.
 const failed=await submit({...valid(),status:'failed',adapter:{...valid().adapter,status:'failed',findings:null,rea:{...valid().adapter.rea,exitCode:1,error:{code:'capability_unavailable',category:'unsupported_provider',message:'spawn ps ENOENT'}}}});
 assert.equal(failed.run.status,'failed');assert.equal(failed.run.usable,false);assert.equal(failed.run.analysis.adapter.rea.error.code,'capability_unavailable');assert.equal(failed.explainStatus,400);assert.equal(failed.geminiCalled,false);
 // Defence in depth: tampering with the stored record after acceptance makes the run ineligible again.
 const bucket=await mf.getR2Bucket('FILES'),key='projects/'+id+'/rea/'+control.jobId+'.json',rec=await (await bucket.get(key)).json();
 await bucket.put(key,JSON.stringify({...rec,diagnostics:{...rec.diagnostics,cleanupConfirmed:false}}));
 const tampered=await call('/api/engineering',{method:'POST',body:{mode:'research',model:'openai/gpt-oss-20b',investigation:'rea',reaRunId:control.jobId,messages:[{role:'user',content:'Explain'}]}});
 assert.equal(tampered.status,400);assert.equal((await ok(await call('/api/engineering-runner/rea-run?id='+control.jobId))).usable,false);
 const history=(await ok(await call('/api/engineering-runner/status'))).history.filter(h=>h.kind==='rea');assert.equal(history.filter(h=>h.status==='invalid_result').length,9);
 console.log('PASS REA result integrity (built Worker + Miniflare D1/R2; HP simulated, Gemini mocked and counted): valid control usable and explained; separately — wrong staged hash, wrong staged paths, missing staged list, workspace changed, cleanup unconfirmed, wrong REA version, wrong operation, missing findings — and the combined case are recorded as invalid_result with diagnostics and the reported status preserved, never usable and never sent to Gemini; a real failure keeps its status and error; tampering with the stored record after acceptance is caught at explanation time.');
}finally{await mf.dispose();fs.rmSync(tmp,{recursive:true,force:true});}
