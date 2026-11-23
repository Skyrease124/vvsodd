// Nationwide building footprints (OpenStreetMap, via Overpass) for the "Building overlap" parcel check.
// Research signal only: OSM is volunteer-mapped, so rural areas can be missing buildings. Never proof of vacancy.
// The Overpass hosts are fixed here; users supply only a small bounding box.
const MIRRORS=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];
const US_BOUNDS=[-179.5,17.5,-64.5,72];
const json=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'public,max-age=300','X-Content-Type-Options':'nosniff'}});
export function validateBBox(raw){
  const box=String(raw||'').split(',').map(Number);
  if(box.length!==4||box.some(v=>!Number.isFinite(v)))throw Error('Invalid geographic bounds');
  const [w,s,e,n]=box;
  if(w>=e||s>=n||e-w>0.018||n-s>0.018)throw Error('Zoom in to a single parcel');
  if(w<US_BOUNDS[0]||s<US_BOUNDS[1]||e>US_BOUNDS[2]||n>US_BOUNDS[3])throw Error('Outside supported area');
  return box;
}
// Overpass "out geom" ways -> GeoJSON polygons (closed rings only).
export function convertOverpass(data,limit=125){
  if(!data||!Array.isArray(data.elements))throw Error('Invalid building result');
  const features=[];
  for(const el of data.elements){
    if(el.type!=='way'||!Array.isArray(el.geometry)||el.geometry.length<4)continue;
    const ring=el.geometry.map(p=>[Number(p.lon),Number(p.lat)]);
    if(ring.some(p=>!Number.isFinite(p[0])||!Number.isFinite(p[1])))continue;
    const a=ring[0],b=ring[ring.length-1];
    if(a[0]!==b[0]||a[1]!==b[1])ring.push([a[0],a[1]]);
    features.push({type:'Feature',properties:{gisType:'buildings',source:'osm',reference:String(el.id||'')},geometry:{type:'Polygon',coordinates:[ring]}});
    if(features.length>=limit)break;
  }
  return {type:'FeatureCollection',features,truncated:features.length>=limit};
}
async function queryOverpass(box){
  const [w,s,e,n]=box;
  const body='data='+encodeURIComponent('[out:json][timeout:12];way["building"]('+[s,w,n,e].join(',')+');out geom 126;');
  const attempts=MIRRORS.map(url=>fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'PricePocketAsset parcel research'},body,signal:AbortSignal.timeout(9000)})
    .then(async r=>{if(!r.ok)throw Error('status '+r.status);return r.json();}));
  return Promise.any(attempts);
}
export default async function handler(request){
  if(request.method!=='GET')return json(405,{error:'Method not allowed'});
  let box;
  try{box=validateBBox(new URL(request.url).searchParams.get('bbox'));}catch(e){return json(400,{error:e.message});}
  try{
    const data=convertOverpass(await queryOverpass(box));
    return json(200,{type:'FeatureCollection',features:data.features,metadata:{county:'OSM',source:'osm',attribution:'© OpenStreetMap contributors (ODbL)',returned:data.features.length,truncated:data.truncated,verifiedPurchaseAvailability:false}});
  }catch{return json(502,{error:'Building data unavailable. The parcel map is unaffected.'});}
}
