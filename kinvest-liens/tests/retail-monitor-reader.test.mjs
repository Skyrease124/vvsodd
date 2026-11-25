import test from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const kv = new Map();
const authStub = { kvGet: async k => kv.get(k), kvPut: async (k, v) => { kv.set(k, v); }, kvList: async () => [] };
const lib = f => pathToFileURL(path.resolve('netlify/lib', f)).href;
const can = typeof mock.module === 'function'; // run with: node --test --experimental-test-module-mocks
if (can) mock.module(lib('auth.mjs'), { namedExports: authStub });
if (can) for (const f of ['apikeys.mjs', 'onesignal.mjs', 'pushjobs.mjs', 'community.mjs']) mock.module(lib(f), { namedExports: { load: async () => {}, keyOf: () => '', FOUNDER_EMAIL: 'x', prefsOf: () => ({}) } });
const R = can ? await import(lib('retail.mjs')) : null;
const page = '<html><body><h1>Pokemon box</h1><p>We are working on it. Check back soon.</p></body></html>';
const mk = () => ({ id: 'a1b2c3d4e5f6', url: 'https://www.target.com/p/x/-/A-1', retailer: 'target', name: 'Test box', status: 'monitoring', auto: true });
test('AI reader can mark a product out of stock only with a quote that is on the page', { skip: !can }, async () => {
  R._setFetch(async () => new Response(page, { status: 200 }));
  const p = mk();
  const c = await R.checkOne(p, { reader: async () => ({ status: 'out_of_stock', evidence: 'Check back soon' }) });
  assert.equal(p.status, 'out_of_stock'); assert.equal(c.readable, true);
});
test('AI reader saying in stock never changes the status', { skip: !can }, async () => {
  R._setFetch(async () => new Response(page, { status: 200 }));
  const p = mk();
  await R.checkOne(p, { reader: async () => ({ status: 'in_stock', evidence: 'We are working on it' }) });
  assert.equal(p.status, 'monitoring');
});
