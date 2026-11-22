'use strict';
const api = '/.netlify/functions/owner-brain-connectors';
const picker = document.getElementById('county');
const statusLine = document.getElementById('status');
const details = document.getElementById('details');
let selection = 0;
function disclose(label,content){
  const panel=document.createElement('details'),summary=document.createElement('summary');
  summary.textContent=label;
  panel.append(summary,content);
  return panel;
}
function grouped(label,...nodes){
  const panel=document.createElement('section'),heading=document.createElement('h2');
  heading.textContent=label;
  panel.append(heading,...nodes);
  return panel;
}
const read = async (url,options={}) => {
  const response = await fetch(url,{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(12000),...options});
  const data = await response.json();
  if(!response.ok)throw Error(data.error||'County data unavailable');
  return data;
};
function render(county,coverage){
  const list=document.createElement('dl');
  function add(name,value){
    const term=document.createElement('dt'), description=document.createElement('dd');
    term.textContent=name;
    if(value instanceof Node)description.append(value);
    else description.textContent=value;
    list.append(term,description);
  }
  add('Connector status',county.status);
  add('Connector type',county.connector||'Unassigned');
  if(county.source){
    const link=document.createElement('a');
    link.href=county.source;
    link.textContent='Open official GIS source';
    add('Official GIS source',link);
  }else add('Official GIS source','Awaiting review');
  if(county.scope)add('Scope',county.scope);
  add('Verification compatibility',county.compatibility||'Not yet reviewed');
  add('Last successful connector test',county.lastTest||'No full connector trial recorded');
  if(county.reason)add('Review note',county.reason);
  add('Available parcel records',coverage.available);
  add('Mapped in the original dataset',coverage.mapped);
  add('Verified Brain corrections',coverage.verified);
  add('Remaining unmapped records',coverage.remaining);
  add('Correction completion',coverage.completion===null?'No unmapped records in the original dataset':coverage.completion.toFixed(2)+'% of original unmapped records');
  const cards=document.createElement('div');
  cards.className='metrics';
  for(const [label,value] of [['Available',coverage.available],['Originally mapped',coverage.mapped],
    ['Verified corrections',coverage.verified],['Unmapped',coverage.remaining]]){
    const card=document.createElement('div'),number=document.createElement('strong'),name=document.createElement('span');
    card.className='metric';
    number.textContent=value;
    name.textContent=label;
    card.append(number,name);
    cards.append(card);
  }
  const overview=grouped(county.state+' · '+county.county,cards);
  if(coverage.completion!==null){
    const progress=document.createElement('progress');
    progress.max=100;
    progress.value=coverage.completion;
    progress.setAttribute('aria-label','Verified correction completion');
    overview.append(progress);
  }
  overview.append(disclose('Connector and coverage details',list));
  details.replaceChildren(overview);
}
async function showCounty(){
  const request=++selection;
  statusLine.textContent='Checking county coverage…';
  details.replaceChildren();
  try{
    const {county,coverage}=await read(api+'?'+new URLSearchParams({dataset:picker.value}));
    if(request!==selection)return;
    render(county,coverage);
    if(county.id==='CO-larimer'&&location.hostname==='deploy-preview-454--pricepocketasset.netlify.app')await showTrial(request);
    if(request===selection)statusLine.textContent='';
  }catch(error){if(request===selection)statusLine.textContent=error.message;}
}
picker.addEventListener('change',showCounty);
(async()=>{
  try{
    const {counties}=await read(api);
    for(const county of counties.sort((a,b)=>(a.state+a.county).localeCompare(b.state+b.county))){
      picker.add(new Option(county.state+' · '+county.county+' · '+county.status,county.id));
    }
    if(counties.some(county=>county.id==='CO-larimer'))picker.value='CO-larimer';
    document.getElementById('dashboard').hidden=false;
    await showCounty();
  }catch(error){statusLine.textContent=error.message;}
})();

