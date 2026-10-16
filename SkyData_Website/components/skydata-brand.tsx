'use client';
import {useEffect,useRef} from 'react';
export function SkyDataBrand({active=false,level,audio,onHome}:{onHome?:()=>void;active?:boolean;level?:{current:number};audio?:{current:HTMLAudioElement|null}}){
 const star=useRef<HTMLSpanElement>(null);
 useEffect(()=>{
  const node=star.current;if(!node)return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');let frame=0,smoothed=0,last=0;
  function reset(){node!.style.removeProperty('--brand-level');node!.removeAttribute('data-speaking');node!.removeAttribute('data-playing');}
  function tick(time:number){
   if(document.hidden||reduced.matches||!active){reset();return;}
   if(time-last>=33){last=time;const value=Math.max(0,Math.min(1,Number.isFinite(level?.current)?level!.current:0));smoothed+=(value-smoothed)*.25;node!.style.setProperty('--brand-level',smoothed.toFixed(3));node!.toggleAttribute('data-speaking',smoothed>.015);node!.toggleAttribute('data-playing',!!audio?.current&&!audio.current.paused&&!audio.current.ended);}
   frame=requestAnimationFrame(tick);
  }
  function resume(){cancelAnimationFrame(frame);reset();if(active&&!document.hidden&&!reduced.matches)frame=requestAnimationFrame(tick);}
  resume();document.addEventListener('visibilitychange',resume);reduced.addEventListener('change',resume);
  return()=>{cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',resume);reduced.removeEventListener('change',resume);reset();};
 },[active,level,audio]);
 return <a className="brand" href="/" aria-label="SkyData home" onClick={e=>{if(onHome&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&e.button===0){e.preventDefault();onHome();}}}>skydata<span ref={star} aria-hidden="true">✦</span></a>;
}
