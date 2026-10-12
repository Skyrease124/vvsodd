'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import type {BrowserFile} from './project-files';
// REA static investigation: preview → website approval → HP confirmation → REA findings (tool output only).
type Loc={available:boolean;path?:string|null;line?:number;column?:number;reason?:string|null};
type Ev={authority:string|null;state:string|null;confidence:string|null;location:Loc;coverage:string|null};
type List<T>={items:T[];total:number;truncatedByAdapter:boolean};
type Findings={evidenceId:string|null;rootArtifactSha256:string|null;graphCoverage:{status:string;truncated:boolean;omitted_count:number|null;limits:string[]}|null;statistics:Record<string,number>|null;limitations:string[];
 modules:List<{kind:string;label:string;evidence:Ev}>;imports:List<{from:string;to:string;specifier:string|null;linkKind:string|null;resolvedPath:string|null;evidence:Ev}>;endpoints:List<{value:string;mechanism:string|null;evidence:Ev}>;
 endpointCalls?:List<{from:string;endpoint:string;mechanism:string|null;evidence:Ev}>;storage:List<{name:string;storageKind:string|null;mechanism:string|null;evidence:Ev}>;entrypoints:List<{from:{kind:string;label:string};to:{kind:string;label:string};resolution:string|null;evidence:Ev}>;
 unknowns:List<{label:string;path:string|null;limitation:string|null;evidence:Ev}>};
type Phase={phase:string;command?:string;ms:number;ok:boolean;code?:string;detail?:string};
type Analysis={status:string;reaVersion:string|null;evidenceId:string|null;coverage:string|null;stagedMatchesApproval:boolean|null;workspaceUnchanged:boolean|null;evidence:string;diagnostics:{cleanupConfirmed?:boolean;totalMs?:number;phases:Phase[]};stderr?:string;
 adapter:{status:string;rea?:{version:string;operation:string;exitCode:number|null;error:{code:string|null;message:string}|null};staged?:{path:string;sha256:string;bytes:number}[];findings:Findings|null;error?:string}|null};
