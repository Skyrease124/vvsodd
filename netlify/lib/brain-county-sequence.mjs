// Shared strict county work order. Research completion is NOT map completion.
// The first incomplete county retains exclusive priority across worker cycles.
// Persist the order so new data or updated coverage does not reshuffle active work.
const KEY='owner-brain-county-order-v1';
const safe=d=>/^[A-Z]{2}-[A-Za-z0-9_-]+$/.test(d?.id||'')&&/^[A-Za-z0-9_-]+\.json$/.test(d?.file||'')&&Number.isFinite(d.records)&&Number.isFinite(d.mapped);
export function rankedCounties(index){
 return (index?.datasets||[]).filter(safe).map((d,i)=>({...d,originalOrder:i}))
  .sort((a,b)=>(b.records-b.mapped)-(a.records-a.mapped)||a.originalOrder-b.originalOrder);
}
export async function activeCounty(index,storage){
 const datasets=rankedCounties(index),byId=new Map(datasets.map(d=>[d.id,d]));
 let plan=await storage.kvGet(KEY);
 if(!Array.isArray(plan?.order)||!plan.order.length){
  plan={version:1,createdAt:new Date().toISOString(),order:datasets.map(d=>d.id)};
  await storage.kvPut(KEY,plan);
 }
 // Preserve the original queue; append newly imported counties at the end.
 const seen=new Set(plan.order);
 const newcomers=datasets.filter(d=>!seen.has(d.id)).map(d=>d.id);
 if(newcomers.length){plan={...plan,order:[...plan.order,...newcomers]};await storage.kvPut(KEY,plan);}
 for(const id of plan.order){
  const d=byId.get(id);if(!d)continue;
  if(d.mapped>=d.records)continue;
  // Never skip based on address/geocoder exhaustion. Official verified
  // polygons are counted only for their original county records.
  const saved=await storage.kvGet('brain-map-county-v1-'+d.id)||{records:{}};
  const valid=Object.values(saved.records||{}).filter(r=>r?.verifiedGeometry===true&&r?.i&&Array.isArray(r.g)&&r.g.length).length;
  // Conservative: require an actual full-dataset reconciliation before
  // a county can be marked complete, rather than trusting patch counts.
  return {dataset:d,remaining:Math.max(0,d.records-d.mapped-valid),verifiedCorrections:valid,
   blocked:!['MI-wayne'].includes(d.id),
   blocker:d.id==='MI-wayne'?null:'Official county polygon connector not yet configured',
   orderPosition:plan.order.indexOf(id)+1,orderTotal:plan.order.length};
 }
 return {dataset:null,remaining:0,orderTotal:plan.order.length,complete:true};
}
