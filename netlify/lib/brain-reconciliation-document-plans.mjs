// Read-only query planning. These routes were confirmed as human-facing
// government search tools. No automated transport or credentials are configured.
const methods=Object.freeze({
 assessor:Object.freeze({
  authority:'Larimer County Assessor',url:'https://www.larimer.gov/assessor/search',mode:'public_search_form',
  fields:['parcel','schedule','address'],evidence:'Property record, then official parcel split or renumbering history',
  restriction:'Search parcel or schedule individually. A current property summary alone cannot establish lineage.'
 }),
 recorder:Object.freeze({
  authority:'Larimer County Clerk & Recorder',url:'https://records.larimer.org/landmarkweb',mode:'public_index',
  fields:['subdivision','reception'],evidence:'Recorded subdivision plat index entry, reception number and recording date',
  restriction:'Anonymous access exposes index data only. Authorized access is needed for document images; fees may apply to unwatermarked copies.'
 }),
 treasurer:Object.freeze({
  authority:'Larimer County Treasurer',url:'https://www.larimer.gov/treasurer/thirdparty/liens/sale',mode:'official_sale_source',
  fields:['parcel','schedule'],evidence:'Original tax-sale record; request an official cross-reference if needed',
  restriction:'Use the official sale listing and exact identifier columns. No documented automated identifier search is configured.'
 })
});
const trimmed=value=>typeof value==='string'?value.trim():'';

const larimerAccountCsv='https://storage.googleapis.com/lc-public/asr/assessor-public-account.csv';
const larimerAccountObservation=Object.freeze({
 sourceUrl:larimerAccountCsv, checkedAt:'2026-11-22T04:25:13Z',
 generation:'1795252332533535', csvLine:59825,
 parcel:'9701484001', schedule:'1688587', account:'R1688587',
 shortLegalDescription:'LOT 1, GLOVER ESTATE, FTC (20260006626)'
});

// Each source must supply its own field mapping and reference format.
// Extraction produces a search lead; only an official index can confirm it.
export function extractAssessorDocumentLead(observation){
 if(observation?.sourceUrl!==larimerAccountCsv)return null;
 const description=trimmed(observation.shortLegalDescription);
 const match=/^LOT [^,]+, [^()]+ \((\d{11})\)$/.exec(description);
 if(!match)return null;
 return {reference:match[1],classification:'document_reference_candidate',sourceUrl:larimerAccountCsv};
}


export function prepareDocumentSearch(source,field,value){
 if(!Object.hasOwn(methods,source)||!methods[source].fields.includes(field))throw Error('Search field unavailable for this source');
 const raw=trimmed(value);
 let term=raw;
 if(field==='parcel'){
  if(!/^(?:\d{10}|\d{5}-\d{2}-\d{3})$/.test(raw))throw Error('Expected a Larimer ten-digit parcel number');
  term=raw.replaceAll('-','');
 }else if(field==='schedule'){
  if(!/^[RPM]?\d{7}$/i.test(raw))throw Error('Expected a Larimer seven-digit schedule or account number');
  term=raw.toUpperCase();
 }else if(field==='reception'){
  if(!/^\d{5,18}$/.test(raw))throw Error('Expected the exact Recorder reception number');
 }else if(!/^[A-Za-z0-9][A-Za-z0-9 .,-]{2,79}$/.test(raw))throw Error('Invalid official search term');
 const method=methods[source];
 return {id:[source,field,term.toUpperCase()].join('|'),source,field,term,...method,
  approvalRequired:true,executionEnabled:false,publicationAllowed:false};
}

export function larimerDocumentPlans(){
 const lead=extractAssessorDocumentLead(larimerAccountObservation);
 return [
  {...prepareDocumentSearch('recorder','reception',lead.reference),lead:{...larimerAccountObservation,...lead},
   evidence:'Check exact Reception Number in Document Search. Capture document type, recording date and indexed legal description if available.',
   requestUsage:'One owner-approved manual index search after opening the portal. Zero application research reservations and zero GIS requests.'},
  prepareDocumentSearch('recorder','subdivision','Glover Estate'),
  ...['9701400014','9701484001'].map(id=>prepareDocumentSearch('assessor','parcel',id)),
  ...['0155675','1688587'].map(id=>prepareDocumentSearch('assessor','schedule',id)),
  prepareDocumentSearch('treasurer','schedule','0155675')
 ];
}

// Future approved adapters can use these validators before admitting a
// result to research storage. A lookup candidate is never a legal crosswalk.
export function reviewDocumentResult(plan,result){
 const expected=prepareDocumentSearch(plan?.source,plan?.field,plan?.term);
 if(!result||!['found','missing','restricted','unavailable'].includes(result.outcome))throw Error('Invalid lookup outcome');
 const checkedAt=trimmed(result.checkedAt);
 if(!/^\d{4}-\d{2}-\d{2}T/.test(checkedAt)||!Number.isFinite(Date.parse(checkedAt)))throw Error('Missing observation timestamp');
 const observed=new URL(result.sourceUrl);
 const allowed=new URL(expected.url);
 if(observed.origin!==allowed.origin||observed.username||observed.password||observed.protocol!=='https:'||observed.search||observed.hash){
  throw Error('Unapproved evidence URL');
 }
 if(result.outcome==='found'){
  const found=prepareDocumentSearch(expected.source,expected.field,result.matchedTerm);
  if(found.id!==expected.id)throw Error('Result does not match the approved search');
 }
 return {planId:expected.id,sourceUrl:observed.href,checkedAt,outcome:result.outcome,
  classification:'research_candidate',publicationAllowed:false};
}


// The source adapter supplies only exact index rows. Multiple exact rows
// require review even when some of their public metadata agrees.
export function reviewRecorderReference(plan,result){
 const reviewed=reviewDocumentResult(plan,result);
 if(plan.source!=='recorder'||plan.field!=='reception')throw Error('Expected an exact Recorder reference plan');
 const decision={...reviewed,referenceConfirmed:false,relationshipStatus:'unresolved'};
 if(result.outcome!=='found')return decision;
 if(!Array.isArray(result.rows)||!result.rows.length)throw Error('Missing Recorder index rows');
 if(result.rows.some(row=>trimmed(row?.receptionNumber)!==plan.term))throw Error('Conflicting Recorder references');
 if(result.rows.length!==1)return {...decision,classification:'conflicting_index_evidence'};
 const row=result.rows[0];
 const documentType=trimmed(row.documentType);
 const recordingDate=trimmed(row.recordingDate);
 const date=new Date(recordingDate);
 if(!documentType||documentType.length>100||!/^\d{4}-\d{2}-\d{2}$/.test(recordingDate)||
    !Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==recordingDate){
  return {...decision,classification:'incomplete_index_evidence'};
 }
 return {...decision,classification:'official_index_entry',referenceConfirmed:true,
  receptionNumber:plan.term,documentType,recordingDate,legalDescription:trimmed(row.legalDescription).slice(0,2000)};
}
