export function pcm16Base64(samples:Float32Array,inputRate:number):string{
 const length=Math.floor(samples.length*16000/inputRate);const bytes=new Uint8Array(length*2),view=new DataView(bytes.buffer);
 for(let i=0;i<length;i++){const start=Math.floor(i*inputRate/16000),end=Math.max(start+1,Math.floor((i+1)*inputRate/16000));let sum=0;for(let j=start;j<end&&j<samples.length;j++)sum+=samples[j];const sample=Math.max(-1,Math.min(1,sum/(end-start)));view.setInt16(i*2,Math.round(sample*(sample<0?32768:32767)),true);}
 let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);
}
export function decodePcm16(data:string):Float32Array{
 const binary=atob(data);if(binary.length%2||binary.length>480000)throw Error('Invalid audio chunk.');const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));const view=new DataView(bytes.buffer),samples=new Float32Array(bytes.length/2);
 for(let i=0;i<samples.length;i++)samples[i]=view.getInt16(i*2,true)/32768;return samples;
}
export class LiveAudioQueue{
 private nodes=new Set<AudioBufferSourceNode>();private next=0;
 constructor(private context:AudioContext,private destination:AudioNode){}
 enqueue(samples:Float32Array){if(!samples.length)return;const start=Math.max(this.context.currentTime+.01,this.next);if(start-this.context.currentTime>10)throw Error('Audio stream fell behind. Restart the voice session.');const buffer=this.context.createBuffer(1,samples.length,24000);buffer.copyToChannel(new Float32Array(samples),0);const node=this.context.createBufferSource();node.buffer=buffer;node.connect(this.destination);this.nodes.add(node);node.onended=()=>{this.nodes.delete(node);node.disconnect();};node.start(start);this.next=start+buffer.duration;}
 interrupt(){for(const node of this.nodes){node.onended=null;try{node.stop();}catch{}node.disconnect();}this.nodes.clear();this.next=this.context.currentTime;}
}
