// Owner review: the only route that moves a parcel correction from pending to approved.
// Owner decisions are final. A validator decision may be approved or rejected once by the owner.
// Approval releases the correction on the Pro-first schedule (or immediately, if the owner
// chooses a critical release). Public maps change only through the guarded publisher.
import crypto from 'node:crypto';
import * as auth from '../lib/brain-auth.mjs';
import publish from './brain-map-publish-auto.mjs';
import {LEDGER, OVERLAY, DECISION, caseKeyFor, ownerDecided, publishable, updateJson} from '../lib/brain-approvals.mjs';
import {RELEASE_MODES} from '../lib/update-release.mjs';
const QUEUE='owner-brain-scanner-v1';
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Cookie','X-Robots-Tag':'noindex, nofollow'}});
const trim=(s,n=500)=>String(s??'').trim().slice(0,n);
const norm=(s)=>trim(s,120).toUpperCase().replace(/[^A-Z0-9]/g,'');
const idFor=(d,r)=>crypto.createHash('sha256').update(d+'\n'+r).digest('hex').slice(0,28);
const safeUrl=v=>{try{const u=new URL(v);return u.protocol==='https:'&&u.username===''&&u.password===''&&u.hostname.length>3&&u.href.length<=1000?u.href:null;}catch{return null}};
const summary=r=>({dataset:r.dataset,recordId:r.recordId,state:r.state,county:r.county,parcelId:r.parcelId});

// Runs the guarded publisher for one owner-approved correction (or all waiting ones when recordId is null).
// Each publication dispatch is charged to the shared Wayne GIS budget. If the budget is exhausted the
// approval stays in place and publication waits for the next allowed run.
async function publishApproved(req, recordId) {
  let rejection = null;
  await publish(req, {
    waynePublisherInternal: true,
    wayneCurrentRecord: recordId,
    wayneCurrentOnly: !!recordId,
    wayneHeldRecords: new Set(),
    wayneRecordRejected: (id, reason) => { if (id === recordId) rejection = reason; },
    chargeWayneGisRequest: async () => { await auth.reserveWayneGisRequest(); },
  });
  const overlay = (await auth.kvGet(OVERLAY)) || {records: {}};
  const record = recordId ? overlay.records?.[recordId] : null;
  return {record, rejection};
}

