// Read-only exact-ID lookup using the City of Detroit Office of Assessor's public parcel dataset.
import * as auth from '../lib/brain-auth.mjs';
import * as RL from '../lib/ratelimit.mjs';
const STORE='owner-brain-scanner-v1';
const LAYER='https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Parcels_Current/FeatureServer/0';
const out=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Cookie','X-Robots-Tag':'noindex'}});
const norm=s=>String(s??'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const small=(s,n=160)=>String(s??'').slice(0,n);
const validId=s=>/^[0-9A-Za-z.-]{4,32}$/.test(s);
const handler=async req=>{
 if(req.method!=='POST')return out(405,{error:'POST only'});
 const me=await auth.userFromCookie(req.headers.get('cookie')||'');
 if(!me?.owner)return out(me?403:401,{error:'Owner only'});
 if(req.headers.get('origin')!==new URL(req.url).origin)return out(403,{error:'Invalid origin'});
 let b;try{const raw=await req.text();if(raw.length>600)throw Error();b=JSON.parse(raw);}catch{return out(400,{error:'Invalid request'});}
 if(b.action!=='detroit-lookup'||!b.confirmed||typeof b.dataset!=='string'||typeof b.recordId!=='string')return out(400,{error:'Confirm a specific Detroit parcel lookup'});
 const q=await auth.kvGet(STORE);
 if(!q?.queue||q.status==='paused')return out(409,{error:'Queue empty or paused'});
 const item=q.queue.find(x=>x.dataset===b.dataset&&x.recordId===b.recordId);
 if(!item)return out(404,{error:'Case not found'});
 if(item.state!=='MI'||!/^(Wayne|Wayne County)$/i.test(item.county))return out(400,{error:'Detroit pilot only'});
 const id=small(item.parcelId,32);
 if(!validId(id))return out(422,{error:'Invalid parcel ID'});
 if(item.detroit?.status==='candidate_found')return out(200,{ok:true,match:item.detroit,cached:true});
 if(!(await RL.hit('owner-brain-detroit-hour-v1',20,3600000)).ok)return out(429,{error:'Detroit pilot limit reached (20/hour)'});
 const qs=new URLSearchParams({f:'json',where:"parcel_number = '"+id+"'",outFields:'parcel_number,address,zip_code,total_acreage,object_id',returnGeometry:'true',outSR:'4326',resultRecordCount:'3'});
 let result;
 try{
  const res=await auth.fetchWayneGis(LAYER+'/query?'+qs,{signal:AbortSignal.timeout(13000)});
  if(!res.ok)throw Error('HTTP '+res.status);
  const payload=await res.json();if(payload.error)throw Error(small(payload.error.message,100));
  const features=Array.isArray(payload.features)?payload.features:[];
  const matches=features.filter(f=>norm(f.attributes?.parcel_number)===norm(id));
  if(matches.length===1&&features.length===1){
   const f=matches[0],rings=f.geometry?.rings;
   const points=Array.isArray(rings)?rings.flat().filter(p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])):[];
   if(points.length<4)throw Error('Geometry missing; no candidate can be staged');
   const lon=points.reduce((a,p)=>a+p[0],0)/points.length,lat=points.reduce((a,p)=>a+p[1],0)/points.length;
   if(lon < -83.4||lon > -82.8||lat < 42.2||lat > 42.5)throw Error('Candidate outside Detroit area');
   result={status:'candidate_found',verified:false,parcelId:id,matchedId:small(f.attributes.parcel_number,40),address:small(f.attributes.address,160),zipCode:small(f.attributes.zip_code,12),acreage:Number.isFinite(f.attributes.total_acreage)?f.attributes.total_acreage:null,centroidApprox:{lat:Number(lat.toFixed(6)),lon:Number(lon.toFixed(6))},sourceUrl:LAYER,sourceType:'City of Detroit Assessor Parcels Current',geometryPoints:points.length,note:'Exact parcel ID matched in City of Detroit assessor data. Approximate point is an average of polygon vertices, not a verified survey centroid. No map edits.',foundAt:new Date().toISOString()};
  }else{
   result={status:matches.length>1?'ambiguous':'no_exact_match',verified:false,parcelId:id,sourceUrl:LAYER,note:'City of Detroit parcel layer returned no unique exact parcel number match; no location inferred.',foundAt:new Date().toISOString()};
  }
 }catch(e){if(e.code==='QUOTA')return out(429,{ok:false,error:e.message});return out(502,{error:'Detroit assessor GIS lookup failed: '+small(e.message,110)})}
 const latest=await auth.kvGet(STORE);
 if(!latest?.queue||latest.status==='paused')return out(409,{error:'Queue changed; candidate not saved'});
 const target=latest.queue.find(x=>x.dataset===b.dataset&&x.recordId===b.recordId);
 if(!target)return out(409,{error:'Case removed'});
 target.detroit=result;target.status=result.status==='candidate_found'?'detroit_candidate_unverified':target.status;
 latest.updatedAt=new Date().toISOString();await auth.kvPut(STORE,latest);
 return out(200,{ok:true,match:result});
};

export default auth.withBrainStore(handler);
