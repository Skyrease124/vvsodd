// Show document-level holding evidence only for the specific official Palm Beach
// county-held spreadsheet; never infer redemption or purchase availability.
const PB_HOST='www.pbctax.gov';
const EXPECTED_CLASSIFICATION='official county-held certificate file; verify availability with Tax Collector';
export function reviewHoldingType(record,report){
  if(record?.holdingType && record.holdingType!=='unknown')return record.holdingType;
  if(record?.county!=='Palm Beach'||report?.classification!==EXPECTED_CLASSIFICATION)return 'unknown';
  try{
    const source=new URL(record.sourceUrl), reportSource=new URL(report.source);
    if(source.protocol!=='https:'||reportSource.protocol!=='https:'||
       source.hostname!==PB_HOST||reportSource.hostname!==PB_HOST||
       source.href!==reportSource.href||!source.pathname.endsWith('.xlsx'))return 'unknown';
  }catch{return 'unknown';}
  return 'county-held';
}
export function reviewHoldingEvidence(record,report){
  return reviewHoldingType(record,report)==='county-held' &&
    record?.holdingType!=='county-held' ? 'official-county-held-list' :
    (record?.holderEvidenceSource||null);
}
export function matchReviewFilters(record,report,{q='',holding='',redemption=''}={}){
  return (!q || [record.parcelId,record.certificateNumber].some(v=>String(v||'').toLowerCase().includes(q.toLowerCase()))) &&
    (!holding || reviewHoldingType(record,report)===holding) &&
    (!redemption || record.redemptionStatus===redemption);
}
