import { inflateSync } from 'fflate';
import { PART_SIZE, PROJECT_LIMIT, type ProjectAttachment } from './project-types';
type Entry={path:string;size:number;compressed:number;offset:number;method:number;flags:number;chunk?:number};
export async function zipDirectory(file:Blob):Promise<Entry[]>{
 const tail=await file.slice(Math.max(0,file.size-65557)).arrayBuffer(),v=new DataView(tail);let end=-1;
 for(let i=tail.byteLength-22;i>=0;i--)if(v.getUint32(i,true)===0x06054b50&&i+22+v.getUint16(i+20,true)===tail.byteLength){end=i;break;}
 if(end<0)throw Error('This ZIP could not be read. Use a standard ZIP archive.');
 const count=v.getUint16(end+10,true),bytes=v.getUint32(end+12,true),offset=v.getUint32(end+16,true);
 if(v.getUint16(end+4,true)||v.getUint16(end+6,true)||count===65535||offset===0xffffffff||bytes===0xffffffff)throw Error('Split and ZIP64 archives are not supported. Use a standard ZIP under 500 MB.');
 if(count>20000||bytes>8*1024*1024||offset+bytes>file.size-tail.byteLength+end)throw Error('This archive has too many files or an invalid directory.');
 const dir=await file.slice(offset,offset+bytes).arrayBuffer(),d=new DataView(dir),entries:Entry[]=[],decoder=new TextDecoder();let p=0;
 for(let i=0;i<count;i++){
  if(p+46>dir.byteLength||d.getUint32(p,true)!==0x02014b50)throw Error('The ZIP directory is damaged.');
  const nameLen=d.getUint16(p+28,true),extra=d.getUint16(p+30,true),comment=d.getUint16(p+32,true);if(p+46+nameLen+extra+comment>dir.byteLength)throw Error('The ZIP directory is damaged.');
  const path=decoder.decode(new Uint8Array(dir,p+46,nameLen)).replace(/\\/g,'/');const entry={path,size:d.getUint32(p+24,true),compressed:d.getUint32(p+20,true),offset:d.getUint32(p+42,true),method:d.getUint16(p+10,true),flags:d.getUint16(p+8,true)};
  if(entry.size===0xffffffff||entry.offset===0xffffffff||entry.compressed===0xffffffff)throw Error('ZIP64 entries are not supported.');
  if(path.length<=1000&&!path.startsWith('/')&&!path.split('/').includes('..')&&!path.includes('\0'))entries.push(entry);
  p+=46+nameLen+extra+comment;
 }
 return entries;
}
async function readEntry(file:Blob,entry:Entry){
 const header=await file.slice(entry.offset,entry.offset+30).arrayBuffer();if(header.byteLength!==30)throw Error('ZIP entry is incomplete.');const h=new DataView(header);if(h.getUint32(0,true)!==0x04034b50)throw Error('ZIP entry is damaged.');
 const start=entry.offset+30+h.getUint16(26,true)+h.getUint16(28,true);if(start+entry.compressed>file.size)throw Error('ZIP entry extends past the archive.');
 const bytes=new Uint8Array(await file.slice(start,start+entry.compressed).arrayBuffer());const plain=entry.method===0?bytes:inflateSync(bytes,{out:new Uint8Array(entry.size)});if(plain.byteLength!==entry.size)throw Error('ZIP entry size does not match.');
 return new TextDecoder().decode(plain);
}
async function api(path:string,body:BodyInit,signal:AbortSignal,json=false){
 const r=await fetch(path,{method:'POST',headers:json?{'Content-Type':'application/json'}:undefined,body,signal});const result=await r.json() as {error?:string;id?:string};if(!r.ok)throw Error(result.error||'Project upload failed. Try again.');return result;
}
export async function uploadProject(file:File,progress:(text:string)=>void,signal:AbortSignal):Promise<ProjectAttachment>{
 if(file.size>PROJECT_LIMIT)throw Error('Choose a ZIP file up to 500 MB.');progress('Reading ZIP file list…');const entries=await zipDirectory(file);let id='';
 try{
  const created=await api('/api/projects',JSON.stringify({name:file.name,size:file.size}),signal,true);if(!created.id)throw Error('Project storage did not return an upload ID.');id=created.id;
  for(let part=1,offset=0;offset<file.size;part++,offset+=PART_SIZE){progress('Uploading ZIP · '+Math.floor(offset/file.size*100)+'%');await api('/api/projects/'+id+'/part?number='+part,file.slice(offset,Math.min(file.size,offset+PART_SIZE)),signal);}
  await api('/api/projects/'+id+'/complete','{}',signal,true);
  let total=0,chunk=0,group:{path:string;text:string;truncated?:boolean}[]=[],groupChars=0;
  const flush=async()=>{if(!group.length)return;await api('/api/projects/'+id+'/index',JSON.stringify({number:chunk,files:group}),signal,true);chunk++;group=[];groupChars=0;};
  const code=entries.filter(e=>/\.(?:html?|css|[cm]?js|jsx|ts|tsx|json|md|txt|py|glsl|vert|frag|wgsl|yaml|yml|toml|xml|csv)$/i.test(e.path)&&!/(?:^|\/)(?:node_modules|\.git|__MACOSX)\//.test(e.path)&&!/(?:\.min\.js|\.map)$/i.test(e.path)&&e.size<=2*1024*1024&&e.compressed<=2*1024*1024&&!(e.flags&1)&&[0,8].includes(e.method)).sort((a,b)=>Number(/(?:index|main|app|game|player)\./i.test(b.path))-Number(/(?:index|main|app|game|player)\./i.test(a.path))||a.size-b.size);
  let indexed=0;
  for(const entry of code){
   if(signal.aborted)throw signal.reason;if(total>=12000000||chunk>=79)break;progress('Indexing code · '+(indexed+1)+' / '+code.length);
   let text;try{text=await readEntry(file,entry);}catch{continue;}if(text.includes('\0')||!text.trim())continue;
   const truncated=text.length>Math.min(200000,12000000-total);text=text.slice(0,Math.min(200000,12000000-total));if(!text)break;
   if(groupChars+text.length>200000||group.length>=80)await flush();entry.chunk=chunk;group.push({path:entry.path,text,...(truncated?{truncated:true}:{})});groupChars+=text.length;total+=text.length;indexed++;
  }
  await flush();progress('Saving project file list…');await api('/api/projects/'+id+'/ready',JSON.stringify({files:entries.map(({path,size,chunk})=>({path,size,...(chunk!==undefined?{chunk}:{})}))}),signal,true);
  return {id,name:file.name};
 }catch(error){if(id)await fetch('/api/projects/'+id,{method:'DELETE',signal:AbortSignal.timeout(15000)}).catch(()=>{});throw error;}
}
