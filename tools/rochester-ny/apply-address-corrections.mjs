// Applies the verified City address corrections to the PUBLIC Rochester list and map data.
//
// Those files are published as static files. The corrected addresses are official City data for owner-approved records
// that are still in their Pro early-access window, so nothing here may change a public file before that window has ended.
// The owner gives the end of the window with --not-before, and the script refuses to apply before that time.
//
//   node tools/rochester-ny/apply-address-corrections.mjs --not-before 2026-11-26T12:00:00Z          dry run: lists the changes, writes nothing
//   node tools/rochester-ny/apply-address-corrections.mjs --not-before 2026-11-26T12:00:00Z --apply  writes the changes
//
// Only the address text changes. Each corrected record is checked against the manifest and the matches audit, every
// other record and field must come out exactly as it went in, and the audit is never written. The static map baseline is
// regenerated after the change. --root <dir> runs the same steps on a copy of the repository (the tests use this).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {hashStaticMapData} from '../map/static-baseline.mjs';
import {correctionsFromAudit, ROOT, AUDIT_FILE, MANIFEST_FILE} from './corrections.mjs';

export const LIENS_FILE = 'kinvest-liens/liens/states/liens-rochester.js';
export const MAP_FILE = 'kinvest-liens/map/data/NY-city-of-rochester.json';
export const BASELINE_FILE = 'netlify/lib/data/static-map-baseline.json';
const LIENS_PREFIX = 'LIENS.push(...';

const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Replaces the text only when it occurs exactly once, so a change can land only on the record it was checked against.
function replaceOnce(text, from, to) {
  const parts = text.split(from);
  if (parts.length !== 2) throw new Error('expected one occurrence of ' + from + ', found ' + (parts.length - 1));
  return parts.join(to);
}

// Every record must come out as it went in, except the address of a corrected parcel, which must be the corrected text.
function checkOnly(before, after, {parcelKey, addressKey, corrections}) {
  if (before.length !== after.length) throw new Error('the number of records changed');
  const wanted = new Map(corrections.map(c => [c.parcel, c.corrected]));
  before.forEach((b, i) => {
    const a = after[i];
    if (Object.keys(a).length !== Object.keys(b).length) throw new Error('the fields of ' + b[parcelKey] + ' changed');
    for (const k of Object.keys(b)) {
      if (k === addressKey && wanted.has(b[parcelKey])) {
        if (a[k] !== wanted.get(b[parcelKey])) throw new Error('wrong correction written for ' + b[parcelKey]);
      } else if (!same(a[k], b[k])) {
        throw new Error('unexpected change to ' + k + ' of ' + b[parcelKey]);
      }
    }
  });
}

