import {inflateSync,deflateSync} from 'fflate';
import {PROJECT_LIMIT} from './project-types';
// Reads and repackages the stored original ZIP directly from R2 with range requests.
// Nothing here executes archive content; entries are only parsed, decompressed and copied.
export type ArchiveBucket=Pick<R2Bucket,'get'|'head'|'put'|'createMultipartUpload'>;
export type ArchiveEntry={index:number;path:string;size:number;compressed:number;offset:number;method:number;flags:number;crc:number;unsafe?:string};
export type ArchiveDirectory={version:1;size:number;cdOffset:number;cdSize:number;entries:ArchiveEntry[];duplicates:string[];caseCollisions:string[]};
export type FileKind='directory'|'text'|'binary'|'unknown'|'too_large'|'unsupported'|'unsafe'|'duplicate';
export const VIEW_LIMIT=2*1024*1024,DIRECTORY_LIMIT=8*1024*1024,MAX_ENTRIES=20000;
const TEXT_EXT=/\.(?:html?|css|scss|less|[cm]?[jt]sx?|json|jsonc|md|markdown|txt|py|rb|go|rs|java|kt|cs|c|cc|cpp|h|hpp|php|sh|bat|cmd|ps1|sql|glsl|vert|frag|wgsl|hlsl|shader|yaml|yml|toml|ini|cfg|conf|xml|svg|csv|tsv|lua|gd|gdshader|vue|svelte|astro|env\.example|gitignore|gitattributes|editorconfig|lock|mjs|cjs|log|tex|r|swift|dart|scala|pl)$/i;
const BINARY_EXT=/\.(?:png|jpe?g|gif|webp|bmp|ico|tiff?|psd|blend|fbx|obj|glb|gltf|mtl|stl|dae|3ds|max|wav|mp3|ogg|flac|m4a|aac|mp4|mov|webm|avi|mkv|ttf|otf|woff2?|eot|zip|rar|7z|gz|tgz|bz2|xz|tar|exe|dll|so|dylib|bin|dat|pak|wasm|class|jar|pyc|pdf|docx?|xlsx?|pptx?|db|sqlite|unitypackage|asset|uasset|umap)$/i;
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
export function crc32(data:Uint8Array){let c=0xffffffff;for(let i=0;i<data.length;i++)c=CRC[(c^data[i])&255]^(c>>>8);return (c^0xffffffff)>>>0;}
export async function sha256(data:Uint8Array|string){const bytes=typeof data==='string'?new TextEncoder().encode(data):data;return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>)),x=>x.toString(16).padStart(2,'0')).join('');}
async function range(bucket:ArchiveBucket,key:string,offset:number,length:number){
 if(length<=0)return new Uint8Array();
 const object=await bucket.get(key,{range:{offset,length}});if(!object)throw Error('The stored archive is unavailable.');
 const bytes=new Uint8Array(await object.arrayBuffer());if(bytes.byteLength!==length)throw Error('The stored archive returned an incomplete range.');return bytes;
}
// Same acceptance rules as the browser-side upload reader, applied again on the server.
export function unsafeReason(raw:string){
 if(raw.includes('\0'))return 'contains a NUL character';if(raw.includes('\\'))return 'uses Windows backslashes';if(raw.startsWith('/'))return 'is an absolute path';
 if(/^[a-zA-Z]:/.test(raw))return 'starts with a drive letter';if(raw.split('/').includes('..'))return 'contains a parent-directory (..) segment';if(raw.length>1000)return 'is longer than 1000 characters';return undefined;
}
export async function readArchiveDirectory(bucket:ArchiveBucket,key:string):Promise<ArchiveDirectory>{
 const head=await bucket.head(key);if(!head)throw Error('The stored archive is unavailable.');const size=head.size;
 if(size<22)throw Error('The stored archive is too small to be a ZIP.');
 const tailStart=Math.max(0,size-65557),tail=await range(bucket,key,tailStart,size-tailStart),v=new DataView(tail.buffer,tail.byteOffset,tail.byteLength);let end=-1;
 for(let i=tail.byteLength-22;i>=0;i--)if(v.getUint32(i,true)===0x06054b50&&i+22+v.getUint16(i+20,true)===tail.byteLength){end=i;break;}
 if(end<0)throw Error('The stored file is not a standard ZIP archive.');
 if(end>=20&&v.getUint32(end-20,true)===0x07064b50)throw Error('ZIP64 archives are not supported.');
 const count=v.getUint16(end+10,true),cdSize=v.getUint32(end+12,true),cdOffset=v.getUint32(end+16,true);
 if(v.getUint16(end+4,true)||v.getUint16(end+6,true)||v.getUint16(end+8,true)!==count)throw Error('Split or multi-disk ZIP archives are not supported.');
 if(count===65535||cdOffset===0xffffffff||cdSize===0xffffffff)throw Error('ZIP64 archives are not supported.');
 if(count>MAX_ENTRIES||cdSize>DIRECTORY_LIMIT||cdOffset+cdSize>tailStart+end)throw Error('This archive has too many files or an invalid directory.');
 const dir=await range(bucket,key,cdOffset,cdSize),d=new DataView(dir.buffer,dir.byteOffset,dir.byteLength),decoder=new TextDecoder(),entries:ArchiveEntry[]=[];let p=0;
 for(let i=0;i<count;i++){
  if(p+46>dir.byteLength||d.getUint32(p,true)!==0x02014b50)throw Error('The ZIP directory is damaged.');
  const nameLen=d.getUint16(p+28,true),extra=d.getUint16(p+30,true),comment=d.getUint16(p+32,true);if(p+46+nameLen+extra+comment>dir.byteLength)throw Error('The ZIP directory is damaged.');
  const raw=decoder.decode(dir.subarray(p+46,p+46+nameLen)),entry:ArchiveEntry={index:i,path:raw.replace(/\\/g,'/'),size:d.getUint32(p+24,true),compressed:d.getUint32(p+20,true),offset:d.getUint32(p+42,true),method:d.getUint16(p+10,true),flags:d.getUint16(p+8,true),crc:d.getUint32(p+16,true)};
  if(entry.size===0xffffffff||entry.compressed===0xffffffff||entry.offset===0xffffffff)throw Error('ZIP64 entries are not supported.');
  if(entry.offset+30>cdOffset)throw Error('A ZIP entry points outside the archive.');
  const unsafe=unsafeReason(raw);if(unsafe)entry.unsafe=unsafe;entries.push(entry);p+=46+nameLen+extra+comment;
 }
 const seen=new Map<string,number>(),lower=new Map<string,Set<string>>();for(const e of entries){seen.set(e.path,(seen.get(e.path)||0)+1);const k=e.path.toLowerCase();if(!lower.has(k))lower.set(k,new Set());lower.get(k)!.add(e.path);}
 return {version:1,size,cdOffset,cdSize,entries,duplicates:[...seen].filter(([,n])=>n>1).map(([path])=>path),caseCollisions:[...lower.values()].filter(s=>s.size>1).flatMap(s=>[...s])};
}
// The parsed directory is cached next to the original so browsing does not re-read it every time.
export async function archiveDirectory(bucket:ArchiveBucket,projectId:string,key:string){
 const cacheKey='projects/'+projectId+'/archive-directory.json';const cached=await bucket.get(cacheKey);
 if(cached){try{const d=await cached.json<ArchiveDirectory>();if(d.version===1&&Array.isArray(d.entries))return d;}catch{}}
 const directory=await readArchiveDirectory(bucket,key);await bucket.put(cacheKey,JSON.stringify(directory),{httpMetadata:{contentType:'application/json'}});return directory;
}
export function entryKind(directory:ArchiveDirectory,e:ArchiveEntry):FileKind{
 if(e.unsafe)return 'unsafe';if(e.path.endsWith('/'))return 'directory';if(directory.duplicates.includes(e.path))return 'duplicate';
 if(e.flags&1||![0,8].includes(e.method))return 'unsupported';if(e.size>VIEW_LIMIT||e.compressed>VIEW_LIMIT*2)return 'too_large';
 if(BINARY_EXT.test(e.path))return 'binary';if(TEXT_EXT.test(e.path)||!/\.[^/]+$/.test(e.path.split('/').pop()||''))return 'text';return 'unknown';
}
export const KIND_LABEL:Record<FileKind,string>={directory:'Folder',text:'Text source',binary:'Non-text asset (not displayed)',unknown:'Unknown type · checked when opened',too_large:'Over 2 MB · not loaded',unsupported:'Encrypted or unsupported compression · unavailable',unsafe:'Unsafe archive path · unavailable',duplicate:'Duplicate path in ZIP · ambiguous, unavailable'};
export async function readEntryBytes(bucket:ArchiveBucket,key:string,e:ArchiveEntry,limit=VIEW_LIMIT){
 if(e.flags&1)throw Error('This entry is encrypted.');if(![0,8].includes(e.method))throw Error('This entry uses unsupported compression (method '+e.method+').');
 if(e.size>limit)throw Error('This entry is larger than '+Math.round(limit/1048576)+' MB.');
 const header=await range(bucket,key,e.offset,30),h=new DataView(header.buffer,header.byteOffset,30);if(h.getUint32(0,true)!==0x04034b50)throw Error('The ZIP entry header is damaged.');
 const start=e.offset+30+h.getUint16(26,true)+h.getUint16(28,true),data=await range(bucket,key,start,e.compressed);
 let plain:Uint8Array;try{plain=e.method===0?data:inflateSync(data,{out:new Uint8Array(e.size)});}catch{throw Error('The ZIP entry could not be decompressed.');}
 if(plain.byteLength!==e.size)throw Error('The ZIP entry size does not match its directory record.');if(crc32(plain)!==e.crc)throw Error('The ZIP entry failed its CRC-32 integrity check.');return plain;
}
export function decodeText(bytes:Uint8Array){if(bytes.includes(0))return null;try{return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{return null;}}
export type OriginalFile={path:string;size:number;text:string;sha256:string;lines:number};
// Loads complete original text or explains exactly why it is unavailable.
export async function readOriginalText(bucket:ArchiveBucket,key:string,directory:ArchiveDirectory,path:string):Promise<{file?:OriginalFile;kind:FileKind;reason?:string}>{
 const matches=directory.entries.filter(e=>e.path===path);if(!matches.length)return {kind:'unknown',reason:'This path is not in the stored ZIP.'};
 const e=matches[0],kind=entryKind(directory,e);if(['directory','unsafe','duplicate','unsupported','too_large'].includes(kind))return {kind,reason:KIND_LABEL[kind]};
 let bytes;try{bytes=await readEntryBytes(bucket,key,e);}catch(error){return {kind:'unsupported',reason:error instanceof Error?error.message:'Unreadable entry.'};}
 const text=decodeText(bytes);if(text===null)return {kind:'binary',reason:'Not UTF-8 text (binary or a different encoding); not displayed.'};
 return {kind:'text',file:{path,size:e.size,text,sha256:await sha256(bytes),lines:text?text.split('\n').length:0}};
}
export function safeNewPath(path:string){return typeof path==='string'&&path.length>0&&path.length<=240&&!unsafeReason(path)&&!path.endsWith('/')&&path.split('/').every(s=>s&&s!=='.'&&s!=='..'&&!/[<>:"|?*\x00-\x1f]/.test(s));}
const PART=8*1024*1024;
class PartWriter{
 private buf=new Uint8Array(PART);private fill=0;private parts:R2UploadedPart[]=[];total=0;
 constructor(private upload:R2MultipartUpload){}
 async write(data:Uint8Array){let o=0;while(o<data.length){const take=Math.min(PART-this.fill,data.length-o);this.buf.set(data.subarray(o,o+take),this.fill);this.fill+=take;o+=take;if(this.fill===PART)await this.flush();}this.total+=data.length;if(this.total>PROJECT_LIMIT)throw Error('The corrected ZIP would exceed 500 MB.');}
 private async flush(){if(!this.fill)return;this.parts.push(await this.upload.uploadPart(this.parts.length+1,this.buf.slice(0,this.fill)));this.fill=0;}
 async finish(){await this.flush();return this.upload.complete(this.parts);}
}
function dosTime(date=new Date()){return {time:(date.getHours()<<11)|(date.getMinutes()<<5)|(date.getSeconds()>>1),date:((date.getFullYear()-1980)<<9)|((date.getMonth()+1)<<5)|date.getDate()};}
function header(sig:number,fields:[number,number][],tail:Uint8Array[]){const len=4+fields.reduce((s,[b])=>s+b,0),out=new Uint8Array(len+tail.reduce((s,t)=>s+t.length,0)),v=new DataView(out.buffer);v.setUint32(0,sig,true);let p=4;for(const [bytes,value] of fields){if(bytes===2)v.setUint16(p,value,true);else v.setUint32(p,value>>>0,true);p+=bytes;}for(const t of tail){out.set(t,p);p+=t.length;}return out;}
export type PackageResult={size:number;entries:number;replaced:string[];added:string[];unchanged:number};
// Builds a NEW archive: unchanged entries are copied byte-for-byte from the original,
// approved replacements are re-encoded, and a fresh central directory is written.
export async function buildCorrectedZip(bucket:ArchiveBucket,sourceKey:string,outKey:string,replacements:Map<string,string>,additions:{path:string;text:string}[]):Promise<PackageResult>{
 const directory=await readArchiveDirectory(bucket,sourceKey);
 if(directory.entries.some(e=>e.unsafe))throw Error('The original ZIP contains unsafe paths, so a corrected copy cannot be packaged safely: '+directory.entries.filter(e=>e.unsafe).slice(0,5).map(e=>e.path+' ('+e.unsafe+')').join(', '));
 for(const path of replacements.keys()){const matches=directory.entries.filter(e=>e.path===path);if(matches.length!==1)throw Error(matches.length?'Approved path appears more than once in the ZIP: '+path:'Approved path is not in the original ZIP: '+path);const e=matches[0];if(e.flags&1||![0,8].includes(e.method))throw Error('Approved path cannot be replaced (encrypted or unsupported entry): '+path);}
 const existing=new Set(directory.entries.map(e=>e.path.toLowerCase()));for(const a of additions){if(!safeNewPath(a.path))throw Error('Invalid new file path: '+a.path);if(existing.has(a.path.toLowerCase()))throw Error('New file collides with an existing ZIP entry: '+a.path);existing.add(a.path.toLowerCase());}
 if(directory.entries.length+additions.length>65534)throw Error('The corrected ZIP would have too many entries.');
 const sorted=[...directory.entries].sort((a,b)=>a.offset-b.offset);for(let i=1;i<sorted.length;i++)if(sorted[i].offset<=sorted[i-1].offset)throw Error('The original ZIP has overlapping entries and cannot be repackaged.');
 const cd=await range(bucket,sourceKey,directory.cdOffset,directory.cdSize),records:Uint8Array[]=[];let p=0;
 for(let i=0;i<directory.entries.length;i++){const v=new DataView(cd.buffer,cd.byteOffset+p);const len=46+v.getUint16(28,true)+v.getUint16(30,true)+v.getUint16(32,true);records.push(cd.slice(p,p+len));p+=len;}
 const head=await bucket.head(sourceKey);if(!head)throw Error('The stored archive is unavailable.');const eocdTail=await range(bucket,sourceKey,directory.cdOffset+directory.cdSize,head.size-directory.cdOffset-directory.cdSize);
 const ev=new DataView(eocdTail.buffer,eocdTail.byteOffset,eocdTail.byteLength);let eocd=-1;for(let i=0;i+22<=eocdTail.byteLength;i++)if(ev.getUint32(i,true)===0x06054b50&&i+22+ev.getUint16(i+20,true)===eocdTail.byteLength){eocd=i;break;}
 const archiveComment=eocd>=0?eocdTail.slice(eocd+22):new Uint8Array();
 const upload=await bucket.createMultipartUpload(outKey,{httpMetadata:{contentType:'application/zip'}}),out=new PartWriter(upload),newOffset=new Map<number,number>(),newRecord=new Map<number,Uint8Array>(),stamp=dosTime(),encoder=new TextEncoder();
 const encode=(text:string)=>{const plain=encoder.encode(text),packed=deflateSync(plain,{level:6}),stored=packed.length>=plain.length;return {plain,data:stored?plain:packed,method:stored?0:8,crc:crc32(plain)};};
 try{
  if(sorted.length&&sorted[0].offset>0)await copy(0,sorted[0].offset);else if(!sorted.length&&directory.cdOffset>0)await copy(0,directory.cdOffset);
  for(let i=0;i<sorted.length;i++){
   const e=sorted[i],end=i+1<sorted.length?sorted[i+1].offset:directory.cdOffset;newOffset.set(e.index,out.total);
   const text=replacements.get(e.path);if(text===undefined){await copy(e.offset,end);continue;}
   const rec=records[e.index],rv=new DataView(rec.buffer,rec.byteOffset,rec.byteLength),nameLen=rv.getUint16(28,true),extraLen=rv.getUint16(30,true),commentLen=rv.getUint16(32,true),name=rec.slice(46,46+nameLen),comment=rec.slice(46+nameLen+extraLen,46+nameLen+extraLen+commentLen);
   const flags=(rv.getUint16(8,true)&0x0800),enc=encode(text);
   await out.write(header(0x04034b50,[[2,20],[2,flags],[2,enc.method],[2,stamp.time],[2,stamp.date],[4,enc.crc],[4,enc.data.length],[4,enc.plain.length],[2,name.length],[2,0]],[name]));await out.write(enc.data);
   newRecord.set(e.index,header(0x02014b50,[[2,rv.getUint16(4,true)],[2,20],[2,flags],[2,enc.method],[2,stamp.time],[2,stamp.date],[4,enc.crc],[4,enc.data.length],[4,enc.plain.length],[2,name.length],[2,0],[2,comment.length],[2,0],[2,rv.getUint16(36,true)],[4,rv.getUint32(38,true)],[4,newOffset.get(e.index)!]],[name,comment]));
  }
  const added:Uint8Array[]=[];
  for(const a of additions){const name=encoder.encode(a.path),enc=encode(a.text),offset=out.total;
   await out.write(header(0x04034b50,[[2,20],[2,0x0800],[2,enc.method],[2,stamp.time],[2,stamp.date],[4,enc.crc],[4,enc.data.length],[4,enc.plain.length],[2,name.length],[2,0]],[name]));await out.write(enc.data);
   added.push(header(0x02014b50,[[2,20],[2,20],[2,0x0800],[2,enc.method],[2,stamp.time],[2,stamp.date],[4,enc.crc],[4,enc.data.length],[4,enc.plain.length],[2,name.length],[2,0],[2,0],[2,0],[2,0],[4,0],[4,offset]],[name]));}
  const cdStart=out.total;
  for(let i=0;i<records.length;i++){const replaced=newRecord.get(i);if(replaced){await out.write(replaced);continue;}const rec=records[i].slice();new DataView(rec.buffer).setUint32(42,newOffset.get(i)!,true);await out.write(rec);}
  for(const r of added)await out.write(r);
  const cdLength=out.total-cdStart,count=records.length+added.length;if(out.total>0xfffffff0)throw Error('The corrected ZIP would need ZIP64.');
  await out.write(header(0x06054b50,[[2,0],[2,0],[2,count],[2,count],[4,cdLength],[4,cdStart],[2,archiveComment.length]],[archiveComment]));
  await out.finish();
  return {size:out.total,entries:count,replaced:[...replacements.keys()],added:additions.map(a=>a.path),unchanged:records.length-replacements.size};
 }catch(error){try{await upload.abort();}catch{}throw error;}
 async function copy(start:number,end:number){for(let at=start;at<end;at+=PART)await out.write(await range(bucket,sourceKey,at,Math.min(PART,end-at)));}
}
