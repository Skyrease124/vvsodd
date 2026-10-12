// Integration checks against real SQLite migrations; R2 and NVIDIA are deterministic test doubles.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {handleKnowledge,processKnowledge,searchKnowledge,knowledgeContext,embeddings,handleChat,citationId}=await import(pathToFileURL(process.argv[2]).href);
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+file,'utf8'));
sql.exec("INSERT INTO site_admin (id,owner) VALUES ('owner','owner-id')");
const convert=v=>v instanceof ArrayBuffer?new Uint8Array(v):v;
const row=r=>r?Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v instanceof Uint8Array?v.buffer.slice(v.byteOffset,v.byteOffset+v.byteLength):v])):null;
class Prepared{
 constructor(query,args=[]){this.query=query;this.args=args;}
 bind(...args){return new Prepared(this.query,args.map(convert));}
 async first(){return row(sql.prepare(this.query).get(...this.args));}
 async all(){return {results:sql.prepare(this.query).all(...this.args).map(row)};}
 async run(){const r=sql.prepare(this.query).run(...this.args);return {success:true,meta:{changes:Number(r.changes)}};}
}
const objects=new Map(),uploads=new Map();
const env={NVIDIA_API_KEY:'test-key',DB:{prepare:q=>new Prepared(q),batch:async statements=>{sql.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}},FILES:{
 async createMultipartUpload(key){const id=crypto.randomUUID();uploads.set(id,{key,parts:new Map()});return {uploadId:id,abort:async()=>uploads.delete(id)};},
 resumeMultipartUpload(key,id){const u=uploads.get(id);return {async uploadPart(n,bytes){u.parts.set(n,bytes);return {etag:'part-'+n};},async complete(parts){objects.set(key,Buffer.concat(parts.map(p=>Buffer.from(u.parts.get(p.partNumber)))));uploads.delete(id);},async abort(){uploads.delete(id);}};},
 async put(key,value){objects.set(key,Buffer.from(value));return {};},
 async head(key){return objects.has(key)?{size:objects.get(key).length}:null;},
 async get(key,options){if(!objects.has(key))return null;const bytes=objects.get(key);const range=options?.range?.get('range')?.match(/bytes=(\d+)-(\d+)/);if(range){const start=Number(range[1]),end=Math.min(Number(range[2]),bytes.length-1);return {size:bytes.length,range:{offset:start,length:end-start+1},body:bytes.subarray(start,end+1)};}return {size:bytes.length,body:bytes};},async delete(key){objects.delete(key);}
}};
const origin='https://skydata.test';
async function call(path='',method='GET',data,user='owner-id',requestOrigin=origin){const headers={'oai-authenticated-user-id':user,origin:requestOrigin};if(data&&!ArrayBuffer.isView(data))headers['content-type']='application/json';return handleKnowledge(new Request(origin+'/api/knowledge'+path,{method,headers,...(data!==undefined?{body:ArrayBuffer.isView(data)?data:JSON.stringify(data)}:{})}),env);}
async function ok(path,method='GET',data){const r=await call(path,method,data);const b=await r.json();assert.ok(r.ok,JSON.stringify(b));return b;}
const requests=[];
const mock=async(url,init)=>{assert.equal(url,'https://integrate.api.nvidia.com/v1/embeddings');const b=JSON.parse(init.body);requests.push(b);return Response.json({data:b.input.map((t,index)=>{const v=Array(128).fill(.01);v[/geometry|mesh|render|scene|draw call/i.test(t)?0:1]=1;return {index,embedding:v};})});};
assert.equal((await call('','GET',undefined,'member')).status,403);
assert.equal((await call('','GET',undefined,'')).status,403);
assert.equal((await call('','POST',{},'owner-id','https://evil.test')).status,403);
assert.equal((await call('','POST',{name:'x.exe',size:1,category:'SCIENCE'})).status,400);
const bytes=new TextEncoder().encode('Geometry batching reduces draw calls in a rendered scene.');
const {id}=await ok('','POST',{name:'rendering.txt',size:bytes.length,category:'PROGRAMMING'});
await ok('/'+id+'/part?number=1','POST',bytes);await ok('/'+id+'/complete','POST',{});await ok('/'+id+'/complete','POST',{});
assert.equal((await call('/'+id+'/download','GET',undefined,'member')).status,403);
await ok('/'+id+'/extract','POST',{number:0,text:new TextDecoder().decode(bytes),page:null});
await ok('/'+id+'/extract','POST',{number:0,text:new TextDecoder().decode(bytes),page:null});
assert.equal(sql.prepare('SELECT COUNT(*) n FROM knowledge_chunks').get().n,1);
assert.equal((await call('/'+id+'/extract','POST',{number:0,text:'Changed',page:null})).status,400);
assert.equal((await call('/'+id+'/extract','POST',{number:2,text:'Out of order',page:null})).status,400);
assert.equal((await call('/'+id+'/finish','POST',{batches:2})).status,400);
await ok('/'+id+'/finish','POST',{batches:1});
await processKnowledge(env,'owner-id',id,mock);
assert.equal(sql.prepare('SELECT status FROM knowledge_documents WHERE id=?').get(id).status,'ready');
assert.equal(requests[0].input_type,'passage');
let result=await searchKnowledge(env,'owner-id','Optimize rendering geometry',mock);assert.equal(result.hits[0].document,id);assert.equal(result.mode,'hybrid-rrf');assert.equal(requests.at(-1).input_type,'query');
assert.equal((await searchKnowledge(env,'other-user','Optimize rendering',mock)).hits.length,0);
const context=await knowledgeContext(new Request(origin+'/api/chat',{headers:{'oai-authenticated-user-id':'owner-id'}}),env,'Optimize geometry rendering',mock);assert.match(context.context,/untrusted/);assert.match(context.sources[0].url,/\/knowledge\?document=/);assert.match(context.context,/K_/);
await ok('/'+id+'/settings','POST',{enabled:false,review:'reviewed',category:'PROGRAMMING'});assert.equal((await searchKnowledge(env,'owner-id','Optimize rendering',mock)).hits.length,0);
await ok('/'+id+'/settings','POST',{enabled:true,review:'reviewed',category:'PROGRAMMING'});
result=await searchKnowledge(env,'owner-id','geometry',async()=>new Response('',{status:429}));assert.equal(result.mode,'keyword');assert.equal(result.hits.length,1);
// 1,001-page extraction proves checkpoints and citations are not truncated at the old 500-page limit.
const book=(await ok('','POST',{name:'textbook.pdf',size:1,category:'RESEARCH'})).id;
await ok('/'+book+'/part?number=1','POST',new Uint8Array([1]));await ok('/'+book+'/complete','POST',{});await ok('/'+book+'/metadata','POST',{units:1001,title:'Large book',author:'Fixture'});
for(let n=0;n<1001;n++)await ok('/'+book+'/extract','POST',{number:n,page:n+1,text:n===1000?'Geometry meshes at the end of a long textbook.':''});
await ok('/'+book+'/finish','POST',{batches:1001});
await processKnowledge(env,'owner-id',book,async()=>new Response('',{status:429}));let state=sql.prepare('SELECT * FROM knowledge_documents WHERE id=?').get(book);assert.equal(state.status,'indexing');assert.equal(state.indexed,0);assert.equal(state.attempts,1);assert.ok(state.retry_at>Date.now());
await ok('/'+book+'/retry','POST',{});await processKnowledge(env,'owner-id',book,mock);state=sql.prepare('SELECT * FROM knowledge_documents WHERE id=?').get(book);assert.equal(state.status,'ready');assert.equal(state.empty_units,1000);
const view=await ok('/'+book+'?chunk='+encodeURIComponent(book+':0'));assert.equal(view.chunks[0].page,1001);
// Concurrent processors cannot spend on or index the same batch twice.
const pending=(await ok('','POST',{name:'math.md',size:1,category:'MATHEMATICS'})).id;await ok('/'+pending+'/part?number=1','POST',new Uint8Array([1]));await ok('/'+pending+'/complete','POST',{});await ok('/'+pending+'/extract','POST',{number:0,text:'# Mathematics\n\nAddition combines quantities.',page:null});await ok('/'+pending+'/finish','POST',{batches:1});
let calls=0;const delayed=async(...args)=>{calls++;await new Promise(r=>setTimeout(r,10));return mock(...args);};await Promise.all([processKnowledge(env,'owner-id',pending,delayed),processKnowledge(env,'owner-id',pending,delayed)]);assert.equal(calls,1);
// Optional actual textbook passages: copied only into this in-memory test database.
if(process.argv[3]){
 const pages=JSON.parse(readFileSync(process.argv[3],'utf8'));
 const actual=(await ok('','POST',{name:'C++.pdf',size:1,category:'PROGRAMMING'})).id;
 await ok('/'+actual+'/part?number=1','POST',new Uint8Array([1]));await ok('/'+actual+'/complete','POST',{});await ok('/'+actual+'/metadata','POST',{units:Math.max(...pages.map(p=>p.page))});
 for(let n=1;n<=Math.max(...pages.map(p=>p.page));n++)await ok('/'+actual+'/extract','POST',{number:n-1,page:n,text:pages.find(p=>p.page===n)?.text||''});
 await ok('/'+actual+'/finish','POST',{batches:Math.max(...pages.map(p=>p.page))});
 while(sql.prepare('SELECT status FROM knowledge_documents WHERE id=?').get(actual).status==='indexing')await processKnowledge(env,'owner-id',actual,mock);
 const keyword=async()=>new Response('',{status:429});
 const pointers=await searchKnowledge(env,'owner-id','Explain pointers using uploaded textbook',keyword);
 assert.ok(pointers.hits.some(h=>h.document===actual&&h.page===252&&/address and type/.test(h.content)));
 const namespaces=await searchKnowledge(env,'owner-id','Explain namespaces using uploaded documents',keyword);
 assert.ok(namespaces.hits.some(h=>h.document===actual&&[229,230].includes(h.page)&&/namespace/.test(h.content)));
 const comparison=await searchKnowledge(env,'owner-id','Compare pointers and namespaces',keyword);
 assert.ok(comparison.hits.some(h=>h.document===actual&&/address and type/.test(h.content)));
 assert.ok(comparison.hits.some(h=>h.document===actual&&/namespace (MySpace|YourSpace)|avoid naming conflicts with global/.test(h.content)));
 const abstract=await searchKnowledge(env,'owner-id','How do pointers work with abstract classes?',keyword);
 assert.ok(abstract.hits.some(h=>h.document===actual&&h.page===592&&/declare pointers/.test(h.content)));
 assert.equal(abstract.hits[0].page,592);
 const introductory=await searchKnowledge(env,'owner-id','What are pointers in C++?',keyword);assert.equal(introductory.hits[0].page,252);
 const returns=await searchKnowledge(env,'owner-id','How do functions return character pointers?',keyword);assert.ok(returns.hits.some(h=>h.page===384&&/function can return a pointer/i.test(h.content)));
 const example=await searchKnowledge(env,'owner-id','namesp1 MySpace namespace code example',keyword);
 assert.ok(example.hits.some(h=>h.document===actual&&h.page===229&&/namesp1/.test(h.content)));
 assert.equal((await searchKnowledge(env,'owner-id','xylophonic quasarflux',keyword)).hits.length,0);
 const c=sql.prepare('SELECT * FROM knowledge_chunks WHERE document=? AND page=252 LIMIT 1').get(actual);
 const sourcePage=pages.find(p=>p.page===252).text;
 const backupsBefore=objects.size;
 const verification=await ok('/'+actual+'/verify-page','POST',{page:252,text:sourcePage,pageLabel:'231'});
 assert.ok(verification.matched>0);assert.ok(objects.size>backupsBefore);
 assert.equal(sql.prepare('SELECT page_label FROM knowledge_chunks WHERE id=?').get(c.id).page_label,'231');
 assert.equal(sql.prepare('SELECT printed_page FROM knowledge_chunks WHERE id=?').get(c.id).printed_page,null);
 const before=sql.prepare('SELECT page FROM knowledge_chunks WHERE id=?').get(c.id).page;
 await ok('/'+actual+'/verify-page','POST',{page:253,text:sourcePage});
 assert.equal(sql.prepare('SELECT page FROM knowledge_chunks WHERE id=?').get(c.id).page,before);
 const put=env.FILES.put;env.FILES.put=async()=>{throw Error('Backup unavailable');};
 assert.equal((await call('/'+actual+'/verify-page','POST',{page:252,text:sourcePage,pageLabel:'changed'})).status,400);env.FILES.put=put;
 assert.equal(sql.prepare('SELECT page_label FROM knowledge_chunks WHERE id=?').get(c.id).page_label,'231');
 assert.equal((await call('/audit','GET',undefined,'member')).status,403);
 const audit=await ok('/audit');assert.equal(audit.checks.invalid_pages,0);
 console.log('PASS: page-label separate from printed page, backup before metadata update, backup failure blocks repair, mismatched page never overwritten, private integrity audit.');
 assert.equal(c.page_index,251);assert.equal(c.page_end,252);assert.equal(c.location_status,'physical-page');
 const selected=await ok('/'+actual+'?chunk='+encodeURIComponent(c.id));assert.equal(selected.chunks[0].page,252);assert.equal((await call('/'+actual+'?chunk=missing')).status,404);
 if(handleChat){
  const pointerRow=sql.prepare('SELECT * FROM knowledge_chunks WHERE document=? AND page=252 AND content LIKE ? LIMIT 1').get(actual,'%address and type%');
  const identifier=citationId(pointerRow.id);let generations=0,reviews=0;
  const chatUpstream=async(url,init)=>{
   const b=JSON.parse(init.body);
   if(b.input_type)return mock(url,init);
   assert.equal(url,'https://integrate.api.nvidia.com/v1/chat/completions');
   assert.equal(b.model,'nvidia/nemotron-3.5-lightning-30b-a3b');
   if(b.messages[0].content.includes('You are an evidence reviewer')){
    reviews++;const payload=JSON.parse(b.messages[1].content);assert.ok(payload.evidence.some(e=>e.id===identifier));
    return Response.json({choices:[{message:{content:JSON.stringify({decisions:payload.claims.map(c=>({claim:c.id,status:'SUPPORTED',citations:[{id:identifier,quote:'A pointer is an expression that represents both the address and type of another object.'}]}))})}}]});
   }
   generations++;assert.ok(b.messages[0].content.includes(identifier));
   return Response.json({choices:[{message:{content:'A pointer represents both the address and type of another object. ['+identifier+']'}}]});
  };
  const r=await handleChat(new Request(origin+'/api/chat',{method:'POST',headers:{origin,'content-type':'application/json','oai-authenticated-user-id':'owner-id'},body:JSON.stringify({model:'nvidia/nemotron-3.5-lightning-30b-a3b',coding:true,messages:[{role:'user',content:'Using only uploaded documents explain pointers.'}]})}),env.NVIDIA_API_KEY,undefined,chatUpstream,env);
  const answer=await r.json();assert.equal(r.status,200,JSON.stringify(answer));assert.match(answer.content,/PDF page 252/);assert.equal(answer.sources.length,1);assert.equal(generations,1);assert.equal(reviews,0);
  console.log('PASS: actual-text SQLite → retrieval → selected NVIDIA request → test-only review disabled → validated citation response, with provider stub.');
 }
 console.log('PASS: five actual-text retrieval cases on supplied extracted C++ PDF pages, physical page index, exact chunk destination. Keyword path; full-book/NVIDIA generation not tested.');
}
// Deleting a document removes original, chunks, vector buckets and keyword index.
await ok('/'+id,'DELETE');assert.equal((await call('/'+id+'/download')).status,404);assert.equal(sql.prepare('SELECT COUNT(*) n FROM knowledge_chunks WHERE document=?').get(id).n,0);assert.equal(sql.prepare('SELECT COUNT(*) n FROM knowledge_buckets WHERE chunk LIKE ?').get(id+'%').n,0);assert.equal(sql.prepare('SELECT COUNT(*) n FROM knowledge_terms WHERE chunk LIKE ?').get(id+'%').n,0);
assert.equal(sql.prepare('PRAGMA foreign_key_check').all().length,0);
await assert.rejects(()=>embeddings(['x'],'query',env,async()=>Response.json({data:[{index:0,embedding:[0]}]})),/invalid vector/);
console.log('PASS: migrations, private access, multipart upload, idempotent extraction, 1,001-page checkpoints, embedding failure/retry, processor leases, semantic/keyword retrieval, citations, exclusions, and cascading deletion. NVIDIA/R2 mocked; no live provider assertion.');
