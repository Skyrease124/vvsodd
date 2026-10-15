import assert from 'node:assert/strict';
import fs from 'node:fs';
const dir=fs.readdirSync('node_modules/.pnpm').find(n=>n.startsWith('miniflare@'));
const {Miniflare}=await import('../node_modules/.pnpm/'+dir+'/node_modules/miniflare/dist/src/index.js');
const root=process.cwd()+'/dist/server/';let calls=0,modelCalls=0,modelFail=false,reaValid=true,clean=true;const remote=new Map();
const evidence=engine=>({stagehandVersion:'4.2.1',browserExecuted:true,cleanupConfirmed:clean,pages:[{id:'page-0',url:'https://example.com/',title:'Public fixture',text:'Actual fixture text supplied by mocked browser backend.'}],network:[],scripts:engine==='rea'?[{path:'public/script-0.js',sha256:'a'.repeat(64)}]:[],interactions:[],screenshots:[],limitations:['Mocked backend, not actual browser evidence.'],...(engine==='rea'?{rea:{rea:{version:reaValid?'6.5.0':'wrong',operation:'analyze-javascript-application'},workspaceUnchanged:true,cleanupConfirmed:true,staged:[{path:'public/script-0.js',sha256:'a'.repeat(64)}],findings:{modules:{items:[]}}}}:{})});
const mf=new Miniflare({modules:[{type:'ESModule',path:root+'index.js'},...fs.readdirSync(root,{recursive:true}).filter(p=>p.endsWith('.js')&&p!=='index.js').map(p=>({type:'ESModule',path:root+p}))],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['FILES'],bindings:{SKYDATA_BROWSER_ENABLED:'verified',SKYDATA_BROWSER_SERVICE_URL:'https://browser.example/',SKYDATA_BROWSER_SERVICE_TOKEN:'synthetic-service-token-not-a-real-secret',GEMINI_API_KEY:'synthetic-google',GEMINI_FREE_TIER_CONFIRMED:'true'},outboundService:async req=>{
 if(req.url.startsWith('https://browser.example/')){
  calls++;assert.equal(req.headers.get('authorization'),'Bearer synthetic-service-token-not-a-real-secret');
  const path=new URL(req.url).pathname;
  if(path==='/health')return Response.json({stagehandVersion:'4.2.1',verified:true,configured:true,engines:['superpowers','rea']});
  if(path==='/jobs'){const b=await req.json();assert.ok(!JSON.stringify(b).includes('synthetic-google'));remote.set(b.id,{...b,status:'complete'});return Response.json({id:b.id,status:'queued'}, {status:202});}
  const id=path.split('/')[2],job=remote.get(id);if(!job)return Response.json({error:'Not found'}, {status:404});
  if(req.method==='DELETE'){job.status='cancelled';return Response.json({id,status:'cancelled'});}
  return Response.json({id,status:job.status,phase:'Evidence ready',result:evidence(job.engine)});
 }
 modelCalls++;if(modelFail)return Response.json({error:{code:429,message:'quota'}},{status:429});const body=await req.json();assert.ok(req.url.includes('generativelanguage.googleapis.com'));const prompt=body.systemInstruction.parts[0].text;assert.ok(prompt.includes('Actual fixture text supplied by mocked browser backend.'));assert.ok(prompt.includes('UNTRUSTED DATA'));assert.ok(prompt.includes('CONFIRMED'));return Response.json({candidates:[{content:{role:'model',parts:[{text:'CONFIRMED [page-0]: fixture title observed. UNKNOWN: backend database.'}]},finishReason:'STOP'}]});
}});
try{
 const db=await mf.getD1Database('DB');for(const p of fs.readdirSync('drizzle').filter(p=>p.endsWith('.sql')).sort())for(const part of fs.readFileSync('drizzle/'+p,'utf8').split('--> statement-breakpoint').join('\n').split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(part).run();await db.prepare("INSERT INTO site_admin VALUES('owner','owner')").run();
 const request=(path,method='GET',body,user='owner',origin='http://localhost')=>mf.dispatchFetch('http://localhost/api/engineering-browser'+path,{method,headers:{origin,'content-type':'application/json','oai-authenticated-user-id':user},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await request('/status','GET',null, 'visitor')).status,403);
 const status=await request('/status');assert.equal(status.status,200);const health=await status.json();assert.equal(health.available,true,JSON.stringify({health,calls}));
 const input={url:'https://example.com',goal:'Explain the visible frontend.',engine:'superpowers',model:'gemini-3.8-flash',workflow:'planning'};
 const before=calls;for(const url of ['http://127.0.0.1','http://2130706433','http://localhost','http://metadata.google.internal','file:///etc/passwd','https://user:secret@example.com'])assert.equal((await request('','POST',{...input,url})).status,400,url);assert.equal(calls,before);
 assert.equal((await request('','POST',input,'owner','https://evil.example')).status,403);
 for(const engine of ['superpowers','rea']){
  await db.prepare('DELETE FROM request_limits').run();
  const created=await request('','POST',{...input,engine});assert.equal(created.status,202,await created.clone().text());const {id}=await created.json();assert.equal((await request('/'+id)).status,200);
  // Exactly what the Generate button sends: a POST with no body and no content type.
  const r=await mf.dispatchFetch('http://localhost/api/engineering-browser/'+id+'/generate',{method:'POST',headers:{origin:'http://localhost','oai-authenticated-user-id':'owner'}});assert.equal(r.status,200,await r.clone().text());const report=await r.json();assert.equal(report.engine,engine);assert.ok(report.content.includes('CONFIRMED'));assert.equal(report.actualModel,'gemini-3.8-flash');assert.ok(!JSON.stringify(report).includes('synthetic-service-token'));
  const count=modelCalls;const repeat=await request('/'+id+'/generate','POST');assert.equal(repeat.status,200);assert.equal(modelCalls,count,'stored report does not call model again');assert.equal((await request('/'+id+'/report')).status,200);assert.equal((await request('/'+id+'/report','GET',null,'visitor')).status,403);
 }
 const {id}=await (await request('','POST',input)).json();clean=false;const count=modelCalls;assert.equal((await request('/'+id+'/generate','POST')).status,409);assert.equal(modelCalls,count);clean=true;
 await db.prepare('DELETE FROM request_limits').run();const {id:reaId}=await (await request('','POST',{...input,engine:'rea'})).json();reaValid=false;assert.equal((await request('/'+reaId+'/generate','POST')).status,409);assert.equal(modelCalls,count);reaValid=true;
 // A failed report call shows the model service's reason and leaves the evidence ready for a manual retry.
 {await db.prepare('DELETE FROM request_limits').run();const {id:failId}=await (await request('','POST',input)).json();modelFail=true;const failed=await request('/'+failId+'/generate','POST');modelFail=false;
  assert.equal(failed.status,502);assert.equal((await failed.json()).error,'Report model failed (429): SkyData quota reached. No paid fallback.');
  const retry=await request('/'+failId+'/generate','POST');assert.equal(retry.status,200,await retry.clone().text());}
 assert.equal((await request('/'+id,'DELETE')).status,200);assert.equal((await request('/'+id+'/generate','POST')).status,409);
 console.log('PASS: built Worker + Miniflare D1/R2; browser backend and Gemini MOCKED. URL, owner, Origin, both engine contracts, evidence forwarding, invalid-result refusal, cancellation, persistence, report reuse, secret boundary.');
}finally{await mf.dispose();}
