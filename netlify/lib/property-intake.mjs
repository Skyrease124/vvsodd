// Property intake and approval. Every new property fact enters here first; nothing is public until the
// owner approves it. Lifecycle:
//   awaiting_verification -> awaiting_approval -> released -> withdrawn
//   any open state -> rejected
// A release is written to the research release index that the public feed serves, so the Pro-first
// (48 hours) and critical-release rules apply unchanged. Release ids derive from the intake id, so a
// retry after a partial write cannot publish the same item twice.
import crypto from 'node:crypto';
import {makeRelease, STATES, audienceFor} from './research-releases.mjs';
import {updateJson} from './brain-approvals.mjs';
import {RELEASE_MODES} from './update-release.mjs';

export const INTAKE = 'property-intake-v1';
export const RELEASE_INDEX = 'approved-research-releases-v1';
export const MAX_BATCH = 50;
export const MAX_ITEMS = 2000;
export const ORIGINS = Object.freeze(['owner-manual', 'county-dataset', 'gis-import', 'nvidia-discovery', 'photon-candidate', 'geoapify-candidate', 'live-check']);
export const KINDS = Object.freeze({
  new_property: {releaseType: 'property', label: 'New property information'},
  tax_deed: {releaseType: 'tax_deed', label: 'Tax deed update'},
  tax_lien: {releaseType: 'lien', label: 'Tax lien update'},
});
export const STATUS = Object.freeze({
  awaiting_verification: 'awaiting_verification', awaiting_approval: 'awaiting_approval',
  released: 'released', rejected: 'rejected', withdrawn: 'withdrawn',
});
const OPEN = new Set([STATUS.awaiting_verification, STATUS.awaiting_approval]);
const COUNTY = /^[a-zA-Z0-9._ -]{2,80}$/;
const PARCEL = /^[a-zA-Z0-9._ -]{3,100}$/;
const clip = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
export const httpsUrl = v => {
  try {
    const u = new URL(String(v || ''));
    return u.protocol === 'https:' && !u.username && !u.password && !u.port && u.hostname.length > 3 && u.href.length <= 1000 ? u.href : null;
  } catch { return null; }
};
const iso = now => new Date(now).toISOString();

// Validates one submitted item. Public visitors cannot submit; the owner route is the only caller.
export function validateSubmission(raw) {
  if (!raw || typeof raw !== 'object') return {ok: false, error: 'Each item must be an object'};
  if (!KINDS[raw.kind]) return {ok: false, error: 'Unknown kind of property information'};
  if (!ORIGINS.includes(raw.origin)) return {ok: false, error: 'Unknown origin'};
  const state = clip(raw.state, 2).toUpperCase();
  if (!STATES.has(state)) return {ok: false, error: 'Unsupported state'};
  const county = clip(raw.county, 80);
  if (!COUNTY.test(county)) return {ok: false, error: 'Invalid county'};
  const parcelId = clip(raw.parcelId, 100);
  if (!PARCEL.test(parcelId)) return {ok: false, error: 'Invalid parcel'};
  const title = clip(raw.title, 140);
  if (title.length < 6) return {ok: false, error: 'A title of at least 6 characters is required'};
  const description = clip(raw.description, 1400);
  if (description.length < 20) return {ok: false, error: 'Describe the update in at least 20 characters'};
  const certificateNumber = clip(raw.certificateNumber, 80) || null;
  if (raw.kind === 'tax_lien' && !certificateNumber) return {ok: false, error: 'A tax lien update needs its certificate number'};
  let sourceUrl = null;
  if (raw.sourceUrl) { sourceUrl = httpsUrl(raw.sourceUrl); if (!sourceUrl) return {ok: false, error: 'The source must be an HTTPS link'}; }
  return {ok: true, item: {kind: raw.kind, origin: raw.origin, state, county, parcelId, title, description, certificateNumber, taxYear: clip(raw.taxYear, 8) || null, sourceUrl}};
}

// A batch is accepted whole or not at all, so a partial import never reaches storage.
export function validateBatch(list) {
  if (!Array.isArray(list) || list.length === 0) return {ok: false, error: 'Send one or more items'};
  if (list.length > MAX_BATCH) return {ok: false, error: 'Send at most ' + MAX_BATCH + ' items per request'};
  const items = [], errors = [];
  list.forEach((raw, i) => { const v = validateSubmission(raw); if (v.ok) items.push(v.item); else errors.push('Item ' + (i + 1) + ': ' + v.error); });
  if (errors.length) return {ok: false, error: errors.slice(0, 5).join('; ')};
  return {ok: true, items};
}

const keyOf = o => [o.kind, o.state, o.county.toLowerCase(), o.parcelId.toUpperCase(), o.title.toLowerCase()].join('|');
export const releaseIdFor = itemId => 'rel-' + itemId;

// Duplicate protection: an identical open item, or an identical release that already exists, is refused.
export function findDuplicate(items, releases, candidate) {
  const key = keyOf(candidate);
  const open = items.find(x => OPEN.has(x.status) && keyOf(x) === key);
  if (open) return {id: open.id, why: 'an identical item is already awaiting review'};
  const released = releases.find(r => !r.withdrawn && keyOf({kind: kindOfRelease(r), state: r.state, county: r.county, parcelId: r.parcelId, title: r.title}) === key);
  if (released) return {id: released.id, why: 'an identical update is already released'};
  return null;
}
const kindOfRelease = r => (r.type === 'lien' ? 'tax_lien' : r.type === 'tax_deed' ? 'tax_deed' : 'new_property');

