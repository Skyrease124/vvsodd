// Reusable parcel matching for owner-approved map positions. Pure functions: no network, no store, no keys.
// A record is matched to an official parcel by its tax parcel number (SBL: section-block-lot, normalized) and a
// verified street address. A position comes only from an official parcel polygon. Anything that does not match
// exactly stays pending with a reason; nothing is guessed, and geocoder results are never used as positions.
// Any county is added by writing one source configuration (netlify/lib/gis-sources.mjs) and running the tool.

export const MAX_RING_POINTS = 2000;
export const CONFLICT_METERS = 150;   // two official sources further apart than this are a conflict, not a match
export const US_BOUNDS = [-180, 18, -60, 72];

const SUFFIX = {AVENUE: 'AVE', AV: 'AVE', STREET: 'ST', STR: 'ST', ROAD: 'RD', DRIVE: 'DR', BOULEVARD: 'BLVD', PLACE: 'PL',
  TERRACE: 'TER', PARKWAY: 'PKWY', PKY: 'PKWY', COURT: 'CT', LANE: 'LN', CIRCLE: 'CIR', HIGHWAY: 'HWY'};
const DIR = {NORTH: 'N', SOUTH: 'S', EAST: 'E', WEST: 'W'};
const round7 = x => Math.round(x * 1e7) / 1e7;

// "120.74-2-13", "0120.74-02-013", "095.02-2-4.002" -> one canonical key. Returns null when the text is not an SBL.
export function normSbl(raw) {
  const s = String(raw ?? '').trim().replace(/\s+/g, '');
  const m = s.match(/^(\d{1,4})(?:\.(\d{1,2}))?-(\d{1,4})-(\d{1,5})(?:\.(\d{1,4}))?$/);
  if (!m) return null;
  const section = String(parseInt(m[1], 10)) + (m[2] !== undefined ? '.' + m[2] : '');
  const sub = m[5] !== undefined ? '.' + String(parseInt(m[5], 10)) : '';
  return section + '-' + parseInt(m[3], 10) + '-' + parseInt(m[4], 10) + sub;
}

// Identifier normalizers. Each source names one. ny-sbl is the default and reproduces the Rochester audit exactly.
//   ny-sbl        section-block-lot numbers used in New York: "120.74-2-13" and "0120.74-02-013" are one parcel
//   alphanumeric  letters and digits only, in upper case: "12-34/5a" and "12.34/5A" are one parcel
//   exact         the text as written, with the ends trimmed (for layers whose identifiers are already canonical)
export const NORMALIZERS = Object.freeze(['ny-sbl', 'alphanumeric', 'exact']);
const toInt = v => (/^\d+$/.test(String(v ?? '').trim()) ? parseInt(String(v).trim(), 10) : null);
const quote = v => "'" + String(v).replace(/'/g, "''") + "'";

export function identifierKey(normalizer, raw) {
  if (normalizer === 'alphanumeric') return String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '') || null;
  if (normalizer === 'exact') return String(raw ?? '').trim() || null;
  throw new Error('Unknown identifier normalizer: ' + normalizer);
}

// The key of a whole identifier, with no fallback to trailing text (used for the coverage counts).
export function wholeKey(normalizer, raw) {
  return (normalizer || 'ny-sbl') === 'ny-sbl' ? normSbl(raw) : identifierKey(normalizer, raw);
}

// The key used for matching. For ny-sbl a value with trailing text ("091.75-2-25./HOME") gives its leading SBL and a note.
export function keyFor(normalizer, raw) {
  const name = normalizer || 'ny-sbl';
  if (name !== 'ny-sbl') return {key: identifierKey(name, raw), note: null};
  const full = normSbl(raw);
  if (full) return {key: full, note: null};
  const lead = leadingSbl(raw);
  const key = lead ? normSbl(lead) : null;
  const note = key ? 'The parcel number "' + String(raw).trim() + '" has trailing text after the SBL ' + lead + '. Matching used the SBL and the verified address.' : null;
  return {key, note};
}

