'use strict';
const api = '/.netlify/functions/owner-brain-connectors';
const picker = document.getElementById('county');
const statusLine = document.getElementById('status');
const details = document.getElementById('details');
let selection = 0;
const read = async (url) => {
  const response = await fetch(url,{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(10000)});
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