type Preview={project:{id:string;name:string};operation:string;reaVersion:string;adapterVersion:string;files:{path:string;sha256:string;bytes:number}[];excluded:{path:string;reason:string}[];totalBytes:number;payloadBytes:number;omitted:{packages:string[];relativeFiles:{from:string;specifier:string}[];otherZipEntries:number;note:string};fingerprint:string;limits:{files:number;totalBytes:number;fileBytes:number};error?:string};
type Device={online:boolean;lastSeen:number;runnerVersion:string|null;docker:{ok:boolean;checkedAt:number}|null;rea:{available:boolean;reaVersion:string|null;adapterVersion:string|null;detail:string|null;checkedAt:number|null}|null}|null;
type History={id:string;created:number;kind:string;projectId:string|null;status:string;phase:string|null;fingerprint:string;result:{coverage?:string|null;counts?:Record<string,number|null>}|null};
const ANALYZABLE=/\.(?:[cm]?jsx?|[cm]?tsx?|json|html?)$/i;
const where=(l:Loc)=>!l.available?'location unavailable':(l.path||'?')+(l.line?':'+l.line+(l.column!==undefined?':'+(l.column+1):''):'');
async function api<T>(url:string,body?:unknown){const r=await fetch(url,{cache:'no-store',...(body!==undefined?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const d=await r.json() as T&{error?:string};if(!r.ok)throw Error(d.error||'Request failed.');return d;}
function Table<T>({title,list,cols,note}:{title:string;list?:List<T>;cols:[string,(x:T)=>string][];note?:string}){
 if(!list)return null;
 return <section className="rea-findings"><h4>{title} · {list.total}{list.truncatedByAdapter?' (first '+list.items.length+' shown; adapter limit)':''}</h4>{note&&<p className="score-note">{note}</p>}
  {list.items.length?<div className="rea-table-wrap"><table className="runner-history"><thead><tr>{cols.map(([h])=><th key={h}>{h}</th>)}</tr></thead><tbody>{list.items.map((x,i)=><tr key={i}>{cols.map(([h,f])=><td key={h}>{f(x)}</td>)}</tr>)}</tbody></table></div>:<p className="score-note">None reported by REA (not proof of absence).</p>}
 </section>;
}
export function ReaFindings({analysis}:{analysis:Analysis}){
 const a=analysis.adapter,f=a?.findings;
 return <article className="engineering-result" aria-label="REA findings">
  <h3>REA findings · {analysis.status}</h3>
  <p className="score-note">Tool output from REA {analysis.reaVersion||'?'} <code>{a?.rea?.operation||'analyze-javascript-application'}</code>{f?.evidenceId?<> · evidence <code>{f.evidenceId.slice(0,22)}…</code></>:null}. {analysis.evidence} Static analysis of inert text: it does not show runtime behaviour.</p>
  <p className="score-note">Coverage: <strong>{f?.graphCoverage?.status||analysis.coverage||'unknown'}</strong>{f?.statistics?' · '+f.statistics.parsed_javascript_files+' JavaScript files parsed, '+f.statistics.parse_failures+' parse failures, '+f.statistics.relevant_files+' relevant files':''} · approved files {analysis.stagedMatchesApproval===true?'match the staged files exactly':analysis.stagedMatchesApproval===false?<strong className="runner-phase-bad">DO NOT match the staged files</strong>:'not reported'} · workspace {analysis.workspaceUnchanged===true?'unchanged (nothing executed or written)':analysis.workspaceUnchanged===false?<strong className="runner-phase-bad">CHANGED</strong>:'not checked'} · cleanup {analysis.diagnostics.cleanupConfirmed?'confirmed':<strong className="runner-phase-bad">NOT confirmed</strong>}</p>
  {a?.rea?.error&&<p className="error">REA reported: {a.rea.error.code} — {a.rea.error.message}</p>}{a?.error&&<p className="error">Adapter: {a.error}</p>}
  {f?<>
   <Table title="Routes and network endpoints" list={f.endpoints} cols={[['Value',x=>x.value],['How REA saw it',x=>x.mechanism||''],['Location',x=>where(x.evidence.location)],['Confidence',x=>x.evidence.confidence||'']]}/>
   <Table title="Endpoint call sites" list={f.endpointCalls} note="REA merges identical endpoint values; each call site keeps its own method and location." cols={[['From',x=>x.from],['Endpoint',x=>x.endpoint],['Mechanism',x=>x.mechanism||''],['Location',x=>where(x.evidence.location)]]}/>
   <Table title="Imports" list={f.imports} note="Unresolved targets (no resolved path) are packages or files that were not selected; nothing was installed." cols={[['From',x=>x.from],['Specifier',x=>x.specifier||''],['Kind',x=>x.linkKind||''],['Resolved',x=>x.resolvedPath||'unresolved'],['Location',x=>where(x.evidence.location)]]}/>
   <Table title="Entrypoints and loads" list={f.entrypoints} note="Kinds are REA's own classification (REA may label a package main entry “electron-main” for a plain Node app)." cols={[['From',x=>x.from.kind+' '+x.from.label],['Loads',x=>x.to.kind+' '+x.to.label],['Resolution',x=>x.resolution||''],['Location',x=>where(x.evidence.location)]]}/>
   <Table title="Storage" list={f.storage} cols={[['Name',x=>x.name],['Kind',x=>x.storageKind||''],['Location',x=>where(x.evidence.location)]]}/>
   <Table title="Unknowns (explicitly not analysed)" list={f.unknowns} cols={[['Scope',x=>x.label],['Limitation',x=>x.limitation||''],['Location',x=>where(x.evidence.location)]]}/>
   <Table title="Modules and assets" list={f.modules} cols={[['Kind',x=>x.kind],['Label',x=>x.label],['Location',x=>where(x.evidence.location)]]}/>
   <details><summary>REA limitations ({f.limitations.length})</summary><ul>{f.limitations.map((l,i)=><li key={i}>{l}</li>)}</ul></details>
  </>:<p className="score-note">No findings were returned.</p>}
  <details><summary>Staged files and fingerprints ({a?.staged?.length||0})</summary><ul>{(a?.staged||[]).map(s=><li key={s.path}><code>{s.path}</code> · {s.bytes} B · <code>{s.sha256}</code></li>)}</ul></details>
  <details><summary>Phases and timings</summary><table className="runner-history"><tbody>{analysis.diagnostics.phases.map((p,i)=><tr key={i}><td>{p.phase}</td><td>{p.ms} ms</td><td className={p.ok?'runner-phase-ok':'runner-phase-bad'}>{p.ok?'ok':'FAILED '+(p.code||'')}{p.detail?' — '+p.detail:''}</td></tr>)}</tbody></table></details>
 </article>;
}
export function ReaPanel({projectId,files,onRun}:{projectId:string;files:BrowserFile[];onRun:(id:string|null)=>void}){
 const [device,setDevice]=useState<Device>(null),[expected,setExpected]=useState<{reaVersion:string;adapterVersion:string}|null>(null),[history,setHistory]=useState<History[]>([]),[job,setJob]=useState<{id:string;status:string;phase:string|null}|null>(null);
 const [paths,setPaths]=useState<string[]>([]),[preview,setPreview]=useState<Preview|null>(null),[approved,setApproved]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[runId,setRunId]=useState(''),[analysis,setAnalysis]=useState<Analysis|null>(null),[filter,setFilter]=useState('');
 const candidates=useMemo(()=>files.filter(f=>f.kind==='text'&&ANALYZABLE.test(f.path)),[files]);
 const refresh=useCallback(async()=>{const d=await api<{device:Device;reaExpected:{reaVersion:string;adapterVersion:string};history:History[];job:{id:string;status:string;phase:string|null}|null}>('/api/engineering-runner/status');setDevice(d.device);setExpected(d.reaExpected);setHistory(d.history.filter(h=>h.kind==='rea'&&h.projectId===projectId));setJob(d.job);},[projectId]);
 useEffect(()=>{let live=true;const tick=()=>{if(live)void refresh().catch(e=>setError(e instanceof Error?e.message:'Status unavailable.'));};tick();const t=setInterval(tick,5000);return()=>{live=false;clearInterval(t);};},[refresh]);
 async function run(work:()=>Promise<void>){setBusy(true);setError('');try{await work();}catch(e){setError(e instanceof Error?e.message:'Request failed.');}finally{setBusy(false);}}
 async function open(id:string){setRunId(id);onRun(null);setAnalysis(null);if(!id)return;const d=await api<{status:string;analysis:Analysis|null}>('/api/engineering-runner/rea-run?id='+id);setAnalysis(d.analysis);onRun(d.analysis&&['complete','partial'].includes(d.status)?id:null);}
 const reaReady=!!device?.online&&!!device.rea?.available;
 const running=job&&['pending','running'].includes(job.status)&&history.some(h=>h.id===job.id);
 const shown=candidates.filter(f=>!filter||f.path.toLowerCase().includes(filter.toLowerCase())).slice(0,500);
 const reset=()=>{setPreview(null);setApproved(false);};
 return <section className="proposal-review" aria-label="REA static investigation">
  <h2>REA — static project investigation</h2>
  <p className="score-note">REA {expected?.reaVersion||'6.4.0'} reads the files you approve as text inside an isolated Docker container on your HP and reports modules, imports, routes, endpoints, storage and entrypoints with locations. It never runs your project, installs packages or uses the network. Your selected AI model can then explain the findings; its explanation is labelled as interpretation.</p>
  <div className="runner-status" role="status">
   <p><strong>Requirements:</strong> HP runner v2.3 running · Docker Desktop · the prepared REA image (Prepare_REA.cmd, once).</p>
   <p>{!device?'No HP runner paired.':!device.online?'HP runner offline.':'HP runner v'+(device.runnerVersion||'?')+' connected.'} {device?.online&&(device.rea?(device.rea.available?<span className="runner-phase-ok">REA available: {device.rea.detail}</span>:<span className="runner-phase-bad">REA unavailable: {device.rea.detail}</span>):<span className="runner-phase-bad">This runner does not report REA support (needs v2.3).</span>)}</p>
   {!reaReady&&<p className="score-note">Analysis is unavailable until the HP reports a verified REA {expected?.reaVersion} image with adapter {expected?.adapterVersion}. You can still prepare a preview.</p>}
  </div>
  <label>Filter files<input value={filter} onChange={e=>setFilter(e.target.value)}/></label>
  <div className="engineering-actions"><button type="button" disabled={busy} onClick={()=>{setPaths(candidates.slice(0,200).map(f=>f.path));reset();}}>Select all {Math.min(200,candidates.length)} analyzable files</button><button type="button" disabled={busy||!paths.length} onClick={()=>{setPaths([]);reset();}}>Clear selection</button></div>
  <div className="runner-file-list">{shown.map(f=><label key={f.path}><input type="checkbox" checked={paths.includes(f.path)} disabled={busy} onChange={e=>{setPaths(old=>e.target.checked?[...old,f.path]:old.filter(p=>p!==f.path));reset();}}/>{f.path}</label>)}{!candidates.length&&<p className="score-note">No JavaScript, TypeScript, JSON or HTML text files in this ZIP.</p>}</div>
  <p className="score-note">{paths.length} selected · up to 200 files, 1 MB in total, 512 KB per file.</p>
  <div className="engineering-actions"><button type="button" disabled={busy||!paths.length} onClick={()=>void run(async()=>{setApproved(false);setPreview(await api<Preview>('/api/engineering-runner/rea-preview',{projectId,paths}));})}>Preview exact files for REA</button></div>
  {preview&&<div className="proposal-source">
   <p><strong>{preview.files.length}</strong> files ({(preview.totalBytes/1024).toFixed(1)} KB) will be sent to the HP for <code>{preview.operation}</code> · request fingerprint <code>{preview.fingerprint.slice(0,24)}…</code></p>
   {preview.error&&<p className="error">{preview.error}</p>}
   <details open={preview.files.length<=30}><summary>Files to send</summary><ul>{preview.files.map(f=><li key={f.path}><code>{f.path}</code> · {f.bytes} B · <code>{f.sha256.slice(0,16)}…</code></li>)}</ul></details>
   {preview.excluded.length>0&&<details open><summary>Excluded ({preview.excluded.length})</summary><ul>{preview.excluded.map(x=><li key={x.path}><code>{x.path}</code> — {x.reason}</li>)}</ul></details>}
   <p className="score-note">Not in this analysis: {preview.omitted.otherZipEntries} other ZIP entries.{preview.omitted.packages.length?' Packages referenced but not included (REA will report them unresolved): '+preview.omitted.packages.join(', ')+'.':''}{preview.omitted.relativeFiles.length?' Unselected relative imports: '+preview.omitted.relativeFiles.slice(0,20).map(m=>m.from+' → '+m.specifier).join(', ')+'.':''}</p>
   <label className="engineering-approval"><input type="checkbox" checked={approved} disabled={busy} onChange={e=>setApproved(e.target.checked)}/>I approve sending exactly these files to my HP for REA static analysis. The HP will show the request and ask me to type yes.</label>
   <div className="engineering-actions"><button type="button" disabled={busy||!approved||!reaReady||!preview.files.length||!!preview.error||!!running} onClick={()=>void run(async()=>{await api('/api/engineering-runner/rea-analyze',{projectId,paths,approved:true,fingerprint:preview.fingerprint});reset();await refresh();})}>{!reaReady?'REA unavailable on the HP':running?'An analysis is in progress':'Send to HP for REA analysis'}</button></div>
  </div>}
  {running&&<p role="status">{job!.status==='pending'?'Waiting for the HP runner to collect the request.':job!.phase==='rea_analysis'?'REA is analysing the files on the HP.':job!.phase==='cleanup'?'Removing the analysis container.':job!.phase==='docker_check'?'Approved on the HP · checking Docker.':'Shown on the HP · waiting for you to type yes there.'}</p>}
  {history.length>0&&<label>REA analyses for this project<select value={runId} onChange={e=>void run(()=>open(e.target.value))}><option value="">Choose an analysis</option>{history.map(h=><option key={h.id} value={h.id}>{new Date(h.created).toLocaleString()} · {h.status}{h.result?.counts?' · '+h.result.counts.imports+' imports, '+h.result.counts.endpoints+' endpoints':''}</option>)}</select></label>}
  {error&&<p className="error" role="alert">{error}</p>}
  {analysis&&<ReaFindings analysis={analysis}/>}
 </section>;
}
