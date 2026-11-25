// Approval ledger rules shared by every route that can change a public parcel correction.
// A validator may only create a PENDING owner decision. Only a decision a human owner made
// (reviewedBy === 'owner') can publish. Owner decisions are final.
import crypto from 'node:crypto';
export const LEDGER = 'owner-brain-approvals-v1';
export const OVERLAY = 'brain-map-county-v1-MI-wayne';
export const DECISION = Object.freeze({pending: 'pending_owner_review', approved: 'approved_for_staging', rejected: 'rejected'});
export const caseKeyFor = (dataset, recordId) =>
  crypto.createHash('sha256').update(dataset + '\n' + recordId).digest('hex').slice(0, 28);
// Automatic approval: a validator match that passed the exact identity, address and polygon checks.
// It publishes without an owner click (the owner reviews afterwards and can withdraw it). Owner decisions
// stay final and are never replaced by automatic ones.
export const AUTO_VALIDATOR = 'auto-validator';
export const AUTO_METHOD = 'exact_identity_address_polygon';
export const ownerDecided = entry => entry?.reviewedBy === 'owner';
export const autoApproved = entry => entry?.reviewedBy === AUTO_VALIDATOR && entry?.decision === DECISION.approved && entry?.reviewMethod === AUTO_METHOD && entry?.autoPublish === true;
export const publishable = entry => entry?.decision === DECISION.approved && (entry.reviewedBy === 'owner' || autoApproved(entry));

// Adds a validator decision only when the case has no decision yet. Never overwrites.
export function addPendingIfAbsent(entries, entry) {
  if (entries.some(x => x.caseKey === entry.caseKey)) return null;
  return [...entries, entry].slice(-250);
}

// Read-modify-write with the same seed-aware fallback used by the publisher.
// A mutate result of undefined means "no change".
export async function updateJson(auth, key, mutate) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const snapshot = await auth.kvGetVersioned(key);
    const current = snapshot ? snapshot.data : await auth.kvGet(key);
    const next = mutate(current ?? null);
    if (next === undefined) return {changed: false, value: current ?? null};
    if (await auth.kvPutVersioned(key, next, snapshot ? snapshot.etag : null)) return {changed: true, value: next};
  }
  throw Error('Storage busy: ' + key);
}
