import assert from 'node:assert/strict';
import fs from 'node:fs';
const dir=fs.readdirSync('node_modules/.pnpm').find(n=>n.startsWith('miniflare@'));
const {Miniflare}=await import('../node_modules/.pnpm/'+dir+'/node_modules/miniflare/dist/src/index.js');
const root=process.cwd()+'/dist/server/';let calls=0;
const mf=new Miniflare({modules:[{type:'ESModule',path:root+'index.js'},...fs.readdirSync(root,{recursive:true}).filter(p=>p.endsWith('.js')&&p!=='index.js').map(p=>({type:'ESModule',path:root+p}))],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['FILES'],bindings:{GEMINI_API_KEY:'synthetic-key',GEMINI_FREE_TIER_CONFIRMED:'true'},outboundService:async req=>{calls++;assert.ok(req.url.includes('gemini-3.8-flash:generateContent'));const b=await req.json();assert.ok(b.systemInstruction.parts[0].text.includes('NO EXECUTION'));return Response.json({candidates:[{content:{role:'model',parts:[{text:'Worker fixture analysis. Tests NOT_RUN.'}]},finishReason:'STOP'}]});}});
try{
 const db=await mf.getD1Database('DB');for(const p of fs.readdirSync('drizzle').filter(p=>p.endsWith('.sql')).sort()){const sql=fs.readFileSync('drizzle/'+p,'utf8').split('--> statement-breakpoint').join('\n');for(const part of sql.split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(part).run();}
 await db.prepare("INSERT INTO site_admin VALUES('owner','owner')").run();
 await db.prepare("INSERT INTO members(email,user_id,status,created) VALUES('member@test.com','member','approved',0)").run();
 const req=(user='owner',origin='http://localhost',extra={})=>mf.dispatchFetch('http://localhost/api/engineering',{method:'POST',headers:{origin,'content-type':'application/json','oai-authenticated-user-id':user,'oai-authenticated-user-email':user==='owner'?'skyariasa@gmail.com':'member@test.com'},body:JSON.stringify({mode:'research',workflow:'review',model:'openai/gpt-oss-20b',messages:[{role:'user',content:'Review code'}],...extra})});
 assert.equal((await req('anonymous')).status,403);assert.equal((await req('member')).status,403);assert.equal(calls,0);
 assert.equal((await req('owner','http://evil.test')).status,403);assert.equal(calls,0);
 const response=await req();assert.equal(response.status,200,await response.clone().text());const data=await response.json();assert.equal(data.actualModel,'gemini-3.8-flash');assert.equal(data.tests.status,'NOT_RUN');assert.equal(data.modificationsApplied,false);assert.equal(calls,1);
 assert.equal((await req('owner','http://localhost',{action:'execute'})).status,400);assert.equal(calls,1);
 await db.prepare("UPDATE request_limits SET count=12 WHERE id='owner:/api/engineering'").run();assert.equal((await req()).status,429);assert.equal(calls,1);
 console.log('PASS built Worker runtime: membership, owner-only API, Origin gate, existing Gemini SDK request, truthful results, execution rejection and D1 rate limit. External inference mocked.');
}finally{await mf.dispose();}
