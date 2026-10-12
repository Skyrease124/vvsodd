import assert from 'node:assert/strict';
import {readdirSync,writeFileSync,unlinkSync} from 'node:fs';
import {createRequire} from 'node:module';
const esbuildDir=readdirSync('node_modules/.pnpm').find(n=>n.startsWith('esbuild@'));
const esbuild=await import('../node_modules/.pnpm/'+esbuildDir+'/node_modules/esbuild/lib/main.js');
const build=await esbuild.build({entryPoints:['hooks/use-voice-conversation.ts','lib/live-debate-speech.ts'],bundle:true,packages:'external',platform:'node',format:'cjs',write:false,outdir:'/tmp/polly-client-tests',plugins:[{name:'mock-hooks',setup(b){b.onResolve({filter:/^react$/},()=>({path:'react',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const useRef=value=>({current:value}); export const useEffect=fn=>{globalThis.cleanups.push(fn());};',loader:'js'}));}}]});
globalThis.cleanups=[];
const require=createRequire(import.meta.url);
const modules=build.outputFiles.map((f,i)=>{const p=process.cwd()+'/node_modules/.cache/polly-client-'+i+'.cjs';writeFileSync(p,f.text);const m=require(p);unlinkSync(p);return m;});
const {useVoiceConversation}=modules[0],{createLiveDebateSpeech}=modules[1];
let recognitions=[],outputs=[],fetches=[],interrupted=0,words=[];
class Recognition{constructor(){recognitions.push(this);}start(){this.onstart?.();}stop(){this.onend?.();}abort(){}}
class Output{connect(){}disconnect(){}start(){this.started=true;}stop(){this.stopped=true;this.onended?.();}}
class Context{state='running';sampleRate=48000;destination={};async resume(){}async close(){this.state='closed';}async decodeAudioData(){return {};}createBufferSource(){const o=new Output();outputs.push(o);return o;}createAnalyser(){return {fftSize:256,connect(){},disconnect(){},getFloatTimeDomainData(samples){samples.fill(0);}};}}
globalThis.AudioContext=Context;globalThis.window={webkitSpeechRecognition:Recognition};Object.defineProperty(globalThis,'navigator',{value:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[]})}},configurable:true});
globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
let resolveAudio;
globalThis.fetch=async(url,init)=>{fetches.push({url,init});return new Promise(resolve=>{resolveAudio=()=>resolve(new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':'audio/mpeg'}}));});};
const conversation=useVoiceConversation(text=>words.push(text),()=>{},message=>{throw Error(message);},()=>interrupted++);
assert.equal(await conversation.start(),true);
const stale=conversation.speak('A previous answer.');while(!resolveAudio)await new Promise(r=>setTimeout(r,1));
const oldSignal=fetches[0].init.signal;
recognitions.at(-1).onspeechstart();assert.equal(oldSignal.aborted,true,'Starting to speak aborts in-flight synthesis');assert.ok(interrupted>0);
resolveAudio();await stale;assert.equal(outputs.length,0,'An obsolete response must never start playback');
resolveAudio=null;const current=conversation.speak('A new answer.');while(!resolveAudio)await new Promise(r=>setTimeout(r,1));resolveAudio();while(!outputs.length)await new Promise(r=>setTimeout(r,1));assert.equal(outputs[0].started,true);
recognitions.at(-1).onspeechstart();assert.equal(outputs[0].stopped,true,'Barge-in stops currently playing audio');await current;
const r=recognitions.at(-1);r.onresult({results:[{isFinal:true,0:{transcript:'My new question'}}]});conversation.finishTurn();assert.deepEqual(words,['My new question']);conversation.stop();
for(const cleanup of globalThis.cleanups)cleanup?.();
// Both debate sides use the shared speech endpoint. Turn completion waits for audio.
globalThis.fetch=async(url,init)=>{fetches.push({url,init});return new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':'audio/mpeg'}});};
for(const side of ['Aria','Jason']){const context=new Context(),controller=new AbortController(),speech=createLiveDebateSpeech(context,side,controller.signal,()=>{});const count=outputs.length;const finishing=speech.finish('This is a complete debate argument.');while(outputs.length===count)await new Promise(r=>setTimeout(r,1));let completed=false;finishing.then(()=>completed=true);await Promise.resolve();assert.equal(completed,false);outputs.at(-1).onended();await finishing;assert.equal(fetches.at(-1).url,'/api/voice');assert.equal(JSON.parse(fetches.at(-1).init.body).text,'This is a complete debate argument.');speech.stop();}
console.log('PASS: microphone recognition persists; barge-in aborts synthesis and stops playback; stale audio is suppressed; new transcript is submitted; both debate sides use shared endpoint and finish playback before next turn. Browser, audio, and provider mocked; iPhone audio untested.');
