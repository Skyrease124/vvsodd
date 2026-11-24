// The free-access end for released records: the latest pro release plus 48 hours, for live releases of one county.
// Pure: no network. Run from the repo root: node --test tests/release-window.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {releaseWindowFor, PRO_EARLY_ACCESS_MS} from '../netlify/lib/research-releases.mjs';

const ROCHESTER = {state: 'NY', county: 'City of Rochester'};
const rel = (proReleaseAt, extra = {}) => ({state: 'NY', county: 'City of Rochester', proReleaseAt, releaseMode: 'pro_first_48h', ...extra});

test('the free-access end is the latest pro release plus 48 hours, counting only live releases of that county', () => {
  const releases = [
    rel('2026-11-24T02:00:00.000Z'),
    rel('2026-11-24T03:30:00.000Z'),
    rel('2026-11-30T00:00:00.000Z', {withdrawn: true}),
    rel('2026-11-29T00:00:00.000Z', {state: 'IA', county: 'Scott'}),
  ];
  const w = releaseWindowFor(releases, ROCHESTER);
  assert.equal(w.releases, 2);
  assert.equal(w.latestProReleaseAt, '2026-11-24T03:30:00.000Z');
  assert.equal(w.latestFreeReleaseAt, new Date(Date.parse('2026-11-24T03:30:00.000Z') + PRO_EARLY_ACCESS_MS).toISOString());
});

test('an immediate critical release is free at once, and no release gives no end', () => {
  const w = releaseWindowFor([rel('2026-11-24T02:00:00.000Z', {releaseMode: 'immediate_critical'})], ROCHESTER);
  assert.equal(w.latestFreeReleaseAt, '2026-11-24T02:00:00.000Z');
  assert.deepEqual(releaseWindowFor([], ROCHESTER), {releases: 0, latestProReleaseAt: null, latestFreeReleaseAt: null});
});
