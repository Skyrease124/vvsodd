// Repo test. Runs the REAL netlify/lib/brain-auth.mjs with a recording fake blob store, and checks where every key
// written by the owner tests (intake, approvals, withdrawals, releases, map overlay, live checks, NVIDIA receipts)
// is stored. On a Deploy Preview each must go to the isolated preview store; on production, to the account store.
// The only shared keys are the upstream quota counters, which must be shared so a preview cannot exceed a quota.
// Run from the repo root: node --experimental-vm-modules kinvest-liens/tests/brain-preview-isolation.test.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';

const writes = [];
const context = vm.createContext({console, JSON, Object, Array, String, Set, Map, Promise, Error});
const syn = (names, fill) => new vm.SyntheticModule(names, function () { fill(this); }, {context});
const fakeStore = name => ({
  get: async () => null, getWithMetadata: async () => null, list: async () => ({blobs: []}), delete: async () => {},
  setJSON: async (key) => { writes.push({store: name, key}); return {modified: true, etag: 'e1'}; },
});
const blobs = syn(['getStore', 'getDeployStore'], s => {
  s.setExport('getStore', o => fakeStore(o.name));
  s.setExport('getDeployStore', () => fakeStore('deploy-seed'));
});
const accountStore = fakeStore('pricepocketasset-users');
const authMock = syn(['kvGet', 'kvPut', 'kvDel', 'kvList', 'accountBlobStore', 'userFromCookie'], s => {
  s.setExport('kvGet', async () => null);
  s.setExport('kvPut', async (k, v) => accountStore.setJSON(k, v));
  s.setExport('kvDel', async () => {}); s.setExport('kvList', async () => []);
  s.setExport('accountBlobStore', () => accountStore);
  s.setExport('userFromCookie', async () => null);
});
const quota = syn(['readWayneQuota', 'reserveWayneRequest'], s => { s.setExport('readWayneQuota', async () => ({})); s.setExport('reserveWayneRequest', async () => ({})); });
const hooks = syn(['AsyncLocalStorage'], s => s.setExport('AsyncLocalStorage', AsyncLocalStorage));
const mod = new vm.SourceTextModule(fs.readFileSync('netlify/lib/brain-auth.mjs', 'utf8'), {context});
await mod.link(spec => spec === 'node:async_hooks' ? hooks : spec === '@netlify/blobs' ? blobs : spec.endsWith('wayne-gis-quota.mjs') ? quota
  : spec === './auth.mjs' ? authMock : (() => { throw new Error('unexpected import ' + spec); })());
await mod.evaluate();
const brain = mod.namespace;

// Every key the owner-authenticated tests 9 to 12 and the approval queue write.
const OWNER_TEST_KEYS = ['property-intake-v1', 'approved-research-releases-v1', 'owner-brain-approvals-v1', 'brain-map-county-v1-MI-wayne',
  'brain-map-history-v1', 'brain-map-publication-status-v1', 'owner-live-checks-v1', 'owner-live-checks-counter-v1', 'brain-nvidia-consolidation-v1'];
// Shared on purpose: upstream quotas are one allowance for the account, preview and production together.
const SHARED_QUOTA_KEYS = ['brain-nvidia-usage-v1', 'owner-brain-geoapify-usage-v1', 'brain-wayne-gis-quota-v1-2026-11-24'];

async function writeAll(deployContext, keys) {
  writes.length = 0;
  const run = brain.withBrainStore(async () => {
    for (const k of keys) { await brain.kvPut(k, {x: 1}); await brain.kvPutVersioned(k, {x: 1}, null); }
    return brain.isBrainPreview();
  });
  const preview = await run(new Request('https://x.test/'), deployContext ? {deploy: {context: deployContext}} : undefined);
  return {preview, stores: [...new Set(writes.map(w => w.store))], perKey: Object.fromEntries(keys.map(k => [k, [...new Set(writes.filter(w => w.key === k).map(w => w.store))]]))};
}

test('on a Deploy Preview, every owner-test write goes to the isolated preview store only', async () => {
  const out = await writeAll('deploy-preview', OWNER_TEST_KEYS);
  assert.equal(out.preview, true);
  for (const k of OWNER_TEST_KEYS) assert.deepEqual(out.perKey[k], ['ppa-brain-preview-integration'], k);
});

test('on production, the same keys go to the production account store', async () => {
  const out = await writeAll('production', OWNER_TEST_KEYS);
  assert.equal(out.preview, false);
  for (const k of OWNER_TEST_KEYS) assert.deepEqual(out.perKey[k], ['pricepocketasset-users'], k);
});

test('a branch deploy or an unknown context is treated as production, never as the preview store', async () => {
  for (const c of ['branch-deploy', 'dev', undefined]) assert.equal((await writeAll(c, ['property-intake-v1'])).preview, false);
});

test('upstream quota counters are deliberately shared, so a preview cannot exceed a provider allowance', async () => {
  const out = await writeAll('deploy-preview', SHARED_QUOTA_KEYS);
  for (const k of SHARED_QUOTA_KEYS) assert.deepEqual(out.perKey[k], ['pricepocketasset-users'], k);
});
