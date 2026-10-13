import test from 'node:test';
import assert from 'node:assert/strict';
import {Stagehand,localBrowser,ClientLLMSchema} from '@browserbasehq/stagehand';
test('released Stagehand 4.2.1 public API and custom callback contract',async()=>{
 assert.equal(typeof Stagehand.create,'function');assert.equal(typeof localBrowser.launch,'function');
 const model=ClientLLMSchema.parse({generate:async()=>({role:'assistant',outputFormat:'json_schema',structuredContent:{actions:[]},content:[{type:'text',text:'{"actions":[]}'}],usage:{inputTokens:0,outputTokens:0,totalTokens:0}})});
 const result=await model.generate({messages:[{role:'user',content:{type:'text',text:'Find public navigation'}}],responseFormat:{type:'json_schema',name:'navigation',schema:{type:'object'}}});assert.equal(result.outputFormat,'json_schema');
});
