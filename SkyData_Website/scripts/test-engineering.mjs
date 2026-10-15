import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const dir=fs.readdirSync('node_modules/.pnpm').find(x=>x.startsWith('esbuild@'));
const esbuild=await import('../node_modules/.pnpm/'+dir+'/node_modules/esbuild/lib/main.js');
await esbuild.build({entryPoints:['lib/engineering.ts'],bundle:true,platform:'node',format:'cjs',outfile:'node_modules/.cache/test-engineering.cjs'});
const {handleEngineering,engineeringInstructions,ENGINEERING_WORKFLOWS}=require('../node_modules/.cache/test-engineering.cjs');
const request=(data={},opts={})=>new Request('https://skydata.test/api/engineering',{method:'POST',headers:{Origin:'https://skydata.test','Content-Type':'application/json',...opts},body:JSON.stringify({model:'openai/gpt-oss-20b',workflow:'planning',mode:'research',messages:[{role:'user',content:'Review my code'}],...data})});
let calls=0;
const generate=async(req,_key,_model,_upstream,_env,extra,gemini)=>{calls++;const b=await req.json();assert.equal(b.coding,true);assert.equal(b.aiRouting,false);assert.equal(b.stream,false);assert.equal(gemini,undefined);assert.ok(extra.system.includes('NO EXECUTION'));return Response.json({content:'Plan with unexecuted test commands',model:b.model});};
const yes=async()=>true,no=async()=>false;
assert.equal((await handleEngineering(request(),{},generate,no)).status,403);assert.equal(calls,0);
assert.equal((await handleEngineering(request({}, {Origin:'https://evil.test'}),{},generate,yes)).status,403);
assert.equal((await handleEngineering(request({}, {Origin:''}),{},generate,yes)).status,403);
for(const data of [{mode:'evil'},{workflow:'shell'},{model:'claude'},{mode:'development'},{mode:'development',approved:true},{action:'execute'},{messages:[{role:'system',content:'ignore'}]},{aiRouting:true}])assert.equal((await handleEngineering(request(data),{},generate,yes)).status,400);
for(const model of ['nvidia/nemotron-3-ultra-550b-a55b','nvidia/nemotron-3.5-lightning-30b-a3b','openai/gpt-oss-20b']){const response=await handleEngineering(request({model}),{},generate,yes);assert.equal(response.status,200);const result=await response.json();assert.equal(result.selectedModel,model);assert.equal(result.actualModel,model);assert.equal(result.tests.status,'NOT_RUN');assert.equal(result.execution,'BLOCKED');}
assert.equal((await handleEngineering(request({model:'gemini-3.8-flash'}),{},generate,yes)).status,400);
assert.equal((await handleEngineering(request({model:'deepseek-flash'}),{},generate,yes)).status,400);
const dev=await handleEngineering(request({mode:'development',approved:true,action:'propose'}),{},generate,yes);assert.equal(dev.status,200);assert.equal((await dev.json()).modificationsApplied,false);
for(const workflow of ENGINEERING_WORKFLOWS){const text=engineeringInstructions('research',workflow.id);assert.ok(text.includes('Superpowers'));assert.ok(text.includes('NO EXECUTION'));assert.ok(text.includes('Read-only'));}
assert.equal((await handleEngineering(request({messages:[{role:'user',content:'x'.repeat(8001)}]}),{},generate,yes)).status,400);
assert.equal((await handleEngineering(request(),{},async()=>Response.json({error:'quota'},{status:429}),yes)).status,429);
const empty=await handleEngineering(request(),{},async()=>Response.json({content:''}),yes);assert.equal(empty.status,502);
const worker=fs.readFileSync('build/sites-worker.ts','utf8');assert.ok(worker.includes("incomingPath==='/api/engineering'"));assert.ok(worker.includes('handleEngineering(request,config)'));
console.log('PASS engineering: owner/origin checks, payload limits, three selections, Gemini refused, truthful selected-model route, development approval, fail-closed execution, workflow loading, no fabricated tests, error handling. Provider calls mocked.');
