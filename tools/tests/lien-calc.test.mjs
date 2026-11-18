// Run: node tools/tests/lien-calc.test.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const C = require('../../kinvest-liens/liens/lien-rules.js');
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('PASS', name); } catch (e) { fail++; console.log('FAIL', name, '\n   ', e.message); } };
const E = (h, asOf) => C.estimate(Object.assign({ status: 'open' }, h), { asOf });
const date = (r, k) => (r.dates.find(d => d.key === k) || {}).date;
const kind = (r, k) => (r.dates.find(d => d.key === k) || {}).kind;

// ---------- Florida ----------
t('FL: 5% minimum applies when bid-rate interest is less (2% bid, redeemed 6 months in)', () => {
  const r = E({ state: 'FL', paid: 1000, rate: 2, bought: '2026-06-02' }, '2026-11-15');
  assert.equal(r.monthsCharged, 6); assert.equal(r.floorApplied, true); assert.equal(r.interest, 50); assert.equal(r.total, 1050);
});
t('FL: bid-rate interest used when it exceeds the 5% minimum (18% bid, 12 months)', () => {
  const r = E({ state: 'FL', paid: 2000, rate: 18, bought: '2026-06-02' }, '2027-05-20');
  assert.equal(r.monthsCharged, 12); assert.equal(r.floorApplied, false); assert.equal(r.interest, 360); assert.equal(r.total, 2360);
});
t('FL: 0% bid is excluded from the 5% minimum', () => {
  const r = E({ state: 'FL', paid: 1000, rate: 0, bought: '2026-06-02' }, '2026-08-10');
  assert.equal(r.floorApplied, false); assert.equal(r.interest, 0); assert.equal(r.total, 1000);
});
t('FL: rate above the 18% statutory maximum raises a warning; non-quarter step warns', () => {
  const a = E({ state: 'FL', paid: 1000, rate: 19, bought: '2026-06-02' }, '2026-12-01'), b = E({ state: 'FL', paid: 1000, rate: 7.3, bought: '2026-06-02' }, '2026-12-01');
  assert.ok(a.warnings.some(w => /18%/.test(w))); assert.ok(b.warnings.some(w => /quarter/.test(w)));
});
t('FL: deadlines come from the statute (April 1 + 2 years; 7-year expiry), not purchase date + 24 months', () => {
  const r = E({ state: 'FL', paid: 1000, rate: 8, bought: '2026-06-02' }, '2026-11-15');
  assert.equal(date(r, 'deed'), '2028-04-01'); assert.equal(kind(r, 'deed'), 'statute');
  assert.equal(date(r, 'expire'), '2033-06-02'); assert.equal(kind(r, 'expire'), 'estimate');
  assert.notEqual(date(r, 'deed'), '2028-06-02');
});
t('FL: missing bid rate is reported and no total is invented', () => {
  const r = E({ state: 'FL', paid: 1000, rate: '', bought: '2026-06-02' }, '2026-11-15');
  assert.equal(r.total, null); assert.ok(r.missing.some(m => /bid rate/i.test(m)));
});
t('FL: county-entered deadline is labeled county-confirmed', () => {
  const r = E({ state: 'FL', paid: 1000, rate: 8, bought: '2026-06-02', countyDeadline: '2028-09-10' }, '2026-11-15');
  assert.equal(kind(r, 'county'), 'county'); assert.equal(date(r, 'county'), '2028-09-10');
});

