// No route, timer, or existing pilot calls this boundary. A future route must
// derive config, owner approval, and dataset rows on the server.
import {createCountyConnector,connectorError} from './brain-gis-universal.mjs';
import {reserveCountyRequest,SHARED_COUNTY_DAILY_LIMIT} from './brain-gis-county-worker.mjs';

export async function publishCountyCorrection({config,record,evidence,authorization,storage,discovery,fetcher,now=Date.now}){
 if(config.id==='MI-wayne'||config.id==='CO-larimer'||config.mode!=='preview-publication'||config.enabled!==true||
    authorization?.owner!==true||authorization?.preview!==true||authorization?.confirmed!==true||
    authorization.dataset!==config.id||authorization.recordId!==record?.i||authorization.parcelId!==record?.p||
    record?.dataset!==config.id||record.g||record.cx||
    evidence?.type!=='county_research_evidence'||evidence.dataset!==config.id||
    evidence.recordId!==record.i||evidence.parcelId!==record.p||evidence.source!==config.source||
    typeof evidence.checkedAt!=='string'||authorization.evidenceAt!==evidence.checkedAt)
  throw connectorError('publication_denied','Exact owner approval and separate county publication activation are required','control');

 const permit=config.approval?{...config.approval,phase:'publication'}:null;
 if(config.operationMode==='pilot-prepared'&&(!permit||authorization.permitId!==permit.id||
    discovery?.dataset!==config.id||discovery?.source!==config.source))
  throw connectorError('publication_denied','A saved pilot schema and separate approval are required','control');
 const key='brain-map-county-v1-'+config.id;
 const initial=await storage.read(key);
 if(initial?.data?.records?.[record.i])return {status:'already_published',version:initial.data.version};
 const lockKey='brain-gis-publication-lease-v1-'+config.id;
 const lock=await storage.read(lockKey);
 if(Date.parse(lock?.data?.until)>now())throw connectorError('publication_busy','County publication is already running','control');
 const expires=now()+30000;
 const lease=await storage.write(lockKey,{until:new Date(expires).toISOString()},lock?.etag??null);
 if(!lease)throw connectorError('publication_busy','County publication is already running','control');
 try{
  const connector=createCountyConnector(config,{fetcher,now:()=>new Date(now()),
   reserve:()=>{
    if(now()>=expires)throw connectorError('publication_expired','Publication lease expired','control');
    return reserveCountyRequest(storage,config.id,{shared:SHARED_COUNTY_DAILY_LIMIT,county:config.requestLimit,permit},now);
   }});
  const fresh=await connector.verify(record,permit?discovery:await connector.discover());
  const {rings,bounds}=fresh.geometry;
  const [west,south,east,north]=bounds;
  const correction={i:record.i,p:record.p,g:rings,bb:bounds,cx:[(west+east)/2,(south+north)/2],
   verifiedGeometry:true,verifiedAt:fresh.checkedAt,evidenceUrl:fresh.source,estimatedAcres:fresh.geometry.acres};
  // Geometry and receipt commit together. CAS forbids duplicate publication
  // and preserves unrelated records if two different parcels finish at once.
  for(let attempt=0;attempt<5&&now()<expires;attempt++){
   const saved=await storage.read(key),base=saved?.data||{version:0,records:{},publicationHistory:[]};
   if(Object.hasOwn(base.records,record.i))return {status:'already_published',version:base.version};
   const version=base.version+1;
   const receipt={dataset:config.id,recordId:record.i,parcelId:record.p,at:fresh.checkedAt,source:fresh.source,action:'published',version};
   const updated={...base,version,records:{...base.records,[record.i]:correction},
    publicationHistory:[receipt,...(base.publicationHistory||[])].slice(0,300)};
   if(await storage.write(key,updated,saved?.etag??null))return {status:'published',version};
  }
  throw connectorError('publication_conflict','Verified correction could not be committed','control');
 }finally{
  await storage.write(lockKey,{until:null},lease);
 }
}
