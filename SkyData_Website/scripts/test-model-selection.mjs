import assert from 'node:assert/strict';
import fs from 'node:fs';
const dir=fs.readdirSync('node_modules/.pnpm').find(n=>n.startsWith('miniflare@'));
const {Miniflare}=await import('../node_modules/.pnpm/'+dir+'/node_modules/miniflare/dist/src/index.js');
const root=process.cwd()+'/dist/server/';
const calls=[];let expectedNatural=false;
const models=['nvidia/nemotron-3-ultra-550b-a55b','nvidia/nemotron-3.5-lightning-30b-a3b','openai/gpt-oss-20b','nvidia/nemotron-3.5-super-vl-120b-a12b'];
const mf=new Miniflare({modules:[{type:'ESModule',path:root+'index.js'},...fs.readdirSync(root,{recursive:true}).filter(p=>p.endsWith('.js')&&p!=='index.js').map(p=>({type:'ESModule',path:root+p}))],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['FILES'],bindings:{NVIDIA_API_KEY:'synthetic-nvidia',GEMINI_API_KEY:'synthetic-google',GEMINI_FREE_TIER_CONFIRMED:'true'},outboundService:async req=>{
 const body=await req.json();const google=req.url.includes('generativelanguage.googleapis.com');
 const system=google?body.systemInstruction.parts[0].text:body.messages[0].content;assert.equal(system.includes('Natural writing is enabled'),expectedNatural,'optional style reaches the actual provider');
 const model=google?'gemini-3.8-flash':body.model;calls.push({google,model});
 if(google){assert.ok(req.url.includes('/models/gemini-3.8-flash:'));assert.equal(req.headers.get('x-goog-api-key'),'synthetic-google');}
 else {assert.equal(req.url,'https://integrate.api.nvidia.com/v1/chat/completions');assert.equal(req.headers.get('authorization'),'Bearer synthetic-nvidia');}
 const data=google?{candidates:[{content:{role:'model',parts:[{text:'Selected provider reply.'}]},finishReason:'STOP'}]}:{choices:[{message:{content:'Selected provider reply.'}}]};
 if(body.stream||req.url.includes(':streamGenerateContent'))return new Response('data: '+JSON.stringify(google?data:{choices:[{delta:{content:'Selected provider reply.'}}]})+'\n\n'+(google?'':'data: [DONE]\n\n'),{headers:{'content-type':'text/event-stream'}});
 return Response.json(data);
}});
try{
 const db=await mf.getD1Database('DB');for(const p of fs.readdirSync('drizzle').filter(p=>p.endsWith('.sql')).sort())for(const part of fs.readFileSync('drizzle/'+p,'utf8').split('--> statement-breakpoint').join('\n').split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(part).run();
 await db.prepare("INSERT INTO site_admin VALUES('owner','owner')").run();
 const request=(path,body)=>mf.dispatchFetch('http://localhost'+path,{method:'POST',headers:{origin:'http://localhost','content-type':'application/json','oai-authenticated-user-id':'owner','oai-authenticated-user-email':'skyariasa@gmail.com'},body:JSON.stringify(body)});
 for(const model of models)for(const naturalWriting of [false,true,undefined]){
  await db.prepare("DELETE FROM request_limits").run(); // Each routing case is independent of rate-limit tests.
  expectedNatural=naturalWriting!==false;
  for(const extra of [{},{coding:true},{interpreter:true,replyLanguage:'es'},{stream:true}]){
   const before=calls.length;const response=await request('/api/chat',{model,naturalWriting,messages:[{role:'user',content:'Say hello briefly.'}],...extra});
   assert.equal(response.status,200,await response.clone().text());
   const text=await response.text();assert.ok(text.includes('Selected provider reply.'));assert.ok(text.includes(model),'actual model is reported');
   assert.equal(calls.length,before+1);assert.equal(calls.at(-1).model,model);assert.equal(calls.at(-1).google,model==='gemini-3.8-flash');
  }
  const response=await request('/api/engineering',{model,naturalWriting,mode:'research',workflow:'review',messages:[{role:'user',content:'Review the design.'}]});if(model==='gemini-3.8-flash')assert.equal(response.status,400,'Engineering refuses Gemini');else{assert.equal(response.status,200,await response.clone().text());const data=await response.json();assert.equal(data.actualModel,model);assert.equal(data.actualProvider,'NVIDIA');}
  const debate=await request('/api/debate',{naturalWriting,topic:'Small focused changes are helpful',models:[model,model===models[0]?models[1]:models[0]],turns:[]});assert.equal(debate.status,200,await debate.clone().text());assert.ok((await debate.text()).includes(model));assert.equal(calls.at(-1).model,model);
 }
 const before=calls.length;const invalid=await request('/api/chat',{model:models[0],naturalWriting:'yes',messages:[{role:'user',content:'Hi'}]});assert.equal(invalid.status,400);assert.equal(calls.length,before);
 const status=await (await mf.dispatchFetch('http://localhost/api/status',{headers:{'oai-authenticated-user-id':'owner'}})).json();assert.equal(status.configured,true);assert.ok(!status.models.some(m=>m.id==='gemini-3.8-flash'),'Gemini is not offered');assert.ok(status.models.some(m=>m.id==='nvidia/nemotron-3.5-super-vl-120b-a12b'));{const before=calls.length;const g=await request('/api/chat',{model:'gemini-3.8-flash',messages:[{role:'user',content:'Hi'}]});assert.equal(g.status,503,'Gemini chat is refused');assert.equal(calls.length,before);}
 console.log('PASS built Worker: all four selections (three NVIDIA models and Nemotron 3.5 Super VL) reach NVIDIA in chat, coding, translation and streaming; Engineering uses the three NVIDIA models and refuses Gemini; truthful returned model; Gemini is not offered and is refused; Natural writing on/off reaches each provider with default-on behavior and without extra inference calls; invalid flags rejected. Inference mocked.');
}finally{await mf.dispose();}