async function reviewWayne(req, b, me) {
  if (typeof b.recordId !== 'string' || !['approve', 'reject'].includes(b.action)) return json(400, {ok: false, error: 'Invalid review request'});
  const notes = trim(b.notes, 1000);
  if (notes.length < 15) return json(400, {ok: false, error: 'Provide at least 15 characters explaining the review decision'});
  const key = caseKeyFor('MI-wayne', b.recordId);
  const stamp = new Date().toISOString();
  let releaseMode = null, criticalReason = null;
  if (b.action === 'approve') {
    if (b.officialSourceConfirmed !== true) return json(400, {ok: false, error: 'Confirm you personally checked the official county source'});
    releaseMode = b.releaseMode || 'pro_first_48h';
    if (!RELEASE_MODES.includes(releaseMode)) return json(400, {ok: false, error: 'Unknown release mode'});
    if (releaseMode === 'immediate_critical') {
      criticalReason = trim(b.criticalReason, 500);
      if (b.criticalConfirmed !== true || criticalReason.length < 40)
        return json(400, {ok: false, error: 'An immediate critical release needs confirmation and a reason of at least 40 characters'});
    }
  }
  let failure = null, wasPublished = false, previous = null;
  const write = await updateJson(auth, LEDGER, ledger => {
    const entries = ledger?.entries || [];
    const index = entries.findIndex(e => e.caseKey === key);
    if (index < 0) { failure = [404, 'No validator-verified correction is waiting for this parcel']; return undefined; }
    const entry = entries[index];
    if (entry.dataset !== 'MI-wayne' || entry.recordId !== b.recordId) { failure = [409, 'Ledger entry does not match this parcel']; return undefined; }
    if (ownerDecided(entry)) { failure = [409, 'This case already has a final owner decision. Reviews are immutable.']; return undefined; }
    previous = entry;
    wasPublished = entry.publishStatus === 'published';
    if (b.action === 'reject') {
      const next = {...entry, decision: DECISION.rejected, reviewedBy: 'owner', reviewedAt: stamp, notes,
        validatorDecision: {decision: entry.decision, reviewedBy: entry.reviewedBy, reviewedAt: entry.reviewedAt},
        publishStatus: wasPublished ? 'withdrawn' : 'not_published'};
      return {...ledger, entries: entries.map((e, i) => i === index ? next : e)};
    }
    // approve
    // Open validator decisions: pending ones, and older validator approvals that were never published.
    const pending = entry.decision === DECISION.pending || (entry.decision === DECISION.approved && !wasPublished);
    const alreadyPublished = entry.decision === DECISION.approved && wasPublished; // validator-created, already public
    if (!pending && !alreadyPublished) { failure = [409, 'Only an open or already-published validator decision can be approved']; return undefined; }
    if (b.evidenceUrl !== entry.evidenceUrl) { failure = [400, 'Approval must cite the exact official evidence URL recorded by the validator']; return undefined; }
    if (entry.independentlyChecked !== true || !Number.isSafeInteger(entry.officialObjectId) || !Number.isFinite(entry.proposedPosition?.lat)) {
      failure = [409, 'The validator evidence is incomplete; this correction cannot be approved']; return undefined;
    }
    const next = {...entry, decision: DECISION.approved, reviewedBy: 'owner', reviewedAt: stamp, notes,
      validatorDecision: {decision: entry.decision, reviewedBy: entry.reviewedBy, reviewedAt: entry.reviewedAt},
      ...(pending ? {releaseMode, ...(criticalReason ? {criticalReason} : {})} : {legacyPublished: true})};
    return {...ledger, entries: entries.map((e, i) => i === index ? next : e)};
  });
  if (failure) return json(failure[0], {ok: false, error: failure[1]});
  if (!write.changed) return json(409, {ok: false, error: 'Review could not be stored; refresh and try again'});
  if (b.action === 'reject') {
    if (wasPublished) {
      // Withdraw an already-public correction: it leaves the public feed for every viewer.
      await updateJson(auth, OVERLAY, overlay => {
        const record = overlay?.records?.[b.recordId];
        if (!record || record.withdrawn === true) return undefined;
        return {...overlay, version: (overlay.version || 0) + 1, updatedAt: stamp,
          records: {...overlay.records, [b.recordId]: {...record, withdrawn: true, withdrawnAt: stamp}}};
      });
      return json(200, {ok: true, decision: 'rejected', publication: 'withdrawn', notice: 'Rejected. The correction was removed from the public map.'});
    }
    return json(200, {ok: true, decision: 'rejected', publication: 'not_published', notice: 'Rejected. Nothing was published.'});
  }
  if (!pending_release_applies(previous)) {
    return json(200, {ok: true, decision: 'approved', publication: 'already_published', notice: 'Owner confirmed a correction that was already public. Its visibility is unchanged.'});
  }
  const {record, rejection} = await publishApproved(req, b.recordId);
  if (record?.verifiedGeometry === true && !record.publicationPending && record.releaseMode) {
    const freeNote = record.releaseMode === 'immediate_critical' ? 'released to everyone now' : 'Pro now; Free after 48 hours';
    return json(200, {ok: true, decision: 'approved', publication: 'published', releaseMode: record.releaseMode,
      proReleaseAt: record.proReleaseAt, freeReleaseAt: record.freeReleaseAt, notice: 'Published: ' + freeNote + '.'});
  }
  if (rejection) return json(200, {ok: true, decision: 'approved', publication: 'publisher_rejected', reason: String(rejection).slice(0, 160),
    notice: 'Approved, but the publisher refused it: ' + String(rejection).slice(0, 160)});
  return json(200, {ok: true, decision: 'approved', publication: 'approved_awaiting_publication',
    notice: 'Approved. Publication waits for the shared official GIS budget; use Publish approved corrections to retry.'});
}
// Publication follows an owner approval of an open validator decision (pending, or approved but never published).
function pending_release_applies(entry) { return entry?.decision === DECISION.pending || (entry?.decision === DECISION.approved && entry?.publishStatus !== 'published'); }

