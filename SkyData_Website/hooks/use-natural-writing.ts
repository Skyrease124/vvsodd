'use client';
import {useEffect,useState} from 'react';
const key='skydata-natural-writing-v2';
const event='skydata-natural-writing-change';
export function useNaturalWriting(){
 const [enabled,setEnabled]=useState(true);
 useEffect(()=>{const read=()=>{try{setEnabled(localStorage.getItem(key)!=='false');}catch{}};read();window.addEventListener('storage',read);window.addEventListener(event,read);return()=>{window.removeEventListener('storage',read);window.removeEventListener(event,read);};},[]);
 function change(next:boolean){setEnabled(next);try{localStorage.setItem(key,String(next));window.dispatchEvent(new Event(event));}catch{}}
 return [enabled,change] as const;
}
