import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {handleChat}=await import(pathToFileURL(process.argv[2]).href);
let calls=0;
for(const [content,interpreter] of [['Yeo',false],['Naw lol that’s not what I meant',false],['Who is Michelle Yeo?',false],['Yeo',true]]){
 const upstream=async(url,init)=>{calls++;const body=JSON.parse(init.body);assert.equal(body.model,'openai/gpt-oss-20b');const system=body.messages[0].content;
 if(interpreter){assert.match(system,/Output only the translation/);assert.doesNotMatch(system,/A standalone/);}else{assert.match(system,/A standalone "Yeo"/);assert.match(system,/Infer tone cautiously/);assert.match(system,/factual accuracy/);assert.match(system,/Do not diagnose emotions/);}
 assert.ok(body.messages.at(-1).content.includes(content),'Do not rewrite user slang or names');return Response.json({choices:[{message:{content:'Fixture response.'}}]});};
 const result=await handleChat(new Request('https://skydata.test/api/chat',{method:'POST',headers:{'content-type':'application/json',origin:'https://skydata.test'},body:JSON.stringify({model:'openai/gpt-oss-20b',interpreter,replyLanguage:'en',messages:[{role:'user',content}]})}),'test-key',undefined,upstream,{});
 assert.equal(result.status,200,await result.clone().text());assert.equal((await result.json()).content,'Fixture response.');
}
assert.equal(calls,4);console.log('PASS: four mocked request contracts; conversational style delivered, raw messages preserved, translation-only mode excluded. No live model behavior tested.');
