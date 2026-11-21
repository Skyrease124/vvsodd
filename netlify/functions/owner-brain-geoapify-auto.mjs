// Geoapify: nationwide automatic address candidate discovery, not GIS verification.
// Up to 50 records every four hours; 300 API calls daily shared with owner key test.
// Source-specific progress and results persist in dedicated Netlify Blobs.
import * as auth from '../lib/brain-auth.mjs';
import * as KEYS from '../lib/apikeys.mjs';
const ROOT='https://pricepocketasset.com', STATUS='owner-brain-geoapify-status-v1', USAGE='owner-brain-geoapify-usage-v1', PREFIX='owner-brain-geoapify-dataset-v1-';
const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
async function read(url,max=14000000){
 const r=await fetch(url,{signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw Error('HTTP '+r.status);
 const text=await r.text();
 if(Buffer.byteLength(text)>max)throw Error('Response too large');
 return JSON.parse(text);
}
function street(record){
 const s=clean(record?.a);
 return s.length>=10&&s.length<=150&&/^\d{1,6}\s+[A-Za-z]/.test(s)&&s.includes(',')?s:null;
}
async function search(address,key){
 const url='https://api.geoapify.com/v1/geocode/search?'+new URLSearchParams({text:address,filter:'countrycode:us',limit:'3',apiKey:key});
 const r=await fetch(url,{signal:AbortSignal.timeout(7500)});
 if([401,403,429].includes(r.status))return {blocked:r.status};
 if(!r.ok)throw Error('Geoapify HTTP '+r.status);
 const json=await r.json();
 if(!Array.isArray(json.features))throw Error('Invalid Geoapify result');
 return {candidates:json.features.slice(0,3).map(f=>{
  const p=f.properties||{},c=f.geometry?.coordinates||[];
  const lat=Number(c[1]),lon=Number(c[0]);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<18||lat>72||lon< -180||lon> -65)return null;
  if(p.country_code&&p.country_code.toLowerCase()!=='us')return null;
  return {lat,lon,formatted:clean(p.formatted).slice(0,180),street:clean(p.street).slice(0,90),housenumber:clean(p.housenumber).slice(0,15),city:clean(p.city).slice(0,90),state:clean(p.state).slice(0,90),postcode:clean(p.postcode).slice(0,15)};
 }).filter(Boolean)};
}
async function handler(){
 const date=new Date().toISOString().slice(0,10);
 let usage=await auth.kvGet(USAGE)||{day:date,used:0};
 if(usage.day!==date)usage={day:date,used:0};
 const old=await auth.kvGet(STATUS)||{runs:0,checked:0,found:0,nextDataset:0,recent:[]};
 const status={...old,runs:(old.runs||0)+1,state:'running',lastStarted:new Date().toISOString(),lastError:null};
 await auth.kvPut(STATUS,status);
 let calls=0,checked=0,found=0,visited=0;
 try{
  await KEYS.load(true);
  const key=KEYS.keyOf('GEOAPIFY_API_KEY');
  if(!key){status.state='awaiting_key';return;}
  const brain=await auth.kvGet('owner-brain-scanner-v1');
  if(brain?.status==='paused'){status.state='paused';return;}
  if(usage.used>=300){status.state='daily_cap';return;}
  const index=await read(ROOT+'/map/index.json',8000000);
  const datasets=(index.datasets||[]).filter(d=>/^[A-Za-z0-9_-]+$/.test(d.id||'')&&/^[A-Za-z0-9_-]+\.json$/.test(d.file||'')&&d.records>d.mapped);
  if(!datasets.length){status.state='nothing_missing';return;}
  let pos=(Number.isInteger(status.nextDataset)?status.nextDataset:0)%datasets.length;
  if(status.runs===1){const wayne=datasets.findIndex(d=>d.id==='MI-wayne');if(wayne>=0)pos=wayne;}
  const limit=Math.min(50,300-usage.used);
  while(calls<limit&&visited<8){
   const d=datasets[pos],ledgerKey=PREFIX+d.id;
   let data,ledger;
   try{data=await read(ROOT+'/map/data/'+d.file);ledger=await auth.kvGet(ledgerKey)||{cursor:0,records:{},built:index.built};}
   catch(e){status.lastWarning=d.id+': '+clean(e.message).slice(0,85);visited++;pos=(pos+1)%datasets.length;continue;}
   if(ledger.built!==index.built)ledger={cursor:0,records:{},built:index.built};
   const records=Array.isArray(data.recs)?data.recs:[];
   if(!records.length){visited++;pos=(pos+1)%datasets.length;continue;}
   let cursor=(ledger.cursor||0)%records.length,scanned=0;
   while(scanned<records.length&&calls<limit){
    const r=records[cursor];cursor=(cursor+1)%records.length;scanned++;
    if(!r?.i||!r.p||r.g||r.cx||Object.hasOwn(ledger.records,r.i))continue;
    const address=street(r);if(!address)continue;
    // All API attempts are counted before sending, no retries.
    usage.used++;await auth.kvPut(USAGE,usage);calls++;
    let answer;
    try{answer=await search(address,key);}catch(e){answer={error:clean(e.message).slice(0,90)};}
    const stamp=new Date().toISOString();
    const entry={dataset:d.id,state:d.state,county:d.county,parcelId:r.p,address,checkedAt:stamp,verified:false,approvable:false,
      status:answer.blocked?'provider_limited':answer.error?'provider_error':answer.candidates.length?'address_candidates_unverified':'no_address_match',
      candidates:answer.candidates||[]};
    ledger.records[r.i]=entry;ledger.cursor=cursor;ledger.updatedAt=stamp;
    await auth.kvPut(ledgerKey,ledger);
    checked++;if(entry.candidates.length)found++;
    status.recent=[{recordId:r.i,...entry},...(status.recent||[])].slice(0,15);
    if(answer.blocked){status.state='provider_limited';status.lastWarning='Geoapify HTTP '+answer.blocked;break;}
    if(calls<limit)await new Promise(resolve=>setTimeout(resolve,150));
   }
   ledger.cursor=cursor;await auth.kvPut(ledgerKey,ledger);
   if(status.state==='provider_limited')break;
   if(scanned===records.length){visited++;pos=(pos+1)%datasets.length;}
   else break;
  }
  status.nextDataset=pos;
  status.checked=(status.checked||0)+checked;status.found=(status.found||0)+found;
  status.lastBatch={calls,checked,found,datasetsVisited:visited};
  if(status.state==='running')status.state='idle';
 }catch(e){status.state='error';status.lastError=clean(e.message).slice(0,130);}
 finally{status.dailyUsage=usage.used;status.dailyLimit=300;status.lastCompleted=new Date().toISOString();await auth.kvPut(STATUS,status);}
}
export const config={schedule:'20 */4 * * *'};

export default auth.withBrainStore(handler);
