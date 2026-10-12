import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,writeFileSync,unlinkSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const esbuildDir=readdirSync('node_modules/.pnpm').find(n=>n.startsWith('esbuild@'));
const esbuild=await import('../node_modules/.pnpm/'+esbuildDir+'/node_modules/esbuild/lib/main.js');
const bundled=await esbuild.build({entryPoints:['lib/polly.ts','lib/voice-config.ts','lib/gemini-live.ts','lib/gemini-provider.ts','lib/nvidia.ts','lib/models.ts'],bundle:true,packages:'external',platform:'node',format:'cjs',write:false,outdir:'/tmp/polly-test'});
const modules=bundled.outputFiles.map((file,i)=>{const p=process.cwd()+'/node_modules/.cache/polly-test-'+i+'.cjs';writeFileSync(p,file.text);const module=require(p);unlinkSync(p);return module;});
const {handleChat}=modules[4],{VISIBLE_MODELS}=modules[5];
const {pollyConnectionDiagnostic}=modules[0];
assert.deepEqual(pollyConnectionDiagnostic({name:'AccessDeniedException',message:'synthetic-secret-must-not-leak',$metadata:{httpStatusCode:403}}),{name:'AccessDeniedException',category:'permission',httpStatus:403});
assert.equal(pollyConnectionDiagnostic(new TypeError('fetch failed')).category,'network');
assert.equal(pollyConnectionDiagnostic(new ReferenceError('crypto is not defined')).category,'runtime');
assert.equal(pollyConnectionDiagnostic({name:'synthetic-secret-must-not-leak',message:'synthetic-secret-must-not-leak'}).name,'UnknownError');
const {pollySpeech,pollyManagement,pollyVoices,pollyInput,pollyError}=modules[0],{DEFAULT_VOICE_SETTINGS,voiceSettings,normalizeVoiceSettings}=modules[1],{geminiToken}=modules[2],{geminiSpeech}=modules[3];
const sql=new DatabaseSync(':memory:');
for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+file,'utf8'));
sql.exec("INSERT INTO site_admin (id,owner) VALUES ('owner','owner')");
class Prepared{constructor(query,args=[]){this.query=query;this.args=args;}bind(...args){return new Prepared(this.query,args);}async first(){return sql.prepare(this.query).get(...this.args)||null;}async all(){return {results:sql.prepare(this.query).all(...this.args)};}async run(){const r=sql.prepare(this.query).run(...this.args);return {meta:{changes:Number(r.changes)},success:true};}}
const objects=new Map();
const env={DB:{prepare:q=>new Prepared(q),batch:async statements=>{sql.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}},FILES:{async get(key){const o=objects.get(key);return o?{body:o.bytes,customMetadata:o.customMetadata}:null;},async put(key,bytes,options){objects.set(key,{bytes:new Uint8Array(bytes),...options});}},GEMINI_API_KEY:'synthetic-google-key',GEMINI_FREE_TIER_CONFIRMED:'true'};
const voices=[{Id:'Joanna',Name:'Joanna',LanguageCode:'en-US',LanguageName:'US English',SupportedEngines:['standard','neural','generative']},{Id:'Danielle',Name:'Danielle',LanguageCode:'en-US',SupportedEngines:['long-form','generative']}];
const origin='https://skydata.test';
function req(path,body,user='owner',requestOrigin=origin){return new Request(origin+path,{method:body===undefined?'GET':'POST',headers:{origin:requestOrigin,'oai-authenticated-user-id':user,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});}
let calls=[];
const api={async send(command){calls.push(command);if(command.constructor.name==='DescribeVoicesCommand')return {Voices:voices};assert.equal(command.input.OutputFormat,'mp3');assert.equal(command.input.SampleRate,'24000');return {AudioStream:{transformToByteArray:async()=>new Uint8Array([73,68,51,1,2,3])}};}};
async function set(settings){const r=await pollyManagement(req('/api/polly-settings',settings),env,api);assert.equal(r.status,200,await r.clone().text());}
assert.equal((await voiceSettings(env)).provider,'polly');
let googleCalls=0;const oldFetch=globalThis.fetch;globalThis.fetch=async()=>{googleCalls++;throw Error('should not be reached');};
assert.equal((await geminiSpeech(req('/api/voice',{text:'Hello'}),env)).status,503);
assert.equal((await geminiToken(req('/api/gemini-token',{}),env)).status,503);assert.equal(googleCalls,0,'Disabled Gemini produces zero requests');globalThis.fetch=oldFetch;
assert.equal((await pollySpeech(req('/api/voice',{text:'Hello'},''),env,false,api)).status,403);
assert.equal((await pollyManagement(req('/api/polly-settings',DEFAULT_VOICE_SETTINGS,'member'),env,api)).status,403);
assert.equal((await pollySpeech(req('/api/polly-preview',{text:'Hello',engine:'standard',voice:'Joanna'},'member'),env,true,api)).status,403);
assert.equal((await pollySpeech(req('/api/voice',{text:'Hello'},'member','https://evil.test'),env,false,api)).status,403);
for(const engine of ['standard','neural','long-form','generative']){
 const voice=engine==='long-form'?'Danielle':'Joanna';await set({...DEFAULT_VOICE_SETTINGS,engine,voice});
 const r=await pollySpeech(req('/api/voice',{text:'Hello '+engine,voice:'Spoofed',engine:'garbage'},'member'),env,false,api);assert.equal(r.status,200,await r.clone().text());assert.equal(r.headers.get('content-type'),'audio/mpeg');
 const input=calls.at(-1).input;assert.equal(input.Engine,engine);assert.equal(input.VoiceId,voice,'Members cannot override owner voice');
}
assert.equal(sql.prepare('SELECT SUM(requests) n FROM polly_months').get().n,4);
const before=calls.length;const incompatible=await pollySpeech(req('/api/polly-preview',{text:'Hello',engine:'long-form',voice:'Joanna'}),env,true,api);assert.equal(incompatible.status,400);assert.equal(calls.filter(c=>c.constructor.name==='SynthesizeSpeechCommand').length,4);
await set({...DEFAULT_VOICE_SETTINGS});
const saved=JSON.stringify(await voiceSettings(env));const preview=await pollySpeech(req('/api/polly-preview',{text:'Private preview',engine:'long-form',voice:'Danielle'}),env,true,api);assert.equal(preview.status,200);assert.equal(JSON.stringify(await voiceSettings(env)),saved,'Preview must not change global settings');
const synthesisCount=()=>calls.filter(c=>c.constructor.name==='SynthesizeSpeechCommand').length;
const count=synthesisCount();assert.equal((await pollySpeech(req('/api/polly-preview',{text:'Private preview',engine:'long-form',voice:'Danielle'}),env,true,api)).status,200);assert.equal(synthesisCount(),count,'Identical replay uses cached audio');
assert.equal((await pollySpeech(req('/api/polly-preview',{text:'Private preview',engine:'long-form',voice:'Danielle'},'member'),env,true,api)).status,403);
assert.equal((await pollySpeech(req('/api/voice',{text:'Private preview',engine:'long-form',voice:'Danielle'},'member'),env,false,api)).status,200);assert.equal(synthesisCount(),count+1,'Different member cannot receive another user’s private cached audio');
await set({...DEFAULT_VOICE_SETTINGS,enabled:false});assert.equal((await pollySpeech(req('/api/voice',{text:'Disabled'}),env,false,api)).status,503);
const characters=sql.prepare('SELECT SUM(characters) n FROM polly_months').get().n;await set({...DEFAULT_VOICE_SETTINGS,monthlyCharacters:characters});const capped=await pollySpeech(req('/api/voice',{text:'Would exceed cap'}),env,false,api);assert.equal(capped.status,429);assert.equal((await capped.json()).code,'USAGE_LIMIT');
const price={standard:4,neural:16,'long-form':100,generative:30};assert.throws(()=>normalizeVoiceSettings({...DEFAULT_VOICE_SETTINGS,monthlyBudget:1}));
await set({...DEFAULT_VOICE_SETTINGS,prices:price,monthlyBudget:1});assert.equal((await pollySpeech(req('/api/voice',{text:'Unpriced history must block spending cap'}),env,false,api)).status,429);
sql.exec('DELETE FROM polly_months');await set({...DEFAULT_VOICE_SETTINGS,prices:price,monthlyBudget:.00001});assert.equal((await pollySpeech(req('/api/voice',{text:'Too expensive'}),env,false,api)).status,429);
await set({...DEFAULT_VOICE_SETTINGS,prices:price});
let resolveSynthesis;const blocking={async send(command){if(command.constructor.name==='DescribeVoicesCommand')return {Voices:voices};return new Promise(resolve=>{resolveSynthesis=resolve;});}};
const first=pollySpeech(req('/api/voice',{text:'Concurrent sample'}),env,false,blocking);while(!resolveSynthesis)await new Promise(r=>setTimeout(r,1));
const second=await pollySpeech(req('/api/voice',{text:'Concurrent sample'}),env,false,blocking);assert.equal(second.status,429);assert.equal((await second.json()).code,'IN_PROGRESS');resolveSynthesis({AudioStream:{transformToByteArray:async()=>new Uint8Array([1,2,3])}});assert.equal((await first).status,200);
const failing={async send(command){if(command.constructor.name==='DescribeVoicesCommand')return {Voices:voices};throw Object.assign(Error('synthetic-secret-must-not-leak'),{name:'AccessDeniedException'});}};
const failed=await pollySpeech(req('/api/voice',{text:'Failure sample'}),env,false,failing);assert.equal(failed.status,403);assert.ok(!(await failed.text()).includes('synthetic-secret'));assert.ok(sql.prepare("SELECT COUNT(*) n FROM polly_activity WHERE status='failed'").get().n>0);
const input=pollyInput('<unsafe> & text',{...DEFAULT_VOICE_SETTINGS,speed:.85},voices[0]);assert.equal(input.TextType,'ssml');assert.match(input.Text,/&lt;unsafe&gt; &amp; text/);assert.match(input.Text,/85%/);assert.equal(pollyInput('Sentence.',{...DEFAULT_VOICE_SETTINGS,engine:'generative',speed:.85},voices[0]).TextType,'text');
let pages=0;const paged=await pollyVoices(env,{async send(command){pages++;return command.input.NextToken?{Voices:[voices[1]]}:{Voices:[voices[0]],NextToken:'next'};}});assert.equal(pages,2);assert.equal(paged.length,2);
const dashboard=await (await pollyManagement(req('/api/polly-settings'),env,api)).json();assert.ok(dashboard.usage.byEngine.length);assert.ok(dashboard.usage.failures);assert.equal(dashboard.region,'us-east-1');assert.ok(!JSON.stringify(dashboard).includes('synthetic-google-key'));
console.log('PASS: real SQLite migrations; owner-only controls/previews; 4 engines; compatibility; saved global voice; private replay cache; concurrency deduplication; atomic character/dollar limits; sanitized failures; usage records; SSML escaping; catalog pagination; disabled Gemini zero requests. AWS responses mocked.');

assert.equal(VISIBLE_MODELS.length,3);
globalThis.fetch=async(input,init)=>{assert.ok(String(input).startsWith('https://generativelanguage.googleapis.com/'));const payload=JSON.parse(init.body);assert.ok(payload.contents.some(c=>c.parts.some(p=>p.text==='Explain a chair.')));return Response.json({candidates:[{content:{role:'model',parts:[{text:'A chair is a piece of furniture designed for sitting.'}]},finishReason:'STOP'}]});};
const {geminiUpstream}=modules[3];
for(const model of VISIBLE_MODELS){const reply=await handleChat(req('/api/chat',{messages:[{role:'user',content:'Explain a chair.'}],model:model.id,stream:false}),undefined,undefined,geminiUpstream(env),env,undefined,true);assert.equal(reply.status,200,await reply.clone().text());assert.ok((await reply.json()).content.includes('chair'));}
globalThis.fetch=oldFetch;
console.log('PASS: all three existing model selections still respond through the preserved text routing while Gemini audio is disabled. Text provider mocked.');
