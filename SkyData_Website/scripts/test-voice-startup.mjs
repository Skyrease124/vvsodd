import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const helper=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(fs.readFileSync('lib/voice-results.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText).toString('base64'));globalThis.voiceResults=helper;
let source=fs.readFileSync('lib/browser-voice.ts','utf8').replace("import { joinRecognitionResults } from './voice-results';","const {joinRecognitionResults}=globalThis.voiceResults;").replace("import { cleanTranscript } from './clean-response';","const cleanTranscript=v=>v;");
const {BrowserVoice}=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
let clock=0,id=0,timers=new Map(),instances=[],texts=[],errors=[],fallbacks=[],statuses=[];
globalThis.setTimeout=(fn,ms)=>{timers.set(++id,{fn,at:clock+ms});return id;};globalThis.clearTimeout=i=>timers.delete(i);
function advance(ms){const end=clock+ms;for(;;){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;clock=next[1].at;timers.delete(next[0]);next[1].fn();}clock=end;}
class Recognition{constructor(){instances.push(this);}start(){}stop(){this.onend?.();}abort(){this.aborted=true;}}
const make=()=>new BrowserVoice(Recognition,t=>texts.push(t),s=>statuses.push(s),e=>errors.push(e),'en-US',m=>fallbacks.push(m));
let voice=make();voice.resume();advance(8000);assert.equal(fallbacks.length,1,'Silent startup falls back');assert.equal(instances[0].aborted,true);assert.equal(timers.size,0);advance(60000);assert.equal(fallbacks.length,1);
voice=make();voice.resume();let r=instances.at(-1);r.onstart();advance(8000);assert.equal(fallbacks.length,1,'Started recognition does not fall back');r.onresult({results:[{isFinal:true,0:{transcript:'hello'}}]});advance(750);assert.deepEqual(texts,['hello'],'Hello is submitted after pause');assert.equal(timers.size,0);voice.resume();r=instances.at(-1);r.onstart();r.onresult({results:[{isFinal:true,0:{transcript:'second turn'}}]});advance(750);assert.deepEqual(texts,['hello','second turn'],'Listening resumes for next turn');voice.stop();assert.equal(timers.size,0);
voice=make();voice.resume();r=instances.at(-1);r.onstart();r.onresult({results:[{isFinal:true,0:{transcript:'What about this'}},{isFinal:true,0:{transcript:'What about this'}}]});advance(750);assert.equal(texts.at(-1),'What about this');
voice=make();voice.resume();r=instances.at(-1);r.onerror({error:'not-allowed'});assert.equal(errors.length,1);assert.equal(fallbacks.length,1,'Permission denial never retries automatically');assert.equal(timers.size,0);
voice=make();voice.resume();voice.stop();advance(8000);assert.equal(fallbacks.length,1,'Exit cancels startup fallback');
voice=make();voice.resume();instances.at(-1).onerror({error:'service-not-allowed'});assert.equal(fallbacks.length,2,'Unavailable service uses recorded fallback');assert.equal(timers.size,0);
console.log('PASS: silent startup fallback, hello submission, second turn, permission denial, unavailable service, stop cleanup. Recognition and timers mocked; no iPhone/provider test.');
