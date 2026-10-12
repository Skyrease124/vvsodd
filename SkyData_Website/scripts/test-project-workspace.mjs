import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
// Real ZIP fixtures (Python zipfile + Info-ZIP), real SQLite with the project migrations, and an
// in-memory bucket that enforces R2's range and multipart rules. R2 itself is exercised in test-project-worker.mjs.
const require=createRequire(import.meta.url);const dir=fs.readdirSync('node_modules/.pnpm').find(x=>x.startsWith('esbuild@'));const esbuild=await import('../node_modules/.pnpm/'+dir+'/node_modules/esbuild/lib/main.js');
await esbuild.build({entryPoints:['lib/projects.ts'],bundle:true,platform:'node',format:'cjs',outfile:'node_modules/.cache/project-workspace.cjs',logLevel:'error'});
const {handleProjects,projectContext}=require('../node_modules/.cache/project-workspace.cjs');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'skydata-ws-'));
const py=(script,...args)=>{const r=spawnSync('python3',['-I','-c',script,...args],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout;};
const sha=b=>createHash('sha256').update(b).digest('hex');
const big='// big\n'+'x'.repeat(2*1024*1024+10);
fs.writeFileSync(tmp+'/big.txt',big);
py(`
import zipfile,sys,os,io
class NoSeek(io.RawIOBase):
  def __init__(s,f): s.f=f
  def writable(s): return True
  def write(s,b): return s.f.write(b)
out=sys.argv[1]
with open(out,'wb') as raw:
  z=zipfile.ZipFile(NoSeek(raw),'w')  # unseekable: entries get data descriptors (flag bit 3)
  z.writestr(zipfile.ZipInfo('src/'),'')
  z.writestr('src/math.mjs','export const add=(a,b)=>a+b;\\n',compress_type=zipfile.ZIP_DEFLATED)
  z.writestr('src/math.test.mjs',"import assert from 'node:assert/strict';\\nimport {add} from './math.mjs';\\nassert.equal(add(2,2),4);\\n",compress_type=zipfile.ZIP_DEFLATED)
  z.writestr('README.md','# Demo\\nCafé ✓\\n',compress_type=zipfile.ZIP_STORED)
  z.writestr('assets/logo.png',bytes(range(256))*4,compress_type=zipfile.ZIP_DEFLATED)
  z.writestr('data/blob.bin',os.urandom(64)+b'\\0',compress_type=zipfile.ZIP_STORED)
  z.write(sys.argv[2],'big.txt',compress_type=zipfile.ZIP_DEFLATED)
  z.comment=b'archive comment kept'
  z.close()
`,tmp+'/fixture.zip',tmp+'/big.txt');
py(`
import zipfile,sys
with zipfile.ZipFile(sys.argv[1],'w') as z:
  z.writestr('ok.js','1')
  z.writestr('../escape.js','evil')
`,tmp+'/unsafe.zip');
py(`
import zipfile,sys,os,warnings
warnings.simplefilter('ignore')
with zipfile.ZipFile(sys.argv[1],'w') as z:
  z.writestr('app.js','console.log(1)\\n')
  z.writestr('app.js','console.log(2)\\n')
  z.writestr('media/huge.bin',os.urandom(20*1024*1024),compress_type=zipfile.ZIP_STORED)
  z.writestr('main.js','export const v=1;\\n')
`,tmp+'/dupes.zip');
// In-memory R2: ranged reads, conditional puts, multipart with R2's equal-part-size rule.
const store=new Map();let etags=0,failNextConditional=false;
const object=(data,extra={})=>({size:data.length,etag:'e'+(++etags),...extra});
const bucket={
 async head(k){const v=store.get(k);return v?{size:v.data.length,etag:v.etag}:null;},
 async get(k,o={}){const v=store.get(k);if(!v)return null;let d=v.data;if(o.range){const {offset,length}=o.range;assert.ok(offset>=0&&offset+length<=d.length,'range out of bounds');d=d.subarray(offset,offset+length);}
  return {etag:v.etag,body:new Blob([d]).stream(),async arrayBuffer(){return d.buffer.slice(d.byteOffset,d.byteOffset+d.byteLength);},async json(){return JSON.parse(Buffer.from(d).toString());},async text(){return Buffer.from(d).toString();}};},
 async put(k,body,o={}){const cur=store.get(k);if(o.onlyIf?.etagMatches&&(cur?.etag!==o.onlyIf.etagMatches||failNextConditional)){failNextConditional=false;return null;}const data=typeof body==='string'?Buffer.from(body):Buffer.from(body);const v={data,etag:'e'+(++etags)};store.set(k,v);return object(data,{etag:v.etag});},
 async delete(k){for(const x of [k].flat())store.delete(x);},
 async list({prefix}){return {objects:[...store.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key})),truncated:false};},
 async createMultipartUpload(k){const parts=new Map();return {async uploadPart(n,d){parts.set(n,Buffer.from(d));return {partNumber:n,etag:'p'+n};},async abort(){parts.clear();},async complete(list){const bufs=list.map(p=>parts.get(p.partNumber));for(let i=0;i<bufs.length-1;i++){assert.equal(bufs[i].length,bufs[0].length,'R2 requires equal part sizes');assert.ok(bufs[i].length>=5*1024*1024,'R2 parts must be at least 5 MiB');}const data=Buffer.concat(bufs);store.set(k,{data,etag:'e'+(++etags)});return object(data);}};}
};
const sql=new DatabaseSync(':memory:');for(const p of fs.readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+p,'utf8'));
const DB={prepare(s){const stmt=sql.prepare(s);let v=[];const self={bind(...x){v=x;return self;},async first(){return stmt.get(...v)||null;},async all(){return {results:stmt.all(...v)};},async run(){const r=stmt.run(...v);return {meta:{changes:Number(r.changes)}};}};return self;},async batch(list){return Promise.all(list.map(s=>s.run()));}};
const env={DB,FILES:bucket};
function addProject(file,owner='owner'){const id=crypto.randomUUID(),key='projects/'+id+'/archive.zip',data=fs.readFileSync(file);store.set(key,{data,etag:'orig'});sql.prepare("INSERT INTO projects(id,owner,name,size,status,upload,key,chunks,created) VALUES(?,?,?,?,'ready','none',?,1,?)").run(id,owner,path.basename(file),data.length,key,Date.now());
 store.set('projects/'+id+'/manifest.json',{data:Buffer.from(JSON.stringify([{path:'src/math.mjs',size:29,chunk:0},{path:'src/math.test.mjs',size:80,chunk:0},{path:'README.md',size:15,chunk:0},{path:'assets/logo.png',size:1024}])),etag:'m'});
 store.set('projects/'+id+'/code-0.json',{data:Buffer.from(JSON.stringify([{path:'src/math.mjs',text:'export const add=(a,b)=>a+b;\n'},{path:'src/math.test.mjs',text:"import {add} from './math.mjs';\nassert.equal(add(2,2),4);\n"},{path:'README.md',text:'# Demo\nCafé ✓\n',truncated:true}])),etag:'c'});return {id,key};}
