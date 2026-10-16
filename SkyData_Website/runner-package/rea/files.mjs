// SkyData REA file mode (adapter 1, file framing "v2") — runs INSIDE the isolated skydata-rea image only.
// One uploaded file arrives on stdin as raw bytes after a JSON header; it is staged as inert data under a fixed name and only
// REA's static inspections run on it (.NET assemblies, ZIP-based archives, SQLite databases). Nothing is executed or loaded.
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync,readdirSync,lstatSync,rmSync} from 'node:fs';
import {join} from 'node:path';
export const FILE_FRAME='SKYDATA-REA-V2\n',FILE_PROTOCOL='skydata-rea-file-v2',REA_VERSION='6.5.0';
export const KINDS={dotnet:{name:'input.dll',label:'.NET program'},archive:{name:'input.zip',label:'archive'},sqlite:{name:'input.db',label:'SQLite database'}};
export const FILE_LIMITS={bytes:32*1024*1024,stdinBytes:33*1024*1024,reaStdoutBytes:48*1024*1024,stderrBytes:64*1024,heapMb:384,deadlineMs:240000,minDeadlineMs:60000,maxDeadlineMs:330000,list:{types:600,methods:1200,externalTypes:250,externalMembers:400,strings:400,stringChars:200,pinvokes:200,nativeImpls:200,references:200,attributes:120,occurrences:2000,edges:2000,tables:400,columns:60,probes:50}};
const REA_CLI='/opt/rea/node_modules/rea-agents/scripts/rea.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const cut=(s,n)=>typeof s==='string'&&s.length>n?s.slice(0,n)+'…':s;
const bounded=(list,limit)=>({items:list.slice(0,limit),total:list.length,truncatedByAdapter:list.length>limit});
// Splits stdin into {header, bytes}. The header is one JSON line; everything after it is the file.
export function parseFrame(buf){
 const prefix=Buffer.from(FILE_FRAME);if(buf.length<prefix.length||!buf.subarray(0,prefix.length).equals(prefix))return {error:'Not a file request.'};
 const nl=buf.indexOf(10,prefix.length);if(nl<0||nl-prefix.length>4096)return {error:'Request header is missing or too long.'};
 let header;try{header=JSON.parse(buf.subarray(prefix.length,nl).toString('utf8'));}catch{return {error:'Request header is not JSON.'};}
 return {header,bytes:buf.subarray(nl+1)};
}
export function validHeader(h,bytes){
 if(!h||h.protocol!==FILE_PROTOCOL||!KINDS[h.kind])return 'Unknown file analysis kind.';
 if(!Number.isInteger(h.bytes)||h.bytes<1||h.bytes>FILE_LIMITS.bytes)return 'The file must be 1 byte to '+FILE_LIMITS.bytes/1048576+' MB.';
 if(bytes.length!==h.bytes)return 'The file length does not match the request ('+bytes.length+' of '+h.bytes+' bytes).';
 if(typeof h.sha256!=='string'||!/^[a-f0-9]{64}$/.test(h.sha256)||sha(bytes)!==h.sha256)return 'The file does not match its approved SHA-256 fingerprint.';
 return null;
}
function run(args,{timeoutMs,maxStdout}){
 return new Promise(resolve=>{const started=Date.now();const out=[];let outBytes=0,err='',overflow=false,timedOut=false;
  const child=spawn(process.execPath,[REA_CLI,...args],{cwd:'/tmp',env:{PATH:'/usr/local/bin:/usr/bin:/bin',HOME:'/tmp/rea-home',NODE_ENV:'production',NO_COLOR:'1'},stdio:['ignore','pipe','pipe']});
  const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},timeoutMs);
  child.stdout.on('data',d=>{outBytes+=d.length;if(outBytes>maxStdout){overflow=true;child.kill('SIGKILL');return;}out.push(d);});
  child.stderr.on('data',d=>{if(err.length<FILE_LIMITS.stderrBytes)err+=d.toString().slice(0,FILE_LIMITS.stderrBytes-err.length);});
  child.on('error',e=>{clearTimeout(timer);resolve({code:null,stdout:'',stderr:String(e.message),ms:Date.now()-started,spawnError:true});});
  child.on('close',code=>{clearTimeout(timer);resolve({code,stdout:Buffer.concat(out).toString('utf8'),stderr:err,ms:Date.now()-started,overflow,timedOut});});
 });
}
const evidenceMeta=d=>({evidenceId:d?.evidence_id??null,operation:d?.operation??null,confidence:d?.confidence??null,authority:d?.authority??null,limitations:Array.isArray(d?.limitations)?d.limitations.slice(0,20).map(x=>cut(String(x),500)):[]});
const sig=s=>s?{ret:s.return_type??null,params:Array.isArray(s.parameter_types)?s.parameter_types:[],status:s.parse_status??null}:null;
// ---- projections: only what REA reported, bounded for the website ----
export function summarizeArtifact(d){
 const n=d?.normalized_result;if(!n?.artifact)return null;const cli=n.pe?.cli;
 return {...evidenceMeta(d),artifact:{sha256:n.artifact.sha256,bytes:n.artifact.byte_length,format:n.artifact.format},
  pe:n.pe?{architecture:n.pe.architecture,optionalHeader:n.pe.optional_header,sectionCount:n.pe.section_count,runtimeVersion:cli?.runtime_version??null,flags:cli?.flag_names??[],entryPoint:cli?.entry_point??null,readyToRun:cli?.ready_to_run_signature===true,hasResources:(cli?.resources_size||0)>0,strongNameSize:cli?.strong_name_size??0}:null,
  classification:n.classification?{status:n.classification.status,runtimeFamily:n.classification.runtime_family,implementation:n.classification.implementation,managedArchitecture:n.classification.managed_architecture}:null,
  module:n.module?{name:n.module.name,mvid:n.module.mvid}:null,assembly:n.assembly?{name:n.assembly.name,version:n.assembly.version,culture:n.assembly.culture,publicKey:n.assembly.public_key?{kind:n.assembly.public_key.kind,token:n.assembly.public_key.token,bytes:n.assembly.public_key.byte_length}:null}:null,
  targetFrameworks:n.target_frameworks??[],references:bounded((n.references||[]).map(r=>({name:r.name,version:r.version,culture:r.culture})),FILE_LIMITS.list.references),
  resources:bounded((n.resources||[]).map(r=>({name:r.name??null,size:r.size??r.byte_length??null,visibility:r.visibility??null})),100),
  attributes:bounded(Object.entries((n.attributes||[]).reduce((m,a)=>(m[a.type_name]=(m[a.type_name]||0)+1,m),{})).sort((a,b)=>b[1]-a[1]).map(([type,count])=>({type,count})),FILE_LIMITS.list.attributes),
  metadata:n.metadata?{version:n.metadata.version,tableRows:n.metadata.table_row_counts}:null,coverage:n.coverage??null};
}
export function summarizeBoundaries(d){
 const n=d?.normalized_result;if(!n?.artifact)return null;const L=FILE_LIMITS.list;
 return {...evidenceMeta(d),summary:n.summary??null,cliNative:n.cli_native??null,
  moduleRefs:bounded((n.module_refs||[]).map(m=>m.name),L.pinvokes),
  pinvokes:bounded((n.pinvoke_imports||[]).map(p=>({member:p.member_name,library:p.import_scope_name,entry:p.import_name,charSet:p.char_set,callingConvention:p.call_convention,verification:p.verification})),L.pinvokes),
  nativeImplementations:bounded((n.native_implementations||[]).map(m=>({name:m.name,codeType:m.code_type,kind:m.boundary_kind,body:m.body_interpretation})),L.nativeImpls),coverage:n.coverage??null};
}
export function summarizeMembers(d){
 const n=d?.normalized_result;if(!n?.artifact)return null;const L=FILE_LIMITS.list;
 const types=n.types||[],methods=n.methods||[],fields=n.fields||[],edges=n.call_edges||[],strings=n.user_strings?.literals||[];
 // Calls into other assemblies (member-refs), grouped by declaring type and member, with how many call sites use them.
 const ext=new Map();for(const e of edges){if(e.target_kind!=='member-ref')continue;const t=e.target_declaring_type||'(unknown)';let m=ext.get(t);if(!m)ext.set(t,m=new Map());m.set(e.target_name,(m.get(e.target_name)||0)+1);}
 const extTypes=[...ext].map(([type,m])=>({type,calls:[...m.values()].reduce((a,b)=>a+b,0),members:[...m].sort((a,b)=>b[1]-a[1]).slice(0,L.externalMembers/10).map(([name,count])=>({name,count}))})).sort((a,b)=>b.calls-a.calls);
 const perType=new Map();for(const m of methods)perType.set(m.declaring_type,(perType.get(m.declaring_type)||0)+1);const fieldsPer=new Map();for(const f of fields)fieldsPer.set(f.declaring_type,(fieldsPer.get(f.declaring_type)||0)+1);
 return {...evidenceMeta(d),counts:{types:types.length,methods:methods.length,fields:fields.length,memberRefs:(n.member_refs||[]).length,callEdges:edges.length,fieldAccesses:(n.field_accesses||[]).length,userStrings:strings.length},
  types:bounded(types.map(t=>({name:t.full_name,methods:perType.get(t.full_name)||0,fields:fieldsPer.get(t.full_name)||0})),L.types),
  methods:bounded(methods.filter(m=>m.body?.status==='present').sort((a,b)=>(b.body.il_size||0)-(a.body.il_size||0)).map(m=>({type:m.declaring_type,name:m.name,returns:m.signature?.return_type??null,params:m.signature?.parameter_count??null,ilSize:m.body.il_size??null,instructions:m.body.instruction_count??null})),L.methods),
  externalCalls:bounded(extTypes,L.externalTypes),
  strings:{state:n.user_strings?.state??null,...bounded(strings.map(s=>cut(String(s.value),L.stringChars)),L.strings)},
  selection:n.selection??null,coverage:n.coverage??null};
}
export function summarizeArchive(d){
 const n=d?.normalized_result,inv=n?.substeps?.find(s=>s.operation==='inventory_artifact')?.evidence?.normalized_result;if(!n||!inv)return null;const L=FILE_LIMITS.list;
 const nodes=new Map((inv.nodes||[]).map(x=>[x.artifact_id,x]));
 const entries=(inv.occurrences||[]).map(o=>{const node=nodes.get(o.artifact_id);return {path:o.logical_path,entryKind:o.entry_kind,format:o.artifact_format,artifactKind:o.artifact_kind,size:o.declared_size,compressed:o.compressed_size,executable:o.executable===true,encrypted:o.encrypted===true,hash:o.hash_status,sha256:node?.sha256??null,contentState:node?.content_state??null};});
 const formats={};for(const e of entries)formats[e.format||'unknown']=(formats[e.format||'unknown']||0)+1;
 const edgeKinds={};for(const e of inv.edges||[])edgeKinds[e.relation]=(edgeKinds[e.relation]||0)+1;
 const pick=a=>bounded((a||[]).map(x=>typeof x==='string'?cut(x,400):JSON.parse(JSON.stringify(x,(k,v)=>typeof v==='string'?cut(v,300):v))),L.probes);
 return {...evidenceMeta(d),inspectionId:n.inspection_id,root:{format:n.subject?.root_format,sha256:n.subject?.root_sha256},manifest:inv.manifest??null,formats,edgeKinds,
  entries:bounded(entries,L.occurrences),integrityContradictions:pick(inv.integrity_contradictions),hypotheses:pick(n.hypotheses),contradictions:pick(n.contradictions),unexploredBranches:pick(n.unexplored_branches),nextProbes:pick(n.next_probes),coverage:{status:n.coverage?.status??null,inventory:inv.coverage_status??inv.coverage??null},limitations:[...new Set([...(n.limitations||[]),...(inv.limitations||[])])].slice(0,30).map(x=>cut(String(x),500))};
}
export function summarizeSqlite(d){
 const n=d?.normalized_result;if(!n?.schema)return null;const L=FILE_LIMITS.list;
 return {...evidenceMeta(d),artifact:n.artifact?{sha256:n.artifact.sha256,bytes:n.artifact.bytes}:null,engine:n.engine??null,encoding:n.database_encoding??null,wal:n.wal??null,schemaScope:n.schema.scope,schemaCompleteness:n.schema.completeness,
  tables:bounded((n.schema.tables||[]).map(t=>({name:t.name,kind:t.kind,rootPage:t.root_page,withoutRowid:t.without_rowid===true,strict:t.strict===true,columnCount:t.column_count,columnsCompleteness:t.columns_completeness,columns:(t.columns||[]).slice(0,L.columns).map(c=>({name:c.name,type:c.declared_type??null,notNull:c.not_null===true,primaryKey:c.primary_key_position>0?c.primary_key_position:null,hidden:c.hidden??0,default:c.default_sql==null?null:cut(String(c.default_sql),120)}))})),L.tables),
  indexes:bounded((n.schema.indexes||[]).map(i=>({name:i.name,table:i.table,sql:cut(i.sql??null,400)})),L.tables),views:bounded((n.schema.views||[]).map(v=>({name:v.name,sql:cut(v.sql??null,600)})),L.tables),triggers:bounded((n.schema.triggers||[]).map(t=>({name:t.name,table:t.table,sql:cut(t.sql??null,600)})),L.tables)};
}
function walk(root,rel=''){const out=[];for(const name of readdirSync(join(root,rel))){const p=rel?rel+'/'+name:name,st=lstatSync(join(root,p));if(st.isSymbolicLink())out.push({path:p,symlink:true});else if(st.isDirectory())out.push(...walk(root,p));else out.push({path:p,sha256:sha(readFileSync(join(root,p)))});}return out;}
const parse=r=>{try{return r.stdout?JSON.parse(r.stdout):null;}catch{return null;}};
const reaError=doc=>doc&&doc.error?{code:doc.code??null,category:doc.category??null,message:cut(String(doc.message??doc.error),600)}:null;
const OPS={
 dotnet:[{key:'artifact',args:['inspect-managed-artifact'],summarize:summarizeArtifact,required:true},{key:'boundaries',args:['inspect-managed-native-boundaries'],summarize:summarizeBoundaries},{key:'members',args:['inspect-managed-members'],summarize:summarizeMembers}],
 archive:[{key:'archive',args:['inspect-artifact','--integrity-policy','record-and-continue'],summarize:summarizeArchive,required:true}],
 sqlite:[{key:'database',args:['inspect-sqlite-database','--schema-scope','database'],summarize:summarizeSqlite,required:true}]
};
export const FILE_OPERATIONS=Object.fromEntries(Object.entries(OPS).map(([k,v])=>[k,v.map(o=>o.args[0])]));
export async function analyzeFile(header,bytes,{workRoot='/tmp/skydata-rea-file',adapter='1'}={}){
 const phases=[],t0=Date.now(),invalid=validHeader(header,bytes);
 if(invalid)return {adapter,mode:'file',status:'rejected',error:invalid,phases};
 const kind=KINDS[header.kind],root=join(workRoot,'in');rmSync(workRoot,{recursive:true,force:true});mkdirSync(root,{recursive:true});mkdirSync('/tmp/rea-home',{recursive:true});
 const target=join(root,kind.name);writeFileSync(target,bytes,{flag:'wx'});
 phases.push({phase:'stage',ms:Date.now()-t0,ok:true,detail:bytes.length+' bytes written to tmpfs as data ('+kind.label+')'});
 const deadline=Number.isInteger(header.deadlineMs)?Math.min(FILE_LIMITS.maxDeadlineMs,Math.max(FILE_LIMITS.minDeadlineMs,header.deadlineMs)):FILE_LIMITS.deadlineMs;
 const ver=await run(['--version'],{timeoutMs:90000,maxStdout:1024}),version=ver.stdout.trim();
 phases.push({phase:'rea_version',ms:ver.ms,ok:version===REA_VERSION,...(version===REA_VERSION?{}:{detail:'Expected REA '+REA_VERSION+', found '+(version||'none')})});
 if(version!==REA_VERSION){rmSync(workRoot,{recursive:true,force:true});return {adapter,mode:'file',status:'incompatible',rea:{version:version||null,expected:REA_VERSION},phases};}
 const results={},operations=[];let worst=null;
 for(const op of OPS[header.kind]){
  const remaining=deadline-(Date.now()-t0);
  if(remaining<5000){operations.push({operation:op.args[0],ok:false,code:'deadline',detail:'Skipped: the overall time limit was reached.'});worst??='timeout';continue;}
  const r=await run([...op.args,target,'--format','json'],{timeoutMs:remaining,maxStdout:FILE_LIMITS.reaStdoutBytes}),doc=parse(r),err=reaError(doc),summary=!err&&doc?op.summarize(doc):null;
  const ok=r.code===0&&!r.timedOut&&!r.overflow&&!!summary;
  operations.push({operation:op.args[0],ok,ms:r.ms,code:r.timedOut?'deadline':r.overflow?'output_limit':String(r.code),stdoutBytes:Buffer.byteLength(r.stdout||''),stdoutSha256:r.stdout?sha(r.stdout):null,...(ok?{}:{detail:cut(err?.message||r.stderr.split('\n').filter(l=>l&&!l.startsWith('{"rea_progress"')).slice(-3).join(' ')||'No readable REA output.',600),error:err})});
  if(ok)results[op.key]=summary;else if(op.required)worst??=r.timedOut?'timeout':r.overflow?'output_limit':'failed';else worst??='partial';
  phases.push({phase:'rea_'+op.key,command:'rea '+op.args[0]+' <staged file>',ms:r.ms,ok,code:operations.at(-1).code,...(ok?{}:{detail:operations.at(-1).detail})});
 }
 const after=walk(root),changed=after.filter(f=>f.symlink||f.path!==kind.name||f.sha256!==header.sha256).map(f=>f.path),missing=after.some(f=>f.path===kind.name)?[]:[kind.name];
 phases.push({phase:'workspace_check',ms:0,ok:!changed.length&&!missing.length,...(changed.length||missing.length?{detail:'Changed or new: '+changed.join(', ')+(missing.length?' · missing: '+missing.join(', '):'')}:{})});
 rmSync(workRoot,{recursive:true,force:true});
 const required=OPS[header.kind].filter(o=>o.required).every(o=>results[o.key]);
 const status=(changed.length||missing.length)?'workspace_changed':!required?(worst??'failed'):worst==='partial'||worst==='timeout'?'partial':'complete';
 return {adapter,mode:'file',status,kind:header.kind,input:{sha256:header.sha256,bytes:bytes.length},rea:{version,operations},workspaceUnchanged:!changed.length&&!missing.length,results,phases,totalMs:Date.now()-t0};
}
