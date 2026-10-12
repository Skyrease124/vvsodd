'use client';
import {useRef,useState,useEffect} from 'react';
import {GoogleGenAI,type Session,type LiveServerMessage,type LiveConnectConfig} from '@google/genai';
import {readLiveGrounding,mergeLiveGrounding,type LiveGrounding} from '../lib/live-grounding';
import {pcm16Base64,decodePcm16,LiveAudioQueue} from '../lib/live-pcm';
type Ticket={token:string;lease:number;model:string;voice:string;config:LiveConnectConfig;maxSeconds:number};
type Running={context:AudioContext;abort:AbortController;stream?:MediaStream;mic?:AudioWorkletNode;source?:MediaStreamAudioSourceNode;queue:LiveAudioQueue;analyser:AnalyserNode;session?:Session;ticket?:Ticket;resumption?:string;retries:number;connection:number;started:number;deadline:number;timers:ReturnType<typeof setInterval>[];meter:number;user:string;assistant:string;grounding:LiveGrounding;ready:boolean;toolCalls:number;toolIds:Set<string>};
export function useGeminiLive(onTurn:(user:string,assistant:string,grounding:LiveGrounding)=>void,onStatus:(s:string)=>void,onFailure:(s:string)=>void,askNvidia:(question:string,signal:AbortSignal)=>Promise<string>,camera:()=>string|undefined){
 const running=useRef<Running|null>(null),outputLevel=useRef(0);const callbacks=useRef({onTurn,onStatus,onFailure,askNvidia,camera});callbacks.current={onTurn,onStatus,onFailure,askNvidia,camera};
 const [grounding,setGrounding]=useState<LiveGrounding|null>(null);
 const [seconds,setSeconds]=useState(0),[tokens,setTokens]=useState<number|null>(null),[connected,setConnected]=useState(false);
 function stop(){const s=running.current;running.current=null;setConnected(false);outputLevel.current=0;if(!s)return;s.abort.abort();s.ready=false;s.session?.close();s.queue.interrupt();s.timers.forEach(clearInterval);cancelAnimationFrame(s.meter);if(s.mic)s.mic.port.onmessage=null;s.mic?.disconnect();s.source?.disconnect();s.stream?.getTracks().forEach(t=>t.stop());void s.context.close().catch(()=>{});if(s.ticket)void fetch('/api/gemini-token',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({lease:s.ticket.lease}),keepalive:true}).catch(()=>{});}
 function fail(message:string){stop();callbacks.current.onFailure(message);}
 function commit(s:Running,interrupted=false){if(s.user.trim()||s.assistant.trim())callbacks.current.onTurn(s.user.trim(),s.assistant.trim()+(interrupted?' [Interrupted]':''),s.grounding);s.user='';s.assistant='';s.grounding={sources:[],suggestions:''};}
 async function connect(s:Running){
  if(running.current!==s||!s.ticket)return;const id=++s.connection;const ticket=s.ticket;
  const ai=new GoogleGenAI({apiKey:ticket.token,httpOptions:{apiVersion:'v1beta'}});
  const session=await ai.live.connect({model:ticket.model,config:{...ticket.config,sessionResumption:s.resumption?{handle:s.resumption}:{}},callbacks:{
   onopen:()=>{if(running.current===s)callbacks.current.onStatus('Voice connected · preparing audio…');},
   onmessage:(message:LiveServerMessage)=>{
    if(running.current!==s||id!==s.connection)return;
    if(message.setupComplete){s.ready=true;setConnected(true);callbacks.current.onStatus('Listening');}
    if(message.sessionResumptionUpdate?.resumable&&message.sessionResumptionUpdate.newHandle)s.resumption=message.sessionResumptionUpdate.newHandle;
    if(message.usageMetadata?.totalTokenCount!==undefined)setTokens(message.usageMetadata.totalTokenCount);
    const content=message.serverContent;
    if(content?.groundingMetadata){s.grounding=mergeLiveGrounding(s.grounding,readLiveGrounding(content.groundingMetadata));setGrounding(s.grounding);}
    if(content?.interrupted){s.queue.interrupt();outputLevel.current=0;commit(s,true);callbacks.current.onStatus('Listening · reply interrupted');}
    if(content?.inputTranscription?.text)s.user+=content.inputTranscription.text;
    if(content?.outputTranscription?.text)s.assistant+=content.outputTranscription.text;
    try{for(const part of content?.modelTurn?.parts||[]){if(part.inlineData?.data&&part.inlineData.mimeType?.startsWith('audio/pcm')){s.queue.enqueue(decodePcm16(part.inlineData.data));callbacks.current.onStatus('SkyData is speaking · you can interrupt');}}}catch(e){fail(e instanceof Error?e.message:'Audio failed.');return;}
    if(content?.turnComplete){commit(s);callbacks.current.onStatus('Listening');}
    if(message.toolCall?.functionCalls)for(const call of message.toolCall.functionCalls){
     if(!call.id||s.toolIds.has(call.id))continue;s.toolIds.add(call.id);
     const question=call.args?.question;const toolId=call.id;
     if(call.name!=='ask_skydata'||typeof question!=='string'||!question.trim()||question.length>8000||s.toolCalls++>=3){s.session?.sendToolResponse({functionResponses:[{id:toolId,name:call.name,response:{error:'Tool unavailable or three-call session limit reached.'}}]});continue;}
     void callbacks.current.askNvidia(question,s.abort.signal).then(result=>{if(running.current===s&&s.toolIds.has(toolId))s.session?.sendToolResponse({functionResponses:[{id:toolId,name:call.name,response:{result}}]});}).catch(()=>{if(running.current===s&&s.toolIds.has(toolId))s.session?.sendToolResponse({functionResponses:[{id:toolId,name:call.name,response:{error:'Assistant request failed.'}}]});});
    }
    for(const id of message.toolCallCancellation?.ids||[])s.toolIds.delete(id);
    if(message.goAway)void reconnect(s,id);
   },
   onerror:()=>{if(running.current===s&&id===s.connection)callbacks.current.onStatus('Voice connection interrupted · waiting for recovery…');},
   onclose:event=>{if(running.current!==s||id!==s.connection)return;if(event.code===1008||event.code===1011||event.code===1007){fail('Voice session ended: access, quota, or setup error. No paid fallback.');return;}void reconnect(s,id);}
  }});
  if(running.current!==s||id!==s.connection){session.close();return;}s.session=session;
 }
 async function reconnect(s:Running,id:number){if(running.current!==s||id!==s.connection)return;s.connection++;s.deadline=Date.now()+25000;s.ready=false;setConnected(false);s.queue.interrupt();outputLevel.current=0;s.session?.close();if(!s.resumption||s.retries++>=2){fail('Voice connection ended. Tap Start microphone to reconnect.');return;}callbacks.current.onStatus('Reconnecting voice…');try{await connect(s);}catch{if(running.current===s)fail('Reconnect failed. Start a new voice session.');}}
 async function start(voice:string){
  stop();setSeconds(0);setTokens(null);setGrounding(null);
  // Create and resume inside the user gesture before awaiting network or permissions.
  const context=new AudioContext();const analyser=context.createAnalyser();analyser.fftSize=256;analyser.connect(context.destination);
  const s:Running={context,analyser,queue:new LiveAudioQueue(context,analyser),abort:new AbortController(),retries:0,connection:0,started:Date.now(),deadline:Date.now()+25000,timers:[],meter:0,user:'',assistant:'',grounding:{sources:[],suggestions:''},ready:false,toolCalls:0,toolIds:new Set()};running.current=s;
  try{
   await context.resume();if(running.current!==s)return;callbacks.current.onStatus('Connecting voice…');
   const response=await fetch('/api/gemini-token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({voice}),signal:AbortSignal.any([s.abort.signal,AbortSignal.timeout(20000)])});const data=await response.json() as Ticket & {error?:string};if(!response.ok)throw Error(data.error||'Voice unavailable.');s.ticket=data as Ticket;
   if(running.current!==s){void fetch('/api/gemini-token',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({lease:data.lease})}).catch(()=>{});return;}
   await context.audioWorklet.addModule('/gemini-mic-worklet.js');if(running.current!==s)return;
   const media=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});if(running.current!==s){media.getTracks().forEach(t=>t.stop());return;}s.stream=media;
   media.getTracks().forEach(t=>t.addEventListener('ended',()=>{if(running.current===s)fail('Microphone stopped. Start a new session.');},{once:true}));
   s.source=context.createMediaStreamSource(media);s.mic=new AudioWorkletNode(context,'skydata-microphone');s.source.connect(s.mic);s.mic.connect(context.destination);
   s.mic.port.onmessage=event=>{if(running.current!==s||!s.ready||!s.session)return;try{s.session.sendRealtimeInput({audio:{data:pcm16Base64(event.data,context.sampleRate),mimeType:'audio/pcm;rate=16000'}});}catch{fail('Audio connection stopped. Start a new voice session.');}};
   const samples=new Float32Array(analyser.fftSize);const meter=()=>{if(running.current!==s)return;analyser.getFloatTimeDomainData(samples);let sum=0;for(const x of samples)sum+=x*x;outputLevel.current=Math.min(1,Math.sqrt(sum/samples.length)*7);s.meter=requestAnimationFrame(meter);};meter();
   s.timers.push(setInterval(()=>{if(running.current!==s)return;const duration=Math.floor((Date.now()-s.started)/1000);setSeconds(duration);if(duration>=data.maxSeconds)fail('Five-minute safety limit reached. Start another session when ready.');},1000));
   s.timers.push(setInterval(()=>{if(running.current!==s||!s.ready)return;const frame=callbacks.current.camera();if(frame)try{s.session?.sendRealtimeInput({video:{data:frame.split(',')[1],mimeType:'image/jpeg'}});}catch{fail('Camera stream could not send. Restart voice.');}},1000));
   await connect(s);if(running.current!==s)return;
   // A stalled setup is not retried indefinitely.
   const watchdog=setInterval(()=>{if(running.current===s&&!s.ready&&Date.now()>s.deadline)fail('Voice setup timed out. Check access and restart.');},1000);s.timers.push(watchdog);
  }catch(e){if(running.current===s)fail(e instanceof DOMException&&e.name==='NotAllowedError'?'Allow microphone access, then start voice again.':e instanceof Error?e.message:'Voice could not start.');}
 }
 useEffect(()=>()=>stop(),[]);
 function sendText(text:string){const s=running.current;if(!s?.ready||!s.session||!text.trim())return false;s.queue.interrupt();outputLevel.current=0;commit(s,true);s.user=text.trim();s.session.sendClientContent({turns:[{role:'user',parts:[{text:s.user}]}],turnComplete:true});callbacks.current.onStatus('Thinking…');return true;}
 return {start,stop,sendText,outputLevel,seconds,tokens,connected,grounding};
}
