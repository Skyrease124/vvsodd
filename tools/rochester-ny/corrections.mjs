// Verified address corrections for the City of Rochester list.
//
// A correction replaces the list's address text with the official City GIS address (SITEADDRESS, recorded in the
// matches audit for the same parcel). It never changes a parcel number, position, boundary, source or approval.
// The public list and map data change only through apply-address-corrections.mjs, after the Pro early-access window.
//
//   node tools/rochester-ny/corrections.mjs            prints how many corrections the matches audit gives
//   node tools/rochester-ny/corrections.mjs --write    regenerates address-corrections.json (refused once applied)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const AUDIT_FILE = 'netlify/lib/data/parcel-matches/NY-city-of-rochester.json';
export const MANIFEST_FILE = 'tools/rochester-ny/address-corrections.json';
export const LAYER_ID = 'city-of-rochester-tax-parcels';

export function displayAddress(siteAddress, zip) {
  return siteAddress + ', Rochester NY ' + zip;
}

// One entry for each matched parcel whose list text differs from its official address.
export function correctionsFromAudit(audit) {
  const out = [];
  for (const r of audit.records) {
    if (r.status !== 'matched' || !r.addressAsListed) continue;
    const o = r.official || {};
    if (!o.siteAddress || !o.zip || !o.printKey) throw new Error('No official address recorded for ' + r.parcel);
    if (o.printKey !== r.parcel) throw new Error('Official parcel ' + o.printKey + ' does not match ' + r.parcel);
    const corrected = displayAddress(o.siteAddress, o.zip);
    if (corrected === r.addressAsListed) continue;
    out.push({parcel: r.parcel, id: r.id, listed: r.addressAsListed, corrected,
      official: {parcelId: o.parcelId, printKey: o.printKey, siteAddress: o.siteAddress, zip: o.zip},
      source: LAYER_ID, evidenceUrl: r.evidenceUrl});
  }
  return out;
}

export function manifestFrom(audit) {
  return {
    schemaVersion: 1,
    dataset: audit.dataset,
    purpose: 'Corrections for the City of Rochester list, whose address text has a builder spelling defect. Each corrected address is the official City GIS address recorded in the matches audit. Parcel numbers are unchanged.',
    publicFiles: ['kinvest-liens/liens/states/liens-rochester.js', 'kinvest-liens/map/data/NY-city-of-rochester.json'],
    appliedAt: null,
    corrections: correctionsFromAudit(audit),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const audit = JSON.parse(fs.readFileSync(path.join(ROOT, AUDIT_FILE), 'utf8'));
  const manifestPath = path.join(ROOT, MANIFEST_FILE);
  if (!process.argv.includes('--write')) {
    console.log(correctionsFromAudit(audit).length + ' corrections in the matches audit. Use --write to regenerate the manifest.');
  } else if (fs.existsSync(manifestPath) && JSON.parse(fs.readFileSync(manifestPath, 'utf8')).appliedAt) {
    console.error('Refused: the corrections were already applied. The manifest is not overwritten.');
    process.exitCode = 1;
  } else {
    const manifest = manifestFrom(audit);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    console.log('Wrote ' + manifest.corrections.length + ' corrections to ' + MANIFEST_FILE);
  }
}
