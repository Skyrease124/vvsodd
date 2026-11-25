// Release policy for owner-approved updates: exact 48-hour boundaries, critical release, withdrawal,
// legacy visibility, and the research release rules that share the same policy.
import test from 'node:test';
import assert from 'node:assert/strict';
import {PRO_EARLY_ACCESS_MS, releaseTimes, visibleTo} from '../../netlify/lib/update-release.mjs';
import {audienceFor, makeRelease, isProAccount, RELEASE_TYPES} from '../../netlify/lib/research-releases.mjs';

const T0 = '2026-11-23T12:00:00.000Z';
const t0 = Date.parse(T0);
const H = 3600e3;

test('the Pro-first window is exactly 48 hours from owner approval', () => {
 assert.equal(PRO_EARLY_ACCESS_MS, 48 * H);
 const times = releaseTimes({approvedAt: T0});
 assert.equal(times.proReleaseAt, T0);
 assert.equal(Date.parse(times.freeReleaseAt), t0 + 48 * H);
 assert.equal(times.releaseMode, 'pro_first_48h');
});

test('a critical release frees the window at approval time', () => {
 const times = releaseTimes({approvedAt: T0, releaseMode: 'immediate_critical'});
 assert.equal(times.freeReleaseAt, times.proReleaseAt);
});

test('release times reject a missing or malformed approval time and an unknown mode', () => {
 assert.throws(() => releaseTimes({}), /Owner approval time/);
 assert.throws(() => releaseTimes({approvedAt: '2026-11-23'}), /Owner approval time/);
 assert.throws(() => releaseTimes({approvedAt: 'not a time'}), /Owner approval time/);
 assert.throws(() => releaseTimes({approvedAt: T0, releaseMode: 'everyone-later'}), /Unknown release mode/);
});

test('visibility for a Pro-first correction: Pro at approval, Free only after 48 hours', () => {
 const item = releaseTimes({approvedAt: T0});
 assert.equal(visibleTo(item, {pro: true, nowMs: t0}), true, 'Pro sees it at approval');
 assert.equal(visibleTo(item, {pro: false, nowMs: t0}), false, 'Free does not');
 assert.equal(visibleTo(item, {pro: false, nowMs: t0 + 48 * H - 1}), false, 'Free still waits one millisecond before 48 hours');
 assert.equal(visibleTo(item, {pro: false, nowMs: t0 + 48 * H}), true, 'Free sees it at exactly 48 hours');
 assert.equal(visibleTo(item, {pro: true, nowMs: t0 - 1}), false, 'nothing is visible before approval');
});

test('visibility for a critical release is open to everyone at approval', () => {
 const item = releaseTimes({approvedAt: T0, releaseMode: 'immediate_critical'});
 assert.equal(visibleTo(item, {pro: false, nowMs: t0}), true);
});

test('withdrawn items are never visible, to anyone', () => {
 const item = {...releaseTimes({approvedAt: T0}), withdrawn: true};
 assert.equal(visibleTo(item, {pro: true, nowMs: t0 + 999 * H}), false);
 assert.equal(visibleTo({withdrawn: true}, {pro: true, nowMs: t0}), false);
});

test('items published before the release policy stay visible to everyone', () => {
 assert.equal(visibleTo({i: 'legacy'}, {pro: false, nowMs: t0 - 5 * H}), true);
});

test('malformed release fields fail closed', () => {
 assert.equal(visibleTo({releaseMode: 'pro_first_48h', proReleaseAt: 'bad', freeReleaseAt: 'bad'}, {pro: true, nowMs: t0 + 999 * H}), false);
});

test('research releases use the same window and support a critical release', () => {
 const start = t0;
 const pro = {paidThrough: '2026-12-31'};
 const timed = {type: 'land', researchOnly: true, availableForPurchase: false, reviewApproved: true, publicationApproved: true, proReleaseAt: T0};
 assert.equal(audienceFor(timed, pro, start), 'pro');
 assert.equal(audienceFor(timed, null, start), 'none');
 assert.equal(audienceFor(timed, null, start + 48 * H - 1), 'none');
 assert.equal(audienceFor(timed, null, start + 48 * H), 'free');
 const critical = {...timed, releaseMode: 'immediate_critical'};
 assert.equal(audienceFor(critical, null, start), 'free');
 assert.equal(audienceFor({...timed, releaseMode: 'surprise'}, null, start), 'none', 'an unknown mode is not released');
 assert.equal(isProAccount({owner: true}), true);
});

test('a withdrawn research release is invisible to every viewer', () => {
 const item = {type: 'land', researchOnly: true, availableForPurchase: false, reviewApproved: true, publicationApproved: true,
  proReleaseAt: T0, withdrawn: true};
 assert.equal(audienceFor(item, {owner: true}, t0 + 999 * H), 'none');
 assert.equal(audienceFor(item, null, t0 + 999 * H), 'none');
});

test('creating a critical research release needs confirmation and a real reason', () => {
 const base = {id: 'rel-x', type: 'land', state: 'FL', county: 'Palm Beach', parcelId: 'PB-1', title: 'Palm Beach land parcel update',
  description: 'Official county land record reviewed against the source.', evidenceUrl: 'https://www.pbcgov.org/records', approvedForResearch: true};
 assert.throws(() => makeRelease({...base, releaseMode: 'immediate_critical'}, new Date(t0), 'owner@example.com'), /critical release/);
 assert.throws(() => makeRelease({...base, releaseMode: 'immediate_critical', criticalConfirmed: true, criticalReason: 'short'}, new Date(t0), 'owner@example.com'), /critical release/);
 const ok = makeRelease({...base, releaseMode: 'immediate_critical', criticalConfirmed: true,
  criticalReason: 'The published owner name was inaccurate and could mislead bidders.'}, new Date(t0), 'owner@example.com');
 assert.equal(ok.releaseMode, 'immediate_critical');
 assert.equal(makeRelease(base, new Date(t0), 'owner@example.com').releaseMode, 'pro_first_48h');
});

test('tax deed and new property updates use the same release rules', () => {
 assert.equal(RELEASE_TYPES.has('tax_deed'), true);
 assert.equal(RELEASE_TYPES.has('property'), true);
 assert.throws(() => makeRelease({type: 'unsupported', state: 'FL', county: 'Palm Beach', parcelId: 'PB-1', title: 'x'.repeat(8),
  description: 'x'.repeat(30), evidenceUrl: 'https://example.gov/a', approvedForResearch: true}, new Date(t0), 'owner@example.com'), /Unsupported update type/);
});
