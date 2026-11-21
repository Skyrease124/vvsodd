// Owner-only publication monitor; no geographic writes or API-credit consumption.
import * as auth from '../lib/brain-auth.mjs';
async function handler(req){
 const json=(code,body)=>new Response(JSON.stringify(body),{status:code,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Cookie','X-Robots-Tag':'noindex, nofollow'}});
 if(req.method!=='GET')return json(405,{ok:false,error:'GET only'});
 const user=await auth.userFromCookie(req.headers.get('cookie')||'');
 if(!user?.owner)return json(user?403:401,{ok:false,error:'Owner access only'});
 const status=await auth.kvGet('brain-map-publication-status-v1')||{state:'not_started',runs:0,published:0,skipped:0};
 const history=await auth.kvGet('brain-map-history-v1')||{entries:[]};
 return json(200,{ok:true,status,history:(history.entries||[]).slice(0,75),surfaces:['Public parcel map','Workshop embedded map','Private MapTiler preview'],publicationScope:'Detroit city GIS pilot; verified owner-approved polygons only'});
}

export default auth.withBrainStore(handler);