// Codes: 0 ok, 2 no window end given, 3 window not ended (apply only), 4 already applied, 5 manifest differs from the audit,
// 6 a record is not as expected, 7 a check failed. Nothing is written unless every check passes.
export function applyAddressCorrections({root = ROOT, notBefore, apply = false, now = Date.now()} = {}) {
  const at = Date.parse(notBefore);
  if (notBefore === undefined || !Number.isFinite(at)) {
    return {ok: false, code: 2, applied: false, message: 'Give the end of the early-access window as --not-before <ISO time>. Nothing was changed.'};
  }
  const windowEnded = now >= at;
  const manifestPath = path.join(root, MANIFEST_FILE);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.appliedAt) return {ok: false, code: 4, applied: false, message: 'Already applied at ' + manifest.appliedAt + '. Nothing was changed.'};
  if (apply && !windowEnded) {
    return {ok: false, code: 3, applied: false, message: 'Not applied: the early-access window ends at ' + new Date(at).toISOString() + '. Nothing was changed.'};
  }
  const audit = JSON.parse(fs.readFileSync(path.join(root, AUDIT_FILE), 'utf8'));
  if (!same(correctionsFromAudit(audit), manifest.corrections)) {
    return {ok: false, code: 5, applied: false, message: 'The manifest does not match the matches audit. Regenerate it with corrections.mjs --write. Nothing was changed.'};
  }
  const auditBefore = sha(path.join(root, AUDIT_FILE));
  const changes = [];
  const fail = (code, message) => ({ok: false, code, applied: false, message: message + ' Nothing was changed.'});

  // Public list: a JavaScript file whose third line is LIENS.push(...[rows]);. Only the address text is replaced in place,
  // so the rest of the line, and the rest of the file, is kept byte for byte.
  const liensPath = path.join(root, LIENS_FILE);
  const liensLines = fs.readFileSync(liensPath, 'utf8').split('\n');
  const rowLine = liensLines.findIndex(l => l.startsWith(LIENS_PREFIX));
  if (rowLine < 0 || !liensLines[rowLine].endsWith(');')) return fail(6, 'The public list has an unexpected layout.');
  const rowsBefore = JSON.parse(liensLines[rowLine].slice(LIENS_PREFIX.length, -2));
  let liensLine = liensLines[rowLine];
  for (const c of manifest.corrections) {
    const hits = rowsBefore.filter(r => r.address === c.listed);
    if (hits.length !== 1 || hits[0].parcel !== c.parcel || hits[0].state !== 'NY') {
      return fail(6, 'The public list does not hold "' + c.listed + '" once, for parcel ' + c.parcel + '.');
    }
    liensLine = replaceOnce(liensLine, '"address":' + JSON.stringify(c.listed), '"address":' + JSON.stringify(c.corrected));
    changes.push({file: LIENS_FILE, parcel: c.parcel, from: c.listed, to: c.corrected});
  }
  try {
    checkOnly(rowsBefore, JSON.parse(liensLine.slice(LIENS_PREFIX.length, -2)),
      {parcelKey: 'parcel', addressKey: 'address', corrections: manifest.corrections});
  } catch (e) { return fail(7, 'Check failed for the public list: ' + e.message + '.'); }
  const liensNew = liensLines.slice();
  liensNew[rowLine] = liensLine;

  // Public map data: JSON with one record per parcel. The address is the field "a".
  const mapPath = path.join(root, MAP_FILE);
  const mapTextBefore = fs.readFileSync(mapPath, 'utf8');
  const mapBefore = JSON.parse(mapTextBefore);
  let mapText = mapTextBefore;
  for (const c of manifest.corrections) {
    const hits = mapBefore.recs.filter(r => r.p === c.parcel);
    if (hits.length !== 1 || hits[0].a !== c.listed) return fail(6, 'The map data does not hold "' + c.listed + '" once, for parcel ' + c.parcel + '.');
    mapText = replaceOnce(mapText, '"a":' + JSON.stringify(c.listed), '"a":' + JSON.stringify(c.corrected));
    changes.push({file: MAP_FILE, parcel: c.parcel, from: c.listed, to: c.corrected});
  }
  try {
    const mapAfter = JSON.parse(mapText);
    checkOnly(mapBefore.recs, mapAfter.recs, {parcelKey: 'p', addressKey: 'a', corrections: manifest.corrections});
    if (!same({...mapBefore, recs: null}, {...mapAfter, recs: null})) throw new Error('a top-level field changed');
  } catch (e) { return fail(7, 'Check failed for the map data: ' + e.message + '.'); }

  const result = {ok: true, code: 0, applied: false, windowEnded, notBefore: new Date(at).toISOString(), changes,
    auditUnchanged: sha(path.join(root, AUDIT_FILE)) === auditBefore};
  if (!apply) {
    return {...result, message: 'Dry run: ' + changes.length + ' changes to ' + manifest.corrections.length + ' parcels in two public files. ' +
      (windowEnded ? 'The window has ended; add --apply to write them.' : 'The window ends ' + new Date(at).toISOString() + '. Nothing can be written before then. Nothing was written.')};
  }

  fs.writeFileSync(liensPath, liensNew.join('\n'));
  fs.writeFileSync(mapPath, mapText);
  const appliedAt = new Date(now).toISOString();
  manifest.appliedAt = appliedAt;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(path.join(root, BASELINE_FILE), JSON.stringify(hashStaticMapData(root), null, 2) + '\n');
  return {...result, applied: true, appliedAt,
    message: 'Applied ' + manifest.corrections.length + ' corrections to the public list and map data. Static baseline regenerated.'};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const option = name => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  const result = applyAddressCorrections({root: option('--root') ? path.resolve(option('--root')) : ROOT,
    notBefore: option('--not-before'), apply: args.includes('--apply')});
  console.log(result.message);
  for (const c of result.changes || []) console.log('  ' + c.parcel + '  ' + c.from + '  ->  ' + c.to + '   [' + path.basename(c.file) + ']');
  process.exitCode = result.ok ? 0 : result.code;
}
