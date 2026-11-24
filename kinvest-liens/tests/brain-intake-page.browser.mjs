// Browser test of the owner Property intake, research withdrawal and live-check panels on the owner dashboard.
// Mocked endpoints carry synthetic records only. Run after the static server is up (see validate-map-polish.yml):
//   node --experimental-vm-modules kinvest-liens/tests/brain-intake-page.browser.mjs
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {chromium} = require('playwright');

const PAGE = 'http://127.0.0.1:8765/owner/brain/';
const DUMMY_KEY = 'test-dummy-key-not-a-credential-0000';
const NOW = '2026-11-23T10:00:00.000Z';
const FUTURE = '2026-11-25T10:00:00.000Z';
const base = {kind: 'new_property', kindLabel: 'New property information', state: 'FL', county: 'Palm Beach', parcelId: 'PB-100200',
  origin: 'owner-manual', description: 'Official county record reviewed against the source.', audit: [{at: NOW, action: 'submitted', by: 'owner', note: ''}],
  createdAt: NOW, createdBy: 'owner', releaseId: null, approval: null, verification: null, sourceUrl: null, certificateNumber: null, taxYear: null};
const ITEMS = [
  {...base, id: '11111111-1111-4111-8111-111111111111', title: 'Parcel awaiting check', status: 'awaiting_verification',
    property: {category: 'land_bank', address: '1 Test Way', ownerName: null, amount: 1000, acreage: null, hasCoordinates: true, hasBoundary: false}, locationVerified: false},
  // Hostile text: must render as plain text, never as an element.
  {...base, id: '22222222-2222-4222-8222-222222222222', title: 'Verified <img src=x onerror="window.__xss=1">', status: 'awaiting_approval',
    verification: {evidenceUrl: 'https://www.pbcgov.org/records/2', notes: 'Checked the record.', verifiedAt: NOW},
    property: {category: 'land_bank', address: '2 Test Way', ownerName: null, amount: null, acreage: null, hasCoordinates: false, hasBoundary: false}, locationVerified: false},
  {...base, id: '33333333-3333-4333-8333-333333333333', title: 'Released parcel', status: 'released',
    releaseId: 'rel-33333333-3333-4333-8333-333333333333', approval: {releaseMode: 'pro_first_48h', at: NOW}},
];
const RELEASES = [
  {id: 'rel-33333333-3333-4333-8333-333333333333', type: 'property', state: 'FL', county: 'Palm Beach', parcelId: 'PB-100200', title: 'Released parcel',
   releaseMode: 'pro_first_48h', proReleaseAt: NOW, freeReleaseAt: FUTURE, withdrawn: false, withdrawnAt: null, withdrawal: null,
   audit: [{at: NOW, action: 'released', by: 'owner', note: ''}]},
  {id: 'rel-44444444-4444-4444-8444-444444444444', type: 'lien', state: 'FL', county: 'Palm Beach', parcelId: 'PB-200300', title: 'Old withdrawn lien',
   releaseMode: 'pro_first_48h', proReleaseAt: '2026-11-01T12:00:00.000Z', freeReleaseAt: '2026-11-03T12:00:00.000Z', withdrawn: true,
   withdrawnAt: '2026-11-10T12:00:00.000Z', withdrawal: {reason: 'Duplicate of an earlier record.', at: '2026-11-10T12:00:00.000Z', by: 'owner'}, audit: []},
];
const LIVE = [
  {name: 'nvidia', label: 'NVIDIA chat check', cost: 'One chat request.', available: false, missing: 'NVIDIA key is not configured. Nothing was sent.', limitPerDay: 3, usedToday: 0, last: null},
  {name: 'geoapify', label: 'Geoapify geocode check', cost: 'One geocode request.', available: true, missing: null, limitPerDay: 5, usedToday: 0, last: null},
  {name: 'wayne_gis', label: 'Wayne County GIS layer check', cost: 'One metadata request.', available: true, missing: null, limitPerDay: null, usedToday: null, last: null},
  {name: 'intake_round_trip', label: 'Intake round trip (test item)', cost: 'Writes one test item.', available: true, missing: null, limitPerDay: 3, usedToday: 0, last: null},
];

