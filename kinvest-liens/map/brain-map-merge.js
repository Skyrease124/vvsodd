(function(){'use strict';
const norm=x=>String(x??'').toUpperCase().replace(/[^A-Z0-9]/g,'');
async function apply(ds){
 if(!ds?.id||!Array.isArray(ds.recs))return ds;
 const res=await fetch('/.netlify/functions/brain-map-county?'+new URLSearchParams({dataset:ds.id}),{cache:'no-store'});
 if(!res.ok)throw Error('Verified correction feed unavailable');
 const data=await res.json();
 if(!data.ok||data.dataset!==ds.id)return ds;
 for(const r of ds.recs){
  const p=data.records?.[r.i];if(!p||!p.verifiedGeometry||norm(p.p)!==norm(r.p)||r.g||r.cx)continue;
  if(!Array.isArray(p.g)||!Array.isArray(p.cx)||!Array.isArray(p.bb))continue;
  r.g=p.g;r.cx=p.cx;r.bb=p.bb;r.why=null;
 }
 return ds;
}
window.PPABrainMap={apply};})();