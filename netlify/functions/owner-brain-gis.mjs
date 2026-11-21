// Read-only candidate GIS lookup for the Wayne County, MI pilot. No third-party AI or paid API calls.
import * as auth from '../lib/brain-auth.mjs';
import * as RL from '../lib/ratelimit.mjs';
const STORE='owner-brain-scanner-v1';
const LAYER='https://services1.arcgis.com/b6rkZNtCd6Mx2gvB/ArcGIS/rest/services/Wayne_County_Parcels/FeatureServer/0';
const j=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Cookie','X-Robots-Tag':'noindex'}});
const short=(v,n=200)=>String(v??'').slice(0,n);
function normalized(v){return String(v??'').toUpperCase().replace(/[^A-Z0-9]/g,'');}
async function handler(req){
 if(req.method!=='POST')return j(405,{ok:false,error:'POST only'});
 const me=await auth.userFromCookie(req.headers.get('cookie')||'');
 if(!me?.owner)return j(me?403:401,{ok:false,error:'Owner only'});
 if(req.headers.get('origin')!==new URL(req.url).origin)return j(403,{ok:false,error:'Invalid origin'});
 let body;try{const raw=await req.text();if(raw.length>600)throw Error();body=JSON.parse(raw);}catch{return j(400,{ok:false,error:'Invalid request'})}
 if(body.action!=='gis-lookup'||typeof body.recordId!=='string'||typeof body.dataset!=='string'||body.confirmed!==true)return j(400,{ok:false,error:'Select a case and approve a GIS lookup'});
 const queue=await auth.kvGet(STORE);
 if(!queue?.queue||queue.status==='paused')return j(409,{ok:false,error:'Queue unavailable or paused'});
 const item=queue.queue.find(x=>x.dataset===body.dataset&&x.recordId===body.recordId);
 if(!item)return j(404,{ok:false,error:'Case not found'});
 if(item.state!=='MI'||!/^(Wayne|Wayne County)$/i.test(item.county))return j(400,{ok:false,error:'Phase 3 pilot supports Wayne County, Michigan only; other county connectors are coming.'});
 const id=short(item.parcelId,32);
 if(!/^[0-9A-Za-z.-]{4,32}$/.test(id))return j(422,{ok:false,error:'Parcel identifier is not suitable for exact-match GIS lookup'});
 if(item.gis?.status==='candidate_found')return j(200,{ok:true,match:item.gis,note:'Saved GIS candidate returned; no new lookup used.'});
 if(!(await RL.hit('owner-brain-gis-hour',15,3600000)).ok)return j(429,{ok:false,error:'GIS pilot limit reached (15/hour)'});
 const where="packedParcelNumber = '"+id.replace(/'/g,"''")+"'";
 const params=new URLSearchParams({f:'json',where,outFields:'packedParcelNumber,Area_Ac,propcity,propstreetcombined,OBJECTID',returnGeometry:'true',outSR:'4326',resultRecordCount:'3'});
 let result;
 try{
  const response=await fetch(LAYER+'/query?'+params.toString(),{signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error('GIS endpoint HTTP '+response.status);
  const data=await response.json();
  if(data.error)throw Error(short(data.error.message,80));
  const features=Array.isArray(data.features)?data.features:[];
  const exact=features.filter(f=>normalized(f.attributes?.packedParcelNumber)===normalized(id));
  if(exact.length===1&&features.length===1){
    const f=exact[0],rings=f.geometry?.rings;
    if(!Array.isArray(rings)||!rings.length)throw Error('Matched record did not include usable geometry');
    const points=rings.flat().filter(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite));
    if(points.length<4)throw Error('Matched geometry incomplete');
    const lon=points.reduce((s,p)=>s+p[0],0)/points.length,lat=points.reduce((s,p)=>s+p[1],0)/points.length;
    if(lon < -84.5||lon > -82||lat < 41.5||lat > 43.5)throw Error('GIS geometry falls outside the Wayne County region');
    result={status:'candidate_found',verified:false,parcelId:id,matchedId:short(f.attributes.packedParcelNumber,40),centroidApprox:{lat:Number(lat.toFixed(6)),lon:Number(lon.toFixed(6))},acreage:Number.isFinite(f.attributes.Area_Ac)?f.attributes.Area_Ac:null,city:short(f.attributes.propcity,80),street:short(f.attributes.propstreetcombined,120),sourceUrl:LAYER,sourceType:'public hosted ArcGIS layer (historical, not independently verified as current)',geometryPoints:points.length,foundAt:new Date().toISOString(),note:'A matching ID is only a GIS candidate. Check current county/municipal records before approval. No map geometry was written.'};
  }else result={status:exact.length>1?'ambiguous':'no_exact_match',verified:false,parcelId:id,sourceUrl:LAYER,foundAt:new Date().toISOString(),note:exact.length>1?'Multiple exact records returned; manual GIS verification required.':'No exact ID match on this GIS layer. No coordinates inferred.'};
 }catch(e){return j(502,{ok:false,error:'GIS lookup unavailable: '+short(e.message,110)})}
 const latest=await auth.kvGet(STORE);
 if(!latest?.queue||latest.status==='paused')return j(409,{ok:false,error:'Queue changed. Result was not saved'});
 const target=latest.queue.find(x=>x.dataset===item.dataset&&x.recordId===item.recordId);
 if(!target)return j(409,{ok:false,error:'Case removed during lookup'});
 target.gis=result;target.status=result.status==='candidate_found'?'gis_candidate_unverified':target.status;
 latest.updatedAt=new Date().toISOString();
 await auth.kvPut(STORE,latest);
 return j(200,{ok:true,match:result});
}

export default auth.withBrainStore(handler);