export function canonicalStreet(text) {
  return String(text ?? '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)
    .map(w => SUFFIX[w] || DIR[w] || w).join(' ');
}

// "81 Aberdeen St, Rochester NY 14619" -> {number, numbers, low, high, street, zip}. "81-83" gives numbers [81, 83].
export function parseAddress(text) {
  const raw = String(text ?? '').toUpperCase().replace(/\s+/g, ' ').trim();
  const zipMatch = raw.match(/\b(\d{5})(?:-\d{4})?\b/);
  const head = raw.split(',')[0].replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
  const m = head.match(/^(\d+(?:-\d+)?)\s+(.+)$/);
  const zip = zipMatch ? zipMatch[1] : null;
  if (!m) return {number: null, numbers: [], low: null, high: null, street: canonicalStreet(head), zip};
  const numbers = m[1].split('-').map(Number);
  return {number: m[1], numbers, low: Math.min(...numbers), high: Math.max(...numbers), street: canonicalStreet(m[2]), zip};
}

// Compares a record's address with an official parcel's address. Every number in the record must lie in the
// parcel's number range, the street must match after suffix normalization, and a ZIP must agree when both have one.
export function addressMatch(recordAddress, featureAddress) {
  const r = parseAddress(recordAddress);
  if (!r.number || !r.street) return {ok: false, reason: 'address_unreadable'};
  const f = featureAddress || {};
  if (!Number.isFinite(f.low)) return {ok: false, reason: 'address_number_missing'};
  const high = Number.isFinite(f.high) ? f.high : f.low;
  if (!r.numbers.every(n => n >= f.low && n <= high)) return {ok: false, reason: 'address_number_mismatch'};
  if (!f.street || r.street !== f.street) return {ok: false, reason: 'address_street_mismatch'};
  if (r.zip && f.zip && r.zip !== f.zip) return {ok: false, reason: 'address_zip_mismatch'};
  return {ok: true, reason: 'verified', zipChecked: !!(r.zip && f.zip)};
}

export function ringArea(ring) {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return Math.abs(a) / 2;
}

// Closes the ring and rounds to about one centimetre, the precision of the official survey.
export function closeRing(ring) {
  const pts = ring.map(p => [round7(p[0]), round7(p[1])]);
  const f = pts[0], l = pts[pts.length - 1];
  if (f[0] !== l[0] || f[1] !== l[1]) pts.push([f[0], f[1]]);
  return pts;
}

export function pointInRing(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function ringCentroid(ring) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i], [x1, y1] = ring[i + 1];
    const f = x0 * y1 - x1 * y0;
    a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
  }
  if (Math.abs(a) < 1e-15) return null;
  return [cx / (3 * a), cy / (3 * a)];
}

// Distance from a point to the nearest edge of the ring (degrees; used only to choose between interior points).
function distanceToEdges(p, ring) {
  let best = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[i + 1];
    const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((p[0] - x1) * dx + (p[1] - y1) * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(p[0] - (x1 + t * dx), p[1] - (y1 + t * dy)));
  }
  return best;
}

// A point guaranteed to lie inside the ring. The centroid is used when it is inside. Thin or concave parcels can
// have a centroid outside the polygon, so the interior is then searched along several horizontal lines, and the
// interior point farthest from every edge is kept. Returns null only when the ring has no interior at all.
export function representativePoint(ring) {
  const c = ringCentroid(ring);
  if (c && pointInRing(c, ring)) return [round7(c[0]), round7(c[1])];
  const ys = ring.map(p => p[1]);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const levels = [];
  for (let k = 1; k <= 31; k++) levels.push(minY + ((maxY - minY) * k) / 32);
  let best = null, bestScore = -1;
  for (const y of levels) {
    const xs = [];
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = ring[i], [x2, y2] = ring[i + 1];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const p = [(xs[i] + xs[i + 1]) / 2, y];
      if (!pointInRing(p, ring)) continue;
      const score = distanceToEdges(p, ring);
      if (score > bestScore) { bestScore = score; best = p; }
    }
  }
  return best ? [round7(best[0]), round7(best[1])] : null;
}

// The leading SBL of a value that has trailing text (for example "091.75-2-25./HOME"), exactly as written.
export function leadingSbl(raw) {
  const m = String(raw ?? '').trim().match(/^\d{1,4}(?:\.\d{1,2})?-\d{1,4}-\d{1,5}(?:\.\d{1,4})?/);
  return m ? m[0] : null;
}

// Returns null when the ring is a usable boundary, otherwise the reason it is not.
export function checkRing(ring, bbox) {
  if (!Array.isArray(ring) || ring.length < 4) return 'too_few_points';
  if (ring.length > MAX_RING_POINTS) return 'too_many_points';
  if (!ring.every(p => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]))) return 'bad_coordinates';
  const f = ring[0], l = ring[ring.length - 1];
  if (f[0] !== l[0] || f[1] !== l[1]) return 'not_closed';
  if (!ring.every(p => inBox(p, US_BOUNDS))) return 'outside_united_states';
  if (bbox && !ring.every(p => inBox(p, bbox))) return 'outside_county';
  if (ringArea(ring) < 1e-10) return 'zero_area';
  return null;
}

