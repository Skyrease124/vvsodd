// Owner-confirmed preview activation of the shared Wayne GIS budget.
// No external GIS request is dispatched by this endpoint.
import * as auth from '../lib/brain-auth.mjs';
const KEY='brain-wayne-gis-quota-activation-v1';
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Cookie','X-Robots-Tag':'noindex, nofollow'}});
async function handler(req,context){
 if(context?.deploy?.context!=='deploy-preview'||!auth.isBrainPreview())return json(404,{ok:false,error:'Deploy preview only'});
 if(req.method!=='POST')return json(405,{ok:false,error:'POST only'});
 const user=await auth.userFromCookie(req.headers.get('cookie')||'');
 if(!user?.owner)return json(user?403:401,{ok:false,error:'Owner access required'});
 if(req.headers.get('sec-fetch-site')==='cross-site'||req.headers.get('origin')!==new URL(req.url).origin)
  return json(403,{ok:false,error:'Invalid request origin'});
 let body;try{const raw=await req.text();if(raw.length>250)throw Error();body=JSON.parse(raw)}catch{return json(400,{ok:false,error:'Invalid request'})}
 if(body?.action!=='activate-wayne-gis-quota'||body?.confirmed!==true||body?.scope!=='wayne-preview-pilot')
  return json(400,{ok:false,error:'Explicit pilot confirmation required'});
 const day=new Date().toISOString().slice(0,10);
 const existing=await auth.kvGetVersioned(KEY);
 if(existing?.data?.day){
  const quota=await auth.readWayneGisQuota();
  return json(200,{ok:true,alreadyActivated:true,active:quota.active,resumeAt:quota.resumeAt,dailyLimit:30,dispatched:0});
 }
 const etag=await auth.kvPutVersioned(KEY,{day},null);
 if(!etag)return json(409,{ok:false,error:'Activation changed; refresh status'});
 const quota=await auth.readWayneGisQuota();
 return json(200,{ok:true,activated:true,active:quota.active,resumeAt:quota.resumeAt,dailyLimit:30,dispatched:0});
}
export default auth.withBrainStore(handler);
