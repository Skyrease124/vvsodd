import {readFile,readdir,statfs} from 'node:fs/promises';
// Bounded container resource snapshot for failure reports. Reads only this container's cgroup, /proc and tmpfs sizes.
// cgroup v2 (Docker Desktop/WSL2) and v1 paths are both tried; values that cannot be read are null, never guessed.
const read=async path=>{try{return (await readFile(path,'utf8')).trim().slice(0,400);}catch{return null;}};
const keyed=text=>text===null?null:Object.fromEntries(text.split('\n').map(l=>l.trim().split(/\s+/)).filter(p=>p.length===2).map(([k,v])=>[k,Number.isFinite(Number(v))?Number(v):v]));
const num=text=>text===null?null:text==='max'?'max':Number(text);
async function tasks(){
 let processes=0,threads=0;const names={};
 try{for(const pid of await readdir('/proc')){if(!/^\d+$/.test(pid))continue;processes++;
  try{const n=(await readdir('/proc/'+pid+'/task')).length;threads+=n;const comm=(await read('/proc/'+pid+'/comm'))||'?';names[comm]=(names[comm]||0)+n;}catch{}}}catch{return null;}
 return {processes,threads,threadsByName:Object.fromEntries(Object.entries(names).sort((a,b)=>b[1]-a[1]).slice(0,8))};
}
async function space(path){try{const s=await statfs(path);return {totalMB:Math.round(s.blocks*s.bsize/1048576),freeMB:Math.round(s.bavail*s.bsize/1048576)};}catch{return null;}}
export async function resourceDiagnostics(){
 const v2=await read('/sys/fs/cgroup/pids.max')!==null;
 const p=v2?'/sys/fs/cgroup/':'/sys/fs/cgroup/pids/',m=v2?'/sys/fs/cgroup/':'/sys/fs/cgroup/memory/';
 return {cgroup:v2?'v2':'v1',
  pids:{current:num(await read(p+'pids.current')),max:num(await read(p+'pids.max')),events:keyed(await read(p+'pids.events'))},
  memory:v2?{currentMB:Math.round((num(await read(m+'memory.current'))||0)/1048576),max:num(await read(m+'memory.max')),events:keyed(await read(m+'memory.events'))}
   :{currentMB:Math.round((num(await read(m+'memory.usage_in_bytes'))||0)/1048576),failcnt:num(await read(m+'memory.failcnt'))},
  tasks:await tasks(),shm:await space('/dev/shm'),tmp:await space('/tmp')};
}
