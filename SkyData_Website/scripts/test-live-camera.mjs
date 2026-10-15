import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
async function load(file,replace=code=>code){const code=replace(fs.readFileSync(file,'utf8'));return import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));}
globalThis.cameraReply=await load('lib/camera-reply.ts');
const helpers=await load('lib/camera-frames.ts');globalThis.cameraHelpers=helpers;
const image='data:image/jpeg;base64,YQ==';
const recent=helpers.recentCameraFrames(Array.from({length:8},(_,i)=>({image,at:i*750})),5250);
assert.equal(recent.length,4);assert.deepEqual(recent.map(f=>f.ageMs),[2250,1500,750,0]);assert(helpers.validCameraFrames(recent));
for(const invalid of [[],Array(5).fill({image,ageMs:0}),[{image,ageMs:5000}],[{image,ageMs:-1}],[{image,ageMs:0},{image,ageMs:100}], [{image:'https://bad/image.jpg',ageMs:0}]])assert(!helpers.validCameraFrames(invalid));
let cleanup,tick,cleared=0,stopped=0,requests=[];globalThis.hookMocks={useRef:v=>({current:v}),useState:v=>[v,()=>{}],useEffect:f=>{cleanup=f();}};
globalThis.setInterval=f=>{tick=f;return 1;};globalThis.clearInterval=()=>{tick=null;cleared++;};
const video={srcObject:null,readyState:2,videoWidth:640,videoHeight:480,play:async()=>{}};
globalThis.document={hidden:false,addEventListener(){},removeEventListener(){},createElement:()=>({getContext:()=>({drawImage(){}}),toDataURL:()=>image})};
Object.defineProperty(globalThis,'navigator',{value:{mediaDevices:{getUserMedia:async options=>{requests.push(options);return {getTracks:()=>[{stop:()=>{stopped++;}}],getVideoTracks:()=>[{addEventListener(){}}]};}}},configurable:true});
const {useLiveCamera}=await load('hooks/use-live-camera.ts',code=>code.replace(/^import .* from 'react';$/m,'const {useRef,useState,useEffect}=globalThis.hookMocks;').replace(/^import .*camera-frames.*$/m,'const {recentCameraFrames}=globalThis.cameraHelpers;'));
const camera=useLiveCamera();camera.video.current=video;await camera.start(false);assert.equal(requests[0].audio,false);assert.equal(requests[0].video.facingMode.ideal,'environment');
for(let i=0;i<8;i++)tick();assert.equal(camera.captureSequence().length,4);
await camera.flip();assert.equal(requests[1].video.facingMode.ideal,'user');assert.equal(requests[1].audio,false);assert(stopped>0);camera.stop();assert.equal(video.srcObject,null);assert.equal(tick,null);assert(cleared>=2);assert.throws(()=>camera.captureSequence());cleanup();
// Exercise the actual backend validator and upstream conversion with a mocked NVIDIA response.
let upstreamBody;
// Reload with dependency adapters; no credentials or live provider calls.
const vision=await load('lib/vision.ts',code=>`const {validCameraFrames}=globalThis.cameraHelpers;const {cleanCameraReply}=globalThis.cameraReply;
const validProject=()=>true, projectContext=async()=>'',validDocument=()=>true,documentContext=()=>'';
const isDirectDeepseek=()=>false,DEEPSEEK_MODEL='deepseek',SUPER_VL_MODEL='nvidia/nemotron-3.5-super-vl-120b-a12b',DEEPSEEK_ENDPOINT='',modelSettings=()=>({});
const naturalWritingInstructions=()=>'';const retryableStatus=()=>false,readKey=async()=>'test-only',saveKey=async()=>{};
const getLiveInfo=async()=>({context:'',sources:[]}),cleanResponse=x=>x,DIRECT_ANSWER_STYLE='';
const isReplyLanguage=()=>true,replyLanguageInstruction=()=>'',questionInReplyLanguage=x=>x;
const providerFetch=(url,options,upstream)=>upstream(url,options),streamReply=()=>{};
`+code.replace(/^import .*;$/gm,''));
const req=frames=>new Request('https://skydata.test/api/vision',{method:'POST',headers:{Origin:'https://skydata.test','Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:'What moved?',cameraFrames:frames}]})});
const upstream=async(url,options)=>{upstreamBody=JSON.parse(options.body);return Response.json({choices:[{message:{content:'Test response'}}]});};
assert.equal((await vision.handleVision(req(recent),{},upstream)).status,200);
assert.equal(upstreamBody.messages[1].content.filter(part=>part.type==='image_url').length,4);assert.equal(upstreamBody.model,'nvidia/nemotron-3.5-super-vl-120b-a12b','photos and camera frames go to Super VL');assert.equal(upstreamBody.reasoning_budget,undefined);
{const audio=new Request('https://skydata.test/api/vision',{method:'POST',headers:{Origin:'https://skydata.test','Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:'What is said?',media:{kind:'audio',name:'a.mp3',data:'data:audio/mpeg;base64,YQ=='}}]})});assert.equal((await vision.handleVision(audio,{},upstream)).status,200);assert.equal(upstreamBody.model,'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning','recordings still go to Nano Omni');}
assert(upstreamBody.messages[0].content.includes('never claim continuous monitoring'));
assert.equal((await vision.handleVision(req(Array(5).fill({image,ageMs:0})),{},upstream)).status,400);
const repeated='The black drink can is on the wooden table near the keyboard.';
const spokenRequest=new Request('https://skydata.test/api/vision',{method:'POST',headers:{Origin:'https://skydata.test','Content-Type':'application/json'},body:JSON.stringify({voiceChat:true,messages:[...Array.from({length:12},(_,i)=>({role:i%2?'assistant':'user',content:'Old turn '+i})),{role:'user',content:'What about this?',cameraFrames:recent}]})});
const spokenResponse=await vision.handleVision(spokenRequest,{},async(url,options)=>{upstreamBody=JSON.parse(options.body);return Response.json({choices:[{message:{content:repeated+'\n\n'+repeated}}]});});
assert.equal((await spokenResponse.json()).content,repeated);assert.equal(upstreamBody.max_tokens,512);assert.equal(upstreamBody.messages.length,10);assert.equal(upstreamBody.messages.at(-1).content.filter(part=>part.type==='image_url').length,4);
console.log('PASS: bounded chronological frames, stale/invalid rejection, camera switch without audio capture, track/timer cleanup, actual vision request validation and four-frame upstream conversion; photos/camera frames use Nemotron 3.5 Super VL, recordings use Nano Omni. Browser/camera and NVIDIA calls mocked; no live device test.');
