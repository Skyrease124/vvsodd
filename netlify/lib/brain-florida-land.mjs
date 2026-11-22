import {createHash} from 'node:crypto';
import registry from './data/florida-gis-registry.json' with {type:'json'};
import {polygonEvidence} from './brain-gis-connectors.mjs';
import {countyPilotDefinition,pilotCountyIds,pilotIdentifier} from './brain-gis-pilot-registry.mjs';

export const LAND_SOURCES=Object.freeze({
 'floridagio':{kind:'parcel',url:registry.sources['floridagio-cadastral'].url,agency:'FloridaGIO',
  format:['arcgis','geojson'],restrictions:registry.sources['floridagio-cadastral'].restrictions},
 'fdor-nal':{kind:'assessment',url:'https://www.floridarevenue.com/property/Pages/DataPortal_RequestAssessmentRollGISData.aspx',
  agency:'Florida Department of Revenue',format:['csv'],restrictions:'Use an approved assessment roll extract and observe confidentiality restrictions.'},
 'miami-surplus':{kind:'sale',geoid:'12086',type:'surplus',
  url:'https://www.miamidade.gov/global/business/realestate/surplus-real-properties-for-sale.page',
  agency:'Miami-Dade County',format:['csv'],restrictions:'Approved offline listing extracts. The county links to an external auction platform.'},
 'palm-beach-tax-deed':{kind:'sale',geoid:'12099',type:'tax-deed',
  url:'https://www.mypalmbeachclerk.com/departments/courts/tax-deeds/sale-information',
  agency:'Palm Beach County Clerk',evidenceOrigins:['https://taxdeed.mypalmbeachclerk.com'],format:['csv'],restrictions:'Approved offline notice extracts. Public search and auction participation have separate rules.'},
 'florida-dep-surplus':{kind:'sale',type:'government-owned-offering',
  url:'https://floridadep.gov/lands/bureau-real-estate-services/content/surplus-properties-sale',
  agency:'Florida Department of Environmental Protection',format:['csv'],
  restrictions:'Approved offline listing extracts. Sale eligibility and bidding terms apply to individual offerings.'}
});
const counties=new Map(registry.counties.map(county=>[county.geoid,county]));
const formats=new Map(pilotCountyIds().map(id=>{
 const config=countyPilotDefinition(id);
 return [config.county,config.identifierFormat];
}));
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const clean=(value,max=300)=>typeof value==='string'?value.trim().slice(0,max):'';
const time=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value))
 ?new Date(value).toISOString():null;
const amount=value=>/^[0-9]+(?:\.\d+)?$/.test(String(value??''))&&Number.isFinite(Number(value))?Number(value):null;
const address=value=>{
 const normalized=clean(value).toUpperCase().replace(/[.,]/g,'').replace(/\s+/g,' ');
 return /^\d+\s+\S/.test(normalized)?normalized:null;
};
const legal=value=>clean(value,1000).toUpperCase().replace(/\s+/g,' ')||null;
const lookup=(state,geoid)=>state?.geoid===geoid?state:null;

function canonicalId(county,value,classification){
 if(typeof value!=='string'||!/^[A-Za-z0-9][A-Za-z0-9 ./_-]{0,99}$/.test(value))throw Error('invalid_parcel_identifier');
 const format=formats.get(county.name);
 const normalized=classification==='mineral'?value:format?pilotIdentifier(format,value):value;
 if(!normalized)throw Error('unsupported_county_identifier');
 return normalized;
}

function evidenceUrl(source,value){
 const url=new URL(value);
 const allowed=new URL(source.url);
 if(url.protocol!=='https:'||![allowed.origin,...(source.evidenceOrigins||[])].includes(url.origin)||url.username||url.password||url.search||url.hash)
  throw Error('unapproved_evidence_url');
 if(!['sale','assessment'].includes(source.kind)&&url.pathname!==allowed.pathname)throw Error('unapproved_evidence_path');
 return url.href;
}

