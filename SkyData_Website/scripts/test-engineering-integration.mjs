import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
const require=createRequire(import.meta.url);
const dir=fs.readdirSync('node_modules/.pnpm').find(x=>x.startsWith('esbuild@'));
const esbuild=await import('../node_modules/.pnpm/'+dir+'/node_modules/esbuild/lib/main.js');
await esbuild.build({entryPoints:['lib/engineering.ts'],bundle:true,platform:'node',format:'cjs',packages:'external',outfile:'node_modules/.cache/engineering-integration.cjs'});
const {handleEngineering}=require('../node_modules/.cache/engineering-integration.cjs');
const sql=new DatabaseSync(':memory:');for(const p of fs.readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+p,'utf8'));sql.exec("INSERT INTO site_admin VALUES('owner','owner')");
const DB={prepare(s){const stmt=sql.prepare(s);let values=[];const self={bind(...v){values=v;return self},async first(){return stmt.get(...values)||null},async all(){return {results:stmt.all(...values)}},async run(){return stmt.run(...values)}};return self}};
const env={DB,GEMINI_API_KEY:'synthetic-key',GEMINI_FREE_TIER_CONFIRMED:'true'};
const req=(model,user='owner',origin='https://skydata.test')=>new Request('https://skydata.test/api/engineering',{method:'POST',headers:{origin,'content-type':'application/json','oai-authenticated-user-id':user},body:JSON.stringify({model,mode:'research',workflow:'debugging',messages:[{role:'user',content:'Investigate this error without editing files.'}]})});
let calls=0;const old=globalThis.fetch;
globalThis.fetch=async(input,init)=>{calls++;const url=String(input);assert.ok(url.includes('gemini-3.8-flash:generateContent'));const body=JSON.parse(init.body);assert.ok(body.systemInstruction.parts[0].text.includes('NO EXECUTION'));assert.ok(body.systemInstruction.parts[0].text.includes('Systematic Debugging'));assert.ok(!body.tools);return Response.json({candidates:[{content:{role:'model',parts:[{text:'Evidence is insufficient. Provide the error trace. Tests NOT_RUN.'}]},finishReason:'STOP'}]});};
try{
assert.equal((await handleEngineering(req('openai/gpt-oss-20b','member'),env)).status,403);assert.equal(calls,0);
assert.equal((await handleEngineering(req('openai/gpt-oss-20b','owner','https://evil.test'),env)).status,403);assert.equal(calls,0);
for(const model of ['nvidia/nemotron-3-ultra-550b-a55b','nvidia/nemotron-3.5-lightning-30b-a3b','openai/gpt-oss-20b']){const response=await handleEngineering(req(model),env);assert.equal(response.status,200,await response.clone().text());const data=await response.json();assert.equal(data.selectedModel,model);assert.equal(data.actualModel,'gemini-3.8-flash');assert.ok(data.content.includes('Tests NOT_RUN'));assert.equal(data.tests.status,'NOT_RUN');}
assert.equal(calls,3);
assert.equal((await handleEngineering(req('openai/gpt-oss-20b'),{...env,GEMINI_FREE_TIER_CONFIRMED:'false'})).status,502);assert.equal(calls,3);
assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM projects').get().n,0);
console.log('PASS real engineering handler → existing handleChat → Gemini SDK request → response, all three selections; real SQLite owner checks and free-tier fail-closed behavior. Only external inference mocked; no live model health claim.');
}finally{globalThis.fetch=old;}
