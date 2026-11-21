// Read-only address search for Detroit parcel candidates. Address results are NEVER approvable automatically.
import * as auth from '../lib/auth.mjs';
import * as RL from '../lib/ratelimit.mjs';
const STORE='owner-brain-scanner-v1',LAYER='https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Parcels_Current/FeatureServer/0';
const ROOT='https://pricepocketasset.com';
const j=(code,body)=>new Response(JSON.stringify(body),{status:code,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Cookie','X-Robots-Tag':'noindex'}});
const short=(s,n=150)=>String(s??'').slice(0,n);
const clean=s=>String(s??'').toUpperCase().replace(/[^A-Z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
export default async req=>{
 if(req.method!=='POST')return j(405,{error:'POST only'});
 const owner=await auth.userFromCookie(req.headers.get('cookie')||'');
 if(!owner?.owner)return j(owner?403:401,{error:'Owner only'});
 if(req.headers.get('origin')!==new URL(req.url).origin)return j(403,{error:'Invalid origin'});
 let b;try{const raw=await req.text();if(raw.length>600)throw Error();b=JSON.parse(raw)}catch{return j(400,{error:'Invalid request'})}
 if(b.action!=='address-lookup'||b.confirmed!==true||typeof b.dataset!=='string'||typeof b.recordId!=='string')return j(400,{error:'Select a parcel and confirm address search'});
 const q=await auth.kvGet(STORE);
 if(!q?.queue||q.status==='paused')return j(409,{error:'Queue unavailable or paused'});
 const item=q.queue.find(x=>x.dataset===b.dataset&&x.recordId===b.recordId);
 if(!item||item.state!=='MI'||!/^(Wayne|Wayne County)$/i.test(item.county))return j(404,{error:'Wayne parcel not found'});
 if(item.detroitAddress?.checkedAt)return j(200,{ok:true,match:item.detroitAddress,cached:true});
 if(!(await RL.hit('owner-brain-detroit-address-hour-v1',12,3600000)).ok)return j(429,{error:'Address lookup limit reached (12/hour)'});
 let address;
 try{
  const ds=await fetch(ROOT+'/map/data/MI-wayne.json',{signal:AbortSignal.timeout(11000)});
  if(!ds.ok)throw Error('Dataset unavailable');
  const raw=await ds.text();if(Buffer.byteLength(raw,'utf8')>12_000_000)throw Error('Dataset too large');
  const body=JSON.parse(raw);
  const matches=(body.recs||[]).filter(r=>r.i===item.recordId&&r.p===item.parcelId);
  if(matches.length!==1)throw Error('Source parcel is no longer unique');
  address=short(matches[0].a,180);
 }catch(e){return j(503,{error:'Could not read exact published parcel address. No lookup performed.'})}
 const match=/^\s*(\d{1,6})\s+([a-z][a-z0-9 .'-]{2,65}?),?\s*,?\s*Detroit\b/i.exec(address);
 if(!match)return j(422,{error:'Parcel has no usable Detroit street address for official GIS lookup'});
 const number=match[1],street=clean(match[2]).replace(/\s+(ST|STREET|AVE|AVENUE|RD|ROAD|BLVD|BOULEVARD)$/,'');
 if(!street||street.length<3)return j(422,{error:'Street address incomplete'});
 const sql="address LIKE '%"+number+"%"+street.replace(/ /g,'%')+"%'";
 const params=new URLSearchParams({f:'json',where:sql,outFields:'parcel_number,address,zip_code,object_id',returnGeometry:'false',resultRecordCount:'12'});
 let payload;
 try{
  const response=await fetch(LAYER+'/query?'+params,{signal:AbortSignal.timeout(13000)});
  if(!response.ok)throw Error('GIS HTTP '+response.status);
  payload=await response.json();if(payload.error)throw Error(short(payload.error.message,100));
 }catch(e){return j(502,{error:'Detroit street-address GIS query failed: '+short(e.message,100)})}
 const prefix=number+' '+street;
 const candidates=(payload.features||[]).map(f=>f.attributes||{}).filter(a=>{const aClean=clean(a.address);return aClean===prefix||aClean.startsWith(prefix+' ');}).slice(0,8).map(a=>({parcelId:short(a.parcel_number,60),address:short(a.address,160),zipCode:short(a.zip_code,15)}));
 const result={status:candidates.length?'address_candidates_unverified':'no_address_match',sourceAddress:address,streetSearched:prefix,candidates,sourceUrl:LAYER,checkedAt:new Date().toISOString(),note:candidates.length?'Address candidates only. Parcel number differences must be independently resolved; this is NOT an approved map location.':'No address candidates in this query. No coordinates inferred.',verified:false,approvable:false};
 const latest=await auth.kvGet(STORE);
 const target=latest?.queue?.find(x=>x.dataset===b.dataset&&x.recordId===b.recordId);
 if(!target||latest.status==='paused')return j(409,{error:'Queue changed during lookup'});
 target.detroitAddress=result;latest.updatedAt=new Date().toISOString();await auth.kvPut(STORE,latest);
 return j(200,{ok:true,match:result});
};