// ---------- Arizona ----------
t('AZ: no minimum-interest rule (Florida rules are never applied)', () => {
  const r = E({ state: 'AZ', paid: 1000, rate: 3, bought: '2026-02-20' }, '2026-03-05');
  assert.equal(r.monthsCharged, 1); assert.equal(r.floorApplied, false); assert.equal(r.interest, 2.5); assert.equal(r.total, 1002.5);
});
t('AZ: redeemed in the purchase month earns no interest (starts first of the next month)', () => {
  const r = E({ state: 'AZ', paid: 1000, rate: 10, bought: '2026-02-20' }, '2026-02-27');
  assert.equal(r.monthsCharged, 0); assert.equal(r.interest, 0);
});
t('AZ: a fraction of a month counts as a whole month (Feb 20 buy, Aug 15 redeem = 6 months)', () => {
  const r = E({ state: 'AZ', paid: 5000, rate: 10, bought: '2026-02-20' }, '2026-08-15');
  assert.equal(r.monthsCharged, 6); assert.equal(r.interest, 250); assert.equal(r.total, 5250);
});
t('AZ: foreclosure window dates (3 years after sale; 10 years after end of the month acquired)', () => {
  const r = E({ state: 'AZ', paid: 5000, rate: 10, bought: '2026-02-20' }, '2026-08-15');
  assert.equal(date(r, 'fc'), '2029-02-20'); assert.equal(date(r, 'fclast'), '2036-02-28'); assert.equal(kind(r, 'fc'), 'statute');
});
t('AZ: rate above 16% warns', () => { assert.ok(E({ state: 'AZ', paid: 1000, rate: 17, bought: '2026-02-20' }, '2026-08-15').warnings.some(w => /16%/.test(w))); });

// ---------- Iowa ----------
t('Iowa: 2% a month, month of sale counts, rounded to the dollar (Jun 15 sale, Sep 10 redeem = 4 months)', () => {
  const r = E({ state: 'IA', paid: 1000, bought: '2026-06-15' }, '2026-09-10');
  assert.equal(r.monthsCharged, 4); assert.equal(r.interest, 80); assert.equal(r.total, 1080);
});
t('Iowa: interest is at least $1', () => {
  const r = E({ state: 'IA', paid: 20, bought: '2026-06-15' }, '2026-06-20');
  assert.equal(r.monthsCharged, 1); assert.equal(r.interest, 1);
});
t('Iowa: typed rate is ignored (fixed 24%) and a warning explains', () => {
  const r = E({ state: 'IA', paid: 1000, rate: 12, bought: '2026-06-15' }, '2026-09-10');
  assert.equal(r.interest, 80); assert.ok(r.warnings.some(w => /fixed/i.test(w)));
});
t('Iowa: notice may be served after 1 year 9 months; expiry is 90 days after completed service', () => {
  const r = E({ state: 'IA', paid: 1000, bought: '2026-06-15', deedApplied: '2028-04-03' }, '2026-09-10');
  assert.equal(date(r, 'notice'), '2028-03-15'); assert.equal(kind(r, 'notice'), 'statute');
  assert.equal(date(r, 'expire'), '2028-07-03'); // Apr 3 2028 + 90 days = Sun Jul 2 -> next business day
});
t('Iowa: 90th day on a weekend moves to the next business day', () => {
  const r = E({ state: 'IA', paid: 1000, bought: '2026-06-15', deedApplied: '2028-04-01' }, '2026-09-10'); // +90d = Fri Jun 30 2028
  assert.equal(date(r, 'expire'), '2028-06-30');
  const w = E({ state: 'IA', paid: 1000, bought: '2026-06-15', deedApplied: '2028-04-02' }, '2026-09-10'); // +90d = Sat Jul 1 2028 -> Mon Jul 3
  assert.equal(date(w, 'expire'), '2028-07-03');
});
t('Iowa: without a service date the expiry is reported as missing, not guessed', () => {
  const r = E({ state: 'IA', paid: 1000, bought: '2026-06-15' }, '2026-09-10');
  assert.equal(date(r, 'expire'), undefined); assert.ok(r.missing.some(m => /notice of expiration/i.test(m)));
});