export function newItem(v, {now, actor}) {
  const at = iso(now);
  return {id: crypto.randomUUID(), ...v, status: STATUS.awaiting_verification, createdAt: at, createdBy: actor,
    verification: null, approval: null, releaseId: null, audit: [{at, action: 'submitted', by: actor}]};
}

// Step 2: an official source and identity check, recorded before any owner approval.
export function verifyItem(item, {evidenceUrl, notes, checklist, now, actor}) {
  if (item.status !== STATUS.awaiting_verification) return {error: 409, message: 'Only items awaiting verification can be verified'};
  const url = httpsUrl(evidenceUrl);
  if (!url) return {error: 400, message: 'The evidence must be an HTTPS official source'};
  if (checklist?.officialSource !== true || checklist?.identityMatched !== true)
    return {error: 400, message: 'Confirm the official source was checked and that the parcel identity matches'};
  const text = clip(notes, 1000);
  if (text.length < 15) return {error: 400, message: 'Write at least 15 characters of verification notes'};
  const at = iso(now);
  return {item: {...item, status: STATUS.awaiting_approval,
    verification: {evidenceUrl: url, notes: text, checklist: {officialSource: true, identityMatched: true}, verifiedAt: at, by: actor},
    audit: [...item.audit, {at, action: 'verified', by: actor, note: text.slice(0, 200)}]}};
}

// Step 3: the owner approves. Builds the release through makeRelease, which enforces the release rules.
export function approveItem(item, {releaseMode = 'pro_first_48h', criticalReason, criticalConfirmed, now, actor}) {
  if (item.status !== STATUS.awaiting_approval) return {error: 409, message: 'Only verified items can be approved'};
  if (!RELEASE_MODES.includes(releaseMode)) return {error: 400, message: 'Unknown release mode'};
  const reason = clip(criticalReason, 500);
  if (releaseMode === 'immediate_critical' && (criticalConfirmed !== true || reason.length < 40))
    return {error: 400, message: 'An immediate critical release needs confirmation and a reason of at least 40 characters'};
  const at = iso(now);
  let release;
  try {
    release = makeRelease({
      id: releaseIdFor(item.id), type: KINDS[item.kind].releaseType, state: item.state, county: item.county,
      parcelId: item.parcelId, certificateNumber: item.certificateNumber || undefined, title: item.title,
      description: item.description, evidenceUrl: item.verification.evidenceUrl, approvedForResearch: true,
      releaseMode, criticalConfirmed, criticalReason: reason || undefined,
    }, new Date(now), actor);
  } catch (error) { return {error: 400, message: String(error.message).slice(0, 160)}; }
  return {release, item: {...item, status: STATUS.released, releaseId: release.id,
    approval: {decision: 'approved', at, releaseMode, criticalReason: releaseMode === 'immediate_critical' ? reason : null, by: actor},
    audit: [...item.audit, {at, action: 'approved', by: actor, note: releaseMode}]}};
}

export function rejectItem(item, {notes, now, actor}) {
  if (!OPEN.has(item.status)) return {error: 409, message: 'Only open items can be rejected'};
  const text = clip(notes, 1000);
  if (text.length < 15) return {error: 400, message: 'Write at least 15 characters explaining the rejection'};
  const at = iso(now);
  return {item: {...item, status: STATUS.rejected, approval: {decision: 'rejected', at, by: actor, notes: text},
    audit: [...item.audit, {at, action: 'rejected', by: actor, note: text.slice(0, 200)}]}};
}

// Withdrawal removes a released item for every viewer. The reason, timestamp and actor are kept.
export function withdrawReleaseInList(list, releaseId, {reason, now, actor}) {
  const text = clip(reason, 300);
  if (text.length < 15) return {error: 400, message: 'Write at least 15 characters explaining the withdrawal'};
  const index = list.findIndex(r => r.id === releaseId);
  if (index < 0) return {error: 404, message: 'Release not found'};
  const at = iso(now);
  const current = list[index];
  if (current.withdrawn === true) return {error: 409, message: 'This release is already withdrawn'};
  const audit = [...(current.audit || []), {at, action: 'withdrawn', by: actor, note: text.slice(0, 200)}].slice(-20);
  const next = list.map((r, i) => i === index ? {...r, withdrawn: true, withdrawnAt: at, withdrawal: {reason: text, at, by: actor}, audit} : r);
  return {list: next, release: next[index]};
}

export const cleanReleases = value => (value && Array.isArray(value.list) ? value.list.filter(x => x && typeof x === 'object').slice(0, 2000) : []);

export async function readIntake(auth) { return (await auth.kvGet(INTAKE)) || {schemaVersion: 1, items: []}; }

// Atomic read-modify-write of the intake store. mutate returns undefined for "no change".
export function mutateIntake(auth, mutate) {
  return updateJson(auth, INTAKE, current => {
    const base = current && Array.isArray(current.items) ? current : {schemaVersion: 1, items: []};
    const next = mutate(base);
    return next === undefined ? undefined : {...next, schemaVersion: 1, items: next.items.slice(-MAX_ITEMS)};
  });
}

export function mutateReleases(auth, mutate) {
  return updateJson(auth, RELEASE_INDEX, current => {
    const list = cleanReleases(current);
    const next = mutate(list);
    return next === undefined ? undefined : {schemaVersion: 1, list: next.slice(0, 2000)};
  });
}

// Joins an intake item with its current release state, for the owner view.
export function describeStatus(item, releases) {
  const release = item.releaseId ? releases.find(r => r.id === item.releaseId) : null;
  if (release?.withdrawn) return 'withdrawn';
  return item.status;
}

// Visibility of a release for a viewer at a moment in time (research feed rules).
export const visibilityNow = (release, user, now) => audienceFor(release, user, now);
