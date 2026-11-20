// Approved lien and parcel-land research release policy. Private server-side data only.
export const PRO_EARLY_ACCESS_MS = 48 * 60 * 60 * 1000;
export const RELEASE_TYPES = new Set(['lien', 'land']);

export function isProAccount(user, now = new Date()) {
  if (!user) return false;
  if (user.owner) return true;
  if (user.disputeHold) return false;
  // Free family/invitation access is not a Pro subscription.
  return typeof user.paidThrough === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(user.paidThrough)
    && user.paidThrough >= now.toISOString().slice(0, 10);
}

export function releaseAtDate(item) {
  if (!item || !RELEASE_TYPES.has(item.type) || item.researchOnly !== true
      || item.availableForPurchase !== false || item.reviewApproved !== true
      || item.publicationApproved !== true) return null;
  const ms = Date.parse(item.proReleaseAt);
  if (!Number.isFinite(ms) || typeof item.proReleaseAt !== 'string'
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(item.proReleaseAt)) return null;
  return ms;
}

export function audienceFor(item, user, now = Date.now()) {
  const start = releaseAtDate(item);
  if (start === null) return 'none';
  const point = now instanceof Date ? now.getTime() : now;
  if (!Number.isFinite(point) || point < start) return 'none';
  if (isProAccount(user, new Date(point))) return 'pro';
  return point >= start + PRO_EARLY_ACCESS_MS ? 'free' : 'none';
}

export function safeResearchRecord(item) {
  // Strict allowlist keeps private reviewer and owner data out of response.
  const keys = ['id','type','state','county','parcelId','certificateNumber','taxYear',
    'certificateYear','holdingType','redemptionStatus','taxDeedStatus',
    'sourceUrl','sourceCheckedAt','evidenceUrl','proReleaseAt','title','description','acreage'];
  const r = Object.fromEntries(keys.filter(k => item[k] !== null && item[k] !== undefined)
    .map(k => [k, item[k]]));
  return {...r,researchOnly:true,availableForPurchase:false,
    disclaimer:'Research only; verify current county status and availability directly with the official source.'};
}

export function makeRelease(data, time, reviewer) {
  if (!data || !RELEASE_TYPES.has(data.type)) throw Error('Unsupported update type.');
  if (!new Set('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WI WV WY'.split(' ')).has(data.state)) throw Error('Unsupported state.');
  if (!/^[a-zA-Z0-9._ -]{2,80}$/.test(String(data.county || ''))) throw Error('Invalid county.');
  if (!/^[a-zA-Z0-9._ -]{3,100}$/.test(String(data.parcelId || ''))) throw Error('Invalid parcel.');
  if (typeof data.title !== 'string' || data.title.trim().length < 6 || data.title.length > 140) throw Error('Title required.');
  if (typeof data.description !== 'string' || data.description.trim().length < 20 || data.description.length > 1400) throw Error('Describe the verified update (20–1400 characters).');
  if (typeof data.evidenceUrl !== 'string' || data.evidenceUrl.length > 2000) throw Error('Official evidence URL required.');
  let u; try { u = new URL(data.evidenceUrl); } catch { throw Error('Invalid official source URL.'); }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) throw Error('Only HTTPS evidence URLs are allowed.');
  if (data.type === 'lien' && (!data.certificateNumber || String(data.certificateNumber).length > 80)) throw Error('Certificate number required.');
  if (!data.approvedForResearch) throw Error('Owner must explicitly approve publication of researched data.');
  if (!reviewer) throw Error('Owner identity required.');
  const date = time instanceof Date ? time : new Date(time);
  if (!Number.isFinite(date.getTime())) throw Error('Invalid release date.');
  return {
    id: data.id,
    type:data.type,state:data.state,county:data.county.trim(),parcelId:data.parcelId.trim(),
    certificateNumber:data.type === 'lien' ? String(data.certificateNumber).trim() : undefined,
    title:data.title.trim(),description:data.description.trim(),
    evidenceUrl:u.href,sourceUrl:u.href,
    sourceCheckedAt:date.toISOString(),
    proReleaseAt:date.toISOString(),
    researchOnly:true,reviewApproved:true,publicationApproved:true,availableForPurchase:false,
    reviewerAudit:reviewer,
    publishedToPublicMaps:false
  };
}
