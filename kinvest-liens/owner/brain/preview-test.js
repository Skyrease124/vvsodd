// Optional controls: endpoint remains unavailable on production deployments.
(async()=>{
 const root=document.getElementById('app');
 const endpoint='/.netlify/functions/owner-brain-preview-test';
 try{
  const response=await window.PPABrainRequest(endpoint,{credentials:'same-origin',cache:'no-store'});
  const state=await response.json();if(!response.ok||!state.isolated)return;
  const panel=document.createElement('section');panel.className='panel';
  const title=document.createElement('h2');title.textContent='Isolated preview test — 90 Chandler';
  const help=document.createElement('p');help.className='muted';help.textContent='Brain records in this deployment are separate from production. Fetch the official candidate, verify and approve it in the review queue, then publish here. No AI request is needed. A new deployment starts with an empty test store.';
  const note=document.createElement('p');note.setAttribute('role','status');
  const buttons=[];
  for(const [action,label] of [['prepare','1. Fetch official candidate'],['publish','2. Publish approved correction'],['rollback','3. Reverse preview correction']]){
   const button=document.createElement('button');button.type='button';button.textContent=label;buttons.push(button);
   button.onclick=async()=>{
    if(!confirm(label+' in this isolated preview?'))return;
    buttons.forEach(b=>b.disabled=true);note.textContent='Working…';
    try{
     const r=await window.PPABrainRequest(endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,confirmed:true})});
     const d=await r.json();if(!r.ok)throw Error(d.error||'Preview test failed');
     note.textContent=d.message;
     // Existing dashboard functions refresh the review queue and publication monitor.
     if(typeof load==='function')await load();
    }catch(e){note.textContent=e.message;}finally{buttons.forEach(b=>b.disabled=false);}
   };
  }
  panel.append(title,help,...buttons,note);
  for(const [label,url] of [['Open test parcel on map','/map/?c=MI-wayne&p=01002263'],['Open MapTiler preview','/owner/maptiler/']]){
   const link=document.createElement('a');link.textContent=label;link.href=url;link.target='_blank';link.rel='noopener';link.style.marginRight='16px';panel.append(link);
  }
  root.prepend(panel);
 }catch{/* Production and signed-out visitors do not receive test controls. */}
})();
