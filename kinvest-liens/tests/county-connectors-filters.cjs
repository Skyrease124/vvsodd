// Real-browser check of the County Connectors filters, using mocked owner responses only (no live GIS or owner API).
// Run from the repository root: CHROMIUM_PATH=/opt/pw-browsers/chromium node kinvest-liens/tests/county-connectors-filters.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('playwright');

const root = 'kinvest-liens/owner/brain/connectors/';
const origin = 'https://deploy-preview-454--pricepocketasset.netlify.app';
const counties = [
  {id:'CO-larimer',state:'CO',county:'Larimer',status:'Connector Ready',operation:{mode:'research-only'}},
  {id:'CO-boulder',state:'CO',county:'Boulder',status:'Researching'},
  {id:'AL-baldwin',state:'AL',county:'Baldwin',status:'Researching'}
];
const detail = county => ({county, coverage:{available:0,mapped:0,verified:0,remaining:0,completion:null}, operation: county.operation});

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const unexpected = [], errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) { unexpected.push(url.href); return route.abort(); }
    const base = '/owner/brain/connectors/';
    if (url.pathname === base) return route.fulfill({ contentType: 'text/html', body: await fs.readFile(root + 'index.html', 'utf8') });
    if (url.pathname === base + 'dashboard.js') return route.fulfill({ contentType: 'text/javascript', body: await fs.readFile(root + 'dashboard.js', 'utf8') });
    if (url.pathname === base + 'dashboard.css') return route.fulfill({ contentType: 'text/css', body: await fs.readFile(root + 'dashboard.css', 'utf8') });
    if (url.pathname === base + 'connectors-ui.css') return route.fulfill({ contentType: 'text/css', body: await fs.readFile(root + 'connectors-ui.css', 'utf8') });
    if (url.pathname === '/.netlify/functions/owner-brain-connectors') {
      const id = url.searchParams.get('dataset');
      if (!id) return route.fulfill({ json: { counties } });
      const county = counties.find(c => c.id === id);
      return county ? route.fulfill({ json: detail(county) }) : route.fulfill({ status: 404, json: { error: 'missing' } });
    }
    // Larimer's preview-only trial panel is not part of this check; answer it as unavailable.
    if (url.pathname === '/.netlify/functions/owner-brain-larimer-trial') return route.fulfill({ status: 404, json: { error: 'not part of this check' } });
    // Source discovery is preview-only and is covered by county-discovery-panel.cjs; answer it as unavailable so its panel stays hidden.
    if (url.pathname === '/.netlify/functions/owner-brain-discovery') return route.fulfill({ status: 404, json: { error: 'not part of this check' } });
    if (url.pathname !== '/favicon.ico') unexpected.push(url.pathname);
    return route.fulfill({ status: 404 });
  });
  await page.goto(origin + '/owner/brain/connectors/');
  const summary = page.locator('#county-summary'), reset = page.locator('#county-reset');
  const picker = page.locator('#county');
  await page.getByRole('heading', { name: 'CO · Larimer' }).waitFor();
  assert.match(await summary.textContent(), /^Showing 3 of 3 counties · 2 researching · 1 connector ready$/);
  assert.equal(await reset.isVisible(), false, 'reset hidden with no filters');

  await page.locator('#county-name').fill('bould');
  await page.getByRole('heading', { name: 'CO · Boulder' }).waitFor();
  assert.equal(await picker.inputValue(), 'CO-boulder');
  assert.match(await summary.textContent(), /^Showing 1 of 3 counties · 1 researching$/);
  assert.equal(await reset.isVisible(), true, 'reset visible while filtering');

  await page.locator('#county-name').fill('zzz');
  await page.getByText('No counties match these filters.').waitFor();
  assert.match(await summary.textContent(), /^0 of 3 counties shown/);

  await reset.click();
  // Showing all counties keeps the county already on screen (Boulder), so the view does not jump.
  await page.getByRole('heading', { name: 'CO · Boulder' }).waitFor();
  assert.equal(await page.locator('#county-name').inputValue(), '');
  assert.match(await summary.textContent(), /^Showing 3 of 3 counties/);
  assert.equal(await reset.isVisible(), false);

  await page.locator('#county-state').selectOption('AL');
  await page.getByRole('heading', { name: 'AL · Baldwin' }).waitFor();
  assert.match(await summary.textContent(), /^Showing 1 of 3 counties · 1 researching$/);
  assert.equal(await reset.isVisible(), true);

  assert.deepEqual(unexpected, [], 'no unexpected requests');
  assert.deepEqual(errors, [], 'no page errors');
  console.log('County Connectors filter checks passed (mocked owner responses only).');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
