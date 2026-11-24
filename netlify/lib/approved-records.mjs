// Owner-approved property records for Price Pocket Maps, property details, search and downloads.
// Source of truth: the release index (approved-research-releases-v1). A release becomes a property record only
// when it carries a `property` block, which the intake writes at owner approval. One record per
// state + county + parcel: later approvals for the same parcel are corrections of the same record, never a
// second property. Visibility uses the same rule as the research feed (Pro first, Free after 48 hours,
// withdrawn never), evaluated per viewer on the server.
import {audienceFor} from './research-releases.mjs';

export const CATEGORIES = Object.freeze(['tax_deed', 'tax_lien', 'land_bank']);
const KIND_CATEGORY = {tax_deed: 'tax_deed', tax_lien: 'tax_lien'};
export const normCounty = c => String(c ?? '').toLowerCase().replace(/\bcounty\b/g, '').replace(/[^a-z0-9]/g, '');
export const normParcel = p => String(p ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const recordKey = (state, county, parcel) => String(state || '').toUpperCase() + '|' + normCounty(county) + '|' + normParcel(parcel);

const finite = (v, min, max) => { const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v; return Number.isFinite(n) && n >= min && n <= max ? n : null; };
const clip = (v, n) => { const s = String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n); return s || null; };
// Continental US, Alaska and Hawaii bounds, the same box the map accepts.
export const validPoint = c => Array.isArray(c) && c.length === 2 && c.every(Number.isFinite) && c[0] >= -180 && c[0] <= -60 && c[1] >= 18 && c[1] <= 72;

// Validates an optional boundary ring: closed, 4 to 2000 points, every point valid. Returns the ring or null.
export function cleanRing(ring) {
  if (!Array.isArray(ring) || ring.length < 4 || ring.length > 2000) return null;
  const pts = ring.map(q => (Array.isArray(q) ? [Number(q[0]), Number(q[1])] : null));
  if (!pts.every(validPoint)) return null;
  const [a, z] = [pts[0], pts[pts.length - 1]];
  if (a[0] !== z[0] || a[1] !== z[1]) return null;
  return pts;
}

// Optional property fields accepted at submission. Location is kept only as a candidate here.
export function cleanPropertyFields(raw, kind) {
  const category = KIND_CATEGORY[kind] || (CATEGORIES.includes(raw.category) ? raw.category : null);
  if (kind === 'new_property' && !category) return {error: 'A new property needs its category: tax_deed, tax_lien or land_bank'};
  let point = null, ring = null;
  if (raw.longitude != null || raw.latitude != null) {
    point = [finite(raw.longitude, -180, 180), finite(raw.latitude, -90, 90)];
    if (!validPoint(point)) return {error: 'Coordinates must be a longitude and latitude inside the United States'};
  }
  if (raw.boundary != null) {
    ring = cleanRing(raw.boundary);
    if (!ring) return {error: 'A boundary must be a closed ring of 4 to 2000 longitude and latitude points'};
    if (!point) return {error: 'A boundary needs the parcel centre coordinates too'};
  }
  return {fields: {
    category, address: clip(raw.address, 200), ownerName: clip(raw.ownerName, 120),
    amount: finite(raw.amount, 0, 1e9), acreage: finite(raw.acreage, 0, 1e6), candidatePoint: point, candidateRing: ring,
  }};
}

// Built at owner approval. A location is published only when the verifier confirmed it against the official GIS.
export function propertyBlock(item) {
  const f = item.property || {};
  const located = item.verification?.checklist?.locationVerified === true && validPoint(f.candidatePoint);
  const ring = located && f.candidateRing ? f.candidateRing : null;
  const bb = ring ? [Math.min(...ring.map(q => q[0])), Math.min(...ring.map(q => q[1])), Math.max(...ring.map(q => q[0])), Math.max(...ring.map(q => q[1]))] : null;
  const inside = bb && f.candidatePoint[0] >= bb[0] && f.candidatePoint[0] <= bb[2] && f.candidatePoint[1] >= bb[1] && f.candidatePoint[1] <= bb[3];
  return {
    category: f.category || KIND_CATEGORY[item.kind] || null, address: f.address || null, ownerName: f.ownerName || null,
    amount: f.amount ?? null, acreage: f.acreage ?? null,
    point: located ? f.candidatePoint : null, ring: inside ? ring : null, bb: inside ? bb : null,
  };
}

// Picks, for each parcel, the newest approval this viewer may see. Withdrawn and not-yet-free approvals are
// skipped, so an earlier approved version stays visible while a correction waits or after it is withdrawn.
export function visibleApprovals(releases, {state, county, user = null, now = Date.now()} = {}) {
  const st = state ? String(state).toUpperCase() : null, ck = county ? normCounty(county) : null;
  const best = new Map();
  for (const r of releases || []) {
    if (!r || !r.property || !r.parcelId) continue;
    if (st && r.state !== st) continue;
    if (ck && normCounty(r.county) !== ck) continue;
    if (audienceFor(r, user, now) === 'none') continue;
    const key = recordKey(r.state, r.county, r.parcelId);
    const prev = best.get(key);
    if (!prev || String(r.proReleaseAt) > String(prev.proReleaseAt)) best.set(key, r);
  }
  return best;
}

// The public map record shape (already-expanded field values, as the map uses after loading a county).
export function mapRecord(r) {
  const p = r.property;
  const located = validPoint(p.point);
  return {
    i: r.state + '|' + r.county + '|' + r.parcelId + '|', p: r.parcelId, c: p.category,
    a: p.address || null, o: p.ownerName || null, amt: p.amount ?? null, ac: p.acreage ?? null,
    v: 1, t: 'Owner-approved update', st: r.title, sl: null,
    src: 'Owner-verified against the official record' + (r.evidenceUrl ? ' (' + new URL(r.evidenceUrl).hostname + ')' : ''),
    fr: 'Approved ' + String(r.proReleaseAt).slice(0, 10),
    cx: located ? p.point : null, g: located && p.ring ? [p.ring] : null, bb: located && p.ring ? p.bb : null,
    why: located ? null : 'Location not verified yet. Listed without a map position; nothing is guessed.',
    approved: {releaseId: r.id, approvedAt: r.proReleaseAt, description: r.description, evidenceUrl: r.evidenceUrl || null, located},
  };
}

export function recordsForCounty(releases, opts) {
  return [...visibleApprovals(releases, opts).values()].map(mapRecord);
}

// Downloads: the approved record (or approved correction) for one selected item id "ST|County|Parcel|…".
export function approvedForItem(releases, itemId, {user = null, now = Date.now()} = {}) {
  const [state, county, parcel] = String(itemId || '').split('|');
  if (!state || !county || !parcel) return null;
  const hit = visibleApprovals(releases, {state, county, user, now}).get(recordKey(state, county, parcel));
  return hit ? mapRecord(hit) : null;
}

// Fields a correction may change on an existing record. Location only when verified.
export function correctionPatch(rec) {
  const patch = {};
  for (const k of ['a', 'o', 'amt', 'ac', 'c']) if (rec[k] != null) patch[k] = rec[k];
  patch.v = 1; // verified by the owner against the official record, as the map marks it
  if (rec.cx) { patch.cx = rec.cx; patch.why = null; }
  if (rec.g) { patch.g = rec.g; patch.bb = rec.bb; }
  return patch;
}
