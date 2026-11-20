// Florida-only official GIS visual overlay. Not a certificate source, vacancy finding or purchase offer.
// Allowlisted server-side ArcGIS query endpoints only; never accept a remote URL from users.
const SOURCES={
  'palm-parcels':{
    county:'Palm Beach',kind:'parcels',endpoint:'https://services1.arcgis.com/ZWOoUZbtaYePLlPw/arcgis/rest/services/Parcels/FeatureServer/0/query',
    fields:'PARID',license:'Public Domain (OpenAddresses listing)',attribution:'Palm Beach County GIS',
    bounds:[-81.05,26.25,-79.65,27.05]},
  'lee-parcels':{
    county:'Lee',kind:'parcels',endpoint:'https://gismapserver.leegov.com/gisserver910/rest/services/Layers/ParcelAddress/MapServer/0/query',
    fields:'STRAP',license:'Lee County GIS data conditions apply',attribution:'Lee County GIS / Property Appraiser',
    bounds:[-82.35,25.8,-81.45,26.95]},
  'lee-buildings':{
    county:'Lee',kind:'buildings',endpoint:'https://services2.arcgis.com/LvWGAAhHwbCJ2GMP/arcgis/rest/services/Building_Footprints/FeatureServer/0/query',
    fields:'OBJECTID',license:'Lee County GIS / Property Appraiser terms apply',attribution:'Lee County GIS / Property Appraiser',
    bounds:[-82.35,25.8,-81.45,26.95]}
};
const json=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'public,max-age=45','X-Content-Type-Options':'nosniff','Access-Control-Allow-Origin':'none'}});
export function validateOverlayQuery(raw){
  const cfg=SOURCES[raw.source];
  if(!cfg)throw Error('Unsupported GIS source');
  const box=String(raw.bbox||'').split(',').map(Number);
  if(box.length!==4||box.some(v=>!Number.isFinite(v)))throw Error('Invalid geographic bounds');
  const [w,s,e,n]=box;
  if(w>=e||s>=n||e-w>0.018||n-s>0.018||w<cfg.bounds[0]||s<cfg.bounds[1]||e>cfg.bounds[2]||n>cfg.bounds[3])throw Error('Zoom in within the supported Florida county');
  return {cfg,box};
}
export function cleanGISFeatures(data,kind){
  if(data?.error||data?.type!=='FeatureCollection'||!Array.isArray(data.features))throw Error('Invalid GIS result');
  const polygons=data.features.filter(x=>x?.geometry&&['Polygon','MultiPolygon'].includes(x.geometry.type));
  const output=polygons.slice(0,125).map((x,i)=>({
    type:'Feature',properties:{gisType:kind,source:'official-gis',reference:String(x.properties?.PARID||x.properties?.STRAP||'').slice(0,64),ordinal:i+1},
    geometry:x.geometry}));
  return {type:'FeatureCollection',features:output};
}
export default async function handler(request){
  if(request.method!=='GET')return json(405,{error:'Method not allowed'});
  let source,box,cfg;
  try{source=new URL(request.url).searchParams;({box,cfg}=validateOverlayQuery({source:source.get('source'),bbox:source.get('bbox')}));}
  catch(e){return json(400,{error:e.message});}
  const remote=new URL(cfg.endpoint);
  remote.search=new URLSearchParams({
    f:'geojson',where:'1=1',geometry:box.join(','),geometryType:'esriGeometryEnvelope',
    inSR:'4326',outSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:cfg.fields,
    returnGeometry:'true',resultRecordCount:'125'}).toString();
  try{
    const result=await fetch(remote,{signal:AbortSignal.timeout(9000),headers:{Accept:'application/geo+json, application/json'}});
    if(!result.ok)return json(502,{error:'GIS source unavailable',county:cfg.county});
    const raw=await result.text();
    if(raw.length>1800000)return json(502,{error:'GIS response too large, zoom closer'});
    const data=cleanGISFeatures(JSON.parse(raw),cfg.kind);
    return json(200,{...data,metadata:{county:cfg.county,attribution:cfg.attribution,
      license:cfg.license,sourceEndpoint:cfg.endpoint,returned:data.features.length,
      truncated:data.features.length===125,verifiedPurchaseAvailability:false}});
  }catch(e){return json(502,{error:'GIS layer unavailable. Existing parcel map is unaffected.'});}
}
