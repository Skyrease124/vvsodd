import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const load=async file=>import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
const {pcm16Base64,decodePcm16,LiveAudioQueue}=await load('lib/live-pcm.ts');
assert.deepEqual([...decodePcm16(pcm16Base64(new Float32Array([-1,0,1]),16000))],[-1,0,32767/32768]);
assert.equal(decodePcm16(pcm16Base64(new Float32Array(4800).fill(.5),48000)).length,1600);
assert.throws(()=>decodePcm16(btoa('x')),/Invalid/);
const nodes=[];const context={currentTime:0,createBuffer:(_c,n,r)=>({duration:n/r,copyToChannel(){}}),createBufferSource:()=>{const node={connect(){},disconnect(){this.disconnected=true;},start(t){this.time=t;},stop(){this.stopped=true;}};nodes.push(node);return node;}};
const queue=new LiveAudioQueue(context,{});queue.enqueue(new Float32Array(2400));queue.enqueue(new Float32Array(2400));assert.ok(nodes[1].time>nodes[0].time);queue.interrupt();assert.ok(nodes.every(n=>n.stopped&&n.disconnected));queue.enqueue(new Float32Array(2400));assert.equal(nodes[2].time,.01);
queue.enqueue(new Float32Array(24000*11));assert.throws(()=>queue.enqueue(new Float32Array(1)),/fell behind/);queue.interrupt();
const {geminiLiveConfig,GEMINI_LIVE_MODEL}=await load('lib/gemini-config.ts');const config=geminiLiveConfig();assert.equal(GEMINI_LIVE_MODEL,'gemini-3.8-live');assert.equal(config.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName,'Charon');assert.equal(config.realtimeInputConfig.automaticActivityDetection.disabled,false);assert.equal(config.tools[1].functionDeclarations[0].name,'ask_skydata');
// Integration guards are source-contract checks, not real browser/provider tests.
const hook=fs.readFileSync('hooks/use-gemini-live.ts','utf8'),worker=fs.readFileSync('build/sites-worker.ts','utf8'),backend=fs.readFileSync('lib/gemini-live.ts','utf8');
assert.ok(hook.includes('content?.interrupted){s.queue.interrupt();outputLevel.current=0'));
assert.ok(hook.includes('echoCancellation:true,noiseSuppression:true'));
assert.ok(hook.includes('s.retries++>=2'));assert.ok(hook.includes('s.toolCalls++>=3'));assert.ok(hook.includes('getTracks().forEach(t=>t.stop())'));
assert.ok(worker.includes("!admin&&['/api/voice-preview'"));assert.ok(backend.includes('liveConnectConstraints'));assert.ok(backend.includes('uses:1'));assert.ok(backend.includes('billing-disabled'));assert.ok(!hook.includes('GEMINI_API_KEY'));
console.log('PASS: PCM encoding/resampling, invalid audio rejection, mock playback ordering/interruption/backlog bound, model configuration and source-contract guards. No real Gemini or browser execution tested.');

const {VISIBLE_MODELS,isModelAvailable}=await load('lib/models.ts');assert.equal(VISIBLE_MODELS.length,3);assert.equal(isModelAvailable('deepseek-flash'),false);assert.equal(isModelAvailable('inclusionai/ling-3.1-flash'),false);console.log('PASS: three visible models; DeepSeek and Ling disabled.');

assert.deepEqual(config.tools[0],{googleSearch:{}});assert.match(config.systemInstruction,/use Google Search before answering/);
const {readLiveGrounding,mergeLiveGrounding}=await load('lib/live-grounding.ts');
const evidence=readLiveGrounding({groundingChunks:[{web:{uri:'https://nba.com/news/current',title:'NBA'}},{web:{uri:'javascript:alert(1)'}},{web:{uri:'https://example.com/unrelated'}}],groundingSupports:[{groundingChunkIndices:[0,1]}],searchEntryPoint:{renderedContent:'suggestions'}});assert.deepEqual(evidence.sources,[{url:'https://nba.com/news/current',title:'NBA'}]);assert.equal(evidence.suggestions,'suggestions');assert.equal(mergeLiveGrounding(evidence,evidence).sources.length,1);assert.equal(readLiveGrounding({}).sources.length,0);console.log('PASS: Live Search config, metadata-only source links, support-index selection, unsafe URL rejection and deduplication.');
