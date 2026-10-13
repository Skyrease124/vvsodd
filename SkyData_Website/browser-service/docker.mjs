import {spawn} from 'node:child_process';
export function docker(args,{input,timeout=20000,onLine=()=>{},maxBytes=8*1024*1024}={}){
 return new Promise((resolve,reject)=>{
  const p=spawn('docker',args,{stdio:['pipe','pipe','pipe']});let out='',err='',pending='',bytes=0;
  const timer=setTimeout(()=>{p.kill('SIGKILL');reject(Error('Docker command deadline exceeded.'));},timeout);
  p.stdout.on('data',d=>{bytes+=d.length;if(bytes>maxBytes){p.kill('SIGKILL');return;}out+=d;pending+=d;const lines=pending.split('\n');pending=lines.pop();for(const line of lines){try{onLine(JSON.parse(line));}catch{}}});
  p.stderr.on('data',d=>{err=(err+d).slice(-1000);});p.on('error',e=>{clearTimeout(timer);reject(e);});p.on('close',code=>{clearTimeout(timer);if(code||bytes>maxBytes)reject(Error(bytes>maxBytes?'Container output limit.':'Docker command failed.'));else resolve(out);});p.stdin.on('error',()=>{});p.stdin.end(input);
 });
}
export async function remove(name){
 const present=await docker(['ps','-aq','--filter','name=^/'+name+'$']).catch(()=>null);
 if(present===null)return false;if(!present.trim())return true;
 await docker(['rm','-f',name]).catch(()=>{});
 return await docker(['ps','-aq','--filter','name=^/'+name+'$']).then(v=>!v.trim(),()=>false);
}
export async function imageId(name,labels,entrypoint){
 const [image]=JSON.parse(await docker(['image','inspect',name]));
 if(!/^sha256:[a-f0-9]{64}$/.test(image?.Id||'')||image.Config?.User!=='1000:1000'||JSON.stringify(image.Config?.Entrypoint)!==JSON.stringify(entrypoint)||Object.entries(labels).some(([key,value])=>image.Config?.Labels?.[key]!==value))throw Error('Incompatible backend image.');
 return image.Id;
}
