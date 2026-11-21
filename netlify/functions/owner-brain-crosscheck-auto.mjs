// Scheduled cross-verification, Detroit pilot. Compare a unique official parcel address/ID
// and official parcel polygon with a prior independent geocoded address point.
// Private candidate only; DOES NOT edit published maps, skip owner review or purchase API credits.
import * as auth from '../lib/auth.mjs';
const QUEUE='owner-brain-scanner-v1', STATUS='owner-brain-crosscheck-status-v1';
const ROOT='https://pricepocketasset.com';
const LAYER='https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Parcels_Current/FeatureServer/0';
const norm=s=>String(s??'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const trim=(s,n=160)=>String(s??'').slice(0,n);
const cityBounds=(lat,lon)=>Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=42.2&&lat<=42.5&&lon>=-83.4&&lon<=-82.8;
const rad=x=>x*Math.PI/180;
function meters(a,b){const dLat=rad(a.lat-b.lat),dLon=rad(a.lon-b.lon),lat1=rad(a.lat),lat2=rad(b.lat);const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;return 12742000*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));}
async function getJson(url,max=6000000){const r=await fetch(url,{signal:AbortSignal.timeout(9000)});if(!r.ok)throw Error('HTTP '+r.status);const raw=await r.text();if(Buffer.byteLength(raw)>max)throw Error('Response too large');const data=JSON.parse(raw);if(data.error)throw Error(trim(data.error.message,80));return data;}
function officialStreet(s){
 const match=/^\s*(\d{1,6})\s+([A-Za-z][A-Za-z0-9 .'-]{2,70})/i.exec(s||'');
 if(!match)return null;
 return {number:match[1],road:norm(match[2].replace(/\b(?:ST|STREET|AVE|AVENUE|RD|ROAD|BLVD|BOULEVARD|DR|DRIVE)\s*$/i,''))};
}
function exactStreet(a,b){const x=officialStreet(a),y=officialStreet(b);return !!x&&!!y&&x.number===y.number&&x.road===y.road;}
async function evaluate(item,record){
 const now=new Date().toISOString();
 const fail=(status,note,extra={})=>({status,verified:false,approvable:false,note,checkedAt:now,...extra});
 const address=String(record?.a||'');
 const match=/^\s*(\d{1,6})\s+([a-z][a-z0-9 .'-]{2,65}?),?\s*,?\s*Detroit\b/i.exec(address);
 if(!match)return fail('address_unavailable','Published record does not provide a complete Detroit street address');
 if(!item.geocode?.checkedAt||!Array.isArray(item.geocode.candidates)||!item.geocode.candidates.length)return fail('waiting_for_geocode','No saved geocoding candidates for this parcel yet');
 const road=match[2].replace(/\s+(ST|STREET|AVE|AVENUE|RD|ROAD|BLVD|BOULEVARD)$/i,'').trim();
 const sql="address LIKE '%"+match[1]+"%"+road.toUpperCase().replace(/[^A-Z0-9 ]/g,'').replace(/\s+/g,'%')+"%'";
 const params=new URLSearchParams({f:'json',where:sql,outFields:'parcel_number,address,zip_code,object_id,total_acreage',returnGeometry:'true',outSR:'4326',resultRecordCount:'15'});
 const d=await getJson(LAYER+'/query?'+params);
 const all=Array.isArray(d.features)?d.features:[];
 // The service may return truncated sets: never select a possibly ambiguous match.
 if(all.length>=15)return fail('ambiguous','GIS returned the query limit; cannot safely disambiguate');
 const candidates=all.filter(f=>norm(f.attributes?.parcel_number)===norm(item.parcelId)&&exactStreet(f.attributes?.address,match[1]+' '+road));
 if(candidates.length!==1)return fail(candidates.length?'ambiguous':'identity_mismatch','No unique official feature matched BOTH the queued parcel ID and full street address', {officialMatches:candidates.length});
 const feature=candidates[0],rings=feature.geometry?.rings;
 if(!Array.isArray(rings)||!rings.length)return fail('no_geometry','Official parcel feature has no polygon geometry');
 const points=rings.flat().filter(p=>Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1]));
 if(points.length<4)return fail('no_geometry','Official parcel geometry is incomplete');
 const lon=points.reduce((a,p)=>a+p[0],0)/points.length,lat=points.reduce((a,p)=>a+p[1],0)/points.length;
 if(!cityBounds(lat,lon))return fail('out_of_bounds','GIS polygon is outside expected Detroit area');
 // A geocoder result is not a parcel outline. Compare it to the polygon vertices,
 // using the approximate vertex-average point for a conservative lead only.
 const nearby=item.geocode.candidates.map(p=>({...p,lat:Number(p.lat),lon:Number(p.lon)})).filter(p=>cityBounds(p.lat,p.lon)&&
   (String(p.displayName||'').toUpperCase().includes('DETROIT'))&&
   (norm(p.houseNumber)===norm(match[1])||new RegExp('^'+match[1]+'[, ]').test(String(p.displayName||'')))&&
   (norm(p.addressStreet)===norm(road)||norm(p.displayName).includes(norm(road))));
 const matches=nearby.map(p=>({p,distance:meters({lat,lon},p)})).filter(p=>p.distance<=100).sort((a,b)=>a.distance-b.distance);
 if(!matches.length)return fail('location_conflict','Official parcel polygon and geocoding point did not agree within 100 meters', {candidateCount:nearby.length});
 if(matches.length>1&&matches[1].distance-matches[0].distance<25)return fail('ambiguous','Multiple geocoding candidates within 25 meters of one another');
 return {status:'candidate_found',verified:false,approvable:false,matchedId:trim(feature.attributes.parcel_number,80),address:trim(feature.attributes.address,120),centroidApprox:{lat:Number(lat.toFixed(6)),lon:Number(lon.toFixed(6))},geocodePosition:{lat:matches[0].p.lat,lon:matches[0].p.lon},distanceMeters:Math.round(matches[0].distance),geometryPoints:points.length,sourceUrl:LAYER,sourceType:'City of Detroit Assessor GIS + Geocode.maps.co',checkedAt:now,note:'Automated cross-check found a matching parcel ID and street address; GIS polygon and geocoded point are within 100m. Independently verify official current records before approval. No map edits.'};
}
export default async function(){
 const previous=await auth.kvGet(STATUS)||{runs:0,checked:0,candidates:0};
 const status={...previous,runs:(previous.runs||0)+1,state:'running',lastStarted:new Date().toISOString(),lastError:null};
 await auth.kvPut(STATUS,status);
 try{
  const queue=await auth.kvGet(QUEUE);
  if(queue?.status==='paused'){status.state='paused';return;}
  if(!Array.isArray(queue?.queue)){status.state='waiting_for_queue';return;}
  const eligible=queue.queue.filter(r=>r.dataset==='MI-wayne'&&r.state==='MI'&&!r.review&&
      r.geocode?.status==='address_candidates_unverified'&&!r.crosscheck?.checkedAt);
  if(!eligible.length){status.state='idle';status.note='Waiting for new GIS + geocoding candidates';return;}
  const data=await getJson(ROOT+'/map/data/MI-wayne.json',12000000);
  const byId=new Map((data.recs||[]).map(r=>[r.i,r]));
  let processed=0,found=0;
  for(const item of eligible.slice(0,3)){
   const record=byId.get(item.recordId);
   if(!record||record.p!==item.parcelId||record.cx||record.g)continue;
   let result;
   try{result=await evaluate(item,record);}
   catch(e){status.lastError=trim(e.message,120);status.state='partial_error';break;}
   const current=await auth.kvGet(QUEUE);
   if(!current?.queue||current.status==='paused')break;
   const target=current.queue.find(r=>r.dataset===item.dataset&&r.recordId===item.recordId);
   if(!target||target.review||target.crosscheck?.checkedAt)continue;
   target.crosscheck=result;
   current.updatedAt=new Date().toISOString();
   await auth.kvPut(QUEUE,current);
   processed++;if(result.status==='candidate_found')found++;
  }
  status.checked=(status.checked||0)+processed;
  status.candidates=(status.candidates||0)+found;
  if(status.state==='running')status.state='idle';
  status.note=processed+' parcels cross-checked; '+found+' candidate(s) flagged for independent owner review. No public map writes.';
 }catch(e){status.state='error';status.lastError=trim(e.message,120);}
 finally{status.lastCompleted=new Date().toISOString();await auth.kvPut(STATUS,status);}
};
export const config={schedule:'0 1,9,17 * * *'};
