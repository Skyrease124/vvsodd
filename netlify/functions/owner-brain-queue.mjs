// Owner-only, read-only first-stage brain queue. No AI calls, parcel writes, or public publication.
// Explicit scan creates up to 50 missing-position cases, saved in Netlify Blobs.
import * as auth from '../lib/auth.mjs';
const ROOT='https://pricepocketasset.com';
const STORE='owner-brain-scanner-v1';
const LIMIT=50;
const json=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Cookie','X-Robots-Tag':'noindex','X-Content-Type-Options':'nosniff'}});
const str=(s,n=180)=>String(s??'').slice(0,n);
async function readStatic(path,maxBytes){
 const response=await fetch(ROOT+path,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(9500)});
 if(!response.ok)throw new Error('Published map file is unavailable');
 const raw=await response.text();
 if(Buffer.byteLength(raw,'utf8')>maxBytes)throw new Error('Published map file exceeds safety limit');
 return JSON.parse(raw);
}
const empty=()=>({status:'idle',built:null,createdAt:null,updatedAt:null,processed:0,queue:[],nextDataset:0,lastError:null});
async function snapshot(){const value=await auth.kvGet(STORE);return value&&Array.isArray(value.queue)?value:empty();}
export default async function handler(req){
 if(req.method!=='GET'&&req.method!=='POST')return json(405,{ok:false,error:'Method not allowed'});
 const user=await auth.userFromCookie(req.headers.get('cookie')||'');
 if(!user)return json(401,{ok:false,error:'Owner sign-in required'});
 if(!user.owner)return json(403,{ok:false,error:'Owner access only'});
 if(req.method==='GET')return json(200,{ok:true,...await snapshot(),automation:(await auth.kvGet('owner-brain-automatic-status-v1'))||{state:'awaiting_first_run',runs:0,checked:0},geocodeAutomation:(await auth.kvGet('owner-brain-geocode-status-v1'))||{state:'awaiting_first_run',runs:0,checked:0},elevationAutomation:(await auth.kvGet('owner-brain-topo-status-v1'))||{state:'awaiting_first_run',runs:0,filled:0},crosscheckAutomation:(await auth.kvGet('owner-brain-crosscheck-status-v1'))||{state:'awaiting_first_run',runs:0,candidates:0},photonAutomation:(await auth.kvGet('owner-brain-photon-status-v1'))||{state:'awaiting_first_run',runs:0,checked:0,candidateGroups:0,recent:[]},geoapifyAutomation:(await auth.kvGet('owner-brain-geoapify-status-v1'))||{state:'awaiting_first_run',runs:0,checked:0,found:0,recent:[]}});
 const url=new URL(req.url);
 if(req.headers.get('origin')!==url.origin)return json(403,{ok:false,error:'Invalid request origin'});
 let body={};
 try{const s=await req.text();if(s.length>500)return json(413,{ok:false,error:'Request too large'});body=JSON.parse(s||'{}');}catch{return json(400,{ok:false,error:'Invalid JSON'})}
 const action=body.action;
 if(!['pause','resume'].includes(action))return json(400,{ok:false,error:'Unsupported action'});
 let q=await snapshot();
 if(action==='pause'||action==='resume'){
   q.status=action==='pause'?'paused':'idle';q.updatedAt=new Date().toISOString();await auth.kvPut(STORE,q);
   return json(200,{ok:true,...q});
 }
 if(action==='clear'){
   q=empty();await auth.kvPut(STORE,q);return json(200,{ok:true,...q});
 }
 if(q.status==='paused')return json(409,{ok:false,error:'Scanner is paused. Resume before scanning.'});
 if(q.queue.length>=LIMIT)return json(200,{ok:true,...q,note:'Queue full (50 cases). Review or clear it before another scan.'});
 try{
   const index=await readStatic('/map/index.json',8_000_000);
   const datasets=(index.datasets||[]).filter(d=>/^[A-Z]{2}-[A-Za-z0-9_-]+$/.test(d.id||'')&&/^[A-Za-z0-9_-]+\.json$/.test(d.file||'')&&d.records>d.mapped)
     .sort((a,b)=>(b.records-b.mapped)-(a.records-a.mapped));
   if(q.built!==index.built){q=empty();q.built=index.built||null;}
   const seen=new Set(q.queue.map(r=>r.dataset+'|'+r.recordId));
   const started=Date.now();
   let files=0,added=0;
   // At most three bounded county files and six seconds of active scan per request.
   for(let k=q.nextDataset;k<datasets.length&&files<3&&q.queue.length<LIMIT&&Date.now()-started<6000;k++){
     const d=datasets[k];files++;
     try{
       const ds=await readStatic('/map/data/'+d.file,12_000_000);
       for(const r of ds.recs||[]){
         if(q.queue.length>=LIMIT)break;
         if(r.cx||r.g)continue;
         const recordId=str(r.i,230),parcelId=str(r.p,150);
         if(!recordId&&!parcelId)continue;
         const key=d.id+'|'+recordId;if(seen.has(key))continue;
         q.queue.push({dataset:d.id,state:d.state,county:d.county,recordId,parcelId,taxYear:str(r.ty,10),issue:'Missing published map location / boundary',status:'needs_official_verification',sourceUrls:(d.sources||[]).filter(u=>/^https:\/\//.test(u)).slice(0,2),gisUrl:/^https:\/\//.test(d.gis?.url||'')?d.gis.url:null});
         seen.add(key);added++;
       }
       q.nextDataset=k+1;
     }catch(e){q.lastError='Skipped '+str(d.id,50)+': '+str(e.message,100);q.nextDataset=k+1;}
   }
   q.processed=q.queue.length;q.status='idle';q.createdAt||=new Date().toISOString();q.updatedAt=new Date().toISOString();
   await auth.kvPut(STORE,q);
   return json(200,{ok:true,...q,note:added+' new cases queued from '+files+' county file(s). No AI calls or map changes.'});
 }catch(e){
   console.error('Owner brain scan:',str(e.message,130));
   return json(503,{ok:false,error:'Published map data unavailable. No changes made.'});
 }
};
