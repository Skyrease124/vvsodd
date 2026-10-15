import type {SecretEnv} from './secret-store';
import {archiveDirectory,readOriginalText,sha256} from './project-archive';
import {analyzeImports} from './runner-project';
// Builds the exact file set for one REA static-analysis request from complete originals in the stored ZIP.
// Limits mirror the HP adapter (runner-package/rea/adapter.mjs) so both sides reject the same requests.
export const REA_PREFIX='SKYDATA_REA_V1\n',REA_VERSION='6.5.0',REA_ADAPTER='1',REA_OPERATION='analyze-javascript-application';
// totalBytes stays below D1's ~2 MB value limit for the queued job payload; the HP adapter accepts up to 2 MB.
export const REA_SELECTION_LIMITS={files:200,totalBytes:1024*1024,fileBytes:512*1024,payloadBytes:1800000};
const ANALYZABLE=/\.(?:[cm]?jsx?|[cm]?tsx?|json|html?)$/i;
const RUNTIME_STATE=/(?:^|\/)(?:node_modules|\.git|\.hg|\.svn|\.cache|\.next|\.nuxt|\.vinext|\.wrangler|\.turbo|\.parcel-cache|coverage|__MACOSX|\.idea|\.vscode)(?:\/|$)/i;
const CREDENTIALS=/(?:^|\/)(?:\.env(?:\..*)?|\.npmrc|\.yarnrc(?:\.yml)?|\.netrc|id_[a-z0-9]+|[^/]*\.(?:pem|key|p12|pfx|keystore|jks))$|secret|credential|token|private[ _-]?key|service[ _-]?account/i;
export type ReaFile={path:string;text:string;sha256:string;bytes:number};
export type ReaExclusion={path:string;reason:string};
export function exclusionReason(path:string,entry?:{unsafe?:string;symlink?:true}):string|null{
 if(entry?.unsafe)return 'Unsafe archive path ('+entry.unsafe+')';if(entry?.symlink)return 'Symbolic link (not followed)';
 if(RUNTIME_STATE.test(path))return 'Dependency or runtime-state folder';if(CREDENTIALS.test(path))return 'Looks like a credential or secret file';
 if(!ANALYZABLE.test(path))return 'Not a JavaScript, TypeScript, JSON or HTML source';return null;
}
export async function buildReaSelection(env:SecretEnv,owner:string,projectId:unknown,paths:unknown){
 if(typeof projectId!=='string'||!/^[a-f0-9-]{36}$/.test(projectId)||!env.DB||!env.FILES)throw Error('Choose a saved project.');
 if(!Array.isArray(paths)||!paths.length||paths.length>REA_SELECTION_LIMITS.files||paths.some(p=>typeof p!=='string'||p.length>1000)||new Set(paths).size!==paths.length)throw Error('Choose 1 to '+REA_SELECTION_LIMITS.files+' distinct files.');
 const project=await env.DB.prepare("SELECT id,name,key FROM projects WHERE id=? AND owner=? AND status='ready'").bind(projectId,owner).first<{id:string;name:string;key:string}>();if(!project)throw Error('Project not found.');
 const directory=await archiveDirectory(env.FILES,project.id,project.key),files:ReaFile[]=[],excluded:ReaExclusion[]=[],lower=new Set<string>();let total=0;
 for(const path of paths as string[]){
  const matches=directory.entries.filter(e=>e.path===path);
  if(!matches.length){excluded.push({path,reason:'Not in the stored ZIP'});continue;}
  if(matches.length>1||directory.caseCollisions.includes(path)){excluded.push({path,reason:'Ambiguous: duplicate or case-colliding ZIP entries'});continue;}
  const why=exclusionReason(path,matches[0]);if(why){excluded.push({path,reason:why});continue;}
  if(lower.has(path.toLowerCase())){excluded.push({path,reason:'Duplicate selection'});continue;}
  const original=await readOriginalText(env.FILES,project.key,directory,path);
  if(!original.file){excluded.push({path,reason:original.reason||'Complete text unavailable'});continue;}
  const bytes=new TextEncoder().encode(original.file.text).length;
  if(bytes>REA_SELECTION_LIMITS.fileBytes){excluded.push({path,reason:'Larger than '+REA_SELECTION_LIMITS.fileBytes/1024+' KB'});continue;}
  if(total+bytes>REA_SELECTION_LIMITS.totalBytes){excluded.push({path,reason:'Total selection limit of 1 MB reached'});continue;}
  total+=bytes;lower.add(path.toLowerCase());files.push({path,text:original.file.text,sha256:await sha256(original.file.text),bytes});
 }
 // Static, best-effort view of what the selection does not contain (npm packages and unselected relative files).
 const deps=analyzeImports(files.map(f=>({path:f.path,text:f.text})));
 const notSelected=directory.entries.filter(e=>!e.path.endsWith('/')&&!paths.includes(e.path)).length;
 const bundle={name:project.name,operation:REA_OPERATION,files:files.map(f=>({path:f.path,text:f.text,sha256:f.sha256}))};
 const payload=REA_PREFIX+JSON.stringify(bundle);
 return {project:{id:project.id,name:project.name},files,excluded,totalBytes:total,omitted:{packages:deps.missingPackages,relativeFiles:deps.missingFiles,otherZipEntries:notSelected,note:deps.note},payload,fingerprint:await sha256(payload)};
}
