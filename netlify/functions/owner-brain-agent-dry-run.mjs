// Preview-only, owner-only, read-only official GIS verification dry run.
// Never modifies parcels, queues, usage counters, approvals, or map feeds.
import * as auth from '../lib/brain-auth.mjs';
import {verifyOfficial,DETROIT_GIS} from '../lib/brain-official-verification.mjs';
const DATA='https://pricepocketasset.com/map/data/MI-wayne.json';
const ID='MI|Wayne|01002263|', OBJECT_ID=279374;
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'}});
async function readJson(url,limit=12000000){
 const res=await fetch(url,{signal:AbortSignal.timeout(9000)});
 if(!res.ok)throw Error('Official data HTTP '+res.status);
 const raw=await res.text();if(Buffer.byteLength(raw)>limit)throw Error('Source exceeds safety limit');
 const data=JSON.parse(raw);if(data.error)throw Error('Official GIS provider error');
 return data;
}
async function handler(req,context){
 if(context?.deploy?.context!=='deploy-preview'||!auth.isBrainPreview())return json(404,{ok:false,error:'Preview only'});
 if(req.method!=='POST')return json(405,{ok:false,error:'POST only'});
 const user=await auth.userFromCookie(req.headers.get('cookie')||'');
 if(!user?.owner)return json(user?403:401,{ok:false,error:'Owner access required'});
 if(req.headers.get('origin')!==new URL(req.url).origin)return json(403,{ok:false,error:'Invalid origin'});
 let input;try{const raw=await req.text();if(raw.length>250)throw Error();input=JSON.parse(raw);}catch{return json(400,{ok:false,error:'Invalid JSON'});}
 if(input?.action!=='test-agent'||input.confirmed!==true)return json(400,{ok:false,error:'Confirmation required'});
 const checks=[];
 try{
  const source=await readJson(DATA);
  const r=(source.recs||[]).find(x=>x.i===ID);
  if(!r)throw Error('Known Wayne sample not present in source dataset');
  const record={...r};for(const [field,dict] of Object.entries(source.dict||{}))if(record[field]!=null)record[field]=dict[record[field]];
  checks.push({name:'Source county record',status:'pass'});
  const url=DETROIT_GIS+'/query?'+new URLSearchParams({f:'json',where:'object_id='+OBJECT_ID,outFields:'parcel_number,address,object_id',returnGeometry:'true',outSR:'4326',resultRecordCount:'3'});
  const official=await readJson(url,1000000);
  const verified=verifyOfficial(record,official.features);
  if(verified.officialObjectId!==OBJECT_ID)throw Error('Official GIS object ID changed');
  checks.push({name:'Official parcel ID, street address and polygon',status:'pass'});
  const corrected=await auth.kvGet('brain-map-county-v1-MI-wayne')||{records:{}};
  const patch=corrected.records?.[ID];
  const matching=!!patch&&patch.verifiedGeometry===true&&patch.p===record.p&&JSON.stringify(patch.g)===JSON.stringify(verified.g);
  checks.push({name:'Stored preview correction matches current GIS',status:matching?'pass':'needs_review'});
  const decisions=await auth.kvGet('owner-brain-approvals-v1')||{entries:[]};
  const approval=decisions.entries.find(a=>a.dataset==='MI-wayne'&&a.recordId===ID&&a.decision==='approved_for_staging');
  checks.push({name:'Staged verification decision',status:approval?'pass':'needs_review'});
  const history=await auth.kvGet('brain-map-history-v1')||{entries:[]};
  const published=history.entries.some(h=>h.dataset==='MI-wayne'&&h.recordId===ID&&h.action==='published');
  checks.push({name:'Preview publication history',status:published?'pass':'needs_review'});
  return json(200,{ok:true,dryRun:true,county:'Wayne, MI',parcelId:record.p,
   checkedAt:new Date().toISOString(),checks,passed:checks.filter(x=>x.status==='pass').length,
   total:checks.length,ready:checks.every(x=>x.status==='pass'),
   message:'Official GIS checked against the saved preview sample. No writes or paid AI calls were performed.'});
 }catch(e){return json(200,{ok:true,dryRun:true,ready:false,checkedAt:new Date().toISOString(),checks,
  passed:checks.filter(x=>x.status==='pass').length,total:5,error:String(e.message||e).slice(0,150),
  message:'Dry run could not finish. No map or agent data was changed.'});}
}
export default auth.withBrainStore(handler);
