// Browser test of the Control Center rows: a panel opens in place under its row and the page does not scroll.
// Run after the static server is up (see validate-map-polish.yml):
//   NODE_PATH=... node --experimental-vm-modules kinvest-liens/tests/brain-nav-accordion.browser.mjs
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const json = body => ({status: 200, contentType: 'application/json', body: JSON.stringify(body)});
const PAGE = 'http://127.0.0.1:8765/owner/brain/';
const browser = await chromium.launch({headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage']});
async function open(options = {}, hash = '') {
  const context = await browser.newContext({viewport: {width: 390, height: 844}, ...options});
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/.netlify/functions/**', r => r.fulfill(json({ok: true, entries: [], cases: [], receipts: [], configured: true, state: 'idle', dailyLimit: 10, usedToday: 0, remainingToday: 10})));
  await page.goto(PAGE + hash, {waitUntil: 'domcontentloaded'});
  await page.locator('.bn-row[aria-controls="nvidiaPanel"]').waitFor({state: 'visible', timeout: 20000});
  return {context, page, errors};
}
const row = page => page.locator('.bn-row[aria-controls="nvidiaPanel"]');

// 1. Tapping a row opens its panel in place, without scrolling, and tapping again closes it.
{
  const {context, page, errors} = await open();
  assert.equal(await page.locator('#nvidiaPanel').isVisible(), false, 'closed at first');
  assert.equal(await row(page).getAttribute('aria-expanded'), 'false');
  await row(page).scrollIntoViewIfNeeded();
  const y0 = await page.evaluate(() => scrollY), rowBox0 = await row(page).boundingBox();
  await row(page).click();
  await page.locator('#nvidiaPanel').waitFor({state: 'visible'});
  await page.waitForTimeout(600);
  assert.ok(Math.abs((await page.evaluate(() => scrollY)) - y0) <= 2, 'the page did not scroll');
  const rowBox = await row(page).boundingBox(), panelBox = await page.locator('#nvidiaPanel').boundingBox();
  assert.ok(Math.abs(rowBox.y - rowBox0.y) <= 2, 'the row did not move');
  assert.ok(panelBox.y >= rowBox.y + rowBox.height - 2 && panelBox.y - (rowBox.y + rowBox.height) < 40, 'the panel sits right under its row');
  assert.equal(await row(page).getAttribute('aria-expanded'), 'true');
  assert.equal(await page.locator('#nvidiaRun').isVisible(), true, 'the panel content is usable');
  await row(page).click(); await page.waitForTimeout(600);
  assert.equal(await page.locator('#nvidiaPanel').isVisible(), false, 'closed again');
  assert.equal(await page.locator('#nvidiaPanel').evaluate(e => e.parentElement.inert), true, 'a closed panel cannot take focus');
  assert.deepEqual(errors, []);
  await context.close();
}
// 2. Several panels can stay open, and search filters the rows.
{
  const {context, page} = await open();
  await row(page).click(); await page.locator('.bn-row[aria-controls="approvalQueue"]').click();
  await page.waitForTimeout(500);
  assert.equal(await page.locator('#nvidiaPanel').isVisible() && await page.locator('#approvalQueue').isVisible(), true, 'two panels open at once');
  await page.locator('.bn-search input').fill('nvidia');
  assert.equal(await page.locator('.bn-row[aria-controls="intakeSection"]').isVisible(), false, 'other rows are filtered out');
  assert.equal(await row(page).isVisible(), true);
  await context.close();
}
// 3. A link with the panel id in the address opens that panel where it sits.
{
  const {context, page} = await open({}, '#nvidiaPanel');
  await page.locator('#nvidiaPanel').waitFor({state: 'visible'});
  assert.equal(await row(page).getAttribute('aria-expanded'), 'true');
  await context.close();
}
// 4. Reduced motion: it opens at once, with no transition.
{
  const {context, page} = await open({reducedMotion: 'reduce'});
  await row(page).click();
  assert.equal(await page.locator('#nvidiaPanel').isVisible(), true);
  assert.equal(await page.locator('.bn-fold').first().evaluate(e => getComputedStyle(e).transitionDuration), '0s');
  await context.close();
}
// 5. Nothing is left loose far down the page: the progress panel, the monitor, and tools the page adds later all sit in rows.
{
  const {context, page} = await open();
  assert.equal(await page.locator('.bn-row[href="#app"]').count(), 0, 'no row jumps to the whole locked section');
  for (const name of ['County Agent Progress', 'Automatic Research Monitor']) {
    const r = page.locator('.bn-row', {hasText: name}).first();
    assert.ok((await r.getAttribute('aria-controls')) !== null, name + ' opens in place');
  }
  await page.evaluate(() => {
    const app = document.getElementById('app');
    const b = document.createElement('button'); b.textContent = 'Test Agent Run (no AI credits)'; app.append(b);
    const sec = document.createElement('section'); sec.className = 'panel'; sec.innerHTML = '<h2>Automatic preview — 90 Chandler</h2><p>Retrieves the official record.</p>'; app.prepend(sec);
    const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'Automatic polygon verification currently supports Detroit. Agents compare the parcel.'; app.append(p);
  });
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => [...document.getElementById('app').children].filter(n => !/^(STYLE|SCRIPT|DIALOG)$/.test(n.tagName)).length), 0, 'nothing loose in the section');
  const tools = page.locator('.bn-row', {hasText: 'Preview and test tools'});
  assert.equal(await tools.count(), 1);
  await tools.click(); await page.waitForTimeout(500);
  assert.equal(await page.getByRole('button', {name: /Test Agent Run/}).isVisible(), true, 'the tool opens under its row');
  assert.match(await page.locator('.bn-about').textContent(), /Automatic polygon verification currently supports Detroit/);
  await context.close();
}
await browser.close();
console.log('PASS: Control Center rows open panels in place, no scroll, several open, search, address link, reduced motion');
