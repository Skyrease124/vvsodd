// Independent scheduled Geocode.maps.co research. No paid calls or map publication.
import * as auth from '../lib/auth.mjs';
import * as KEYS from '../lib/apikeys.mjs';
const STORE='owner-brain-scanner-v1',STATUS='owner-brain-geocode-status-v1';
const ROOT='https://pricepocketasset.com';
const limit=(s,n=160)=>String(s??'').slice(0,n);
const fetchJson=async (url,timeout=7000)=>{
 const r=await fetch(url,{signal:AbortSignal.timeout(timeout)});
 if(!r.ok)throw Error('Source HTTP '+r.status);
 const raw=await r.text();
 if(Buffer.byteLength(raw,'utf8')>10_000_000)throw Error('Source too large');
 return JSON.parse(raw);
};
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

export default async function(){
 const old=await auth.kvGet(STATUS)||{runs:0,checked:0,candidates:0};
 const now=new Date().toISOString();
 const status={...old,runs:(old.runs||0)+1,lastStarted:now,state:'running',lastError:null};
 await auth.kvPut(STATUS,status);
 try{
  const result=await geocodeBatch();
  status.state=result.state;
  status.checked=(status.checked||0)+(result.count||0);
  status.candidates=(status.candidates||0)+(result.candidates||0);
  status.errors=(status.errors||0)+(result.errors||0);
  status.lastCompleted=new Date().toISOString();
  status.note=result.note||'No changes to published parcel maps';
 }catch(e){
  status.state='error';
  status.lastError=limit(e.message,140);
  status.lastCompleted=new Date().toISOString();
 }
 await auth.kvPut(STATUS,status);
};
export const config={schedule:'30 */6 * * *'};
