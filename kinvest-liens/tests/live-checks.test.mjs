// Repo test for the owner live-check library (netlify/lib/live-checks.mjs). No network, no Netlify runtime:
// every helper is an injected fake, and the intake round trip runs against an in-memory versioned store.
// Run from the repo root: node --test kinvest-liens/tests/live-checks.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {runLiveCheck, summary, reserveOwnBudget, usedOwnBudget, scrub, intakeRoundTrip, LOG, COUNTER} from '../../netlify/lib/live-checks.mjs';
import {audienceFor} from '../../netlify/lib/research-releases.mjs';

const KEY = 'fake-key-value-7777-not-real';
const NOW = Date.parse('2026-11-23T10:00:00.000Z');

function memoryAuth() {
  const store = new Map();
  const version = new Map();
  const bump = k => version.set(k, (version.get(k) || 0) + 1);
  return {
    store,
    kvGet: async k => (store.has(k) ? structuredClone(store.get(k)) : null),
    kvPut: async (k, v) => { store.set(k, structuredClone(v)); bump(k); },
    kvGetVersioned: async k => (store.has(k) ? {data: structuredClone(store.get(k)), etag: String(version.get(k) || 0)} : null),
    kvPutVersioned: async (k, v, etag) => {
      const exists = store.has(k);
      if (etag === null ? exists : (!exists || String(version.get(k) || 0) !== etag)) return false;
      store.set(k, structuredClone(v)); bump(k); return true;
    },
  };
}

function fakeCheck(over = {}) {
  const calls = {run: 0, reserve: 0};
  const spec = {
    label: 'Fake check', cost: 'One fake request.', limit: 1, missing: 'Not configured. Nothing was sent.',
    available: async () => true,
    usedToday: async () => 0,
    reserve: async () => { calls.reserve++; },
    run: async () => { calls.run++; return {outcome: 'ok', detail: 'Answered.'}; },
    secrets: async () => [KEY],
    ...over,
  };
  return {spec, calls};
}

test('a check without its key is reported as not configured and sends nothing', async () => {
  const auth = memoryAuth();
  const {spec, calls} = fakeCheck({available: async () => false});
  const out = await runLiveCheck({auth, name: 'nvidia', checks: {nvidia: spec}, now: NOW});
  assert.equal(out.result.outcome, 'not_configured');
  assert.equal(calls.reserve, 0, 'no allowance is reserved');
  assert.equal(calls.run, 0, 'no request is sent');
});

test('a check stops at its daily allowance without sending another request', async () => {
  const auth = memoryAuth();
  const {spec, calls} = fakeCheck({reserve: async () => reserveOwnBudget(auth, 'geo', 1, NOW)});
  const first = await runLiveCheck({auth, name: 'geo', checks: {geo: spec}, now: NOW});
  assert.equal(first.result.outcome, 'ok');
  const second = await runLiveCheck({auth, name: 'geo', checks: {geo: spec}, now: NOW + 60e3});
  assert.equal(second.result.outcome, 'budget_limited');
  assert.equal(calls.run, 1, 'the second run sent nothing');
  assert.equal(await usedOwnBudget(auth, 'geo', NOW), 1);
  assert.equal(await usedOwnBudget(auth, 'geo', NOW + 24 * 3600e3), 0, 'the allowance resets on the next UTC day');
});

test('a failure is recorded as failed, and a key echoed in the message is scrubbed before it is stored', async () => {
  const auth = memoryAuth();
  const {spec} = fakeCheck({run: async () => ({outcome: 'failed', detail: 'Provider rejected ' + KEY + ' with HTTP 401.'})});
  const out = await runLiveCheck({auth, name: 'geo', checks: {geo: spec}, now: NOW});
  assert.equal(out.result.outcome, 'failed');
  assert.equal(out.result.detail.includes(KEY), false);
  assert.equal(JSON.stringify([...auth.store.values()]).includes(KEY), false, 'nothing stored contains the key');
});

test('a thrown error becomes a failed outcome with a fixed sentence and does not leak the error text', async () => {
  const auth = memoryAuth();
  const {spec} = fakeCheck({run: async () => { throw new Error('boom ' + KEY); }});
  const out = await runLiveCheck({auth, name: 'geo', checks: {geo: spec}, now: NOW});
  assert.equal(out.result.outcome, 'failed');
  assert.equal(out.result.detail, 'The check stopped before it returned a result.');
});

