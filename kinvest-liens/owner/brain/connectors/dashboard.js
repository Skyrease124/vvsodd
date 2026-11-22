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
  let data;
  try{data=await response.json();}catch{throw Error('County data unavailable');}
  if(!response.ok||!data||typeof data!=='object')throw Error(data?.error||'County data unavailable');
  return data;
};
function render(county,coverage,operation){
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
  if(county.source||operation?.source){
    const link=document.createElement('a');
    link.href=county.source||operation.source;
    link.textContent='Open official GIS source';
    add('Official GIS source',link);
  }else add('Official GIS source','Awaiting review');
  if(operation?.attribution)add('Source attribution',operation.attribution);
  if(county.scope)add('Scope',county.scope);
  add('Verification compatibility',county.compatibility||'Not yet reviewed');
  add('Last successful connector test',county.lastTest||'No full connector trial recorded');
  if(county.reason)add('Review note',county.reason);
  add('Available parcel records',coverage.available);
  add('Mapped in the original dataset',coverage.mapped);
  add('Verified Brain corrections',coverage.verified);
  add('Remaining unmapped records',coverage.remaining);
  add('Correction completion',coverage.completion===null?'No unmapped records in the original dataset':coverage.completion.toFixed(2)+'% of original unmapped records');
  if(operation){
    add('Processing status',operation.mode==='existing-worker'?(operation.state||'Not started').replaceAll('_',' '):operation.mode==='pilot-prepared'?'Pilot prepared · Awaiting approval':'Research only · disabled');
    const progress=operation.progress;
    add('Eligible and processed',progress?(progress.total-progress.pending)+' of '+progress.total:'No saved operation totals');
    add('Processing completion',progress?progress.processingPercent+'%':'Unavailable');
    add('Verified coverage',progress?progress.verified+' · '+progress.verifiedPercent+'%':'Unavailable');
    add('Skipped records awaiting review',operation.pendingReview??'Unavailable');
    add('Last successful processing',operation.lastSuccessfulAt?new Date(operation.lastSuccessfulAt).toLocaleString():'Unrecorded');
    if(operation.quota)add('Shared GIS requests remaining',operation.quota.used===null?
      'Unavailable'+(operation.quota.resumeAt?' · Reopens '+new Date(operation.quota.resumeAt).toLocaleString():''):
      Math.max(0,operation.quota.limit-operation.quota.used)+' of '+operation.quota.limit);
    if(operation.sourceHealth?.reason)add('Source health',operation.sourceHealth.reason+
      (operation.sourceHealth.nextAt?' · Recheck '+new Date(operation.sourceHealth.nextAt).toLocaleString():''));
    if(operation.publicationPending)add('Recovery','Saved publication recovery required');
  }
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
    if(!picker.value){statusLine.textContent='No counties match these filters.';return;}
    const {county,coverage,operation}=await read(api+'?'+new URLSearchParams({dataset:picker.value}));
    if(request!==selection)return;
    render(county,coverage,operation);
    if(operation?.mode==='pilot-prepared'&&location.hostname==='deploy-preview-454--pricepocketasset.netlify.app')await showCountyPilot(county.id,request);
    if(county.id==='CO-larimer'&&location.hostname==='deploy-preview-454--pricepocketasset.netlify.app')await showTrial(request);
    if(request===selection)statusLine.textContent='';
  }catch(error){if(request===selection)statusLine.textContent=error.message;}
}
picker.addEventListener('change',showCounty);
(async()=>{
  try{
    const {counties}=await read(api);
    counties.sort((a,b)=>(a.state+a.county).localeCompare(b.state+b.county));
    const state=document.getElementById('county-state'),name=document.getElementById('county-name'),mode=document.getElementById('county-mode');
    for(const code of [...new Set(counties.map(county=>county.state))].sort())state.add(new Option(code,code));
    function updatePicker(preferred=picker.value){
      const query=name.value.trim().toLowerCase();
      picker.replaceChildren();
      for(const county of counties){
        if(state.value&&state.value!==county.state||
           query&&!county.county.toLowerCase().includes(query)||
           mode.value&&mode.value!==(county.operation?.mode||'unconfigured'))continue;
        picker.add(new Option(county.state+' · '+county.county+' · '+county.status,county.id));
      }
      if([...picker.options].some(option=>option.value===preferred))picker.value=preferred;
      picker.disabled=!picker.options.length;
      return showCounty();
    }
    state.addEventListener('change',()=>updatePicker());
    name.addEventListener('change',()=>updatePicker());
    mode.addEventListener('change',()=>updatePicker());
    document.getElementById('dashboard').hidden=false;
    await updatePicker('CO-larimer');
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
      ' · Returned parcel IDs: '+((d.returnedParcelIds||[]).join(', ')||'None recorded')+
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
    if(data.missing?.length)add('Missing: '+data.missing.join('; '));
    if(data.sourceProgress){
      const progress=document.createElement('progress');
      progress.max=data.sourceProgress.total;
      progress.value=data.sourceProgress.reviewed;
      progress.setAttribute('aria-label','Approved sources checked or budget closed');
      add(data.sourceProgress.reviewed+'/'+data.sourceProgress.total+' source checks finished or budget closed');
      panel.append(progress);
    }
    const refs=document.createElement('ul');
    for(const item of data.sources||[]){
      const li=document.createElement('li'),link=document.createElement('a');
      link.href=item.url;
      link.textContent=item.authority;
      li.append(link,document.createTextNode(' · '+(item.data||'Planning record')+
        (item.restriction?' · '+item.restriction:'')+(typeof item.limit==='number'?' · Budget: '+item.limit:'')));
      refs.append(li);
    }
    const sourceSection=disclose('Official research sources',refs);
    const saved=document.createElement('ul');
    for(const entry of data.evidence||[]){
      const recordDocument=entry.document;
      const row=document.createElement('li'),link=document.createElement('a');
      link.href=entry.url;
      link.textContent=entry.authority;
      row.append(link,document.createTextNode(' · '+entry.at+' · '+entry.outcome+
        (entry.metadata?' · '+entry.metadata.title+' · Image access: '+(entry.metadata.imageAccess||'not recorded').replaceAll('_',' '):'')+
        (recordDocument?' · Reference '+recordDocument.reference+(recordDocument.decision?' · '+recordDocument.decision+' '+(recordDocument.decisionDate||''):'')+(recordDocument.legalDescription?' · '+recordDocument.legalDescription:''):'')));
      saved.append(row);
    }
    const savedSection=disclose('Saved research evidence',saved);
    const timeline=document.createElement('ol');
    timeline.className='timeline';
    for(const event of [...(data.events||[])].reverse()){
      const row=document.createElement('li');
      row.textContent=event.at+' · '+event.sourceId+' · '+event.outcome+(event.httpStatus?' · HTTP '+event.httpStatus:'');
      timeline.append(row);
    }
    const timelineSection=disclose('Research activity',timeline);
    const controls=document.createElement('div');
    controls.className='research-controls';
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
    controls.append(button);
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
    if(data.planningTestStatus==='available')controls.append(run);
    if(data.nextSource){
      const source=data.nextSource;
      add('Next source: '+source.authority+' · '+source.used+'/'+source.limit+' requests reserved');
      const next=document.createElement('button');
      next.textContent='Run Next Research Source';
      next.disabled=data.paused||data.researchBusy||data.planningTestStatus!=='completed'||Number(data.retryAt)>Date.now();
      if(next.disabled){
        add(data.paused?'Resume the queue to enable the next source.':data.researchBusy?'A research request is in progress.':
          data.planningTestStatus!=='completed'?'Complete the one-time planning test first.':
          'Next retry after '+new Date(data.retryAt).toLocaleString()+'.');
      }
      next.onclick=async()=>{
        if(!confirm('Send one public metadata request to '+source.authority+'? No forms, document images or parcel GIS will be requested.'))return;
        next.disabled=true;
        try{
          await read(url,{method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({action:'run-next-source',confirmed:true,sourceId:source.id,used:source.used})});
          await showCounty();
        }catch(error){statusLine.textContent=error.message+' Refresh to inspect the saved checkpoint.';}
      };
      controls.prepend(next);
    }else add('The approved sources have been checked or their budgets are exhausted.');
    panel.append(controls,renderResearchAudit(data.audit||[]),renderDocumentPlans(data.documentPlans||[]),
      sourceSection,savedSection,timelineSection);
  }catch(error){
    if(request!==selection)return;
    const failure=document.createElement('p');
    failure.textContent=error.message;
    panel.append(failure);
  }
  details.append(panel);
}


function renderResearchAudit(sources){
  const list=document.createElement('ul');
  for(const source of sources){
    const item=document.createElement('li');
    const title=document.createElement('strong');
    title.textContent=source.authority+' · '+source.reserved+' reserved · '+source.completed+
      ' completed · '+source.upstreamResponses+' upstream responses · '+source.remaining+' slots left';
    const endpoint=document.createElement('a');
    endpoint.href=source.endpoint;
    endpoint.textContent='Configured endpoint';
    item.append(title,document.createElement('br'),endpoint);
    if(source.lastReservedAt){
      const at=document.createElement('p');
      at.textContent='Last reservation: '+source.lastReservedAt;
      item.append(at);
    }
    const outcomes=document.createElement('ul');
    for(const receipt of source.receipts){
      const row=document.createElement('li');
      const link=document.createElement('a');
      link.href=receipt.endpoint;
      link.textContent=receipt.endpointRecorded?'Saved endpoint':'Configured endpoint';
      const reference=receipt.document?.reference;
      const http=receipt.httpStatus;
      row.append(link,document.createTextNode(' · '+receipt.at+' · '+receipt.outcome.replaceAll('_',' ')+
        ' · '+(http!==null?'HTTP '+http:'No upstream HTTP status saved')+
        ' · '+receipt.dataType.replaceAll('_',' ')+(reference?' · Record '+reference:'')+' · '+receipt.usefulness));
      outcomes.append(row);
    }
    if(!source.receipts.length){
      const row=document.createElement('li');
      row.textContent='No completed receipt recorded for this source.';
      outcomes.append(row);
    }
    const next=document.createElement('p');
    next.textContent='Next: '+source.nextAction;
    item.append(outcomes,next);
    list.append(item);
  }
  return disclose('Research audit · saved receipts',list);
}

function renderDocumentPlans(plans){
  const body=document.createElement('div');
  const note=document.createElement('p');
  note.textContent='Prepared lookups only. Automated execution is disabled pending owner approval and source-access review.';
  const list=document.createElement('ul');
  for(const plan of plans){
    const row=document.createElement('li');
    const link=document.createElement('a');
    link.href=plan.url;
    link.textContent=plan.authority;
    row.append(link,document.createTextNode(' · Search '+plan.field+' '+plan.term+' · '+plan.evidence+' · '+plan.restriction));
    if(plan.lead){
      const citation=document.createElement('a');
      citation.href=plan.lead.sourceUrl;
      citation.textContent='Larimer Assessor Account CSV';
      row.append(document.createTextNode(' · Unverified reference in '+plan.lead.shortLegalDescription+
        ' · '+plan.requestUsage+' · CSV observed '+plan.lead.checkedAt+' · '),citation);
    }
    list.append(row);
  }
  body.append(note,list);
  return disclose('Parcel Document Search · disabled',body);
}


async function showCountyPilot(id,selectionAtLoad){
 const endpoint='/.netlify/functions/owner-brain-county-pilot?'+new URLSearchParams({dataset:id});
 const state=await read(endpoint);
 if(selection!==selectionAtLoad)return;
 const panel=document.createElement('div'),note=document.createElement('p');
 const percentage=state.eligible?Math.round(100*state.processed/state.eligible):0;
 note.textContent='Eligible '+state.eligible+' · Processed '+state.processed+' ('+percentage+'%) · Evidence saved '+state.verifiedEvidence+
  ' · Verified map polygons '+state.published+' ('+(state.eligible?Math.round(100*state.published/state.eligible):0)+'%)'+
  ' · Pending '+Math.max(0,state.eligible-state.processed)+' · Shared requests remaining '+state.sharedRemaining+' · County requests remaining '+state.countyRemaining+
  ' · Pilot requests remaining '+(state.pilotRemaining??'No active permit')+' · Maximum '+state.pilotLimit;
 panel.append(note);
 const checks=document.createElement('p');
 checks.textContent='Folio '+(state.pilotFolio||'unavailable')+' · Skipped '+(state.skipped??'—')+
  ' · Last verified schema '+(state.schemaAt?new Date(state.schemaAt).toLocaleString():'Not checked live')+
  ' · Native EPSG:'+(state.nativeWkid??'—')+' · WGS84 '+
   (state.wgs84ValidatedAt?'validated '+new Date(state.wgs84ValidatedAt).toLocaleString():'Not validated live');
 panel.append(checks);
 if(state.terms){
  const terms=document.createElement('a');
  terms.href=state.terms;
  terms.textContent='Source access terms';
  panel.append(terms);
 }
 const health=document.createElement('p');
 health.textContent=(state.paused?'Paused':state.sourceHealth?.status?.replaceAll('_',' ')||'No saved source activity')+
  (state.sourceHealth?.reason?' · '+state.sourceHealth.reason:'')+
  (state.lastSuccessfulAt?' · Last processed '+new Date(state.lastSuccessfulAt).toLocaleString():'')+
  (state.cooldownUntil?' · Retry after '+new Date(state.cooldownUntil).toLocaleString():'');
 panel.append(health);
 if(state.blockers?.length){
  const blockers=document.createElement('p');
  blockers.textContent=state.blockers.join(' · ');
  panel.append(blockers);
 }
 function action(label,kind,row=null){
  const button=document.createElement('button');
  button.type='button';
  button.textContent=label;
  button.disabled=kind==='run'?!state.runAllowed:!state.active;
  button.onclick=async()=>{
   if(!confirm(label+' for this county?'))return;
   button.disabled=true;
   try{
    await read(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({action:kind,cursor:state.cursor,confirmed:true,...(row?{review:row}:{})})});
    await showCounty();
   }catch(error){statusLine.textContent=error.message;button.disabled=false;}
  };
  return button;
 }
 panel.append(action(state.paused?'Resume county':'Pause county',state.paused?'resume':'pause'));
 const check=document.createElement('button');
 check.type='button';
 check.textContent='Check Readiness';
 check.onclick=()=>showCounty();
 panel.append(check,action('Run Live '+(state.county||(id==='FL-broward'?'Broward':'Miami-Dade'))+' Pilot','run'));

 const list=document.createElement('ul');
 for(const [index,row] of Object.entries(state.review||{})){
  if(row.resolvedAt)continue;
  const item=document.createElement('li');
  item.textContent=row.parcelId+' · Skipped · Needs Review · '+row.reason+
   (row.checkedAt?' · '+new Date(row.checkedAt).toLocaleString():'')+' ';
  if(typeof row.source==='string'&&/^https:\/\//.test(row.source)){
   const citation=document.createElement('a');
   citation.href=row.source;citation.textContent='Official source';item.append(citation,document.createTextNode(' '));
  }
  item.append(action('Retry parcel','retry',{index:Number(index),parcelId:row.parcelId,checkedAt:row.checkedAt}));
  list.append(item);
 }
 if(list.childElementCount)panel.append(disclose('Skipped parcels awaiting review',list));
 details.append(grouped('County pilot controls',panel));
}
