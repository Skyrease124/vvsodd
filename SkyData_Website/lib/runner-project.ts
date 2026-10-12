import type {SecretEnv} from './secret-store';
import {safePath,validBundle} from '../runner-package/project.mjs';
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
