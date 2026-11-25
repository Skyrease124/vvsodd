// Owner-only website control of the published Netlify scheduler.
// Preview may read its own status but cannot change production scheduling.
import * as auth from '../lib/brain-auth.mjs';
const KEY='owner-brain-wayne-scheduler-control-v1';
const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'private,no-store','Vary':'Cookie','X-Robots-Tag':'noindex,nofollow'}});
async function handler(req,context){
 if(req.method!=='GET'&&req.method!=='POST')return reply(405,{ok:false,error:'GET or POST only'});
 const user=await auth.userFromCookie(req.headers.get('cookie')||'');
 if(!user?.owner)return reply(user?403:401,{ok:false,error:'Owner required'});
 const production=context?.deploy?.context==='production'&&context?.deploy?.published===true;
 const current=await auth.kvGet(KEY)||{enabled:false,approvedForProduction:false};
 if(req.method==='GET')return reply(200,{ok:true,production,preview:auth.isBrainPreview(),
  enabled:production&&current.enabled===true&&current.approvedForProduction===true,
  scheduledMinutes:30,updatedAt:current.updatedAt||null,blockedReason:production?null:'Deploy Preview cannot control the production schedule'});
 if(!production)return reply(403,{ok:false,error:'Production owner dashboard only. Preview cannot enable 24/7 processing.'});
 // Browser fetch metadata provides an independent CSRF signal. Older clients
 // may omit it, but a browser explicitly marking cross-site is never trusted.
 if(req.headers.get('sec-fetch-site')==='cross-site')return reply(403,{ok:false,error:'Cross-site request denied'});
 if(req.headers.get('origin')!==new URL(req.url).origin)return reply(403,{ok:false,error:'Invalid request origin'});
 let body;try{const raw=await req.text();if(raw.length>200)throw Error();body=JSON.parse(raw);}catch{return reply(400,{ok:false,error:'Invalid request'});}
 if(!['enable','disable'].includes(body?.action)||body.confirmed!==true)return reply(400,{ok:false,error:'Explicit enable or disable confirmation required'});
 if(body.action==='enable'&&body.scope!=='wayne-verified-gis-only')return reply(400,{ok:false,error:'Only the Wayne official-GIS pilot can be enabled'});
 const enable=body.action==='enable';
 const updated={enabled:enable,approvedForProduction:enable,updatedAt:new Date().toISOString(),updatedBy:'authenticated_site_owner',scope:'wayne-verified-gis-only'};
 await auth.kvPut(KEY,updated);
 return reply(200,{ok:true,production:true,enabled:enable,scheduledMinutes:30,updatedAt:updated.updatedAt});
}
export default auth.withBrainStore(handler);
