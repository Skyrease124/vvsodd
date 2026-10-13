// SkyData REA adapter 1 — runs INSIDE the isolated skydata-rea image only.
// Accepts exactly one operation (REA 6.4.0 `analyze-javascript-application`) over files supplied on stdin,
// stages them as inert data in tmpfs, and returns only facts REA reported. It never executes the files.
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync,readdirSync,lstatSync,rmSync} from 'node:fs';
import {join,dirname} from 'node:path';
export const ADAPTER_VERSION='1',REA_VERSION='6.4.0',OPERATION='analyze-javascript-application';
export const LIMITS={files:200,totalBytes:2*1024*1024,fileBytes:512*1024,reaStdoutBytes:32*1024*1024,stderrBytes:64*1024,listItems:400,heapMb:384,perSourceMs:60000,deadlineMs:150000,minDeadlineMs:60000,maxDeadlineMs:330000};
// A request may ask for its own overall limit (website investigations on slow PCs); it is clamped, and requests without one keep 150 s.
export const requestDeadline=r=>Number.isInteger(r?.deadlineMs)?Math.min(LIMITS.maxDeadlineMs,Math.max(LIMITS.minDeadlineMs,r.deadlineMs)):LIMITS.deadlineMs;
const REA_CLI='/opt/rea/node_modules/rea-agents/scripts/rea.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
// Same path rules as the website: relative, no traversal, no drive letters, NUL, backslashes or control characters.
export function safeRelPath(p){return typeof p==='string'&&p.length>0&&p.length<=240&&!p.startsWith('/')&&!p.includes('\\')&&!/^[a-zA-Z]:/.test(p)&&!p.endsWith('/')&&p.split('/').every(s=>s&&s!=='.'&&s!=='..'&&!/[\x00-\x1f<>:"|?*]/.test(s));}
export function validRequest(r){
 if(!r||r.protocol!=='skydata-rea-v1'||r.operation!==OPERATION||!Array.isArray(r.files)||!r.files.length||r.files.length>LIMITS.files)return 'Expected 1 to '+LIMITS.files+' files for '+OPERATION+'.';
 const seen=new Set();let total=0;
 for(const f of r.files){
  if(!f||typeof f.text!=='string'||!safeRelPath(f.path))return 'Unsafe or invalid path: '+String(f?.path).slice(0,120);
  if(seen.has(f.path.toLowerCase()))return 'Duplicate path (case-insensitive): '+f.path;seen.add(f.path.toLowerCase());
  const bytes=Buffer.byteLength(f.text);if(bytes>LIMITS.fileBytes)return f.path+' exceeds '+LIMITS.fileBytes+' bytes.';total+=bytes;if(total>LIMITS.totalBytes)return 'Selected files exceed '+LIMITS.totalBytes+' bytes.';
  if(typeof f.sha256!=='string'||sha(f.text)!==f.sha256)return f.path+' does not match its approved SHA-256 fingerprint.';
 }
 return null;
}
function walk(root,rel=''){const out=[];for(const name of readdirSync(join(root,rel))){const p=rel?rel+'/'+name:name,st=lstatSync(join(root,p));if(st.isSymbolicLink())out.push({path:p,symlink:true});else if(st.isDirectory())out.push(...walk(root,p));else out.push({path:p,sha256:sha(readFileSync(join(root,p)))});}return out;}
function run(args,{timeoutMs,maxStdout}){
 return new Promise(resolve=>{const started=Date.now();let out=[],outBytes=0,err='',overflow=false,timedOut=false;
  const child=spawn(process.execPath,[REA_CLI,...args],{cwd:'/tmp',env:{PATH:'/usr/local/bin:/usr/bin:/bin',HOME:'/tmp/rea-home',NODE_ENV:'production',NO_COLOR:'1'},stdio:['ignore','pipe','pipe']});
  const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},timeoutMs);
  child.stdout.on('data',d=>{outBytes+=d.length;if(outBytes>maxStdout){overflow=true;child.kill('SIGKILL');return;}out.push(d);});
  child.stderr.on('data',d=>{if(err.length<LIMITS.stderrBytes)err+=d.toString().slice(0,LIMITS.stderrBytes-err.length);});
  child.on('error',e=>{clearTimeout(timer);resolve({code:null,stdout:'',stderr:String(e.message),ms:Date.now()-started,spawnError:true});});
  child.on('close',code=>{clearTimeout(timer);resolve({code,stdout:Buffer.concat(out).toString('utf8'),stderr:err,ms:Date.now()-started,overflow,timedOut});});
 });
}
const loc=e=>{const v=e?.location;if(!v?.available)return {available:false,reason:v?.reason??null};const l=v.value;return l.kind==='source-range'?{available:true,path:l.source,line:l.start?.line,column:l.start?.column,endLine:l.end?.line}:{available:true,path:l.path??null};};
const ev=e=>({authority:e?.authority??null,state:e?.state??null,confidence:e?.confidence??null,location:loc(e),coverage:e?.coverage?.status??null});
function bounded(list,limit){return {items:list.slice(0,limit),total:list.length,truncatedByAdapter:list.length>limit};}
// Projects REA's own graph records into display lists; nothing is inferred beyond what the records state.
export function extractFindings(doc){
 const nr=doc?.normalized_result,g=nr?.graph;if(!g||!Array.isArray(g.nodes)||!Array.isArray(g.edges))return null;
 const nodes=new Map(g.nodes.map(n=>[n.node_id,n])),label=id=>{const n=nodes.get(id);return n?{kind:n.kind,label:n.observations?.[0]?.label??null}:{kind:'missing',label:null};};
 const obs=n=>n.observations?.[0]||{};
 const modules=g.nodes.filter(n=>['javascript-module','javascript-asset','electron-main','electron-renderer','electron-preload','package','source-map'].includes(n.kind)).map(n=>({id:n.node_id,kind:n.kind,label:obs(n).label,evidence:ev(obs(n).evidence)}));
 const imports=g.edges.filter(e=>e.relation==='imports').map(e=>({from:label(e.source_node_id).label,to:label(e.target_node_id).label,targetKind:label(e.target_node_id).kind,specifier:e.properties?.specifier??null,linkKind:e.properties?.kind??e.properties?.module_link_kind??null,importedName:e.properties?.imported_name??null,resolvedPath:e.properties?.resolved_path??null,evidence:ev(e.evidence)}));
 const endpoints=g.nodes.filter(n=>n.kind==='endpoint').map(n=>({value:obs(n).properties?.value??obs(n).label,endpointKind:obs(n).properties?.endpoint_kind??null,mechanism:obs(n).properties?.mechanism??null,evidence:ev(obs(n).evidence)}));
 // REA merges identical endpoint values into one node; each calling site (and its method) is kept on the `calls` edge.
 const endpointCalls=g.edges.filter(e=>e.relation==='calls'&&nodes.get(e.target_node_id)?.kind==='endpoint').map(e=>({from:label(e.source_node_id).label,endpoint:obs(nodes.get(e.target_node_id)).properties?.value??label(e.target_node_id).label,mechanism:e.properties?.mechanism??null,evidence:ev(e.evidence)}));
 const storage=g.nodes.filter(n=>n.kind==='storage').map(n=>({name:obs(n).properties?.name??obs(n).label,storageKind:obs(n).properties?.storage_kind??null,mechanism:obs(n).properties?.mechanism??null,evidence:ev(obs(n).evidence)}));
 const entrypoints=g.edges.filter(e=>e.relation==='loads').map(e=>({from:label(e.source_node_id),to:label(e.target_node_id),resolution:e.properties?.resolution_context??null,resolvedPath:e.properties?.resolved_path??null,evidence:ev(e.evidence)}));
 const unknowns=g.nodes.filter(n=>n.kind==='unknown').map(n=>({label:obs(n).label,path:obs(n).properties?.path??null,operation:obs(n).properties?.operation??null,limitation:obs(n).properties?.limitation??null,evidence:ev(obs(n).evidence)}));
 const L=LIMITS.listItems;
 return {evidenceId:doc.evidence_id??null,rootArtifactSha256:nr.root_artifact_sha256??null,graphCoverage:g.coverage??null,statistics:nr.statistics??null,limitations:[...new Set([...(g.limitations||[]),...(nr.limitations||[])])].slice(0,60),
  modules:bounded(modules,L),imports:bounded(imports,L),endpoints:bounded(endpoints,L),endpointCalls:bounded(endpointCalls,L),storage:bounded(storage,L),entrypoints:bounded(entrypoints,L),unknowns:bounded(unknowns,L),
  counts:{nodes:g.nodes.length,edges:g.edges.length}};
}
export async function analyze(request,{workRoot='/tmp/skydata-rea'}={}){
 const phases=[],t0=Date.now();
 const invalid=validRequest(request);if(invalid)return {adapter:ADAPTER_VERSION,status:'rejected',error:invalid,phases};
 const root=join(workRoot,'project');rmSync(workRoot,{recursive:true,force:true});mkdirSync(root,{recursive:true});mkdirSync('/tmp/rea-home',{recursive:true});
 const staged=request.files.map(f=>{const target=join(root,f.path);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,f.text,{flag:'wx'});return {path:f.path,sha256:f.sha256,bytes:Buffer.byteLength(f.text)};});
 phases.push({phase:'stage',ms:Date.now()-t0,ok:true,detail:staged.length+' approved files written to tmpfs as data'});
 // Slow PCs: at 0.06 CPU on Linux Docker `rea --version` alone took over 30 s, so requests with their own limit allow it 90 s (ZIP REA keeps 30 s).
 const ver=await run(['--version'],{timeoutMs:Number.isInteger(request.deadlineMs)?90000:30000,maxStdout:1024});const version=ver.stdout.trim();
 phases.push({phase:'rea_version',ms:ver.ms,ok:version===REA_VERSION,...(version===REA_VERSION?{}:{detail:'Expected REA '+REA_VERSION+', found '+(version||'none')+' '+ver.stderr.slice(0,200)})});
 if(version!==REA_VERSION)return {adapter:ADAPTER_VERSION,status:'incompatible',rea:{version:version||null,expected:REA_VERSION},staged,phases};
 const remaining=Math.max(1000,requestDeadline(request)-(Date.now()-t0));
 const r=await run([OPERATION,root,'--artifact-format','directory','--format','json','--max-heap-mb',String(LIMITS.heapMb),'--analysis-timeout-ms',String(LIMITS.perSourceMs)],{timeoutMs:remaining,maxStdout:LIMITS.reaStdoutBytes});
 let doc=null,parseError=null;try{doc=r.stdout?JSON.parse(r.stdout):null;}catch(e){parseError=String(e.message).slice(0,200);}
 const reaError=doc&&doc.error?{code:doc.code??null,category:doc.category??null,message:String(doc.message??doc.error).slice(0,600)}:null;
 const findings=extractFindings(reaError?doc.details?.partial_observation:doc);
 phases.push({phase:'rea_analysis',command:'rea '+OPERATION+' <staged directory>',ms:r.ms,ok:r.code===0&&!r.timedOut&&!r.overflow,code:r.timedOut?'deadline':r.overflow?'output_limit':String(r.code),...(r.code===0?{}:{detail:(reaError?.message||parseError||r.stderr.split('\n').filter(l=>l&&!l.startsWith('{"rea_progress"')).slice(-3).join(' ')).slice(0,600)})});
 // The files are inert data: confirm REA neither changed them nor created anything (e.g. an execution canary).
 const after=walk(root),expected=new Map(staged.map(f=>[f.path,f.sha256]));
 const changed=after.filter(f=>f.symlink||expected.get(f.path)!==f.sha256).map(f=>f.path),missing=staged.filter(f=>!after.some(a=>a.path===f.path)).map(f=>f.path);
 phases.push({phase:'workspace_check',ms:0,ok:!changed.length&&!missing.length,...(changed.length||missing.length?{detail:'Changed or new: '+changed.join(', ')+(missing.length?' · missing: '+missing.join(', '):'')}:{})});
 rmSync(workRoot,{recursive:true,force:true});
 const status=r.timedOut?'timeout':r.overflow?'output_limit':(changed.length||missing.length)?'workspace_changed':reaError?(findings?'partial':'failed'):r.code!==0||!findings?'failed':findings.graphCoverage?.status==='complete'?'complete':'partial';
 return {adapter:ADAPTER_VERSION,status,rea:{version,operation:OPERATION,exitCode:r.code,error:reaError,stdoutSha256:r.stdout?sha(r.stdout):null,stdoutBytes:Buffer.byteLength(r.stdout||'')},staged,workspaceUnchanged:!changed.length&&!missing.length,findings,phases,totalMs:Date.now()-t0};
}
if(process.argv[1]&&import.meta.url==='file://'+process.argv[1]){
 const chunks=[];let size=0;for await(const c of process.stdin){size+=c.length;if(size>4*1024*1024){process.stdout.write(JSON.stringify({adapter:ADAPTER_VERSION,status:'rejected',error:'Request exceeds 4 MB.'}));process.exit(2);}chunks.push(c);}
 let request;try{request=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{process.stdout.write(JSON.stringify({adapter:ADAPTER_VERSION,status:'rejected',error:'Request is not JSON.'}));process.exit(2);}
 const result=await analyze(request);process.stdout.write(JSON.stringify(result));process.exit(result.status==='rejected'?2:0);
}
