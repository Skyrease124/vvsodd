import * as auth from '../lib/brain-auth.mjs';
async function handler(req){
 const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'private,no-store'}});
 if(req.method!=='GET')return json(405,{ok:false,error:'GET only'});
 const user=await auth.userFromCookie(req.headers.get('cookie')||'');
 if(!user?.owner)return json(user?403:401,{ok:false,error:'Owner access required'});
 const [queue,decisions,status,sources]=await Promise.all(['owner-brain-scanner-v1','owner-brain-approvals-v1','brain-map-publication-status-v1','brain-source-events-v1'].map(auth.kvGet));
 return json(200,{ok:true,preview:auth.isBrainPreview(),sources:(sources?.entries||[]).length,queued:(queue?.queue||[]).length,verified:(decisions?.entries||[]).filter(e=>e.decision==='approved_for_staging').length,published:status?.published||0,lastCompleted:status?.lastCompleted||null,error:status?.lastError||null,
  scope:'Automatic official polygon verification currently supports Detroit. Other source findings remain research leads until a parcel connector validates them.',
  flow:['Map Coverage gaps','Intelligence source evidence','Brain identity/address/polygon checks','Shared verified correction feed','Public Map, Workshop and MapTiler','Updated coverage']});
}
export default auth.withBrainStore(handler);
