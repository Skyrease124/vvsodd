import type {SecretEnv} from './secret-store';
import {archiveDirectory,readArchiveDirectory,buildCorrectedZip,entryKind,KIND_LABEL,readOriginalText,safeNewPath,sha256,type ArchiveDirectory} from './project-archive';
// Owner-scoped file browsing, proposals and corrected-ZIP packaging for one saved project.
// The caller (handleProjects) has already matched the project row to the signed-in owner.
export type WorkspaceProject={id:string;owner:string;name:string;key:string;chunks:number;status:string};
export type ProposalFile={path:string;isNew:boolean;originalSha256:string|null;originalSize:number|null;proposedText:string;proposedSha256:string;decision:'pending'|'approved'|'rejected';decidedAt:number|null};
export type ProposalPackage={id:string;created:number;size:number;entries:number;name:string;key:string;approved:{path:string;sha256:string;isNew:boolean}[]};
export type Proposal={version:1;id:string;projectId:string;created:number;updated:number;origin:'engineering'|'manual';taskId:string|null;title:string;files:ProposalFile[];packages:ProposalPackage[]};
export const AI_FILE_LIMIT=20,AI_CHAR_BUDGET=120000;
const MAX_PROPOSALS=25,MAX_PROPOSAL_FILES=20,MAX_PROPOSED_BYTES=1024*1024,MAX_PROPOSAL_BYTES=4*1024*1024,MAX_PACKAGES=3;
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const json=(v:unknown,status=200)=>Response.json(v,{status,headers});
class Rejected extends Error{constructor(message:string,public status=400){super(message);}}
const proposalKey=(projectId:string,id:string)=>'projects/'+projectId+'/proposals/'+id+'.json';
async function readJson(request:Request,max:number){
 if(!request.headers.get('content-type')?.includes('application/json'))throw new Rejected('Send JSON.',415);
 const reader=request.body?.getReader();if(!reader)throw new Rejected('Send JSON.');const chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>max){await reader.cancel();throw new Rejected('Request is too large.',413);}chunks.push(part.value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}
 let body:unknown;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new Rejected('Invalid JSON.');}
 if(!body||typeof body!=='object'||Array.isArray(body))throw new Rejected('Send an object.');return body as Record<string,unknown>;
}
async function manifestIndex(env:SecretEnv,p:WorkspaceProject){const o=await env.FILES!.get('projects/'+p.id+'/manifest.json');if(!o)return new Map<string,number|undefined>();const m=await o.json<{path:string;chunk?:number}[]>();return new Map(m.map(f=>[f.path,f.chunk]));}
async function loadProposal(env:SecretEnv,p:WorkspaceProject,id:string){
 if(!/^[a-f0-9-]{36}$/.test(id))throw new Rejected('Invalid proposal.');const o=await env.FILES!.get(proposalKey(p.id,id));if(!o)throw new Rejected('Proposal not found.',404);
 const proposal=await o.json<Proposal>();if(proposal.projectId!==p.id)throw new Rejected('Proposal not found.',404);return {proposal,etag:o.etag};
}
async function saveProposal(env:SecretEnv,p:WorkspaceProject,proposal:Proposal,etag?:string){
 proposal.updated=Date.now();const saved=await env.FILES!.put(proposalKey(p.id,proposal.id),JSON.stringify(proposal),{httpMetadata:{contentType:'application/json'},...(etag?{onlyIf:{etagMatches:etag}}:{})});
 if(!saved)throw new Rejected('This proposal changed in another tab. Reload it and try again.',409);
}
function summary(proposal:Proposal){return {id:proposal.id,title:proposal.title,origin:proposal.origin,taskId:proposal.taskId,created:proposal.created,updated:proposal.updated,files:proposal.files.map(f=>({path:f.path,isNew:f.isNew,decision:f.decision,proposedSha256:f.proposedSha256})),packages:proposal.packages.map(visiblePackage)};}
// Storage keys stay server-side; downloads go through the owner-checked route.
const visiblePackage=(p:ProposalPackage)=>({id:p.id,created:p.created,size:p.size,entries:p.entries,name:p.name,approved:p.approved});
// Exact complete files chosen for AI context; used by chat/engineering and to report what the model received.
export async function loadSelectedFiles(env:SecretEnv,p:WorkspaceProject,paths:string[]){
 const directory=await archiveDirectory(env.FILES!,p.id,p.key);let budget=AI_CHAR_BUDGET;
 const files:{path:string;status:'full'|'truncated'|'unavailable';sha256?:string;characters:number;totalCharacters:number;reason?:string;text:string}[]=[];
 for(const path of paths.slice(0,AI_FILE_LIMIT)){
  const r=await readOriginalText(env.FILES!,p.key,directory,path);
  if(!r.file){files.push({path,status:'unavailable',characters:0,totalCharacters:0,reason:r.reason,text:''});continue;}
  const text=r.file.text.slice(0,Math.max(0,budget));budget-=text.length;
  files.push({path,status:text.length===r.file.text.length?'full':'truncated',sha256:r.file.sha256,characters:text.length,totalCharacters:r.file.text.length,...(text.length<r.file.text.length?{reason:'Character budget for this request was exhausted.'}:{}),text});
 }
 return files;
}
async function validateProposalFiles(env:SecretEnv,p:WorkspaceProject,directory:ArchiveDirectory,raw:unknown){
 if(!Array.isArray(raw)||!raw.length||raw.length>MAX_PROPOSAL_FILES)throw new Rejected('A proposal needs 1 to '+MAX_PROPOSAL_FILES+' files.');
 const seen=new Set<string>(),files:ProposalFile[]=[];let total=0;const existing=new Set(directory.entries.map(e=>e.path.toLowerCase()));
 for(const item of raw as Record<string,unknown>[]){
  if(!item||typeof item!=='object'||Object.keys(item).some(k=>!['path','text','originalSha256','isNew'].includes(k))||typeof item.path!=='string'||typeof item.text!=='string')throw new Rejected('Each proposed file needs a path and complete text.');
  const path=item.path,text=item.text,bytes=new TextEncoder().encode(text).length;total+=bytes;
  if(seen.has(path.toLowerCase()))throw new Rejected('The proposal lists '+path+' more than once.');seen.add(path.toLowerCase());
  if(bytes>MAX_PROPOSED_BYTES||total>MAX_PROPOSAL_BYTES)throw new Rejected('Proposed files are limited to 1 MB each and 4 MB in total.');
  if(text.includes('\0'))throw new Rejected(path+': proposed text contains a NUL character.');
  if(item.isNew===true){
   if(!safeNewPath(path))throw new Rejected('Invalid path for a new file: '+path);if(existing.has(path.toLowerCase()))throw new Rejected(path+' already exists in the ZIP; propose a replacement instead.');
   files.push({path,isNew:true,originalSha256:null,originalSize:null,proposedText:text,proposedSha256:await sha256(text),decision:'pending',decidedAt:null});continue;
  }
  if(typeof item.originalSha256!=='string'||!/^[a-f0-9]{64}$/.test(item.originalSha256))throw new Rejected(path+': open the complete original first. A replacement needs the fingerprint of the complete original it was written against.');
  const original=await readOriginalText(env.FILES!,p.key,directory,path);
  if(!original.file)throw new Rejected(path+': complete original source is unavailable ('+original.reason+'). A complete replacement cannot be proposed.');
  if(original.file.sha256!==item.originalSha256)throw new Rejected(path+': the replacement was written against a different or incomplete original.',409);
  if(original.file.text===text)throw new Rejected(path+': the proposed text is identical to the original.');
  files.push({path,isNew:false,originalSha256:original.file.sha256,originalSize:original.file.size,proposedText:text,proposedSha256:await sha256(text),decision:'pending',decidedAt:null});
 }
 return files;
}
async function listProposals(env:SecretEnv,p:WorkspaceProject){
 const listed=await env.FILES!.list({prefix:'projects/'+p.id+'/proposals/'});const out:Proposal[]=[];
 for(const o of listed.objects){const body=await env.FILES!.get(o.key);if(body)try{out.push(await body.json<Proposal>());}catch{}}
 return out.sort((a,b)=>b.created-a.created);
}
async function search(env:SecretEnv,p:WorkspaceProject,query:string){
 const q=query.toLowerCase(),matches:{path:string;line:number;preview:string}[]=[];let searched=0,partial=0;
 for(let chunk=0;chunk<p.chunks&&matches.length<200;chunk++){
  const o=await env.FILES!.get('projects/'+p.id+'/code-'+chunk+'.json');if(!o)continue;
  for(const f of await o.json<{path:string;text:string;truncated?:boolean}[]>()){
   searched++;if(f.truncated)partial++;const lines=f.text.split('\n');
   for(let i=0;i<lines.length&&matches.length<200;i++)if(lines[i].toLowerCase().includes(q))matches.push({path:f.path,line:i+1,preview:lines[i].trim().slice(0,200)});
  }
 }
 return {query,matches,searchedFiles:searched,partialFiles:partial,limited:matches.length>=200,note:'Content search covers the code index created at upload ('+searched+' files'+(partial?', '+partial+' only partially':'')+'). Assets, unindexed files and text beyond the index limit are not searched; filename search covers every entry.'};
}
export async function handleProjectWorkspace(request:Request,env:SecretEnv,p:WorkspaceProject,parts:string[]):Promise<Response|null>{
 const action=parts[3],sub=parts[4],subAction=parts[5],url=new URL(request.url),bucket=env.FILES!;
 if(!['files','file','search','proposals'].includes(action))return null;
 try{
  if(p.status!=='ready')throw new Rejected('This project upload is not finished.',409);
  if(action==='files'&&request.method==='GET'){
   const directory=await archiveDirectory(bucket,p.id,p.key),indexed=await manifestIndex(env,p);
   const files=directory.entries.filter(e=>!e.path.endsWith('/')).map(e=>{const kind=entryKind(directory,e);return {path:e.path,size:e.size,kind,label:KIND_LABEL[kind],indexed:indexed.get(e.path)!==undefined,...(e.unsafe?{reason:'Path '+e.unsafe}:{})};});
   return json({project:{id:p.id,name:p.name},archiveBytes:directory.size,totalEntries:directory.entries.length,files,duplicates:directory.duplicates,caseCollisions:directory.caseCollisions,aiFileLimit:AI_FILE_LIMIT,aiCharacterBudget:AI_CHAR_BUDGET});
  }
  if(action==='file'&&request.method==='GET'){
   const path=url.searchParams.get('path')||'';if(!path||path.length>1000)throw new Rejected('Choose a file.');
   const directory=await archiveDirectory(bucket,p.id,p.key),r=await readOriginalText(bucket,p.key,directory,path),entry=directory.entries.find(e=>e.path===path);
   return json({path,size:entry?.size??null,kind:r.kind,label:KIND_LABEL[r.kind],...(r.file?{complete:true,text:r.file.text,sha256:r.file.sha256,lines:r.file.lines,source:'Read in full from the stored original ZIP and CRC-32 verified.'}:{complete:false,reason:r.reason})});
  }
  if(action==='search'&&request.method==='GET'){const q=(url.searchParams.get('q')||'').trim();if(q.length<2||q.length>100)throw new Rejected('Search for 2 to 100 characters.');return json(await search(env,p,q));}
  if(action==='proposals'){
   if(!sub){
    if(request.method==='GET')return json({proposals:(await listProposals(env,p)).map(summary)});
    if(request.method!=='POST')throw new Rejected('Use GET or POST.',405);
    const b=await readJson(request,MAX_PROPOSAL_BYTES+512*1024);
    if(Object.keys(b).some(k=>!['title','origin','taskId','files'].includes(k))||!['engineering','manual'].includes(b.origin as string)||b.taskId!==undefined&&(typeof b.taskId!=='string'||!/^[a-f0-9-]{36}$/.test(b.taskId))||b.title!==undefined&&(typeof b.title!=='string'||b.title.length>200))throw new Rejected('Invalid proposal.');
    if((await bucket.list({prefix:'projects/'+p.id+'/proposals/'})).objects.length>=MAX_PROPOSALS)throw new Rejected('This project has '+MAX_PROPOSALS+' proposals. Delete an older proposal first.',409);
    const directory=await archiveDirectory(bucket,p.id,p.key),files=await validateProposalFiles(env,p,directory,b.files),now=Date.now();
    const proposal:Proposal={version:1,id:crypto.randomUUID(),projectId:p.id,created:now,updated:now,origin:b.origin as Proposal['origin'],taskId:(b.taskId as string)||null,title:(b.title as string)||files.map(f=>f.path).join(', ').slice(0,200),files,packages:[]};
    await saveProposal(env,p,proposal);return json({proposal:summary(proposal)});
   }
   const {proposal,etag}=await loadProposal(env,p,sub);
   if(!subAction&&request.method==='GET'){
    const directory=await archiveDirectory(bucket,p.id,p.key);
    const files=await Promise.all(proposal.files.map(async f=>{if(f.isNew)return {...f,original:null,originalStatus:'new_file'};const r=await readOriginalText(bucket,p.key,directory,f.path);return {...f,original:r.file?.sha256===f.originalSha256?r.file!.text:null,originalStatus:r.file?.sha256===f.originalSha256?'verified':'unavailable'};}));
    return json({proposal:{...summary(proposal),files}});
   }
   if(!subAction&&request.method==='DELETE'){for(const pkg of proposal.packages)await bucket.delete(pkg.key);await bucket.delete(proposalKey(p.id,proposal.id));return json({deleted:true});}
   if(subAction==='decision'&&request.method==='POST'){
    const b=await readJson(request,4096);if(Object.keys(b).some(k=>!['path','decision','proposedSha256'].includes(k))||!['approved','rejected','pending'].includes(b.decision as string))throw new Rejected('Choose approve, reject or reset for one file.');
    const file=proposal.files.find(f=>f.path===b.path);if(!file)throw new Rejected('That file is not in this proposal.',404);
    if(b.proposedSha256!==file.proposedSha256)throw new Rejected('The proposed text you reviewed does not match the stored proposal. Reload it.',409);
    file.decision=b.decision as ProposalFile['decision'];file.decidedAt=file.decision==='pending'?null:Date.now();await saveProposal(env,p,proposal,etag);return json({proposal:summary(proposal)});
   }
   if(subAction==='package'&&request.method==='POST'){
    const b=await readJson(request,1024);if(Object.keys(b).length)throw new Rejected('Packaging takes no options.');
    const approved=proposal.files.filter(f=>f.decision==='approved');if(!approved.length)throw new Rejected('Approve at least one changed file first.');
    const directory=await archiveDirectory(bucket,p.id,p.key);
    for(const f of approved.filter(f=>!f.isNew)){const r=await readOriginalText(bucket,p.key,directory,f.path);if(r.file?.sha256!==f.originalSha256)throw new Rejected(f.path+': the original no longer matches the reviewed version.',409);}
    const id=crypto.randomUUID(),key='projects/'+p.id+'/corrected/'+proposal.id+'-'+id+'.zip';
    const result=await buildCorrectedZip(bucket,p.key,key,new Map(approved.filter(f=>!f.isNew).map(f=>[f.path,f.proposedText])),approved.filter(f=>f.isNew).map(f=>({path:f.path,text:f.proposedText})));
    // Re-read the new archive and confirm every approved file decodes to exactly the approved text.
    try{const check=await readArchiveDirectory(bucket,key);if(check.entries.length!==result.entries)throw Error('entry count');for(const f of approved){const r=await readOriginalText(bucket,key,check,f.path);if(r.file?.sha256!==f.proposedSha256)throw Error(f.path);}}
    catch(e){await bucket.delete(key);throw new Rejected('The corrected ZIP failed verification and was discarded ('+(e instanceof Error?e.message:'unknown')+').',500);}
    const pkg:ProposalPackage={id,created:Date.now(),size:result.size,entries:result.entries,name:p.name.replace(/\.zip$/i,'')+'-corrected.zip',key,approved:approved.map(f=>({path:f.path,sha256:f.proposedSha256,isNew:f.isNew}))};
    proposal.packages.unshift(pkg);for(const old of proposal.packages.splice(MAX_PACKAGES))await bucket.delete(old.key);
    try{await saveProposal(env,p,proposal,etag);}catch(e){await bucket.delete(key);throw e;}
    return json({package:{...visiblePackage(pkg),unchanged:result.unchanged,replaced:result.replaced,added:result.added},proposal:summary(proposal)});
   }
   if(subAction==='download'&&request.method==='GET'){
    const pkg=proposal.packages.find(x=>x.id===url.searchParams.get('package'));if(!pkg)throw new Rejected('Corrected ZIP not found.',404);
    const object=await bucket.get(pkg.key);if(!object)throw new Rejected('Corrected ZIP is unavailable.',404);
    return new Response(object.body,{headers:{...headers,'Content-Type':'application/zip','Content-Disposition':'attachment; filename="'+pkg.name.replace(/[^a-zA-Z0-9._-]/g,'_')+'"'}});
   }
   throw new Rejected('Unsupported proposal action.',405);
  }
  throw new Rejected('Unsupported project action.',405);
 }catch(e){
  if(e instanceof Rejected)return json({error:e.message},e.status);
  console.error('Project workspace failed',{action,kind:e instanceof Error?e.name:'Unknown'});return json({error:e instanceof Error?e.message:'Project request failed.'},400);
 }
}
