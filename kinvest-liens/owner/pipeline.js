(async()=>{
 try{
  const response=await fetch('/.netlify/functions/owner-brain-pipeline',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)return;const state=await response.json();
  const panel=document.createElement('section');panel.className='panel';panel.style.cssText='border:1px solid #345361;border-radius:16px;padding:18px;margin:16px 0;background:#112d3c;color:#edf7fa';
  const heading=document.createElement('h2');heading.textContent='Shared research pipeline';
  const counts=document.createElement('p');counts.textContent=state.sources+' source records · '+state.queued+' parcel cases · '+state.verified+' verified decisions · '+state.published+' published corrections';
  const flow=document.createElement('p');flow.textContent='Coverage gaps → source evidence → Brain verification → all maps → updated coverage';
  const note=document.createElement('p');note.textContent=state.scope;
  const monitor=document.createElement('p');const status=state.sourceMonitor||{};monitor.textContent=state.preview?'Preview sample is prepared automatically. Scheduled source scans run after production deployment.':'Source agent: '+(status.state||'awaiting first run').replaceAll('_',' ')+' · Last completed: '+(status.lastCompleted||'not yet')+' · Linked research cases: '+(state.linkedResearchCases||0)+(status.lastError?' · '+status.lastError:'');panel.append(heading,counts,flow,monitor,note);
  for(const [label,url] of [['Intelligence Center','/owner/intelligence/'],['AI Brain','/owner/brain/'],['Map Coverage & Repair','/owner/map-coverage/'],['MapTiler Preview','/owner/maptiler/']]){
   const a=document.createElement('a');a.href=url;a.textContent=label;a.style.cssText='color:#86e7cd;display:inline-block;margin:5px 15px 5px 0';panel.append(a);
  }
  const main=document.querySelector('main');if(main)main.prepend(panel);
 }catch{/* The primary dashboard retains its own access and error messages. */}
})();

(async()=>{
 const main=document.querySelector('main');if(!main)return;
 const panel=document.createElement('section');panel.className='panel';panel.style.cssText='border:1px solid #416d70;border-radius:16px;padding:18px;margin:16px 0;background:#112d3c;color:#edf7fa';
 const heading=document.createElement('h2');heading.textContent='County Agent Progress';
 const status=document.createElement('p');status.setAttribute('role','status');status.textContent='Loading current county priority…';panel.append(heading,status);
 const details=document.createElement('div');panel.append(details);
 const refresh=document.createElement('button');refresh.textContent='Refresh county status';refresh.type='button';refresh.style.cssText='background:#19543f;color:#fff;border:1px solid #75d7b6;border-radius:10px;padding:10px 14px;margin-top:8px';refresh.addEventListener('click',load);panel.append(refresh);
 const parent=document.querySelector('#app')||main;parent.prepend(panel);
 function line(text){const p=document.createElement('p');p.textContent=text;return p;}
 async function load(){
  refresh.disabled=true;status.textContent='Checking saved county progress…';
  try{
   const response=await fetch('/.netlify/functions/owner-brain-county-progress',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(12000)});
   const d=await response.json();if(!response.ok||!d.ok)throw Error(d.error||'Progress unavailable');
   details.replaceChildren();
   if(d.complete){status.textContent='Every county passed the stored completion gate.';return;}
   const c=d.current;
   status.textContent='County '+c.position+' of '+c.total+': '+c.county+', '+c.state+' · '+d.state.replaceAll('_',' ');
   details.append(line('Records: '+c.records.toLocaleString()+' · Baseline mapped: '+c.baselineMapped.toLocaleString()+' · Verified correction entries: '+c.verifiedCorrections.toLocaleString()+' · Estimated remaining: '+c.estimatedRemaining.toLocaleString()));
   // Use only existing mapped records and verified published polygon corrections.
   // A partial percentage remains visible as 0.02% rather than rounding to zero.
   const total=Math.max(0,Number(c.records)||0);
   const completed=Math.min(total,Math.max(0,(Number(c.baselineMapped)||0)+(Number(c.verifiedCorrections)||0)));
   const percent=total?completed/total*100:0;
   const progress=document.createElement('div');
   progress.style.cssText='margin:14px 0 18px';
   const progressLabel=document.createElement('div');
   progressLabel.style.cssText='display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:9px;font-weight:700';
   const title=document.createElement('span');title.textContent='County mapping progress';
   const value=document.createElement('span');value.style.color='#79e2c2';value.style.fontVariantNumeric='tabular-nums';
   value.textContent=(percent>0&&percent<1?percent.toFixed(2):percent.toFixed(1))+'%';
   progressLabel.append(title,value);
   const track=document.createElement('div');
   track.setAttribute('role','progressbar');track.setAttribute('aria-label','Verified county mapping progress');
   track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');track.setAttribute('aria-valuenow',percent.toFixed(4));
   track.style.cssText='height:12px;background:#304858;border-radius:999px;overflow:hidden';
   const fill=document.createElement('div');
   fill.style.cssText='height:100%;width:'+percent.toFixed(4)+'%;background:linear-gradient(90deg,#35cfa8,#80edc8);border-radius:999px;transition:width .4s ease';
   track.append(fill);
   const foot=document.createElement('p');foot.style.cssText='color:#a7c7d0;font-size:13px;margin:8px 0 0';
   foot.textContent=completed.toLocaleString()+' of '+total.toLocaleString()+' mapped or verified · '+(total-completed).toLocaleString()+' remaining (estimated)';
   progress.append(progressLabel,track,foot);
   details.append(progress);
   details.append(line('Queue: '+d.queue.cases+' cases · '+d.queue.staged+' staged · '+d.queue.needsReview+' needing review · '+d.queue.publishedHistory+' publication history entries'));
   details.append(line('Agent activity: Official GIS '+d.agents.official.state+' · Photon '+d.agents.photon.state+' · Geoapify '+d.agents.geoapify.state+' · Publisher '+d.agents.publisher.state));
   if(c.blocker){const warning=line('Blocked: '+c.blocker);warning.style.color='#f0cb86';details.append(warning);}
   const note=line('County changes only after full verification. Address searches alone do not count as mapped.');note.style.color='#a7c7d0';details.append(note);
  }catch(e){status.textContent='County progress unavailable: '+e.message;}
  finally{refresh.disabled=false;}
 }
 await load();
})();
