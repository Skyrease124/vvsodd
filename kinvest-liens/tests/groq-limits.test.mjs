// One shared Groq allowance for the connection test and triage. Pure: a fake counter, no network, no key.
// Run from the repo root: node --test kinvest-liens/tests/groq-limits.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {groqCaps, reserveGroq, groqUsedToday, GROQ_CEILING, GROQ_DAILY_KEY, GROQ_MINUTE_KEY} from '../../netlify/lib/groq-limits.mjs';

function fakeRL() {
  const counts = new Map(), calls = [];
  return {calls,
    hit: async (k, limit) => { calls.push(k); const n = counts.get(k) || 0; if (n >= limit) return {ok: false}; counts.set(k, n + 1); return {ok: true}; },
    peek: async (k, limit) => { const n = counts.get(k) || 0; return {ok: n < limit, used: n}; }};
}

test('the owner caps apply but never above the reviewed ceiling', () => {
  assert.deepEqual(GROQ_CEILING, {daily: 10, minute: 2});
  assert.deepEqual(groqCaps(null), {enabled: true, daily: 10, minute: 2}, 'the default 800 and 20 are clamped');
  assert.deepEqual(groqCaps({groqDailyCap: 3, groqMinuteCap: 1}), {enabled: true, daily: 3, minute: 1});
  assert.equal(groqCaps({groqDailyCap: 0}).enabled, false, 'a zero daily cap switches Groq off');
  assert.equal(groqCaps({groqEnabled: false}).enabled, false);
  assert.equal(groqCaps({groqDailyCap: 'x', groqMinuteCap: -5}).daily, 0);
  assert.equal(groqCaps({groqMinuteCap: 0}).minute, 1, 'at least one per minute');
});

test('the connection test and triage draw on the same counters', async () => {
  const RL = fakeRL(), caps = groqCaps({groqDailyCap: 3, groqMinuteCap: 2});
  assert.equal((await reserveGroq(RL, caps)).ok, true);   // a connection test
  assert.equal((await reserveGroq(RL, caps)).ok, true);   // a triage
  assert.equal(await groqUsedToday(RL, caps), 2);
  const third = await reserveGroq(RL, caps);              // the minute counter is 2, so this stops there
  assert.equal(third.ok, false); assert.match(third.error, /per-minute/);
  assert.deepEqual([...new Set(RL.calls)].sort(), [GROQ_DAILY_KEY, GROQ_MINUTE_KEY].sort(), 'only the two shared counters are used');
});

test('the daily limit is reported first and counts every user of the allowance', async () => {
  const RL = fakeRL(), caps = {enabled: true, daily: 1, minute: 2};
  assert.equal((await reserveGroq(RL, caps)).ok, true);
  const next = await reserveGroq(RL, caps);
  assert.equal(next.ok, false); assert.match(next.error, /daily limit reached \(1 per day\)/);
});

test('both Groq callers use the shared module and no private counter', () => {
  for (const file of ['netlify/functions/ownerkeys.mjs', 'netlify/functions/owner-brain-research.mjs']) {
    const text = fs.readFileSync(file, 'utf8');
    assert.match(text, /groq-limits\.mjs/, file);
    assert.equal(/owner-brain-groq-(daily|minute)|RL\.hit\('owner-groq/.test(text), false, file + ' keeps no counter of its own');
  }
});
