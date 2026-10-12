'use client';
import {useEffect,useMemo,useState} from 'react';
import {diffLines,hunks} from '../../lib/line-diff';
import {proposedBlocks,reviewBlocks,type ReceivedFile} from '../../lib/proposal-blocks';
import type {BrowserFile,OpenedFile} from './project-files';
// Proposals live separately from the stored original. Each changed file needs its own explicit decision.
type FileSummary={path:string;isNew:boolean;decision:'pending'|'approved'|'rejected';proposedSha256:string};
type PackageInfo={id:string;created:number;size:number;entries:number;name:string;approved:{path:string;sha256:string;isNew:boolean}[];unchanged?:number};
type Summary={id:string;title:string;origin:string;taskId:string|null;created:number;files:FileSummary[];packages:PackageInfo[]};
type DetailFile=FileSummary&{original:string|null;originalStatus:'verified'|'unavailable'|'new_file';proposedText:string;originalSha256:string|null};
type Detail=Omit<Summary,'files'>&{files:DetailFile[]};
export type AiProposalSource={taskId:string;content:string;projectFiles:ReceivedFile[]|null};
async function api<T>(url:string,init?:RequestInit){const r=await fetch(url,{cache:'no-store',...init,headers:init?.body?{'Content-Type':'application/json'}:undefined});const d=await r.json() as T&{error?:string};if(!r.ok)throw Error(d.error||'Request failed.');return d;}
const kb=(n:number)=>n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(1)+' MB';
function FileDiff({file}:{file:DetailFile}){
 const [full,setFull]=useState(false);
 const diff=useMemo(()=>diffLines(file.original??'',file.proposedText),[file.original,file.proposedText]);
 if(file.originalStatus==='unavailable')return <p className="error">The verified complete original could not be loaded, so no comparison is shown and this file cannot be packaged.</p>;
 const rows=full?diff.lines.map(line=>({kind:'line' as const,line})):hunks(diff.lines);
 return <div className="diff-view">
  <p className="score-note">{file.isNew?'New file':'Original (left numbers) → proposed (right numbers)'} · +{diff.added} −{diff.removed}{diff.newlineAtEndChanged?' · final newline changed':''}{diff.exact?'':' · too many edits for line alignment; shown as a full replacement'}</p>
  <div className="engineering-actions"><button type="button" onClick={()=>setFull(!full)}>{full?'Show changes only':'Show whole file'}</button></div>
  <pre className="runner-source diff-lines">{rows.map((r,i)=>r.kind==='skip'?<span key={i} className="diff-skip">{'   ⋯ '+r.count+' unchanged lines\n'}</span>:<span key={i} className={'diff-'+r.line.type}>{(r.line.a?String(r.line.a):'').padStart(5)+' '+(r.line.b?String(r.line.b):'').padStart(5)+' '+(r.line.type==='add'?'+':r.line.type==='del'?'−':' ')+' '+r.line.text+'\n'}</span>)}</pre>
 </div>;
}
export function ProposalReview({projectId,files,opened,ai}:{projectId:string;files:BrowserFile[];opened:OpenedFile|null;ai:AiProposalSource|null}){
 const [list,setList]=useState<Summary[]>([]),[detail,setDetail]=useState<Detail|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[note,setNote]=useState(''),[manual,setManual]=useState(''),[manualPath,setManualPath]=useState(''),[newPath,setNewPath]=useState(''),[built,setBuilt]=useState<PackageInfo&{replaced?:string[];added?:string[]}|null>(null);
 const base='/api/projects/'+projectId+'/proposals';
 const existing=useMemo(()=>new Set(files.map(f=>f.path.toLowerCase())),[files]);
 const blocks=useMemo(()=>ai?reviewBlocks(proposedBlocks(ai.content),ai.projectFiles,existing):[],[ai,existing]);
 async function refresh(){const d=await api<{proposals:Summary[]}>(base);setList(d.proposals);}
 useEffect(()=>{let live=true;api<{proposals:Summary[]}>(base).then(d=>{if(live)setList(d.proposals);}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Proposals unavailable.');});return()=>{live=false;};},[base]);
 async function run(work:()=>Promise<void>){setBusy(true);setError('');try{await work();}catch(e){setError(e instanceof Error?e.message:'Request failed.');}finally{setBusy(false);}}
 const openProposal=(id:string)=>run(async()=>{setBuilt(null);setDetail((await api<{proposal:Detail}>(base+'/'+id)).proposal);});
 const create=(body:unknown)=>run(async()=>{const d=await api<{proposal:Summary}>(base,{method:'POST',body:JSON.stringify(body)});await refresh();setNote('Proposal saved separately from your original ZIP. Review and approve each file below.');setDetail((await api<{proposal:Detail}>(base+'/'+d.proposal.id)).proposal);});
 const decide=(f:DetailFile,decision:FileSummary['decision'])=>run(async()=>{await api(base+'/'+detail!.id+'/decision',{method:'POST',body:JSON.stringify({path:f.path,decision,proposedSha256:f.proposedSha256})});setDetail({...detail!,files:detail!.files.map(x=>x.path===f.path?{...x,decision}:x)});await refresh();});
 const build=()=>run(async()=>{const d=await api<{package:PackageInfo&{replaced:string[];added:string[]}}>(base+'/'+detail!.id+'/package',{method:'POST',body:'{}'});setBuilt(d.package);setDetail((await api<{proposal:Detail}>(base+'/'+detail!.id)).proposal);await refresh();});
 const remove=()=>run(async()=>{if(!confirm('Delete this proposal and its corrected ZIPs? Your original upload is not affected.'))return;await api(base+'/'+detail!.id,{method:'DELETE'});setDetail(null);setBuilt(null);await refresh();});
 const eligible=blocks.filter(b=>b.eligible),approved=detail?.files.filter(f=>f.decision==='approved')||[];
 return <section className="proposal-review" aria-label="Proposed changes">
  <h2>Proposed changes</h2>
  <p className="score-note">Proposals are stored separately; your original ZIP is never modified. Nothing here runs code.</p>
  {error&&<p className="error" role="alert">{error}</p>}{note&&<p role="status">{note}</p>}
  {ai&&<div className="proposal-source"><h3>From this AI result</h3>
   {!blocks.length?<p className="score-note">The result contains no complete-file blocks (```language file=path). Select files above, use Development mode and ask for complete replacements, or create a manual proposal.</p>:<>
    <ul>{blocks.map(b=><li key={b.path}><code>{b.path}</code> — {b.eligible?'✓ ':'✗ '}{b.reason}</li>)}</ul>
    <div className="engineering-actions"><button type="button" disabled={busy||!eligible.length} onClick={()=>void create({origin:'engineering',taskId:ai.taskId,title:'AI proposal '+ai.taskId.slice(0,8),files:eligible.map(b=>b.isNew?{path:b.path,text:b.text,isNew:true}:{path:b.path,text:b.text,originalSha256:b.originalSha256})})}>Save {eligible.length} eligible file{eligible.length===1?'':'s'} for review</button></div>
   </>}
  </div>}
  <details className="proposal-source"><summary>Manual proposal (works without AI or the HP)</summary>
   {opened?.complete&&opened.text!==undefined?<>
    <p>Edit a complete replacement for <code>{opened.path}</code> (complete original, SHA-256 {opened.sha256?.slice(0,12)}…).</p>
    <textarea rows={12} value={manualPath===opened.path?manual:opened.text} onChange={e=>{setManualPath(opened.path);setManual(e.target.value);}}/>
    <div className="engineering-actions"><button type="button" disabled={busy||manualPath!==opened.path||manual===opened.text} onClick={()=>void create({origin:'manual',files:[{path:opened.path,text:manual,originalSha256:opened.sha256}]})}>Save replacement for review</button></div>
   </>:<p className="score-note">Open a complete text file in the browser above to propose a replacement.</p>}
   <label>Or add a new file (for example a test)<input value={newPath} placeholder="test/feature.test.mjs" onChange={e=>setNewPath(e.target.value)}/></label>
   {newPath&&<><textarea rows={8} value={manualPath==='new:'+newPath?manual:''} onChange={e=>{setManualPath('new:'+newPath);setManual(e.target.value);}}/><div className="engineering-actions"><button type="button" disabled={busy||manualPath!=='new:'+newPath||!manual} onClick={()=>void create({origin:'manual',files:[{path:newPath,text:manual,isNew:true}]})}>Save new file for review</button></div></>}
  </details>
  {list.length>0&&<label>Saved proposals<select value={detail?.id||''} disabled={busy} onChange={e=>e.target.value?void openProposal(e.target.value):setDetail(null)}><option value="">Choose a proposal</option>{list.map(p=><option key={p.id} value={p.id}>{new Date(p.created).toLocaleString()} · {p.title} · {p.files.filter(f=>f.decision==='approved').length}/{p.files.length} approved</option>)}</select></label>}
  {detail&&<article className="engineering-result">
   <h3>{detail.title}</h3><p className="score-note">{detail.origin==='engineering'?'AI-generated (model advice, not verified)':'Manual'} · created {new Date(detail.created).toLocaleString()}</p>
   {detail.files.map(f=><section key={f.path} className={'proposal-file decision-'+f.decision}>
    <h4><code>{f.path}</code> {f.isNew?'· new file':''} · <span className="decision">{f.decision==='approved'?'Approved':f.decision==='rejected'?'Rejected (original kept)':'Awaiting your decision'}</span></h4>
    <FileDiff file={f}/>
    <div className="engineering-actions">
     <button type="button" disabled={busy||f.decision==='approved'||f.originalStatus==='unavailable'} onClick={()=>void decide(f,'approved')}>Approve this file</button>
     <button type="button" disabled={busy||f.decision==='rejected'} onClick={()=>void decide(f,'rejected')}>Reject this file</button>
     <button type="button" disabled={busy||f.decision==='pending'} onClick={()=>void decide(f,'pending')}>Undo decision</button>
    </div>
   </section>)}
   <p className="score-note">{approved.length} of {detail.files.length} files approved. The corrected ZIP is a new download: approved files replaced or added, every other entry copied byte-for-byte from your original. Pending and rejected files keep the original. The original upload stays as it is.</p>
   <div className="engineering-actions"><button type="button" disabled={busy||!approved.length} onClick={()=>void build()}>{busy?'Working…':'Build corrected ZIP from '+approved.length+' approved file'+(approved.length===1?'':'s')}</button><button type="button" disabled={busy} onClick={()=>void remove()}>Delete proposal</button></div>
   {built&&<p role="status">Corrected ZIP verified: {built.entries} entries, {kb(built.size)}; replaced {built.replaced?.length||0}, added {built.added?.length||0}, unchanged {built.unchanged}. Every approved file was re-read from the new ZIP and matched its approved SHA-256.</p>}
   {detail.packages.length>0&&<ul>{detail.packages.map(p=><li key={p.id}><a href={base+'/'+detail.id+'/download?package='+p.id} download={p.name}>Download {p.name}</a> · {kb(p.size)} · {new Date(p.created).toLocaleString()} · approved: {p.approved.map(a=>a.path).join(', ')}</li>)}</ul>}
   {approved.some(f=>/\.(?:test|spec)\.[cm]?js$/i.test(f.path))&&<p><a href={'/engineering/runner?project='+projectId+'&proposal='+detail.id}>Review and send an approved test to the HP runner</a> (requires the HP and a local “yes”).</p>}
  </article>}
 </section>;
}
