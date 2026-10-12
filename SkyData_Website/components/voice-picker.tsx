'use client';
import {useEffect,useRef,useState} from 'react';
import {GEMINI_VOICES} from '../lib/gemini-config';
import './voice-picker.css';
type Playback={context:AudioContext;request:AbortController;source?:AudioBufferSourceNode};
export function VoicePicker({voice,onSelect,onBeforePlay}:{voice:string;onSelect:(voice:string)=>void;onBeforePlay:()=>void}){
 const [playing,setPlaying]=useState(''),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const root=useRef<HTMLDetailsElement>(null);const playback=useRef<Playback|null>(null),cache=useRef(new Map<string,ArrayBuffer>());
 function halt(){const current=playback.current;playback.current=null;current?.request.abort();current?.source?.stop();current?.source?.disconnect();void current?.context.close().catch(()=>{});}
 function stop(){halt();setPlaying('');setLoading(false);}
 useEffect(()=>{const outside=(event:Event)=>{if(root.current&&!root.current.contains(event.target as Node)&&playback.current)stop();};document.addEventListener('pointerdown',outside);document.addEventListener('focusin',outside);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('focusin',outside);halt();};},[]);
 async function preview(name:string){
  if(playing===name){stop();return;}stop();setError('');onBeforePlay();
  // Resume from the tap before waiting for the API, including on iPhone Safari.
  const context=new AudioContext(),request=new AbortController(),current={context,request} as Playback;
  playback.current=current;setPlaying(name);setLoading(true);
  try{await context.resume();let bytes=cache.current.get(name);
   if(!bytes){const r=await fetch('/api/voice-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({voice:name}),signal:request.signal});if(!r.ok){const data=await r.json() as {error?:string};throw Error(data.error||'Could not preview this voice.');}bytes=await r.arrayBuffer();if(playback.current!==current)return;cache.current.set(name,bytes);}
   const buffer=await context.decodeAudioData(bytes.slice(0));if(playback.current!==current)return;
   const source=context.createBufferSource();current.source=source;source.buffer=buffer;source.connect(context.destination);source.onended=()=>{if(playback.current===current)stop();};source.start();setLoading(false);
  }catch(e){if(playback.current!==current)return;stop();setError(e instanceof Error?e.message:'Preview could not play.');}
 }
 return <details ref={root} className="skydata-voice-picker" data-voice-picker onToggle={e=>{if(!e.currentTarget.open)stop();}}><summary>Gemini voices · {voice}</summary><p>Play a sample, then choose Use voice. Previews pause live conversation.</p><div className="skydata-voice-list">{GEMINI_VOICES.map(name=><div className="skydata-voice-row" key={name}><strong>{name}</strong><button type="button" aria-label={(playing===name?'Stop':'Play')+' '+name+' voice sample'} aria-pressed={playing===name} onClick={()=>void preview(name)}>{playing===name?(loading?'Cancel':'■ Stop'):'▶ Play'}</button><button type="button" aria-pressed={voice===name} onClick={()=>{stop();onSelect(name);}} disabled={voice===name}>{voice===name?'Selected':'Use voice'}</button></div>)}</div>{loading&&<p role="status">Preparing {playing} sample…</p>}{error&&<p role="alert">{error}</p>}</details>;
}