async function showTrial(request){
  const url='/.netlify/functions/owner-brain-larimer-trial';
  const result=await read(url);
  if(request!==selection)return;
  const summary=document.createElement('p');
  summary.textContent='Larimer research trial: '+result.used+'/'+result.limit+' requests reserved. '+result.cursor+' exact matches recorded.';
  const evidence=document.createElement('ul');
  function showDiagnostics(row,item){
    if(item.source){
      const source=document.createElement('p');
      const link=document.createElement('a');
      link.href=item.source;
      link.textContent='Official source';
      source.append(link,document.createTextNode(' · '+item.checkedAt));
      row.append(source);
    }
    const d=item.diagnostics;
    const outcome=document.createElement('p');
    outcome.textContent=d?
      'Stage: '+d.stage+' · Result: '+(d.reasonCode||'verified')+' · HTTP: '+(d.httpStatus??'Unavailable')+
      ' · ArcGIS status: '+(d.arcgisStatus??'None')+' · Results: '+(d.resultCount??'Unavailable')+
      ' · Returned parcel IDs: '+(d.returnedParcelIds.join(', ')||'None recorded')+
      ' · Transfer limit: '+(d.transferLimit===null?'Unknown':d.transferLimit?'Yes':'No'):
      'Detailed provider diagnostics were not saved for this attempt.';
    row.append(outcome);
  }
  for(const item of result.evidence){
    const row=document.createElement('li');
    row.textContent=item.parcelId+' · '+item.officialAddress+' · Object '+item.objectId+' · '+item.checkedAt;
    showDiagnostics(row,item);
    evidence.append(row);
  }
  if(result.retry){
    const row=document.createElement('li');
    row.textContent=result.retry.recordId+' · '+result.retry.reason+(result.retry.exhausted?' · Owner review required':
      ' · Retry after '+new Date(result.retry.nextAt).toLocaleString());
    showDiagnostics(row,result.retry);
    evidence.append(row);
  }
  const button=document.createElement('button');
  button.textContent='Verify next Larimer parcel';
  button.disabled=result.used>=result.limit||result.cursor>=result.parcelIds.length||
    result.retry?.exhausted===true||Number(result.retry?.nextAt)>Date.now();
  button.onclick=async()=>{
    if(!confirm('Send one request to Larimer County GIS and save the result in preview research?'))return;
    button.disabled=true;
    statusLine.textContent='Checking the official parcel…';
    try{
      await read(url,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:'verify-next-larimer',confirmed:true})});
      await showCounty();
    }catch(error){statusLine.textContent=error.message+' Refresh before trying again.';}
  };
  if(result.addressDiagnostic){
    const diagnostic=result.addressDiagnostic;
    const row=document.createElement('li');
    const candidates=diagnostic.rows.map(entry=>
      'Parcel '+(entry.parcelId||'unavailable')+', schedule '+(entry.schedule||'unavailable')+
      ', object '+(entry.objectId??'unavailable')).join(' | ');
    row.textContent='Address diagnostic (research only) · '+diagnostic.status.replaceAll('_',' ')+
      ' · Results: '+(diagnostic.resultCount??'unavailable')+' · HTTP: '+(diagnostic.httpStatus??'unavailable')+
      ' · '+diagnostic.checkedAt+(candidates?' · '+candidates:'');
    evidence.append(row);
  }
  if(result.reconciliation){
    const item=result.reconciliation;
    const row=document.createElement('li');
    const title=document.createElement('strong');
    title.textContent='Treasurer-to-Assessor reconciliation: '+item.status+' · Owner review';
    const summary=document.createElement('p');
    summary.textContent=item.original.parcelId+' / '+item.original.schedule+' → '+item.candidate.parcelId+
      ' / '+item.candidate.schedule+' (address lead). '+item.explanation;
    const sources=document.createElement('ul');
    for(const entry of item.sources){
      const citation=document.createElement('li'),link=document.createElement('a');
      link.href=entry.url;
      link.textContent=entry.authority;
      citation.append(link,document.createTextNode(' · '+entry.date+' · '+entry.finding));
      sources.append(citation);
    }
    const next=document.createElement('p');
    next.textContent=item.nextEvidence;
    row.append(title,summary,sources,next);
    const entry=document.createElement('ul');
    entry.append(row);
    details.append(disclose('Treasurer-to-Assessor evidence',entry));
  }
  if(Array.isArray(result.reconciliationCases)&&result.reconciliationCases.length){
    const section=document.createElement('section'),title=document.createElement('h2');
    title.textContent='Parcel identity reconciliation queue';
    const description=document.createElement('p');
    description.textContent='Research-only cases. Address matches do not establish legal parcel identity or authorize publication.';
    section.append(title,description);
    for(const item of result.reconciliationCases){
      const entry=document.createElement('div'),heading=document.createElement('strong');
      heading.textContent=item.dataset+' · '+item.status.replaceAll('_',' ')+' · No publication';
      const identifiers=document.createElement('p');
      identifiers.textContent='Treasurer '+item.original.parcelId+' / '+(item.original.schedule||'unknown')+
        ' → GIS lead '+item.candidate.parcelId+' / '+(item.candidate.schedule||'unknown');
      const need=document.createElement('p');
      need.textContent='Next evidence required: '+item.missingEvidence.join('; ');
      const references=document.createElement('ul');
      for(const src of item.sources){
        const li=document.createElement('li'),link=document.createElement('a');
        link.href=src.url;link.textContent=src.authority||'Official record';
        link.rel='noopener noreferrer';link.target='_blank';
        li.append(link,document.createTextNode(' · '+src.finding));references.append(li);
      }
      entry.append(heading,identifiers,need,references);section.append(disclose(item.original.parcelId+' · Owner review',entry));
    }
    details.append(section);
    await showResearch(request);
    if(request!==selection)return;
  }
  if(result.canRunAddressDiagnostic){
    const diagnostic=document.createElement('button');
    diagnostic.textContent='Run final address diagnostic';
    diagnostic.onclick=async()=>{
      if(!confirm('Use the final Larimer request for 741 Lindenmeier Rd, Fort Collins? This saves research only and keeps the parcel on review.'))return;
      diagnostic.disabled=true;
      statusLine.textContent='Checking the address with Larimer County…';
      try{
        await read(url,{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({action:'diagnose-larimer-address',confirmed:true})});
        await showCounty();
      }catch(error){statusLine.textContent=error.message+' Refresh and inspect the saved trial budget.';}
    };
    details.append(grouped('GIS verification',summary,disclose('GIS evidence and diagnostics',evidence),diagnostic));
    return;
  }
  if(result.retry?.exhausted===true&&result.used<result.limit){
    const review=document.createElement('button');
    review.textContent='Approve retry of same Larimer parcel';
    review.onclick=async()=>{
      if(!confirm('Re-arm ONLY parcel '+result.retry.recordId+' for one additional owner-confirmed GIS request later? This does NOT send a GIS request now. The existing '+result.used+'/'+result.limit+' reservation stays unchanged.'))return;
      review.disabled=true;
      statusLine.textContent='Re-arming the same saved review checkpoint…';
      try{
        await read(url,{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({action:'rearm-larimer-review',confirmed:true,recordId:result.retry.recordId})});
        await showCounty();
      }catch(error){statusLine.textContent=error.message+' Refresh and inspect the held parcel.';}
    };
    details.append(grouped('GIS verification',summary,disclose('GIS evidence and diagnostics',evidence),review,button));
  }else details.append(grouped('GIS verification',summary,disclose('GIS evidence and diagnostics',evidence),button));
}


