// Owner-reviewed retry recovery. Re-arm exactly the same failing parcel.
// Never skip the cursor, change GIS quota, modify map geometry, or publish.
import * as auth from '../lib/brain-auth.mjs';
const KEY='owner-brain-wayne-worker-v1';
const response=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'private,no-store','Vary':'Cookie','X-Robots-Tag':'noindex,nofollow'}});
async function handler(req,context){
 if(req.method!=='GET'&&req.method!=='POST')return response(405,{ok:false,error:'GET or POST only'});
 if(!['deploy-preview','production'].includes(context?.deploy?.context||''))return response(404,{ok:false,error:'Published site or preview only'});
 const owner=await auth.userFromCookie(req.headers.get('cookie')||'');
 if(!owner?.owner)return response(owner?403:401,{ok:false,error:'Owner only'});
 const worker=await auth.kvGet(KEY);
 const retry=worker?.retry;
 if(req.method==='GET')return response(200,{ok:true,exhausted:retry?.exhausted===true,
  parcelId:retry?.parcelId||null,cursor:Number(worker?.cursor||0),attempts:Number(retry?.attempts||0),
  lastError:retry?.lastError||null,dailyUsed:Number(worker?.dailyUsed||0),dailyLimit:30});
 if(req.headers.get('origin')!==new URL(req.url).origin)return response(403,{ok:false,error:'Invalid origin'});
 let action;try{const raw=await req.text();if(raw.length>250)throw Error();action=JSON.parse(raw);}catch{return response(400,{ok:false,error:'Invalid request'})}
 if(action?.action!=='rearm-exhausted-parcel'||action.confirmed!==true)return response(400,{ok:false,error:'Explicit re-arm confirmation required'});
 if(!retry?.exhausted)return response(409,{ok:false,error:'No exhausted parcel requires owner review'});
 if(action.parcelId!==retry.parcelId||action.cursor!==worker.cursor||action.cursor!==retry.cursor)
  return response(409,{ok:false,error:'Worker changed; refresh before re-arming'});
 if(worker?.lockedUntil&&Date.parse(worker.lockedUntil)>Date.now())
  return response(409,{ok:false,error:'Batch already running; retry after it finishes'});
 const control=await auth.kvGet('owner-brain-scanner-v1');
 if(control?.status==='paused')return response(409,{ok:false,error:'Automation paused'});
 // The quota is never reset by owner review. A new batch must obey daily cap.
 const updated={...worker,state:'idle',retry:null,
  lastOwnerRecovery:{at:new Date().toISOString(),parcelId:retry.parcelId,cursor:retry.cursor,
   exhaustedAttempts:retry.attempts,reason:retry.lastError||null,action:'rearmed_same_parcel'}};
 await auth.kvPut(KEY,updated);
 return response(200,{ok:true,rearmed:true,parcelId:retry.parcelId,cursor:updated.cursor,
  dailyUsed:Number(updated.dailyUsed||0),dailyLimit:30,message:'Same parcel re-armed; no request or publication performed'});
}
export default auth.withBrainStore(handler);
