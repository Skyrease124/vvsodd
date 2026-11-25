// Owner-only read-only county agent progress. No paid AI, GIS API, or parcel writes.
// The county sequence is shared with scheduled Photon and Geoapify workers.
import * as auth from '../lib/brain-auth.mjs';
import {activeCounty} from '../lib/brain-county-sequence.mjs';
const ROOT='https://pricepocketasset.com';
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Cookie','X-Robots-Tag':'noindex, nofollow'}});
async function read(path,max=12000000){
 const r=await fetch(ROOT+path,{signal:AbortSignal.timeout(9000)});
 if(!r.ok)throw Error('Map data HTTP '+r.status);
 const body=await r.text();
 if(Buffer.byteLength(body)>max)throw Error('Map data exceeds limit');
 return JSON.parse(body);
}
async function handler(req){
 if(req.method!=='GET')return json(405,{ok:false,error:'GET only'});
 const user=await auth.userFromCookie(req.headers.get('cookie')||'');
 if(!user?.owner)return json(user?403:401,{ok:false,error:'Owner access required'});
 try{
  const index=await read('/map/index.json',8000000);
  const active=await activeCounty(index,auth,d=>read('/map/data/'+d.file));
  const d=active.dataset;
  if(!d)return json(200,{ok:true,complete:true,orderTotal:active.orderTotal,preview:auth.isBrainPreview()});
  const [queue,approvals,history,photon,geo,publication,automatic]=await Promise.all([
   'owner-brain-scanner-v1','owner-brain-approvals-v1','brain-map-history-v1',
   'owner-brain-photon-status-v1','owner-brain-geoapify-status-v1',
   'brain-map-publication-status-v1','owner-brain-automatic-status-v1'].map(auth.kvGet));
  const cases=(queue?.queue||[]).filter(x=>x.dataset===d.id);
  const entries=(approvals?.entries||[]).filter(x=>x.dataset===d.id);
  const published=(history?.entries||[]).filter(x=>x.dataset===d.id&&x.action==='published').length;
  const inStaging=entries.filter(x=>x.decision==='approved_for_staging'&&x.publishStatus!=='published').length;
  const manual=cases.filter(x=>x.verification?.status==='needs_review'||x.review?.decision==='rejected').length;
  const state=queue?.status==='paused'?'paused':active.blocked?'blocked_connector':automatic?.state==='error'?'agent_error':'active';
  return json(200,{ok:true,preview:auth.isBrainPreview(),state,
   current:{id:d.id,state:d.state,county:d.county,position:active.orderPosition,total:active.orderTotal,
    records:d.records,baselineMapped:d.mapped,verifiedCorrections:active.verifiedCorrections,
    estimatedRemaining:active.remaining,connectorAvailable:!active.blocked,blocker:active.blocker},
   queue:{cases:cases.length,needsReview:manual,staged:inStaging,publishedHistory:published,paused:queue?.status==='paused'},
   agents:{
    official:{state:automatic?.state||'not_started',checked:automatic?.checked||0,lastCompleted:automatic?.lastCompleted||null},
    photon:{state:photon?.state||'not_started',checked:photon?.checked||0,activeCounty:photon?.activeCounty||null,lastCompleted:photon?.lastCompleted||null},
    geoapify:{state:geo?.state||'not_started',checked:geo?.checked||0,activeCounty:geo?.activeCounty||null,lastCompleted:geo?.lastCompleted||null},
    publisher:{state:publication?.state||'not_started',published:publication?.published||0,lastCompleted:publication?.lastCompleted||null}
   },
   note:'Address candidates never count as verified map corrections. Counts reflect a baseline and saved verified correction candidates; the county advances only after full per-record reconciliation.'});
 }catch(e){return json(503,{ok:false,error:'County progress temporarily unavailable',detail:String(e.message||e).slice(0,100)});}
}
export default auth.withBrainStore(handler);
