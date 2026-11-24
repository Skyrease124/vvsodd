import {createHash} from 'node:crypto';
import {polygonEvidence} from './brain-gis-connectors.mjs';
import {readCountyBudget,reserveCountyRequest,SHARED_COUNTY_DAILY_LIMIT} from './brain-gis-county-worker.mjs';
import {reviewedFloridaSource} from './brain-gis-florida-registry.mjs';

const {county,source}=reviewedFloridaSource({state:'FL',county:'Putnam'});
const parcelId='04-10-24-6450-0060-0240';
const dataset='FL-putnam';
const certificate='https://apps.putnam-fl.com/coc/taxdeeds/public/public_certification.php?certnum=20190003179';
const params={
 where:"CO_NO = "+county.sourceCountyValue+" AND PARCEL_ID = '"+parcelId+"'",
 outFields:'PARCEL_ID,PARCELNO,CO_NO,OWN_NAME,PHY_ADDR1,PHY_CITY,LND_SQFOOT,S_LEGAL,DOR_UC,JV',
 returnGeometry:'true',outSR:'4326',f:'geojson',resultRecordCount:'2',returnZ:'false',returnM:'false'
};
const url=source.url+'/query?'+new URLSearchParams(params);
const requestId=createHash('sha256').update('putnam-private-verification-v1:'+url).digest('hex');
const key='brain-gis-putnam-verification-v1-'+requestId;
export const PUTNAM={dataset,parcelId,source:source.url,certificate,requestId,clerkAcres:0.11,cost:1};

function contains(ring,[x,y]){
 let inside=false;
 for(let i=1;i<ring.length;i++){
  const [a,b]=ring[i-1],[c,d]=ring[i];
  if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)inside=!inside;
 }
 return inside;
}
const side=(a,b,c)=>Math.sign((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]));
const overlap=(a,b,c,d,i)=>Math.max(Math.min(a[i],b[i]),Math.min(c[i],d[i]))<=Math.min(Math.max(a[i],b[i]),Math.max(c[i],d[i]));
function touches(first,second){
 return first.slice(1).some((b,i)=>second.slice(1).some((d,j)=>{
  const a=first[i],c=second[j];
  return overlap(a,b,c,d,0)&&overlap(a,b,c,d,1)&&side(a,b,c)*side(a,b,d)<=0&&side(c,d,a)*side(c,d,b)<=0;
 }));
}
function geometryAcres(geometry){
 const polygons=geometry?.type==='Polygon'?[geometry.coordinates]:geometry?.type==='MultiPolygon'?geometry.coordinates:null;
 if(!Array.isArray(polygons)||!polygons.length||polygons.length>16)throw Error('Unsupported geometry type');
 let acres=0,vertices=0;
 const boundaries=[];
 for(const rings of polygons){
  if(!Array.isArray(rings)||!rings.length||rings.length>16)throw Error('Invalid polygon rings');
  let area=0;
  for(const [i,ring] of rings.entries()){
   vertices+=ring?.length??0;
   if(vertices>3000)throw Error('Polygon exceeds validation limits');
   const evidence=polygonEvidence([ring],[-82.1,29.15,-81.3,30.0]);
   if(i&&(!contains(rings[0],ring[0])||rings.slice(0,i).some(other=>touches(other,ring))||
    rings.slice(1,i).some(other=>contains(other,ring[0])||contains(ring,other[0]))))throw Error('Invalid interior ring');
   area+=i?-evidence.acres:evidence.acres;
  }
  const shell=rings[0];
  if(area<=0||boundaries.some(other=>touches(other,shell)||contains(other,shell[0])||contains(shell,other[0])))
   throw Error('Overlapping polygon components');
  boundaries.push(shell);
  acres+=area;
 }
 return acres;
}

