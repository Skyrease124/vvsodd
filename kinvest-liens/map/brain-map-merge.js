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
async function applyOverlay(ds){
 if(!ds?.id||!Array.isArray(ds.recs))return {changed:false,count:0,version:0};
 const response=await fetch('/.netlify/functions/brain-map-county?'+new URLSearchParams({dataset:ds.id}),{cache:'no-store'});
 if(!response.ok)throw Error('Verified correction feed unavailable');
 const body=await response.json();
 if(!body.ok||body.dataset!==ds.id||typeof body.version!=='number')throw Error('Invalid correction feed');
 let state=memory.get(ds);
 if(!state){state={version:-1,baseline:new Map(ds.recs.filter(r=>!r.g&&!r.cx).map(r=>[r.i,{g:r.g??null,cx:r.cx??null,bb:r.bb??null,why:r.why??null}]))};memory.set(ds,state);}
 // Publication recovery can clear a pending marker without bumping the polygon version.
 // Always reconcile the visible feed, even when its map version is unchanged.
 // This also handles revoked corrections and identity repairs safely.

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
// ---- Owner-approved property records (server-filtered per viewer: Pro first, Free after 48 hours) ----
// A record whose parcel already exists in the county is a correction of that record; otherwise it is added.
// Every change is reversible: a withdrawn or no longer visible approval restores the original record or
// removes the added one. A record without a verified location is listed without a map position.
const CATS=new Set(['tax_deed','tax_lien','land_bank']);
const KEYS=['a','o','amt','ac','c','v','cx','g','bb','why'];
const recMemory=new WeakMap();
const snapshot=r=>Object.fromEntries(KEYS.map(k=>[k,r[k]]));
function restore(r,base){for(const k of KEYS){if(base[k]===undefined)delete r[k];else r[k]=base[k];}}
const reindex=r=>{r._n=((r.a||'')+' '+(r.o||'')+' '+r.p).toLowerCase();};
function validRing(g){return Array.isArray(g)&&g.length===1&&Array.isArray(g[0])&&g[0].length>=4&&g[0].length<=6000&&g[0].every(validPoint);}
function validRecord(x){
 if(!x||typeof x.p!=='string'||!x.p||!CATS.has(x.c))return false;
 if(x.cx!=null&&!validPoint(x.cx))return false;
 if(x.g!=null&&(!x.cx||!validRing(x.g)||!Array.isArray(x.bb)||x.bb.length!==4))return false;
 return true;
}
function correction(x){const p={};for(const k of ['a','o','amt','ac','c'])if(x[k]!=null)p[k]=x[k];p.v=1;if(x.cx){p.cx=x.cx;p.why=null;}if(x.g){p.g=x.g;p.bb=x.bb;}return p;}
const fresh=(x,ds)=>({i:ds.state+'|'+ds.county+'|'+x.p+'|',p:x.p,c:x.c,a:x.a??null,o:x.o??null,amt:x.amt??null,ac:x.ac??null,v:1,
 t:x.t||'Owner-approved update',st:x.st||null,sl:null,src:x.src||null,fr:x.fr||null,cx:x.cx??null,g:x.g??null,bb:x.bb??null,why:x.why||null});
async function applyRecords(ds){
 if(!ds?.id||!Array.isArray(ds.recs)||!ds.state||!ds.county)return 0;
 const response=await fetch('/.netlify/functions/brain-map-records?'+new URLSearchParams({state:ds.state,county:ds.county}),{cache:'no-store',credentials:'same-origin'});
 if(!response.ok)throw Error('Approved records unavailable');
 const body=await response.json();
 if(!body.ok||!Array.isArray(body.records))throw Error('Invalid approved records');
 let st=recMemory.get(ds);if(!st){st={patched:new Map(),added:new Map()};recMemory.set(ds,st);}
 const byParcel=new Map();for(const r of ds.recs)if(!r.__approvedNew&&!byParcel.has(norm(r.p)))byParcel.set(norm(r.p),r);
 const seen=new Set();let count=0;
 for(const x of body.records){
  if(!validRecord(x))continue;
  const key=norm(x.p);if(seen.has(key))continue;seen.add(key);
  const sig=JSON.stringify(x);
  const existing=byParcel.get(key);
  if(existing){
   if(!st.patched.has(key))st.patched.set(key,{rec:existing,base:snapshot(existing)});
   if(existing.__approvedSig!==sig){restore(existing,st.patched.get(key).base);Object.assign(existing,correction(x));existing.__approved=x.approved||{};existing.__approvedSig=sig;reindex(existing);count++;}
  }else{
   let rec=st.added.get(key);
   if(!rec){rec=fresh(x,ds);rec._d=ds.id;rec.__approvedNew=true;st.added.set(key,rec);ds.recs.push(rec);count++;}
   else if(rec.__approvedSig!==sig){Object.assign(rec,fresh(x,ds));count++;}
   rec.__approvedSig=sig;rec.__approved=x.approved||{};reindex(rec);
  }
 }
 for(const [key,{rec,base}] of st.patched)if(!seen.has(key)){restore(rec,base);delete rec.__approved;delete rec.__approvedSig;reindex(rec);st.patched.delete(key);count++;}
 for(const [key,rec] of st.added)if(!seen.has(key)){const ix=ds.recs.indexOf(rec);if(ix>=0)ds.recs.splice(ix,1);st.added.delete(key);count++;}
 return count;
}
// The geometry overlay and the approved records are independent: one failing never blocks the other.
async function apply(ds){
 let version=0,count=0,failures=0;
 try{const o=await applyOverlay(ds);version=o.version;count+=o.count;}catch(_){failures++;}
 try{count+=await applyRecords(ds);}catch(_){failures++;}
 if(failures===2)throw Error('Map updates unavailable');
 return {changed:count>0,count,version};
}
window.PPABrainMap={apply,applyRecords};})();

