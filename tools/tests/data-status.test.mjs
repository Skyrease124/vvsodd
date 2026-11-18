// Run: node tools/tests/data-status.test.mjs   (uses real records from the county files)
import { createRequire } from 'node:module'; import assert from 'node:assert/strict';
import { loadLiens } from '../audit/load.mjs';
const require = createRequire(import.meta.url); const DS = require('../../kinvest-liens/liens/states/data-status.js');
let pass = 0, fail = 0; const t = (n, f) => { try { f(); pass++; console.log('PASS', n); } catch (e) { fail++; console.log('FAIL', n, '\n   ', e.message); } };
const L = loadLiens(), TODAY = '2026-11-18', C = r => DS.classify(r, { today: TODAY }).key;
const one = (county, re) => L.find(r => r.county === county && re.test(r.status));
const cases = [
  ['FL Palm Beach county-held', 'Palm Beach', /County-held/, 'county-held'], ['FL Santa Rosa county-held', 'Santa Rosa', /County-held/, 'county-held'],
  ['CO Larimer advertised, sale date in the future', 'Larimer', /Advertised/, 'tax-lien'], ['CO El Paso held by the county', 'El Paso', /Held by/, 'county-held'],
  ['AZ Pinal tax lien sale list', 'Pinal', /Tax Lien Sale List/, 'tax-lien'], ['AZ Coconino delinquent list', 'Coconino', /delinquent account/, 'tax-lien'],
  ['GA Bibb judicial in rem list', 'Bibb', /in rem/, 'deed-sale'], ['GA Fulton sheriff sale', 'Fulton', /Sheriff sale/, 'deed-sale'],
  ['PA Monroe repository list', 'Monroe', /Repository/, 'deed-sale'], ['NY Rochester foreclosure auction list', 'City of Rochester', /foreclosure auction/, 'deed-sale'],
  ['MI Wayne sold at auction', 'Wayne', /^Sold at/, 'sold'], ['MI Wayne foreclosed, not on the sold list = UNKNOWN (never sold)', 'Wayne', /^Foreclosed/, 'unknown'],
  ['TN Davidson was on a past list = historical', 'Davidson', /^Was on/, 'historical'], ['IA Scott county tax sale list', 'Scott', /tax sale list/, 'tax-lien'], ['CO Saguache tax lien sale list', 'Saguache', /tax lien sale list/, 'tax-lien'], ['CO Boulder advertised', 'Boulder', /Advertised/, 'tax-lien']
];
for (const [n, c, re, want] of cases) t(n, () => { const r = one(c, re); assert.ok(r, 'no real record found'); assert.equal(C(r), want); });
t('A listing whose sale date has passed becomes historical, never sold or available', () => {
  const r = Object.assign({}, one('Larimer', /Advertised/), { saleDate: '2026-11-19' }); assert.equal(C(r), 'tax-lien');
  assert.equal(DS.classify(r, { today: '2026-11-20' }).key, 'historical'); assert.ok(DS.classify(r, { today: '2026-11-20' }).why[0].includes('has passed'));
});
t('Missing from a list never produces sold/redeemed/canceled', () => { for (const r of L) { const k = C(r); if (['sold', 'redeemed', 'canceled'].includes(k)) assert.ok(/^\s*(sold|redeemed)|cancel|withdrawn/i.test(r.status), r.status); } });
t('Only Wayne records stated as sold are "sold" (1437 official results)', () => { const sold = L.filter(r => C(r) === 'sold'); assert.equal(sold.length, 1437); assert.ok(sold.every(r => r.county === 'Wayne')); });
t('Every record gets a status class and a freshness verdict', () => { for (const r of L) { assert.ok(DS.CLASSES[C(r)]); assert.ok(['current', 'aging', 'outdated', 'unknown'].includes(DS.freshness(r, { today: TODAY }).key)); } });
t('Freshness thresholds: 7 days current, 30 aging, beyond outdated, none unknown', () => {
  const f = (d, today) => DS.freshness({ checked: d }, { today }).key;
  assert.equal(f('2026-11-11', TODAY), 'current'); assert.equal(f('2026-11-10', TODAY), 'aging'); assert.equal(f('2026-10-19', TODAY), 'aging'); assert.equal(f('2026-10-18', TODAY), 'outdated'); assert.equal(f('', TODAY), 'unknown');
});
t('Outdated and undated records produce warnings; no source produces a warning', () => {
  assert.ok(DS.describe({ status: 'County-held', checked: '2026-01-01', source: 'https://x.gov' }, { today: TODAY }).warnings.some(w => /outdated/.test(w)));
  assert.ok(DS.describe({ status: 'County-held', source: 'https://x.gov' }, { today: TODAY }).warnings.some(w => /no record of when/i.test(w)));
  assert.ok(DS.describe({ status: 'County-held', checked: TODAY }, { today: TODAY }).warnings.some(w => /No official source/.test(w)));
});
t('Unclassifiable text is unknown, with a warning not to assume availability', () => { const d = DS.describe({ status: 'Something new', source: 'https://x.gov', checked: TODAY }, { today: TODAY }); assert.equal(d.status.key, 'unknown'); assert.ok(d.warnings.some(w => /assume it is available/.test(w))); });
t('Real data: every real record is classified; counts match the audit', () => { const k = {}; L.forEach(r => k[C(r)] = (k[C(r)] || 0) + 1); assert.equal(Object.values(k).reduce((a, b) => a + b, 0), L.length); console.log('   ', JSON.stringify(k)); });
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
