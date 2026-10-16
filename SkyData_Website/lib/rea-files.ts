import type {SecretEnv} from './secret-store';
import {archiveDirectory,readEntryBytes,sha256,entryKind} from './project-archive';
// REA file analysis (runner 2.6.0): one file from a saved project — a .NET program, an archive/app bundle or a SQLite database —
// is analysed by REA 6.5.0's static inspections on the paired HP. The website approves exact bytes (SHA-256); the HP downloads
// them in chunks only after local approval and the result is checked against that fingerprint before it can be used.
export const REAF_PREFIX='SKYDATA_REAF_V1\n',REAF_LIMITS={bytes:32*1024*1024,chunkBytes:3*1024*1024};
export type ReafKind='dotnet'|'archive'|'sqlite';
export const REAF_KINDS:Record<ReafKind,{label:string;operations:string[];results:string}>={
 dotnet:{label:'.NET program (PE/CLI assembly)',operations:['inspect-managed-artifact','inspect-managed-native-boundaries','inspect-managed-members'],results:'artifact'},
 archive:{label:'Archive / app bundle (ZIP-based)',operations:['inspect-artifact'],results:'archive'},
 sqlite:{label:'SQLite database',operations:['inspect-sqlite-database'],results:'database'}};
const EXT:[RegExp,ReafKind][]=[[/\.(?:exe|dll|winmd)$/i,'dotnet'],[/\.(?:db|db3|sqlite|sqlite3)$/i,'sqlite'],[/\.(?:zip|jar|war|ear|nupkg|vsix|xpi|crx|aar|apk|ipa|docx|xlsx|pptx|odt|ods|epub|whl|egg)$/i,'archive']];
export const kindForPath=(path:string):ReafKind|null=>EXT.find(([re])=>re.test(path))?.[1]??null;
const startsWith=(b:Uint8Array,s:string,at=0)=>[...s].every((c,i)=>b[at+i]===c.charCodeAt(0));
// The content must look like what its name claims; REA decides the details, this only stops obviously mislabelled input.
export function magicProblem(kind:ReafKind,b:Uint8Array):string|null{
 if(kind==='dotnet')return startsWith(b,'MZ')?null:'Not a Windows PE file (no MZ header).';
 if(kind==='sqlite')return startsWith(b,'SQLite format 3\0')?null:'Not a SQLite 3 database (header missing).';
 return startsWith(b,'PK')?null:'Not a ZIP-based archive (no PK header). tar.gz, 7z and RAR are not supported by REA 6.5.0.';
}
export type ReafFile={project:{id:string;name:string};path:string|null;name:string;kind:ReafKind;bytes:number;sha256:string;data:Uint8Array};
// path === null analyses the project's own ZIP; otherwise one stored member of it.
export async function loadReafFile(env:SecretEnv,owner:string,projectId:unknown,path:unknown):Promise<ReafFile>{
 if(typeof projectId!=='string'||!/^[a-f0-9-]{36}$/.test(projectId)||!env.DB||!env.FILES)throw Error('Choose a saved project.');
 if(path!==null&&(typeof path!=='string'||!path||path.length>1000))throw Error('Choose a file in the project.');
 const project=await env.DB.prepare("SELECT id,name,key FROM projects WHERE id=? AND owner=? AND status='ready'").bind(projectId,owner).first<{id:string;name:string;key:string}>();if(!project)throw Error('Project not found.');
 let data:Uint8Array,name:string,kind:ReafKind|null;
 if(path===null){
  kind='archive';name=project.name;const head=await env.FILES.head(project.key);if(!head)throw Error('The stored project is unavailable.');
  if(head.size>REAF_LIMITS.bytes)throw Error('This project ZIP is '+Math.round(head.size/1048576)+' MB; file analysis accepts up to '+REAF_LIMITS.bytes/1048576+' MB. Choose a file inside it instead.');
  const object=await env.FILES.get(project.key);if(!object)throw Error('The stored project is unavailable.');data=new Uint8Array(await object.arrayBuffer());
 }else{
  const directory=await archiveDirectory(env.FILES,project.id,project.key),matches=directory.entries.filter(e=>e.path===path);
  if(!matches.length)throw Error('That file is not in the stored ZIP.');if(matches.length>1||directory.caseCollisions.includes(path))throw Error('That path is ambiguous in the ZIP (duplicate or case-colliding entries).');
  const e=matches[0];if(e.symlink)throw Error('Symbolic links are not analysed.');const k=entryKind(directory,e);if(['directory','unsafe','duplicate','unsupported'].includes(k))throw Error('That entry cannot be read ('+k+').');
  kind=kindForPath(path);if(!kind)throw Error('Not a supported type. Supported: .exe/.dll (.NET), ZIP-based archives (.zip .jar .nupkg …) and SQLite databases (.db .sqlite).');
  if(e.size>REAF_LIMITS.bytes)throw Error('That file is '+Math.round(e.size/1048576)+' MB; file analysis accepts up to '+REAF_LIMITS.bytes/1048576+' MB.');
  data=await readEntryBytes(env.FILES,project.key,e,REAF_LIMITS.bytes);name=path;
 }
 if(!data.byteLength)throw Error('The file is empty.');
 const problem=magicProblem(kind,data);if(problem)throw Error(problem);
 return {project:{id:project.id,name:project.name},path,name,kind,bytes:data.byteLength,sha256:await sha256(data),data};
}
// The payload the HP receives: identity only, never the bytes.
export function reafPayload(f:ReafFile){
 return REAF_PREFIX+JSON.stringify({kind:f.kind,name:f.name.slice(0,300),project:f.project.name.slice(0,300),projectId:f.project.id,path:f.path,bytes:f.bytes,sha256:f.sha256,chunks:Math.ceil(f.bytes/REAF_LIMITS.chunkBytes)});
}
export const base64=(b:Uint8Array)=>{let s='';for(let i=0;i<b.length;i+=0x8000)s+=String.fromCharCode(...b.subarray(i,i+0x8000));return btoa(s);};
// Re-reads the approved file for one chunk and refuses if it is no longer the approved bytes.
export async function reafChunk(env:SecretEnv,owner:string,payload:string,index:unknown){
 const job=JSON.parse(payload.slice(REAF_PREFIX.length)) as {projectId:string;path:string|null;sha256:string;bytes:number;chunks:number};
 if(!Number.isInteger(index)||(index as number)<0||(index as number)>=job.chunks)throw Error('Invalid chunk.');
 const f=await loadReafFile(env,owner,job.projectId,job.path);if(f.sha256!==job.sha256||f.bytes!==job.bytes)throw Error('The stored file changed after it was approved.');
 const start=(index as number)*REAF_LIMITS.chunkBytes;return {index:index as number,data:base64(f.data.subarray(start,Math.min(f.bytes,start+REAF_LIMITS.chunkBytes)))};
}
// Integrity checks the website applies to a reported file analysis; every one must hold for the result to be usable.
export function reafResultChecks(x:{expected:{kind:ReafKind;sha256:string;bytes:number};adapter:Record<string,any>|null;cleanupConfirmed?:boolean}){
 const a=x.adapter,failed:string[]=[],need=REAF_KINDS[x.expected.kind].results;
 if(!a||a.mode!=='file')failed.push('adapter did not report file mode');
 if(a?.kind!==x.expected.kind)failed.push('file type differs from the approved request');
 if(a?.input?.sha256!==x.expected.sha256||a?.input?.bytes!==x.expected.bytes)failed.push('analysed file differs from the approved file');
 if(a?.rea?.version!=='6.5.0')failed.push('unexpected REA version');
 if(a?.workspaceUnchanged!==true)failed.push('workspace changed or unchecked');
 if(x.cleanupConfirmed!==true)failed.push('container removal not confirmed');
 if(!a?.results||typeof a.results!=='object'||!a.results[need])failed.push('required REA result missing');
 const ops=Array.isArray(a?.rea?.operations)?a.rea.operations.map((o:{operation:string})=>o.operation):[];
 if(!REAF_KINDS[x.expected.kind].operations.every(op=>!a?.results||ops.includes(op)))failed.push('operation list incomplete');
 return failed;
}
export function reafUsable(status:string,analysis:Record<string,unknown>|null){
 if(!analysis||!['complete','partial'].includes(status)||analysis.usable!==true)return false;
 const a=analysis.adapter as Record<string,any>|null,exp=analysis.expected as {kind:ReafKind;sha256:string;bytes:number}|undefined,diag=analysis.diagnostics as {cleanupConfirmed?:boolean}|undefined;
 return !!exp&&reafResultChecks({expected:exp,adapter:a,cleanupConfirmed:diag?.cleanupConfirmed}).length===0;
}
