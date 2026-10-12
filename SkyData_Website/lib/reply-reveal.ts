// Buffer incoming chunks so network bursts do not become visual jumps.
export function createReplyReveal(paint:(text:string)=>void,signal:AbortSignal,instant=false){
 let target='',shown=0,finishTicks=0,timer:ReturnType<typeof setTimeout>|undefined,disposed=false;
 let complete:(()=>void)|undefined;
 const settle=()=>{const done=complete;complete=undefined;done?.();};
 function tick(){
  timer=undefined;if(disposed||signal.aborted){settle();return;}
  let next=instant||(typeof document!=='undefined'&&document.hidden)?target.length:Math.min(target.length,shown+Math.max(2,Math.ceil((target.length-shown)/(finishTicks||8))));
  if(finishTicks>0)finishTicks--;
  // Keep surrogate pairs intact when revealing emoji.
  if(next<target.length&&next>0&&/[\uD800-\uDBFF]/.test(target[next-1]))next++;
  if(next>shown){shown=next;paint(target.slice(0,shown));}
  if(shown<target.length)timer=setTimeout(tick,40);else settle();
 }
 function push(text:string){
  if(disposed||signal.aborted)return;
  if(!text.startsWith(target.slice(0,shown)))shown=0;
  target=text;if(timer===undefined)tick();
 }
 function dispose(){disposed=true;if(timer!==undefined)clearTimeout(timer);timer=undefined;signal.removeEventListener('abort',dispose);settle();}
 signal.addEventListener('abort',dispose,{once:true});
 return {push,finish(text:string){finishTicks=10;push(text);if(disposed||signal.aborted||shown>=target.length)return Promise.resolve();return new Promise<void>(resolve=>{complete=resolve;});},dispose};
}
