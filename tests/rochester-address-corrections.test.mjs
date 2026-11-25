// Tests for the gated address corrections to the public Rochester list and map data.
// Every apply runs on a copy of the files, never on the repository. Run from the repo root:
//   node tests/rochester-address-corrections.test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAddressCorrections, LIENS_FILE, MAP_FILE, BASELINE_FILE} from '../tools/rochester-ny/apply-address-corrections.mjs';
import {correctionsFromAudit, ROOT, AUDIT_FILE, MANIFEST_FILE} from '../tools/rochester-ny/corrections.mjs';
import {hashStaticMapData, diffManifest} from '../tools/map/static-baseline.mjs';

const FILES = [LIENS_FILE, MAP_FILE, AUDIT_FILE, MANIFEST_FILE, BASELINE_FILE];
const LIENS_PREFIX = 'LIENS.push(...';
const BEFORE_WINDOW = Date.parse('2026-11-25T00:00:00Z');
const NOT_BEFORE = '2026-11-26T12:00:00Z';
const AFTER_WINDOW = Date.parse('2026-11-27T00:00:00Z');

const read = (dir, file) => fs.readFileSync(path.join(dir, file), 'utf8');
const readManifest = dir => JSON.parse(read(dir, MANIFEST_FILE));
const liensRows = text => JSON.parse(text.split('\n').find(l => l.startsWith(LIENS_PREFIX)).slice(LIENS_PREFIX.length, -2));
const snapshot = dir => Object.fromEntries(FILES.map(f => [f, read(dir, f)]));

function copyOfRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rochester-corrections-'));
  for (const f of FILES) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), {recursive: true});
    fs.copyFileSync(path.join(ROOT, f), path.join(dir, f));
  }
  fs.cpSync(path.join(ROOT, 'kinvest-liens', 'map'), path.join(dir, 'kinvest-liens', 'map'), {recursive: true});
  return dir;
}

test('the manifest is exactly the set of corrections the matches audit gives', () => {
  const audit = JSON.parse(fs.readFileSync(path.join(ROOT, AUDIT_FILE), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, MANIFEST_FILE), 'utf8'));
  assert.deepEqual(manifest.corrections, correctionsFromAudit(audit));
  assert.equal(manifest.corrections.length, 11);
  for (const c of manifest.corrections) {
    assert.equal(c.corrected, c.official.siteAddress + ', Rochester NY ' + c.official.zip, c.parcel);
    assert.equal(c.official.printKey, c.parcel, c.parcel + ' keeps its parcel number');
  }
});

test('public files show the listed spelling until the corrections are applied, and the corrected spelling after', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, MANIFEST_FILE), 'utf8'));
  const liens = fs.readFileSync(path.join(ROOT, LIENS_FILE), 'utf8');
  const map = fs.readFileSync(path.join(ROOT, MAP_FILE), 'utf8');
  for (const c of manifest.corrections) {
    const shown = manifest.appliedAt ? c.corrected : c.listed;
    const hidden = manifest.appliedAt ? c.listed : c.corrected;
    assert.ok(liens.includes('"address":' + JSON.stringify(shown)), c.parcel + ' list shows the expected text');
    assert.ok(map.includes('"a":' + JSON.stringify(shown)), c.parcel + ' map shows the expected text');
    assert.ok(!liens.includes(JSON.stringify(hidden)), c.parcel + ' list does not show the other text');
    assert.ok(!map.includes(JSON.stringify(hidden)), c.parcel + ' map does not show the other text');
  }
});

test('the apply refuses without a window end, and before the window ends, and changes nothing', () => {
  const dir = copyOfRepo();
  const before = snapshot(dir);
  const none = applyAddressCorrections({root: dir, apply: true, now: AFTER_WINDOW});
  assert.equal(none.code, 2);
  assert.equal(none.applied, false);
  const early = applyAddressCorrections({root: dir, notBefore: NOT_BEFORE, apply: true, now: BEFORE_WINDOW});
  assert.equal(early.code, 3);
  assert.equal(early.applied, false);
  assert.deepEqual(snapshot(dir), before);
});

test('a dry run lists the changes and writes nothing, even before the window ends', () => {
  const dir = copyOfRepo();
  const before = snapshot(dir);
  const r = applyAddressCorrections({root: dir, notBefore: NOT_BEFORE, apply: false, now: BEFORE_WINDOW});
  assert.equal(r.ok, true);
  assert.equal(r.applied, false);
  assert.equal(r.windowEnded, false);
  assert.equal(r.changes.length, 22, 'one change in the list and one in the map data for each of 11 parcels');
  assert.equal(new Set(r.changes.map(c => c.parcel)).size, 11);
  assert.deepEqual(snapshot(dir), before);
});

