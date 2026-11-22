// Public, strictly read-only dynamic parcel corrections for all three map surfaces.
// Enforce identity/shape validation at the publication boundary as a second safety net.
import * as auth from '../lib/brain-auth.mjs';
const output=(code,body)=>new Response(JSON.stringify(body),{status:code,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Access-Control-Allow-Origin':'https://pricepocketasset.com'}});
const valid=coords=>Array.isArray(coords)&&coords.length===2&&coords.every(Number.isFinite)&&coords[0]>=-180&&coords[0]<=-60&&coords[1]>=18&&coords[1]<=72;
async function handler(req){
 if(req.method!=='GET')return output(405,{ok:false,error:'Read-only endpoint'});
 const url=new URL(req.url),dataset=url.searchParams.get('dataset');
 if(!/^[A-Z]{2}-[a-z0-9_-]{2,80}$/.test(dataset||''))return output(400,{ok:false,error:'Invalid dataset'});
 const saved=await auth.kvGet('brain-map-county-v1-'+dataset)||{version:0,records:{}};
 const records={};
 for(const [id,r] of Object.entries(saved.records||{}).slice(0,1500)){
  if(!r||r.verifiedGeometry!==true||r.publicationPending===true||id!==r.i||typeof r.p!=='string'||!r.evidenceUrl?.startsWith('https://'))continue;
  if(!Array.isArray(r.g)||r.g.length!==1||!Array.isArray(r.g[0])||r.g[0].length<4||r.g[0].length>6000)continue;
  if(!Array.isArray(r.bb)||r.bb.length!==4||!r.bb.every(Number.isFinite)||!valid(r.cx))continue;
  const ring=r.g[0];if(!ring.every(valid))continue;
  if(ring[0][0]!==ring.at(-1)[0]||ring[0][1]!==ring.at(-1)[1])continue;
  const bounds=[Math.min(...ring.map(p=>p[0])),Math.min(...ring.map(p=>p[1])),Math.max(...ring.map(p=>p[0])),Math.max(...ring.map(p=>p[1]))];
  if(bounds.some((v,i)=>Math.abs(v-r.bb[i])>0.000001))continue;
  if(r.cx[0]<bounds[0]||r.cx[0]>bounds[2]||r.cx[1]<bounds[1]||r.cx[1]>bounds[3])continue;
  records[id]={i:r.i,p:r.p,g:r.g,cx:r.cx,bb:r.bb,verifiedGeometry:true,verifiedAt:r.verifiedAt||null,evidenceUrl:r.evidenceUrl,
   ...(Number.isFinite(r.estimatedAcres)&&r.estimatedAcres>0?{estimatedAcres:r.estimatedAcres}:{})};
 }
 return output(200,{ok:true,dataset,version:Number.isInteger(saved.version)?saved.version:0,records});
}

export default auth.withBrainStore(handler);
