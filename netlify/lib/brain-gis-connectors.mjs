// Reviewed source catalog. Discovery candidates are never executable configuration.
const catalog = {
  'MI-wayne': Object.freeze({
    id: 'MI-wayne', type: 'ArcGIS FeatureServer', status: 'Verified',
    source: 'https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Parcels_Current/FeatureServer/0',
    scope: 'Detroit only', compatibility: 'Existing guarded Wayne worker', lastTest: '2026-11-22T00:35:56Z'
  }),
  'CO-larimer': Object.freeze({
    id: 'CO-larimer', recordPrefix: 'CO|Larimer|', type: 'ArcGIS MapServer', status: 'Connector Ready', mode: 'test-only', enabled: false,
    source: 'https://maps1.larimer.org/arcgis/rest/services/MapServices/Parcels/MapServer/3',
    authority: 'https://www.larimer.gov/assessor', nativeWkid: 2876,
    parcelField: 'PARCELNUM', addressField: 'LOCADDRESS', objectField: 'OBJECTID_1',
    parcelPattern: /^\d{10}$/, bounds: Object.freeze([-106.25, 40.20, -104.90, 41.02]),
    compatibility: 'Exact parcel and situs address. Missing addresses, complex polygons, and county-edge cases require review.',
    lastTest: null,
    reason: 'County source and mapped sample confirmed. Unmapped sample validation and owner approval are pending.'
  })
};
export const connectorFor = id => Object.hasOwn(catalog,id) ? catalog[id] : null;

export function parcelId(value) {
  return typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9.-]{0,39}$/.test(value)
    ? value.toUpperCase().replace(/[.-]/g,'') : '';
}

function address(value) {
  return typeof value==='string' ? value.split(',')[0].trim().toUpperCase()
    .replace(/[.]/g,'').replace(/\s+/g,' ')
    .replace(/\bSTREET\b/g,'ST').replace(/\bAVENUE\b/g,'AVE').replace(/\bROAD\b/g,'RD')
    .replace(/\bBOULEVARD\b/g,'BLVD').replace(/\bDRIVE\b/g,'DR') : '';
}

export function polygonEvidence(rings, bounds=[-180,-90,180,90]) {
  const ring=rings?.[0];
  if(!Array.isArray(rings)||rings.length!==1||!Array.isArray(ring)||ring.length<4||ring.length>1000)throw Error('Unsupported polygon');
  const [west,south,east,north]=bounds;
  if(!ring.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>=west&&p[0]<=east&&p[1]>=south&&p[1]<=north))throw Error('Polygon outside expected bounds');
  if(!ring[0].every((v,i)=>v===ring.at(-1)[i]))throw Error('Open polygon');
  const [x0,y0]=ring[0];
  const coords=ring.map(([x,y])=>[(x-x0)*111195*Math.cos(y0*Math.PI/180),(y-y0)*111195]);
  let doubleArea=0;
  for(let i=1;i<coords.length;i++)doubleArea+=coords[i-1][0]*coords[i][1]-coords[i][0]*coords[i-1][1];
  const acres=Math.abs(doubleArea)/2/4046.8564224;
  if(!Number.isFinite(acres)||acres<0.0001||acres>50000)throw Error('Invalid polygon acreage');
  // A simple ring cannot have duplicate vertices or intersect itself.
  const points=coords.slice(0,-1);
  if(new Set(points.map(p=>p.join(','))).size!==points.length)throw Error('Duplicate polygon vertices');
  const orient=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const overlaps=(a,b,c,d)=>Math.max(Math.min(a,b),Math.min(c,d))<=Math.min(Math.max(a,b),Math.max(c,d));
  for(let i=0;i<points.length;i++)for(let j=i+2;j<points.length;j++){
    if(i===0&&j===points.length-1)continue;
    const [a,b,c,d]=[coords[i],coords[i+1],coords[j],coords[j+1]];
    if(overlaps(a[0],b[0],c[0],d[0])&&overlaps(a[1],b[1],c[1],d[1])&&
      orient(a,b,c)*orient(a,b,d)<=0&&orient(c,d,a)*orient(c,d,b)<=0)throw Error('Self-intersecting polygon');
  }
  const xs=ring.map(p=>p[0]),ys=ring.map(p=>p[1]);
  return {rings,acres,bounds:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]};
}

function exactRecord(config,dataset,record) {
  if(dataset!==config.id||typeof record?.i!=='string'||!record.i.startsWith(config.recordPrefix)||!config.parcelPattern.test(parcelId(record.p)))throw Error('Wrong county or invalid parcel ID');
  const parts=record.i.split('|');
  if(parcelId(parts[2])!==parcelId(record.p))throw Error('Dataset record ID mismatch');
  if(!/^\d+\s/.test(address(record.a)))throw Error('Street address unavailable');
  return parcelId(record.p);
}