test('after the window, the apply changes only the 11 address fields and keeps every other record, identity, position, source and the audit', () => {
  const dir = copyOfRepo();
  const liensBefore = liensRows(read(dir, LIENS_FILE));
  const mapBefore = JSON.parse(read(dir, MAP_FILE));
  const auditBefore = read(dir, AUDIT_FILE);
  const manifest = readManifest(dir);
  const fixed = new Map(manifest.corrections.map(c => [c.parcel, c.corrected]));

  const r = applyAddressCorrections({root: dir, notBefore: NOT_BEFORE, apply: true, now: AFTER_WINDOW});
  assert.equal(r.ok, true, r.message);
  assert.equal(r.applied, true);
  assert.equal(r.auditUnchanged, true);

  const liensAfter = liensRows(read(dir, LIENS_FILE));
  assert.equal(liensAfter.length, 191);
  liensBefore.forEach((row, i) => {
    const after = liensAfter[i];
    assert.deepEqual(Object.keys(after), Object.keys(row), row.parcel + ' has the same fields');
    for (const k of Object.keys(row)) {
      if (k === 'address' && fixed.has(row.parcel)) assert.equal(after.address, fixed.get(row.parcel), row.parcel + ' corrected');
      else assert.deepEqual(after[k], row[k], row.parcel + ' ' + k + ' is unchanged');
    }
  });

  const mapAfter = JSON.parse(read(dir, MAP_FILE));
  assert.equal(mapAfter.recs.length, 191);
  assert.equal(new Set(mapAfter.recs.map(x => x.p)).size, 191, 'no parcel appears twice');
  mapBefore.recs.forEach((rec, i) => {
    const after = mapAfter.recs[i];
    assert.deepEqual(Object.keys(after), Object.keys(rec), rec.p + ' has the same fields');
    for (const k of Object.keys(rec)) {
      if (k === 'a' && fixed.has(rec.p)) assert.equal(after.a, fixed.get(rec.p), rec.p + ' corrected');
      else assert.deepEqual(after[k], rec[k], rec.p + ' ' + k + ' is unchanged');
    }
  });
  assert.deepEqual({...mapAfter, recs: null}, {...mapBefore, recs: null}, 'the rest of the map file is unchanged');

  assert.equal(read(dir, AUDIT_FILE), auditBefore, 'the matches audit (positions, boundaries, sources, approvals) is byte-identical');
  for (const c of manifest.corrections) {
    assert.equal(mapAfter.recs.find(x => x.p === c.parcel).a, c.official.siteAddress + ', Rochester NY ' + c.official.zip, c.parcel);
  }

  const baseline = JSON.parse(read(dir, BASELINE_FILE));
  assert.equal(diffManifest(hashStaticMapData(dir), baseline).clean, true, 'the static baseline was regenerated for the changed files');
  assert.equal(readManifest(dir).appliedAt, new Date(AFTER_WINDOW).toISOString());

  const again = applyAddressCorrections({root: dir, notBefore: NOT_BEFORE, apply: true, now: AFTER_WINDOW});
  assert.equal(again.code, 4, 'a second apply is refused');
});

test('a manifest that differs from the matches audit is refused and nothing is written', () => {
  const dir = copyOfRepo();
  const manifest = readManifest(dir);
  manifest.corrections[0].corrected = 'Somewhere Else, Rochester NY 14621';
  fs.writeFileSync(path.join(dir, MANIFEST_FILE), JSON.stringify(manifest, null, 2) + '\n');
  const before = snapshot(dir);
  const r = applyAddressCorrections({root: dir, notBefore: NOT_BEFORE, apply: true, now: AFTER_WINDOW});
  assert.equal(r.code, 5);
  assert.deepEqual(snapshot(dir), before);
});

test('a public list that does not hold the expected record is refused and nothing is written', () => {
  const dir = copyOfRepo();
  const listPath = path.join(dir, LIENS_FILE);
  const text = fs.readFileSync(listPath, 'utf8');
  fs.writeFileSync(listPath, text.replace('"address":"363 Aveenue A, Rochester NY 14621"', '"address":"363 Aveenue A, Rochester NY 14622"'));
  const before = snapshot(dir);
  const r = applyAddressCorrections({root: dir, notBefore: NOT_BEFORE, apply: true, now: AFTER_WINDOW});
  assert.equal(r.code, 6);
  assert.equal(r.applied, false);
  assert.deepEqual(snapshot(dir), before);
});