export function inBox(p, b) { return p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3]; }

export function metersBetween(a, b) {
  const R = 6371008.8, toR = d => (d * Math.PI) / 180;
  const dLat = toR(b[1] - a[1]), dLon = toR(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a[1])) * Math.cos(toR(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function bboxOf(ring) {
  const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]);
  return [round7(Math.min(...xs)), round7(Math.min(...ys)), round7(Math.max(...xs)), round7(Math.max(...ys))];
}

// Reads one official feature for a record: address check, polygon, point and bounds.
// Returns {ok: true, ...} or {ok: false, reason}.
function readFeature(src, feature, record) {
  const addr = addressMatch(record.address, src.toAddress(feature.attributes));
  if (!addr.ok) return {ok: false, reason: addr.reason};
  const rings = feature.geometry && Array.isArray(feature.geometry.rings) ? feature.geometry.rings : [];
  if (!rings.length) return {ok: false, reason: 'no_geometry'};
  const closed = rings.map(closeRing);
  let ring = null, multiPart = false;
  if (closed.length === 1) ring = closed[0];
  else {
    // Several parts: the position is the interior of the largest part; the boundary is not drawn (a single ring
    // would show only part of the parcel).
    multiPart = true;
    ring = closed.reduce((best, r) => (ringArea(r) > ringArea(best) ? r : best), closed[0]);
  }
  const problem = checkRing(ring, src.bbox);
  if (problem) return {ok: false, reason: problem};
  const point = representativePoint(ring);
  if (!point || !pointInRing(point, ring)) return {ok: false, reason: 'no_valid_point'};
  if (!inBox(point, src.bbox)) return {ok: false, reason: 'outside_county'};
  return {
    ok: true, zipChecked: addr.zipChecked, multiPart,
    point, boundary: multiPart ? null : ring, bbox: bboxOf(ring),
    official: src.official(feature.attributes),
    evidenceUrl: src.evidence(record.parcel),
  };
}

// Resolves one record against an ordered list of sources (highest priority first).
// src: {id, label, bbox, byParcel: Map(normSbl -> features[]), toAddress(attrs), official(attrs), evidence(parcel)}
export function resolveRecord(record, sources) {
  // The audit fields use the first source's normalizer; each source then looks the identifier up with its own.
  const first = keyFor(sources[0] && sources[0].normalize, record.parcel);
  const out = {parcel: record.parcel, sblKey: first.key, identifierNote: first.note, address: record.address || null, status: 'pending', reason: null,
    source: null, point: null, boundary: null, bbox: null, official: null, evidenceUrl: null, crossChecks: []};
  if (!first.key) return {...out, reason: (sources[0] && sources[0].normalize || 'ny-sbl') === 'ny-sbl' ? 'sbl_unreadable' : 'identifier_unreadable'};
  if (!record.address) return {...out, reason: 'address_missing'};
  let chosen = null, chosenIndex = -1;
  for (let i = 0; i < sources.length && !chosen; i++) {
    const src = sources[i];
    const features = lookup(src, record.parcel);
    if (!features.length) continue;     // not in this source: try the next one
    const reads = features.map(f => readFeature(src, f, record));
    const good = reads.filter(r => r.ok);
    if (good.length === 1) { chosen = good[0]; chosenIndex = i; out.source = src.id; }
    else if (good.length > 1) return {...out, source: src.id, reason: 'sbl_ambiguous'};
    else {
      // The parcel number exists but the address or geometry does not agree. This is a conflict: it is never
      // resolved by falling back to another source.
      return {...out, source: src.id, reason: 'conflict_' + reads[0].reason};
    }
  }
  if (!chosen) return {...out, reason: 'sbl_not_found'};
  out.status = 'matched';
  out.reason = chosen.multiPart ? 'verified_point_only' : 'verified';
  out.point = chosen.point; out.boundary = chosen.boundary; out.bbox = chosen.bbox; out.official = chosen.official;
  if (out.identifierNote && chosen.official && chosen.official.printKey === String(record.parcel).trim()) {
    out.identifierNote += ' The official layer uses the same identifier.';
  }
  out.evidenceUrl = chosen.evidenceUrl;
  out.addressChecked = true; out.zipChecked = chosen.zipChecked;
  // Other sources are checked against the chosen position; a disagreement beyond CONFLICT_METERS holds the record.
  for (let j = chosenIndex + 1; j < sources.length; j++) {
    const src = sources[j];
    const features = lookup(src, record.parcel);
    if (!features.length) { out.crossChecks.push({source: src.id, outcome: 'not_found'}); continue; }
    const reads = features.map(f => readFeature(src, f, record)).filter(r => r.ok);
    if (!reads.length) { out.crossChecks.push({source: src.id, outcome: 'address_or_geometry_disagrees'}); continue; }
    const d = Math.round(metersBetween(out.point, reads[0].point));
    if (d > CONFLICT_METERS) return {...out, status: 'pending', reason: 'source_conflict', crossChecks: [...out.crossChecks, {source: src.id, outcome: 'conflict', distanceM: d}]};
    out.crossChecks.push({source: src.id, outcome: 'corroborated', distanceM: d});
  }
  return out;
}

