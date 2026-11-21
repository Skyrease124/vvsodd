// Netlify scheduled automation. No user traffic or page required.
// Runs free Detroit assessor checks on existing queued Wayne records. Never publishes or buys credits.
import * as auth from '../lib/auth.mjs';
import * as KEYS from '../lib/apikeys.mjs';
const STORE='owner-brain-scanner-v1', STATUS='owner-brain-automatic-status-v1';
const ROOT='https://pricepocketasset.com', LAYER='https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Parcels_Current/FeatureServer/0';
const norm=s=>String(s??'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const tidy=s=>String(s??'').toUpperCase().replace(/[^A-Z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const limit=(s,n=160)=>String(s??'').slice(0,n);
const fetchJson=async (url,timeout=7000)=>{
 const r=await fetch(url,{signal:AbortSignal.timeout(timeout)});if(!r.ok)throw Error('Source HTTP '+r.status);
 const raw=await r.text();if(Buffer.byteLength(raw,'utf8')>10_000_000)throw Error('Dataset too large');
 const data=JSON.parse(raw);if(data.error)throw Error(limit(data.error.message,90));return data;
};
async function exact(item){
 const id=String(item.parcelId||'');if(!/^[0-9A-Za-z.-]{4,32}$/.test(id))return {status:'unsupported',note:'Parcel ID not eligible for exact lookup'};
 const params=new URLSearchParams({f:'json',where:"parcel_number = '"+id+"'",outFields:'parcel_number,address,zip_code,total_acreage,object_id',returnGeometry:'true',outSR:'4326',resultRecordCount:'3'});
 const data=await fetchJson(LAYER+'/query?'+params,6500);
 const rows=(data.features||[]).filter(f=>norm(f.attributes?.parcel_number)===norm(id));
 if(rows.length!==1||(data.features||[]).length!==1)return {status:'no_exact_match',verified:false,note:'No unique exact ID match in Detroit assessor GIS',foundAt:new Date().toISOString()};
 const f=rows[0],pts=Array.isArray(f.geometry?.rings)?f.geometry.rings.flat().filter(p=>Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1])):[];
 if(pts.length<4)return {status:'no_geometry',verified:false,note:'Exact parcel ID found but usable geometry absent',foundAt:new Date().toISOString()};
 const lon=pts.reduce((a,p)=>a+p[0],0)/pts.length,lat=pts.reduce((a,p)=>a+p[1],0)/pts.length;
 if(lon < -83.4||lon > -82.8||lat < 42.2||lat > 42.5)return {status:'out_of_bounds',verified:false,note:'Geometry outside Detroit safety limits',foundAt:new Date().toISOString()};
 return {status:'candidate_found',verified:false,parcelId:id,matchedId:limit(f.attributes.parcel_number,40),address:limit(f.attributes.address),zipCode:limit(f.attributes.zip_code,12),acreage:Number.isFinite(f.attributes.total_acreage)?f.attributes.total_acreage:null,centroidApprox:{lat:Number(lat.toFixed(6)),lon:Number(lon.toFixed(6))},sourceUrl:LAYER,sourceType:'City of Detroit Assessor Parcels Current',geometryPoints:pts.length,note:'Automatic research candidate only; independent official verification required. No map changes.',foundAt:new Date().toISOString()};
}
async function address(item,rec){
 const a=String(rec?.a||'');
 const match=/^\s*(\d{1,6})\s+([a-z][a-z0-9 .'-]{2,65}?),?\s*,?\s*Detroit\b/i.exec(a);
 if(!match)return {status:'address_unavailable',verified:false,checkedAt:new Date().toISOString(),note:'No usable Detroit address'};
 const street=tidy(match[2]).replace(/\s+(ST|STREET|AVE|AVENUE|RD|ROAD|BLVD|BOULEVARD)$/,'');
 if(!street)return {status:'address_unavailable',verified:false,checkedAt:new Date().toISOString(),note:'Incomplete street'};
 const prefix=match[1]+' '+street;
 const params=new URLSearchParams({f:'json',where:"address LIKE '%"+match[1]+"%"+street.replace(/ /g,'%')+"%'",outFields:'parcel_number,address,zip_code,object_id',returnGeometry:'false',resultRecordCount:'12'});
 const data=await fetchJson(LAYER+'/query?'+params,6500);
 const candidates=(data.features||[]).map(f=>f.attributes||{}).filter(x=>tidy(x.address).startsWith(prefix+' ')||tidy(x.address)===prefix).slice(0,8).map(x=>({parcelId:limit(x.parcel_number,50),address:limit(x.address),zipCode:limit(x.zip_code,12)}));
 return {status:candidates.length?'address_candidates_unverified':'no_address_match',sourceAddress:limit(a),streetSearched:prefix,candidates,sourceUrl:LAYER,checkedAt:new Date().toISOString(),verified:false,approvable:false,note:'Automated address search only. Parcel identifiers must be checked; no location inferred.'};
}

const GEOCODE_USAGE='owner-brain-geocode-usage-v1';
const GEOCODE_DAILY_CAP=20;
async function geocodeBatch(){
  await KEYS.load(true);
  const apiKey=KEYS.keyOf('GEOCODE_MAPS_CO_API_KEY');
  if(!apiKey)return {state:'no_key',count:0,candidates:0,note:'Save a Geocode.maps.co key in Owner API Keys'};
  const q=await auth.kvGet(STORE);
  if(q?.status==='paused'||!Array.isArray(q?.queue))return {state:'paused',count:0,candidates:0};
  // Pilot only: Wayne County records whose exact official GIS match is not already verified.
  const items=q.queue.filter(x=>x.state==='MI'&&/^(Wayne|Wayne County)$/i.test(x.county)&&!x.review&&x.detroit?.status!=='candidate_found'&&!x.geocode?.checkedAt).slice(0,2);
  if(!items.length)return {state:'idle',count:0,candidates:0,note:'All eligible Wayne addresses already checked'};
  const data=await fetchJson(ROOT+'/map/data/MI-wayne.json',8000);
  const rows=new Map((data.recs||[]).map(r=>[r.i,r]));
  let checked=0,candidates=0,errors=0;
  for(const it of items){
    const live=await auth.kvGet(STORE);
    if(live?.status==='paused')break;
    const parcel=live?.queue?.find(x=>x.dataset===it.dataset&&x.recordId===it.recordId);
    if(!parcel||parcel.review||parcel.geocode?.checkedAt)continue;
    const original=rows.get(it.recordId);
    if(!original||original.p!==it.parcelId||original.cx||original.g)continue;
    const a=String(original.a||'').trim();
    // No fallback to city-level coordinates: a full street address is mandatory.
    if(!/^\d{1,6}\s+[A-Za-z0-9][A-Za-z0-9 .'-]{2,100},?\s+Detroit\b/i.test(a)){
      parcel.geocode={status:'address_unavailable',verified:false,approvable:false,checkedAt:new Date().toISOString(),note:'Street-level address missing or unsupported'};
    }else{
      const day=new Date().toISOString().slice(0,10);
      const usage=await auth.kvGet(GEOCODE_USAGE)||{day,used:0};
      if(usage.day!==day){usage.day=day;usage.used=0;}
      if(usage.used>=GEOCODE_DAILY_CAP)return {state:'daily_cap',count:checked,candidates,errors,note:'Daily safety cap reached ('+GEOCODE_DAILY_CAP+')'};
      // Record usage BEFORE calling provider; avoid repeat spending if a call fails.
      usage.used+=1;await auth.kvPut(GEOCODE_USAGE,usage);
      try{
        const query=new URLSearchParams({q:a.replace(/\s+MI\b/i,', Michigan')+', USA',limit:'3',addressdetails:'1'});
        const response=await fetch('https://geocode.maps.co/search?'+query,{headers:{Authorization:'Bearer '+apiKey,Accept:'application/json'},signal:AbortSignal.timeout(9500)});
        if(response.status===429||response.status===403||response.status===401){
          return {state:'provider_limited',count:checked,candidates,errors:errors+1,note:'Provider rejected or rate-limited request (HTTP '+response.status+'). Automatic calls paused for this run.'};
        }
        if(!response.ok)throw Error('Geocoding HTTP '+response.status);
        const values=await response.json();
        if(!Array.isArray(values))throw Error('Unexpected geocoding response');
        const options=values.slice(0,3).map(v=>({
          lat:Number(v.lat),lon:Number(v.lon),
          displayName:limit(v.display_name,190),
          type:limit(v.type,50),
          addressStreet:limit(v.address?.road,100),
          houseNumber:limit(v.address?.house_number,20),
          city:limit(v.address?.city||v.address?.town||v.address?.municipality,80),
          state:limit(v.address?.state,80),
          countryCode:limit(v.address?.country_code,3)
        })).filter(v=>Number.isFinite(v.lat)&&Number.isFinite(v.lon)&&v.lat>42.2&&v.lat<42.5&&v.lon> -83.4&&v.lon< -82.8&&v.countryCode.toLowerCase()==='us');
        parcel.geocode={status:options.length?'address_candidates_unverified':'no_address_match',verified:false,approvable:false,sourceAddress:limit(a,160),candidates:options,sourceUrl:'https://geocode.maps.co/',checkedAt:new Date().toISOString(),note:'OpenStreetMap-based address geocoding only. Candidate points are NOT verified property boundaries or county GIS matches.'};
        if(options.length)candidates++;
      }catch(e){
        errors++;
        parcel.geocode={status:'provider_error',verified:false,approvable:false,sourceAddress:limit(a,160),checkedAt:new Date().toISOString(),note:'Geocoding request failed. No location inferred.'};
      }
    }
    const update=await auth.kvGet(STORE);
    if(update?.status==='paused')break;
    const found=update?.queue?.find(x=>x.dataset===parcel.dataset&&x.recordId===parcel.recordId);
    if(!found||found.review||found.geocode?.checkedAt)continue;
    found.geocode=parcel.geocode;update.updatedAt=new Date().toISOString();await auth.kvPut(STORE,update);
    checked++;
  }
  return {state:errors?'partial_error':'idle',count:checked,candidates,errors,note:'Address candidates for private review only. Zero public map changes.'};
}

export default async function handler(){
 const started=new Date().toISOString();
 const prior=await auth.kvGet(STATUS)||{runs:0,checked:0};
 const state={...prior,lastStarted:started,runs:(prior.runs||0)+1,state:'running',lastError:null};
 await auth.kvPut(STATUS,state);
 try{
  const q=await auth.kvGet(STORE);
  if(q?.status==='paused'){state.state='paused';state.lastCompleted=new Date().toISOString();await auth.kvPut(STATUS,state);return}
  if(!Array.isArray(q?.queue)||!q.queue.length){state.state='waiting_for_queue';state.lastCompleted=new Date().toISOString();await auth.kvPut(STATUS,state);return}
  // Geocoding is a separate, tightly capped background pass even when prior GIS checks are complete.
  let geocodeResult;
  try{geocodeResult=await geocodeBatch();}catch(e){geocodeResult={state:'error',count:0,candidates:0,note:'Geocoder unavailable'};}
  state.geocode={...geocodeResult,updatedAt:new Date().toISOString()};
  await auth.kvPut(STATUS,state);
  const eligible=q.queue.filter(r=>r.state==='MI'&&/^(Wayne|Wayne County)$/i.test(r.county)&&!r.review&&r.detroit?.status!=='candidate_found'&&(!r.detroit?.foundAt||!r.detroitAddress?.checkedAt));
  if(!eligible.length){state.state='idle';state.note='No remaining Wayne GIS candidates for this pass. Geocoder: '+geocodeResult.state;state.lastCompleted=new Date().toISOString();await auth.kvPut(STATUS,state);return}
  const ds=await fetchJson(ROOT+'/map/data/MI-wayne.json',8000);
  const index=new Map((ds.recs||[]).map(r=>[r.i,r]));
  let processed=0,found=0,errors=0;
  for(const item of eligible.slice(0,2)){
    const latest=await auth.kvGet(STORE);
    if(latest?.status==='paused')break;
    const target=latest?.queue?.find(x=>x.dataset===item.dataset&&x.recordId===item.recordId);
    if(!target||target.review)continue;
    try{
      if(!target.detroit?.foundAt){target.detroit=await exact(target);if(target.detroit.status==='candidate_found')found++;}
      else if(!target.detroitAddress?.checkedAt){const rec=index.get(target.recordId);if(!rec||rec.p!==target.parcelId)throw Error('Source record changed');target.detroitAddress=await address(target,rec);}
      processed++;
      latest.updatedAt=new Date().toISOString();
      // Re-read immediately before saving: pause and owner queue actions take precedence.
      const check=await auth.kvGet(STORE);
      if(check?.status==='paused')break;
      const slot=check?.queue?.find(x=>x.dataset===target.dataset&&x.recordId===target.recordId);
      if(!slot||slot.review)continue;
      if(target.detroit)slot.detroit=target.detroit;
      if(target.detroitAddress)slot.detroitAddress=target.detroitAddress;
      check.updatedAt=latest.updatedAt;
      await auth.kvPut(STORE,check);
    }catch(e){errors++;state.lastError=limit(e.message,140);break;}
  }
  state.checked=(state.checked||0)+processed;state.candidates=(state.candidates||0)+found;state.errors=(state.errors||0)+errors;
  state.state=errors?'partial_error':'idle';state.lastCompleted=new Date().toISOString();
  state.note=processed+' free GIS checks, '+found+' GIS candidate(s), '+geocodeResult.count+' geocoding checks. No public map changes.';
  await auth.kvPut(STATUS,state);
 }catch(e){state.state='error';state.lastError=limit(e.message,140);state.lastCompleted=new Date().toISOString();await auth.kvPut(STATUS,state);}
}
export const config={schedule:'*/30 * * * *'};
