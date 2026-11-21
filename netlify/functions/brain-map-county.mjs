import * as auth from '../lib/auth.mjs';
export default async function(req){
 const u=new URL(req.url),dataset=u.searchParams.get('dataset');
 const res=(code,obj)=>new Response(JSON.stringify(obj),{status:code,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(!/^[A-Z]{2}-[a-z0-9_-]{2,80}$/.test(dataset||''))return res(400,{ok:false,error:'Invalid county'});
 if(req.method!=='GET')return res(405,{ok:false,error:'Read-only overlay'});
 const saved=await auth.kvGet('brain-map-county-v1-'+dataset)||{version:0,records:{}};
 return res(200,{ok:true,dataset,version:saved.version,records:saved.records});
}