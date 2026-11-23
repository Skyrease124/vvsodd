// Real-browser check of the County Connectors discovery panel, using mocked owner responses only.
// No live GIS requests and no live owner API calls. Run from the repository root:
//   CHROMIUM_PATH=/opt/pw-browsers/chromium node kinvest-liens/tests/county-discovery-panel.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('playwright');

const root = 'kinvest-liens/owner/brain/connectors/';
const origin = 'https://deploy-preview-454--pricepocketasset.netlify.app';
const base = '/owner/brain/connectors/';
const counties = [
  { id: 'CO-larimer', state: 'CO', county: 'Larimer', status: 'Connector Ready', operation: { mode: 'research-only' } },
  { id: 'AL-baldwin', state: 'AL', county: 'Baldwin', status: 'Researching' },
];
const detail = county => ({ county, coverage: { available: 0, mapped: 0, verified: 0, remaining: 0, completion: null }, operation: county.operation });

const verifiedCandidate = {
  id: 'CO-larimer|MapServices/Parcels|3', status: 'Verified', reasons: ['Sample parcel matched the official layer and its situs address'],
  service: { name: 'MapServices/Parcels', type: 'MapServer', url: 'https://maps1.larimer.org/arcgis/rest/services/MapServices/Parcels/MapServer' },
  layer: { id: 3, name: 'Parcels', url: 'https://maps1.larimer.org/arcgis/rest/services/MapServices/Parcels/MapServer/3' },
  fields: { parcel: 'PARCELNUM', address: 'LOCADDRESS' }, nativeWkid: 2876, nativeAliases: [],
  authority: { status: 'verified', basis: 'seed-declared-domain', host: 'maps1.larimer.org' },
  authorityUrl: 'https://www.larimer.gov/assessor', lastEditDate: null, currentness: 'unknown',
  sample: { outcome: 'matched', recordId: 'CO|Larimer|9524325120|', identifierForm: 'as-recorded', attempts: 1, checkedAt: '2026-11-23T07:28:40.000Z' },
  observedAt: '2026-11-23T07:28:36.000Z',
};
const blockedCandidate = {
  ...verifiedCandidate, id: 'CO-larimer|Other|0', status: 'Blocked',
  service: { name: 'Other', type: 'MapServer', url: 'https://maps1.larimer.org/arcgis/rest/services/Other/MapServer' },
  layer: { id: 0, name: 'Other layer', url: 'https://maps1.larimer.org/arcgis/rest/services/Other/MapServer/0' },
  reasons: ['Source unavailable or response unreadable'], sample: { outcome: 'error', code: 'transport_or_payload', message: 'Source unavailable or response unreadable', attempts: [] },
};
const discoveredResult = () => ({
  countyId: 'CO-larimer', county: 'Larimer', state: 'CO', status: 'Verified',
  reason: 'Sample parcel matched the official layer and its situs address', best: verifiedCandidate.id,
  candidates: [verifiedCandidate, blockedCandidate], rejected: [], notes: [], stopped: null,
  requests: { used: 4, cacheHits: 0, byStage: { 'list-services': 1, 'probe-layers': 1, schema: 1, parcel_verification: 1 } },
  daily: { used: 4, dailyLimit: 60 }, savedAt: '2026-11-23T07:28:41.000Z',
  map: { status: 'not-connected' },
});

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const unexpected = [], errors = [], discoverBodies = [], approveBodies = [];
  let discoveryMode = 'ok';
  let saved = null; // set by the mocked POST discover, like the server saving a result
  let used = 0;
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) { unexpected.push(url.href); return route.abort(); }
    if (url.pathname === base) return route.fulfill({ contentType: 'text/html', body: await fs.readFile(root + 'index.html', 'utf8') });
    if (url.pathname === base + 'dashboard.js') return route.fulfill({ contentType: 'text/javascript', body: await fs.readFile(root + 'dashboard.js', 'utf8') });
    if (url.pathname === base + 'dashboard.css') return route.fulfill({ contentType: 'text/css', body: await fs.readFile(root + 'dashboard.css', 'utf8') });
    if (url.pathname === '/.netlify/functions/owner-brain-connectors') {
      const id = url.searchParams.get('dataset');
      if (!id) return route.fulfill({ json: { counties } });
      const county = counties.find(c => c.id === id);
      return county ? route.fulfill({ json: detail(county) }) : route.fulfill({ status: 404, json: { error: 'missing' } });
    }
    if (url.pathname === '/.netlify/functions/owner-brain-larimer-trial') return route.fulfill({ status: 404, json: { error: 'not part of this check' } });
    if (url.pathname === '/.netlify/functions/owner-brain-discovery') {
      if (discoveryMode === 'missing') return route.fulfill({ status: 404, json: { ok: false, error: 'Deploy preview only' } });
      if (route.request().method() === 'GET') {
        return route.fulfill({ json: {
          ok: true, previewOnly: true, mapChanged: false,
          budget: { day: '2026-11-23', used, dailyLimit: 60, runLimit: 16, runUsed: 0 },
          counties: [{ id: 'CO-larimer', county: 'Larimer', state: 'CO', result: saved }],
          log: saved ? [{ at: '2026-11-23T07:28:41.000Z', type: 'gis-discovery', countyId: 'CO-larimer', status: 'Verified', requests: 4 }] : [],
        } });
      }
      const body = route.request().postDataJSON();
      if (body.action === 'discover') {
        discoverBodies.push(body);
        saved = discoveredResult();
        used += 4;
        return route.fulfill({ json: { ok: true, mapChanged: false, result: saved } });
      }
      if (body.action === 'approve-source') {
        approveBodies.push(body);
        saved = { ...saved, owner: { candidateId: body.candidateId, approvedAt: '2026-11-23T08:00:00.000Z', mapStatus: 'not-connected' } };
        return route.fulfill({ json: { ok: true, mapChanged: false, requests: 0, result: saved } });
      }
      return route.fulfill({ status: 400, json: { ok: false, error: 'Unknown action' } });
    }
    if (url.pathname !== '/favicon.ico') unexpected.push(url.pathname);
    return route.fulfill({ status: 404 });
  });

  await page.goto(origin + base);
  await page.getByRole('heading', { name: 'CO · Larimer' }).waitFor();
  const panel = page.locator('#discovery');
  await page.getByRole('heading', { name: 'Source discovery' }).waitFor();
  assert.match(await page.locator('#discovery-budget').textContent(), /^Discovery requests today: 0 of 60 · up to 16 per run/);
  assert.equal(discoverBodies.length, 0, 'discovery never runs on page load');
  assert.equal(await page.getByText('Discovery has not run for this county.').isVisible(), true);
  assert.match(await page.locator('#discovery-details').textContent(), /Map: not connected/);

  const run = page.getByRole('button', { name: 'Run bounded discovery · up to 16 requests' });
  await run.click();
  assert.deepEqual(discoverBodies, [{ confirmed: true, action: 'discover', countyId: 'CO-larimer' }]);
  await page.getByText('Verified · Sample parcel matched the official layer and its situs address').waitFor();
  assert.match(await page.locator('#discovery-message').textContent(), /Discovery finished · 4 requests used/);
  assert.match(await page.locator('#discovery-budget').textContent(), /^Discovery requests today: 4 of 60/);

  const verifiedCard = page.locator('article.discovery-card').filter({ hasText: 'Parcels' });
  await verifiedCard.getByText('Verified by seed declared domain · maps1.larimer.org').waitFor();
  await verifiedCard.getByText('Sample parcel matched the official layer and its address').waitFor();
  const blockedCard = page.locator('article.discovery-card').filter({ hasText: 'Other layer' });
  await blockedCard.getByText('Check error: Source unavailable or response unreadable').waitFor();
  assert.equal(await blockedCard.getByRole('button', { name: 'Approve source for owner record' }).count(), 0, 'a blocked candidate cannot be approved');

  page.once('dialog', dialog => dialog.accept());
  await verifiedCard.getByRole('button', { name: 'Approve source for owner record' }).click();
  await page.getByText('Owner approved · Parcels · the map is not connected').waitFor();
  assert.deepEqual(approveBodies, [{ confirmed: true, action: 'approve-source', countyId: 'CO-larimer', candidateId: verifiedCandidate.id }]);
  assert.match(await page.locator('#discovery-message').textContent(), /The map was not changed/);
  assert.equal(await page.getByRole('button', { name: 'Approve source for owner record' }).count(), 0, 'an approved source is not offered again');

  // Optional: DISCOVERY_SHOT=/path/file.png saves the panel after approval, for layout review.
  if (process.env.DISCOVERY_SHOT) await panel.screenshot({ path: process.env.DISCOVERY_SHOT });
  await page.locator('#county').selectOption('AL-baldwin');
  await page.getByRole('heading', { name: 'AL · Baldwin' }).waitFor();
  await page.getByText('No reviewed discovery seed exists for this county yet.').waitFor();
  assert.equal(await page.getByRole('button', { name: /Run bounded discovery/ }).count(), 0);

  // Production: the owner API answers 404 outside the preview, and the panel stays hidden.
  discoveryMode = 'missing';
  await page.reload();
  await page.getByRole('heading', { name: 'CO · Larimer' }).waitFor();
  await page.waitForTimeout(300);
  assert.equal(await panel.isHidden(), true, 'panel hidden when the discovery API is unavailable');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, 'no horizontal page scroll at phone width (overflow ' + overflow + 'px)');
  assert.deepEqual(unexpected, [], 'no unexpected requests');
  assert.deepEqual(errors, [], 'no page errors');
  console.log('County discovery panel checks passed (mocked owner responses only).');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
