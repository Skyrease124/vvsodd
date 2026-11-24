// Repo test. Runs the REAL netlify/functions/export.mjs (Pro downloads) in a VM. The account, rate-limit,
// export-file and evidence modules are mocked; the approved-records and release libraries are real.
// Checks that downloads include owner-approved records and corrections only when the viewer may see them.
// Run from the repo root: node --experimental-vm-modules kinvest-liens/tests/export-approved-records.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const ROOT = process.cwd().replace(/\/?$/, '/');
const T0 = Date.parse('2026-11-24T12:00:00.000Z');
const H = 3600e3;
let NOW = T0;
const store = new Map();
const FakeDate = class extends Date { constructor(...a) { if (a.length) super(...a); else super(NOW); } static now() { return NOW; } };
const context = vm.createContext({Response, URL, Request, console, Date: FakeDate, JSON, Math, Object, Array, String, Number, Promise, Error, RegExp, Set, Map});
const syn = (names, fill) => new vm.SyntheticModule(names, function () { fill(this); }, {context});
const users = {pro: {email: 'pro@example.com', paidThrough: '2026-12-31'}, owner: {email: 'o@example.com', owner: true}};
const authMock = syn(['userFromCookie', 'isPaid'], s => {
  s.setExport('userFromCookie', async c => users[(c || '').replace('sess=', '')] || null);
  s.setExport('isPaid', u => !!u);
});
const brainMock = syn(['kvGet', 'withBrainStore'], s => {
  s.setExport('kvGet', async k => (store.has(k) ? structuredClone(store.get(k)) : null));
  s.setExport('withBrainStore', h => h);
});
const STATIC = {'MI|Wayne|01002263|': {r: {i: 'MI|Wayne|01002263|', p: '01002263', c: 'tax_deed', a: '90 Chandler', o: 'Owner A', amt: 14500}, meta: {state: 'MI', county: 'Wayne'}}};
const xMock = syn(['cleanItems', 'lookup', 'infoOf', 'MAX_PER_REQUEST', 'plan', 'WEEKLY_LIMIT'], s => {
  s.setExport('cleanItems', items => items);
  s.setExport('lookup', it => STATIC[it.i] || null);
  s.setExport('infoOf', x => ({id: x.r.i, parcel: x.r.p, address: x.r.a, amount: x.r.amt, county: x.meta.county, verified: !!x.r.v}));
  s.setExport('MAX_PER_REQUEST', 100); s.setExport('WEEKLY_LIMIT', 100); s.setExport('plan', async () => ({}));
});
const rlMock = syn(['hit'], s => s.setExport('hit', async () => ({ok: true})));
const evMock = syn(['sessionOf', 'logActivity'], s => { s.setExport('sessionOf', () => null); s.setExport('logActivity', async () => {}); });
const nodeCrypto = await import('node:crypto');
const cryptoSyn = syn(['default'], s => s.setExport('default', nodeCrypto.default));
const cache = new Map();
const resolve = (spec, parent) => {
  if (spec === 'node:crypto') return cryptoSyn;
  if (spec.endsWith('/brain-auth.mjs')) return brainMock;
  if (spec.endsWith('/lib/auth.mjs') || spec === './auth.mjs') return authMock;
  if (spec.endsWith('/ratelimit.mjs')) return rlMock;
  if (spec.endsWith('/exports.mjs')) return xMock;
  if (spec.endsWith('/evidence.mjs')) return evMock;
  if (spec.startsWith('.')) return load(path.resolve(path.dirname(parent), spec));
  throw new Error('unexpected import ' + spec);
};
async function load(file) {
  if (cache.has(file)) return cache.get(file);
  const m = new vm.SourceTextModule(fs.readFileSync(file, 'utf8'), {context});
  cache.set(file, m);
  await m.link(spec => resolve(spec, file));
  return m;
}
const exportMod = await load(ROOT + 'netlify/functions/export.mjs');
const releasesMod = await load(ROOT + 'netlify/lib/research-releases.mjs');
await exportMod.evaluate();
const handler = exportMod.namespace.default;
const R = releasesMod.namespace;

function release(id, parcelId, at, mode, property, extra = {}) {
  const base = {id, type: 'property', state: 'MI', county: 'Wayne', parcelId, title: 'Approved record ' + id,
    description: 'Owner-approved record checked against the official county source.', evidenceUrl: 'https://www.waynecounty.com/treasurer',
    approvedForResearch: true, releaseMode: mode};
  if (mode === 'immediate_critical') Object.assign(base, {criticalConfirmed: true, criticalReason: 'Critical release for the export test, inaccurate data otherwise.'});
  return {...R.makeRelease(base, new Date(at), 'owner'), property, ...extra};
}
const info = async (who, ids) => {
  const r = await handler(new Request('https://preview.test/.netlify/functions/export', {method: 'POST', headers: {cookie: 'sess=' + who},
    body: JSON.stringify({action: 'info', items: ids.map(i => ({i, d: 'MI-wayne'}))})}));
  return r.json();
};
const prop = over => ({category: 'land_bank', address: '5 New St', ownerName: null, amount: 1000, acreage: null, point: null, ring: null, bb: null, ...over});

test('a Pro download includes an approved new parcel; a parcel that is not approved stays missing', async () => {
  store.set('approved-research-releases-v1', {schemaVersion: 1, list: [release('rel-new-0001', 'NEW-1', T0, 'pro_first_48h', prop())]});
  NOW = T0;
  const out = await info('pro', ['MI|Wayne|NEW-1|', 'MI|Wayne|NOPE-9|']);
  assert.equal(out.rows.length, 1);
  assert.equal(out.rows[0].address, '5 New St');
  assert.deepEqual(out.missing, ['MI|Wayne|NOPE-9|']);
});

test('an approved correction updates the downloaded fields of an existing parcel', async () => {
  store.set('approved-research-releases-v1', {schemaVersion: 1, list: [release('rel-cor-0001', '01-002263', T0, 'pro_first_48h', prop({category: 'tax_deed', address: null, amount: 12000}))]});
  NOW = T0;
  const out = await info('pro', ['MI|Wayne|01002263|']);
  assert.equal(out.rows[0].amount, 12000, 'corrected amount');
  assert.equal(out.rows[0].address, '90 Chandler', 'fields the correction does not carry are kept');
  assert.equal(out.rows[0].verified, true);
});

test('a withdrawn approval never reaches a download, and the static record is returned unchanged', async () => {
  const withdrawn = release('rel-wd-00001', '01002263', T0, 'immediate_critical', prop({category: 'tax_deed', amount: 1}), {withdrawn: true});
  store.set('approved-research-releases-v1', {schemaVersion: 1, list: [withdrawn, release('rel-wd-00002', 'NEW-3', T0, 'immediate_critical', prop(), {withdrawn: true})]});
  NOW = T0 + 100 * H;
  const out = await info('pro', ['MI|Wayne|01002263|', 'MI|Wayne|NEW-3|']);
  assert.equal(out.rows.length, 1);
  assert.equal(out.rows[0].amount, 14500);
  assert.deepEqual(out.missing, ['MI|Wayne|NEW-3|']);
});

test('an approval that is not yet released to the viewer is not downloadable', async () => {
  // Released in the future: nobody sees it yet, Pro included.
  store.set('approved-research-releases-v1', {schemaVersion: 1, list: [release('rel-fut-0001', 'NEW-4', T0 + 10 * H, 'pro_first_48h', prop())]});
  NOW = T0;
  const out = await info('pro', ['MI|Wayne|NEW-4|']);
  assert.equal(out.rows.length, 0);
});
