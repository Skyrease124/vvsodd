// Owner-only deploy-preview end-to-end publication of three specifically verified Detroit parcels.
// The guarded publisher re-fetches GIS and checks identity/geometry before every write.
// No paid AI. Writes only to isolated preview Brain store.
import * as auth from '../lib/brain-auth.mjs';
import {verifyOfficial,DETROIT_GIS} from '../lib/brain-official-verification.mjs';
import publish from './brain-map-publish-auto.mjs';
import crypto from 'node:crypto';
const IDS=['01002754','01002830','01003357'];
const DATA='https://pricepocketasset.com/map/data/MI-wayne.json';
const KEY='brain-map-county-v1-MI-wayne',APPROVALS='owner-brain-approvals-v1';
const json=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Cookie','X-Robots-Tag':'noindex, nofollow'}});
async function read(url,limit=12000000){
 const response=await fetch(url,{signal:AbortSignal.timeout(8500)});
 if(!response.ok)throw Error('Source HTTP '+response.status);
 const raw=await response.text();
 if(Buffer.byteLength(raw)>limit)throw Error('Source too large');
 const data=JSON.parse(raw);if(data.error)throw Error('Official GIS provider error');
 return data;
}
async function handler(req,context){
 if(context?.deploy?.context!=='deploy-preview'||!auth.isBrainPreview())return json(404,{ok:false,error:'Preview only'});
 if(req.method!=='POST')return json(405,{ok:false,error:'POST only'});
 const user=await auth.userFromCookie(req.headers.get('cookie')||'');
 if(!user?.owner)return json(user?403:401,{ok:false,error:'Owner access required'});
 if(req.headers.get('origin')!==new URL(req.url).origin)return json(403,{ok:false,error:'Invalid origin'});
 let input;try{const raw=await req.text();if(raw.length>200)throw Error();input=JSON.parse(raw);}catch{return json(400,{ok:false,error:'Invalid JSON'});}
 if(input?.action!=='publish-three-wayne'||input.confirmed!==true)return json(400,{ok:false,error:'Confirmation required'});
 try{
  const control=await auth.kvGet('owner-brain-scanner-v1');
  if(control?.status==='paused')return json(409,{ok:false,error:'Agent automation is paused'});
  const ds=await read(DATA);
  const byId=new Map((ds.recs||[]).map(r=>{
   const item={...r};for(const [field,dict] of Object.entries(ds.dict||{}))if(item[field]!=null)item[field]=dict[item[field]];
   return [String(item.p||'').replace(/\.$/,''),item];
  }));
  const existing=await auth.kvGet(KEY)||{records:{}};
  const staged=[];
  for(const id of IDS){
   const r=byId.get(id);
   if(!r||!r.i||r.g||r.cx)throw Error('Missing/unmapped source record unavailable for parcel '+id);
   if(existing.records?.[r.i])continue;
   const url=DETROIT_GIS+'/query?'+new URLSearchParams({f:'json',where:"parcel_number IN ('"+id+"','"+id+".')",outFields:'parcel_number,address,object_id',returnGeometry:'true',outSR:'4326',resultRecordCount:'3'});
   const feature=await read(url,1000000);
   const verified=verifyOfficial(r,feature.features);
   if(!Number.isSafeInteger(verified.officialObjectId)||verified.officialObjectId<=0)throw Error('Missing official object ID for '+id);
   const stamp=new Date().toISOString();
   const caseKey=crypto.createHash('sha256').update('MI-wayne\n'+r.i).digest('hex').slice(0,28);
   staged.push({caseKey,dataset:'MI-wayne',recordId:r.i,parcelId:r.p,state:'MI',county:'Wayne',
     decision:'approved_for_staging',reviewedAt:stamp,reviewedBy:'preview-owner-confirmed-official-validator',
     reviewMethod:'exact_identity_address_polygon',independentlyChecked:true,officialObjectId:verified.officialObjectId,
     evidenceUrl:verified.evidenceUrl,notes:verified.notes,checks:verified.checks,
     proposedPosition:{lat:verified.cx[1],lon:verified.cx[0]},publishStatus:'not_published'});
  }
  // Verify all three requested entries before staging any. Never stage ambiguous GIS matches.
  if(staged.length){
   const currentControl=await auth.kvGet('owner-brain-scanner-v1');
   if(currentControl?.status==='paused')return json(409,{ok:false,error:'Automation paused during verification'});
   const approvals=await auth.kvGet(APPROVALS)||{entries:[]};
   const merged=[...(approvals.entries||[])];
   for(const item of staged)if(!merged.some(x=>x.caseKey===item.caseKey))merged.push(item);
   await auth.kvPut(APPROVALS,{...approvals,entries:merged.slice(-250)});
   await publish(req,context);
  }
  const after=await auth.kvGet(KEY)||{records:{}};
  const results=IDS.map(id=>{
   const record=byId.get(id);
   return {parcelId:id,recordId:record?.i||null,published:!!record?.i&&after.records?.[record.i]?.verifiedGeometry===true};
  });
  const count=results.filter(r=>r.published).length;
  return json(200,{ok:true,previewOnly:true,requested:3,published:count,results,
   publicationStatus:await auth.kvGet('brain-map-publication-status-v1'),
   message:count===3?'All three official polygons published to the isolated preview feed.':'One or more parcels not published; inspect publisher status. No production writes.'});
 }catch(e){return json(502,{ok:false,error:String(e.message||e).slice(0,160)});}
}
export default auth.withBrainStore(handler);
