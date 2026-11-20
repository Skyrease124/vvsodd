// Private certificate review triage. Evidence-based findings, never authorizes publication.
const keyOf=r=>[r.state,r.county,r.parcelId,r.certificateNumber,r.certificateYear||r.taxYear].map(x=>String(x||'').trim().toLowerCase()).join('|');
const normalize=v=>String(v||'').toLowerCase();
export function triageRecord(record, report){
  const findings=[];
  const add=(code,level,detail)=>findings.push({code,level,detail});
  if(record.availableForPurchase!==false||record.status!=='unverified')
    throw Error('Unsafe certificate input');
  const holding=record.holdingType||'unknown',redemption=record.redemptionStatus||'unknown',tda=record.taxDeedStatus||'unknown';
  if(holding==='unknown')add('holding-unknown','review','Holding type not verified from record.');
  if(redemption==='unknown')add('redemption-unknown','review','Redemption status not established by imported file.');
  if(tda==='unknown')add('tax-deed-unknown','review','Tax deed application status not established.');
  if((record.verificationFlags||[]).some(x=>/conflict/.test(x)))add('conflicting-evidence','urgent','Conflicting source status evidence requires manual reconciliation.');
  const years=[record.certificateYear,record.taxYear].filter(Boolean);
  if(years.length===2&&String(years[0])!==String(years[1]))add('year-conflict','urgent','Certificate year and tax year differ; check both before review.');
  const date=Date.parse(report?.checkedAt||'');
  if(!Number.isFinite(date))add('source-date-missing','review','No valid source check timestamp.');
  // A county-held listing is evidence of holding, not an available purchase offer.
  if(holding==='county-held')add('purchase-unconfirmed','info','County-held does not prove OTC sale availability.');
  const priority=findings.some(f=>f.level==='urgent')?'urgent':findings.some(f=>f.level==='review')?'review':'routine';
  return {certificateKey:keyOf(record),parcelId:String(record.parcelId),certificateNumber:String(record.certificateNumber),
    taxYear:String(record.taxYear||''),priority,findings,sourceUrl:record.sourceUrl||report?.source||null,
    suggestedAction:'manual-review',availableForPurchase:false};
}
export function triageSnapshot(snapshot){
  const {data,hash}=snapshot;
  const records=Array.isArray(data?.records)?data.records:[...snapshot.indexed.values()];
  if(!Array.isArray(records)||!records.length)throw Error('Empty certificate source');
  if(records.length>100000)throw Error('Unexpected certificate volume');
  const countBy=new Map(),seen=new Set();
  for(const r of records){
    const k=keyOf(r);if(k.split('|').some(x=>!x)||seen.has(k))throw Error('Duplicate or incomplete certificate key');
    seen.add(k);
    const group=[normalize(r.state),normalize(r.county),normalize(r.parcelId),normalize(r.certificateNumber)].join('|');
    countBy.set(group,(countBy.get(group)||0)+1);
  }
  const all=records.map(r=>{
    const item=triageRecord(r,data);
    const group=[normalize(r.state),normalize(r.county),normalize(r.parcelId),normalize(r.certificateNumber)].join('|');
    if(countBy.get(group)>1)item.findings.push({code:'multiple-tax-years',level:'info',detail:'This parcel and certificate number appears in multiple tax years; review each independently.'});
    return item;
  });
  const counts={urgent:0,review:0,routine:0};
  for(const item of all)counts[item.priority]++;
  return {snapshotSha256:hash,sourceCheckedAt:data.checkedAt||null,total:all.length,counts,
    reviewedBy:'rules-and-source-evidence',publicationAuthorized:false,availableForPurchase:false,
    // Return the full private queue for browsing, but never write or publish it to maps.
    items:all};
}
export function summarizeForAI(result){
  return {total:result.total,counts:result.counts,
    commonFlags:Object.entries(result.items.flatMap(x=>x.findings.map(f=>f.code)).reduce((a,x)=>(a[x]=(a[x]||0)+1,a),{})).sort((a,b)=>b[1]-a[1]).slice(0,8)};
}