// Scanner-queue candidates (Florida and Detroit cross-check). Same rules as before, except that a
// validator decision no longer blocks an owner. Owner decisions remain final.
async function reviewQueued(b, me) {
  if (!['approve', 'reject'].includes(b.action)) return json(400, {ok: false, error: 'Invalid review request'});
  const q = await auth.kvGet(QUEUE);
  if (!q?.queue || q.status === 'paused') return json(409, {ok: false, error: 'Queue empty or paused'});
  const r = q.queue.find(x => x.dataset === b.dataset && x.recordId === b.recordId);
  if (!r) return json(404, {ok: false, error: 'Parcel is not in queue'});
  const candidate = r.state === 'FL' ? r.florida : (r.state === 'MI' ? (r.crosscheck?.status === 'candidate_found' ? r.crosscheck : (r.detroit?.status === 'candidate_found' ? r.detroit : r.gis)) : null);
  if (!candidate || candidate.status !== 'candidate_found') return json(409, {ok: false, error: 'A matching GIS/API candidate is required before review'});
  if (norm(candidate.matchedId) !== norm(r.parcelId)) return json(409, {ok: false, error: 'Candidate ID does not match queued parcel'});
  const notes = trim(b.notes, 1000);
  if (notes.length < 15) return json(400, {ok: false, error: 'Provide at least 15 characters explaining the review decision'});
  const evidenceUrl = b.action === 'approve' ? safeUrl(b.evidenceUrl) : safeUrl(b.evidenceUrl) || null;
  if (b.action === 'approve' && !evidenceUrl) return json(400, {ok: false, error: 'Approval requires an HTTPS official county source URL'});
  if (b.action === 'approve' && b.officialSourceConfirmed !== true) return json(400, {ok: false, error: 'Confirm you personally checked the official county source'});
  const candidateLocation = r.state === 'FL' ? candidate.centroid : candidate.centroidApprox;
  if (b.action === 'approve' && (!candidateLocation || !Number.isFinite(Number(candidateLocation.lat)) || !Number.isFinite(Number(candidateLocation.lng ?? candidateLocation.lon))))
    return json(409, {ok: false, error: 'Candidate has no valid location. Cannot approve a location correction'});
  const key = idFor(r.dataset, r.recordId);
  const stamp = new Date().toISOString();
  let failure = null;
  const write = await updateJson(auth, LEDGER, ledger => {
    const entries = ledger?.entries || [];
    const prior = entries.find(e => e.caseKey === key);
    if (prior && ownerDecided(prior)) { failure = [409, 'This case already has a final owner decision. Reviews are immutable.']; return undefined; }
    const entry = {caseKey: key, decision: b.action === 'approve' ? DECISION.approved : DECISION.rejected, ...summary(r), reviewedAt: stamp, reviewedBy: 'owner', notes, evidenceUrl,
      independentlyChecked: b.action === 'approve',
      sourceProvider: r.state === 'FL' ? 'Florida Property API' : (candidate === r.crosscheck ? 'Detroit Assessor GIS + address cross-check' : (candidate === r.detroit ? 'City of Detroit Assessor' : 'Wayne County GIS')),
      sourceMatchId: trim(candidate.matchedId, 100),
      proposedPosition: candidateLocation ? {lat: Number(candidateLocation.lat), lon: Number(candidateLocation.lng ?? candidateLocation.lon)} : null,
      sourceAcreage: r.state === 'MI' && Number.isFinite(candidate.acreage) ? candidate.acreage : null,
      publishStatus: 'not_published', sourceSnapshotAt: candidate.foundAt || null,
      ...(prior ? {validatorDecision: {decision: prior.decision, reviewedBy: prior.reviewedBy, reviewedAt: prior.reviewedAt}} : {})};
    const kept = prior ? entries.map(e => e.caseKey === key ? entry : e) : [...entries, entry].slice(-250);
    return {...ledger, entries: kept};
  });
  if (failure) return json(failure[0], {ok: false, error: failure[1]});
  if (!write.changed) return json(409, {ok: false, error: 'Review could not be stored; refresh and try again'});
  const current = await auth.kvGet(QUEUE);
  const target = current?.queue?.find(x => x.dataset === r.dataset && x.recordId === r.recordId);
  if (target) { target.review = {decision: b.action === 'approve' ? DECISION.approved : DECISION.rejected, reviewedAt: stamp, caseKey: key}; current.updatedAt = stamp; await auth.kvPut(QUEUE, current); }
  return json(200, {ok: true, notice: 'Stored privately; public parcel maps are unchanged.'});
}

async function handler(req) {
  if (req.method !== 'GET' && req.method !== 'POST') return json(405, {ok: false, error: 'GET or POST only'});
  const me = await auth.userFromCookie(req.headers.get('cookie') || '');
  if (!me?.owner) return json(me ? 403 : 401, {ok: false, error: 'Owner access required'});
  if (req.method === 'GET') {
    const ledger = (await auth.kvGet(LEDGER)) || {entries: []};
    return json(200, {ok: true, entries: (ledger.entries || []).slice(-100).reverse()});
  }
  if (req.headers.get('origin') !== new URL(req.url).origin) return json(403, {ok: false, error: 'Invalid origin'});
  let b; try { const raw = await req.text(); if (raw.length > 4000) throw Error(); b = JSON.parse(raw); } catch { return json(400, {ok: false, error: 'Invalid request'}); }
  if (b?.confirmed !== true) return json(400, {ok: false, error: 'Explicit confirmation required'});
  if (b.action === 'publish-approved') {
    const ledger = (await auth.kvGet(LEDGER)) || {entries: []};
    const waiting = (ledger.entries || []).filter(publishable).filter(e => e.dataset === 'MI-wayne' && e.publishStatus !== 'published');
    if (!waiting.length) return json(200, {ok: true, publication: 'none_waiting', notice: 'No owner-approved corrections are waiting to publish.'});
    await publishApproved(req, null);
    const overlay = (await auth.kvGet(OVERLAY)) || {records: {}};
    const done = waiting.filter(e => overlay.records?.[e.recordId]?.verifiedGeometry === true && !overlay.records[e.recordId].publicationPending).length;
    return json(200, {ok: true, publication: 'attempted', waiting: waiting.length, publishedNow: done,
      notice: done === waiting.length ? 'All waiting corrections are published.' : 'Some corrections still wait for the shared GIS budget or a publisher check.'});
  }
  if (!['approve', 'reject'].includes(b.action) || typeof b.dataset !== 'string' || typeof b.recordId !== 'string')
    return json(400, {ok: false, error: 'Invalid review request'});
  if (b.dataset === 'MI-wayne') return reviewWayne(req, b, me);
  return reviewQueued(b, me);
}

export default auth.withBrainStore(handler);
