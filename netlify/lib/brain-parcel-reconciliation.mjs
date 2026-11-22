// Read-only, multi-county reconciliation queue. A matching address or proposed
// identifier is a research lead, never evidence of legal parcel succession.
// No GIS requests, publication, budget, cursor, or persistent writes.
const id=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9.-]{0,39}$/.test(v)?v:'';
const iso=v=>typeof v==='string'&&!Number.isNaN(Date.parse(v))?v:null;
const http=v=>typeof v==='string'&&/^https:\/\/[A-Za-z0-9.-]+(?:\/[\w./?=&%-]*)?$/.test(v)?v:null;
const short=v=>typeof v==='string'?v.slice(0,220):'';
const needed=Object.freeze([
  'Official recorded plat or subdivision document and reception number',
  'Official Assessor parcel history or Treasurer-to-Assessor cross-reference identifying both parcel/schedule pairs',
  'Independent confirmation of which recorded legal lot the current parcel represents'
]);
export function reconciliationCase({dataset,recordId,original,candidate,sources=[],checkedAt,documents=[]}={}){
  if(!id(dataset)||typeof recordId!=='string'||recordId.length>120||!recordId.startsWith(dataset.replace('-', '|')+'|')||!id(original?.parcelId)||!id(candidate?.parcelId)||
     original.parcelId===candidate.parcelId) return null;
  if(!Array.isArray(sources)||!Array.isArray(documents))return null;
  const originalPair={parcelId:original.parcelId,schedule:id(original.schedule)||null};
  const candidatePair={parcelId:candidate.parcelId,schedule:id(candidate.schedule)||null,
    objectId:Number.isSafeInteger(candidate.objectId)&&candidate.objectId>0?candidate.objectId:null};
  const references=sources.slice(0,12).filter(s=>http(s?.url)).map(s=>({
    authority:short(s.authority),url:http(s.url),finding:short(s.finding),date:short(s.date)
  }));
  // Source references or shared addresses alone NEVER establish an official legal link.
  // Cross-reference documents must explicitly identify both original and candidate ID pairs.
  const linked=documents.some(d=>d?.type==='official_parcel_cross_reference'&&
    http(d.url)&&id(d.receptionNumber)&&d.originalParcel===originalPair.parcelId&&
    d.currentParcel===candidatePair.parcelId&&
    (!originalPair.schedule||d.originalSchedule===originalPair.schedule)&&
    (!candidatePair.schedule||d.currentSchedule===candidatePair.schedule));
  return {
    dataset,recordId,original:originalPair,candidate:candidatePair,
    status:linked?'documented_link_pending_owner_review':'unresolved_owner_review',
    verificationLevel:linked?'documentary_candidate':'research_lead',
    checkedAt:iso(checkedAt),sources:references,
    missingEvidence:linked?['Owner inspection of complete official document and legal lot boundaries']:needed,
    publicationAllowed:false,identifierChangeAllowed:false,automationEnabled:false,
    nextAction:linked?'Owner must independently examine the complete recorded document and legal lot before any further authorization':
      'Find recorded plat and official Assessor history linking both parcel and schedule pairs'
  };
}
export function reconciliationQueue(cases=[]){
  if(!Array.isArray(cases))return [];
  const seen=new Set();
  return cases.slice(0,100).filter(c=>{
    if(!c||c.publicationAllowed!==false||!['unresolved_owner_review','documented_link_pending_owner_review'].includes(c.status))return false;
    const key=c.dataset+'|'+c.recordId;
    if(seen.has(key))return false;
    seen.add(key);return true;
  });
}
