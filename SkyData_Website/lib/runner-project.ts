import type {SecretEnv} from './secret-store';
import {safePath,validBundle} from '../runner-package/project.mjs';
import {archiveDirectory,readOriginalText,sha256} from './project-archive';
export type RunnerFile={path:string;text:string};
export async function loadRunnerProject(env:SecretEnv,owner:string,id:string){
 if(!/^[a-f0-9-]{36}$/.test(id)||!env.DB||!env.FILES)throw Error('Select a saved ZIP project.');
 const project=await env.DB.prepare("SELECT name FROM projects WHERE id=? AND owner=? AND status='ready'").bind(id,owner).first<{name:string}>();
 if(!project)throw Error('Project not found.');
 const object=await env.FILES.get('projects/'+id+'/manifest.json');if(!object)throw Error('Project file list unavailable.');
 const manifest=await object.json<{path:string;size:number;chunk?:number}[]>();
 const candidates=manifest.filter(f=>safePath(f.path)&&f.chunk!==undefined&&f.size<=200000).slice(0,100);
 const files:RunnerFile[]=[],skipped:string[]=[];let size=0;const seen=new Set<string>();
 for(const chunk of [...new Set(candidates.map(f=>f.chunk!))]){
 const o=await env.FILES.get('projects/'+id+'/code-'+chunk+'.json');if(!o)continue;
 const data=await o.json<{path:string;text:string;truncated?:boolean}[]>();
 for(const f of data){if(!candidates.some(c=>c.path===f.path)||f.truncated||typeof f.text!=='string'||f.text.includes('\0')||seen.has(f.path.toLowerCase()))continue;
 const bytes=new TextEncoder().encode(f.text).length;if(size+bytes>400000)continue;size+=bytes;seen.add(f.path.toLowerCase());files.push({path:f.path,text:f.text});}
 }
 for(const f of manifest)if(!files.some(x=>x.path===f.path))skipped.push(f.path);
 return {id,name:project.name,files,skipped,totalFiles:manifest.length};
}
export function selectRunnerFiles(project:Awaited<ReturnType<typeof loadRunnerProject>>,paths:unknown,entry:unknown){
 if(!Array.isArray(paths)||!paths.length||paths.length>100||paths.some(p=>typeof p!=='string')||new Set(paths).size!==paths.length)throw Error('Select project files.');
 const files=paths.map(path=>{const f=project.files.find(f=>f.path===path);if(!f)throw Error('Selected file is unavailable or incomplete.');return f;});
 const bundle={name:project.name,files,entry};if(!validBundle(bundle))throw Error('Choose a JavaScript test entry among the selected files.');return bundle;
}
// Proposal tests: complete originals from the stored ZIP, overlaid with files the owner APPROVED in a proposal.
const BUILTINS=new Set('assert,assert/strict,async_hooks,buffer,child_process,cluster,console,constants,crypto,dgram,diagnostics_channel,dns,dns/promises,domain,events,fs,fs/promises,http,http2,https,inspector,module,net,os,path,path/posix,path/win32,perf_hooks,process,punycode,querystring,readline,readline/promises,repl,stream,stream/promises,stream/web,string_decoder,sys,test,timers,timers/promises,tls,trace_events,tty,url,util,util/types,v8,vm,wasi,worker_threads,zlib'.split(','));
export type BundleFile={path:string;sha256:string;bytes:number;source:'original'|'approved_proposal'};
export function analyzeImports(files:{path:string;text:string}[]){
 const have=new Set(files.map(f=>f.path)),missingPackages=new Set<string>(),missingFiles:{from:string;specifier:string}[]=[];
 for(const f of files){if(!/\.[cm]?[jt]sx?$/i.test(f.path))continue;
  const specs=[...f.text.matchAll(/(?:\bimport\s*(?:[\w*{}\s,$]+\s*from\s*)?|\bexport\s*[\w*{}\s,$]*\s*from\s*|\brequire\s*\(\s*|\bimport\s*\(\s*)['"]([^'"\n]+)['"]/g)].map(m=>m[1]);
  for(const spec of new Set(specs)){
   if(spec.startsWith('node:')||BUILTINS.has(spec))continue;
   if(spec.startsWith('./')||spec.startsWith('../')){const base=f.path.split('/').slice(0,-1);for(const part of spec.split('/')){if(part==='..')base.pop();else if(part!=='.')base.push(part);}const target=base.join('/');
    if(![target,target+'.js',target+'.mjs',target+'.cjs',target+'.json',target+'/index.js',target+'/index.mjs'].some(p=>have.has(p)))missingFiles.push({from:f.path,specifier:spec});continue;}
   if(spec.startsWith('/')||/^[a-z]+:/i.test(spec)){missingFiles.push({from:f.path,specifier:spec});continue;}
   missingPackages.add(spec.startsWith('@')?spec.split('/').slice(0,2).join('/'):spec.split('/')[0]);
  }
 }
 return {missingPackages:[...missingPackages].sort(),missingFiles,note:missingPackages.size?'Package installation is unavailable on the HP runner, so imports of '+[...missingPackages].join(', ')+' will fail with ERR_MODULE_NOT_FOUND. Only Node built-ins and the selected files are available.':missingFiles.length?'Some relative imports point to files that are not selected; the test will fail unless you add them.':'All imports resolve to Node built-ins or selected files (static check only; dynamic imports are not analysed).'};
}
export async function loadProposalBundle(env:SecretEnv,owner:string,projectId:unknown,proposalId:unknown,paths:unknown,entry:unknown){
 if(typeof projectId!=='string'||!/^[a-f0-9-]{36}$/.test(projectId)||typeof proposalId!=='string'||!/^[a-f0-9-]{36}$/.test(proposalId)||!env.DB||!env.FILES)throw Error('Choose a saved project and proposal.');
 if(!Array.isArray(paths)||!paths.length||paths.length>100||paths.some(p=>typeof p!=='string')||new Set(paths).size!==paths.length)throw Error('Choose 1 to 100 files.');
 const project=await env.DB.prepare("SELECT * FROM projects WHERE id=? AND owner=? AND status='ready'").bind(projectId,owner).first<{id:string;owner:string;name:string;key:string;chunks:number;status:string}>();if(!project)throw Error('Project not found.');
 const stored=await env.FILES.get('projects/'+projectId+'/proposals/'+proposalId+'.json');if(!stored)throw Error('Proposal not found.');
 const proposal=await stored.json<{projectId:string;files:{path:string;isNew:boolean;decision:string;proposedText:string;proposedSha256:string}[]}>();if(proposal.projectId!==projectId)throw Error('Proposal not found.');
 const directory=await archiveDirectory(env.FILES,projectId,project.key),files:RunnerFile[]=[],meta:BundleFile[]=[];
 for(const path of paths as string[]){
  if(!safePath(path))throw Error(path+' cannot be sent to the runner (unsupported type, dependency folder or credential-like name).');
  const proposed=proposal.files.find(f=>f.path===path);
  if(proposed&&proposed.decision!=='approved')throw Error(path+' has a proposed change that is not approved. Approve or reject it in Engineering Mode first.');
  if(proposed){files.push({path,text:proposed.proposedText});meta.push({path,sha256:await sha256(proposed.proposedText),bytes:new TextEncoder().encode(proposed.proposedText).length,source:'approved_proposal'});continue;}
  const original=await readOriginalText(env.FILES,project.key,directory,path);if(!original.file)throw Error(path+': complete original unavailable ('+original.reason+').');
  files.push({path,text:original.file.text});meta.push({path,sha256:original.file.sha256,bytes:original.file.size,source:'original'});
 }
 const bundle={name:project.name,files,entry};if(!validBundle(bundle))throw Error('Choose a JavaScript test entry among the selected files (100 files / 400 KB maximum).');
 if(!meta.some(m=>m.source==='approved_proposal'))throw Error('Include at least one approved file from this proposal (for example the AI-generated test).');
 return {bundle,meta,analysis:analyzeImports(files)};
}
