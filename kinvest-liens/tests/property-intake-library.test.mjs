// Repo test for the pure rules of the property intake library (netlify/lib/property-intake.mjs).
// No network and no store: every function is called directly.
// Run from the repo root: node kinvest-liens/tests/property-intake-library.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSubmission, validateBatch, findDuplicate, newItem, verifyItem, approveItem, rejectItem, httpsUrl, releaseIdFor, MAX_BATCH} from '../../netlify/lib/property-intake.mjs';

const NOW = new Date('2026-11-24T09:00:00.000Z');
const good = {kind: 'new_property', category: 'land_bank', origin: 'owner-manual', state: 'fl', county: 'Palm Beach', parcelId: 'PB-100200',
  title: '  Parcel   record update  ', description: 'Official county record reviewed against the source.'};

test('a valid item is normalised: state upper-cased, spaces collapsed and trimmed', () => {
  const v = validateSubmission(good);
  assert.equal(v.ok, true);
  assert.equal(v.item.state, 'FL');
  assert.equal(v.item.title, 'Parcel record update');
});

test('unknown kind, origin, state, county and parcel are refused', () => {
  assert.equal(validateSubmission({...good, kind: 'deed_of_everything'}).ok, false);
  assert.equal(validateSubmission({...good, origin: 'random-website'}).ok, false);
  assert.equal(validateSubmission({...good, state: 'XX'}).ok, false, 'unsupported state');
  assert.equal(validateSubmission({...good, county: 'P'}).ok, false, 'county too short');
  assert.equal(validateSubmission({...good, county: 'Bad<script>'}).ok, false, 'county with markup');
  assert.equal(validateSubmission({...good, parcelId: 'PB'}).ok, false, 'parcel too short');
  assert.equal(validateSubmission({...good, parcelId: 'PB;DROP'}).ok, false, 'parcel with a symbol');
});

test('title and description minimum lengths are enforced', () => {
  assert.equal(validateSubmission({...good, title: 'short'}).ok, false);
  assert.equal(validateSubmission({...good, description: 'too short'}).ok, false);
  assert.equal(validateSubmission({...good, description: 'x'.repeat(2000)}).item.description.length, 1400, 'description is clipped');
});

test('a tax lien update needs its certificate number; a deed or property update does not', () => {
  const lien = {...good, kind: 'tax_lien', title: 'Lien certificate update', origin: 'county-dataset'};
  assert.equal(validateSubmission(lien).ok, false);
  assert.equal(validateSubmission({...lien, certificateNumber: '2026-0042'}).ok, true);
  assert.equal(validateSubmission({...good, kind: 'tax_deed'}).ok, true);
});

test('a source link must be HTTPS, without credentials or a port', () => {
  assert.equal(httpsUrl('https://www.pbcgov.org/records'), 'https://www.pbcgov.org/records');
  assert.equal(httpsUrl('http://www.pbcgov.org/records'), null);
  assert.equal(httpsUrl('https://user:pw@www.pbcgov.org/records'), null);
  assert.equal(httpsUrl('https://www.pbcgov.org:8443/records'), null);
  assert.equal(httpsUrl('javascript:alert(1)'), null);
  assert.equal(httpsUrl('not a url'), null);
  assert.equal(validateSubmission({...good, sourceUrl: 'http://www.pbcgov.org'}).ok, false);
});

test('a batch is refused whole when any item is bad, and names the first errors', () => {
  const bad = validateBatch([good, {...good, parcelId: 'x'}]);
  assert.equal(bad.ok, false);
  assert.match(bad.error, /Item 2/);
  assert.equal(validateBatch([]).ok, false);
  assert.equal(validateBatch(Array.from({length: MAX_BATCH + 1}, () => good)).ok, false, 'above the batch limit');
  assert.equal(validateBatch([good, {...good, parcelId: 'PB-300400'}]).items.length, 2);
});

test('a duplicate is an identical open item or an identical live release; a withdrawn release is not a duplicate', () => {
  const open = newItem(validateSubmission(good).item, {now: NOW, actor: 'owner'});
  assert.match(findDuplicate([open], [], validateSubmission(good).item).why, /awaiting review/);
  const live = {id: 'rel-1', type: 'property', state: 'FL', county: 'Palm Beach', parcelId: 'PB-100200', title: 'Parcel record update', withdrawn: false};
  assert.match(findDuplicate([], [live], validateSubmission(good).item).why, /already released/);
  assert.equal(findDuplicate([], [{...live, withdrawn: true}], validateSubmission(good).item), null);
  assert.equal(findDuplicate([], [], validateSubmission({...good, parcelId: 'PB-999999'}).item), null);
});

test('verification needs an HTTPS source, both checks and notes of at least 15 characters', () => {
  const item = newItem(validateSubmission(good).item, {now: NOW, actor: 'owner'});
  const ok = {evidenceUrl: 'https://www.pbcgov.org/records', notes: 'Checked the official record.', checklist: {officialSource: true, identityMatched: true}, now: NOW, actor: 'owner'};
  assert.equal(verifyItem(item, {...ok, evidenceUrl: 'http://www.pbcgov.org'}).error, 400);
  assert.equal(verifyItem(item, {...ok, checklist: {officialSource: true, identityMatched: false}}).error, 400);
  assert.equal(verifyItem(item, {...ok, notes: 'too short'}).error, 400);
  assert.equal(verifyItem(item, ok).item.status, 'awaiting_approval');
});

test('a critical release needs confirmation and a reason of at least 40 characters, and the mode must be known', () => {
  const item = {...newItem(validateSubmission(good).item, {now: NOW, actor: 'owner'}), status: 'awaiting_approval',
    verification: {evidenceUrl: 'https://www.pbcgov.org/records', notes: 'Checked the official record.', verifiedAt: NOW.toISOString()}};
  assert.equal(approveItem(item, {releaseMode: 'immediate_critical', criticalReason: 'x'.repeat(39), criticalConfirmed: true, now: NOW, actor: 'owner'}).error, 400);
  assert.equal(approveItem(item, {releaseMode: 'immediate_critical', criticalReason: 'x'.repeat(40), criticalConfirmed: false, now: NOW, actor: 'owner'}).error, 400);
  assert.equal(approveItem(item, {releaseMode: 'everyone_later', now: NOW, actor: 'owner'}).error, 400);
  const standard = approveItem(item, {releaseMode: 'pro_first_48h', now: NOW, actor: 'owner'});
  assert.equal(standard.item.status, 'released');
  assert.equal(standard.release.releaseMode, 'pro_first_48h');
});

test('a rejection works only on open items and needs a reason of at least 15 characters', () => {
  const open = newItem(validateSubmission(good).item, {now: NOW, actor: 'owner'});
  assert.equal(rejectItem(open, {notes: 'short', now: NOW, actor: 'owner'}).error, 400);
  assert.equal(rejectItem(open, {notes: 'Source is a third-party site.', now: NOW, actor: 'owner'}).item.status, 'rejected');
  assert.equal(rejectItem({...open, status: 'released'}, {notes: 'Source is a third-party site.', now: NOW, actor: 'owner'}).error, 409);
});

test('the release id is derived from the item id, so a retry cannot create a second release', () => {
  assert.equal(releaseIdFor('11111111-1111-4111-8111-111111111111'), 'rel-11111111-1111-4111-8111-111111111111');
  assert.equal(releaseIdFor('abc'), releaseIdFor('abc'));
});
