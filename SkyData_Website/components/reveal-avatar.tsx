'use client';
import {LiveSearchSources} from './live-search-sources';
import type {LiveGrounding} from '../lib/live-grounding';
import {VoicePicker} from './voice-picker';
import {useEffect,useRef,useState,type RefObject} from 'react';
import './reveal-avatar.css';
import {assemblyProgress,AVATAR_DURATION,drawPortrait} from '../lib/avatar-render';

type CameraProps={video:RefObject<HTMLVideoElement|null>;active:boolean;opening:boolean;error:string;configured:boolean;onToggle:()=>void;onFlip:()=>void};
type Props={grounding:LiveGrounding|null;isOwner:boolean;onPreview:()=>void;seconds:number;tokens:number|null;camera:CameraProps;voice:string;onVoiceChange:(voice:string)=>void;level:RefObject<number>;status:string;active:boolean;onExit:()=>void;onRetry:()=>void;onFinish:()=>void};
export function RevealAvatar({grounding,isOwner,onPreview,seconds,tokens,camera,voice,onVoiceChange,level,status,active,onExit,onRetry,onFinish}:Props){
 const canvas=useRef<HTMLCanvasElement>(null),exit=useRef<HTMLButtonElement>(null);const [imageFailed,setImageFailed]=useState(false);
 useEffect(()=>{
  const old=document.body.style.overflow;document.body.style.overflow='hidden';const focus=document.activeElement as HTMLElement|null;exit.current?.focus();
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();onExit();}if(e.key==='Tab'){const buttons=Array.from(document.querySelectorAll<HTMLElement>('.reveal-stage button:not(:disabled), .reveal-stage select, .reveal-stage a'));const first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};
  document.addEventListener('keydown',key);return()=>{document.body.style.overflow=old;document.removeEventListener('keydown',key);focus?.focus();};
 },[onExit]);
 useEffect(()=>{
  const c=canvas.current,ctx=c?.getContext('2d');if(!c||!ctx)return;
  const image=new Image();let alive=true,frame=0,start=0,last=0,open=0;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const draw=(t:number)=>{
   if(!alive)return;if(!start)start=t;
   // Cap animation work at 30fps; never run it while the tab is hidden.
   if(t-last<32){frame=requestAnimationFrame(draw);return;}last=t;
   const d=Math.min(devicePixelRatio||1,1.5),w=Math.round(c.clientWidth*d),h=Math.round(c.clientHeight*d);
   if(c.width!==w)c.width=w;if(c.height!==h)c.height=h;ctx.clearRect(0,0,w,h);
   const size=Math.min(w*1.15,h),x=(w-size)/2,y=(h-size)/2;
   const elapsed=(t-start)/1000;ctx.save();ctx.translate(x,y);
   if(elapsed<AVATAR_DURATION&&!reduced){
    const grid=30,tile=size/grid,iw=image.naturalWidth/grid,ih=image.naturalHeight/grid;
    for(let row=0;row<grid;row++)for(let col=0;col<grid;col++){
     const index=row*grid+col,p=assemblyProgress(elapsed,index),angle=index*2.39996;
     const dx=col*tile+(1-p)*Math.cos(angle)*size*1.3,dy=row*tile+(1-p)*Math.sin(angle)*size*1.4;
     ctx.globalAlpha=Math.min(1,p*3);ctx.drawImage(image,col*iw,row*ih,iw,ih,dx,dy,tile+.5,tile+.5);
    }
   }else{const amplitude=Math.min(1,Math.max(0,level.current));const target=amplitude>.025?Math.min(1,Math.pow(amplitude, .65)*1.35):0;open+=(target-open)*(target>open?.75:.5);drawPortrait(ctx,image,size,t,open,reduced);}
   ctx.restore();frame=requestAnimationFrame(draw);
  };
  const visibility=()=>{cancelAnimationFrame(frame);if(!document.hidden&&image.complete&&image.naturalWidth){last=0;frame=requestAnimationFrame(draw);}};
  image.onload=()=>{if(alive){setImageFailed(false);frame=requestAnimationFrame(draw);}};
  image.onerror=()=>{if(alive)setImageFailed(true);};image.src='/avatar/skydata-male-v2.png';
  document.addEventListener('visibilitychange',visibility);
  return()=>{alive=false;cancelAnimationFrame(frame);image.onload=null;image.onerror=null;document.removeEventListener('visibilitychange',visibility);};
 },[level]);
 return <div className="reveal-stage" role="dialog" aria-modal="true" aria-label="SkyData live face conversation"><div className="reveal-top"><span>SKYDATA <i>LIVE</i></span><button ref={exit} onClick={onExit} aria-label="Exit face mode">✕</button></div><div className="reveal-portrait"><div className="reveal-camera" hidden={!camera.active&&!camera.opening}><video ref={camera.video} autoPlay playsInline muted aria-label="Live camera preview"/><span>{camera.opening?'Opening camera…':'Camera live'}</span></div><canvas ref={canvas} role="img" aria-label="Polished silver male SkyData android, assembled from nanobot tiles, with audio-driven mouth and blinking eyes"/>{imageFailed&&<p role="status">The face could not load. Voice controls remain available.</p>}</div><div className="reveal-bottom"><LiveSearchSources grounding={grounding}/><p role="status">{status||'Assembling…'}</p>{active?<span>Listening continuously · interrupt anytime</span>:<button onClick={onRetry}>Start microphone</button>}<div className="reveal-camera-controls">{camera.configured?<button onClick={camera.onToggle} aria-pressed={camera.active}>{camera.active||camera.opening?'Camera off':'Camera on'}</button>:<a href="/connect-camera">Connect camera</a>}{camera.active&&<button onClick={camera.onFlip} disabled={camera.opening}>Flip camera</button>}</div>{camera.error&&<p role="alert">{camera.error}</p>}{isOwner&&<><VoicePicker voice={voice} onSelect={onVoiceChange} onBeforePlay={onPreview}/><span>Session {seconds}s / 300s · {tokens===null?'Token usage not yet reported':tokens+' reported tokens'} · No paid fallback</span></>}<span>Camera streams while enabled · Exit returns to your chat</span></div></div>;
}