function record(source,row,county,receipt){
 const sale=source.kind==='sale', assessment=source.kind==='assessment';
 const attributes=row.attributes||row.properties||row;
 const countyCode=attributes.CO_NO===undefined?null:String(attributes.CO_NO);
 if(sale?(attributes.GEOID!==county.geoid||attributes.FDOR_CODE!==county.fdorCode)
  :(countyCode!==(assessment?county.fdorCode:String(county.sourceCountyValue))))throw Error('county_identifier_mismatch');
 const rawId=attributes[sale||assessment?'PARCEL_ID':'PARCELNO'];
 // A source must supply an independently reviewed classification. Unknown is held for review.
 const classification=county.name==='Santa Rosa'&&/M$/i.test(rawId??'')?'mineral':
  ['surface','mineral'].includes(attributes.CLASSIFICATION)?attributes.CLASSIFICATION:'unknown';
 const result={schemaVersion:1,state:'FL',county:county.name,geoid:county.geoid,fdorCode:county.fdorCode,
  parcelId:canonicalId(county,rawId,classification),originalParcelId:rawId,classification,
  situs:address(attributes[sale?'SITUS_ADDRESS':'PHY_ADDR1']),legalReference:legal(attributes.LEGAL_REFERENCE),
  evidence:{sourceId:receipt.sourceId,agency:source.agency,url:evidenceUrl(source,attributes.EVIDENCE_URL||source.url),
   retrievedAt:receipt.retrievedAt,fixture:receipt.fixture}};
 if(sale){
  const listingId=attributes.LISTING_ID,eventId=attributes.EVENT_ID;
  const identifier=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9 ./_-]{0,119}$/.test(value);
  const status=clean(attributes.STATUS);
  const available=attributes.AVAILABLE==='true'||attributes.AVAILABLE===true;
  if(!identifier(listingId)||!identifier(eventId)||!['scheduled','available','postponed','canceled','sold','expired'].includes(status)||
    !attributes.EVIDENCE_URL||result.evidence.url===source.url)throw Error('missing_sale_evidence');
  const auctionAt=time(attributes.AUCTION_AT),deadline=time(attributes.DEADLINE);
  if((source.type==='tax-deed'&&status==='scheduled'&&!auctionAt)||
    (attributes.DEADLINE&&!deadline)||(attributes.AUCTION_AT&&!auctionAt))throw Error('invalid_sale_dates');
  return {...result,type:source.type,listingId,eventId,status,available,auctionAt,deadline,
   askingPrice:amount(attributes.ASKING_PRICE),openingBid:amount(attributes.OPENING_BID),minimumBid:amount(attributes.MINIMUM_BID)};
 }
 let geometry=null,geometryAcres=null;
 if(!assessment&&classification==='surface'){
  if(receipt.wkid!==4326)throw Error('unsupported_coordinate_system');
  if(!row.geometry?.rings&&row.geometry?.type!=='Polygon')throw Error('unsupported_polygon');
  const {rings,acres}=polygonEvidence(row.geometry?.rings||row.geometry.coordinates,[-88,24,-79.8,31.1]);
  geometry={type:'Polygon',coordinates:rings};
  geometryAcres=acres;
 }
 return {...result,geometry,crs:geometry?'EPSG:4326':null,acreage:amount(attributes.ACREAGE),
  geometryAcres,zoning:clean(attributes.ZONING)||null,vacant:attributes.VACANT===true||attributes.VACANT==='true'};
}

export function matchLand(state,sale,now=Date.now()){
 const parcels=state.parcels.filter(p=>p.geoid===sale.geoid&&p.parcelId===sale.parcelId&&p.evidence.fixture===sale.evidence.fixture);
 const geometry=parcels.filter(p=>p.geometry);
 if(sale.classification==='mineral'||parcels.some(p=>p.classification==='mineral'))return {reason:'mineral_rights'};
 if(geometry.length!==1)return {reason:geometry.length?'ambiguous_parcel':'missing_verified_polygon'};
 const parcel=geometry[0];
 const assessments=parcels.filter(p=>p.evidence.sourceId==='fdor-nal');
 if(assessments.length>1)return {reason:'ambiguous_assessment'};
 const addresses=[sale.situs,parcel.situs,...assessments.map(p=>p.situs)].filter(Boolean);
 const references=[sale.legalReference,parcel.legalReference,...assessments.map(p=>p.legalReference)].filter(Boolean);
 if(new Set(addresses).size>1||new Set(references).size>1)return {reason:'conflicting_identity_evidence'};
 const confirmedAddress=sale.situs&&parcel.situs;
 const documentedVacant=parcel.vacant&&sale.classification==='surface'&&sale.legalReference&&
  sale.legalReference===parcel.legalReference&&assessments.some(p=>p.classification==='surface'&&p.legalReference===sale.legalReference);
 if(!confirmedAddress&&!documentedVacant)return {reason:'insufficient_identity_evidence'};
 const closing=sale.deadline||sale.auctionAt;
 const active=sale.available&&['available','scheduled'].includes(sale.status)&&(!closing||Date.parse(closing)>now);
 return {parcel,evidenceHash:digest([parcel,assessments]),verified:true,active,reason:active?null:'inactive_sale'};
}

