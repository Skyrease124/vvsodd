// Automatically synchronize explicitly owner-approved, current certificate research with the
// private server-gated Pro/Free release feed. Never publishes unreviewed source rows.
import crypto from 'node:crypto';
import { makeRelease, PRO_EARLY_ACCESS_MS } from './research-releases.mjs';

const INDEX='approved-research-releases-v1';
const readIndex=v=>Array.isArray(v?.list)?v.list.filter(x=>x&&typeof x==='object').slice(0,2000):[];
const stableId=key=>crypto.createHash('sha256').update('certificate-research-v1|'+key).digest('hex').slice(0,40);

export async function syncReviewedCertificate({record,review,snapshot,reviewer,kvGet,kvPut,now=new Date()}) {
  if (!record || !review || !snapshot || typeof kvGet!=='function' || typeof kvPut!=='function')
    throw Error('Missing verified research review context.');
  if (!review.certificateKey || !review.snapshotSha256 || review.snapshotSha256!==snapshot.hash)
    throw Error('Research review must match the current county snapshot.');
  if (record.state!=='FL' || record.status!=='unverified' || record.availableForPurchase!==false)
    throw Error('Unsafe certificate source record.');
  const key=review.certificateKey;
  const current=readIndex(await kvGet(INDEX));
  // A later follow-up or rejection also withdraws any previously published research.
  const retained=current.filter(r=>!(r.researchSource==='certificate-review'&&r.reviewCertificateKey===key));
  if (review.decision!=='approved-for-research') {
    const removed=current.length-retained.length;
    if(removed) {
      await kvPut('research-release-audit-'+crypto.randomUUID(),{
        action:'withdraw-certificate-research',certificateKey:key,at:now.toISOString(),reviewer,
        reason:'Review changed to '+review.decision,availableForPurchase:false
      });
      await kvPut(INDEX,{schemaVersion:1,list:retained});
    }
    return {action:removed?'withdrawn':'not-published',removed};
  }
  if(review.publishApprovedResearch!==true || review.publicationAuthorized!==true)
    throw Error('Explicit owner authorization required to publish approved research.');
  if(!review.evidenceUrl || !review.evidenceUrl.startsWith('https://'))
    throw Error('Current approved official source evidence is required.');
  if(!record.parcelId || !record.certificateNumber || !record.county || !record.taxYear)
    throw Error('Incomplete certificate source record.');
  const id=stableId(key);
  const existing=retained.length!==current.length;
  // Repeated approval of the same source certificate does not restart the 48-hour window.
  const prior=current.find(r=>r.researchSource==='certificate-review'&&r.reviewCertificateKey===key);
  if(prior && prior.reviewSnapshotSha256===snapshot.hash && prior.evidenceUrl===review.evidenceUrl)
    return {action:'already-published',id:prior.id,proReleaseAt:prior.proReleaseAt,
      freeReleaseAt:new Date(Date.parse(prior.proReleaseAt)+PRO_EARLY_ACCESS_MS).toISOString()};
  const yr=String(record.taxYear);
  const item=makeRelease({
    id,type:'lien',state:'FL',county:record.county,parcelId:record.parcelId,
    certificateNumber:record.certificateNumber,
    title:record.county+' County certificate '+record.certificateNumber+' research',
    description:'Owner-approved research update for '+record.county+
      ' County tax certificate '+record.certificateNumber+', tax year '+yr+
      '. Review the linked official county source and verify current status before taking action.',
    evidenceUrl:review.evidenceUrl,approvedForResearch:true
  },now,reviewer);
  item.researchSource='certificate-review';
  item.reviewCertificateKey=key;
  item.reviewSnapshotSha256=snapshot.hash;
  const checked=Date.parse(snapshot.data?.checkedAt);
  if(Number.isFinite(checked) && checked<=now.getTime())
    item.sourceCheckedAt=new Date(checked).toISOString();
  const next={schemaVersion:1,list:[item,...retained].slice(0,2000)};
  await kvPut('research-release-audit-'+crypto.randomUUID(),{
    action:existing?'replace-approved-certificate-research':'publish-approved-certificate-research',
    certificateKey:key,sourceSnapshotSha256:snapshot.hash,at:now.toISOString(),
    reviewer,releaseId:id,proReleaseAt:item.proReleaseAt,availableForPurchase:false
  });
  await kvPut(INDEX,next);
  return {action:'published',id,proReleaseAt:item.proReleaseAt,
    freeReleaseAt:new Date(now.getTime()+PRO_EARLY_ACCESS_MS).toISOString()};
}
