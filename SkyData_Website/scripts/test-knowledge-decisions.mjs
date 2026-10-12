import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {assessEvidence}=await import(pathToFileURL(process.argv[2]).href);
const pages=JSON.parse(readFileSync(process.argv[3],'utf8'));
const fixtures=[
 [252,'A pointer represents the address and type of another object.','SUPPORTED'],
 [230,'Namespaces help avoid naming conflicts.','SUPPORTED'],
 [30,'Dereferencing accesses an object through a pointer.','INSUFFICIENT_EVIDENCE'],
 [252,'Pointers never represent addresses.','CONTRADICTED'],
 [230,'Namespaces guarantee faster CPU execution.','INSUFFICIENT_EVIDENCE']
];
const sources=fixtures.map(([page],i)=>({id:'c'+i,document:'book',name:'C++.pdf',content:pages.find(p=>p.page===page).text,page,page_index:page-1,page_end:page,units:846,kind:'pdf',location_status:'matched'}));
const pairs=fixtures.map(([,claim,expected],i)=>({claim,expected,chunk:'c'+i}));pairs.push({claim:'Missing passage',chunk:'missing',expected:'INSUFFICIENT_EVIDENCE'});sources.push(null);
let calls=0;const mock=async(url,options)=>{calls++;assert.equal(url,'https://api.openai.com/v1/decisions');assert.equal(options.headers.Authorization,'Bearer test-key');const b=JSON.parse(options.body);assert.equal(b.model,'gpt-6-luna');assert.equal(b.questions.length,5);assert.ok(!b.input.includes('C++.pdf'));return Response.json({answers:fixtures.map((f,i)=>({name:'e'+i,type:'choice',choice:f[2],probabilities:['SUPPORTED','CONTRADICTED','INSUFFICIENT_EVIDENCE'].map(value=>({value,probability:value===f[2]?1:0}))})),usage:{input_tokens:1000}});};
const r=await assessEvidence(pairs,sources,{OPENAI_API_KEY:'test-key'},mock);assert.equal(calls,1);assert.equal(r.metrics.correct,5);assert.equal(r.metrics.metadataFailures,1);assert.equal(r.metrics.estimatedBaseCostUSD,.0001);assert.equal(r.results[5].assessment,null);
const wrong=await assessEvidence([pairs[2]],[sources[2]],{OPENAI_API_KEY:'test-key'},async()=>Response.json({answers:[{name:'e0',type:'choice',choice:'SUPPORTED',probabilities:['SUPPORTED','CONTRADICTED','INSUFFICIENT_EVIDENCE'].map(value=>({value,probability:value==='SUPPORTED'?1:0}))}]}));assert.equal(wrong.metrics.falseApprovals,1);
const invalid=await assessEvidence([pairs[0]],[sources[0]],{OPENAI_API_KEY:'test-key'},async()=>Response.json({answers:[{name:'e0',type:'choice',choice:'SUPPORTED',probabilities:[]}]}));assert.equal(invalid.results[0].assessment,null);
const fail=await assessEvidence([pairs[0]],[sources[0]],{OPENAI_API_KEY:'test-key'},async()=>{throw Error('timeout')});assert.equal(fail.metrics.unassessed,1);
await assert.rejects(()=>assessEvidence([pairs[0]],[sources[0]],{},mock),/Connect OpenAI/);
console.log('PASS Decisions contract, five real-text fixtures with STUB labels, missing source, false approval measurement, malformed answers, timeout and missing key. Live API calls: 0. These tests do not measure model accuracy.');
