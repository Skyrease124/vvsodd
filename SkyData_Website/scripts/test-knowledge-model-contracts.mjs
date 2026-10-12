import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {handleChat}=await import(pathToFileURL(process.argv[2]).href);
const models=['nvidia/nemotron-3-ultra-550b-a55b','nvidia/nemotron-3.5-lightning-30b-a3b','openai/gpt-oss-20b','deepseek-flash','deepseek-v4-pro'];
for(const model of models){let calls=0;const upstream=async(url,init)=>{calls++;const b=JSON.parse(init.body);assert.equal(b.model,model);assert.equal(b.stream,false);assert.ok(init.headers.Authorization);return Response.json({choices:[{message:{content:'Hello.'}}]});};
 const r=await handleChat(new Request('https://skydata.test/api/chat',{method:'POST',headers:{'content-type':'application/json',origin:'https://skydata.test'},body:JSON.stringify({model,coding:true,messages:[{role:'user',content:'Write hello in JavaScript.'}]})}),'test-key',undefined,upstream,{DEEPSEEK_API_KEY:'test-key'});
 const answer=await r.json();assert.equal(r.status,200,JSON.stringify(answer));assert.equal(answer.model,model);assert.equal(answer.content,'Hello.');assert.equal(calls,1,'no review call when no document claim');
}
console.log('PASS: all five available model request contracts and normal reply path; no live provider availability asserted.');
