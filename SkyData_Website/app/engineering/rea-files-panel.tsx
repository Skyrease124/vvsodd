'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import type {BrowserFile} from './project-files';
import {Table} from './rea-panel';
// REA file analysis: pick one file of a saved project (a .NET program, an archive/app bundle or a SQLite database), preview its exact
// SHA-256, approve, confirm on the HP, then read REA's own static findings. Tool output only; nothing is run.
type List<T>={items:T[];total:number;truncatedByAdapter:boolean};
type Phase={phase:string;command?:string;ms:number;ok:boolean;code?:string;detail?:string};
type Meta={evidenceId:string|null;confidence:string|null;authority:string|null;limitations:string[]};
type Op={operation:string;ok:boolean;ms?:number;code?:string;detail?:string;stdoutBytes?:number};
type Results={
 artifact?:Meta&{artifact:{sha256:string;bytes:number;format:string};pe:{architecture:string;optionalHeader:string;sectionCount:number;runtimeVersion:string|null;flags:string[];entryPoint:{kind:string;value:string|null}|null;readyToRun:boolean;hasResources:boolean;strongNameSize:number}|null;classification:{status:string;runtimeFamily:string;implementation:string;managedArchitecture:string}|null;module:{name:string;mvid:string}|null;assembly:{name:string;version:string;culture:string|null;publicKey:{kind:string;token:string|null;bytes:number}|null}|null;targetFrameworks:string[];references:List<{name:string;version:string;culture:string|null}>;resources:List<{name:string|null;size:number|null;visibility:string|null}>;attributes:List<{type:string;count:number}>;coverage:{state?:string}|null};
 boundaries?:Meta&{summary:Record<string,unknown>|null;moduleRefs:List<string>;pinvokes:List<{member:string;library:string;entry:string;charSet:string;callingConvention:string;verification:string}>;nativeImplementations:List<{name:string;codeType:string;kind:string;body:string}>};
 members?:Meta&{counts:Record<string,number>;types:List<{name:string;methods:number;fields:number}>;methods:List<{type:string;name:string;returns:string|null;params:number|null;ilSize:number|null;instructions:number|null}>;externalCalls:List<{type:string;calls:number;members:{name:string;count:number}[]}>;strings:List<string>&{state:string|null};coverage:{state?:string}|null};
 archive?:Meta&{root:{format:string;sha256:string};formats:Record<string,number>;edgeKinds:Record<string,number>;entries:List<{path:string;entryKind:string;format:string;artifactKind:string;size:number|null;compressed:number|null;executable:boolean;encrypted:boolean;hash:string;sha256:string|null}>;integrityContradictions:List<unknown>;hypotheses:List<unknown>;contradictions:List<unknown>;unexploredBranches:List<unknown>;nextProbes:List<unknown>;coverage:{status:string|null};limitations:string[]};
 database?:Meta&{engine:{name:string;version:string}|null;encoding:string|null;wal:unknown;schemaScope:string;schemaCompleteness:string;tables:List<{name:string;kind:string;rootPage:number;withoutRowid:boolean;strict:boolean;columnCount:number;columnsCompleteness:string;columns:{name:string;type:string|null;notNull:boolean;primaryKey:number|null;hidden:number;default:string|null}[]}>;indexes:List<{name:string;table:string;sql:string|null}>;views:List<{name:string;sql:string|null}>;triggers:List<{name:string;table:string;sql:string|null}>};
};
type Analysis={status:string;reportedStatus?:string;usable?:boolean;failedChecks?:string[];fileKind:string;file:{name:string;bytes:number;sha256:string};evidence:string;diagnostics:{cleanupConfirmed?:boolean;totalMs?:number;phases:Phase[]};stderr?:string;adapter:{status:string;error?:string;rea?:{version:string;operations:Op[]};results?:Results;input?:{sha256:string;bytes:number};workspaceUnchanged?:boolean}|null};
type Preview={project:{id:string;name:string};file:{path:string|null;name:string;kind:string;label:string;bytes:number;sha256:string;chunks:number};operations:string[];reaVersion:string;limits:{bytes:number};fingerprint:string};
type Device={online:boolean;runnerVersion:string|null;reaFiles:{available:boolean;detail:string|null}|null}|null;
type History={id:string;created:number;kind:string;projectId:string|null;projectName:string|null;status:string;phase:string|null;files:{path:string}[]};
const EXT=/\.(?:exe|dll|winmd|db|db3|sqlite|sqlite3|zip|jar|war|ear|nupkg|vsix|xpi|crx|aar|apk|ipa|docx|xlsx|pptx|odt|ods|epub|whl|egg)$/i;
async function api<T>(url:string,body?:unknown){const r=await fetch(url,{cache:'no-store',...(body!==undefined?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const d=await r.json() as T&{error?:string};if(!r.ok)throw Error(d.error||'Request failed.');return d;}
const size=(n:number|null)=>n===null||n===undefined?'':n<1024?n+' B':n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(1)+' MB';
const text=(x:unknown)=>typeof x==='string'?x:JSON.stringify(x);
function Facts({rows}:{rows:[string,unknown][]}){return <table className="runner-history"><tbody>{rows.filter(([,v])=>v!==null&&v!==undefined&&v!=='').map(([k,v])=><tr key={k}><th scope="row">{k}</th><td>{typeof v==='object'?JSON.stringify(v):String(v)}</td></tr>)}</tbody></table>;}
function Limits({items}:{items:string[]|undefined}){return items&&items.length?<details><summary>REA limitations ({items.length})</summary><ul>{items.map((l,i)=><li key={i}>{l}</li>)}</ul></details>:null;}
export function ReaFileFindings({analysis}:{analysis:Analysis}){
 const a=analysis.adapter,r=a?.results;
 const download=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(analysis,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='rea-'+analysis.file.name.replace(/[^\w.-]+/g,'_').slice(0,60)+'.json';link.click();URL.revokeObjectURL(url);};
 return <article className="engineering-result" aria-label="REA file findings">
  <h3>REA file findings · {analysis.status}</h3>
  <p className="score-note">Tool output from REA {a?.rea?.version||'?'} for <code>{analysis.file.name}</code> ({size(analysis.file.bytes)}, SHA-256 <code>{analysis.file.sha256.slice(0,16)}…</code>). {analysis.evidence} Static analysis only: the file was never run, loaded or installed, so this shows what is in the file, not what it does at runtime.</p>
  {analysis.failedChecks&&analysis.failedChecks.length>0&&<p className="error" role="alert">Not usable: the HP reported “{analysis.reportedStatus}”, but these integrity checks failed: {analysis.failedChecks.join(', ')}. Shown for diagnosis only.</p>}
  {a?.error&&<p className="error">Adapter: {a.error}</p>}
  <div className="engineering-actions"><button type="button" onClick={download}>Download full findings (JSON)</button></div>
  {a?.rea?.operations&&<p className="score-note">REA operations: {a.rea.operations.map(o=><span key={o.operation} className={o.ok?'runner-phase-ok':'runner-phase-bad'}>{o.operation} {o.ok?'ok':'failed'+(o.code?' ('+o.code+')':'')+(o.detail?': '+o.detail:'')}; </span>)}</p>}
  {r?.artifact&&<section className="rea-findings"><h4>Assembly</h4><Facts rows={[['Name',r.artifact.assembly?.name],['Version',r.artifact.assembly?.version],['Culture',r.artifact.assembly?.culture],['Strong name',r.artifact.assembly?.publicKey?r.artifact.assembly.publicKey.kind+(r.artifact.assembly.publicKey.token?' · token '+r.artifact.assembly.publicKey.token:''):null],['Target framework',r.artifact.targetFrameworks.join(', ')],['Runtime family',r.artifact.classification?.runtimeFamily],['Implementation',r.artifact.classification?.implementation],['Managed architecture',r.artifact.classification?.managedArchitecture],['Machine',r.artifact.pe?.architecture+' · '+r.artifact.pe?.optionalHeader],['CLI flags',r.artifact.pe?.flags.join(', ')],['Entry point',r.artifact.pe?.entryPoint?r.artifact.pe.entryPoint.kind+(r.artifact.pe.entryPoint.value?' '+r.artifact.pe.entryPoint.value:''):null],['Ready-to-run (precompiled native code)',r.artifact.pe?.readyToRun],['Module MVID',r.artifact.module?.mvid],['Evidence',r.artifact.evidenceId]]}/>
   <Table title="Referenced assemblies" list={r.artifact.references} cols={[['Name',x=>x.name],['Version',x=>x.version]]}/>
   <Table title="Embedded resources" list={r.artifact.resources} cols={[['Name',x=>x.name||''],['Size',x=>size(x.size)]]}/>
   <Table title="Custom attributes (by type)" list={r.artifact.attributes} cols={[['Attribute type',x=>x.type],['Uses',x=>String(x.count)]]}/><Limits items={r.artifact.limitations}/></section>}
  {r?.boundaries&&<section className="rea-findings"><h4>Native boundaries</h4><Facts rows={Object.entries(r.boundaries.summary||{})}/>
   <Table title="P/Invoke imports (managed code calling native libraries)" list={r.boundaries.pinvokes} cols={[['Managed member',x=>x.member],['Library',x=>x.library],['Entry point',x=>x.entry],['Char set',x=>x.charSet],['Convention',x=>x.callingConvention]]}/>
   <Table title="Native implementations" list={r.boundaries.nativeImplementations} cols={[['Method',x=>x.name],['Code type',x=>x.codeType],['Kind',x=>x.kind]]}/></section>}
  {r?.members&&<section className="rea-findings"><h4>Members</h4><Facts rows={Object.entries(r.members.counts)}/>
   <Table title="Types" list={r.members.types} cols={[['Type',x=>x.name],['Methods',x=>String(x.methods)],['Fields',x=>String(x.fields)]]}/>
   <Table title="Largest method bodies" note="Sorted by IL size. Method bodies are not decompiled to C#; REA reports signatures and IL facts." list={r.members.methods} cols={[['Type',x=>x.type],['Method',x=>x.name],['Returns',x=>x.returns||''],['Params',x=>String(x.params??'')],['IL bytes',x=>String(x.ilSize??'')],['Instructions',x=>String(x.instructions??'')]]}/>
   <Table title="Calls into other assemblies" note="Grouped by the declaring type of the called member; counts are call sites." list={r.members.externalCalls} cols={[['Type',x=>x.type],['Call sites',x=>String(x.calls)],['Members called',x=>x.members.map(m=>m.name+(m.count>1?'×'+m.count:'')).join(', ')]]}/>
   <Table title={'String literals'+(r.members.strings.state?' · '+r.members.strings.state:'')} list={r.members.strings} cols={[['Value',x=>x]]}/><Limits items={r.members.limitations}/></section>}
  {r?.archive&&<section className="rea-findings"><h4>Archive contents</h4><Facts rows={[['Root format',r.archive.root.format],['Formats found',Object.entries(r.archive.formats).map(([k,v])=>k+' ×'+v).join(', ')],['Relations',Object.entries(r.archive.edgeKinds).map(([k,v])=>k+' ×'+v).join(', ')],['Coverage',r.archive.coverage?.status],['Evidence',r.archive.evidenceId]]}/>
   <Table title="Entries" list={r.archive.entries} cols={[['Path',x=>x.path],['Format',x=>x.format],['Kind',x=>x.entryKind+(x.executable?' · executable':'')+(x.encrypted?' · encrypted':'')],['Size',x=>size(x.size)],['Hash',x=>x.hash+(x.sha256?' '+x.sha256.slice(0,12)+'…':'')]]}/>
   {([['Integrity contradictions',r.archive.integrityContradictions],['Hypotheses (REA’s, unverified)',r.archive.hypotheses],['Next probes REA suggests',r.archive.nextProbes],['Unexplored branches',r.archive.unexploredBranches]] as [string,List<unknown>][]).map(([t,l])=><Table key={t} title={t} list={l} cols={[['Detail',x=>text(x)]]}/>)}<Limits items={r.archive.limitations}/></section>}
  {r?.database&&<section className="rea-findings"><h4>Database schema</h4><Facts rows={[['Engine',r.database.engine?r.database.engine.name+' '+r.database.engine.version:null],['Text encoding',r.database.encoding],['Schema',r.database.schemaScope+' · '+r.database.schemaCompleteness],['Write-ahead log',r.database.wal],['Evidence',r.database.evidenceId]]}/>
   <Table title="Tables" note="Schema only. Row contents are not read or sent." list={r.database.tables} cols={[['Table',x=>x.name],['Kind',x=>x.kind+(x.strict?' · strict':'')+(x.withoutRowid?' · without rowid':'')],['Columns',x=>x.columns.map(c=>c.name+(c.type?' '+c.type:'')+(c.primaryKey?' PK':'')+(c.notNull?' NOT NULL':'')).join(', ')||String(x.columnCount)]]}/>
   <Table title="Indexes" list={r.database.indexes} cols={[['Index',x=>x.name],['Table',x=>x.table],['Definition',x=>x.sql||'']]}/>
   <Table title="Views" list={r.database.views} cols={[['View',x=>x.name],['Definition',x=>x.sql||'']]}/>
   <Table title="Triggers (not executed)" list={r.database.triggers} cols={[['Trigger',x=>x.name],['Table',x=>x.table],['Definition',x=>x.sql||'']]}/><Limits items={r.database.limitations}/></section>}
  <details><summary>Phases and timings</summary><table className="runner-history"><tbody>{analysis.diagnostics.phases.map((p,i)=><tr key={i}><td>{p.phase}</td><td>{p.ms} ms</td><td className={p.ok?'runner-phase-ok':'runner-phase-bad'}>{p.ok?'ok':'FAILED '+(p.code||'')}{p.detail?' — '+p.detail:''}</td></tr>)}</tbody></table></details>
 </article>;
}
export function ReaFilesPanel({projectId,files}:{projectId:string;files:BrowserFile[]}){
 const [device,setDevice]=useState<Device>(null),[history,setHistory]=useState<History[]>([]),[job,setJob]=useState<{id:string;status:string;phase:string|null}|null>(null);
 const [path,setPath]=useState<string>(''),[preview,setPreview]=useState<Preview|null>(null),[approved,setApproved]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[runId,setRunId]=useState(''),[analysis,setAnalysis]=useState<Analysis|null>(null);
 const candidates=useMemo(()=>files.filter(f=>EXT.test(f.path)&&f.kind!=='directory'&&f.kind!=='unsafe'&&f.kind!=='duplicate'&&f.kind!=='unsupported'),[files]);
 const refresh=useCallback(async()=>{const d=await api<{device:Device;history:History[];job:{id:string;status:string;phase:string|null}|null}>('/api/engineering-runner/status');setDevice(d.device);setHistory(d.history.filter(h=>h.kind==='reafile'&&h.projectId===projectId));setJob(d.job);},[projectId]);
 useEffect(()=>{let live=true;const tick=()=>{if(live)void refresh().catch(e=>setError(e instanceof Error?e.message:'Status unavailable.'));};tick();const t=setInterval(tick,5000);return()=>{live=false;clearInterval(t);};},[refresh]);
 async function run(work:()=>Promise<void>){setBusy(true);setError('');try{await work();}catch(e){setError(e instanceof Error?e.message:'Request failed.');}finally{setBusy(false);}}
 async function open(id:string){setRunId(id);setAnalysis(null);if(!id)return;const d=await api<{analysis:Analysis|null}>('/api/engineering-runner/rea-run?id='+id);setAnalysis(d.analysis);}
 const ready=!!device?.online&&!!device.reaFiles?.available;
 const running=job&&['pending','running'].includes(job.status)&&history.some(h=>h.id===job.id);
 const target=path==='\0zip'?null:path;
 const reset=()=>{setPreview(null);setApproved(false);};
 return <section className="proposal-review" aria-label="REA file analysis">
  <h2>REA — file analysis (.NET, archives, SQLite)</h2>
  <p className="score-note">REA {preview?.reaVersion||'6.5.0'} inspects one file with its static tools inside an isolated Docker container on your HP (no network; the file is never run). .NET programs: assembly identity, references, types, methods, calls into other assemblies, string literals and native (P/Invoke) boundaries. Archives and app bundles: every entry with its format, size and integrity. SQLite: the full schema (no row contents). Up to 32 MB. Upload a .dll/.exe/.db/.zip directly with “Upload ZIP” above; it is stored in a ZIP wrapper.</p>
  <div className="runner-status" role="status">
   <p><strong>Requirements:</strong> HP runner v2.6 · Docker Desktop · Prepare_REA.cmd run once for runner 2.6.</p>
   <p>{!device?'No HP runner paired.':!device.online?'HP runner offline.':'HP runner v'+(device.runnerVersion||'?')+' connected.'} {device?.online&&(device.reaFiles?(device.reaFiles.available?<span className="runner-phase-ok">File analysis available.</span>:<span className="runner-phase-bad">File analysis unavailable: {device.reaFiles.detail}</span>):<span className="runner-phase-bad">This runner does not report file analysis (needs v2.6).</span>)}</p>
  </div>
  <label>File to analyse<select value={path} disabled={busy} onChange={e=>{setPath(e.target.value);reset();}}><option value="">Choose a file</option><option value={'\0zip'}>The whole project ZIP as an archive</option>{candidates.map(f=><option key={f.path} value={f.path}>{f.path} ({size(f.size)})</option>)}</select></label>
  {!candidates.length&&<p className="score-note">No .exe, .dll, database or archive files were found in this project.</p>}
  <div className="engineering-actions"><button type="button" disabled={busy||!path} onClick={()=>void run(async()=>{setApproved(false);setPreview(await api<Preview>('/api/engineering-runner/rea-file-preview',{projectId,path:target}));})}>Preview exact file for REA</button></div>
  {preview&&<div className="proposal-source">
   <p><strong>{preview.file.name}</strong> · {preview.file.label} · {size(preview.file.bytes)} · SHA-256 <code>{preview.file.sha256}</code></p>
   <p className="score-note">REA operations: {preview.operations.join(', ')}. The HP receives only this identity; it downloads the file after you type yes there and refuses it if the SHA-256 differs. Request fingerprint <code>{preview.fingerprint.slice(0,24)}…</code></p>
   <label className="engineering-approval"><input type="checkbox" checked={approved} disabled={busy} onChange={e=>setApproved(e.target.checked)}/>I approve sending exactly this file to my HP for REA static analysis. The HP will ask me to type yes.</label>
   <div className="engineering-actions"><button type="button" disabled={busy||!approved||!ready||!!running} onClick={()=>void run(async()=>{await api('/api/engineering-runner/rea-file-analyze',{projectId,path:target,approved:true,fingerprint:preview.fingerprint});reset();await refresh();})}>{!ready?'File analysis unavailable on the HP':running?'An analysis is in progress':'Send to HP for REA analysis'}</button></div>
  </div>}
  {running&&<p role="status">{job!.status==='pending'?'Waiting for the HP runner to collect the request.':job!.phase==='rea_analysis'?'REA is analysing the file on the HP (large files can take a few minutes).':job!.phase==='cleanup'?'Removing the analysis container.':job!.phase==='docker_check'?'Approved on the HP · downloading and checking.':'Shown on the HP · waiting for you to type yes there.'}</p>}
  {history.length>0&&<label>File analyses for this project<select value={runId} onChange={e=>void run(()=>open(e.target.value))}><option value="">Choose an analysis</option>{history.map(h=><option key={h.id} value={h.id}>{new Date(h.created).toLocaleString()} · {h.files[0]?.path||'file'} · {h.status}</option>)}</select></label>}
  {error&&<p className="error" role="alert">{error}</p>}
  {analysis&&<ReaFileFindings analysis={analysis}/>}
 </section>;
}
