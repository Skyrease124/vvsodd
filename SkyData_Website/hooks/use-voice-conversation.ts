'use client';
import { VOICE_LANGUAGES } from '../lib/languages';
import { cleanTranscript } from '../lib/clean-response';
import { useEffect,useRef } from 'react';
import { SpeechTurn,encodeVoiceWav } from '../lib/voice-capture';
import { speechChunks } from '../lib/speech-text';
import { BrowserVoice,browserRecognition } from '../lib/browser-voice';
type Session={language:string;recognition?:BrowserVoice;context:AudioContext;stream?:MediaStream;processor?:ScriptProcessorNode;source?:MediaStreamAudioSourceNode;output?:AudioBufferSourceNode;muted?:GainNode;controller:AbortController;listening:boolean;turn:SpeechTurn;reply?:AbortController;epoch:number};
export function useVoiceConversation(onText:(text:string)=>void,onStatus:(status:string)=>void,onFailure:(message:string)=>void,onInterrupt?:()=>void){
 const session=useRef<Session|null>(null);
 const outputLevel=useRef(0),meterFrame=useRef(0);
 const callbacks=useRef({onText,onStatus,onFailure,onInterrupt});callbacks.current={onText,onStatus,onFailure,onInterrupt};
 function stop(){cancelAnimationFrame(meterFrame.current);outputLevel.current=0;const s=session.current;session.current=null;if(!s)return;s.controller.abort();s.reply?.abort();s.recognition?.stop();s.listening=false;s.output?.stop();s.processor?.disconnect();if(s.processor)s.processor.onaudioprocess=null;s.source?.disconnect();s.muted?.disconnect();s.stream?.getTracks().forEach(track=>track.stop());void s.context.close().catch(()=>{});}
 function interrupt(){const s=session.current;if(!s)return;s.epoch++;s.reply?.abort();s.reply=undefined;try{s.output?.stop();}catch{}s.output=undefined;cancelAnimationFrame(meterFrame.current);outputLevel.current=0;callbacks.current.onInterrupt?.();}
 function fail(message:string){stop();callbacks.current.onFailure(message);}
 function recover(message='The voice service is temporarily busy. Still listening—please repeat that.'){listen();if(session.current)callbacks.current.onStatus(message);}
 function listen(){const s=session.current;if(!s||s.controller.signal.aborted)return;s.turn.reset();s.listening=true;if(s.recognition){s.recognition.resume();return;}callbacks.current.onStatus('Listening with recorded speech recognition…');}
 async function transcribe(s:Session,samples:Float32Array){
  s.listening=false;callbacks.current.onStatus('Transcribing your recording…');
  try{const response=await fetch('/api/transcribe',{method:'POST',headers:{'Content-Type':'audio/wav','X-SkyData-Language':s.language},body:encodeVoiceWav(samples,s.context.sampleRate),signal:s.controller.signal});const data=await response.json() as {text?:string;error?:string;retryable?:boolean};if(session.current!==s)return;if(!response.ok){if(data.retryable){recover();return;}fail(data.error||'Voice transcription failed.');return;}const text=cleanTranscript(data.text);if(!text){listen();return;}interrupt();callbacks.current.onText(text);listen();}
  catch(error){if(session.current===s&&!s.controller.signal.aborted)recover('Connection interrupted. Still listening—please repeat that.');}
 }
 async function start(openMedia?:((withAudio:boolean)=>Promise<MediaStream|undefined>),mode:'browser'|'recording'='browser',language='en'){
  stop();if(!navigator.mediaDevices?.getUserMedia){fail('Microphone recording is unavailable in this browser. Open SkyData in Safari.');return false;}
  const context=new AudioContext();const s:Session={language,context,controller:new AbortController(),listening:false,turn:new SpeechTurn(),epoch:0};session.current=s;
  try{
   // Resume during the Start button gesture, so replies can play on iPhone.
   await context.resume();if(session.current!==s)return false;callbacks.current.onStatus(openMedia?'Opening camera and microphone…':'Opening microphone…');
   const Constructor=mode==='browser'?browserRecognition():undefined;
   if(Constructor){
    if(openMedia){const stream=await openMedia(false);if(!stream){if(session.current===s)fail('Video chat was canceled.');return false;}if(session.current!==s){stream.getTracks().forEach(track=>track.stop());return false;}s.stream=stream;stream.getTracks().forEach(track=>track.addEventListener('ended',()=>{if(session.current===s)fail('Camera stopped. Start the conversation again.');},{once:true}));}
    if(session.current!==s)return false;
    s.recognition=new BrowserVoice(Constructor,text=>{if(session.current===s&&s.listening){s.listening=false;interrupt();callbacks.current.onText(text);listen();}},status=>{if(session.current===s)callbacks.current.onStatus(status);},message=>{if(session.current===s)fail(message);},VOICE_LANGUAGES[s.language]?.recognition,()=>{if(session.current===s){callbacks.current.onStatus('Switching to recorded voice…');void start(openMedia,'recording',language);}},()=>{if(session.current===s)interrupt();});listen();return session.current===s;
   }
   if(mode==='browser')callbacks.current.onStatus('Live recognition is unavailable here. Opening recorded speech recognition…');
   const stream=openMedia?await openMedia(true):await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
   if(!stream){if(session.current===s)fail('Video chat was canceled.');return false;}
   if(session.current!==s){stream.getTracks().forEach(track=>track.stop());return false;}s.stream=stream;
   stream.getTracks().forEach(track=>track.addEventListener('ended',()=>{if(session.current===s)fail('Camera or microphone stopped. Start the conversation again.');},{once:true}));
   s.source=context.createMediaStreamSource(stream);s.processor=context.createScriptProcessor(4096,1,1);s.muted=context.createGain();s.muted.gain.value=0;
   s.source.connect(s.processor);s.processor.connect(s.muted);s.muted.connect(context.destination);
   let hearing=false;
   s.processor.onaudioprocess=event=>{if(session.current!==s||!s.listening)return;const turn=s.turn.push(event.inputBuffer.getChannelData(0),context.sampleRate);if(turn.audio){hearing=false;void transcribe(s,turn.audio);}else if(turn.speaking!==hearing){hearing=turn.speaking;if(hearing)interrupt();callbacks.current.onStatus(hearing?'Sound detected… Pause when you’re done.':'Listening… Speak naturally, then pause.');}};
   listen();return true;
  }catch(error){if(session.current===s)fail(error instanceof DOMException&&error.name==='NotAllowedError'?'Allow microphone access, then start voice chat again.':openMedia&&error instanceof Error?error.message:'Could not open the microphone. Start voice chat again.');return false;}
 }
 async function speak(text:string,outputLanguage?:string,voice='Aria',playbackRate=1){
  const s=session.current;if(!s)return;s.reply?.abort();try{s.output?.stop();}catch{}const epoch=++s.epoch;const reply=new AbortController();s.reply=reply;const signal=AbortSignal.any([s.controller.signal,reply.signal]);const current=()=>session.current===s&&s.epoch===epoch&&!signal.aborted;listen();
  try{
   for(const part of speechChunks(text)){
    if(!current())return;callbacks.current.onStatus('Preparing reply…');
    const response=await fetch('/api/voice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:part,replyLanguage:outputLanguage||s.language}),signal});
    if(!response.ok){const data=await response.json() as {error?:string;retryable?:boolean};if(data.retryable){recover('The reply is in the chat, but audio is temporarily unavailable. Still listening.');return;}throw Error(data.error||'Could not play the reply.');}
    const buffer=await s.context.decodeAudioData(await response.arrayBuffer());if(!current())return;
    if(s.context.state!=='running')await s.context.resume();if(!current())return;if(s.context.state!=='running')throw Error('Reply audio could not start. Tap Start microphone to resume voice.');
    const output=s.context.createBufferSource();s.output=output;output.buffer=buffer;const analyser=s.context.createAnalyser();analyser.fftSize=256;const samples=new Float32Array(analyser.fftSize);output.connect(analyser);analyser.connect(s.context.destination);const meter=()=>{if(!current())return;analyser.getFloatTimeDomainData(samples);let power=0;for(const sample of samples)power+=sample*sample;outputLevel.current=Math.min(1,Math.sqrt(power/samples.length)*7);meterFrame.current=requestAnimationFrame(meter);};meter();callbacks.current.onStatus('SkyData is speaking…');
    await new Promise<void>(resolve=>{output.onended=()=>{if(current()){cancelAnimationFrame(meterFrame.current);outputLevel.current=0;}output.disconnect();analyser.disconnect();resolve();};output.start();});
   }
   if(current()){s.output=undefined;s.reply=undefined;listen();}
  }catch(error){if(current()){s.output=undefined;s.reply=undefined;recover(error instanceof Error?error.message:'Voice unavailable. Your text reply is preserved.');}}
 }
 function finishTurn(){const s=session.current;if(!s||!s.listening)return;if(s.recognition){s.recognition.finishTurn();return;}const audio=s.turn.finish();if(audio)void transcribe(s,audio);else callbacks.current.onStatus('No speech captured yet. Speak closer to the microphone, then tap Translate now.');}
 useEffect(()=>()=>stop(),[]);
 return {start,stop,interrupt,speak,recover,finishTurn,outputLevel};
}
