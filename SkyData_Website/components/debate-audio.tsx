'use client';
import { useEffect, useRef, useState } from 'react';
import { speechChunks } from '../lib/speech-text';
export function DebateAudio({text,voice,onDone}:{text:string;voice:string;onDone:()=>void}){
 const [part,setPart]=useState(0),[url,setUrl]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const audio=useRef<HTMLAudioElement>(null);
 const chunks=useRef(speechChunks(text));
 useEffect(()=>{
  const controller=new AbortController();let objectUrl='';setLoading(true);setError('');setUrl('');
  void (async()=>{try{const r=await fetch('/api/voice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:chunks.current[part],voice}),signal:controller.signal});
   if(!r.ok){const data=await r.json() as {error?:string};throw Error(data.error||'Audio could not be generated.');}
   const blob=await r.blob();if(controller.signal.aborted)return;objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);
  }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Could not prepare audio.');}finally{if(!controller.signal.aborted)setLoading(false);}})();
  return()=>{controller.abort();audio.current?.pause();if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[part,voice,retry]);
 return <><span role="status">{loading?'Preparing speech…':'Part '+(part+1)+' of '+chunks.current.length}</span>{error?<><p className="error" role="alert">{error}</p><button type="button" onClick={()=>setRetry(v=>v+1)}>Retry audio</button></>:url&&<audio key={url} ref={audio} controls autoPlay src={url} aria-label="SkyData reading the argument" onEnded={()=>{if(part+1<chunks.current.length)setPart(v=>v+1);else onDone();}} onError={()=>setError('Audio could not play. Try again.')} />}</>;
}
