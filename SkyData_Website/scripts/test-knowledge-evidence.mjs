import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const module=await import(pathToFileURL(process.argv[2]).href);
const {verifyKnowledgeAnswer,rankKnowledge,chunkText,citationId}=module;
const pages=JSON.parse(readFileSync(process.argv[3],'utf8'));
const records=pages.flatMap(p=>chunkText(p.text).map((chunk,i)=>({id:'cpp-fixture:'+p.page+':'+i,document:'cpp-fixture',page:p.page,name:'C++.pdf',section:chunk.section,content:chunk.text,semantic:.9})));
const cases=[
 {test:'A',question:'What are pointers in C++?',page:252,claim:'A pointer represents both the address and type of another object.',quote:/A pointer is an expression that represents both the address and type of another object\./},
 {test:'B',question:'Explain C++ namespaces.',page:230,claim:'C++ namespaces help avoid naming conflicts with global identifiers.',quote:/C\+\+ provides for the use of namespaces[\s\S]*?identifiers\./},
 {test:'D',question:'How do pointers work with abstract classes?',page:592,claim:'You can declare pointers and references to abstract classes even though you cannot define objects for them.',quote:/Although you cannot define objects for abstract classes,[\s\S]*?ref-?\s*erences to abstract classes\./},
 {test:'G-dereference',question:'How does dereferencing work?',page:254,claim:'The indirection operator * accesses the object referenced by a pointer.',quote:/The indirection operator \* is used to access an object referenced by a pointer:[\s\S]*?object referenced by ptr\./}
];
const report={fixturePages:pages.map(p=>p.page),reviewer:'Deterministic labelled test double, not live NVIDIA entailment',tests:[]};
for(const c of cases){
 const started=performance.now();const ranked=rankKnowledge(records,c.question,true);
 const h=ranked.selected.find(h=>h.page===c.page&&c.quote.test(h.content));
 assert.ok(h,c.test+' supporting passage selected');
 if(c.test==='A')assert.equal(ranked.selected[0].page,252);
 if(c.test==='D')assert.equal(ranked.selected[0].page,592);
 const quote=h.content.match(c.quote)[0],id=citationId(h.id);
 const result=await verifyKnowledgeAnswer(c.claim+' ['+id+']',ranked.selected,'https://skydata.test',c.question,async claims=>({decisions:claims.map(claim=>({claim:claim.id,status:'SUPPORTED',citations:[{id,quote}]}))}));
 assert.equal(result.metrics.supported,1);assert.equal(result.sources.length,1);
 const u=new URL(result.sources[0].url);assert.equal(u.searchParams.get('document'),h.document);assert.equal(u.searchParams.get('chunk'),h.id);
 assert.match(result.sources[0].title,new RegExp('PDF page '+c.page+'$'));
 report.tests.push({test:c.test,question:c.question,ranking:ranked.selected.map(r=>({chunk:r.id,page:r.page,score:r.score,relevance:r.relevance})),claims:[c.claim],evidence:[{chunk:h.id,page:h.page,quote}],verification:result.audit,destinations:result.sources,elapsedMs:performance.now()-started,pass:true});
}
const ranked=rankKnowledge(records,'Compare pointers and namespaces.',true);
assert.ok(ranked.selected.some(r=>r.page===252));assert.ok(ranked.selected.some(r=>r.page===230||r.page===229));
const pointer=records.find(r=>r.page===252&&/address and type/.test(r.content));
const namespace=records.find(r=>r.page===230&&/avoid naming conflicts/.test(r.content));
const pquote=pointer.content.match(cases[0].quote)[0],nquote=namespace.content.match(cases[1].quote)[0];
const pid=citationId(pointer.id),nid=citationId(namespace.id);
const mixed=await verifyKnowledgeAnswer(cases[0].claim+' ['+pid+']\n\n'+cases[1].claim+' ['+nid+']',[pointer,namespace],'https://skydata.test','Compare pointers and namespaces.',async claims=>({decisions:claims.map((c,i)=>({claim:c.id,status:'SUPPORTED',citations:[{id:i?nid:pid,quote:i?nquote:pquote}]}))}));
assert.equal(mixed.sources.length,2);
report.tests.push({test:'C/G',question:'Compare pointers and namespaces.',ranking:ranked.selected.map(r=>({chunk:r.id,page:r.page,relevance:r.relevance,score:r.score})),claims:[cases[0].claim,cases[1].claim],evidence:[{chunk:pointer.id,page:252,quote:pquote},{chunk:namespace.id,page:230,quote:nquote}],verification:mixed.audit,destinations:mixed.sources,pass:true});
// H deliberately lies about support and supplies a real quote from a real unrelated PDF page.
const unrelated=records.find(r=>r.page===30);
const bad=await verifyKnowledgeAnswer(cases[0].claim+' ['+citationId(unrelated.id)+']',[unrelated],'https://skydata.test','Explain pointers.',async claims=>({decisions:claims.map(c=>({claim:c.id,status:'SUPPORTED',citations:[{id:citationId(unrelated.id),quote:unrelated.content.slice(0,200)}]}))}));
assert.equal(bad.sources.length,0);assert.equal(bad.metrics.insufficient,1);assert.doesNotMatch(bad.content,/represents both/);
report.tests.push({test:'H',question:'Explain pointers.',claims:[cases[0].claim],evidence:[{chunk:unrelated.id,page:30,quote:unrelated.content.slice(0,200)}],verification:bad.audit,destinations:bad.sources,pass:true});
const absentRanking=rankKnowledge(records,'Using only uploaded documents explain quasarflux.',false);assert.equal(absentRanking.selected.length,0);
const absent=await verifyKnowledgeAnswer('Invented fact [K_fake]',[],'https://skydata.test','Using only uploaded documents explain quasarflux.',async()=>{throw Error('must not call');});
assert.equal(absent.sources.length,0);assert.match(absent.content,/not found/);report.tests.push({test:'E',question:'Using only uploaded documents explain quasarflux.',ranking:[],claims:['Invented fact'],verification:absent.audit,destinations:[],pass:true});
// Failure cases: fabricated quote, duplicate verdict, contradiction, no reviewer, better retrieved citation.
for(const variant of ['quote','duplicate','contradiction','unavailable']){
 const r=await verifyKnowledgeAnswer(cases[0].claim+' ['+pid+']',[pointer],'https://skydata.test','Explain pointers.',async claims=>{
  if(variant==='unavailable')throw Error('timeout');const d={claim:claims[0].id,status:variant==='contradiction'?'CONTRADICTED':'SUPPORTED',citations:[{id:pid,quote:variant==='quote'?'Invented quotation not present in the source.':pquote}]};return {decisions:variant==='duplicate'?[d,d]:[d]};
 });assert.equal(r.sources.length,0);assert.doesNotMatch(r.content,/represents both/);
}
const rescue=await verifyKnowledgeAnswer(cases[0].claim+' ['+nid+']',[pointer,namespace],'https://skydata.test','Explain pointers.',async claims=>({decisions:claims.map(c=>({claim:c.id,status:'SUPPORTED',citations:[{id:pid,quote:pquote}]}))}));assert.equal(rescue.sources.length,1);assert.match(rescue.sources[0].title,/252/);
for(const source of report.tests.flatMap(t=>t.destinations||[])){const u=new URL(source.url),h=records.find(r=>r.id===u.searchParams.get('chunk')&&r.document===u.searchParams.get('document'));assert.ok(h);assert.match(source.title,new RegExp('PDF page '+h.page+'$'));}
report.tests.push({test:'F',question:'Resolve every accepted citation in the tests',pass:true,note:'Every accepted URL document/chunk/page resolved to the exact fixture row; browser click not exercised.'});
report.tests.push({test:'failure-cases',pass:true,variants:['fabricated quote','duplicate verdict','contradicted claim','review timeout','better retrieved evidence substitution']});
if(process.argv[4])writeFileSync(process.argv[4],JSON.stringify(report,null,2));
console.log('PASS: actual-text ranking A/B/C/D/G, absent-evidence E, exact destinations F, unrelated real page H, fail-closed reviewer checks and citation rescue. Reviewer mocked; no live entailment assertion.');