async function showResearch(request){
  const url='/.netlify/functions/owner-brain-reconciliation-research';
  const panel=document.createElement('section');
  const title=document.createElement('h2');
  title.textContent='Parcel history research';
  panel.append(title);
  try{
    const data=await read(url);
    if(request!==selection)return;
    const add=text=>{
      const line=document.createElement('p');
      line.textContent=text;
      panel.append(line);
    };
    add('Research workspace: '+data.status+' · '+(data.paused?'Paused':'Resumed')+' · Automatic research disabled');
    add('Recorded plat: '+(data.recordedDocument||'Not obtained')+' · Relationship: '+(data.relationship||'Unresolved')+
      ' · Evidence: '+(data.evidenceComplete?'Complete for review':'Incomplete')+
      (data.conflicting?' · Conflicting records need review':''));
    add('Last research attempt: '+(data.lastAttempt?data.lastAttempt.at+' · '+data.lastAttempt.outcome:'None recorded by this workflow'));
    if(data.missing.length)add('Missing: '+data.missing.join('; '));
    if(data.sourceProgress){
      const progress=document.createElement('progress');
      progress.max=data.sourceProgress.total;
      progress.value=data.sourceProgress.reviewed;
      progress.setAttribute('aria-label','Approved sources checked or budget closed');
      add(data.sourceProgress.reviewed+'/'+data.sourceProgress.total+' source checks finished or budget closed');
      panel.append(progress);
    }
    const refs=document.createElement('ul');
    for(const item of data.sources){
      const li=document.createElement('li'),link=document.createElement('a');
      link.href=item.url;
      link.textContent=item.authority;
      li.append(link,document.createTextNode(' · '+(item.data||'Planning record')+
        (item.restriction?' · '+item.restriction:'')+(typeof item.limit==='number'?' · Budget: '+item.limit:'')));
      refs.append(li);
    }
    panel.append(disclose('Official research sources',refs));
    const saved=document.createElement('ul');
    for(const entry of data.evidence){
      const document=entry.document;
      const row=document.createElement('li'),link=document.createElement('a');
      link.href=entry.url;
      link.textContent=entry.authority;
      row.append(link,document.createTextNode(' · '+entry.at+' · '+entry.outcome+
        (entry.metadata?' · '+entry.metadata.title+' · Image access: '+entry.metadata.imageAccess.replaceAll('_',' '):'')+
        (document?' · Reference '+document.reference+(document.decision?' · '+document.decision+' '+(document.decisionDate||''):'')+(document.legalDescription?' · '+document.legalDescription:''):'')));
      saved.append(row);
    }
    panel.append(disclose('Saved research evidence',saved));
    const timeline=document.createElement('ol');
    timeline.className='timeline';
    for(const event of [...(data.events||[])].reverse()){
      const row=document.createElement('li');
      row.textContent=event.at+' · '+event.sourceId+' · '+event.outcome+(event.httpStatus?' · HTTP '+event.httpStatus:'');
      timeline.append(row);
    }
    panel.append(disclose('Research activity',timeline));
    const button=document.createElement('button');
    const action=data.paused?'resume':'pause';
    button.textContent=data.paused?'Resume research queue':'Pause research queue';
    button.onclick=async()=>{
      if(!confirm('Save '+action+' for the preview research queue? No research requests will run.'))return;
      button.disabled=true;
      try{
        await read(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,confirmed:true})});
        await showCounty();
      }catch(error){statusLine.textContent=error.message;}
    };
    panel.append(button);
    add('One-time Fort Collins planning test: '+data.planningTestStatus);
    const run=document.createElement('button');
    run.textContent='Run One Research Test';
    run.disabled=data.paused||data.planningTestStatus!=='available';
    run.onclick=async()=>{
      if(!confirm('Send one read-only request to Fort Collins Planning for BDR240012? This saves research evidence only.'))return;
      run.disabled=true;
      statusLine.textContent='Checking the public Fort Collins planning record…';
      try{
        await read(url,{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({action:'run-one-planning-test',confirmed:true})});
        await showCounty();
      }catch(error){statusLine.textContent=error.message+' Refresh to inspect the saved reservation.';}
    };
    panel.append(run);
    if(data.nextSource){
      const source=data.nextSource;
      add('Next source: '+source.authority+' · '+source.used+'/'+source.limit+' requests reserved');
      const next=document.createElement('button');
      next.textContent='Run Next Research Source';
      next.disabled=data.paused||data.researchBusy||data.planningTestStatus!=='completed'||Number(data.retryAt)>Date.now();
      next.onclick=async()=>{
        if(!confirm('Send one public metadata request to '+source.authority+'? No forms, document images or parcel GIS will be requested.'))return;
        next.disabled=true;
        try{
          await read(url,{method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({action:'run-next-source',confirmed:true,sourceId:source.id,used:source.used})});
          await showCounty();
        }catch(error){statusLine.textContent=error.message+' Refresh to inspect the saved checkpoint.';}
      };
      panel.append(next);
    }else add('The approved sources have been checked or their budgets are exhausted.');
  }catch(error){
    if(request!==selection)return;
    const failure=document.createElement('p');
    failure.textContent=error.message;
    panel.append(failure);
  }
  details.append(panel);
}
