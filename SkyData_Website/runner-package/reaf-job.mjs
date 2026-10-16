// REA file-analysis jobs for the HP runner: one uploaded file (.NET program, archive, SQLite database) analysed by REA 6.5.0's
// static inspections in the same isolated container as JavaScript analysis. The file is downloaded from the website only after
// local approval, checked against the approved SHA-256, and given to the container as raw stdin bytes. Nothing is executed.
import {createHash} from 'node:crypto';
import {executeRea,REA_VERSION,ADAPTER_VERSION} from './rea-job.mjs';
export const REAF_PREFIX='SKYDATA_REAF_V1\n',REAF_PROTOCOL='skydata-rea-file-v2',FRAME='SKYDATA-REA-V2\n';
export const REAF_KINDS={dotnet:{label:'.NET program',operations:['inspect-managed-artifact','inspect-managed-native-boundaries','inspect-managed-members']},archive:{label:'archive / app bundle',operations:['inspect-artifact']},sqlite:{label:'SQLite database',operations:['inspect-sqlite-database']}};
export const REAF_LIMITS={bytes:32*1024*1024,payloadBytes:8192,chunkBytes:3*1024*1024,resultBytes:6*1024*1024,deadlineMs:340000,adapterDeadlineMs:320000,memory:'1024m',tmpfs:'192m',createMs:60000,cleanupMs:30000,graceMs:1000};
const sha=b=>createHash('sha256').update(b).digest('hex');
export function parseReafJob(job){
 if(!job||typeof job.code!=='string'||!job.code.startsWith(REAF_PREFIX)||Buffer.byteLength(job.code)>REAF_LIMITS.payloadBytes||!/^[a-f0-9-]{36}$/.test(job.id)||!Number.isFinite(job.expires)||job.expires<=Date.now())return null;
 let b;try{b=JSON.parse(job.code.slice(REAF_PREFIX.length));}catch{return null;}
 if(!b||typeof b!=='object'||!REAF_KINDS[b.kind]||typeof b.name!=='string'||!b.name||b.name.length>300||typeof b.project!=='string'||b.project.length>300)return null;
 if(!Number.isInteger(b.bytes)||b.bytes<1||b.bytes>REAF_LIMITS.bytes||typeof b.sha256!=='string'||!/^[a-f0-9]{64}$/.test(b.sha256)||!Number.isInteger(b.chunks)||b.chunks!==Math.ceil(b.bytes/REAF_LIMITS.chunkBytes))return null;
 return b;
}
// Pulls the approved file from the website in chunks (each chunk is an authenticated request for this running job only).
export async function downloadReaFile(job,bundle,apiCall,token){
 const parts=[];let total=0;
 for(let index=0;index<bundle.chunks;index++){
  const d=await apiCall('rea-file',{id:job.id,index},token);
  if(!d||d.index!==index||typeof d.data!=='string')throw Error('The website returned an unexpected file chunk.');
  const chunk=Buffer.from(d.data,'base64');total+=chunk.length;if(total>bundle.bytes)throw Error('The website sent more data than the approved file size.');parts.push(chunk);
 }
 const bytes=Buffer.concat(parts);
 if(bytes.length!==bundle.bytes)throw Error('The downloaded file is '+bytes.length+' bytes; the approved file is '+bundle.bytes+'.');
 if(sha(bytes)!==bundle.sha256)throw Error('The downloaded file does not match the approved SHA-256 fingerprint.');
 return bytes;
}
export function frameReaFile(bundle,bytes,deadlineMs=REAF_LIMITS.adapterDeadlineMs){
 return Buffer.concat([Buffer.from(FRAME),Buffer.from(JSON.stringify({protocol:REAF_PROTOCOL,kind:bundle.kind,bytes:bytes.length,sha256:sha(bytes),deadlineMs})+'\n'),bytes]);
}
export async function executeReaFile(bundle,bytes,imageId,{dockerCommand,removeContainer,spawnProcess,report,cleanEnv,limits={}}){
 const merged={...REAF_LIMITS,...limits};
 const r=await executeRea({files:[]},imageId,{dockerCommand,removeContainer,report,cleanEnv,...(spawnProcess?{spawnProcess}:{}),limits:{files:0,totalBytes:0,fileBytes:0,payloadBytes:0,resultBytes:merged.resultBytes,deadlineMs:merged.deadlineMs,createMs:merged.createMs,cleanupMs:merged.cleanupMs,graceMs:merged.graceMs,memory:merged.memory,tmpfs:merged.tmpfs,stdin:frameReaFile(bundle,bytes,merged.adapterDeadlineMs),label:'file analysis: '+bundle.kind}});
 return {...r,diagnostics:{...r.diagnostics,runner:'rea-file/'+ADAPTER_VERSION}};
}
export {REA_VERSION};
