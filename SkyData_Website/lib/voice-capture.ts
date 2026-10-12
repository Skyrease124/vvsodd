export class SpeechTurn {
 private frames:Float32Array[]=[];
 private lead:Float32Array[]=[];
 private heard=0;private silence=0;private duration=0;
 reset(){this.frames=[];this.lead=[];this.heard=0;this.silence=0;this.duration=0;}
 finish():Float32Array|undefined{
  if(this.heard<.18){this.reset();return;}
  const audio=new Float32Array(this.frames.reduce((sum,f)=>sum+f.length,0));let offset=0;for(const frame of this.frames){audio.set(frame,offset);offset+=frame.length;}this.reset();return audio;
 }
 push(frame:Float32Array,rate:number):{speaking:boolean;audio?:Float32Array}{
  const seconds=frame.length/rate;
  const rms=Math.sqrt(frame.reduce((sum,value)=>sum+value*value,0)/frame.length);
  const voiced=rms>.012;
  if(!this.frames.length){this.lead.push(frame.slice());if(this.lead.length>8)this.lead.shift();if(!voiced)return {speaking:false};this.frames=this.lead;this.lead=[];}
  else this.frames.push(frame.slice());
  this.duration+=seconds;
  if(voiced){this.heard+=seconds;this.silence=0;}else this.silence+=seconds;
  if(this.silence>=1.2||this.duration>=30){
   if(this.heard<.18){this.reset();return {speaking:false};}
   const audio=new Float32Array(this.frames.reduce((sum,f)=>sum+f.length,0));let offset=0;for(const f of this.frames){audio.set(f,offset);offset+=f.length;}
   this.reset();return {speaking:false,audio};
  }
  return {speaking:true};
 }
}

export function encodeVoiceWav(samples:Float32Array,inputRate:number):ArrayBuffer {
 const rate=16000,length=Math.ceil(samples.length*rate/inputRate);
 const buffer=new ArrayBuffer(44+length*2),view=new DataView(buffer);
 const label=(offset:number,text:string)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));};
 label(0,'RIFF');view.setUint32(4,36+length*2,true);label(8,'WAVE');label(12,'fmt ');
 view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
 view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
 label(36,'data');view.setUint32(40,length*2,true);
 for(let i=0;i<length;i++){const begin=Math.floor(i*inputRate/rate),end=Math.min(samples.length,Math.max(begin+1,Math.floor((i+1)*inputRate/rate)));let sum=0;for(let j=begin;j<end;j++)sum+=samples[j];const sample=Math.max(-1,Math.min(1,sum/(end-begin)));view.setInt16(44+i*2,Math.round(sample*(sample<0?32768:32767)),true);}
 return buffer;
}
