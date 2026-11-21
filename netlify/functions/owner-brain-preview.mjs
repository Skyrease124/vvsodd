// Phase 6 — strict, read-only map repair dry run.
// No provider API calls, no GitHub writes, no Netlify writes, and no changes to published maps.
import crypto from 'node:crypto';
import * as auth from '../lib/auth.mjs';
const ROOT='https://pricepocketasset.com';
const LEDGER='owner-brain-approvals-v1';
const snap=s=>String(s??'').slice(0,240);
const norm=s=>String(s??'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const result=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Cookie','X-Robots-Tag':'noindex, nofollow'}});
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
async function jsonFile(path,max){
 const r=await fetch(ROOT+path,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(11000)});
 if(!r.ok)throw new Error('Published map data unavailable (HTTP '+r.status+')');
 const raw=await r.text();
 if(Buffer.byteLength(raw,'utf8')>max)throw new Error('Map data exceeds maximum read size');
 return {data:JSON.parse(raw),sha256:hash(raw),bytes:Buffer.byteLength(raw,'utf8')};
}
export default async function handler(req){
 if(req.method!=='POST')return result(405,{ok:false,error:'POST only'});
 const user=await auth.userFromCookie(req.headers.get('cookie')||'');
 if(!user?.owner)return result(user?403:401,{ok:false,error:'Owner access required'});
 if(req.headers.get('origin')!==new URL(req.url).origin)return result(403,{ok:false,error:'Invalid request origin'});
 let b;try{const s=await req.text();if(s.length>500)throw Error();b=JSON.parse(s)}catch{return result(400,{ok:false,error:'Invalid input'})}
 if(b.action!=='preview'||typeof b.caseKey!=='string'||!(/^[a-f0-9]{28}$/.test(b.caseKey)))return result(400,{ok:false,error:'Select an approved correction'});
 const log=(await auth.kvGet(LEDGER))||{entries:[]};
 const entry=(log.entries||[]).find(x=>x.caseKey===b.caseKey);
 if(!entry)return result(404,{ok:false,error:'Review decision not found'});
 if(entry.decision!=='approved_for_staging'||entry.publishStatus!=='not_published'||!entry.independentlyChecked||!entry.evidenceUrl?.startsWith('https://'))return result(409,{ok:false,error:'Only owner-approved, unpublished corrections with official evidence can be previewed'});
 if(!entry.proposedPosition||!Number.isFinite(entry.proposedPosition.lat)||!Number.isFinite(entry.proposedPosition.lon))return result(409,{ok:false,error:'Approved record lacks a numeric proposed coordinate'});
 try{
   const idx=await jsonFile('/map/index.json',8_000_000);
   const dataset=(idx.data.datasets||[]).find(d=>d.id===entry.dataset&&d.state===entry.state&&d.county===entry.county);
   if(!dataset||!/^[A-Za-z0-9_-]+\.json$/.test(dataset.file||''))return result(409,{ok:false,error:'Approved dataset not found in current published map index'});
   const file=await jsonFile('/map/data/'+dataset.file,12_000_000);
   const rows=(file.data.recs||[]).filter(r=>r.i===entry.recordId&&norm(r.p)===norm(entry.parcelId));
   if(rows.length!==1)return result(409,{ok:false,error:rows.length?'Multiple matching records: manual repair required.':'Source record changed or is missing; approval must be rechecked.'});
   const row=rows[0];
   if(row.cx||row.g)return result(409,{ok:false,error:'This parcel already has map geometry/coordinates. Refusing to overwrite.'});
   if(norm(entry.sourceMatchId)!==norm(entry.parcelId))return result(409,{ok:false,error:'GIS/API source ID no longer matches the approved parcel'});
   const lat=entry.proposedPosition.lat,lon=entry.proposedPosition.lon;
   const region=entry.state==='FL'?{minLat:24,maxLat:32,minLon:-88,maxLon:-79}:entry.state==='MI'?{minLat:41,maxLat:49,minLon:-91,maxLon:-82}:null;
   if(!region||lat<region.minLat||lat>region.maxLat||lon<region.minLon||lon>region.maxLon)return result(409,{ok:false,error:'Proposed coordinates are outside the state safety region'});
   const before={cx:row.cx??null,g:row.g??null,ac:row.ac??null};
   const after={cx:[Number(lon.toFixed(6)),Number(lat.toFixed(6))],g:null,ac:before.ac};
   // Do not invent polygon boundaries; retain existing acreage. This is a proposed POINT only.
   const patch={recordId:entry.recordId,parcelId:entry.parcelId,datasetId:entry.dataset,file:dataset.file,sourceMapIndexBuilt:idx.data.built||null,sourceDatasetHash:file.sha256,originalRecord:before,proposedRecord:after,notes:'Point-only correction preview. No boundary geometry is available from the approved evidence.'};
   return result(200,{ok:true,preview:true,readyForPublication:false,source:{state:entry.state,county:entry.county,parcelId:entry.parcelId,evidenceUrl:entry.evidenceUrl,verifiedBy:'owner',reviewedAt:entry.reviewedAt,provider:entry.sourceProvider},patch,guards:{exactRecordId:true,exactParcelId:true,countyMatches:true,existingGeometryProtected:true,coordinateBoundsChecked:true,sourceFileHashCaptured:true},warning:'DRY RUN ONLY. No records, maps, or approval ledger were modified. A separate, deliberate publishing implementation and independent QA are required.'});
 }catch(e){console.error('Brain preview:',snap(e.message));return result(503,{ok:false,error:'Could not read published map records. No changes made.'});}
}