// Trial only. Registered source and fixed query fields prevent agent-provided URLs
// or predicates from running. Reserved calls remain charged on provider failure.
export async function verifyTrial({dataset,record,reserve,fetcher=fetch,now=()=>new Date()}) {
  const config=connectorFor(dataset);
  if(!config||config.mode!=='test-only'||typeof reserve!=='function')throw Error('Trial unavailable');
  const id=exactRecord(config,dataset,record);
  const fields=[config.parcelField,config.addressField,config.objectField];
  const query=new URLSearchParams({f:'json',where:config.parcelField+" = '"+id+"'",outFields:fields.join(','),
    outSR:'4326',returnGeometry:'true',resultRecordCount:'2'});
  const diagnostic={stage:'source_record',reasonCode:null,httpStatus:null,arcgisStatus:null,
    resultCount:null,returnedParcelIds:[],transferLimit:null,checkedAt:null};
  const snapshot=()=>({...diagnostic,checkedAt:now().toISOString()});
  const reject=(reasonCode,message,retryable=false)=>{
    diagnostic.reasonCode=reasonCode;
    throw Object.assign(Error(message),{retryable,diagnostics:snapshot()});
  };
  try{await reserve(config.id);}catch(error){
    if(error?.code==='QUOTA')throw error;
    reject('budget_unavailable','Trial budget unavailable',true);
  }
  diagnostic.stage='provider_response';
  let response, raw;
  try{
    response=await fetcher(config.source+'/query?'+query,{redirect:'error',signal:AbortSignal.timeout(8000)});
    diagnostic.httpStatus=response.status;
    if(response.ok)raw=await response.text();
  }catch{reject('transport_unavailable','GIS transport unavailable',true);}
  if(!response.ok)reject('http_error','GIS HTTP '+response.status,response.status===429||response.status>=500);
  if(raw.length>1_000_000)reject('response_too_large','GIS response too large');
  let data;
  try{data=JSON.parse(raw);}catch{reject('invalid_json','Invalid GIS response JSON');}
  const features=Array.isArray(data?.features)?data.features:null;
  diagnostic.resultCount=features?.length??null;
  diagnostic.transferLimit=Boolean(data?.exceededTransferLimit);
  diagnostic.arcgisStatus=Number.isSafeInteger(data?.error?.code)?data.error.code:null;
  if(features){
    for(const feature of features.slice(0,2)){
      const value=feature?.attributes?.[config.parcelField];
      // Keep the provider's formatting, but only for bounded cadastral IDs.
      if(typeof value==='string'&&/^[0-9][0-9.-]{0,19}$/.test(value)&&config.parcelPattern.test(parcelId(value))){
        diagnostic.returnedParcelIds.push(value);
      }
    }
  }
  diagnostic.stage='match_count';
  if(diagnostic.transferLimit)reject('transfer_limit','ArcGIS transfer limit exceeded; results may be incomplete');
  if(data?.error){
    diagnostic.stage='provider_response';
    reject('arcgis_error','GIS provider error',true);
  }
  if(!features)reject('missing_feature_array','GIS response has no feature array');
  if(features.length===0)reject('zero_results','No official parcel matched the exact query');
  if(features.length!==1)reject('multiple_matches','Multiple official parcels matched the exact query');
  diagnostic.stage='coordinate_system';
  if((data.spatialReference?.latestWkid??data.spatialReference?.wkid)!==4326)reject('wrong_coordinate_system','Unexpected GIS coordinate system');
  const feature=features[0],attributes=feature?.attributes;
  diagnostic.stage='parcel_identity';
  if(parcelId(attributes?.[config.parcelField])!==id)reject('parcel_id_mismatch','Parcel identity mismatch');
  diagnostic.stage='situs_address';
  if(address(attributes?.[config.addressField])!==address(record.a))reject('address_mismatch','Situs address mismatch');
  const objectId=attributes[config.objectField];
  diagnostic.stage='official_object';
  if(!Number.isSafeInteger(objectId)||objectId<=0)reject('missing_object_id','Missing official object ID');
  diagnostic.stage='polygon';
  let geometry;
  try{geometry=polygonEvidence(feature.geometry?.rings,config.bounds);}catch(error){
    reject('invalid_polygon',error.message);
  }
  diagnostic.stage='verified';
  const diagnostics=snapshot();
  return {kind:'connector_trial',dataset,recordId:record.i,parcelId:id,objectId,source:config.source,
    officialAddress:attributes[config.addressField],sourceAddress:record.a,wkid:4326,checkedAt:diagnostics.checkedAt,geometry,diagnostics};
}

// AI Brain discovery input. This pure function never probes or activates a source.
export function connectorReadiness(dataset,trial=null) {
  const config=connectorFor(dataset.id);
  return {id:dataset.id,state:dataset.state,county:dataset.county,available:dataset.records,
    status:config?.mode==='test-only'&&(trial?.retry||trial?.evidence?.length)?'Testing':
      config?.status||(dataset.gis?.url?'Researching':'Unsupported'),
    connector:config?.type??null,source:config?.source??null,authority:config?.authority??null,
    discoveryLead:config?null:dataset.gis?.url??null, compatibility:config?.compatibility??null,
    scope:config?.scope??null,lastTest:trial?.evidence?.at(-1)?.checkedAt??config?.lastTest??null,
    reason:trial?.retry?.reason??config?.reason??(config?null:'No approved official parcel connector'),
    automationEnabled:false};
}

export function connectorCoverage(records, overlay) {
  const seen=new Set();
  let mapped=0,verified=0,available=0;
  const counts=new Map();
  for(const record of records)if(typeof record?.i==='string'&&record.i)counts.set(record.i,(counts.get(record.i)||0)+1);
  for(const record of records){
    if(!record?.i||seen.has(record.i))continue;
    seen.add(record.i);
    available++;
    if(record.g||record.cx){mapped++;continue;}
    const patch=overlay?.records?.[record.i];
    if(counts.get(record.i)!==1||patch?.verifiedGeometry!==true||patch.i!==record.i||!parcelId(record.p)||parcelId(patch.p)!==parcelId(record.p))continue;
    try{polygonEvidence(patch.g);verified++;}catch{/* Invalid overlays do not contribute. */}
  }
  const target=available-mapped;
  return {available,mapped,verified,remaining:target-verified,completion:target?100*verified/target:null};
}