test('paused automation blocks every check and sends nothing', async () => {
  const auth = memoryAuth();
  const {spec, calls} = fakeCheck();
  const out = await runLiveCheck({auth, name: 'geo', checks: {geo: spec}, now: NOW, paused: true});
  assert.equal(out.status, 409);
  assert.equal(calls.run, 0);
});

test('an unknown check name is refused, including inherited property names', async () => {
  const auth = memoryAuth();
  const {spec} = fakeCheck();
  assert.equal((await runLiveCheck({auth, name: 'nope', checks: {geo: spec}, now: NOW})).status, 404);
  assert.equal((await runLiveCheck({auth, name: 'toString', checks: {geo: spec}, now: NOW})).status, 404);
});

test('the owner summary shows availability, limits and the last outcome, and never a key value', async () => {
  const auth = memoryAuth();
  const {spec} = fakeCheck({available: async () => true});
  await runLiveCheck({auth, name: 'geo', checks: {geo: spec}, now: NOW});
  const view = await summary({auth, checks: {geo: spec, other: fakeCheck({available: async () => false}).spec}, now: NOW});
  const text = JSON.stringify(view);
  assert.equal(text.includes(KEY), false);
  const geo = view.items.find(i => i.name === 'geo');
  assert.equal(geo.available, true);
  assert.equal(geo.last.outcome, 'ok');
  const other = view.items.find(i => i.name === 'other');
  assert.equal(other.available, false);
  assert.equal(other.missing, 'Not configured. Nothing was sent.');
});

test('a run stores at most the last 30 history rows and never a secret', async () => {
  const auth = memoryAuth();
  const {spec} = fakeCheck({limit: null, reserve: undefined});
  for (let i = 0; i < 35; i++) await runLiveCheck({auth, name: 'geo', checks: {geo: spec}, now: NOW + i * 1000});
  const saved = auth.store.get(LOG);
  assert.equal(saved.history.length, 30);
  assert.equal(JSON.stringify(saved).includes(KEY), false);
});

test('scrub removes given secrets and key-shaped fragments, and caps length', () => {
  assert.equal(scrub('value ' + KEY + ' end', [KEY]), 'value [redacted] end');
  assert.equal(scrub('apiKey=abc123 and token: xyz').includes('abc123'), false);
  assert.equal(scrub('x'.repeat(1000)).length, 300);
  assert.equal(scrub('Geoapify returned HTTP 401. Check the key, quota and restrictions.'), 'Geoapify returned HTTP 401. Check the key, quota and restrictions.');
});

test('the intake round trip passes Pro first, the 48-hour rule and withdrawal, and leaves no visible release', async () => {
  const auth = memoryAuth();
  const out = await intakeRoundTrip({auth, now: NOW});
  assert.equal(out.outcome, 'ok', out.detail);
  const list = auth.store.get('approved-research-releases-v1').list;
  assert.equal(list.length, 1);
  assert.equal(list[0].withdrawn, true);
  assert.equal(audienceFor(list[0], {paidThrough: '2999-12-31'}, Date.parse(list[0].proReleaseAt)), 'none', 'withdrawn release is hidden');
  const intake = auth.store.get('property-intake-v1').items;
  assert.equal(intake.length, 1);
  assert.equal(intake[0].status, 'withdrawn');
  assert.equal(intake[0].origin, 'live-check');
});

test('repeating the round trip creates a fresh item each time and keeps passing', async () => {
  const auth = memoryAuth();
  const first = await intakeRoundTrip({auth, now: NOW});
  const second = await intakeRoundTrip({auth, now: NOW + 3600e3});
  assert.equal(first.outcome, 'ok');
  assert.equal(second.outcome, 'ok');
  assert.equal(auth.store.get('property-intake-v1').items.length, 2);
  assert.equal(auth.store.get('approved-research-releases-v1').list.filter(r => !r.withdrawn).length, 0);
});

test('a check without a daily limit records its result in the live-check log and writes no counter', async () => {
  const auth = memoryAuth();
  const {spec} = fakeCheck({limit: null, reserve: undefined, run: async () => intakeRoundTrip({auth, now: NOW})});
  await runLiveCheck({auth, name: 'intake_round_trip', checks: {intake_round_trip: spec}, now: NOW});
  assert.ok(auth.store.has(LOG));
  assert.equal(auth.store.has(COUNTER), false, 'no counter is written when the check has no limit');
});
