// Publish boundary. The site publishes kinvest-liens (netlify.toml), so nothing under it may carry restricted parcel
// information. Restricted, until the Pro early-access window ends: the exact official positions and boundaries of
// owner-approved records, their official parcel IDs, and the official spellings of corrected addresses. The release and
// intake stores are read only by server functions that are owner-gated or visibility-filtered.
// Run from the repo root: node tests/publish_boundary.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'kinvest-liens');
const FUNCTIONS = path.join(ROOT, 'netlify', 'functions');
const BINARY = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|eot|pdf|zip|gz|mp4|webm|mp3|wav)$/i;
const rel = file => path.relative(ROOT, file);

function publicFiles(dir = PUBLIC, out = []) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) publicFiles(p, out);
    else if (!BINARY.test(entry.name)) out.push(p);
  }
  return out;
}

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'rochester-ny', 'address-corrections.json'), 'utf8'));

// Restricted values of every matches audit (all counties): official parcel IDs of matched records, and their exact
// positions and boundary points. Numbers are the stored precision (seven decimals).
const AUDIT_DIR = path.join(ROOT, 'netlify', 'lib', 'data', 'parcel-matches');
const audits = fs.readdirSync(AUDIT_DIR).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(AUDIT_DIR, f), 'utf8')));
const restrictedIds = new Set();
const restrictedNumbers = new Set();
const longEnough = v => /\.\d{4,}$/.test(String(v));
// Pending candidates are restricted as well: an official ID or a candidate position stays server-side until approval.
const addNumbers = (point, boundary) => {
  for (const v of point || []) if (longEnough(v)) restrictedNumbers.add(String(v));
  for (const p of boundary || []) for (const v of p) if (longEnough(v)) restrictedNumbers.add(String(v));
};
for (const audit of audits) for (const r of audit.records) {
  if (r.status === 'matched') {
    if (r.official && r.official.parcelId) restrictedIds.add(String(r.official.parcelId));
    addNumbers(r.point, r.boundary);
  }
  if (r.candidate) {
    if (r.candidate.official && r.candidate.official.parcelId) restrictedIds.add(String(r.candidate.official.parcelId));
    addNumbers(r.candidate.point, r.candidate.boundary);
  }
}
// Corrected official spellings stay off the public site until the corrections are applied (after the window).
const embargoed = manifest.appliedAt ? [] : manifest.corrections.map(c => c.corrected);

test('the published directory is kinvest-liens, and the matches audit gives the restricted values', () => {
  const toml = fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8');
  assert.match(toml, /publish = "kinvest-liens"/);
  assert.ok(audits.length >= 2 && restrictedIds.size > 200, 'every matches audit is checked (' + audits.length + ' audits, ' + restrictedIds.size + ' official parcel IDs)');
  assert.ok(restrictedNumbers.size > 1000, 'matched positions and boundary points are checked (' + restrictedNumbers.size + ')');
  assert.ok(embargoed.length === 0 || embargoed.length === 11, 'the corrections are embargoed or applied');
});

test('no published file carries an official parcel ID, a matched position or a boundary point of an approved record', () => {
  const files = publicFiles();
  assert.ok(files.length > 300, 'the whole published tree is scanned (' + files.length + ' files)');
  const leaks = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/-?\d+\.\d{4,}/g)) if (restrictedNumbers.has(m[0])) leaks.push(rel(file) + ': matched position ' + m[0]);
    // Whole tokens, so short official identifiers (for example "C40035") are caught as well as long ones. A decimal
    // number is one token: the digits of a coordinate such as 40.306056 are not a parcel number.
    const tokens = new Set(text.match(/[A-Za-z0-9]+(?:\.\d+)*/g) || []);
    for (const id of restrictedIds) if (tokens.has(id)) leaks.push(rel(file) + ': official parcel ID ' + id);
    for (const s of embargoed) if (text.includes(s)) leaks.push(rel(file) + ': corrected official spelling before the window ends: ' + s);
    if (leaks.length > 20) break;
  }
  assert.deepEqual(leaks, []);
});

// A function reads the restricted stores when it names the release index, the intake store, the audit registry, or the
// certificate sync that writes the release index. Each such function must check the owner, or filter by visibility.
const STORE = /RELEASE_INDEX|approved-research-releases-v1|property-intake-v1|\bINTAKE\b|parcel-matches-registry|auto-research-release|syncReviewedCertificate/;
const OWNER_GATE = /\b(?:me|user)\??\.owner\b|\brequireOwner\(|\bisOwner\(/;
const VISIBILITY = /\b(?:audienceFor|visibleApprovals|approvedForItem|recordsForCounty|safeResearchRecord|isPaid|isProAccount)\(/;

test('every server function that reads the restricted release or intake store is owner-gated or visibility-filtered', () => {
  const functions = fs.readdirSync(FUNCTIONS).filter(f => f.endsWith('.mjs'));
  const readers = functions.filter(f => STORE.test(fs.readFileSync(path.join(FUNCTIONS, f), 'utf8')));
  assert.ok(readers.length >= 4, 'the known readers are found: ' + readers.join(', '));
  const unprotected = readers.filter(f => {
    const text = fs.readFileSync(path.join(FUNCTIONS, f), 'utf8');
    return !OWNER_GATE.test(text) && !VISIBILITY.test(text);
  });
  assert.deepEqual(unprotected, [], 'store readers that are neither owner-gated nor visibility-filtered');
});
