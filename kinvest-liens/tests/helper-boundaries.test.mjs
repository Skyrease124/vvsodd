// Step 7: owner approval is the only path to publish, and helper jobs run only when the owner clicks.
// Source level checks on the real files. Run from the repo root: node --test kinvest-liens/tests/helper-boundaries.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = f => fs.readFileSync(new URL('../../' + f, import.meta.url), 'utf8');
const HELPERS = ['netlify/functions/owner-brain-gemini.mjs', 'netlify/functions/owner-brain-research.mjs', 'netlify/functions/owner-brain-nvidia.mjs'];
const PUBLISH_STORES = /brain-map-county|brain-map-publication|brain-map-history|owner-brain-approvals|brain-release|release-feed|kinvest-liens\//;

test('helper endpoints are owner only, same origin and need an explicit confirmation', () => {
  for (const f of HELPERS) {
    const s = read(f);
    assert.match(s, /owner/i, f); assert.match(s, /origin/, f + ' checks the origin'); assert.match(s, /confirmed/, f + ' needs confirmed');
  }
});
test('no helper endpoint is scheduled, and no scheduled function calls a helper', () => {
  for (const f of HELPERS) assert.doesNotMatch(read(f).replace(/\/\/.*$/gm, ''), /schedule|cron|setInterval/i, f);
  const toml = fs.existsSync(new URL('../../netlify.toml', import.meta.url)) ? read('netlify.toml') : '';
  assert.doesNotMatch(toml, /owner-brain-(gemini|research|nvidia)/);
  const dir = new URL('../../netlify/functions/', import.meta.url);
  for (const name of fs.readdirSync(dir).filter(n => n.endsWith('.mjs'))) {
    const s = fs.readFileSync(new URL(name, dir), 'utf8');
    if (!/export const config\s*=\s*\{[^}]*schedule/.test(s)) continue;
    assert.doesNotMatch(s, /gemini-extract|gemini-limits|brain-nvidia|groq-limits|owner-brain-gemini|owner-brain-research|owner-brain-nvidia/, name + ' is scheduled and must not run a helper');
  }
});
test('helpers write only their own stores, never an approval, release or publish store', () => {
  const gem = read('netlify/functions/owner-brain-gemini.mjs');
  assert.deepEqual([...new Set([...gem.matchAll(/kvPut\(([A-Za-z_]+)/g)].map(m => m[1]))], ['STORE']);
  assert.doesNotMatch(gem.replace(/\/\/.*$/gm, ''), PUBLISH_STORES);
  const research = read('netlify/functions/owner-brain-research.mjs');
  assert.deepEqual([...new Set([...research.matchAll(/kvPut\(([A-Za-z_]+)/g)].map(m => m[1]))], ['STORE']);
  assert.match(research, /const STORE='owner-brain-scanner-v1'/);
  const nv = read('netlify/lib/brain-nvidia.mjs');
  assert.deepEqual([...new Set([...nv.matchAll(/updateJson\(auth, ([A-Z_]+)/g)].map(m => m[1]))].sort(), ['RECEIPTS', 'USAGE']);
  assert.doesNotMatch(nv.replace(/\/\/.*$/gm, ''), /kvPut|putVersioned|kvDel/, 'NVIDIA writes through its two stores only');
  for (const f of ['netlify/lib/gemini-extract.mjs', 'netlify/lib/gemini-limits.mjs']) assert.doesNotMatch(read(f), /kvPut|updateJson|fetch\(\s*['"`]https:\/\/(?!generativelanguage)/, f);
});
test('every NVIDIA proposal is created waiting for the owner, and no helper marks anything approved', () => {
  const nv = read('netlify/lib/brain-nvidia.mjs');
  assert.match(nv, /requiresOwnerApproval: true/);
  for (const f of [...HELPERS, 'netlify/lib/gemini-extract.mjs']) assert.doesNotMatch(read(f).replace(/\/\/.*$/gm, ''), /approved_for_staging|approved_for_release|decision:\s*'approved/, f);
});
test('the Gemini job fetches only the one provider host and only from an uploaded file', () => {
  const lib = read('netlify/lib/gemini-extract.mjs'), fn = read('netlify/functions/owner-brain-gemini.mjs');
  assert.match(fn, /generativelanguage\.googleapis\.com/); assert.doesNotMatch(fn, /fetch\(/);
  assert.match(lib, /redirect: 'error'/); assert.match(lib, /base \+ '\/v1beta\/models\//);
});
