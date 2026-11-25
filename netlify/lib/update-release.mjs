// One release policy for owner-approved updates: parcel corrections, new property information,
// tax lien updates, tax deed updates and research releases.
// Pro members see an approved update first. Free members and anonymous visitors see it 48 hours
// after owner approval. An owner may release a critical correction (inaccurate or misleading
// information) to everyone immediately. Items published before this policy have no release
// fields and remain public.
export const PRO_EARLY_ACCESS_MS = 48 * 60 * 60 * 1000;
export const RELEASE_MODES = Object.freeze(['pro_first_48h', 'immediate_critical']);
export const UPDATE_KINDS = Object.freeze(['parcel_correction', 'new_property', 'tax_lien', 'tax_deed', 'research_release']);
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

// Release fields are computed from the owner approval time, never from the publication time.
export function releaseTimes({approvedAt, releaseMode = 'pro_first_48h'}) {
  if (typeof approvedAt !== 'string' || !TIMESTAMP.test(approvedAt) || !Number.isFinite(Date.parse(approvedAt)))
    throw Error('Owner approval time is required');
  if (!RELEASE_MODES.includes(releaseMode)) throw Error('Unknown release mode');
  const proMs = Date.parse(approvedAt);
  const freeMs = releaseMode === 'immediate_critical' ? proMs : proMs + PRO_EARLY_ACCESS_MS;
  return {releaseMode, approvedAt, proReleaseAt: new Date(proMs).toISOString(), freeReleaseAt: new Date(freeMs).toISOString()};
}

// True when a released item may be shown to this viewer at nowMs.
export function visibleTo(item, {pro = false, nowMs = Date.now()} = {}) {
  if (!item || item.withdrawn === true) return false;
  if (!item.releaseMode) return true; // published before the release policy: stays public
  const proMs = Date.parse(item.proReleaseAt), freeMs = Date.parse(item.freeReleaseAt);
  if (!Number.isFinite(proMs) || !Number.isFinite(freeMs)) return false; // fail closed
  if (nowMs >= freeMs) return true;
  return pro === true && nowMs >= proMs;
}
