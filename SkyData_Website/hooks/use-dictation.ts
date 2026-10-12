'use client';
import { useEffect, useRef, useState } from 'react';

type Recognition = {
 lang:string; continuous:boolean; interimResults:boolean;
 onresult:((event:{results:ArrayLike<{isFinal:boolean;[index:number]:{transcript:string}}>})=>void)|null;
 onerror:((event:{error:string})=>void)|null;
 onend:(()=>void)|null; start:()=>void; stop:()=>void; abort:()=>void;
};
type SpeechWindow = Window & {SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};

export function useDictation(setInput:(text:string)=>void,stopAudio:()=>void,language='en-US'){
 const [listening,setListening]=useState(false);
 const [status,setStatus]=useState('');
 const active=useRef<Recognition|null>(null);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 function cancel(){
  const recognition=active.current;active.current=null;
  if(timer.current)clearTimeout(timer.current);
  timer.current=null;
  if(recognition){recognition.onresult=null;recognition.onerror=null;recognition.onend=null;recognition.abort();}
  setListening(false);setStatus('');
 }
 useEffect(()=>()=>{
  if(timer.current)clearTimeout(timer.current);
  const recognition=active.current;active.current=null;
  if(recognition){recognition.onresult=null;recognition.onerror=null;recognition.onend=null;recognition.abort();}
 },[]);
 function stop(){if(active.current){setStatus('Finishing…');active.current.stop();}}
 function start(input:string,options?:{onComplete:(text:string)=>void;onFailure:(message:string)=>void}){
  if(active.current)return false;
  const Constructor=(window as SpeechWindow).SpeechRecognition||(window as SpeechWindow).webkitSpeechRecognition;
  if(!Constructor){const message='Voice chat is unavailable in this browser. Use Safari or Chrome with microphone access.';setStatus(message);options?.onFailure(message);return false;}
  const recognition=new Constructor();active.current=recognition;
  const prefix=input.trimEnd();let heard=false;let failed=false;let transcript='';let failure='';
  recognition.lang=language;recognition.continuous=!options;recognition.interimResults=true;
  recognition.onresult=event=>{
   if(active.current!==recognition)return;
   const words=Array.from(event.results,result=>result[0]?.transcript||'').join(' ').trim();
   if(words){heard=true;transcript=words.slice(0,Math.max(0,8000-prefix.length-(prefix?1:0)));setInput((prefix?prefix+' ':'')+transcript);}
  };
  recognition.onerror=event=>{
   if(active.current!==recognition)return;
   failed=true;
   failure=event.error==='not-allowed'||event.error==='service-not-allowed'?'Allow microphone access to use the mic. You can also use your keyboard’s microphone.':event.error==='no-speech'?'No speech heard. Tap Mic and try again.':event.error==='audio-capture'?'No microphone is available. Check your microphone and try again.':'Dictation stopped. Try again or use your keyboard’s microphone.';
   setStatus(failure);
  };
  recognition.onend=()=>{
   if(active.current!==recognition)return;
   active.current=null;if(timer.current)clearTimeout(timer.current);timer.current=null;
   setListening(false);if(!failed)setStatus(heard?'Ready. Review your words, then send.':'No speech heard. Tap Mic and try again.');
   if(options){if(!failed&&heard)options.onComplete(transcript);else options.onFailure(failure||'No speech heard. Start voice chat again when you’re ready.');}
  };
  stopAudio();setListening(true);setStatus('Listening… Speak your question.');
  try{recognition.start();timer.current=setTimeout(()=>{if(active.current===recognition)stop();},60000);}
  catch{active.current=null;setListening(false);const message='Could not start dictation. Try again or use your keyboard’s microphone.';setStatus(message);options?.onFailure(message);return false;}
  return true;
 }
 return {listening,status,start,stop,cancel};
}
