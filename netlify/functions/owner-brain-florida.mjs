// Owner-confirmed Florida Property API exact ID lookup. Private review candidate only.
import * as auth from '../lib/auth.mjs';
import * as KEYS from '../lib/apikeys.mjs';
import * as RL from '../lib/ratelimit.mjs';
const STORE='owner-brain-scanner-v1';
const j=(code,data)=>new Response(JSON.stringify(data),{status:code,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Cookie','X-Robots-Tag':'noindex'}});
const norm=s=>String(s??'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const trim=(s,n=200)=>String(s??'').slice(0,n);
export default async function handler(req){
 if(req.method!=='POST')return j(405,{ok:false,error:'POST only'});
 const me=await auth.userFromCookie(req.headers.get('cookie')||'');
 if(!me?.owner)return j(me?403:401,{ok:false,error:'Owner only'});
 if(req.headers.get('origin')!==new URL(req.url).origin)return j(403,{ok:false,error:'Invalid origin'});
 let body;try{const s=await req.text();if(s.length>500)throw Error();body=JSON.parse(s)}catch{return j(400,{ok:false,error:'Invalid request'})}
 if(body.action!=='florida-lookup'||body.confirmed!==true||typeof body.dataset!=='string'||typeof body.recordId!=='string')return j(400,{ok:false,error:'Confirm a specific parcel lookup'});
 const q=await auth.kvGet(STORE);
 if(!q?.queue||q.status==='paused')return j(409,{ok:false,error:'Queue empty or paused'});
 const r=q.queue.find(x=>x.dataset===body.dataset&&x.recordId===body.recordId);
 if(!r)return j(404,{ok:false,error:'Case not found'});
 if(r.state!=='FL')return j(400,{ok:false,error:'Florida parcels only'});
 if(r.florida?.status==='candidate_found')return j(200,{ok:true,match:r.florida,cached:true});
 const county=trim(r.county,80).replace(/\s+County$/i,'').toLowerCase().replace(/[^a-z]/g,'');
 const id=trim(r.parcelId,100);
 if(!/^[a-z]{3,40}$/.test(county)||!id||!/^[a-z0-9.\- ]{4,100}$/i.test(id))return j(422,{ok:false,error:'Missing supported county or parcel ID'});
 await KEYS.load(true);
 const key=KEYS.keyOf('FLORIDA_PROPERTY_API_KEY');
 if(!key)return j(409,{ok:false,error:'Save the Florida Property API key in Owner API Keys first'});
 // Pilot budget is fixed at 10 REST attempts total, including failed attempts. Never retry or top up.
 if(!(await RL.hit('owner-brain-fpapi-trial-total-v1',10,365*86400000)).ok)return j(429,{ok:false,error:'Florida API pilot cap reached (10 total attempts). No credits purchased.'});
 if(!(await RL.hit('owner-brain-fpapi-trial-minute-v1',2,60000)).ok)return j(429,{ok:false,error:'Wait a minute before another Florida lookup'});
 const params=new URLSearchParams({county,parcel_id:id});
 let match;
 try{
  const res=await fetch('https://api.floridapropertyapi.com/v1/parcels/by-parcel-id?'+params,{headers:{'X-API-Key':key},signal:AbortSignal.timeout(13000)});
  if(res.status===404){match={status:'no_exact_match',verified:false,parcelId:id,sourceUrl:'https://www.floridapropertyapi.com/docs/endpoints/parcel-by-id',foundAt:new Date().toISOString(),note:'No exact matching county + parcel ID returned. No location inferred.'};}
  else if(!res.ok)return j(502,{ok:false,error:'Florida Property API returned HTTP '+res.status+(res.status===402?' — free-trial credits may have expired.':'')});
  else{
   const data=await res.json(),p=data?.data;
   if(!p||norm(p.parcel_id)!==norm(id)||norm(p.county_slug)!==norm(county))return j(422,{ok:false,error:'API response did not exactly match county and parcel ID. No data saved.'});
   const lat=Number(p.centroid_lat),lng=Number(p.centroid_lng);
   const valid=Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=24&&lat<=32&&lng>=-88&&lng<=-79;
   const geo=p.geometry; let geometryPresent=false;
   try{const parsed=typeof geo==='string'?JSON.parse(geo):geo;geometryPresent=!!parsed&&['Polygon','MultiPolygon'].includes(parsed.type)&&Array.isArray(parsed.coordinates);}catch{}
   match={status:'candidate_found',verified:false,parcelId:id,matchedId:trim(p.parcel_id,100),county:trim(p.county_name,80),address:trim(p.site_address_full,130),city:trim(p.site_city,80),landUse:trim(p.land_use_description,100),centroid:valid?{lat,lng}:null,geometryPresent,sourceUrl:'https://www.floridapropertyapi.com/docs/endpoints/parcel-by-id',sourceType:'Third-party FDOR-derived parcel index; verify with county property appraiser',foundAt:new Date().toISOString(),note:'Candidate only. No parcel boundaries or coordinates were written to any map.'};
  }
 }catch(e){return j(502,{ok:false,error:'Florida Property API request failed. No parcel data changed.'})}
 const latest=await auth.kvGet(STORE);if(!latest?.queue||latest.status==='paused')return j(409,{ok:false,error:'Queue changed; result not saved'});
 const target=latest.queue.find(x=>x.dataset===body.dataset&&x.recordId===body.recordId);
 if(!target)return j(409,{ok:false,error:'Case removed; result not saved'});
 target.florida=match;target.status=match.status==='candidate_found'?'florida_candidate_unverified':target.status;
 latest.updatedAt=new Date().toISOString();await auth.kvPut(STORE,latest);
 return j(200,{ok:true,match});
}