export function validatePutnam(data){
 if(data?.error||data?.type!=='FeatureCollection'||!Array.isArray(data.features))return {status:'source_unavailable',reason:'Expected a GeoJSON feature collection'};
 if(data.exceededTransferLimit===true||data.features.length>1)return {status:'ambiguous_match',reason:'The response was truncated or returned multiple features'};
 if(!data.features.length)return {status:'no_exact_match',reason:'The approved PARCEL_ID query returned zero features'};
 const [feature]=data.features,fields=feature?.properties;
 if(feature?.type!=='Feature'||fields?.PARCEL_ID!==parcelId||fields?.CO_NO!==county.sourceCountyValue)
  return {status:'no_exact_match',reason:'Returned county or PARCEL_ID differs from the approved parcel'};
 const declared=data.crs?.properties?.name;
 if((data.crs!=null&&!['EPSG:4326','urn:ogc:def:crs:OGC:1.3:CRS84','urn:ogc:def:crs:EPSG::4326'].includes(declared))||
   (data.spatialReference!=null&&(data.spatialReference.latestWkid??data.spatialReference.wkid)!==4326))
  return {status:'invalid_geometry',reason:'The response declares an unexpected CRS'};
 let acres;
 try{acres=geometryAcres(feature.geometry);}catch{return {status:'invalid_geometry',reason:'Geometry failed WGS84 coordinate or polygon topology checks'};}
 const legal=String(fields.S_LEGAL??'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
 const matches=/^OAK HILLS ESTATES(?: S D| SD)? (?:MB ?4 (?:P|PG|PAGE) ?45 )?BL(?:K|OCK) F LOT 24$/.test(legal);
 const surface=/^(?:00|0000)$/.test(String(fields.DOR_UC??''));
 const checked={parcelId,countyCode:fields.CO_NO,parcelNumber:fields.PARCELNO??null,situs:fields.PHY_ADDR1||null,
  legalDescription:fields.S_LEGAL??null,legalMatch:matches,geometryValid:true,crs:'EPSG:4326',polygonAcres:acres,
  sourceAcres:Number.isFinite(fields.LND_SQFOOT)&&fields.LND_SQFOOT>0?fields.LND_SQFOOT/43560:null};
 if(!surface||!matches)return {...checked,status:'needs_review',reason:!surface?'Vacant surface classification not corroborated':'Cadastral legal description does not exactly corroborate the Clerk lot'};
 return {...checked,status:'verified',geometry:feature.geometry};
}

const appraiserReview={
 revision:'2026-11-22-public-access',
 checkedOn:'2026-11-22',
 status:'unavailable',
 source:'https://apps.putnam-fl.com/pa/property/',
 rollSource:'https://apps.putnam-fl.com/bocc/countyopendatapublic/main.php',
 reason:'The property search timed out and the official 2026 assessment roll download returned HTTP 503.',
 missing:'Exact appraiser record, complete legal description, land use, improvement indicators, assessment acreage and ownership.'
};

export async function putnamStatus(storage,now=Date.now,{includeGeometry=false}={}){
 const checkpoint=(await storage.read(key))?.data;
 let remaining=null,parcelQuotaAvailable=false;
 try{
  const budget=await readCountyBudget(storage,now);
  const total=budget?.total??0;
  if(Number.isSafeInteger(total)&&total>=0)remaining=Math.max(0,SHARED_COUNTY_DAILY_LIMIT-total);
  parcelQuotaAvailable=(budget?.counties?.[dataset]??0)===0;
 }catch{/* Fail closed if the budget cannot be read. */}
 const retryable=!checkpoint||checkpoint.status==='quota_unavailable';
 const result=checkpoint?.result;
 const interrupted=checkpoint?.status==='in_progress'&&now()-Date.parse(checkpoint.startedAt)>60000;
 const status=interrupted?'needs_review':retryable?(remaining>0&&parcelQuotaAvailable?'ready':'quota_unavailable'):checkpoint.status;
 return {...PUTNAM,remaining,limit:SHARED_COUNTY_DAILY_LIMIT,status,canRun:status==='ready',
  checkedAt:checkpoint?.checkedAt??null,appraiserReview,result:result?{...result,geometry:includeGeometry&&result.status==='verified'?result.geometry:undefined}:null,
  reason:interrupted?'Interrupted before a receipt was saved. Checkpoint retained for owner review.':
   status==='quota_unavailable'?remaining===null?'Shared quota could not be read.':
    !parcelQuotaAvailable?'Putnam has used its request allowance today.':'The shared daily GIS quota is exhausted.':result?.reason??null};
}

async function readSource(response){
 const reader=response.body.getReader(),chunks=[];
 let bytes=0;
 for(;;){
  const {value,done}=await reader.read();
  if(done)break;
  bytes+=value.byteLength;
  if(bytes>256*1024){await reader.cancel();throw Error('Provider response too large');}
  chunks.push(Buffer.from(value));
 }
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export async function verifyPutnamOnce(storage,{fetcher=fetch,now=Date.now}={}){
 const previous=await storage.read(key);
 if(previous&&previous.data.status!=='quota_unavailable')return putnamStatus(storage,now);
 const state={status:'in_progress',requestId,startedAt:new Date(now()).toISOString(),url,params};
 let etag=await storage.write(key,state,previous?.etag??null);
 if(!etag)return putnamStatus(storage,now);
 let budget;
 try{
  budget=await reserveCountyRequest(storage,dataset,{shared:SHARED_COUNTY_DAILY_LIMIT,county:1},now);
 }catch(error){
  // A definitive quota rejection made no reservation. Unknown outcomes stay held.
  if(error.code==='quota_reached'&&new Date(now()).toISOString().slice(0,10)===state.startedAt.slice(0,10))
   await storage.write(key,{...state,status:'quota_unavailable'},etag);
  throw error;
 }
 state.quotaReceipt={day:state.startedAt.slice(0,10),total:budget.total,county:budget.counties[dataset],reserved:1};
 etag=await storage.write(key,state,etag);
 if(!etag)throw Error('Verification checkpoint changed before dispatch');
 let raw=null,httpStatus=null,result;
 const signal=AbortSignal.timeout(8000);
 try{
  const response=await fetcher(url,{signal,redirect:'error',cache:'no-store'});
  httpStatus=response.status;
  raw=await readSource(response);
  result=response.ok?validatePutnam(raw):{status:'source_unavailable',reason:'Provider HTTP '+httpStatus};
 }catch(error){
  result={status:'source_unavailable',reason:signal.aborted||error.name==='TimeoutError'?'Provider request timed out':'Provider request failed or returned unreadable data'};
 }
 const saved={...state,status:result.status,checkedAt:new Date(now()).toISOString(),httpStatus,raw,result};
 if(!await storage.write(key,saved,etag))throw Error('Verification receipt could not be saved');
 return putnamStatus(storage,now);
}

// Read-only projection. The historical receipt has no exact dispatch or reservation timestamp.
export async function putnamActivity(read){
 const audit=appraiserReview.status==='unavailable'?[{
  id:'putnam-appraiser-'+appraiserReview.revision,at:appraiserReview.checkedOn,timePrecision:'day',
  county:dataset,parcelId,agent:'Parcel research',from:'Putnam Property Appraiser',to:'Owner review',
  type:'source_access_failed',status:'error',source:appraiserReview.source,receiptId:appraiserReview.revision,
  quotaImpact:null,message:appraiserReview.reason
 }]:[];
 const receipt=await read(key);
 const result=receipt?.result;
 const at=receipt?.checkedAt;
 if(receipt?.requestId!==requestId||!result||!Number.isFinite(Date.parse(at)))return audit;
 const base={at:new Date(at).toISOString(),agent:'Official GIS',from:'FloridaGIO',to:'Stored result',county:dataset,
  parcelId,source:source.url,receiptId:requestId};
 const event={...base,id:'putnam-'+requestId+'-result',type:'verification_result',
  quotaImpact:receipt.quotaReceipt?.reserved===1?1:null,
  status:result.status==='verified'?'success':result.status==='source_unavailable'?'error':'warning',
  message:'Putnam GIS receipt · '+result.status.replaceAll('_',' ')+(receipt.httpStatus?' · HTTP '+receipt.httpStatus:'')+
   (result.reason?' · '+result.reason:'')};
 if(result.geometryValid===true&&result.crs==='EPSG:4326'&&Number.isFinite(result.polygonAcres))
  return [...audit,event,{...base,id:'putnam-'+requestId+'-geometry',type:'geometry_validated',status:'success',quotaImpact:null,
   message:'Exact parcel · EPSG:4326 polygon validated · '+result.polygonAcres.toFixed(4)+' calculated acres'}];
 return [...audit,event];
}
