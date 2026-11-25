// Autonomous Photon address discovery ONLY. Runs every four hours without UI traffic.
// Five address lookups per scheduled run, 30 request hard ceiling per UTC day.
// Research candidates are saved to dedicated Netlify Blobs; NO map, parcel, queue,
// ownership, GIS, or publication writes. The service may rate-limit any volume.
import * as auth from '../lib/brain-auth.mjs';
import {activeCounty} from '../lib/brain-county-sequence.mjs';
const ROOT='https://pricepocketasset.com',STATUS='owner-brain-photon-status-v1',USAGE='photon-owner-search-usage-v1';
const FILE_PREFIX='owner-brain-photon-dataset-v1-',MAX_CALLS=5,DAILY_LIMIT=30,MAX_FILES=5;
const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
const validFile=s=>/^[A-Za-z0-9_-]+\.json$/.test(s||'');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function getJson(url,limit=13_000_000){
 const response=await fetch(url,{signal:AbortSignal.timeout(9500)});
 if(!response.ok)throw Error('Source returned HTTP '+response.status);
 const txt=await response.text();if(Buffer.byteLength(txt,'utf8')>limit)throw Error('Source too large');
 return JSON.parse(txt);
}
function addressOf(r){
 // Photon searches a full address with a street number, not a parcel ID.
 // A parcel without a street address is outside Photon's remit.
 const s=clean(r?.a);
 return s.length>=10&&s.length<=150&&/^\d{1,6}\s+[A-Za-z]/.test(s)&&s.includes(',')?s:null;
}
function summarize(f){
 const p=f?.properties||{},c=f?.geometry?.coordinates||[],lat=Number(c[1]),lon=Number(c[0]);
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return null;
 const fields=['housenumber','street','name','city','county','state','postcode','country'];
 const details={};for(const k of fields)details[k]=clean(p[k]).slice(0,90);
 return {lat,lon,...details,type:clean(p.type).slice(0,50)};
}
async function search(address){
 const url='https://photon.komoot.io/api/?'+new URLSearchParams({q:address,limit:'3',lang:'en'});
 const response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'PricePocketAsset-AddressResearch/1.0 (https://pricepocketasset.com)'},signal:AbortSignal.timeout(8500)});
 if(response.status===429||response.status===403)return {blocked:true,reason:'Photon denied or rate-limited further requests (HTTP '+response.status+')'};
 if(!response.ok)throw Error('Photon HTTP '+response.status);
 const raw=await response.text();if(Buffer.byteLength(raw,'utf8')>120_000)throw Error('Response too large');
 const data=JSON.parse(raw);if(!Array.isArray(data.features))throw Error('Invalid Photon response');
 return {results:data.features.slice(0,3).map(summarize).filter(Boolean)};
}
async function handler(){
 const day=new Date().toISOString().slice(0,10);
 const prev=await auth.kvGet(STATUS)||{runs:0,checked:0,candidateGroups:0,nextDataset:0,recent:[]};
 const status={...prev,runs:(prev.runs||0)+1,lastStarted:new Date().toISOString(),state:'running',lastError:null};
 await auth.kvPut(STATUS,status);
 let usage=await auth.kvGet(USAGE)||{day,count:0,last:0};
 if(usage.day!==day)usage={day,count:0,last:0};
 let requests=0,checked=0,groups=0,filesChecked=0,completed=false,blocked=false;
 try{
  // Shared owner pause switch, also used by the other AI Brain workers.
  const brain=await auth.kvGet('owner-brain-scanner-v1');
  if(brain?.status==='paused'){status.state='paused';return;}
  const index=await getJson(ROOT+'/map/index.json',8_000_000);
  const active=await activeCounty(index,auth,d=>getJson(ROOT+'/map/data/'+d.file));
  if(!active.dataset){status.state='all_counties_complete';return;}
  const all=[active.dataset];
  let pos=0;
  status.activeCounty=active.dataset.id;
  status.countyPosition=active.orderPosition;
  status.countyTotal=active.orderTotal;
  status.remaining=active.remaining;
  status.blocker=active.blocker;
  const maxRequests=Math.min(MAX_CALLS,Math.max(0,DAILY_LIMIT-usage.count));
  if(!maxRequests){status.state='daily_cap';status.note='30 public Photon calls already reserved today. Waiting for UTC reset.';return;}
  while(requests<maxRequests&&filesChecked<1){
   const d=all[pos],key=FILE_PREFIX+d.id;
   let src,save;
   try{src=await getJson(ROOT+'/map/data/'+d.file);save=await auth.kvGet(key)||{cursor:0,records:{},sourceBuilt:index.built};}
   catch(e){status.lastWarning=d.id+': '+clean(e.message).slice(0,80);status.state='source_unavailable';break;}
   if(save.sourceBuilt!==index.built){save={cursor:0,records:{},sourceBuilt:index.built};}
   const records=Array.isArray(src.recs)?src.recs:[];
   if(!records.length){status.state='source_empty';break;}
   let cursor=(save.cursor||0)%records.length,scanned=0,foundEligible=false;
   while(scanned<records.length&&requests<maxRequests){
    const r=records[cursor];cursor++;scanned++;
    if(cursor>=records.length)cursor=0;
    if(!r?.i||!r?.p||r.cx||r.g||Object.hasOwn(save.records,r.i))continue;
    const address=addressOf(r);if(!address)continue;
    foundEligible=true;
    // Reserve usage before sending the HTTP request. No retries on failure.
    usage.count++;usage.last=Date.now();await auth.kvPut(USAGE,usage);
    requests++;
    // Check pause between requests, without spending additional Photon calls.
    let answer;
    try{answer=await search(address);}
    catch(e){answer={error:clean(e.message).slice(0,100)};}
    const now=new Date().toISOString();
    const entry={parcelId:String(r.p).slice(0,90),address:address.slice(0,150),dataset:d.id,state:d.state,county:d.county,checkedAt:now,verified:false,approvable:false,
      status:answer.blocked?'provider_blocked':answer.error?'provider_error':answer.results.length?'address_candidates_unverified':'no_address_match',
      candidates:(answer.results||[]).slice(0,3)};
    if(answer.blocked){status.lastWarning=answer.reason;blocked=true;}
    // Save researched case even on errors; never automatically repeat the same lookup.
    save.records[r.i]=entry;save.cursor=cursor;save.updatedAt=now;
    await auth.kvPut(key,save);
    status.recent=[{recordId:r.i,...entry},...(status.recent||[])].slice(0,15);
    checked++;if(entry.candidates.length)groups++;
    if(blocked)break;
    if(requests<maxRequests)await pause(1300); // gentle public-server pacing
   }
   save.cursor=cursor;await auth.kvPut(key,save);
   if(blocked)break;
   if(scanned===records.length){filesChecked++;status.state='county_research_exhausted';}
   else if(foundEligible){ // Keep reading this county next cycle before moving to another.
    break;
   }else{filesChecked++;status.state='county_research_exhausted';}
   if(pos===status.nextDataset&&filesChecked)break;
  }
  status.nextDataset=0; // Strict shared county order controls progression.
  status.checked=(status.checked||0)+checked;
  status.candidateGroups=(status.candidateGroups||0)+groups;
  status.state=blocked?'provider_limited':status.state==='county_research_exhausted'?'county_research_exhausted':status.state==='source_unavailable'||status.state==='source_empty'?status.state:requests>=maxRequests?'idle':'awaiting_next_run';
  status.note='Independent address discovery only: '+checked+' parcels checked, '+groups+' with candidate addresses; no map changes.';
  status.lastBatch={requests,checked,candidateGroups:groups,filesChecked};
  completed=true;
 }catch(e){status.state='error';status.lastError=clean(e.message).slice(0,140);}
 finally{
  status.dailyUsage=usage.count;status.dailyLimit=DAILY_LIMIT;
  status.lastCompleted=new Date().toISOString();
  if(!completed&&!status.lastBatch)status.lastBatch={requests,checked,candidateGroups:groups,filesChecked};
  await auth.kvPut(STATUS,status);
 }
}
export const config={schedule:'45 */4 * * *'};

export default auth.withBrainStore(handler);
