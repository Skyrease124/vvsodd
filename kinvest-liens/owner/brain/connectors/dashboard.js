'use strict';
const api = '/.netlify/functions/owner-brain-connectors';
const picker = document.getElementById('county');
const statusLine = document.getElementById('status');
const details = document.getElementById('details');
let selection = 0;
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
    link.textContent=county.source;
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
  details.replaceChildren(list);
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
    statusLine.textContent='';
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
      source.textContent='Official source: '+item.source+' · '+item.checkedAt;
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
    details.append(summary,evidence,diagnostic);
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
    details.append(summary,evidence,review,button);
  }else details.append(summary,evidence,button);
}
