// Turns a parcel-match audit document into owner intake items. Pure: the caller passes the current items and
// releases and writes the result. Matched records enter the approval queue, verified against the official parcel
// (identity by SBL and verified address, position inside the official boundary). Records that did not match enter
// the intake as pending investigation, with no position. Duplicates are skipped, so a repeated import changes nothing.
import {validateSubmission, newItem, verifyItem, findDuplicate} from './property-intake.mjs';
import {SOURCES} from './gis-sources.mjs';

const clip = (text, n) => String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

const REASON_TEXT = {
  sbl_not_found: 'The parcel number was not found in the official layer.',
  sbl_ambiguous: 'More than one official parcel carries this parcel number and address; a person must decide which one.',
  sbl_unreadable: 'The parcel number could not be read.',
  address_missing: 'The record has no street address to verify.',
  source_conflict: 'Two official sources disagree on the position by more than the allowed distance.',
};
export function reasonText(rec) {
  if (REASON_TEXT[rec.reason]) return REASON_TEXT[rec.reason];
  if (String(rec.reason || '').startsWith('conflict_')) return 'The official record does not agree with the listed address (' + String(rec.reason).slice(9).replace(/_/g, ' ') + ').';
  return 'Not matched: ' + rec.reason + '.';
}

export function buildImportPlan({matches, existingItems, releases, now, actor}) {
  const created = [], skipped = [], refused = [];
  const pool = [...existingItems];
  const primaryId = (matches.sources || [])[0] && matches.sources[0].id;
  for (const rec of matches.records) {
    const source = SOURCES[rec.source] || SOURCES[primaryId];
    if (!source) { refused.push({parcel: rec.parcel, reason: 'No source configuration for this record.'}); continue; }
    const official = rec.official || {};
    const matched = rec.status === 'matched';
    const raw = {
      kind: 'tax_deed', origin: 'gis-import', state: matches.state, county: matches.county, parcelId: rec.parcel,
      title: clip('Official parcel position: ' + (official.siteAddress || rec.address || rec.parcel), 140),
      description: clip('Position and boundary from ' + source.label + ' (data ' + source.dataDate + '), matched on parcel number '
        + rec.parcel + ' and the verified street address. Owner approval is required before the position is shown.', 1400),
      address: official.siteAddress ? clip(official.siteAddress + ', ' + matches.county.replace(/^City of /, '') + ' ' + matches.state + ' ' + (official.zip || ''), 200) : (rec.address || undefined),
      amount: rec.amount ?? undefined,
      acreage: Number.isFinite(official.acres) ? official.acres : (rec.acreage ?? undefined),
      sourceUrl: source.layerUrl,
    };
    if (matched) {
      raw.longitude = rec.point[0];
      raw.latitude = rec.point[1];
      if (rec.boundary) raw.boundary = rec.boundary;
    }
    const v = validateSubmission(raw);
    if (!v.ok) { refused.push({parcel: rec.parcel, reason: v.error}); continue; }
    const dup = findDuplicate(pool, releases, v.item);
    if (dup) { skipped.push({parcel: rec.parcel, reason: dup.why}); continue; }
    let item = newItem(v.item, {now, actor});
    item.property = {...item.property, attribution: source.disclaimer, sourceLabel: source.label, dataDate: source.dataDate,
      listedAcreage: rec.acreage ?? null, identifierNote: rec.identifierNote || null};
    if (matched) {
      const check = verifyItem(item, {
        evidenceUrl: rec.evidenceUrl,
        notes: clip('Matched on parcel number ' + rec.parcel + ' and the verified address to ' + (official.siteAddress || 'the official record')
          + (official.zip ? ', ' + official.zip : '') + '. Position inside the official boundary. Official record: ' + rec.evidenceUrl, 1000),
        checklist: {officialSource: true, identityMatched: true, locationVerified: true},
        now, actor,
      });
      if (check.error) { refused.push({parcel: rec.parcel, reason: check.message}); continue; }
      item = check.item;
    } else {
      item = {...item, audit: [...item.audit, {at: now.toISOString(), action: 'pending-investigation', by: actor,
        note: clip(reasonText(rec) + (rec.candidates && rec.candidates.length ? ' Official parcels at this address: ' + rec.candidates.map(c => c.printKey).join(', ') + '. These are leads, not matches.' : ''), 500)}]};
    }
    pool.push(item);
    created.push(item);
  }
  return {created, skipped, refused};
}
