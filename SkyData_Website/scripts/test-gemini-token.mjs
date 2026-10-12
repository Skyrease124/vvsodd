import assert from 'node:assert/strict';
import fs from 'node:fs';
const esbuildDir=fs.readdirSync('node_modules/.pnpm').find(name=>name.startsWith('esbuild@'));
const {build}=await import('../node_modules/.pnpm/'+esbuildDir+'/node_modules/esbuild/lib/main.js');
import {webcrypto} from 'node:crypto';
globalThis.crypto??=webcrypto;
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const bundle=await build({entryPoints:['lib/gemini-live.ts'],bundle:true,packages:'external',platform:'node',format:'cjs',write:false});
fs.mkdirSync('node_modules/.cache',{recursive:true});const target='node_modules/.cache/gemini-token-test.cjs';fs.writeFileSync(target,bundle.outputFiles[0].text);const {geminiToken,geminiConnection,geminiOriginAllowed}=require('../'+target);fs.unlinkSync(target);

let reserved=false,releases=0;
const env={SKYDATA_VOICE:'Charon',GEMINI_API_KEY:'test-secret-never-return',GEMINI_FREE_TIER_CONFIRMED:'true',DB:{prepare(sql){if(sql.includes('polly_settings'))return {first:async()=>({value:JSON.stringify({provider:'gemini',enabled:true,engine:'standard',voice:'Joanna',speed:1,monthlyCharacters:100000,monthlyBudget:null,alertPercent:80,prices:{standard:null,neural:null,'long-form':null,generative:null}})})};if(sql.includes('SELECT owner'))return {first:async()=>({owner:'owner'})};return {bind(){return {first:async()=>{if(reserved)return null;reserved=true;return {count:1};},run:async()=>{reserved=false;releases++;return {};}};}};}}};
const request=(method='POST',body={voice:'Charon'},origin='https://example.com',user='owner')=>new Request('https://example.com/api/gemini-token',{method,headers:{origin,'Content-Type':'application/json',...(user?{'oai-authenticated-user-id':user}:{})},body:JSON.stringify(body)});
let calls=0;const provider=async(key,voice)=>{calls++;assert.equal(key,env.GEMINI_API_KEY);assert.equal(voice,'Charon');return {name:'auth_tokens/test'};};
assert.equal((await geminiToken(request('POST',{},'https://evil.com'),env,provider)).status,403);
assert.equal((await geminiToken(request('POST',{},'https://example.com',''),env,provider)).status,403);
assert.equal((await geminiToken(request('POST',{voice:'Unknown'}),env,provider)).status,400);
assert.equal((await geminiToken(request(),{...env,GEMINI_FREE_TIER_CONFIRMED:'false',DB:{...env.DB,prepare(sql){if(sql.includes('polly_settings'))return {first:async()=>({value:JSON.stringify({provider:'gemini',enabled:true,engine:'standard',voice:'Joanna',speed:1,monthlyCharacters:100000,monthlyBudget:null,alertPercent:80,prices:{standard:null,neural:null,'long-form':null,generative:null}})})};if(sql.includes('SELECT owner'))return {first:async()=>({owner:'owner'})};return {bind(){return {first:async()=>null};}};}}},provider)).status,503);
const response=await geminiToken(request(),env,provider);assert.equal(response.status,200);const ticket=await response.json();assert.equal(ticket.token,'auth_tokens/test');assert.equal(ticket.maxSeconds,300);assert.ok(!JSON.stringify(ticket).includes(env.GEMINI_API_KEY));assert.equal(calls,1);
assert.equal((await geminiToken(request(),env,provider)).status,409);assert.equal(calls,1);
assert.equal((await geminiToken(request('DELETE',{lease:ticket.lease}),env,provider)).status,200);
assert.equal((await geminiToken(request(),env,async()=>{throw Error('quota');})).status,502);assert.ok(releases>=2);
console.log('PASS: mocked token provider, origin/auth/voice/free-tier guards, lease collision/release, no key leakage, quota failure cleanup. Not a live API test.');

const formEnv={SKYDATA_SECRET_KEY:'csrf-test-secret'};
const url='https://example.com/connect-gemini';
const get=new Request(url,{headers:{'oai-authenticated-user-id':'owner'}});
const page=await (await geminiConnection(get,formEnv)).text();
const csrf=page.match(/name="csrf" value="([^"]+)"/)[1];
const form=(origin,site,token=csrf,user='owner')=>new Request(url,{method:'POST',headers:{origin,'sec-fetch-site':site,'Content-Type':'application/x-www-form-urlencoded','oai-authenticated-user-id':user},body:new URLSearchParams({csrf:token,free:'yes',key:'synthetic-test-key-123456789'})});
let upstream=0;const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>{upstream++;return Response.json({error:'mock model access denial'},{status:403});};
for(const [origin,site] of [['https://example.com','same-origin'],['null','same-origin']]){const response=await geminiConnection(form(origin,site),formEnv);assert.equal(response.status,400);assert.ok((await response.text()).includes('Google could not verify'));}
assert.equal(upstream,2,'Both legitimate form flows reached mocked Google validation');
for(const [origin,site] of [['null','cross-site'],['null','none'],['https://evil.com','same-origin'],['https://example.com','cross-site']])assert.equal((await geminiConnection(form(origin,site),formEnv)).status,403);
assert.equal((await geminiConnection(form('null','same-origin','invalid'),formEnv)).status,403);
assert.equal((await geminiConnection(form('null','same-origin',csrf,'other-user'),formEnv)).status,403);
assert.equal(upstream,2,'Rejected origin/token flows never reached Google');
assert.equal(geminiOriginAllowed(new Request(url)),false);
globalThis.fetch=originalFetch;
const opaqueToken=new Request('https://example.com/api/gemini-token',{method:'POST',headers:{origin:'null','sec-fetch-site':'same-origin','Content-Type':'application/json','oai-authenticated-user-id':'owner'},body:'{"voice":"Charon"}'});
const opaqueResponse=await geminiToken(opaqueToken,env,provider);assert.equal(opaqueResponse.status,200);
console.log('PASS: embedded opaque-origin form and token endpoint; signed user-bound CSRF; cross-site, missing-origin and invalid-token rejection. HTTP/browser headers and Google response mocked; no real iPhone session tested.');

reserved=false;const memberTicket=await geminiToken(request('POST',{voice:'Puck'},'https://example.com','member'),env,provider);assert.equal(memberTicket.status,200);assert.equal((await memberTicket.json()).voice,'Charon');console.log('PASS: member cannot override owner voice.');
