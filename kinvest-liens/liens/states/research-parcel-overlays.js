// Approved research overlays for independently verified parcel-outline dialogs.
(function(root){
  'use strict';
  const norm=x=>String(x??'').trim().toLowerCase();
  const normCounty=x=>norm(x).replace(/\s+county$/,'').replace(/\s+/g,' ');
  let request=null;
  function releases(){
    return request||(request=fetch('/.netlify/functions/research-updates',{
      credentials:'same-origin',cache:'no-store'
    }).then(async r=>{
      if(!r.ok)throw Error('Research feed unavailable');
      const data=await r.json();
      if(!data.ok||!Array.isArray(data.records))throw Error('Invalid research feed');
      return {access:data.access,records:data.records.filter(r=>r&&r.researchOnly===true&&
        r.availableForPurchase===false&&['land','lien'].includes(r.type))};
    }).catch(()=>({access:'free',records:[]})));
  }
  function matching(records,{state,county,parcel}={}){
    if(!state||!county||!parcel||!Array.isArray(records))return [];
    return records.filter(r=>norm(r.state)===norm(state)&&normCounty(r.county)===normCounty(county)
      &&norm(r.parcelId)===norm(parcel)).slice(0,6);
  }
  async function attach(L,map,outline,dlg,loc){
    if(!L||!map||!outline||!dlg||!loc?.state||!loc?.county||!loc?.parcel)return [];
    const key=[loc.state,loc.county,loc.parcel].map(norm).join('|');
    dlg.dataset.researchParcelKey=key;
    const data=await releases();
    if(!dlg.isConnected||!dlg.open||dlg.dataset.researchParcelKey!==key)return [];
    const items=matching(data.records,loc);
    if(!items.length)return [];
    const color=items.some(r=>r.type==='lien')?'#f59e0b':'#10b981';
    if(typeof outline.setStyle==='function')outline.setStyle({color,weight:5,fillOpacity:0.26});
    const info=document.createElement('section');
    info.className='ppa-research-overlay';
    info.style.cssText='margin:12px 0;padding:12px;border:1px solid #bd9944;border-radius:10px;background:#fff7e6;color:#1a2735;font:14px/1.5 system-ui';
    const title=document.createElement('strong');
    title.textContent='Approved parcel research'+(data.access==='pro'?' · Pro early access':'');
    info.append(title);
    for(const r of items){
      const h=document.createElement('p');h.textContent=r.title||'Reviewed research update';info.append(h);
      if(r.description){const p=document.createElement('p');p.textContent=r.description;info.append(p);}
      try{
        const url=new URL(r.evidenceUrl||r.sourceUrl);
        if(url.protocol==='https:'){const a=document.createElement('a');a.href=url.href;
          a.target='_blank';a.rel='noopener noreferrer';a.textContent='Verify source';info.append(a);}
      }catch(_){}
    }
    const warn=document.createElement('p');warn.textContent='Research only. Current purchase availability unverified.';info.append(warn);
    dlg.querySelector('.ppa-research-overlay')?.remove();
    dlg.append(info);
    if(typeof outline.bindPopup==='function')outline.bindPopup(info.cloneNode(true));
    return items;
  }
  const api=Object.freeze({matching,attach});
  root.PPAResearchParcelOverlay=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
