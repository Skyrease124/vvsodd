// Owner-only controls for the isolated Deploy Preview. No AI calls.
import * as auth from '../lib/brain-auth.mjs';
import publish from './brain-map-publish-auto.mjs';
const GIS='https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Parcels_Current/FeatureServer/0';
const KEY='brain-map-county-v1-MI-wayne',ID='MI|Wayne|01002263|';
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','X-Robots-Tag':'noindex'}});
async function handler(req,context){
 if(context?.deploy?.context!=='deploy-preview'||!auth.isBrainPreview())return json(404,{ok:false,error:'Preview only'});
 if(!['GET','POST'].includes(req.method))return json(405,{ok:false,error:'GET or POST only'});
 const user=await auth.userFromCookie(req.headers.get('cookie')||'');
 if(!user?.owner)return json(user?403:401,{ok:false,error:'Owner access required'});
 if(req.method==='GET')return json(200,{ok:true,isolated:true,parcelId:'01002263',address:'90 Chandler',deployId:context.deploy.id});
 if(req.headers.get('origin')!==new URL(req.url).origin)return json(403,{ok:false,error:'Invalid origin'});
 let body;try{const raw=await req.text();if(raw.length>500)throw Error();body=JSON.parse(raw);}catch{return json(400,{ok:false,error:'Invalid request'});}
 if(body.confirmed!==true)return json(400,{ok:false,error:'Confirmation required'});
 try{
  if(body.action==='prepare'){
   // Indexed official GIS lookup, followed by exact tax parcel identity check.
   const url=GIS+'/query?'+new URLSearchParams({f:'json',where:'object_id=279374',outFields:'parcel_number,address,object_id',returnGeometry:'true',outSR:'4326'});
   const response=await fetch(url,{signal:AbortSignal.timeout(9000)});
   if(!response.ok)throw Error('Official GIS unavailable');
   const data=await response.json(),f=data.features?.[0];
   if(data.error||data.features?.length!==1||String(f?.attributes?.parcel_number).replace(/\.$/,'')!=='01002263')throw Error('Official parcel identity changed');
   const ring=f.geometry?.rings?.[0];
   if(f.geometry?.rings?.length!==1||!Array.isArray(ring)||ring.length<4||ring.length>6000||!ring.every(p=>Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1])))throw Error('Official polygon unavailable');
   const lon=(Math.min(...ring.map(p=>p[0]))+Math.max(...ring.map(p=>p[0])))/2;
   const lat=(Math.min(...ring.map(p=>p[1]))+Math.max(...ring.map(p=>p[1])))/2;
   const queue=await auth.kvGet('owner-brain-scanner-v1')||{queue:[],status:'idle'};
   if(!queue.queue.some(r=>r.recordId===ID))queue.queue.unshift({dataset:'MI-wayne',recordId:ID,parcelId:'01002263',state:'MI',county:'Wayne',issue:'No verified boundary match',status:'needs_review',detroit:{status:'candidate_found',matchedId:f.attributes.parcel_number,address:f.attributes.address,centroidApprox:{lat,lon},sourceUrl:url,foundAt:new Date().toISOString(),note:'Live official GIS candidate. Owner verification required before approval.'}});
   queue.updatedAt=new Date().toISOString();await auth.kvPut('owner-brain-scanner-v1',queue);
   return json(200,{ok:true,message:'Official candidate ready. Review and approve it in the queue below; no correction published.'});
  }
  if(body.action==='publish'){
   await publish(req,context);
   const saved=await auth.kvGet(KEY);
   return json(200,{ok:true,message:saved?.records?.[ID]?'Verified correction published in this preview.':'No correction published. Check approval and publication status.',status:await auth.kvGet('brain-map-publication-status-v1')});
  }
  if(body.action==='rollback'){
   const saved=await auth.kvGet(KEY);
   if(!saved?.records?.[ID])return json(200,{ok:true,message:'No test correction to reverse.'});
   const records={...saved.records};delete records[ID];const at=new Date().toISOString();
   await auth.kvPut(KEY,{...saved,records,version:saved.version+1,updatedAt:at});
   const history=await auth.kvGet('brain-map-history-v1')||{entries:[]};
   history.entries=[{dataset:'MI-wayne',recordId:ID,parcelId:'01002263',action:'reversed',at},...history.entries].slice(0,300);
   await auth.kvPut('brain-map-history-v1',history);
   return json(200,{ok:true,message:'Preview correction reversed. Open maps refresh within two minutes.'});
  }
  return json(400,{ok:false,error:'Unknown action'});
 }catch(e){return json(502,{ok:false,error:String(e.message).slice(0,180)});}
}
export default auth.withBrainStore(handler);
