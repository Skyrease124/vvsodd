// Connector transport is injected. The owner dashboard never invokes it.
import {connectorFor,polygonEvidence} from './brain-gis-connectors.mjs';
import {countyPilotDefinition,pilotCountyIds,pilotIdentifier} from './brain-gis-pilot-registry.mjs';

const aliases={
 parcel:['parcelnumber','parcelnum','parcelno','parcelid','propertyid','apn','pin'],
 address:['situsaddress','locaddress','siteaddress','propertyaddress','address'],
 acres:['acreage','acres','gisacres'], zoning:['zoning','zone','zoningcode'],
 geometry:['geometry','geojson'], latitude:['latitude','lat'],longitude:['longitude','lon','lng']
};
const arcgis=new Set(['feature-server','map-server']);
const registry=Object.freeze({
 'MI-wayne':{mode:'existing-worker',format:'feature-server'},
 'CO-larimer':{mode:'research-only',format:'map-server'}
 });
export const operationCountyIds=()=>[...Object.keys(registry),...pilotCountyIds()];

export function countyOperation(id){
 const pilot=countyPilotDefinition(id);
 if(pilot)return {id,county:pilot.county,state:pilot.state,attribution:pilot.attribution??null,mode:pilot.operationMode,source:pilot.source,authority:pilot.authority,format:pilot.format,
  nativeWkid:pilot.nativeWkid,enabled:pilot.enabled,pilotLimit:3};
 const config=Object.hasOwn(registry,id)?registry[id]:null,existing=connectorFor(id);
 return config?{id,...config,source:existing.source,enabled:false}:null;
}

export function inspectFields(names,configured={}){
 const byKey=name=>name.toLowerCase().replace(/[^a-z0-9]/g,'');
 const fields={};
 const ambiguous=[];
 for(const [key,options] of Object.entries(aliases)){
  const matches=configured[key]===undefined
   ? names.filter(name=>options.includes(byKey(name)))
   : names.filter(name=>name===configured[key]);
  if(matches.length>1)ambiguous.push(key);
  if(matches.length===1)fields[key]=matches[0];
 }
 return {fields,ambiguous,compatible:!!(fields.parcel&&fields.address)&&!ambiguous.some(key=>key==='parcel'||key==='address')};
}

export function connectorError(code,message,scope='parcel'){
 return Object.assign(new Error(message),{code,scope});
}

function parseCsv(raw){
 const records=[];
 let values=[],field='',quoted=false,closed=false;
 for(let i=0;i<=raw.length;i++){
  const c=raw[i];
  if(quoted){
   if(c===undefined)throw connectorError('invalid_csv','Unclosed CSV field','source');
   if(c==='"'&&raw[i+1]==='"'){field+='"';i++;}
   else if(c==='"'){quoted=false;closed=true;}
   else field+=c;
   continue;
  }
  if(c===','||c==='\n'||c==='\r'||c===undefined){
   values.push(field);
   field='';closed=false;
   if(c!==','){
    if(values.some(v=>v!==''))records.push(values);
    values=[];
    if(c==='\r'&&raw[i+1]==='\n')i++;
   }
  }else if(c==='"'&&!field&&!closed)quoted=true;
  else if(c==='"'||closed)throw connectorError('invalid_csv','Invalid CSV quoting','source');
  else field+=c;
 }
 const [header,...rows]=records;
 if(!header?.length||new Set(header).size!==header.length||rows.some(row=>row.length!==header.length))
  throw connectorError('invalid_csv','Inconsistent CSV fields','source');
 return rows.map(row=>Object.fromEntries(header.map((name,i)=>[name,row[i]])));
}

async function bodyText(response){
 const max=8*1024*1024;
 if(!response.body||Number(response.headers.get('Content-Length'))>max)
  throw connectorError('response_limit','Provider response exceeds download limit','source');
 const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});
 let bytes=0,text='';
 try{
  while(true){
   const chunk=await reader.read();
   if(chunk.done)break;
   bytes+=chunk.value.byteLength;
   if(bytes>max)throw connectorError('response_limit','Provider response exceeds download limit','source');
   text+=decoder.decode(chunk.value,{stream:true});
  }
  return text+decoder.decode();
 }finally{
  await reader.cancel().catch(()=>{});
 }
}

const identity=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9.-]{0,39}$/.test(value)?value:'';
const street=value=>typeof value==='string'?value.split(',')[0].trim().toUpperCase().replace(/\./g,'').replace(/\s+/g,' ')
 .replace(/\b(STREET|ROAD|AVENUE|BOULEVARD|DRIVE)$/,word=>({STREET:'ST',ROAD:'RD',AVENUE:'AVE',BOULEVARD:'BLVD',DRIVE:'DR'})[word]):'';

