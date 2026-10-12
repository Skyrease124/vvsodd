import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,unlinkSync} from 'node:fs';
const miniflareDir=readdirSync('node_modules/.pnpm').find(n=>n.startsWith('miniflare@'));
const {Miniflare}=await import('../node_modules/.pnpm/'+miniflareDir+'/node_modules/miniflare/dist/src/index.js');
const root=process.cwd()+'/dist/server/';
const source=readFileSync(root+'index.js','utf8');
const match=source.match(/aws-verification`,await new ([\w$]+)\(\{region:`us-east-1`,credentials:\{accessKeyId:\w+,secretAccessKey:\w+\},requestHandler:new ([\w$]+)\(\{requestTimeout:15e3\}\),maxAttempts:1\}\)\.send\(new ([\w$]+)/);
assert.ok(match,'Find the real deployed verification client');
const [,Client,Handler,Command]=match;
const test=source.replace(/export\{[\w$]+ as default\};\s*$/,`export default {async fetch(){try{await new ${Client}({region:'us-east-1',credentials:{accessKeyId:'AKIA0000000000000000',secretAccessKey:'synthetic-test-value-only'},requestHandler:new ${Handler}({requestTimeout:5000}),maxAttempts:1}).send(new ${Command}({}));return Response.json({ok:true});}catch(e){return Response.json({name:e.name});}}};`);
const path=root+'runtime-check.js';writeFileSync(path,test);
let sent=0;let mf;
try{
 mf=new Miniflare({modules:[{type:'ESModule',path},...readdirSync(root,{recursive:true}).filter(p=>p.endsWith('.js')&&p!=='runtime-check.js').map(p=>({type:'ESModule',path:root+p}))],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],outboundService:async()=>{sent++;return new Response('{"message":"Synthetic rejection"}',{status:403,headers:{'content-type':'application/json','x-amzn-errortype':'UnrecognizedClientException'}});}});
 const result=await(await mf.dispatchFetch('http://localhost')).json();
 assert.equal(sent,1,'Client must send a request before handling AWS errors');
 assert.equal(result.name,'UnrecognizedClientException','Client must preserve the AWS authentication error');
 console.log('PASS: deployed Polly bundle in Workers sends request and handles mocked AWS authentication rejection. No real credentials used.');
}finally{await mf?.dispose();unlinkSync(path);}
