import * as auth from '../lib/brain-auth.mjs';
import {PUTNAM,putnamStatus,verifyPutnamOnce} from '../lib/brain-gis-putnam.mjs';

const preview='https://deploy-preview-454--pricepocketasset.netlify.app';
const reply=(status,data)=>Response.json(data,{status,headers:{
 'Cache-Control':'private, no-store','Vary':'Cookie','X-Robots-Tag':'noindex'
}});

export function createHandler(store,options={}){
 return async(req,context)=>{
  const url=new URL(req.url);
  if(context?.deploy?.context!=='deploy-preview'||url.origin!==preview||!store.isBrainPreview())
   return reply(404,{error:'PR #454 preview only'});
  if(!['GET','POST'].includes(req.method))return reply(405,{error:'GET or POST only'});
  try{
   const user=await store.userFromCookie(req.headers.get('cookie')||'');
   if(!user?.owner)return reply(user?403:401,{error:'Owner access required'});
   const storage={read:store.kvGetVersioned,write:store.kvPutVersioned};
   if(req.method==='GET')return reply(200,await putnamStatus(storage,options.now,{
    includeGeometry:url.searchParams.get('geometry')==='1'
   }));
   if(req.headers.get('origin')!==preview)return reply(403,{error:'Invalid origin'});
   // Compare the small confirmation payload exactly. The client cannot supply an upstream URL or query.
   const expected=JSON.stringify({confirmed:true,requestId:PUTNAM.requestId});
   const reader=req.body?.getReader();
   let received='';
   if(reader)for(;;){
    const {value,done}=await reader.read();
    if(done)break;
    if(value.byteLength>expected.length-received.length){await reader.cancel();return reply(400,{error:'Invalid confirmation'});}
    received+=Buffer.from(value).toString('utf8');
   }
   if(received!==expected)return reply(400,{error:'Exact owner confirmation required'});
   return reply(200,await verifyPutnamOnce(storage,options));
  }catch(error){
   if(error.code==='quota_reached'||error.code==='quota_busy')return reply(409,{error:'GIS quota unavailable'});
   return reply(503,{error:'Verification status unavailable. Reload to check the saved checkpoint.'});
  }
 };
}

const handler=createHandler(auth);
export default auth.withBrainStore(handler);
