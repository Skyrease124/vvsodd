/** Knowledge Core v1: shared, deterministic chunking and vector operations. */
export const EMBEDDING_MODEL='nvidia/nemotron-3-embed-1b';
export const KNOWLEDGE_CATEGORIES=['PROGRAMMING','MATHEMATICS','SCIENCE','ENGINEERING','ARTIFICIAL INTELLIGENCE','RESEARCH'] as const;
export const KNOWLEDGE_EXTENSIONS='pdf docx txt md markdown json jsonl js jsx ts tsx py html htm css c cpp h cs java go rs rb php sql sh yaml yml toml xml csv glsl wgsl'.split(' ');
// 3 MiB on Netlify (6 MB request limit); R2 on Cloudflare needs 5 MiB+ parts.
export const KNOWLEDGE_PART_SIZE=(import.meta.env.VITE_SKYDATA_NETLIFY?3:5)*1024*1024;
export const KNOWLEDGE_MAX_FILE=100*1024*1024;
export type KnowledgeDocument={id:string;owner:string;name:string;size:number;kind:string;category:string;status:string;key:string;upload:string;next_batch:number;units:number;chunks:number;indexed:number;empty_units:number;error:string|null;enabled:number;review:string;created:number;updated:number;lease:string|null;lease_until:number;attempts:number;retry_at:number;metadata:string};
export function chunkText(text:string):{text:string;section:string}[]{
 const paragraphs=text.replace(/\r\n?/g,'\n').split(/\n\s*\n/);const out:{text:string;section:string}[]=[];let section='',buffer='';
 const flush=()=>{if(buffer.trim())out.push({text:buffer.trim(),section});buffer='';};
 for(const paragraph of paragraphs){const p=paragraph.trim();if(!p)continue;
  if(/^(?:#{1,6}\s|chapter\s+\w|section\s+\w)/i.test(p)&&p.length<200){flush();section=p.replace(/^#+\s*/,'');}
  if(buffer.length+p.length>1800)flush();
  if(p.length>1800){flush();for(let start=0;start<p.length;){let end=Math.min(start+1800,p.length);if(end<p.length){const boundary=Math.max(p.lastIndexOf('\n',end),p.lastIndexOf(' ',end));if(boundary>start+900)end=boundary;}out.push({text:p.slice(start,end),section});if(end===p.length)break;start=end-120;}}
  else buffer+=(buffer?'\n\n':'')+p;
 }flush();return out;
}
const stop=new Set('the and that this with from have what which when where how your you for are was were will can does about into there their then than not but has its our they them just could would should'.split(' '));
export function terms(text:string,max=24){const counts=new Map<string,number>();for(const t of text.toLowerCase().match(/[\p{L}\p{N}_]{3,40}/gu)||[]){if(!stop.has(t))counts.set(t,(counts.get(t)||0)+1);}return [...counts].sort((a,b)=>b[1]-a[1]).slice(0,max).map(([t])=>t);}
export function normalizeVector(v:number[]){if(!Array.isArray(v)||v.length<128||v.length>4096||v.some(n=>typeof n!=='number'||!Number.isFinite(n)))throw Error('Embedding provider returned an invalid vector.');const norm=Math.sqrt(v.reduce((s,n)=>s+n*n,0));if(!norm)throw Error('Embedding provider returned an empty vector.');return v.map(n=>n/norm);}
export function vectorBytes(v:number[]){return new Float32Array(v).buffer;}
export function decodeVector(v:ArrayBuffer|number[]){return Array.isArray(v)?Array.from(new Float32Array(new Uint8Array(v).buffer)):Array.from(new Float32Array(v));}
export function cosine(a:number[],b:number[]){return a.length===b.length?a.reduce((s,n,i)=>s+n*b[i],0):-1;}
/** Eight independent random-projection hash tables. Indexed bucket probes bound retrieval memory. */
export function vectorBuckets(vector:number[],probe=false){const result:string[]=[];for(let table=0;table<8;table++){let hash=0;for(let bit=0;bit<8;bit++){let seed=(table*8+bit+1)*2654435761>>>0,sum=0;for(let k=0;k<32;k++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;sum+=vector[seed%vector.length]*((seed&0x80000000)?1:-1);}if(sum>=0)hash|=1<<bit;}result.push(table+':'+hash);if(probe)for(let bit=0;bit<8;bit++)result.push(table+':'+(hash^(1<<bit)));}return result;}