// Installs the mocks and returns the list of writes the page sent.
async function install(page, {liveHidden = false, storage = 'preview-isolated'} = {}) {
  const writes = [];
  const live = structuredClone(LIVE);
  await page.route('**/.netlify/functions/**', async route => {
    const request = route.request();
    const name = new URL(request.url()).pathname.split('/').pop();
    const method = request.method();
    const json = (status, body) => route.fulfill({status, contentType: 'application/json', body: JSON.stringify(body), headers: {'Cache-Control': 'no-store'}});
    if (method === 'POST') writes.push({name, body: request.postDataJSON()});
    if (name === 'owner-property-intake') return method === 'GET' ? json(200, {ok: true, items: ITEMS, count: ITEMS.length, storage})
      : json(200, {ok: true, item: null, notice: 'Saved.', created: 0, duplicates: [], withdrawnAt: NOW});
    if (name === 'research-updates') return method === 'GET' ? json(200, {ok: true, releases: RELEASES}) : json(200, {ok: true, withdrawnAt: NOW});
    if (name === 'owner-brain-live-checks') {
      if (method === 'GET') return liveHidden ? json(404, {ok: false, error: 'Not available on this site.'}) : json(200, {ok: true, previewOnly: true, items: live});
      const result = {name: 'wayne_gis', outcome: 'ok', detail: 'Wayne County GIS answered layer metadata. No parcel was queried.', at: NOW};
      live[2].last = {outcome: result.outcome, detail: result.detail, at: NOW};
      return json(200, {ok: true, result});
    }
    // The dashboard gate opens only when the queue snapshot loads; an empty snapshot keeps the page to this test's panels.
    if (name === 'owner-brain-queue') return json(200, {ok: true, queue: [], status: 'idle', built: NOW, previewMode: true, updatedAt: NOW, automation: {state: 'idle'}});
    if (name === 'owner-brain-review') return json(200, {ok: true, entries: [], items: []});
    return json(404, {ok: false, error: 'not mocked'});
  });
  return writes;
}