const empty=geoid=>({schemaVersion:1,geoid,parcels:[],sales:{},receipts:{},skipped:[],ingested:0});
export const LAND_BATCH_LIMIT=100;
const LAND_STATE_LIMIT=4*1024*1024;

// Each receipt describes one pinned, immutable local batch. New editions get new receipts.
export function importLandBatch(previous,input,{limit=LAND_BATCH_LIMIT,now=Date.now()}={}){
 const county=counties.get(input.geoid);
 const source=Object.hasOwn(LAND_SOURCES,input.sourceId)?LAND_SOURCES[input.sourceId]:null;
 const retrievedAt=time(input.retrievedAt);
 if(!county||!source||source.geoid&&source.geoid!==input.geoid||!source.format.includes(input.format)||
   !retrievedAt||Date.parse(retrievedAt)>now||typeof input.fixture!=='boolean'||!Array.isArray(input.rows)||
   !input.rows.length||input.rows.length>LAND_BATCH_LIMIT||!Number.isInteger(limit)||limit<1||limit>LAND_BATCH_LIMIT||
   (source.kind==='parcel'&&input.wkid!==4326))throw Error('invalid_import_manifest');
 if(previous&&(!lookup(previous,input.geoid)||previous.schemaVersion!==1))throw Error('county_checkpoint_mismatch');
 const state=structuredClone(previous||empty(input.geoid));
 const key=digest([input.sourceId,input.format,retrievedAt,input.fixture,input.wkid,input.rows]);
 const receipt=state.receipts[key]||{sourceId:input.sourceId,importedAt:new Date(now).toISOString(),retrievedAt,fixture:input.fixture,wkid:input.wkid??null,
  cursor:0,total:input.rows.length,skipped:0,requests:0};
 for(const row of input.rows.slice(receipt.cursor,receipt.cursor+limit)){
  try{
   const item=record(source,row,county,receipt);
   if(source.kind==='sale'){
    const id=digest([item.geoid,item.parcelId,input.sourceId,item.listingId,item.eventId,item.evidence.fixture]);
    const history=state.sales[id]||[];
    const revision=digest(item);
    if(!history.some(entry=>entry.revision===revision)){
     state.sales[id]=[...history,{revision,item}].sort((a,b)=>a.item.evidence.retrievedAt.localeCompare(b.item.evidence.retrievedAt));
    }
   }else{
    const same=item0=>item0.evidence.sourceId===item.evidence.sourceId&&item0.parcelId===item.parcelId&&item0.evidence.fixture===item.evidence.fixture;
    const newer=state.parcels.some(p=>same(p)&&p.evidence.retrievedAt>item.evidence.retrievedAt);
    if(!newer){
     state.parcels=state.parcels.filter(p=>!same(p)||p.evidence.retrievedAt===item.evidence.retrievedAt);
     if(!state.parcels.some(p=>same(p)&&digest(p)===digest(item)))state.parcels.push(item);
    }
   }
   state.ingested++;
  }catch(error){
   const attributes=row?.attributes||row?.properties||row;
   state.skipped.push({receipt:key,row:receipt.cursor,parcelId:clean(attributes?.PARCEL_ID??attributes?.PARCELNO,100)||null,
    sourceId:input.sourceId,at:new Date(now).toISOString(),
    reason:/^[a-z_]+$/.test(error.message)?error.message:'invalid_source_record'});
   receipt.skipped++;
  }
  receipt.cursor++;
 }
 if(receipt.cursor===receipt.total)receipt.completedAt??=new Date(now).toISOString();
 state.receipts[key]=receipt;
 if(Buffer.byteLength(JSON.stringify(state))>LAND_STATE_LIMIT)throw Error('county_storage_limit');
 return {state,receipt:key};
}

