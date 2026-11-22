import * as auth from '../lib/brain-auth.mjs';
import {approveLandReview,importLandBatch,landSummary,LAND_SOURCES} from '../lib/brain-florida-land.mjs';

const preview='https://deploy-preview-454--pricepocketasset.netlify.app';
const response=(status,data)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
const MAX_BYTES=512*1024;

async function boundedJson(req){
 const reader=req.body?.getReader();
 if(!reader)throw Error('Missing request body');
 const chunks=[];
 let length=0;
 for(;;){
  const {value,done}=await reader.read();
  if(done)break;
  length+=value.byteLength;
  if(length>MAX_BYTES){await reader.cancel();throw Error('Request too large');}
  chunks.push(Buffer.from(value));
 }
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function createHandler(store){
 return async(req,context)=>{
  const url=new URL(req.url);
  if(context?.deploy?.context!=='deploy-preview'||url.origin!==preview||!store.isBrainPreview())
   return response(404,{error:'Unavailable in this environment'});
  if(!['GET','POST'].includes(req.method))return response(405,{error:'Method unavailable'});
  try{
   const user=await store.userFromCookie(req.headers.get('cookie')||'');
   if(!user?.owner)return response(user?403:401,{error:'Owner access required'});
   const geoid=url.searchParams.get('geoid');
   if(!/^12\d{3}$/.test(geoid??''))return response(400,{error:'Select a Florida county'});
   const key='brain-florida-land-v1-'+geoid;
   if(req.method==='GET'){
    const existing=await store.kvGet(key);
    const summary=landSummary(existing||{parcels:[],ingested:0,sales:{},receipts:{},skipped:[]});
    return response(200,{...summary,sources:Object.entries(LAND_SOURCES)
      .filter(([,source])=>!source.geoid||source.geoid===geoid).map(([id,source])=>({id,...source}))});
   }
   if(req.headers.get('origin')!==preview)return response(403,{error:'Invalid origin'});
   let body;
   try{body=await boundedJson(req);}catch{return response(400,{error:'Invalid or oversized request'});}
   if(!body||body.confirmed!==true||!['import','approve'].includes(body.action))
    return response(400,{error:'Owner confirmation required'});
   const current=await store.kvGetVersioned(key);
   let next;
   try{
    if(body.action==='import'){
     if(body.batch?.geoid!==geoid||body.batch?.fixture!==false)throw Error('Only approved non-fixture county files may be uploaded');
     next=importLandBatch(current?.data,body.batch).state;
    }else{
     next=approveLandReview(current?.data,{id:body.id,revision:body.revision,reviewToken:body.reviewToken,reviewer:user.email||user.id});
    }
   }catch(error){return response(422,{error:error.message});}
   const saved=await store.kvPutVersioned(key,next,current?.etag??null);
   return saved?response(200,landSummary(next)):response(409,{error:'County data changed. Reload and retry.'});
  }catch{return response(503,{error:'Land discovery storage unavailable'});}
 };
}
const handler=createHandler(auth);
export default auth.withBrainStore(handler);
