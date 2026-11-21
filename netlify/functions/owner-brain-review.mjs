// Phase 5: owner evidence review and private approval ledger. Does NOT update published maps.
import crypto from 'node:crypto';
import * as auth from '../lib/auth.mjs';
const QUEUE='owner-brain-scanner-v1';
const LEDGER='owner-brain-approvals-v1';
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Cookie','X-Robots-Tag':'noindex, nofollow'}});
const trim=(s,n=500)=>String(s??'').trim().slice(0,n);
const ident=(s)=>trim(s,240);
const norm=(s)=>trim(s,120).toUpperCase().replace(/[^A-Z0-9]/g,'');
const idFor=(d,r)=>crypto.createHash('sha256').update(d+'\n'+r).digest('hex').slice(0,28);
const safeUrl=v=>{try{const u=new URL(v);return u.protocol==='https:'&&u.username===''&&u.password===''&&u.hostname.length>3&&u.href.length<=1000?u.href:null;}catch{return null}};
const summary=r=>({dataset:r.dataset,recordId:r.recordId,state:r.state,county:r.county,parcelId:r.parcelId});
export default async function handler(req){
 if(req.method!=='GET'&&req.method!=='POST')return json(405,{ok:false,error:'GET or POST only'});
 const me=await auth.userFromCookie(req.headers.get('cookie')||'');
 if(!me?.owner)return json(me?403:401,{ok:false,error:'Owner access required'});
 const log=(await auth.kvGet(LEDGER))||{entries:[]};
 if(req.method==='GET')return json(200,{ok:true,entries:(log.entries||[]).slice(-100).reverse()});
 if(req.headers.get('origin')!==new URL(req.url).origin)return json(403,{ok:false,error:'Invalid origin'});
 let b;try{const raw=await req.text();if(raw.length>2200)throw Error();b=JSON.parse(raw)}catch{return json(400,{ok:false,error:'Invalid request'})}
 if(!['approve','reject'].includes(b.action)||typeof b.dataset!=='string'||typeof b.recordId!=='string'||b.confirmed!==true)return json(400,{ok:false,error:'Invalid review request'});
 const q=await auth.kvGet(QUEUE);
 if(!q?.queue||q.status==='paused')return json(409,{ok:false,error:'Queue empty or paused'});
 const r=q.queue.find(x=>x.dataset===b.dataset&&x.recordId===b.recordId);
 if(!r)return json(404,{ok:false,error:'Parcel is not in queue'});
 const candidate=r.state==='FL'?r.florida:(r.state==='MI'&&r.county==='Wayne County'?r.gis:null);
 if(!candidate||candidate.status!=='candidate_found')return json(409,{ok:false,error:'A matching GIS/API candidate is required before review'});
 const matching=r.state==='FL'?candidate.matchedId:candidate.matchedId;
 if(norm(matching)!==norm(r.parcelId))return json(409,{ok:false,error:'Candidate ID does not match queued parcel'});
 const notes=trim(b.notes,1000);
 if(notes.length<15)return json(400,{ok:false,error:'Provide at least 15 characters explaining the review decision'});
 const evidenceUrl=b.action==='approve'?safeUrl(b.evidenceUrl):safeUrl(b.evidenceUrl)||null;
 if(b.action==='approve'&&!evidenceUrl)return json(400,{ok:false,error:'Approval requires an HTTPS official county source URL'});
 if(b.action==='approve'&&b.officialSourceConfirmed!==true)return json(400,{ok:false,error:'Confirm you personally checked the official county source'});
 const candidateLocation=r.state==='FL'?candidate.centroid:candidate.centroidApprox;
 if(b.action==='approve'&&(!candidateLocation||!Number.isFinite(Number(candidateLocation.lat))||!Number.isFinite(Number(candidateLocation.lng??candidateLocation.lon))))return json(409,{ok:false,error:'Candidate has no valid location. Cannot approve a location correction'});
 const key=idFor(r.dataset,r.recordId);
 const prior=(log.entries||[]).find(e=>e.caseKey===key);
 if(prior)return json(409,{ok:false,error:'This case already has a recorded decision. Reviews are immutable in this pilot.'});
 const stamp=new Date().toISOString();
 const entry={caseKey:key,decision:b.action==='approve'?'approved_for_staging':'rejected',...summary(r),reviewedAt:stamp,reviewedBy:'owner',notes,evidenceUrl,independentlyChecked:b.action==='approve',sourceProvider:r.state==='FL'?'Florida Property API':'Wayne County GIS',sourceMatchId:trim(candidate.matchedId,100),proposedPosition:candidateLocation?{lat:Number(candidateLocation.lat),lon:Number(candidateLocation.lng??candidateLocation.lon)}:null,sourceAcreage:r.state==='MI'&&Number.isFinite(candidate.acreage)?candidate.acreage:null,publishStatus:'not_published',sourceSnapshotAt:candidate.foundAt||null};
 log.entries=(log.entries||[]).concat(entry).slice(-250);
 await auth.kvPut(LEDGER,log);
 // The ledger is authoritative; queue state is for convenience only.
 const current=await auth.kvGet(QUEUE);
 const target=current?.queue?.find(x=>x.dataset===r.dataset&&x.recordId===r.recordId);
 if(target){target.review={decision:entry.decision,reviewedAt:stamp,caseKey:key};current.updatedAt=stamp;await auth.kvPut(QUEUE,current);}
 return json(200,{ok:true,entry,notice:'Stored privately; public parcel maps are unchanged.'});
};