export function landSummary(state,now=Date.now()){
 const records=Object.entries(state.sales).map(([id,history])=>{
  const {revision,item,approval}=history.at(-1);
  const match=matchLand(state,item,now);
  const conflict=history.filter(entry=>entry.item.evidence.retrievedAt===item.evidence.retrievedAt).length>1;
  if(conflict)match.reason='conflicting_sale_versions';
  const eligible=match.active===true&&!conflict&&!item.evidence.fixture;
  const reviewToken=eligible?digest([revision,match.evidenceHash]):null;
  const parcelEvidence=match.parcel?{...match.parcel.evidence,situs:match.parcel.situs,
   legalReference:match.parcel.legalReference,crs:match.parcel.crs}:null;
  return {id,revision,reviewToken,item,parcelEvidence,reason:match.reason,verifiedPolygon:match.verified===true,
   acreage:match.parcel?.acreage??match.parcel?.geometryAcres??null,
   sourceAcreage:match.parcel?.acreage??null,geometryAcres:match.parcel?.geometryAcres??null,vacant:match.parcel?.vacant??false,
   eligible,approved:eligible&&approval?.evidenceHash===match.evidenceHash,versions:history.length};
 });
 const receipts=Object.values(state.receipts).sort((a,b)=>b.retrievedAt.localeCompare(a.retrievedAt));
 return {records,receipts,skipped:state.skipped,ingested:state.ingested,matched:records.filter(r=>r.verifiedPolygon).length,
  unmatched:records.filter(r=>!r.verifiedPolygon).length,approved:records.filter(r=>r.approved).length,
  expiredOrCanceled:records.filter(r=>['expired','canceled'].includes(r.item.status)||r.reason==='inactive_sale'&&
   Boolean(r.item.deadline||r.item.auctionAt)&&Date.parse(r.item.deadline||r.item.auctionAt)<=now).length,
  lastIngestion:receipts.map(r=>r.completedAt).filter(Boolean).sort().at(-1)??null,published:0,requests:0};
}

export function approveLandReview(previous,{id,revision,reviewToken,reviewer},now=Date.now()){
 if(!previous||!reviewer)throw Error('county_checkpoint_unavailable');
 const state=structuredClone(previous);
 const current=landSummary(state,now).records.find(r=>r.id===id);
 if(!current?.eligible||current.revision!==revision||current.reviewToken!==reviewToken)throw Error('stale_or_unverified_listing');
 const entry=state.sales[id].at(-1);
 const {evidenceHash}=matchLand(state,entry.item,now);
 entry.approval||={reviewer,at:new Date(now).toISOString(),evidenceHash};
 if(entry.approval.evidenceHash!==evidenceHash)entry.approval={reviewer,at:new Date(now).toISOString(),evidenceHash};
 return state;
}

export function filterLandReview(records,{county,type,vacant,minimumPrice,maximumPrice,minimumAcreage,auctionFrom,auctionTo,verifiedOnly}={}){
 return records.filter(({item,verifiedPolygon,acreage,vacant:isVacant})=>{
  const price=item.askingPrice??item.openingBid??item.minimumBid;
  return (!county||item.geoid===county)&&(!type||item.type===type)&&(!vacant||isVacant)&&(!verifiedOnly||verifiedPolygon)&&
   (minimumAcreage==null||acreage!=null&&acreage>=minimumAcreage)&&
   (minimumPrice==null||price!=null&&price>=minimumPrice)&&(maximumPrice==null||price!=null&&price<=maximumPrice)&&
   (!auctionFrom||item.auctionAt&&item.auctionAt>=auctionFrom)&&(!auctionTo||item.auctionAt&&item.auctionAt<=auctionTo);
 });
}
