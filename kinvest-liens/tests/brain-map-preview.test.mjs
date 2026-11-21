import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {AsyncLocalStorage} from 'node:async_hooks';
async function setup(){
 const prod=new Map(),preview=new Map();let user={owner:true};
 const context=vm.createContext({Response,URL,URLSearchParams,AbortSignal,console});
 const cache=new Map();
 function synthetic(key,exports){
  const m=new vm.SyntheticModule(Object.keys(exports),function(){for(const [k,v] of Object.entries(exports))this.setExport(k,v);},{context});cache.set(key,m);return m;
 }
 synthetic('node:async_hooks',{AsyncLocalStorage});
 synthetic('@netlify/blobs',{getDeployStore:()=>({get:async k=>preview.get(k),setJSON:async(k,v)=>preview.set(k,v),delete:async k=>preview.delete(k),list:async()=>({blobs:[...preview.keys()].map(key=>({key}))})})});
 synthetic('./auth.mjs',{userFromCookie:async()=>user,kvGet:async k=>prod.get(k),kvPut:async(k,v)=>prod.set(k,v),kvDel:async k=>prod.delete(k),kvList:async()=>[...prod.keys()]});
 const auth=new vm.SourceTextModule(fs.readFileSync('netlify/lib/brain-auth.mjs','utf8'),{context});
 await auth.link(s=>cache.get(s));await auth.evaluate();
 let publishes=0;
 const publisher=synthetic('./brain-map-publish-auto.mjs',{default:async()=>{publishes++;}});
 const endpoint=new vm.SourceTextModule(fs.readFileSync('netlify/functions/owner-brain-preview-test.mjs','utf8'),{context});
 await endpoint.link(s=>s==='../lib/brain-auth.mjs'?auth:publisher);await endpoint.evaluate();
 return {prod,preview,auth:auth.namespace,handler:endpoint.namespace.default,setUser:u=>{user=u;},publishes:()=>publishes};
}
test('concurrent preview and production requests use separate Brain stores, preserving global API budgets',async()=>{
 const h=await setup();
 h.prod.set('brain-map-history-v1',{production:true});
 const run=h.auth.withBrainStore(async()=>{
  await h.auth.kvPut('brain-map-history-v1',{preview:h.auth.isBrainPreview()});
  return h.auth.kvGet('brain-map-history-v1');
 });
 const [p,d]=await Promise.all([run(null,{deploy:{context:'deploy-preview'}}),run(null,{deploy:{context:'production'}})]);
 assert.equal(p.preview,true);assert.equal(d.preview,false);
 assert.equal(h.prod.get('brain-map-history-v1').preview,false);
 assert.equal(h.preview.get('brain-map-history-v1').preview,true);
 const budget=h.auth.withBrainStore(()=>h.auth.kvPut('owner-brain-geoapify-usage-v1',{used:20}));
 await budget(null,{deploy:{context:'deploy-preview'}});
 assert.equal(h.prod.get('owner-brain-geoapify-usage-v1').used,20);
 assert.equal(h.preview.has('owner-brain-geoapify-usage-v1'),false);
});
test('preview controls reject production, anonymous users, cross-origin requests, and unconfirmed writes',async()=>{
 const h=await setup(),url='https://preview.test/.netlify/functions/owner-brain-preview-test';
 const ctx={deploy:{context:'deploy-preview',id:'test'}};
 assert.equal((await h.handler(new Request(url),{deploy:{context:'production'}})).status,404);
 h.setUser(null);assert.equal((await h.handler(new Request(url),ctx)).status,401);
 h.setUser({owner:false});assert.equal((await h.handler(new Request(url),ctx)).status,403);
 h.setUser({owner:true});assert.equal((await h.handler(new Request(url),ctx)).status,200);
 const post=(body,origin='https://preview.test')=>new Request(url,{method:'POST',headers:{origin},body:JSON.stringify(body)});
 assert.equal((await h.handler(post({action:'publish',confirmed:true},'https://other.test'),ctx)).status,403);
 assert.equal((await h.handler(post({action:'publish'}),ctx)).status,400);
 assert.equal(h.publishes(),0);
 assert.equal((await h.handler(post({action:'publish',confirmed:true}),ctx)).status,200);
 assert.equal(h.publishes(),1);assert.equal(h.prod.size,0);
});
test('rollback removes only the preview test correction, increments version and records history',async()=>{
 const h=await setup(),key='brain-map-county-v1-MI-wayne',id='MI|Wayne|01002263|';
 h.preview.set(key,{version:1,records:{[id]:{test:true},other:{keep:true}}});
 h.prod.set(key,{version:90,records:{[id]:{production:true}}});
 const req=new Request('https://preview.test/.netlify/functions/owner-brain-preview-test',{method:'POST',headers:{origin:'https://preview.test'},body:JSON.stringify({action:'rollback',confirmed:true})});
 assert.equal((await h.handler(req,{deploy:{context:'deploy-preview'}})).status,200);
 assert.equal(h.preview.get(key).version,2);assert.equal(h.preview.get(key).records[id],undefined);
 assert.equal(h.preview.get(key).records.other.keep,true);
 assert.equal(h.prod.get(key).version,90);
 assert.equal(h.preview.get('brain-map-history-v1').entries[0].action,'reversed');
});
test('every Brain endpoint installs the storage context before handling a request',()=>{
 for(const filename of fs.readdirSync('netlify/functions').filter(f=>/^(owner-brain-|brain-map-).*\.mjs$/.test(f))){
  const code=fs.readFileSync('netlify/functions/'+filename,'utf8');
  assert.match(code,/import \* as auth from '\.\.\/lib\/brain-auth\.mjs'/,filename);
  assert.match(code,/export default auth\.withBrainStore\(handler\)/,filename);
 }
});
