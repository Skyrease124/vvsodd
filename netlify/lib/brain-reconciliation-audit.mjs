// Read-only audit of persisted request receipts. A queue cursor and an HTTP
// response from our own endpoint are not evidence of an upstream retrieval.
const completedOutcomes=new Set(['document','missing','restricted','unavailable','metadata']);
const usableDate=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?value:null;
const statusCode=value=>Number.isInteger(value)&&value>=100&&value<=599?value:null;

export function auditResearchSources(state,sources){
 const entries=Array.isArray(state?.evidence)?state.evidence:[];
 const events=Array.isArray(state?.events)?state.events:[];
 return sources.filter(source=>source.id!=='gis'&&source.id!=='planning').map(source=>{
  const planning=source.id==='fort_collins_planning';
  const limit=planning?1:source.limit;
  const count=planning?Number(Boolean(state?.planningTest?.reservedAt)):state?.reservations?.[source.id];
  const reserved=Number.isSafeInteger(count)&&count>=0?count:0;
  const evidence=entries.filter(entry=>entry?.sourceId===source.id&&usableDate(entry.at));
  const rows=new Map();
  for(const event of events){
   if(event?.sourceId!==source.id||!usableDate(event.at)||!completedOutcomes.has(event.outcome)||typeof event.id!=='string')continue;
   const saved=evidence.find(item=>item.at===event.at&&item.outcome===event.outcome);
   rows.set(event.id,{at:event.at,outcome:event.outcome,httpStatus:statusCode(event.httpStatus)??statusCode(saved?.httpStatus),
    endpoint:saved?.url===source.url?saved.url:source.url,endpointRecorded:saved?.url===source.url,
    document:saved?.document??null,metadata:saved?.metadata??null});
  }
  // Legacy records can contain evidence without a separate activity event.
  for(const item of evidence){
   if(!completedOutcomes.has(item.outcome)||[...rows.values()].some(row=>row.at===item.at&&row.outcome===item.outcome))continue;
   rows.set('legacy-'+item.at+'|'+item.outcome,{at:item.at,outcome:item.outcome,httpStatus:statusCode(item.httpStatus),
    endpoint:item.url===source.url?item.url:source.url,endpointRecorded:item.url===source.url,
    document:item.document??null,metadata:item.metadata??null});
  }
  const receipts=[...rows.values()].sort((a,b)=>b.at.localeCompare(a.at)).map(row=>({
   ...row,upstreamResponseObserved:row.httpStatus!==null,
   dataType:row.document?.type??(row.metadata?'public_access_metadata':'none_recorded'),
   usefulness:row.document?.type==='planning_record'?'Planning evidence only; no parcel history or recorded plat':
     row.document?'Official evidence for review; no identity approval':
     row.metadata?'Access information only; no parcel-specific record':'No usable parcel-specific evidence recorded'
  }));
  const starts=events.filter(event=>event?.sourceId===source.id&&event.outcome==='started'&&usableDate(event.at)).map(event=>event.at);
  if(planning&&usableDate(state?.planningTest?.reservedAt))starts.push(state.planningTest.reservedAt);
  return {id:source.id,authority:source.authority,endpoint:source.url,reserved,completed:receipts.length,
   upstreamResponses:receipts.filter(row=>row.upstreamResponseObserved).length,limit,remaining:Math.max(0,limit-reserved),
   lastReservedAt:starts.sort().at(-1)??null,receipts,
   nextAction:source.restriction??'Use the official parcel-specific records workflow for legal identity evidence.'};
 });
}
