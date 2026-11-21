// Owner-only, intentionally low-volume Photon address discovery.
// Search/autocomplete candidates only; never modify AI queue, GIS matches, or public map.
import crypto from 'node:crypto';
import * as auth from '../lib/auth.mjs';
const json=(code,data)=>new Response(JSON.stringify(data),{status:code,headers:{'Content-Type':'application/json','Cache-Control':'private,no-store','Vary':'Cookie','X-Robots-Tag':'noindex,nofollow'}});
const DAILY_CAP=30,USAGE='photon-owner-search-usage-v1';
const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
export default async function(req){
 if(req.method!=='GET')return json(405,{ok:false,error:'GET only'});
 const me=await auth.userFromCookie(req.headers.get('cookie')||'');
 if(!me?.owner)return json(me?403:401,{ok:false,error:'Owner access required'});
 const url=new URL(req.url),q=clean(url.searchParams.get('q'));
 if(q.length<5||q.length>140||/[<>\x00-\x1f]/.test(q))return json(400,{ok:false,error:'Enter a full street address or location (5–140 characters).'});
 const key='photon-address-cache-v1-'+crypto.createHash('sha256').update(q.toLowerCase()).digest('hex').slice(0,32);
 const cache=await auth.kvGet(key);
 if(cache&&cache.expiresAt>Date.now())return json(200,{ok:true,cached:true,results:cache.results,note:'OpenStreetMap address candidates only — not verified parcel locations or boundaries.'});
 const day=new Date().toISOString().slice(0,10);
 let usage=await auth.kvGet(USAGE)||{day,count:0,last:0};
 if(usage.day!==day)usage={day,count:0,last:0};
 if(usage.count>=DAILY_CAP)return json(429,{ok:false,error:'Photon search budget reached (30 public-service calls/day). Try tomorrow or use a cached search.'});
 if(Date.now()-usage.last<2500)return json(429,{ok:false,error:'Wait a few seconds before starting another Photon search.'});
 usage.count++;usage.last=Date.now();await auth.kvPut(USAGE,usage);
 const endpoint='https://photon.komoot.io/api/?'+new URLSearchParams({q,limit:'5',lang:'en'});
 try{
  const response=await fetch(endpoint,{headers:{'Accept':'application/json','User-Agent':'PricePocketAsset-owner-address-research/1.0 (https://pricepocketasset.com)'},signal:AbortSignal.timeout(8500)});
  if(response.status===429||response.status===403)return json(429,{ok:false,error:'Photon public service refused or throttled the request. No automatic retry.'});
  if(!response.ok)return json(502,{ok:false,error:'Photon public service returned HTTP '+response.status});
  const body=await response.text();if(Buffer.byteLength(body)>150_000)return json(502,{ok:false,error:'Photon response too large'});
  const decoded=JSON.parse(body);
  if(!Array.isArray(decoded.features))return json(502,{ok:false,error:'Unexpected Photon response'});
  const results=decoded.features.slice(0,5).map(f=>{
   const p=f.properties||{},coordinates=f.geometry?.coordinates||[];
   const lon=Number(coordinates[0]),lat=Number(coordinates[1]);
   if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat< -90||lat>90||lon< -180||lon>180)return null;
   const fields=['housenumber','street','name','city','county','state','postcode','country'];
   const values={};for(const f of fields)values[f]=clean(p[f]).slice(0,100);
   return {lat,lon,...values,type:clean(p.type).slice(0,40),osmType:clean(p.osm_type).slice(0,30),osmId:clean(p.osm_id).slice(0,40)};
  }).filter(Boolean);
  await auth.kvPut(key,{results,expiresAt:Date.now()+7*86400000});
  return json(200,{ok:true,cached:false,results,remaining:Math.max(0,DAILY_CAP-usage.count),note:'Photon candidates are not official county GIS matches. No map pins or corrections were created.'});
 }catch{return json(503,{ok:false,error:'Photon search was unavailable. No automatic retry or map changes.'});}
}
