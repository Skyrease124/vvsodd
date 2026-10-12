'use client';
import { useEffect, useRef, useState } from 'react';
import { recentCameraFrames } from '../lib/camera-frames';
export function useLiveCamera(){
 const video=useRef<HTMLVideoElement|null>(null);const stream=useRef<MediaStream|null>(null);const generation=useRef(0);
 const frames=useRef<{image:string;at:number}[]>([]),timer=useRef<ReturnType<typeof setInterval>|null>(null);const facing=useRef<'environment'|'user'>('environment');
 const [active,setActive]=useState(false);const [opening,setOpening]=useState(false);const [error,setError]=useState('');
 function stop(){generation.current++;if(timer.current)clearInterval(timer.current);timer.current=null;frames.current=[];stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;if(video.current)video.current.srcObject=null;setActive(false);setOpening(false);}
 async function start(withAudio=false,direction:'environment'|'user'=facing.current){
  facing.current=direction;
  stop();const current= generation.current;setError('');setOpening(true);
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw Error('Camera access is unavailable. Open SkyData in Safari.');
   const media=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:direction},width:{ideal:640},height:{ideal:480}},audio:withAudio?{echoCancellation:true,noiseSuppression:true,autoGainControl:true}:false});
   if(current!==generation.current){media.getTracks().forEach(track=>track.stop());return;}
   stream.current=media;const element=video.current;if(!element)throw Error('Camera preview could not open. Try again.');
   element.srcObject=media;await element.play();if(current!==generation.current)return;
   setActive(true);setOpening(false);
   const sample=()=>{if(current!==generation.current)return;try{frames.current=[...frames.current,{image:capture(),at:performance.now()}].slice(-4);}catch{}};sample();timer.current=setInterval(sample,750);
   media.getVideoTracks().forEach(track=>track.addEventListener('ended',()=>{if(stream.current===media){stop();setError('Camera stopped. Tap Video chat to reopen it.');}},{once:true}));
   return media;
  }catch(cause){if(current!==generation.current)return;stop();const message=cause instanceof DOMException&&cause.name==='NotAllowedError'?'Allow camera and microphone access to start video chat.':cause instanceof Error?cause.message:'Could not open the camera.';setError(message);throw Error(message);}
 }
 function capture(){
  const element=video.current;if(!stream.current||!element||element.readyState<2||!element.videoWidth)throw Error('The camera is warming up. Wait a moment, then ask again.');
  const scale=Math.min(1,480/element.videoWidth);const canvas=document.createElement('canvas');canvas.width=Math.round(element.videoWidth*scale);canvas.height=Math.round(element.videoHeight*scale);const context=canvas.getContext('2d');if(!context)throw Error('Could not capture this camera image.');
  context.drawImage(element,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',.55);
 }
 function captureSequence(){const now=performance.now();const image=capture();frames.current=[...frames.current,{image,at:now}].slice(-4);return recentCameraFrames(frames.current,now);}
 async function flip(){return start(false,facing.current==='environment'?'user':'environment');}
 useEffect(()=>{const hide=()=>{if(document.hidden)stop();};document.addEventListener('visibilitychange',hide);return()=>{document.removeEventListener('visibilitychange',hide);generation.current++;if(timer.current)clearInterval(timer.current);frames.current=[];stream.current?.getTracks().forEach(track=>track.stop());};},[]);
 return {video,active,opening,error,start,stop,capture,captureSequence,flip,isActive:()=>Boolean(stream.current?.getVideoTracks().some(track=>track.readyState!=='ended'))};
}
