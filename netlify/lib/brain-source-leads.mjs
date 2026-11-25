const norm=x=>String(x??'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const county=x=>norm(String(x||'').replace(/\s+county$/i,''));
export function parcelReferences(excerpt){
 const refs=[];
 for(const match of String(excerpt||'').slice(0,14000).matchAll(/\bparcel\s+(?:id|number|no\.?)\s*[:#]\s*([A-Za-z0-9][A-Za-z0-9.\/-]{3,45})/gi)){
  const id=match[1].replace(/[.,;]+$/,'');if(/\d/.test(id)&&!refs.includes(id))refs.push(id);
 }
 return refs.slice(0,20);
}
export function linkParcels(source,refs,dataset){
 if(dataset?.state!=='FL'||county(dataset?.county)!==county(source.county))return [];
 const matches=[];
 for(const ref of refs){
  const rows=(dataset.recs||[]).filter(r=>norm(r.p)===norm(ref));
  if(rows.length!==1)continue;
  const r=rows[0];if(r.g||r.cx)continue;
  matches.push({dataset:dataset.id,state:'FL',county:dataset.county,recordId:r.i,parcelId:r.p,
   status:'needs_official_geometry',issue:'Official source mentions this parcel; geometry verification is still required',
   sourceLead:{sourceId:source.id,url:source.url,matchedReference:ref}});
 }
 return matches;
}
export async function saveSourceLead(source,saved,store,resolveDataset){
 const refs=parcelReferences(saved.excerpt),cases=refs.length?linkParcels(source,refs,await resolveDataset(source)):[];
 const inbox=await store.kvGet('brain-source-events-v1')||{entries:[]};
 const event={sourceId:source.id,url:source.url,county:source.county,state:'FL',checkedAt:saved.checkedAt,changed:saved.changed,hash:saved.hash,
  parcelReferences:refs,recordIds:cases.map(r=>r.recordId),status:cases.length?'parcel_cases_linked':'source_lead_only',
  note:cases.length?'Exact county and parcel identifiers matched; official polygon verification is still required.':'No unique supported parcel join; retained as source evidence only.'};
 if(cases.length){
  const queue=await store.kvGet('owner-brain-scanner-v1')||{status:'idle',queue:[]};
  if(queue.status!=='paused'){
   for(const item of cases){
    const prior=queue.queue.find(r=>r.dataset===item.dataset&&r.recordId===item.recordId);
    if(prior)prior.sourceLead=item.sourceLead;
    else if(queue.queue.length<100)queue.queue.push(item);
   }
   queue.updatedAt=saved.checkedAt;await store.kvPut('owner-brain-scanner-v1',queue);
  }else event.status='paused';
 }
 inbox.entries=[event,...inbox.entries.filter(e=>e.sourceId!==source.id)].slice(0,100);
 await store.kvPut('brain-source-events-v1',inbox);return event;
}
