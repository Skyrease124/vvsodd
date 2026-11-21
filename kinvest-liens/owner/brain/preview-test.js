// Optional controls: endpoint remains unavailable on production deployments.
(async()=>{
 const root=document.getElementById('app');
 const endpoint='/.netlify/functions/owner-brain-preview-test';
 try{
  const response=await window.PPABrainRequest(endpoint,{credentials:'same-origin',cache:'no-store'});
  const state=await response.json();if(!response.ok||!state.isolated)return;
  const panel=document.createElement('section');panel.className='panel';
  const title=document.createElement('h2');title.textContent='Automatic preview — 90 Chandler';
  const help=document.createElement('p');help.className='muted';help.textContent='The deployment agent retrieves the official GIS record, checks parcel identity, address and polygon, and fills the evidence and verification notes automatically. Its verified sample correction is published only in this isolated preview. No forms or AI requests are needed.';
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
  // Safe verification check only: no queue or map writes, no paid research.
  const agentButton=document.createElement('button');agentButton.type='button';
  agentButton.textContent='Test Agent Run (no AI credits)';
  const agentResults=document.createElement('div');agentResults.setAttribute('role','status');
  agentResults.style.cssText='margin:12px 0;color:#d7f6e8;overflow-wrap:anywhere';
  agentButton.onclick=async()=>{
   agentButton.disabled=true;agentResults.textContent='Checking official Wayne County sample in isolated preview…';
   try{
    const res=await window.PPABrainRequest('/.netlify/functions/owner-brain-agent-dry-run',{
     method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({action:'test-agent',confirmed:true})});
    const d=await res.json();if(!res.ok||!d.ok)throw Error(d.error||'Agent check failed');
    agentResults.replaceChildren();
    const headline=document.createElement('p');
    headline.textContent=(d.ready?'PASS':'NEEDS ATTENTION')+' · '+d.passed+'/'+d.total+' checks · '+d.message;
    agentResults.append(headline);
    for(const check of d.checks||[]){const p=document.createElement('p');p.textContent=(check.status==='pass'?'✓ ':'! ')+check.name+' — '+check.status.replaceAll('_',' ');agentResults.append(p);}
    if(d.error){const p=document.createElement('p');p.textContent='Issue: '+d.error;agentResults.append(p);}
   }catch(e){agentResults.textContent='Dry run unavailable: '+e.message;}
   finally{agentButton.disabled=false;}
  };
  panel.append(agentButton,agentResults);
  const diagnostics=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Diagnostic controls';diagnostics.append(summary,...buttons,note);panel.append(title,help,diagnostics);
  for(const [label,url] of [['Open test parcel on map','/map/?c=MI-wayne&p=01002263'],['Open MapTiler preview','/owner/maptiler/']]){
   const link=document.createElement('a');link.textContent=label;link.href=url;link.target='_blank';link.rel='noopener';link.style.marginRight='16px';panel.append(link);
  }
  root.prepend(panel);
 }catch{/* Production and signed-out visitors do not receive test controls. */}
})();
