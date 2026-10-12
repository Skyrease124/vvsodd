'use client';
import {useEffect,useState} from 'react';
import type {ProjectAttachment} from '../../../lib/project-types';
type Phase={phase:string;command?:string;ms:number;ok:boolean;code?:string;detail?:string};
export type RunnerResult={project?:{name:string;entry:string;paths:string[];sha256:string}|null;status:string;exitCode:number|null;stdout:string;stderr:string;durationMs:number;evidence:string;diagnostics?:{runner:string;executionStatus?:string;cleanupConfirmed?:boolean;totalMs?:number;phases:Phase[]}};
type HistoryFile={path:string;sha256:string;bytes:number;source:string};
export type HistoryRow={id:string;created:number;kind:string;projectName:string|null;proposalId:string|null;entry:string|null;files:HistoryFile[];fingerprint:string;status:string;phase:string|null;claimed:number|null;completed:number|null;result:RunnerResult|null};
export type RunnerDevice={online:boolean;lastSeen:number;ready:boolean;projectReady:boolean;expires:number;runnerVersion:string|null;docker:{ok:boolean;checkedAt:number;detail:string|null}|null};
export type RunnerState={device:RunnerDevice|null;job:{id:string;status:string;created:number;expires:number;phase:string|null;result:RunnerResult|null}|null;history:HistoryRow[]};
const ago=(t:number)=>{const s=Math.max(0,Math.round((Date.now()-t)/1000));return s<90?s+' s ago':s<5400?Math.round(s/60)+' min ago':Math.round(s/3600)+' h ago';};
const STATUS:Record<string,string>={waiting_for_hp:'Waiting for HP to collect',awaiting_local_approval:'Waiting for “yes” on the HP',expired:'Expired (not run)',passed:'Passed',failed:'Failed',timeout:'Timed out (10 s)',declined:'Declined on HP',infrastructure_error:'Infrastructure error',output_limit:'Output limit'};
// Separates what the website knows (polling) from what only the HP can report (Docker health).
export function RunnerStatus({state}:{state:RunnerState|null}){
 const d=state?.device;if(!state)return <p role="status">Checking runner status…</p>;if(!d)return <p role="status">No HP runner paired.</p>;
 return <div className="runner-status" role="status">
  <p><strong>{d.online?'HP runner process is polling':'HP runner offline'}</strong> · last contact {ago(d.lastSeen)} · runner {d.runnerVersion?'v'+d.runnerVersion:'v2 or v2.1 (no version reported)'}{d.projectReady?' · accepts project tests':''}</p>
  <p className="score-note">{d.docker?<>Docker last verified by the HP {ago(d.docker.checkedAt)}: <span className={d.docker.ok?'runner-phase-ok':'runner-phase-bad'}>{d.docker.ok?'responding':'NOT responding'}</span>{d.docker.detail?' ('+d.docker.detail+')':''}. </>:<>This runner version does not report Docker health; it only checked Docker when it started. </>}Polling only proves the runner process is connected, not that Docker is healthy now. Runner v2.2 re-checks Docker after you type yes and before any code starts.</p>
 </div>;
}
function Phases({result}:{result:RunnerResult}){
 const d=result.diagnostics;if(!d)return <p className="score-note">No phase timings (runner older than v2.2). Errors appear in stderr only.</p>;
 return <><p className="score-note">Runner v{d.runner} · code result: <strong>{d.executionStatus}</strong> · cleanup {d.cleanupConfirmed?'confirmed':<strong className="runner-phase-bad">NOT confirmed</strong>}{d.totalMs!==undefined?' · total '+d.totalMs+' ms':''}</p>
  <table className="runner-history"><thead><tr><th>Phase</th><th>Command</th><th>Time</th><th>Outcome</th></tr></thead><tbody>{d.phases.map((p,i)=><tr key={i}><td>{p.phase}</td><td><code>{p.command}</code></td><td>{p.ms} ms</td><td className={p.ok?'runner-phase-ok':'runner-phase-bad'}>{p.ok?'ok':'FAILED '+(p.code||'')}{p.detail?<><br/>{p.detail}</>:null}</td></tr>)}</tbody></table></>;
}
export function RunnerHistory({history}:{history:HistoryRow[]}){
 const [open,setOpen]=useState<string|null>(null);if(!history.length)return null;
 return <section className="engineering-result"><h2>Test history</h2><p className="score-note">Last {history.length} requests. Results are reported by the paired HP and are not independently verified by the server. Fingerprints are SHA-256 of the exact payload and of each file sent.</p>
  <table className="runner-history"><thead><tr><th>When</th><th>What</th><th>Status</th><th>Payload fingerprint</th></tr></thead><tbody>{history.map(h=><tr key={h.id}><td>{new Date(h.created).toLocaleString()}</td><td>{h.kind==='snippet'?'Snippet':(h.kind==='proposal'?'Proposal test':'Project test')+' · '+h.projectName+(h.entry?' · '+h.entry:'')}<br/><button type="button" className="link-button" onClick={()=>setOpen(open===h.id?null:h.id)}>{open===h.id?'Hide details':'Details · '+h.files.length+' file'+(h.files.length===1?'':'s')}</button></td><td>{STATUS[h.status]||h.status}{h.phase?' · '+h.phase:''}</td><td><code>{h.fingerprint.slice(0,16)}…</code></td></tr>)}</tbody></table>
  {history.filter(h=>h.id===open).map(h=><article key={h.id} className="proposal-file"><p>Run <code>{h.id}</code> · payload SHA-256 <code>{h.fingerprint}</code></p>
   <ul>{h.files.map(f=><li key={f.path}><code>{f.path}</code> · {f.bytes} B · {f.source==='approved_proposal'?'approved proposal':f.source==='original'?'original ZIP':f.source==='upload_index'?'upload index':'snippet'} · <code>{f.sha256}</code></li>)}</ul>
   {h.result?<><p>Exit code {String(h.result.exitCode)} · execution {h.result.durationMs} ms · {h.result.evidence}</p><Phases result={h.result}/><pre className="runner-source">{h.result.stdout||'(no stdout)'}</pre><pre className="runner-source">{h.result.stderr||'(no stderr)'}</pre></>:<p>No result reported.</p>}
  </article>)}
 </section>;
}
type Summary={id:string;title:string;files:{path:string;decision:string;isNew:boolean}[]};
type Preview={files:HistoryFile[];analysis:{missingPackages:string[];missingFiles:{from:string;specifier:string}[];note:string};sources:{path:string;text:string}[];entry:string;fingerprint:string};
async function api<T>(url:string,body?:unknown){const r=await fetch(url,{cache:'no-store',...(body!==undefined?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const d=await r.json() as T&{error?:string};if(!r.ok)throw Error(d.error||'Request failed.');return d;}
// Stage 5: an approved proposal (for example an AI-written test) plus chosen originals, reviewed here and again on the HP.
export function ProposalTest({projects,locked,device,onQueued}:{projects:ProjectAttachment[];locked:boolean;device:RunnerDevice|null;onQueued:()=>void}){
 const [projectId,setProjectId]=useState(''),[proposals,setProposals]=useState<Summary[]>([]),[proposalId,setProposalId]=useState(''),[files,setFiles]=useState<{path:string;kind:string}[]>([]),[paths,setPaths]=useState<string[]>([]),[entry,setEntry]=useState(''),[preview,setPreview]=useState<Preview|null>(null),[approved,setApproved]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[filter,setFilter]=useState('');
 useEffect(()=>{const q=new URLSearchParams(location.search);const p=q.get('project'),r=q.get('proposal');if(p&&/^[a-f0-9-]{36}$/.test(p))void choose(p,r||'');
 // eslint-disable-next-line react-hooks/exhaustive-deps -- read the link parameters once
 },[]);
 const reset=()=>{setPreview(null);setApproved(false);};
 async function choose(id:string,proposal=''){setProjectId(id);setProposalId('');setPaths([]);setEntry('');reset();setError('');if(!id)return;try{const [p,f]=await Promise.all([api<{proposals:Summary[]}>('/api/projects/'+id+'/proposals'),api<{files:{path:string;kind:string}[]}>('/api/projects/'+id+'/files')]);setProposals(p.proposals);setFiles(f.files.filter(x=>x.kind==='text'));if(proposal&&p.proposals.some(x=>x.id===proposal))pick(proposal,p.proposals);}catch(e){setError(e instanceof Error?e.message:'Project unavailable.');}}
 function pick(id:string,list=proposals){setProposalId(id);reset();const approvedFiles=list.find(p=>p.id===id)?.files.filter(f=>f.decision==='approved')||[];setPaths(approvedFiles.filter(f=>/\.(?:[cm]?js|json)$/i.test(f.path)).map(f=>f.path));setEntry(approvedFiles.find(f=>/\.(?:test|spec)\.[cm]?js$/i.test(f.path))?.path||'');}
 const proposal=proposals.find(p=>p.id===proposalId),approvedPaths=new Set(proposal?.files.filter(f=>f.decision==='approved').map(f=>f.path)),pendingPaths=new Set(proposal?.files.filter(f=>f.decision!=='approved').map(f=>f.path));
 const candidates=[...new Set([...approvedPaths,...files.map(f=>f.path)])].filter(p=>/\.(?:[cm]?js|json|mjs|cjs)$/i.test(p)&&!pendingPaths.has(p)&&(!filter||p.toLowerCase().includes(filter.toLowerCase()))).slice(0,500);
 async function run(work:()=>Promise<void>){setBusy(true);setError('');try{await work();}catch(e){setError(e instanceof Error?e.message:'Request failed.');}finally{setBusy(false);}}
 const body={projectId,proposalId,paths,entry};
 return <section className="proposal-review"><h2>Test an approved proposal</h2>
  <p className="score-note">Choose an approved test (for example one the AI wrote and you approved in Engineering Mode) and the files it needs. Approved proposal text replaces the original for those paths; every other file is the complete original from your ZIP. Nothing runs until you approve here AND type yes on the HP.</p>
  <label>Saved project<select value={projectId} disabled={locked||busy} onChange={e=>void choose(e.target.value)}><option value="">Choose your ZIP</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
  {projectId&&<label>Proposal<select value={proposalId} disabled={locked||busy} onChange={e=>pick(e.target.value)}><option value="">Choose a proposal with approved files</option>{proposals.filter(p=>p.files.some(f=>f.decision==='approved')).map(p=><option key={p.id} value={p.id}>{p.title} · {p.files.filter(f=>f.decision==='approved').length} approved</option>)}</select></label>}
  {proposal&&<>
   {pendingPaths.size>0&&<p className="score-note">Not approved, so not selectable: {[...pendingPaths].join(', ')}</p>}
   <label>Filter files<input value={filter} onChange={e=>setFilter(e.target.value)}/></label>
   <div className="runner-file-list">{candidates.map(p=><label key={p}><input type="checkbox" checked={paths.includes(p)} disabled={locked||busy} onChange={e=>{setPaths(old=>e.target.checked?[...old,p]:old.filter(x=>x!==p));reset();}}/>{p}{approvedPaths.has(p)?' · approved proposal':''}</label>)}</div>
   <label>JavaScript test entry<select value={entry} disabled={locked||busy} onChange={e=>{setEntry(e.target.value);reset();}}><option value="">Select test file</option>{paths.filter(p=>/\.[cm]?js$/i.test(p)).map(p=><option key={p} value={p}>{p}</option>)}</select></label>
   <div className="engineering-actions"><button type="button" disabled={locked||busy||!entry||!paths.includes(entry)} onClick={()=>void run(async()=>setPreview(await api<Preview>('/api/engineering-runner/proposal-preview',body)))}>Review exact files to send</button></div>
  </>}
  {preview&&<>
   <p>Payload fingerprint <code>{preview.fingerprint}</code> · entry <code>{preview.entry}</code></p>
   <ul>{preview.files.map(f=><li key={f.path}><code>{f.path}</code> · {f.bytes} B · {f.source==='approved_proposal'?'approved proposal':'original ZIP'} · <code>{f.sha256.slice(0,16)}…</code></li>)}</ul>
   <p className={preview.analysis.missingPackages.length||preview.analysis.missingFiles.length?'error':'score-note'}>{preview.analysis.note}{preview.analysis.missingFiles.length?' Unresolved: '+preview.analysis.missingFiles.map(m=>m.from+' → '+m.specifier).join(', '):''}</p>
   <details><summary>Review exact source ({preview.sources.length} files)</summary>{preview.sources.map(f=><section key={f.path}><h3>{f.path}</h3><pre className="runner-source">{f.text}</pre></section>)}</details>
   <label className="engineering-approval"><input type="checkbox" checked={approved} disabled={locked||busy} onChange={e=>setApproved(e.target.checked)}/>I reviewed these exact files and authorize sending them to my HP. The HP will show them again and ask for yes.</label>
   <div className="engineering-actions"><button type="button" disabled={locked||busy||!approved||!device?.online||!device.projectReady} onClick={()=>void run(async()=>{await api('/api/engineering-runner/proposal-test',{...body,approved:true});reset();onQueued();})}>{device?.online?device.projectReady?'Send test to HP':'HP runner too old for project tests':'HP runner offline'}</button></div>
  </>}
  {error&&<p className="error" role="alert">{error}</p>}
 </section>;
}
