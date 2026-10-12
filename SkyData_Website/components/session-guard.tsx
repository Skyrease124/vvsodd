'use client';
import {useEffect} from 'react';
export function SessionGuard(){useEffect(()=>{let active=true;const check=async()=>{try{const response=await fetch('/api/auth/session',{cache:'no-store'});if(active&&response.status===403)window.location.assign('/login');}catch{}};const timer=setInterval(()=>void check(),15000);const visible=()=>{if(document.visibilityState==='visible')void check();};document.addEventListener('visibilitychange',visible);return()=>{active=false;clearInterval(timer);document.removeEventListener('visibilitychange',visible);};},[]);return null;}
