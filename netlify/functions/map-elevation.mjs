// Cached map elevation. This endpoint only reads saved public elevation metadata.
import * as auth from '../lib/auth.mjs';
const json=(code,b)=>new Response(JSON.stringify(b),{status:code,headers:{'Content-Type':'application/json','Cache-Control':'public,max-age=900','X-Content-Type-Options':'nosniff'}});
export default async req=>{
 if(req.method!=='GET')return json(405,{ok:false,error:'GET only'});
 const u=new URL(req.url);
 const dataset=u.searchParams.get('dataset')||'',record=u.searchParams.get('record')||'';
 if(!/^[A-Za-z0-9_-]{2,80}$/.test(dataset)||!record||record.length>230)return json(400,{ok:false,error:'Invalid parcel selection'});
 try{
  const cache=await auth.kvGet('topo-elevation-v1-'+dataset);
  const found=cache?.records?.[record];
  if(!found)return json(200,{ok:true,found:false});
  return json(200,{ok:true,found:true,meters:found.meters,feet:Math.round(found.meters*3.28084),dataset:found.dataset,source:found.source,checkedAt:found.checkedAt,approximate:true});
 }catch{return json(503,{ok:false,error:'Elevation cache unavailable'});}
};
