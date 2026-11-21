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
  const batchButton=document.createElement('button');batchButton.type='button';
  batchButton.textContent='Test 3 Wayne parcels (no AI credits)';
  const batchResults=document.createElement('div');batchResults.setAttribute('role','status');
  batchResults.style.cssText='margin:12px 0;color:#d7f6e8;overflow-wrap:anywhere';
  batchButton.onclick=async()=>{
   if(!confirm('Check up to three additional unmapped Wayne/Detroit parcels against official GIS? Read-only, no paid AI calls.'))return;
   batchButton.disabled=true;batchResults.textContent='Checking up to 3 official parcel records…';
   try{
    const response=await window.PPABrainRequest('/.netlify/functions/owner-brain-batch-test',{
     method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({action:'test-wayne-batch',confirmed:true})});
    const d=await response.json();if(!response.ok||!d.ok)throw Error(d.error||'Batch unavailable');
    batchResults.replaceChildren();
    const headline=document.createElement('p');
    headline.textContent=d.attempted+' checked · '+d.verified+' verified · '+d.needsReview+' need review. No map changes.';
    batchResults.append(headline);
    for(const item of d.results||[]){
     const p=document.createElement('p');
     p.textContent='Parcel '+item.parcelId+' · '+item.status.replaceAll('_',' ')+(item.reason?' · '+item.reason:'');
     batchResults.append(p);
    }
   }catch(e){batchResults.textContent='Batch test unavailable: '+e.message;}
   finally{batchButton.disabled=false;}
  };
  panel.append(batchButton,batchResults);
  const publishThree=document.createElement('button');publishThree.type='button';
  publishThree.textContent='Publish 3 verified Wayne parcels to preview';
  const publishThreeResult=document.createElement('div');publishThreeResult.setAttribute('role','status');
  publishThreeResult.style.cssText='margin:12px 0;color:#d7f6e8;overflow-wrap:anywhere';
  publishThree.onclick=async()=>{
   if(!confirm('Reverify parcels 01002754, 01002830 and 01003357 against official GIS, then publish confirmed polygons ONLY to this isolated Netlify preview? This cannot change production.'))return;
   publishThree.disabled=true;publishThreeResult.textContent='Reverifying official GIS and publishing eligible preview corrections…';
   try{
    const response=await window.PPABrainRequest('/.netlify/functions/owner-brain-batch-publish',{
     method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({action:'publish-three-wayne',confirmed:true})});
    const d=await response.json();if(!response.ok||!d.ok)throw Error(d.error||'Publication failed');
    publishThreeResult.replaceChildren();
    const headline=document.createElement('p');headline.textContent=d.message+' ('+d.published+'/3 published)';publishThreeResult.append(headline);
    for(const row of d.results||[]){const p=document.createElement('p');p.textContent='Parcel '+row.parcelId+' — '+(row.published?'Published to preview':'Not published');publishThreeResult.append(p);}
    if(typeof load==='function')await load();
   }catch(e){publishThreeResult.textContent='Preview publication unavailable: '+e.message;}
   finally{publishThree.disabled=false;}
  };
  panel.append(publishThree,publishThreeResult);
  const continueButton=document.createElement('button');continueButton.type='button';
  continueButton.textContent='Run next Wayne batch (up to 3)';
  const continueStatus=document.createElement('div');continueStatus.setAttribute('role','status');
  continueStatus.style.cssText='margin:12px 0;color:#d7f6e8;overflow-wrap:anywhere';
  async function showWayneState(){
   try{
    const r=await window.PPABrainRequest('/.netlify/functions/owner-brain-wayne-run',
     {credentials:'same-origin',cache:'no-store'});
    const d=await r.json();if(!r.ok)throw Error(d.error||'Status unavailable');
    continueStatus.textContent='Wayne cursor: '+d.cursor+
     ' · GIS calls today: '+d.dailyUsed+'/'+d.dailyLimit+
     ' · Published by batch worker: '+d.published+
     ' · Review: '+d.needsReview+' · State: '+(d.state||'idle');
   }catch(e){continueStatus.textContent='Wayne batch status unavailable: '+e.message;}
  }
  continueButton.onclick=async()=>{
   if(!confirm('Process up to 3 more Detroit-address Wayne parcels, save the cursor and publish only officially verified polygons in this isolated preview? No paid AI calls.'))return;
   continueButton.disabled=true;continueStatus.textContent='Running bounded official GIS checks…';
   try{
    const r=await window.PPABrainRequest('/.netlify/functions/owner-brain-wayne-run',{
     method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({action:'run-wayne-batch',confirmed:true})});
    const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'Batch failed');
    continueStatus.replaceChildren();
    const p=document.createElement('p');p.textContent='Cursor '+d.cursor+' · '+d.attempted+
     ' GIS lookups · '+d.published+' published · '+d.needsReview+' needing review · '+d.failures+' failures';
    continueStatus.append(p);
    for(const item of d.rows||[]){const row=document.createElement('p');
     row.textContent='Parcel '+item.parcelId+' — '+item.status.replaceAll('_',' ')+(item.reason?' · '+item.reason:'');
     continueStatus.append(row);}
    if(typeof load==='function')await load();
   }catch(e){continueStatus.textContent='Batch stopped: '+e.message;}
   finally{continueButton.disabled=false;}
  };
  panel.append(continueButton,continueStatus);
  await showWayneState();
  const polygonButton=document.createElement('button');polygonButton.type='button';
  polygonButton.textContent='Check 4 parcel boundaries (no MapTiler)';
  const polygonResults=document.createElement('div');polygonResults.setAttribute('role','status');
  polygonResults.style.cssText='margin:12px 0;color:#d7f6e8;overflow-wrap:anywhere';
  polygonButton.onclick=async()=>{
   polygonButton.disabled=true;polygonResults.textContent='Checking published official polygons…';
   try{
    const res=await fetch('/.netlify/functions/brain-map-county?dataset=MI-wayne',{cache:'no-store'});
    const d=await res.json();if(!res.ok||!d.ok)throw Error(d.error||'Correction feed unavailable');
    const ids=['01002263','01002754','01002830','01003357'];
    const published=Object.values(d.records||{});
    polygonResults.replaceChildren();
    let confirmed=0;
    for(const id of ids){
     const p=published.find(x=>String(x.p).replace(/\.$/,'')===id);
     const ring=p?.g?.[0];
     const valid=!!p&&p.verifiedGeometry===true&&Array.isArray(ring)&&ring.length>=4&&
      ring[0][0]===ring[ring.length-1][0]&&ring[0][1]===ring[ring.length-1][1]&&
      Array.isArray(p.bb)&&p.bb.length===4&&Array.isArray(p.cx)&&p.cx.length===2;
     if(valid)confirmed++;
     const row=document.createElement('p');
     row.textContent='Parcel '+id+' — '+(valid?'official boundary polygon present':'boundary missing or invalid');
     polygonResults.append(row);
    }
    const result=document.createElement('p');
    result.textContent=confirmed+'/4 polygons confirmed in the preview correction feed. Map display requires separate visual inspection.';
    polygonResults.prepend(result);
   }catch(e){polygonResults.textContent='Boundary check unavailable: '+e.message;}
   finally{polygonButton.disabled=false;}
  };
  panel.append(polygonButton,polygonResults);
  const diagnostics=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Diagnostic controls';diagnostics.append(summary,...buttons,note);panel.append(title,help,diagnostics);
  for(const [label,url] of [['Open test parcel on map','/map/?c=MI-wayne&p=01002263'],['Open MapTiler preview','/owner/maptiler/']]){
   const link=document.createElement('a');link.textContent=label;link.href=url;link.target='_blank';link.rel='noopener';link.style.marginRight='16px';panel.append(link);
  }
  root.prepend(panel);
 }catch{/* Production and signed-out visitors do not receive test controls. */}
})();
