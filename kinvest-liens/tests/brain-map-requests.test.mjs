import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync('kinvest-liens/owner/brain/requests.js','utf8');
function setup(fetch){
 let timeout,cleared=false;
 const elements=new Map();
 const element=id=>{if(!elements.has(id))elements.set(id,{textContent:'Awaiting first run',disabled:false,parentElement:{querySelector:()=>element('explanation')}});return elements.get(id);};
 const scope={window:{},AbortController,fetch,setTimeout:(fn,ms)=>{assert.equal(ms,20000);timeout=fn;return 1;},clearTimeout:()=>{cleared=true;},document:{getElementById:element}};
 vm.runInNewContext(code,scope);
 return {api:scope.window,expire:()=>timeout(),cleared:()=>cleared,element};
}
test('request timeout covers a stalled response body and reports unknown completion',async()=>{
 let abort;
 const h=setup(async(url,options)=>{abort=options.signal;return {ok:true,status:200,json:()=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('aborted'))))};});
 const request=h.api.PPABrainRequest('/test');
 await new Promise(setImmediate);h.expire();
 await assert.rejects(request,/Completion is unknown/);
 assert.equal(abort.aborted,true);assert.equal(h.cleared(),true);
});
test('successful and rejected HTTP responses retain status and JSON for existing controls',async()=>{
 for(const status of [200,401,502]){
  const h=setup(async()=>({ok:status===200,status,json:async()=>({status})}));
  const response=await h.api.PPABrainRequest('/test');
  assert.equal(response.status,status);assert.equal(response.ok,status===200);
  assert.equal((await response.json()).status,status);assert.equal(h.cleared(),true);
 }
});
test('preview status explicitly says schedules are disabled and removes waiting labels',()=>{
 const h=setup();h.api.PPABrainPreviewStatus({previewMode:true,updatedAt:'today'});
 assert.match(h.element('autoState').textContent,/disabled in this preview/);
 assert.match(h.element('explanation').textContent,/automatically prepares the verified official sample/);
 assert.equal(h.element('pause').disabled,true);
 assert.equal(h.element('resume').disabled,true);
 assert.match(h.element('autoGeocode').textContent,/No background request is loading/);
});