const browser = await chromium.launch({headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']});
try {
  // 1. Layout, hostile text, and the approval order.
  {
    const context = await browser.newContext({viewport: {width: 1280, height: 900}});
    const page = await context.newPage();
    const writes = await install(page);
    await page.goto(PAGE, {waitUntil: 'domcontentloaded'});
    const intake = page.locator('#intakeList article');
    await intake.nth(0).waitFor();
    assert.equal(await intake.count(), 3, 'three intake cards');
    assert.equal(await page.evaluate(() => window.__xss), undefined, 'hostile title did not execute');
    assert.equal(await page.locator('#intakeList img').count(), 0, 'hostile title rendered as text, not an element');
    assert.match(await page.locator('#intakeList article').nth(1).innerText(), /Verified <img src=x/);
    assert.equal(await page.locator('#researchList article').count(), 2, 'two research releases');
    assert.equal(await page.locator('#researchList article').nth(1).getByRole('button', {name: /Withdraw/}).count(), 0, 'a withdrawn release has no withdraw button');
    assert.equal(await page.locator('#liveChecksPanel').isVisible(), true, 'live checks panel shows on the preview');
    const nvidiaCard = page.locator('#liveList article', {hasText: 'NVIDIA chat check'});
    assert.equal(await nvidiaCard.getByRole('button', {name: 'Run once…'}).isDisabled(), true, 'NVIDIA run is disabled without a key');
    const html = await page.content();
    assert.equal(html.includes(DUMMY_KEY) || /nvapi-/.test(html), false, 'no key-like value on the page');
    assert.equal(writes.length, 0, 'opening the page writes nothing');
    assert.match(await page.locator('#intakeStorage').innerText(), /isolated preview store/, 'storage banner confirms isolation before any write');
    assert.match(await page.locator('#intakeList article').nth(0).innerText(), /Coordinates supplied but not verified/);
    assert.match(await page.locator('#intakeList article').nth(1).innerText(), /No coordinates: it will be listed as an unlocated property/);
    await context.close();
  }

  // 2. Verification: the server-side rules are repeated in the form, and a valid submission sends the checklist.
  {
    const context = await browser.newContext({viewport: {width: 1280, height: 900}});
    const page = await context.newPage();
    const writes = await install(page);
    await page.goto(PAGE, {waitUntil: 'domcontentloaded'});
    const card = page.locator('#intakeList article', {hasText: 'Parcel awaiting check'});
    await card.getByRole('button', {name: 'Verify this item'}).click();
    await card.locator('.pi-form input[type=url]').fill('http://www.pbcgov.org/records/1');
    await card.locator('.pi-form textarea').fill('Checked the record and the parcel number.');
    await card.getByRole('button', {name: 'Save verification'}).click();
    assert.match(await card.locator('.pi-status').innerText(), /must start with https/, 'http source is refused on the page');
    assert.equal(writes.length, 0, 'nothing is sent for an http source');
    await card.locator('.pi-form input[type=url]').fill('https://www.pbcgov.org/records/1');
    await card.getByRole('button', {name: 'Save verification'}).click();
    assert.match(await card.locator('.pi-status').innerText(), /Tick both checks first/, 'both checks are required');
    assert.equal(writes.length, 0);
    await card.locator('.pi-form input[type=checkbox]').nth(0).check();
    await card.locator('.pi-form input[type=checkbox]').nth(1).check();
    assert.equal(await card.locator('.pi-form input[type=checkbox]').nth(2).isVisible(), true, 'location check shown for an item with coordinates');
    await card.locator('.pi-form input[type=checkbox]').nth(2).check();
    await card.getByRole('button', {name: 'Save verification'}).click();
    await page.waitForFunction(() => document.getElementById('intakeStatus').textContent.includes('Verified'));
    const sent = writes.find(w => w.body && w.body.action === 'verify');
    assert.ok(sent, 'verify was sent');
    assert.equal(sent.body.confirmed, true);
    assert.deepEqual(sent.body.checklist, {officialSource: true, identityMatched: true, locationVerified: true});
    assert.equal(sent.body.evidenceUrl, 'https://www.pbcgov.org/records/1');
    await context.close();
  }

  // 3. Approval: a critical release needs confirmation and a 40-character reason; the standard release needs the check.
  {
    const context = await browser.newContext({viewport: {width: 1280, height: 900}});
    const page = await context.newPage();
    const writes = await install(page);
    await page.goto(PAGE, {waitUntil: 'domcontentloaded'});
    const card = page.locator('#intakeList article', {hasText: 'Verified <img'});
    await card.getByRole('button', {name: 'Approve…'}).click();
    await card.getByRole('button', {name: 'Approve and release'}).click();
    assert.match(await card.locator('.pi-status').innerText(), /Tick the check first/);
    assert.equal(writes.length, 0);
    await card.locator('.pi-form select').selectOption('immediate_critical');
    await card.locator('.pi-form input[type=checkbox]').nth(1).check();
    await card.getByRole('button', {name: 'Approve and release'}).click();
    assert.match(await card.locator('.pi-status').innerText(), /critical release needs/, 'critical needs the confirmation and reason');
    assert.equal(writes.length, 0);
    await card.locator('.pi-form textarea').fill('The published record is wrong and could mislead bidders today.');
    await card.locator('.pi-form input[type=checkbox]').nth(0).check();
    await card.getByRole('button', {name: 'Approve and release'}).click();
    await page.waitForFunction(() => document.getElementById('intakeStatus').textContent.includes('everyone now'));
    const sent = writes.find(w => w.body && w.body.action === 'approve');
    assert.equal(sent.body.releaseMode, 'immediate_critical');
    assert.equal(sent.body.criticalConfirmed, true);
    assert.equal(sent.body.id, '22222222-2222-4222-8222-222222222222');
    await context.close();
  }

  // 4. Rejection needs a note.
  {
    const context = await browser.newContext({viewport: {width: 1280, height: 900}});
    const page = await context.newPage();
    const writes = await install(page);
    await page.goto(PAGE, {waitUntil: 'domcontentloaded'});
    const card = page.locator('#intakeList article', {hasText: 'Verified <img'});
    await card.getByRole('button', {name: 'Reject…'}).click();
    await card.getByRole('button', {name: /Reject: nothing is published/}).click();
    assert.match(await card.locator('.pi-status').innerText(), /at least 15 characters/);
    assert.equal(writes.length, 0);
    await card.locator('.pi-form textarea').fill('The source is a third-party site, not the county.');
    await card.getByRole('button', {name: /Reject: nothing is published/}).click();
    await page.waitForFunction(() => document.getElementById('intakeStatus').textContent.includes('Nothing was published'));
    assert.ok(writes.find(w => w.body && w.body.action === 'reject'), 'reject was sent');
    await context.close();
  }

  // 5. Withdrawal dialog: confirmation, reason of 15 characters, and the request sent to the intake endpoint.
  {
    const context = await browser.newContext({viewport: {width: 1280, height: 900}});
    const page = await context.newPage();
    const writes = await install(page);
    await page.goto(PAGE, {waitUntil: 'domcontentloaded'});
    const card = page.locator('#intakeList article', {hasText: 'Released parcel'});
    await card.getByRole('button', {name: 'Withdraw…'}).click();
    assert.equal(await page.locator('#withdrawDialog').evaluate(d => d.open), true, 'confirmation dialog opens');
    assert.match(await page.locator('#withdrawTitle').innerText(), /Withdraw: Released parcel/);
    await page.locator('#withdrawConfirm').click();
    assert.match(await page.locator('#withdrawError').innerText(), /at least 15 characters/);
    assert.equal(writes.length, 0, 'a short reason sends nothing');
    await page.locator('#withdrawReason').fill('Owner withdrew: the parcel number was copied in error.');
    await page.locator('#withdrawConfirm').click();
    await page.waitForFunction(() => !document.getElementById('withdrawDialog').open);
    const sent = writes.find(w => w.body && w.body.action === 'withdraw');
    assert.equal(sent.name, 'owner-property-intake');
    assert.equal(sent.body.reason, 'Owner withdrew: the parcel number was copied in error.');
    await context.close();
  }

  // 6. Research withdrawal uses the research endpoint, through the same dialog.
  {
    const context = await browser.newContext({viewport: {width: 1280, height: 900}});
    const page = await context.newPage();
    const writes = await install(page);
    await page.goto(PAGE, {waitUntil: 'domcontentloaded'});
    const card = page.locator('#researchList article', {hasText: 'Released parcel'});
    await card.getByRole('button', {name: /Withdraw from every viewer/}).click();
    await page.locator('#withdrawReason').fill('Withdrawn by owner from the research list.');
    await page.locator('#withdrawConfirm').click();
    await page.waitForFunction(() => !document.getElementById('withdrawDialog').open);
    const sent = writes.find(w => w.name === 'research-updates' && w.body && w.body.action === 'withdraw');
    assert.ok(sent, 'research withdraw was sent');
    assert.equal(sent.body.id, 'rel-33333333-3333-4333-8333-333333333333');
    await context.close();
  }

  // 7. Live check: one confirmed run; the request names the check and carries no key.
  {
    const context = await browser.newContext({viewport: {width: 1280, height: 900}});
    const page = await context.newPage();
    const writes = await install(page);
    await page.goto(PAGE, {waitUntil: 'domcontentloaded'});
    const card = page.locator('#liveList article', {hasText: 'Wayne County GIS layer check'});
    page.once('dialog', d => d.accept());
    await card.getByRole('button', {name: 'Run once…'}).click();
    await page.waitForFunction(() => document.querySelector('#liveList') && document.querySelector('#liveList').textContent.includes('answered layer metadata'));
    const sent = writes.find(w => w.name === 'owner-brain-live-checks');
    assert.deepEqual({action: sent.body.action, name: sent.body.name, confirmed: sent.body.confirmed}, {action: 'run', name: 'wayne_gis', confirmed: true});
    assert.equal(JSON.stringify(sent.body).includes('apiKey'), false);
    await context.close();
  }

  // 8. On a site where the live-check endpoint answers 404, the panel stays hidden.
  {
    const context = await browser.newContext({viewport: {width: 1280, height: 900}});
    const page = await context.newPage();
    await install(page, {liveHidden: true, storage: 'production'});
    await page.goto(PAGE, {waitUntil: 'domcontentloaded'});
    await page.waitForSelector('#intakeList article');
    assert.match(await page.locator('#intakeStorage').innerText(), /PRODUCTION/, 'production is announced before any write');
    assert.equal(await page.locator('#liveChecksPanel').isVisible(), false, 'live checks stay hidden where they are not available');
    await context.close();
  }
  console.log('PASS: intake layout and escaping, verification rules, approval rules, rejection, intake and research withdrawal dialogs, live checks and hidden panel');
} finally {
  await browser.close();
}
