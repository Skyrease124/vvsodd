// Background terrain enrichment: scheduled, budget-bounded and read-only for parcel geometry.
// Only published records with stored, valid polygon geometry and centroid are eligible.
// Cached elevation records are visible to maps without requiring a new site deploy.
import * as auth from '../lib/auth.mjs';
const INDEX='https://pricepocketasset.com/map/index.json',BASE='https://pricepocketasset.com/map/data/';
const STATUS='owner-brain-topo-status-v1';
const KEY=d=>'topo-elevation-v1-'+d;
const MAX_DATASETS=3, MAX_POINTS=80;
const allowed=(s)=>/^[A-Za-z0-9_-]+$/.test(s);
const inUS=(lon,lat)=>lat>=18&&lat<=72&&lon>=-180&&lon<=-65;
async function getFile(url,bytes=12_000_000){
 const resp=await fetch(url,{signal:AbortSignal.timeout(7500)});
 if(!resp.ok)throw Error('Source HTTP '+resp.status);
 const raw=await resp.text();if(Buffer.byteLength(raw,'utf8')>bytes)throw Error('Source too large');
 return JSON.parse(raw);
}
async function saveStatus(s){await auth.kvPut(STATUS,s);}
export default async function handler(){
 const start=new Date().toISOString();
 const old=await auth.kvGet(STATUS)||{runs:0,lookups:0,filled:0,nextDataset:0};
 const status={...old,lastStarted:start,state:'running',runs:(old.runs||0)+1,error:null};
 await saveStatus(status);
 try{
  const index=await getFile(INDEX,8_000_000);
  const datasets=(index.datasets||[]).filter(d=>allowed(d.id||'')&&/^[A-Za-z0-9_-]+\.json$/.test(d.file||'')&&d.mapped>0);
  if(!datasets.length){status.state='no_mapped_datasets';return;}
  let attempted=0,filled=0,visited=0;
  for(let k=0;k<datasets.length&&visited<MAX_DATASETS;k++){
   const d=datasets[(status.nextDataset+k)%datasets.length];
   let data;try{data=await getFile(BASE+d.file);}catch(e){status.lastWarning='Skipped '+d.id+': '+e.message;visited++;continue;}
   const stored=await auth.kvGet(KEY(d.id))||{records:{},cursor:0,sourceBuilt:index.built};
   if(stored.sourceBuilt!==index.built){stored.records={};stored.cursor=0;stored.sourceBuilt=index.built;}
   const recs=data.recs||[];
   if(!recs.length){visited++;continue;}
   let idx=stored.cursor%recs.length,checked=0;
   const selected=[];
   while(checked<recs.length&&selected.length<MAX_POINTS){
     const r=recs[idx];
     idx=(idx+1)%recs.length;checked++;
     // Polygon-backed published positions only; do not geocode missing locations.
     if(!r?.i||!Array.isArray(r.cx)||r.cx.length!==2||!Array.isArray(r.g)||!r.g.length||stored.records[r.i])continue;
     const [lon,lat]=r.cx;
     if(!Number.isFinite(lon)||!Number.isFinite(lat)||!inUS(lon,lat))continue;
     selected.push({id:r.i,lat,lon});
   }
   stored.cursor=idx;
   if(!selected.length){visited++;await auth.kvPut(KEY(d.id),stored);continue;}
   // Pre-record per-day usage; even a failed request counts conservatively.
   const day=new Date().toISOString().slice(0,10),usageKey='owner-brain-topo-usage-v1';
   const usage=await auth.kvGet(usageKey)||{day,calls:0};
   if(usage.day!==day){usage.day=day;usage.calls=0;}
   if(usage.calls>=12){status.state='budget_reached';break;}
   usage.calls++;await auth.kvPut(usageKey,usage);
   const loc=selected.map(x=>x.lat+','+x.lon).join('|');
   const url='https://api.opentopodata.org/v1/ned10m?'+new URLSearchParams({locations:loc});
   try{
     const response=await fetch(url,{signal:AbortSignal.timeout(9000)});
     if(response.status===429){status.state='rate_limited';status.lastWarning='Open Topo Data returned HTTP 429';break;}
     if(!response.ok)throw Error('Open Topo Data HTTP '+response.status);
     const payload=await response.json();
     if(payload.status!=='OK'||!Array.isArray(payload.results)||payload.results.length!==selected.length)throw Error('Provider returned incomplete elevation data');
     for(let j=0;j<selected.length;j++){
      const e=payload.results[j],p=selected[j],meters=e?.elevation;
      const returnedLat=Number(e?.location?.lat),returnedLon=Number(e?.location?.lng);
      if(!Number.isFinite(meters)||!Number.isFinite(returnedLat)||!Number.isFinite(returnedLon)||Math.abs(returnedLat-p.lat)>0.00001||Math.abs(returnedLon-p.lon)>0.00001)continue;
      stored.records[p.id]={meters:Number(meters.toFixed(2)),dataset:'ned10m',source:'Open Topo Data / USGS NED',checkedAt:new Date().toISOString(),point:[p.lon,p.lat],status:'approximate_terrain'};
      filled++;
     }
     stored.updatedAt=new Date().toISOString();
     await auth.kvPut(KEY(d.id),stored);
     attempted++;
   }catch(e){status.lastWarning='Elevation for '+d.id+' unavailable: '+String(e.message).slice(0,100);}
   visited++;
  }
  status.nextDataset=datasets.length?(status.nextDataset+visited)%datasets.length:0;
  status.lookups=(status.lookups||0)+attempted;
  status.filled=(status.filled||0)+filled;
  if(status.state==='running')status.state='idle';
  status.lastBatch={datasets:visited,requests:attempted,filled};
 }catch(e){status.state='error';status.error=String(e.message).slice(0,150);}
 finally{status.lastCompleted=new Date().toISOString();await saveStatus(status);}
}
export const config={schedule:'15 */12 * * *'};
