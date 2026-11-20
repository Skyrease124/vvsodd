import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { _handle, runLiens } from '../functions/ai.mjs';
import { _apply, _group, _score, cleanFilters, loadLiens } from '../functions/screen.mjs';
import { createUser, sessionCookie } from '../lib/auth.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ppa-ai-liens-'));
process.env.USERS_DIR = dir;
process.env.KEYSTORE_FILE = path.join(dir, 'keystore.json');
fs.writeFileSync(process.env.KEYSTORE_FILE, JSON.stringify({ key: 'local-test' }));
const email = 'ai-liens-test@example.test';
await createUser(email, 'local-test-password', true);
const cookie = (await sessionCookie(email)).split(';')[0];
const originalFetch = globalThis.fetch;
globalThis.fetch = () => { throw new Error('Lien test must run against local data'); };
after(() => { globalThis.fetch = originalFetch; fs.rmSync(dir, { recursive: true, force: true }); });

async function ask(question, options = {}) {
  const response = await _handle({ httpMethod: 'POST', headers: { cookie }, body: JSON.stringify({ question, ...options }) });
  assert.equal(response.statusCode, 200, response.body);
  return JSON.parse(response.body);
}

function assertLocation(result, county, state) {
  assert(result.results.length);
  assert(result.results.every(row => row.county === county && row.state === state));
  assert.deepEqual(result.search.counties, [{ county, state }]);
}

test('county-only searches use the source list, retain missing values, and report matching totals', async () => {
  for (const [name, county, state, sourceCount, total] of [
    ['Cochise County', 'Cochise', 'AZ', 11132, 11126],
    ['Mobile County', 'Mobile County', 'AL', 620, 619]
  ]) {
    const source = loadLiens(county);
    const byParcel = new Map(source.map(row => [row.parcel, row]));
    assert.equal(source.length, sourceCount);
    const d = await ask(name + ' liens');
    assertLocation(d, county, state);
    assert.equal(d.total, total);
    assert.equal(d.search.missingMarketValues, total);
    for (const row of d.results) {
      assert.equal(row.market, null);
      assert.equal(row.face, Math.round(byParcel.get(row.parcel).amount * 100) / 100);
    }
  }
});

test('explicit state and map state constrain the named county', async () => {
  for (const d of [
    await ask('Cochise County liens in Florida'),
    await ask('Cochise County liens', { states: ['FL'] })
  ]) {
    assert.match(d.answer, /Cochise County is in Arizona.*Florida/);
    assert.deepEqual(d.search.states, ['FL']);
    assert.deepEqual(d.search.counties, []);
    assert.deepEqual(d.results, []);
    assert.equal(d.total, 0);
  }
  assertLocation(await ask('Mobile County liens in AL'), 'Mobile County', 'AL');
});

test('reused county names require a state and empty county lists never fall back', async () => {
  const ambiguous = await ask('Show liens in Bay County');
  assert.match(ambiguous.answer, /more than one state.*Which state/);
  assert.deepEqual(ambiguous.results, []);
  assertLocation(await ask('Show liens in Bay County, Florida'), 'Bay', 'FL');
  for (const question of ['Show liens in Lee County, Florida', 'Show liens in Bay County, Michigan', 'Show liens in Neverland County, Florida']) {
    const d = await ask(question);
    assert.equal(d.total, 0);
    assert.deepEqual(d.search.counties, []);
    assert.equal(d.noData, true);
    assert.match(d.answer, /No lien list is loaded|could not identify/);
  }
});

test('tax amount boundaries retain missing market values and empty filtered searches stay in scope', async () => {
  const d = await ask('Cochise County liens under $1,000');
  assertLocation(d, 'Cochise', 'AZ');
  assert(d.results.every(r => r.face < 1000 && r.market === null));
  assert.equal(d.search.filters.maxFace, 1000);
  assert.deepEqual(d.search.filters.exclusive, ['maxFace']);
  assert.equal(d.total, 7812);
  const empty = await ask('Cochise County liens under $1');
  assert.equal(empty.total, 0);
  assert.equal(empty.noData, false);
  assert.deepEqual(empty.search.counties, [{ county: 'Cochise', state: 'AZ' }]);
});