const call=async(method,url,body,owner='owner',origin='https://site.test')=>{const r=await handleProjects(new Request('https://site.test/api/projects/'+url,{method,headers:{'oai-authenticated-user-id':owner,origin,...(body!==undefined?{'content-type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})}),env);const type=r.headers.get('content-type')||'';return {status:r.status,data:type.includes('json')?await r.json():Buffer.from(await r.arrayBuffer())};};
const {id,key}=addProject(tmp+'/fixture.zip');const originalSha=sha(store.get(key).data);
try{
 // 1. Browsing: ownership, listing and honest labels.
 assert.equal((await call('GET',id+'/files',undefined,'stranger')).status,404);
 const list=await call('GET',id+'/files');assert.equal(list.status,200,JSON.stringify(list.data));
 const kinds=Object.fromEntries(list.data.files.map(f=>[f.path,f.kind]));
 assert.deepEqual(kinds,{'src/math.mjs':'text','src/math.test.mjs':'text','README.md':'text','assets/logo.png':'binary','data/blob.bin':'binary','big.txt':'too_large'});
 assert.equal(list.data.files.find(f=>f.path==='src/math.mjs').indexed,true);assert.equal(list.data.files.find(f=>f.path==='data/blob.bin').indexed,false);
 assert.ok(store.has('projects/'+id+'/archive-directory.json'),'directory cache stored beside the original');
 // 2. Viewing reads the complete original from the archive (not the truncated index) and verifies CRC.
 const readme=await call('GET',id+'/file?path=README.md');assert.equal(readme.data.complete,true);assert.equal(readme.data.text,'# Demo\nCafé ✓\n');assert.equal(readme.data.sha256,sha(Buffer.from('# Demo\nCafé ✓\n')));
 const math=await call('GET',id+'/file?path=src%2Fmath.mjs');assert.equal(math.data.text,'export const add=(a,b)=>a+b;\n');
 for(const [p,kind] of [['big.txt','too_large'],['assets/logo.png','binary'],['data/blob.bin','binary'],['missing.js','unknown']]){const r=await call('GET',id+'/file?path='+encodeURIComponent(p));assert.equal(r.status,200);assert.equal(r.data.complete,false,p);assert.equal(r.data.kind,kind,p);assert.ok(r.data.reason,p);}
 const search=await call('GET',id+'/search?q=add(2');assert.equal(search.data.matches.length,1);assert.equal(search.data.matches[0].path,'src/math.test.mjs');assert.equal(search.data.partialFiles,1);assert.match(search.data.note,/not searched/);
 // 3. Proposals require the complete original fingerprint; identical, binary, oversized and colliding files are refused.
 const testText="import assert from 'node:assert/strict';\nimport {add} from './math.mjs';\nassert.equal(add(2,3),5);\n";
 const mathSha=math.data.sha256,fixed='export const add=(a,b)=>Number(a)+Number(b);\n';
 const bad=[[{path:'src/math.mjs',text:fixed}],[{path:'src/math.mjs',text:fixed,originalSha256:'0'.repeat(64)}],[{path:'src/math.mjs',text:math.data.text,originalSha256:mathSha}],[{path:'assets/logo.png',text:'x',originalSha256:'0'.repeat(64)}],[{path:'big.txt',text:'x',originalSha256:'0'.repeat(64)}],[{path:'README.md',text:'x',isNew:true}],[{path:'../evil.js',text:'x',isNew:true}],[{path:'src/a.js',text:'x',isNew:true},{path:'SRC/A.js',text:'y',isNew:true}]];
 for(const files of bad){const r=await call('POST',id+'/proposals',{origin:'manual',files});assert.ok([400,409].includes(r.status),JSON.stringify(files)+' → '+r.status);}
 assert.equal((await call('POST',id+'/proposals',{origin:'manual',files:[{path:'src/x.js',text:'x',isNew:true}]},'owner','https://evil.test')).status,403);
 const created=await call('POST',id+'/proposals',{origin:'manual',title:'Fix add',files:[{path:'src/math.mjs',text:fixed,originalSha256:mathSha},{path:'README.md',text:'# Demo v2\n',originalSha256:readme.data.sha256},{path:'test/add.test.mjs',text:testText,isNew:true}]});
 assert.equal(created.status,200,JSON.stringify(created.data));const pid=created.data.proposal.id;assert.ok(created.data.proposal.files.every(f=>f.decision==='pending'));
 assert.equal((await call('GET',id+'/proposals/'+pid,undefined,'stranger')).status,404);
 const detail=await call('GET',id+'/proposals/'+pid);const df=Object.fromEntries(detail.data.proposal.files.map(f=>[f.path,f]));
 assert.equal(df['src/math.mjs'].original,'export const add=(a,b)=>a+b;\n');assert.equal(df['src/math.mjs'].originalStatus,'verified');assert.equal(df['test/add.test.mjs'].originalStatus,'new_file');
 // 4. Packaging is refused until something is approved; approvals are per file and bound to the reviewed text.
 assert.equal((await call('POST',id+'/proposals/'+pid+'/package',{})).status,400);
 assert.equal((await call('POST',id+'/proposals/'+pid+'/decision',{path:'src/math.mjs',decision:'approved',proposedSha256:'0'.repeat(64)})).status,409);
 for(const [p,decision] of [['src/math.mjs','approved'],['README.md','rejected'],['test/add.test.mjs','approved']])assert.equal((await call('POST',id+'/proposals/'+pid+'/decision',{path:p,decision,proposedSha256:df[p].proposedSha256})).status,200);
 const pkg=await call('POST',id+'/proposals/'+pid+'/package',{});assert.equal(pkg.status,200,JSON.stringify(pkg.data));
 assert.deepEqual(pkg.data.package.replaced,['src/math.mjs']);assert.deepEqual(pkg.data.package.added,['test/add.test.mjs']);assert.ok(!('key' in pkg.data.package));
 const zip=await call('GET',id+'/proposals/'+pid+'/download?package='+pkg.data.package.id);assert.equal(zip.status,200);fs.writeFileSync(tmp+'/corrected.zip',zip.data);
 assert.equal(sha(store.get(key).data),originalSha,'original upload is byte-for-byte unchanged');
 // 5. Independent readers validate the corrected archive.
 const report=JSON.parse(py(`
import zipfile,sys,json,hashlib
a=zipfile.ZipFile(sys.argv[1]);b=zipfile.ZipFile(sys.argv[2])
assert a.testzip() is None and b.testzip() is None
def raw(z,i):
  f=open(z.filename,'rb');f.seek(i.header_offset+26);n=int.from_bytes(f.read(2),'little');m=int.from_bytes(f.read(2),'little');f.seek(i.header_offset+30+n+m);return f.read(i.compress_size)
same=[i.filename for i in a.infolist() if i.filename not in ('src/math.mjs',) and raw(a,i)==raw(b,b.getinfo(i.filename))]
print(json.dumps({'names':b.namelist(),'math':b.read('src/math.mjs').decode(),'readme':b.read('README.md').decode(),'test':b.read('test/add.test.mjs').decode(),'comment':b.comment.decode(),'sameRaw':same}))
`,tmp+'/fixture.zip',tmp+'/corrected.zip'));
 assert.deepEqual(report.names,['src/','src/math.mjs','src/math.test.mjs','README.md','assets/logo.png','data/blob.bin','big.txt','test/add.test.mjs']);
 assert.equal(report.math,fixed);assert.equal(report.readme,'# Demo\nCafé ✓\n','rejected file keeps the original');assert.equal(report.test,testText);assert.equal(report.comment,'archive comment kept');
 assert.deepEqual(report.sameRaw.sort(),['README.md','assets/logo.png','big.txt','data/blob.bin','src/','src/math.test.mjs'].sort(),'unchanged entries are copied byte-for-byte, compressed data included');
 const unzip=spawnSync('unzip',['-t',tmp+'/corrected.zip'],{encoding:'utf8'});assert.equal(unzip.status,0,unzip.stdout+unzip.stderr);assert.match(unzip.stdout,/No errors detected/);
 // 6. Explicit AI selection sends complete files and labels truncation; DELETE on a proposal keeps the project.
 const ctx=await projectContext([{role:'user',content:'review',project:{id,name:'fixture.zip',paths:['src/math.mjs','assets/logo.png']}}],'owner',env);
 assert.match(ctx,/explicitly selected 2 file/);assert.ok(ctx.includes('"status":"FULL"'));assert.ok(ctx.includes('"status":"UNAVAILABLE"'));assert.ok(ctx.includes('file=<exact path>'));assert.ok(ctx.includes(JSON.stringify('export const add=(a,b)=>a+b;\n')));
 assert.equal((await projectContext([{role:'user',content:'x',project:{id,name:'f',paths:['src/math.mjs']}}],'stranger',env)).includes('unavailable'),true);
 assert.equal((await call('DELETE',id+'/proposals/'+pid)).status,200);assert.ok(store.has(key),'project archive survives proposal deletion');
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM projects WHERE id=?').get(id).n,1);assert.ok(![...store.keys()].some(k=>k.includes('/corrected/')),'packages removed with their proposal');
 // 7. Unsafe and duplicate archives: browsing labels them, packaging refuses or keeps them ambiguous-safe; multipart path exercised.
 const unsafe=addProject(tmp+'/unsafe.zip');const ul=await call('GET',unsafe.id+'/files');assert.equal(ul.data.files.find(f=>f.path==='../escape.js').kind,'unsafe');
 const uf=await call('GET',unsafe.id+'/file?path=ok.js');const up=await call('POST',unsafe.id+'/proposals',{origin:'manual',files:[{path:'ok.js',text:'2',originalSha256:uf.data.sha256}]});const ud=await call('GET',unsafe.id+'/proposals/'+up.data.proposal.id);
 await call('POST',unsafe.id+'/proposals/'+up.data.proposal.id+'/decision',{path:'ok.js',decision:'approved',proposedSha256:ud.data.proposal.files[0].proposedSha256});
 const refused=await call('POST',unsafe.id+'/proposals/'+up.data.proposal.id+'/package',{});assert.equal(refused.status,400);assert.match(refused.data.error,/unsafe paths/);
 const dupes=addProject(tmp+'/dupes.zip');const dl=await call('GET',dupes.id+'/files');assert.deepEqual(dl.data.duplicates,['app.js']);assert.equal(dl.data.files.filter(f=>f.kind==='duplicate').length,2);
 assert.equal((await call('GET',dupes.id+'/file?path=app.js')).data.complete,false);
 const mf=await call('GET',dupes.id+'/file?path=main.js');const dp=await call('POST',dupes.id+'/proposals',{origin:'manual',files:[{path:'main.js',text:'export const v=2;\n',originalSha256:mf.data.sha256}]});const dd=await call('GET',dupes.id+'/proposals/'+dp.data.proposal.id);
 await call('POST',dupes.id+'/proposals/'+dp.data.proposal.id+'/decision',{path:'main.js',decision:'approved',proposedSha256:dd.data.proposal.files[0].proposedSha256});
 const dpkg=await call('POST',dupes.id+'/proposals/'+dp.data.proposal.id+'/package',{});assert.equal(dpkg.status,200,JSON.stringify(dpkg.data));assert.ok(dpkg.data.package.size>20*1024*1024,'multi-part (>8 MiB) output');
 const dz=await call('GET',dupes.id+'/proposals/'+dp.data.proposal.id+'/download?package='+dpkg.data.package.id);fs.writeFileSync(tmp+'/dupes-corrected.zip',dz.data);
 const dcheck=JSON.parse(py(`
import zipfile,sys,json,warnings
warnings.simplefilter('ignore')
z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None
print(json.dumps({'names':z.namelist(),'main':z.read('main.js').decode(),'apps':[z.open(i).read().decode() for i in z.infolist() if i.filename=='app.js']}))
`,tmp+'/dupes-corrected.zip'));
 assert.deepEqual(dcheck.names,['app.js','app.js','media/huge.bin','main.js']);assert.equal(dcheck.main,'export const v=2;\n');assert.deepEqual(dcheck.apps,['console.log(1)\n','console.log(2)\n'],'unapproved duplicate entries preserved as uploaded');
 // 7b. Regression: a conflicting metadata save must not delete previously listed corrected ZIPs.
 const keep=addProject(tmp+'/fixture.zip'),kf=await call('GET',keep.id+'/file?path=src%2Fmath.mjs');
 const kp=(await call('POST',keep.id+'/proposals',{origin:'manual',files:[{path:'src/math.mjs',text:'export const add=(a,b)=>a+b+0;\n',originalSha256:kf.data.sha256}]})).data.proposal.id;
 const kd=await call('GET',keep.id+'/proposals/'+kp);await call('POST',keep.id+'/proposals/'+kp+'/decision',{path:'src/math.mjs',decision:'approved',proposedSha256:kd.data.proposal.files[0].proposedSha256});
 for(let i=0;i<3;i++)assert.equal((await call('POST',keep.id+'/proposals/'+kp+'/package',{})).status,200);
 const corrected=()=>[...store.keys()].filter(k=>k.startsWith('projects/'+keep.id+'/corrected/')).sort();
 const listed=async()=>(await call('GET',keep.id+'/proposals')).data.proposals[0].packages.map(x=>x.id);
 const before=await listed(),keysBefore=corrected();assert.equal(before.length,3);assert.equal(keysBefore.length,3);
 failNextConditional=true;const conflict=await call('POST',keep.id+'/proposals/'+kp+'/package',{});assert.equal(conflict.status,409,JSON.stringify(conflict.data));
 assert.deepEqual(await listed(),before,'metadata unchanged after the failed save');assert.deepEqual(corrected(),keysBefore,'no archive deleted and no orphaned new archive left');
 for(const pk of before){const r=await call('GET',keep.id+'/proposals/'+kp+'/download?package='+pk);assert.equal(r.status,200,'previous download '+pk+' still works');assert.equal(r.data.subarray(0,4).toString('hex'),'504b0304');}
 const ok4=await call('POST',keep.id+'/proposals/'+kp+'/package',{});assert.equal(ok4.status,200);const after=await listed();
 assert.equal(after.length,3);assert.deepEqual(after.slice(1),before.slice(0,2),'oldest evicted only after a successful save');assert.equal(corrected().length,3,'evicted archive removed after commit');
 for(const pk of after)assert.equal((await call('GET',keep.id+'/proposals/'+kp+'/download?package='+pk)).status,200);
 assert.equal((await call('GET',keep.id+'/proposals/'+kp+'/download?package='+before[2])).status,404,'evicted package is no longer listed');
 // 8. Corrupted stored data is reported, never shown as complete.
 const corrupt=addProject(tmp+'/fixture.zip');const cd=store.get(corrupt.key).data;const at=cd.indexOf(Buffer.from('# Demo'));cd[at+2]^=1;
 const cr=await call('GET',corrupt.id+'/file?path=README.md');assert.equal(cr.data.complete,false);assert.match(cr.data.reason,/CRC-32/);
 console.log('PASS project workspace: owner-scoped browsing with honest kinds, complete CRC-verified source from the stored ZIP, index search labelled partial, proposals bound to complete-original SHA-256, per-file approvals, corrected ZIP (byte-identical unchanged entries, comment kept, original unchanged) validated by Python zipfile and unzip -t, multipart >8 MiB, failed metadata save preserves every previous corrected ZIP (evict only after commit), unsafe-path refusal, duplicate handling, explicit AI file selection, safe proposal deletion. R2 is an in-memory stand-in here.');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