// ---------- Colorado ----------
t('CO: portion of a month counts as a whole month (sale Nov 19 2026, redeem Mar 2 2027 = 4 months)', () => {
  const r = E({ state: 'CO', paid: 1000, rate: 13, bought: '2026-11-19' }, '2027-03-02');
  assert.equal(r.monthsCharged, 4); assert.equal(r.interest, 43.33); assert.equal(r.total, 1043.33); assert.equal(r.floorApplied, false);
});
t('CO: exactly six months is six, redeeming the day of sale is zero', () => {
  assert.equal(E({ state: 'CO', paid: 1000, rate: 13, bought: '2026-11-19' }, '2027-05-19').monthsCharged, 6);
  assert.equal(E({ state: 'CO', paid: 1000, rate: 13, bought: '2026-11-19' }, '2026-11-19').interest, 0);
  assert.equal(E({ state: 'CO', paid: 1000, rate: 13, bought: '2026-11-19' }, '2027-05-20').monthsCharged, 7);
});
t('CO: the year rate is required and listed as missing, never assumed', () => {
  const r = E({ state: 'CO', paid: 1000, rate: '', bought: '2026-11-19' }, '2027-03-02'); assert.equal(r.total, null); assert.ok(r.missing.some(m => /redemption interest rate/i.test(m)));
});
t('CO: no deed date is calculated (rules changed July 1, 2024); warns instead', () => {
  const r = E({ state: 'CO', paid: 1000, rate: 13, bought: '2026-11-19' }, '2027-03-02');
  assert.equal(r.dates.filter(d => d.kind === 'statute').length, 0); assert.ok(r.warnings.some(w => /July 1, 2024/.test(w))); assert.ok(r.warnings.some(w => /premium/i.test(w)));
});
t('CO: carries the statute edition used', () => { assert.match(E({ state: 'CO', paid: 1, rate: 1, bought: '2026-11-19' }, '2026-12-01').edition, /2024 edition/); });
t('CO rules never leak into Florida or Arizona results', () => {
  const fl = E({ state: 'FL', paid: 1000, rate: 2, bought: '2026-06-02' }, '2026-11-15'), az = E({ state: 'AZ', paid: 1000, rate: 10, bought: '2026-02-20' }, '2026-08-15');
  assert.equal(fl.floorApplied, true); assert.equal(az.interest, 50); assert.ok(!fl.warnings.concat(az.warnings).some(w => /premium bid/i.test(w)));
});

// ---------- Unverified states: basic estimate only ----------
for (const st of ['NJ', 'IL', 'TX']) t(st + ': labeled basic estimate, no statute dates, no Florida rules', () => {
  const r = E({ state: st, paid: 1000, rate: 3, bought: '2026-01-01', months: 24 }, '2026-07-02');
  assert.equal(r.verified, false); assert.equal(r.basis, 'basic'); assert.equal(r.floorApplied, false);
  assert.ok(/not verified/i.test(r.label)); assert.equal(r.interest, round(1000 * 0.03 * 182 / 365)); assert.equal(kind(r, 'basic'), 'basic');
  assert.ok(r.missing.some(m => /not yet verified/.test(m))); assert.equal(r.sources.length, 0);
});
t('Basic: matches the old simple-interest numbers so existing portfolios do not change value', () => {
  const r = E({ state: 'NJ', paid: 5000, rate: 18, bought: '2025-01-01' }, '2026-01-01');
  assert.equal(r.interest, 900);
});
t('Basic: missing rate is listed', () => { assert.ok(E({ state: 'NJ', paid: 5000, rate: '', bought: '2025-01-01' }, '2026-01-01').missing.some(m => /rate/i.test(m))); });

// ---------- Metadata ----------
t('Every verified state stores method, sources with URLs, and a verification date', () => {
  for (const [k, R] of Object.entries(C.RULES)) { assert.ok(R.method); assert.match(R.verifiedOn, /^\d{4}-\d{2}-\d{2}$/); assert.ok(R.sources.length >= 3); R.sources.forEach(s => assert.match(s.url, /^https:\/\//)); }
});
t('Disclaimer says projections are not guaranteed', () => { assert.match(C.NOT_ADVICE, /not guaranteed/i); });
function round(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
