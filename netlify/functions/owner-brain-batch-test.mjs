// Preview-only Wayne County live GIS batch test. Read-only, no paid AI calls.
// Samples up to three unmapped Detroit-address parcels, never writes map data.
import * as auth from '../lib/brain-auth.mjs';
import {verifyOfficial,DETROIT_GIS} from '../lib/brain-official-verification.mjs';
const BASE='https://pricepocketasset.com/map/data/MI-wayne.json';
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'}});
async function read(url,max=12000000){
 const response=await (url.startsWith(DETROIT_GIS+'/query?')?auth.fetchWayneGis:fetch)(url,{signal:AbortSignal.timeout(7500)});
 if(!response.ok)throw Error('Source HTTP '+response.status);
 const body=await response.text();
 if(Buffer.byteLength(body)>max)throw Error('Source exceeded safe size');
 const data=JSON.parse(body);
 if(data.error)throw Error('Official GIS error');
 return data;
}
function eligible(r){
 return r?.i&&/^[0-9]{8}\.?$/.test(String(r.p||''))&&!r.g&&!r.cx&&
  /^\s*\d{1,6}\s+[A-Za-z0-9][^,]{2,75},?\s+Detroit\b/i.test(String(r.a||''));
}
async function handler(req,context){
 if(context?.deploy?.context!=='deploy-preview'||!auth.isBrainPreview())return json(404,{ok:false,error:'Preview only'});
 if(req.method!=='POST')return json(405,{ok:false,error:'POST only'});
 const user=await auth.userFromCookie(req.headers.get('cookie')||'');
 if(!user?.owner)return json(user?403:401,{ok:false,error:'Owner access required'});
 if(req.headers.get('origin')!==new URL(req.url).origin)return json(403,{ok:false,error:'Invalid origin'});
 let input;
 try{const raw=await req.text();if(raw.length>250)throw Error();input=JSON.parse(raw);}catch{return json(400,{ok:false,error:'Invalid request'});}
 if(input?.action!=='test-wayne-batch'||input.confirmed!==true)return json(400,{ok:false,error:'Confirmation required'});
 try{
  const ds=await read(BASE);
  const records=(ds.recs||[]).map(r=>{
   const item={...r};for(const [field,dict] of Object.entries(ds.dict||{}))if(item[field]!=null)item[field]=dict[item[field]];
   return item;
  });
  const saved=await auth.kvGet('brain-map-county-v1-MI-wayne')||{records:{}};
  const selected=records.filter(r=>eligible(r)&&!saved.records?.[r.i]).slice(0,3);
  const results=[];
  for(const record of selected){
   const id=String(record.p).replace(/\.$/,'');
   const where="parcel_number IN ('"+id+"','"+id+".')";
   const url=DETROIT_GIS+'/query?'+new URLSearchParams({f:'json',where,
    outFields:'parcel_number,address,object_id',returnGeometry:'true',outSR:'4326',resultRecordCount:'3'});
   try{
    const official=await read(url,1000000);
    const verified=verifyOfficial(record,official.features);
    results.push({recordId:record.i,parcelId:record.p,address:record.a,status:'verified',
     officialObjectId:verified.officialObjectId,checks:verified.checks});
   }catch(e){
    if(e.code==='QUOTA')throw e;
    results.push({recordId:record.i,parcelId:record.p,address:record.a,status:'needs_review',
     reason:String(e.message||e).slice(0,120)});
   }
  }
  return json(200,{ok:true,dryRun:true,county:'Wayne, MI',checkedAt:new Date().toISOString(),
   attempted:results.length,verified:results.filter(x=>x.status==='verified').length,
   needsReview:results.filter(x=>x.status==='needs_review').length,results,
   message:results.length?'Live official GIS batch checked. No preview or production data was modified.':'No eligible unmapped Detroit-address parcels found in source dataset.'});
 }catch(e){return json(e.code==='QUOTA'?429:502,{ok:false,error:String(e.message||e).slice(0,120)});}
}
export default auth.withBrainStore(handler);
