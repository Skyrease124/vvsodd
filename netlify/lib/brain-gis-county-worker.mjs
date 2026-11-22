// Dormant by design. No endpoint or schedule invokes this worker. Only
// reviewed deployment configuration may supply an activation.
import {createCountyConnector,connectorError} from './brain-gis-universal.mjs';

export const countyCheckpointKey=id=>'brain-gis-operations-v1-'+id;
export const SHARED_COUNTY_DAILY_LIMIT=30;
const quotaKey='brain-gis-operations-budget-v1-';
const iso=ms=>new Date(ms).toISOString();
export async function readCountyBudget(storage,now=Date.now){
 return (await storage.read(quotaKey+iso(now()).slice(0,10)))?.data??null;
}
const quotaError=()=>connectorError('quota_reached','Shared or county GIS request limit reached','quota');

export async function reserveCountyRequest(storage,county,limits,now=Date.now){
 if(!Number.isSafeInteger(limits.shared)||limits.shared<1||!Number.isSafeInteger(limits.county)||limits.county<1)
  throw quotaError();
 const day=iso(now()).slice(0,10),key=quotaKey+day;
 for(let attempt=0;attempt<5;attempt++){
  const saved=await storage.read(key);
  const value=saved?.data||{total:0,counties:{}};
  const used=value.counties[county]??0;
  if(!Number.isSafeInteger(value.total)||value.total<0||!Number.isSafeInteger(used)||used<0||
     value.total>=limits.shared||used>=limits.county)throw quotaError();
  const next={total:value.total+1,counties:{...value.counties,[county]:used+1}};
  if(await storage.write(key,next,saved?.etag??null)){
   if(iso(now()).slice(0,10)!==day)throw quotaError();
   return next;
  }
 }
 throw connectorError('quota_busy','Request reservation unavailable','quota');
}

export async function runCountyResearch({config,rows,revision,storage,authorization,fetcher,now=Date.now,retry=null}){
 if(config.mode!=='preview-research'||config.enabled!==true||authorization?.owner!==true||
    authorization?.preview!==true||authorization?.confirmed!==true||authorization.dataset!==config.id)
  throw connectorError('not_authorized','County research activation and owner confirmation are required','control');
 if(typeof revision!=='string'||!revision||!Array.isArray(rows))throw Error('A versioned county dataset is required');
 const key=countyCheckpointKey(config.id),snapshot=await storage.read(key);
 const data=snapshot?.data||{revision,cursor:0,review:{},evidence:{},retryHistory:[],events:[]};
 if(data.revision!==revision)throw connectorError('dataset_changed','Dataset revision changed; reconcile the checkpoint first','control');
 if(data.paused||Date.parse(data.lockedUntil)>now())
  throw connectorError('worker_held','County worker is paused or already running','control');
 const held=data.sourceHealth?.status==='source_paused';
 if(Date.parse(data.sourceHealth?.nextAt)>now())return data;
 if(retry&&(!Number.isSafeInteger(retry.index)||data.review[retry.index]?.checkedAt!==retry.checkedAt||
    data.review[retry.index]?.parcelId!==retry.parcelId||data.review[retry.index]?.recordId!==rows[retry.index]?.i||
    rows[retry.index]?.p!==retry.parcelId||data.review[retry.index]?.resolvedAt))
  throw connectorError('stale_review','Owner retry no longer matches the saved parcel','control');
 let version;
 async function save(){
  if(now()>=Date.parse(data.lockedUntil))throw connectorError('lease_expired','Worker lease expired','control');
  version=await storage.write(key,data,version);
  if(!version)throw connectorError('lease_conflict','County worker checkpoint changed','control');
 }
 const connector=createCountyConnector(config,{fetcher,now:()=>new Date(now()),reserve:async()=>{
  await save(); // Verify ownership before every request.
  data.budget=await reserveCountyRequest(storage,config.id,{shared:SHARED_COUNTY_DAILY_LIMIT,county:config.requestLimit},now);
 }});
 data.lockedUntil=iso(now()+75000);
 version=await storage.write(key,data,snapshot?.etag??null);
 if(!version)throw connectorError('lease_conflict','County worker checkpoint changed','control');
 function recordEvent(event){
  data.eventSequence=(data.eventSequence??0)+1;
  data.events=[...data.events,{...event,id:data.eventSequence,at:iso(now())}].slice(-100);
 }
 try{
  if(!data.discovery||held){
   data.discovery=await connector.discover();
   await save();
  }
  const counts=new Map(), ids=new Map();
  for(const row of rows){
   counts.set(row?.p,(counts.get(row?.p)||0)+1);
   ids.set(row?.i,(ids.get(row?.i)||0)+1);
  }
  const limit=Math.min(rows.length,data.cursor+3);
  for(let index=retry?.index??data.cursor;retry?index===retry.index:index<limit;index++){
   const record=rows[index];
   try{
    if(!record?.i||ids.get(record.i)!==1||counts.get(record.p)!==1)
     throw connectorError('dataset_ambiguity','Missing or duplicate identifier in county dataset');
    if(!data.evidence[index])data.evidence[index]=await connector.verify(record,data.discovery);
    if(retry)data.review[index]={...data.review[index],resolvedAt:iso(now())};
    recordEvent({status:'evidence_saved',parcelId:record.p});
   }catch(error){
    if(error.scope!=='parcel')throw error;
    const prior=data.review[index];
    data.review[index]={recordId:record?.i??null,parcelId:record?.p??null,status:'skipped',
     reason:error.message,code:error.code,checkedAt:iso(now()),
     ...(prior?{previous:[...(prior.previous||[]),{reason:prior.reason,code:prior.code,checkedAt:prior.checkedAt}]}:{})};
    recordEvent({status:'skipped',parcelId:record?.p??null,reason:error.message});
   }
   data.sourceHealth={status:'reachable'};
   if(!retry)data.cursor=index+1;
   data.totalEligible=rows.length;
   data.lastSuccessfulAt=iso(now());
   await save();
  }
 }catch(error){
  if(error.scope==='control')throw error;
  if(error.scope==='quota'){
   data.sourceHealth={status:'quota_wait',reason:error.message};
  }else{
   const attempt=held?(snapshot.data.sourceHealth.attempt||0)+1:1;
   data.sourceHealth={status:'source_paused',attempt,nextAt:iso(now()+[60000,180000,900000][Math.min(attempt,3)-1]),
    reason:error.scope==='source'?error.message:'County research temporarily unavailable'};
   data.retryHistory=[...data.retryHistory,{cursor:data.cursor,at:iso(now()),...data.sourceHealth}].slice(-50);
  }
  recordEvent(data.sourceHealth);
 }finally{
  if(version&&now()<Date.parse(data.lockedUntil)){
   const unlocked={...data,lockedUntil:null};
   if(!await storage.write(key,unlocked,version))throw connectorError('lease_conflict','County worker checkpoint changed','control');
   data.lockedUntil=null;
  }
 }
 return data;
}