test('cheapest Mobile liens and pagination use a stable sort and total', async () => {
  const pages = [];
  for (const offset of [0, 8, 616]) {
    const d = await ask('Show cheapest liens in Mobile County', { offset });
    assertLocation(d, 'Mobile County', 'AL');
    assert.equal(d.total, 619);
    assert.equal(d.pagination.offset, offset);
    assert.equal(d.pagination.nextOffset, offset === 616 ? null : offset + 8);
    assert.deepEqual(d.search.sorting, { field: 'face', order: 'asc', unknownLast: true });
    pages.push(...d.results);
  }
  assert.equal(pages.length, 19);
  assert.equal(new Set(pages.map(r => r.parcel)).size, pages.length);
  assert(pages.every((r, i) => !i || r.face >= pages[i - 1].face));
});

test('state-only results stay in Arizona and nationwide missing-value search covers multiple states', async () => {
  const d = await ask('Show tax liens across Arizona');
  assert.deepEqual(d.search.states, ['AZ']);
  assert.deepEqual(d.search.requestedCounties, []);
  assert(d.results.length && d.results.every(r => r.state === 'AZ'));
  assert(d.search.counties.every(r => r.state === 'AZ'));
  const nationwide = await ask('Show liens without market values');
  assert.deepEqual(nationwide.search.states, []);
  assert(nationwide.search.counties.some(r => r.state === 'AZ') && nationwide.search.counties.some(r => r.state === 'AL'));
  assert(nationwide.results.length && nationwide.results.every(r => r.market === null));
  assert.equal(nationwide.search.missingMarketValues, nationwide.total);
});

test('known values sort before unknown values in both directions, even on later pages', () => {
  const search = { scope: ['AZ'], counties: [], lien: {}, sortBy: 'value', limit: 5 };
  for (const order of ['asc', 'desc']) {
    const start = runLiens({ ...search, order });
    assert(start.rows.every(r => r.market != null));
    assert(start.rows.every((r, i) => !i || (order === 'asc' ? r.market >= start.rows[i - 1].market : r.market <= start.rows[i - 1].market)));
    const knownCount = start.total - start.search.missingMarketValues;
    const transition = runLiens({ ...search, order, offset: knownCount - 1 });
    assert(transition.rows[0].market != null);
    assert(transition.rows.slice(1).every(r => r.market === null));
  }
});

test('explicit known-value filters exclude nulls but keep low reported values', () => {
  const rows = _group([
    { parcel: 'missing', amount: 10 },
    { parcel: 'low', amount: 10, market: 100 },
    { parcel: 'larger', amount: 10, market: 300 },
    { parcel: 'partial', amount: null, market: 100 }
  ]).map(_score);
  assert.equal(rows[0].market, null);
  assert.equal(rows[0].coverage, null);
  assert.equal(rows[3].coverage, null);
  assert.deepEqual(_apply(rows, cleanFilters({ maxValue: 100, minFace: 0 }, [])).map(r => r.parcel), ['low']);
  assert.deepEqual(_apply(rows, cleanFilters({ minValue: 0, maxFace: 10 }, [])).map(r => r.parcel), ['low', 'larger']);
});

test('lists without tax amounts return null and stay out of explicit amount filters', () => {
  const search = { scope: ['GA'], counties: ['Bibb'], lien: {}, sortBy: 'face', order: 'asc', limit: 5 };
  const d = runLiens(search);
  assert(d.rows.length && d.rows.every(r => r.noPrice && r.face === null));
  assert.equal(runLiens({ ...search, lien: { maxFace: 1000 } }).total, 0);
});

test('Map AI defaults to the viewed county while explicit geography can override it', async () => {
  const county = await ask('Show cheapest liens', { states: ['AZ'], mapCounty: 'Cochise County' });
  assert.equal(county.total, 11126);
  assert(county.results.every(r => r.county === 'Cochise'));
  const explicit = await ask('Mobile County liens', { states: ['AZ'], mapCounty: 'Cochise County' });
  assert.match(explicit.answer, /does not match|Alabama/);
  const statewide = await ask('Show tax liens across Arizona', { states: ['AZ'], mapCounty: 'Cochise County' });
  assert(statewide.total > county.total);
});
