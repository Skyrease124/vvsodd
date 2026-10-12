import { joinRecognitionResults } from './voice-results';
import { cleanTranscript } from './clean-response';
export type Recognition={
 lang:string;continuous:boolean;interimResults:boolean;maxAlternatives:number;
 onstart:(()=>void)|null;onspeechstart:(()=>void)|null;onspeechend:(()=>void)|null;
 onresult:((event:{results:ArrayLike<{isFinal:boolean;[index:number]:{transcript:string}}>})=>void)|null;
 onerror:((event:{error:string})=>void)|null;onend:(()=>void)|null;
 start:()=>void;stop:()=>void;abort:()=>void;
};
export type RecognitionConstructor=new()=>Recognition;
export function browserRecognition():RecognitionConstructor|undefined{
 const w=window as Window&{SpeechRecognition?:RecognitionConstructor;webkitSpeechRecognition?:RecognitionConstructor};
 return w.SpeechRecognition||w.webkitSpeechRecognition;
}
/** One speech turn at a time; suspend recognition throughout the assistant reply. */
export class BrowserVoice {
 private active:Recognition|null=null;private wanted=false;private finishing=false;
 private words='';private failures=0;
 private pauseTimer:ReturnType<typeof setTimeout>|null=null;
 private endTimer:ReturnType<typeof setTimeout>|null=null;
 private restartTimer:ReturnType<typeof setTimeout>|null=null;
 private limitTimer:ReturnType<typeof setTimeout>|null=null;
 private startupTimer:ReturnType<typeof setTimeout>|null=null;
 constructor(private Constructor:RecognitionConstructor,private onText:(text:string)=>void,private onStatus:(status:string)=>void,private onFailure:(message:string)=>void,private language='en-US',private onUnavailable?:(message:string)=>void,private onSpeechStart?:()=>void){}
 private clearTimers(){for(const t of [this.pauseTimer,this.endTimer,this.restartTimer,this.limitTimer,this.startupTimer])if(t!==null)clearTimeout(t);this.pauseTimer=this.endTimer=this.restartTimer=this.limitTimer=this.startupTimer=null;}
 pause(){this.wanted=false;this.clearTimers();const r=this.active;this.active=null;if(r){r.onstart=r.onspeechstart=r.onspeechend=r.onresult=r.onerror=r.onend=null;try{r.abort();}catch{}}this.words='';this.finishing=false;}
 stop(){this.pause();}
 finishTurn(){this.finish();}
 resume(){this.pause();this.wanted=true;this.failures=0;this.open();}
 private fail(message:string){this.pause();this.onFailure(message);}
 private unavailable(message:string){this.pause();(this.onUnavailable||this.onFailure)(message);}
 private submit(){
  if(!this.wanted)return;const text=cleanTranscript(this.words).slice(0,8000);this.pause();
  if(text&&text!=='[NO_SPEECH]'){this.onText(text);}else{this.wanted=true;this.restart();}
 }
 private restart(){if(!this.wanted)return;this.onStatus('Listening…');this.restartTimer=setTimeout(()=>{this.restartTimer=null;this.open();},400);}
 private finish(){
  if(!this.active||!this.wanted||this.finishing||!this.words)return;
  this.finishing=true;if(this.pauseTimer!==null)clearTimeout(this.pauseTimer);this.pauseTimer=null;
  try{this.active.stop();}catch{this.submit();return;}
  // Some Safari versions omit end after stop. Preserve the latest recognized words.
  if(this.wanted&&this.active)this.endTimer=setTimeout(()=>this.submit(),1500);
 }
 private afterPause(delay:number){if(this.pauseTimer!==null)clearTimeout(this.pauseTimer);this.pauseTimer=setTimeout(()=>{this.pauseTimer=null;this.finish();},delay);}
 private open(){
  if(!this.wanted||this.active)return;
  let r:Recognition;try{r=new this.Constructor();}catch{this.unavailable('Live recognition is unavailable. Try recorded speech or check browser microphone permissions.');return;}
  this.active=r;this.finishing=false;this.words='';
  r.lang=this.language;r.continuous=true;r.interimResults=true;r.maxAlternatives=1;
  const current=()=>this.wanted&&this.active===r;
  r.onstart=()=>{if(current()){if(this.startupTimer!==null)clearTimeout(this.startupTimer);this.startupTimer=null;this.onStatus('Listening live…');}};
  r.onspeechstart=()=>{if(current()&&!this.finishing){this.onSpeechStart?.();if(this.pauseTimer!==null)clearTimeout(this.pauseTimer);this.pauseTimer=null;}};
  r.onspeechend=()=>{if(current()&&this.words&&!this.finishing)this.afterPause(700);};
  r.onresult=event=>{
   if(!current())return;
   const results=Array.from(event.results);this.words=joinRecognitionResults(results);
   if(!this.words)return;this.failures=0;
   this.onStatus('You: '+this.words.slice(-180));
   if(!this.finishing)this.afterPause(results.every(x=>x.isFinal)?750:1500);
  };
  r.onerror=event=>{
   if(!current())return;
   if(event.error==='no-speech'||event.error==='aborted')return;
   this.words='';
   if(event.error==='not-allowed')return this.fail('Allow speech recognition and microphone access, then start voice chat again.');
   if(event.error==='service-not-allowed'||event.error==='language-not-supported')return this.unavailable('Live browser recognition is unavailable here. Try recorded speech, then start voice chat again.');
   if(++this.failures>=3)return this.unavailable('Live recognition could not connect. Try recorded speech or start voice chat again.');
   this.active=null;this.clearTimers();r.onstart=r.onspeechstart=r.onspeechend=r.onresult=r.onerror=r.onend=null;try{r.abort();}catch{}this.restart();
  };
  r.onend=()=>{
   if(!current())return;
   if(this.words){this.submit();return;}
   this.active=null;this.clearTimers();this.restart();
  };
  this.onStatus('Starting speech recognition…');
  this.startupTimer=setTimeout(()=>{if(current())this.unavailable('Speech recognition did not start. Switching to recorded voice…');},8000);
  try{r.start();if(current())this.limitTimer=setTimeout(()=>{if(current()){if(this.words)this.finish();else{this.active=null;r.onend=null;try{r.abort();}catch{}this.clearTimers();this.restart();}}},60000);}
  catch{this.clearTimers();this.active=null;if(++this.failures>=3)this.unavailable('Could not start live recognition. Try recorded speech or check browser microphone permissions.');else this.restart();}
 }
}
