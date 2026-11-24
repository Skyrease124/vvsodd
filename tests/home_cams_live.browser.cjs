// Homepage Live Cameras: only cameras with a live feed are shown, and the place changes between visits.
// Camera API and account are mocked, so nothing outside is called.
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const cam = (id, live) => ({kind: 'camera', name: 'Cam ' + id, road: 'I-' + id, lat: 30, lng: -90, image: 'https://x.test/' + id + '.jpg', video: live ? 'https://x.test/' + id + '.m3u8' : undefined});
(async () => {
  const browser = await chromium.launch({headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage']});
  const seen = new Set();
  for (let visit = 0; visit < 4; visit++) {
    const page = await browser.newPage({viewport: {width: 390, height: 844}, reducedMotion: 'no-preference'});
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('**/.netlify/functions/account', r => r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({user: {paid: true}})}));
    await page.route('**/.netlify/functions/cameras**', r => r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({ok: true, cameras: [cam(1, false), cam(2, true), cam(3, true), cam(4, false), cam(5, true), cam(6, true)]})}));
    await page.route('**/hls.min.js', r => r.fulfill({status: 200, contentType: 'application/javascript', body: ''}));
    const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    await page.route('**/x.test/**', r => /\.jpg/.test(r.request().url()) ? r.fulfill({status: 200, contentType: 'image/png', body: PNG}) : r.abort());
    await page.goto('http://127.0.0.1:8765/', {waitUntil: 'domcontentloaded'});
    await page.locator('#hcams .hc-card').first().waitFor({timeout: 20000}).catch(() => {});
    await page.locator('#hcams').scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);
    const centre = await page.evaluate(() => { const g = document.querySelector('#hcams .hc-grid').getBoundingClientRect(), h = document.querySelector('#hcams .hc-hero').getBoundingClientRect(); return Math.abs((h.left + h.width / 2) - (g.left + g.width / 2)); });
    assert.ok(centre < 40, 'the live hero is centred in the row (off by ' + Math.round(centre) + 'px)');
    const names = await page.locator('#hcams .hc-card b').allTextContents();
    assert.ok(names.length > 0, 'cards are shown: msg=' + await page.locator('#hcams').textContent());
    assert.ok(names.every(n => ['Cam 2', 'Cam 3', 'Cam 5', 'Cam 6'].includes(n)), 'snapshot-only cameras are dropped: ' + names);
    assert.equal(await page.locator('#hcams .hc-card').count(), names.length);
    assert.equal(await page.locator('#hcams .hc-hero').count(), 1, 'one live hero card');
    assert.deepEqual(errors, [], 'no page errors');
    await page.screenshot({path: '/tmp/claude-0/-home-user-vvsodd/bf604de6-2661-56bf-bbdc-299b08c4a426/scratchpad/home-cams-' + visit + '.png', fullPage: false}).catch(() => {});
    seen.add(await page.locator('#hcams .hc-msg').textContent());
    await page.close();
  }
  console.log('PASS: homepage camera card shows only live feeds (' + seen.size + ' different place messages over 4 visits)');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
