import { speechChunks } from './speech-text';
// Begin speaking complete sentences while the text response is still arriving.
export function createLiveDebateSpeech(context:AudioContext,voice:string,signal:AbortSignal,onStatus:(value:string)=>void){
 let offset=0,queue:string[]=[],running:Promise<void>|null=null,failure:unknown,source:AudioBufferSourceNode|null=null;
 async function prepare(text:string){
  signal.throwIfAborted();onStatus('Preparing speech…');
  const r=await fetch('/api/voice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,voice}),signal});
  if(!r.ok){const data=await r.json() as {error?:string};throw Error(data.error||'Live voice is unavailable.');}
  const buffer=await context.decodeAudioData(await r.arrayBuffer());signal.throwIfAborted();return buffer;
 }
 function play(buffer:AudioBuffer){return new Promise<void>((resolve,reject)=>{
  if(signal.aborted){reject(signal.reason);return;}
  source=context.createBufferSource();const current=source;current.buffer=buffer;current.connect(context.destination);
  const stop=()=>{try{current.stop();}catch{}cleanup();reject(signal.reason);};
  const cleanup=()=>{signal.removeEventListener('abort',stop);current.disconnect();if(source===current)source=null;};
  current.onended=()=>{cleanup();resolve();};signal.addEventListener('abort',stop,{once:true});onStatus('Speaking…');current.start();
 });}
 function pump(){if(running||failure||signal.aborted)return;
  running=(async()=>{
   let next:Promise<AudioBuffer>|null=queue.length?prepare(queue.shift()!):null;
   while(next){const buffer=await next;signal.throwIfAborted();next=queue.length?prepare(queue.shift()!):null;
    // Keep a prefetched failure handled until this section finishes playing.
    next?.catch(()=>{});await play(buffer);if(!next&&queue.length)next=prepare(queue.shift()!);
   }
  })().catch(e=>{failure=e;}).finally(()=>{running=null;if(queue.length&&!failure&&!signal.aborted)pump();});
 }
 function push(content:string,final=false){
  if(signal.aborted||failure)return;let pending=content.slice(offset),length=0;
  if(final)length=pending.length;
  else{const window=pending.slice(0,450);for(const m of window.matchAll(/[.!?](?=\s|$)/g))if(m.index!>=35)length=m.index!+1;
   if(!length&&pending.length>=450){length=window.lastIndexOf(' ');if(length<1)length=450;}
  }
  if(length){offset+=length;queue.push(...speechChunks(pending.slice(0,length)));pump();}
 }
 return {push,async finish(content:string){push(content,true);while(running)await running;signal.throwIfAborted();if(failure)throw failure;},stop(){queue=[];try{source?.stop();}catch{}}};
}
