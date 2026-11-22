// Shared dynamic parcel-correction overlay: public map, Workshop embed, and MapTiler preview.
// Only verified official GIS polygons can be drawn. Raw geocoder candidates are excluded.
(function(){'use strict';
const norm=x=>String(x??'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const memory=new WeakMap();
function validPoint(c){return Array.isArray(c)&&c.length===2&&c.every(Number.isFinite)&&c[0]>=-180&&c[0]<=-60&&c[1]>=18&&c[1]<=72;}
function validPatch(p,r){
 if(!p||p.verifiedGeometry!==true||norm(p.p)!==norm(r.p)||p.i!==r.i||!Array.isArray(p.g)||p.g.length!==1||!Array.isArray(p.bb)||p.bb.length!==4||!validPoint(p.cx))return false;
 const ring=p.g[0];if(!Array.isArray(ring)||ring.length<4||ring.length>6000||!ring.every(validPoint))return false;
 if(ring[0][0]!==ring[ring.length-1][0]||ring[0][1]!==ring[ring.length-1][1])return false;
 const bounds=[Math.min(...ring.map(q=>q[0])),Math.min(...ring.map(q=>q[1])),Math.max(...ring.map(q=>q[0])),Math.max(...ring.map(q=>q[1]))];
 return bounds.every((v,i)=>Math.abs(v-p.bb[i])<0.000001)&&p.cx[0]>=bounds[0]&&p.cx[0]<=bounds[2]&&p.cx[1]>=bounds[1]&&p.cx[1]<=bounds[3];
}
function evidence(p){
 let source=null;
 try{
  const url=new URL(p.evidenceUrl);
  if(url.protocol==='https:'&&!url.username&&!url.password)source=url.href;
 }catch{/* Older fixture or omitted source. */}
 return {source,estimatedAcres:Number.isFinite(p.estimatedAcres)&&p.estimatedAcres>0?p.estimatedAcres:null};
}
async function apply(ds){
 if(!ds?.id||!Array.isArray(ds.recs))return {changed:false,count:0,version:0};
 const response=await fetch('/.netlify/functions/brain-map-county?'+new URLSearchParams({dataset:ds.id}),{cache:'no-store'});
 if(!response.ok)throw Error('Verified correction feed unavailable');
 const body=await response.json();
 if(!body.ok||body.dataset!==ds.id||typeof body.version!=='number')throw Error('Invalid correction feed');
 let state=memory.get(ds);
 if(!state){state={version:-1,baseline:new Map(ds.recs.filter(r=>!r.g&&!r.cx).map(r=>[r.i,{g:r.g??null,cx:r.cx??null,bb:r.bb??null,why:r.why??null}]))};memory.set(ds,state);}
 if(state.version===body.version)return {changed:false,count:0,version:body.version};
 let count=0;
 for(const r of ds.recs){
  const base=state.baseline.get(r.i);
  if(!base)continue; // Never overwrite preexisting mapped parcels.
  const p=body.records?.[r.i];
  const previous=!!r.__brainMap;
  if(validPatch(p,r)){
   const attribution=evidence(p);
   const different=!previous||JSON.stringify([r.g,r.cx,r.bb,r.__brainEvidence])!==JSON.stringify([p.g,p.cx,p.bb,attribution]);
   r.g=p.g;r.cx=p.cx;r.bb=p.bb;r.why=null;r.__brainMap=true;r.__brainEvidence=attribution;
   if(different)count++;
  }else{
   // Rollback: a removed/invalid correction restores the original unmapped parcel.
   if(previous){r.g=base.g;r.cx=base.cx;r.bb=base.bb;r.why=base.why;delete r.__brainMap;delete r.__brainEvidence;count++;}
  }
 }
 state.version=body.version;
 return {changed:count>0,count,version:body.version};
}
window.PPABrainMap={apply};})();

