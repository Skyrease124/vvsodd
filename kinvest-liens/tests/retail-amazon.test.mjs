import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const can = typeof mock.module === 'function'; // run with: node --test --experimental-test-module-mocks
const kv = new Map();
const lib = f => pathToFileURL(path.resolve('netlify/lib', f)).href;
if (can) {
  mock.module(lib('auth.mjs'), { namedExports: { kvGet: async k => kv.get(k), kvPut: async (k, v) => { kv.set(k, v); }, kvList: async pre => [...kv.keys()].filter(k => k.startsWith(pre)) } });
  mock.module(lib('apikeys.mjs'), { namedExports: { load: async () => {}, keyOf: n => (n === 'BRIGHTDATA_API_KEY' ? 'test-key' : ''), NAMES: {} } });
  for (const f of ['onesignal.mjs', 'pushjobs.mjs', 'community.mjs']) mock.module(lib(f), { namedExports: { FOUNDER_EMAIL: 'x', prefsOf: () => ({}) } });
}
const A = can ? await import(lib('retail-amazon.mjs')) : null;
const R = can ? await import(lib('retail.mjs')) : null;
test('in stock only when Amazon itself is the seller', { skip: !can }, () => {
  assert.equal(A.classify({ availability: 'In Stock', seller_name: 'Amazon.com', final_price: 31.99 }).status, 'in_stock');
  const third = A.classify({ availability: 'In Stock', seller_name: 'BestDealsLLC', final_price: 99 });
  assert.equal(third.status, 'unknown'); assert.match(third.reason, /third-party/);
  assert.equal(A.classify({ availability: 'Currently unavailable.' }).status, 'out_of_stock');
  assert.equal(A.classify({}).status, 'unknown');
});
test('monthly cap stops requests before anything is sent', { skip: !can }, async () => {
  kv.set('retail-amazon-control-v1', { enabled: true });
  kv.set('retail-amazon-usage-v1', { month: new Date().toISOString().slice(0, 7), used: A.MONTHLY_CAP });
  const p = { id: 'a1b2c3d4e5f6', url: 'https://www.amazon.com/dp/B000TEST01', retailer: 'amazon', name: 'x', status: 'monitoring', active: true };
  kv.set('rp_a1b2c3d4e5f6', p);
  let called = 0; const real = globalThis.fetch; globalThis.fetch = async () => { called++; return new Response('{}'); };
  try { const r = await A.step({ force: true }); assert.match(r.skipped, /cap reached|No more/); assert.equal(called, 0); } finally { globalThis.fetch = real; }
});
