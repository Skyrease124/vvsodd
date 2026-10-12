'use client';
import {useEffect,useMemo,useState} from 'react';
// Browses one saved ZIP. Source is read in full from the stored original on the server; nothing runs.
export type BrowserFile={path:string;size:number;kind:string;label:string;indexed:boolean;reason?:string};
export type OpenedFile={path:string;size:number|null;kind:string;label:string;complete:boolean;text?:string;sha256?:string;lines?:number;reason?:string;source?:string};
type Listing={project:{id:string;name:string};totalEntries:number;files:BrowserFile[];duplicates:string[];caseCollisions:string[];aiFileLimit:number;aiCharacterBudget:number};
type Search={matches:{path:string;line:number;preview:string}[];note:string;limited:boolean};
const SELECTABLE=new Set(['text','unknown']),SHOWN_LINES=4000;
const size=(n:number)=>n<1024?n+' B':n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(1)+' MB';
async function getJson<T>(url:string){const r=await fetch(url,{cache:'no-store'});const d=await r.json() as T&{error?:string};if(!r.ok)throw Error(d.error||'Request failed.');return d;}
export function ProjectFiles({projectId,selected,onSelectedChange,disabled,onOpened,onFiles}:{projectId:string;selected:string[];onSelectedChange:(paths:string[])=>void;disabled?:boolean;onOpened?:(file:OpenedFile|null)=>void;onFiles?:(files:BrowserFile[])=>void}){
 const [listing,setListing]=useState<Listing|null>(null),[filter,setFilter]=useState(''),[kind,setKind]=useState('all'),[error,setError]=useState(''),[loading,setLoading]=useState(true),[opened,setOpened]=useState<OpenedFile|null>(null),[search,setSearch]=useState<Search|null>(null),[showAll,setShowAll]=useState(false);
 // The parent remounts this component per project (key={projectId}), so state starts fresh.
 useEffect(()=>{let live=true;
  getJson<Listing>('/api/projects/'+projectId+'/files').then(d=>{if(live){setListing(d);onFiles?.(d.files);}}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Files unavailable.');}).finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;};
 // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the project changes
 },[projectId]);
 const shown=useMemo(()=>{const q=filter.trim().toLowerCase();return (listing?.files||[]).filter(f=>(kind==='all'||(kind==='text'?SELECTABLE.has(f.kind):!SELECTABLE.has(f.kind)))&&(!q||f.path.toLowerCase().includes(q))).slice(0,2000);},[listing,filter,kind]);
 async function open(path:string){setError('');setShowAll(false);try{const d=await getJson<OpenedFile>('/api/projects/'+projectId+'/file?path='+encodeURIComponent(path));setOpened(d);onOpened?.(d);}catch(e){setError(e instanceof Error?e.message:'File unavailable.');}}
 async function searchContents(){const q=filter.trim();if(q.length<2)return setError('Type at least 2 characters to search file contents.');setError('');try{setSearch(await getJson<Search>('/api/projects/'+projectId+'/search?q='+encodeURIComponent(q)));}catch(e){setError(e instanceof Error?e.message:'Search failed.');}}
 function toggle(path:string,on:boolean){if(on&&selected.length>=(listing?.aiFileLimit||20))return setError('The AI can read up to '+(listing?.aiFileLimit||20)+' selected files per request.');onSelectedChange(on?[...selected,path]:selected.filter(p=>p!==path));}
 const lines=opened?.text!==undefined?opened.text.split('\n'):[],visible=showAll?lines:lines.slice(0,SHOWN_LINES),gutter=String(lines.length).length;
 return <section className="project-files" aria-label="Project files">
  <h2>Project files</h2>
  {loading&&<p role="status">Reading the stored ZIP directory…</p>}
  {error&&<p className="error" role="alert">{error}</p>}
  {listing&&<>
   <p className="score-note">{listing.files.length} files in {listing.project.name} ({listing.totalEntries} ZIP entries). Opening a file reads it in full from your stored original ZIP and checks its CRC-32; nothing is executed or changed.</p>
   {listing.duplicates.length>0&&<p className="error">Duplicate paths in this ZIP (unavailable, ambiguous): {listing.duplicates.join(', ')}</p>}
   {listing.caseCollisions.length>0&&<p className="score-note">Paths that differ only by capitalisation (collide on Windows): {listing.caseCollisions.join(', ')}</p>}
   <div className="project-files-tools">
    <label>Find files<input type="search" value={filter} placeholder="Filename or text…" onChange={e=>{setFilter(e.target.value);setSearch(null);}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void searchContents();}}}/></label>
    <label>Show<select value={kind} onChange={e=>setKind(e.target.value)}><option value="all">All files</option><option value="text">Text source</option><option value="other">Assets and unavailable</option></select></label>
    <div className="engineering-actions"><button type="button" onClick={()=>void searchContents()} disabled={filter.trim().length<2}>Search file contents</button></div>
   </div>
   {search&&<div className="project-search"><p className="score-note">{search.matches.length}{search.limited?'+':''} matches. {search.note}</p><ul>{search.matches.map((m,i)=><li key={i}><button type="button" className="link-button" onClick={()=>void open(m.path)}>{m.path}:{m.line}</button> <code>{m.preview}</code></li>)}</ul></div>}
   <p className="score-note" role="status">AI will read <strong>{selected.length}</strong> of up to {listing.aiFileLimit} selected files, read in full from the original ZIP (shared budget {listing.aiCharacterBudget.toLocaleString()} characters; anything over is sent and labelled TRUNCATED). Unselected files are sent to the AI by name only.{selected.length>0&&<> <button type="button" className="link-button" disabled={disabled} onClick={()=>onSelectedChange([])}>Clear selection</button></>}</p>
   <div className="project-file-table" role="list">
    {shown.map(f=><div role="listitem" key={f.path} className={'project-file-row'+(opened?.path===f.path?' active':'')}>
     <input type="checkbox" aria-label={'AI reads '+f.path} title={SELECTABLE.has(f.kind)?'Let the AI read this complete file':'Not selectable: '+f.label} checked={selected.includes(f.path)} disabled={disabled||!SELECTABLE.has(f.kind)} onChange={e=>toggle(f.path,e.target.checked)}/>
     <button type="button" className="link-button" onClick={()=>void open(f.path)}>{f.path}</button>
     <span className="file-meta">{size(f.size)} · <span className={'kind kind-'+f.kind}>{f.label}</span>{f.indexed?'':' · not in upload index'}{f.reason?' · '+f.reason:''}</span>
    </div>)}
    {shown.length===2000&&<p className="score-note">Showing the first 2000 matches. Narrow the filter.</p>}
   </div>
  </>}
  {opened&&<article className="project-viewer">
   <h3>{opened.path}</h3>
   <p className="score-note">{opened.label}{opened.size!==null?' · '+size(opened.size):''}{opened.complete?<> · {opened.lines} lines · complete source · SHA-256 <code>{opened.sha256}</code></>:<> · <strong>Not displayed:</strong> {opened.reason}</>}</p>
   {opened.complete&&<>
    {opened.source&&<p className="score-note">{opened.source}</p>}
    <pre className="runner-source code-view">{visible.map((l,i)=>String(i+1).padStart(gutter,' ')+'  '+l).join('\n')}</pre>
    {lines.length>SHOWN_LINES&&!showAll&&<div className="engineering-actions"><button type="button" onClick={()=>setShowAll(true)}>Show all {lines.length} lines (display only; the file is already complete)</button></div>}
    {SELECTABLE.has(opened.kind)&&<label className="engineering-approval"><input type="checkbox" checked={selected.includes(opened.path)} disabled={disabled} onChange={e=>toggle(opened.path,e.target.checked)}/>Let the AI read this file</label>}
   </>}
  </article>}
 </section>;
}