// Builds the per-source lookup from raw features (already fetched). Keys are normalized SBLs.
export function indexFeatures(src, features) {
  const byParcel = new Map();
  for (const f of features || []) {
    const raw = f.attributes && f.attributes[src.parcelField];
    const key = keyFor(src.normalize, raw).key;
    if (!key) continue;
    if (!byParcel.has(key)) byParcel.set(key, []);
    byParcel.get(key).push(f);
  }
  return {...src, byParcel};
}

// The features of one source that a record's identifier reaches (empty if none, or if the identifier is unreadable).
function lookup(src, raw) {
  const key = keyFor(src.normalize, raw).key;
  return key ? src.byParcel.get(key) || [] : [];
}

// Address fields of a layer, read from the attribute names its configuration declares (gis-sources.mjs). A field that is
// not declared, or is empty, falls back to the SITEADDRESS text, read the same way as any street address.
export function addressFromFields(f, a) {
  const site = parseAddress(f.siteAddress ? (a[f.siteAddress] || '') : '');
  const low = toInt(f.low ? a[f.low] : null) ?? site.low;
  const high = toInt(f.high ? a[f.high] : null) ?? site.high ?? low;
  const street = f.street && a[f.street] ? canonicalStreet(a[f.street]) : site.street;
  const zip = f.zip && a[f.zip] ? String(a[f.zip]).trim().slice(0, 5) : site.zip;
  return {low: low ?? null, high: high ?? null, street, zip};
}

export function officialFromFields(f, a) {
  const value = name => (name && a[name] !== undefined && a[name] !== null && a[name] !== '' ? a[name] : null);
  const acres = value(f.acres);
  return {parcelId: value(f.parcelId), printKey: value(f.printKey), siteAddress: value(f.siteAddress), zip: value(f.zip),
    acres: typeof acres === 'number' ? Math.round(acres * 1000) / 1000 : null};
}

// The matcher's source for one configuration in gis-sources.mjs. A configuration may supply its own toAddress, official
// and evidence functions (as the Rochester sources do); otherwise the declared fields and the layer URL are used.
export function sourceFromConfig(config) {
  const name = config.normalize || 'ny-sbl';
  if (!NORMALIZERS.includes(name)) throw new Error(config.id + ': unknown identifier normalizer "' + name + '"');
  const f = config.fields || {};
  return {
    id: config.id, label: config.label, bbox: config.bbox, parcelField: config.parcelField, layerUrl: config.layerUrl, normalize: name,
    toAddress: config.toAddress || (a => addressFromFields(f, a)),
    official: config.official || (a => officialFromFields(f, a)),
    evidence: config.evidence || (parcel => config.layerUrl + '/query?where=' + encodeURIComponent(config.parcelField + '=' + quote(parcel)) + '&outFields=*&f=html'),
  };
}

// Matches a whole dataset. Returns the audit document: sources, counts and one entry per record.
export function matchDataset({dataset, records, sources}) {
  const results = records.map(r => resolveRecord(r, sources));
  const counts = {};
  for (const r of results) counts[r.reason] = (counts[r.reason] || 0) + 1;
  const matched = results.filter(r => r.status === 'matched');
  return {
    schemaVersion: 1, dataset: dataset.id, state: dataset.state, county: dataset.county,
    summary: {
      records: results.length,
      matched: matched.length,
      matchedWithBoundary: matched.filter(r => r.boundary).length,
      matchedPointOnly: matched.filter(r => !r.boundary).length,
      pending: results.length - matched.length,
      byReason: counts,
    },
    records: results.map(r => ({...r, id: dataset.state + '|' + dataset.county + '|' + (r.parcel || '') + '|'})),
  };
}
