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
 return [
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
