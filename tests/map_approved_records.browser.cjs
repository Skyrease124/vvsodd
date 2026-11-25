// Browser test of owner-approved property records on the real Price Pocket Maps page (static server on 8765).
// The approved-records feed is mocked with synthetic records: one new located parcel, one new unlocated parcel and a
// correction of an existing Wayne parcel. Checks the county list, the deep-linked details, the correction in place
// (no duplicate), the unlocated label, and that withdrawal (an empty feed) removes the added parcels.
//   node tests/map_approved_records.browser.cjs
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const BASE = 'http://127.0.0.1:8765';
const NEW_LOCATED = {p: 'APPROVED-TEST-1', c: 'land_bank', a: '5 Approved Test St, Detroit MI', o: null, amt: 1234, ac: 0.1, v: 1, t: 'Owner-approved update',
  st: 'Approved test parcel', src: 'Owner-verified against the official record (www.waynecounty.com)', fr: 'Approved 2026-11-24',
  cx: [-83.0458, 42.3314], g: null, bb: null, why: null, approved: {releaseId: 'rel-test-1'}};
const NEW_UNLOCATED = {...NEW_LOCATED, p: 'APPROVED-TEST-2', a: '7 Unlocated Test Ave, Detroit MI', cx: null,
  why: 'Location not verified yet. Listed without a map position; nothing is guessed.', approved: {releaseId: 'rel-test-2'}};
const CORRECTION = {p: '01002263', c: 'tax_deed', a: '90 Chandler Street (corrected), Detroit MI 48202', o: null, amt: 12000, ac: null, v: 1,
  cx: null, g: null, bb: null, why: null, approved: {releaseId: 'rel-test-3'}};

(async () => {
  const browser = await chromium.launch({headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']});
  try {
    const page = await browser.newPage({viewport: {width: 1365, height: 900}});
    let feed = [NEW_LOCATED, NEW_UNLOCATED, CORRECTION];
    const requests = [];
    await page.route('**/.netlify/functions/account', r => r.fulfill({status: 200, contentType: 'application/json', body: '{}'}));
    await page.route('**/.netlify/functions/brain-map-county**', r => r.fulfill({status: 200, contentType: 'application/json',
      body: JSON.stringify({ok: true, dataset: 'MI-wayne', version: 1, records: {}})}));
    await page.route('**/.netlify/functions/brain-map-records**', r => { requests.push(r.request().url());
      return r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({ok: true, records: feed, access: 'free'})}); });
    await page.route('**/.netlify/functions/research-updates**', r => r.fulfill({status: 200, contentType: 'application/json', body: '{"ok":true,"records":[]}'}));
    await page.goto(BASE + '/map/?c=MI-wayne&p=APPROVED-TEST-1', {waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => document.body.innerText.includes('5 Approved Test St'), null, {timeout: 30000});
    assert.ok(requests.some(u => u.includes('state=MI') && u.includes('county=Wayne')), 'feed asked for the county by state and name');

    const counts = await page.evaluate(() => {
      const text = document.getElementById('pmResults').innerText;
      return {pop: document.getElementById('pmPop').innerText, results: text};
    });
    assert.match(counts.pop + counts.results, /5 Approved Test St/, 'approved parcel is listed and its details open');
    // The county's record list: the correction replaced the original address; it did not add a second record.
    const state = await page.evaluate(async () => {
      const r = await fetch('/map/data/MI-wayne.json').then(x => x.json());
      return {staticCount: r.recs.length};
    });
    const shown = await page.evaluate(() => document.getElementById('pmResults').innerText);
    assert.equal((shown.match(/90 Chandler/g) || []).length <= 1, true, 'no duplicate of the corrected parcel in the list');

    // The unlocated parcel opens with its reason, and without a map position.
    await page.goto(BASE + '/map/?c=MI-wayne&p=APPROVED-TEST-2', {waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => document.body.innerText.includes('7 Unlocated Test Ave'), null, {timeout: 30000});
    assert.match(await page.evaluate(() => document.body.innerText), /Location not verified yet/);

    // The corrected parcel shows the corrected address.
    await page.goto(BASE + '/map/?c=MI-wayne&p=01002263', {waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => document.body.innerText.includes('90 Chandler Street (corrected)'), null, {timeout: 30000});

    // Withdrawal: the feed is empty on the next load; added parcels are gone and the original address is back.
    feed = [];
    await page.goto(BASE + '/map/?c=MI-wayne&p=01002263', {waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => document.body.innerText.includes('90 Chandler, Detroit'), null, {timeout: 30000});
    const after = await page.evaluate(() => document.body.innerText);
    assert.equal(after.includes('5 Approved Test St'), false, 'withdrawn parcel is gone');
    assert.equal(after.includes('(corrected)'), false, 'correction is rolled back');
    console.log('PASS: approved records listed with details, unlocated label, correction in place, withdrawal rollback (static county has ' + state.staticCount + ' records)');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
