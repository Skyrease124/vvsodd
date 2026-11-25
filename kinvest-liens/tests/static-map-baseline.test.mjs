// Repo test. The static map datasets are published as they are; this test fails when any of them changes
// without the manifest being regenerated on purpose (node tools/map/static-baseline.mjs). It is a CI gate,
// not a runtime block: it does not change what the site serves.
// Run from the repo root: node --test kinvest-liens/tests/static-map-baseline.test.mjs
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {hashStaticMapData, diffManifest, MANIFEST, ROOT} from '../../tools/map/static-baseline.mjs';

test('the static map data matches the committed baseline', () => {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const current = hashStaticMapData(ROOT);
  const diff = diffManifest(current, manifest);
  assert.equal(manifest.count, manifest.files.length, 'manifest count is consistent');
  assert.equal(diff.clean, true, 'static map data changed without a regenerated baseline: '
    + JSON.stringify({changed: diff.changed.slice(0, 10), added: diff.added.slice(0, 10), removed: diff.removed.slice(0, 10)})
    + '. If this change is intended, run: node tools/map/static-baseline.mjs');
});

test('the baseline covers every published map data file and the map index', () => {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  assert.ok(manifest.files.some(f => f.path === 'kinvest-liens/map/index.json'));
  assert.equal(manifest.files.filter(f => f.path.startsWith('kinvest-liens/map/data/')).length, fs.readdirSync(new URL('../map/data/', import.meta.url)).filter(f => f.endsWith('.json')).length);
});

test('a single changed byte is detected by the baseline comparison', () => {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const tampered = {...manifest, files: manifest.files.map((f, i) => (i === 0 ? {...f, sha256: '0'.repeat(64)} : f))};
  const diff = diffManifest(hashStaticMapData(ROOT), tampered);
  assert.equal(diff.clean, false);
  assert.equal(diff.changed.length, 1);
});