export function createCountyConnector(config,{reserve,fetcher=fetch,now=()=>new Date()}){
 if(typeof reserve!=='function'||!/^([A-Z]{2})-[a-z0-9_-]+$/.test(config.id)||!['feature-server','map-server','geojson','csv'].includes(config.format))
  throw Error('Invalid reviewed connector configuration');
 const source=new URL(config.source);
 const official=new URL(config.authority);
 if([source,official].some(url=>url.protocol!=='https:'||url.username||url.password||url.hash||url.search||url.port)
    ||!config.reviewedOrigin||source.origin!==config.reviewedOrigin)
  throw Error('Source origin requires explicit review');
 const isArc=arcgis.has(config.format);
 const canonical=config.identifierFormat?value=>pilotIdentifier(config.identifierFormat,value):identity;
 const jurisdiction=config.jurisdiction;
 if(jurisdiction&&(!isArc||!/^\w+$/.test(jurisdiction.field)||!Number.isSafeInteger(jurisdiction.value)))
  throw Error('A valid county discriminator is required');
 if(isArc&&!new RegExp('/'+(config.format==='feature-server'?'FeatureServer':'MapServer')+'/[0-9]+$','i').test(source.pathname))
  throw Error('Expected a specific ArcGIS layer');
 const bounded=Array.isArray(config.bounds)&&config.bounds.length===4&&config.bounds.every(Number.isFinite)&&
  config.bounds[0]>=-180&&config.bounds[2]<=180&&config.bounds[1]>=-90&&config.bounds[3]<=90&&
  config.bounds[0]<config.bounds[2]&&config.bounds[1]<config.bounds[3];
 if(!bounded)throw Error('A reviewed county bounding box is required');

 async function request(url,parse,stage){
  await reserve(config.id,stage);
  try{
   const res=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(8000)});
   if(!res.ok)throw connectorError('http_'+res.status,'Official source HTTP '+res.status,'source');
   return parse(await bodyText(res));
  }catch(error){
   if(error.scope)throw error;
   throw connectorError('transport_or_payload','Source unavailable or response unreadable','source');
  }
 }
 const json=raw=>JSON.parse(raw);
 function geoRows(data){
  if(data?.type!=='FeatureCollection'||!Array.isArray(data.features)||data.crs)
   throw connectorError('unsupported_geojson','Expected an RFC 7946 GeoJSON FeatureCollection','source');
  return data.features.map(feature=>({attributes:feature?.properties,geometry:feature?.geometry}));
 }
 let snapshot=null;
 async function download(){
  if(!snapshot)snapshot=request(source,config.format==='csv'?raw=>parseCsv(raw).map(attributes=>({attributes})):raw=>geoRows(json(raw)))
   .catch(error=>{snapshot=null;throw error;});
  return snapshot;
 }
 async function discover(){
  const data=isArc?await request(new URL('?f=json',source),json,'schema'):await download();
  if(isArc&&(data.error||!Array.isArray(data.fields)||data.geometryType!=='esriGeometryPolygon'||
    (data.capabilities&&!data.capabilities.split(',').some(value=>value.trim().toLowerCase()==='query'))))
   throw connectorError('unsupported_schema','Official layer does not expose queryable parcels','source');
  const native=data?.extent?.spatialReference??data?.spatialReference;
  const reported=[native?.wkid,native?.latestWkid].filter(value=>value!=null);
  const expected=config.nativeWkid===2236?[2236,102658]:[config.nativeWkid,...(config.nativeAliases||[])];
  if(config.nativeWkid&&(!reported.length||reported.some(value=>!expected.includes(value))))
   throw connectorError('native_crs_mismatch','Layer did not declare its reviewed native spatial reference','source');
  const names=isArc?data.fields.map(field=>field.name).filter(name=>typeof name==='string'):
   [...new Set(data.flatMap(row=>Object.keys(row.attributes||{})))];
  const schema=inspectFields(names,config.fields);
  if(isArc&&(!data.fields.some(field=>field.name===schema.fields.parcel&&field.type==='esriFieldTypeString'&&
    (!config.identifierFormat||field.length===(config.parcelFieldLength??13)))||
    (config.identifierFormat&&!data.fields.some(field=>field.name===schema.fields.address&&field.type==='esriFieldTypeString'))))
   schema.compatible=false;
  if(jurisdiction&&!data.fields.some(field=>field.name===jurisdiction.field&&['esriFieldTypeDouble','esriFieldTypeInteger','esriFieldTypeSmallInteger'].includes(field.type)))schema.compatible=false;
  return {dataset:config.id,source:source.href,authority:official.href,observedAt:now().toISOString(),
   reliability:schema.compatible?'reachable_candidate':'owner_review',schema,
   capabilities:{nativeWkid:native?.latestWkid??native?.wkid??null,datumTransformation:data?.supportsDatumTransformation===true,
    geometry:isArc?'esriGeometryPolygon':config.format==='geojson'?'GeoJSON Polygon':schema.fields.geometry||null,
    pagination:isArc&&data.advancedQueryCapabilities?.supportsPagination===true,
    maxRecordCount:isArc&&Number.isSafeInteger(data.maxRecordCount)?data.maxRecordCount:null,
    configuredRequestLimit:config.requestLimit??null}};
 }
 async function match(record,discovery){
  if(record.dataset!==config.id||!canonical(record.p)||!record.i)throw connectorError('invalid_identity','Invalid dataset parcel identity');
  const schema=discovery?.schema;
  if(discovery?.dataset!==config.id||discovery?.source!==source.href||!schema?.compatible)
   throw connectorError('unreviewed_schema','Source fields need owner review','source');
  const {fields}=schema;
  let matches;
  if(isArc){
   if(!Object.values(fields).every(field=>/^[A-Za-z_][A-Za-z0-9_]*$/.test(field)))
    throw connectorError('unsupported_fields','Source field names need review','source');
   const where=fields.parcel+" = '"+canonical(record.p)+"'"+(jurisdiction?' AND '+jurisdiction.field+' = '+jurisdiction.value:'');
   const outFields=[...new Set([...Object.values(fields),...(jurisdiction?[jurisdiction.field]:[])])].join(',');
   const query=new URLSearchParams({f:'json',where,outFields,
    returnGeometry:'true',outSR:'4326',resultRecordCount:'2'});
   const data=await request(new URL(source.href+'/query?'+query),json,'parcel_verification');
   if(data.error||data.exceededTransferLimit||!Array.isArray(data.features))
    throw connectorError('incomplete_results','GIS results incomplete or unavailable','source');
   const isWgs84=ref=>{
    const reported=[ref?.wkid,ref?.latestWkid].filter(value=>value!=null);
    return reported.length>0&&reported.every(value=>value===4326);
   };
   // Empty results can legitimately omit geometry metadata. Any returned
   // geometry must explicitly declare WGS84 with no contradictory feature CRS.
   if(data.features.length&&(!isWgs84(data.spatialReference)||
      data.features.some(feature=>feature?.geometry?.spatialReference&&!isWgs84(feature.geometry.spatialReference))))
    throw connectorError('unsupported_crs','Provider did not return consistent WGS84 geometry','source');
   matches=data.features;
  }else matches=(await download()).filter(row=>row.attributes?.[fields.parcel]===record.p);
  if(matches.length!==1)
   throw connectorError(matches.length?'duplicate':'missing',matches.length?'Multiple official parcel matches':'No official parcel matched the identifier');
  const selected=matches[0];
  if(jurisdiction&&selected.attributes?.[jurisdiction.field]!==jurisdiction.value)
   throw connectorError('county_mismatch','Official response does not identify the intended county');
  if(canonical(selected.attributes?.[fields.parcel])!==canonical(record.p))throw connectorError('id_mismatch','Official parcel identifier differs');
  return selected;
 }
 async function verify(record,discovery){
  const candidate=await match(record,discovery),{fields}=discovery.schema;
  const original=street(record.a);
  if(!/^\d+\s/.test(original)||street(candidate.attributes?.[fields.address])!==original)
   throw connectorError('address_mismatch','Official situs address does not corroborate the parcel');
  let geometry=candidate.geometry;
  if(config.format==='csv'&&fields.geometry){
   try{geometry=JSON.parse(candidate.attributes[fields.geometry]);}catch{geometry=null;}
  }
  const rings=isArc?geometry?.rings:geometry?.type==='Polygon'?geometry.coordinates:null;
  let evidence;
  try{evidence=polygonEvidence(rings,config.bounds);}catch(error){throw connectorError('invalid_polygon',error.message);}
  return {type:'county_research_evidence',dataset:config.id,recordId:record.i,parcelId:record.p,
   source:source.href,checkedAt:now().toISOString(),outputWkid:4326,geometry:evidence,publicationAllowed:false};
 }
 return {discover,match,verify};
}
