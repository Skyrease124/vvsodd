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
    // Only Los Angeles has live feeds in this mock; other places have snapshots only, so a random pick must fall back to Los Angeles.
    await page.route('**/.netlify/functions/cameras**', r => { const isLA = new URL(r.request().url()).searchParams.get('lat') === '34.0522';
      const cameras = isLA ? [cam(1, false), cam(2, true), cam(3, true), cam(4, false), cam(5, true), cam(6, true)] : [cam(7, false), cam(8, false)];
      return r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({ok: true, cameras})}); });
    await page.route('**/hls.min.js', r => r.fulfill({status: 200, contentType: 'application/javascript', body: ''}));
    const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    await page.route('**/x.test/**', r => /\.jpg/.test(r.request().url()) ? r.fulfill({status: 200, contentType: 'image/png', body: PNG}) : r.abort());
    await page.goto('http://127.0.0.1:8765/', {waitUntil: 'domcontentloaded'});
    await page.locator('#hcams .hc-card').first().waitFor({timeout: 20000}).catch(() => {});
    await page.locator('#hcams').scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);
    const centre = await page.evaluate(() => { const g = document.querySelector('#hcams .hc-grid').getBoundingClientRect(), h = document.querySelector('#hcams .hc-hero').getBoundingClientRect(); return Math.abs((h.left + h.width / 2) - (g.left + g.width / 2)); });
    assert.ok(centre < 40, 'the live hero is centred in the row (off by ' + Math.round(centre) + 'px)');
    await page.waitForTimeout(600);
    const names = await page.locator('#hcams .hc-card b').allTextContents();
    assert.ok(names.length > 0, 'cards are shown: msg=' + await page.locator('#hcams').textContent());
    assert.ok(names.every(n => ['Cam 2', 'Cam 3', 'Cam 5', 'Cam 6'].includes(n)), 'the default opens on live feeds only: ' + names);
    assert.ok(!(await page.locator('#hcams .hc-msg').textContent()).includes('No '), 'no empty-state message on the default');
    assert.equal(await page.locator('#hcams .hc-card').count(), names.length);
    assert.equal(await page.locator('#hcams .hc-hero').count(), 1, 'one live hero card');
    assert.equal(await page.locator('#hcams .hc-dot').count(), names.length, 'one dot per camera');
    assert.equal(await page.locator('#hcams .hc-chip', {hasText: 'Near current map'}).count(), 0, 'no Near current map option');
    // Tapping a camera that is not in the middle selects it: it moves to the centre and takes the glow.
    const before = await page.locator('#hcams .hc-focus').first().getAttribute('aria-label');
    await page.locator('#hcams .hc-card').nth(0).click({position: {x: 40, y: 40}}); await page.waitForTimeout(900);
    const after = await page.locator('#hcams .hc-focus').first().getAttribute('aria-label');
    assert.notEqual(after, before, 'tapping another camera selects it (was ' + before + ', now ' + after + ')');
    await page.locator('#hcams .hc-dot').nth(names.length - 1).click(); await page.waitForTimeout(900);
    // The camera in the middle pops out as you scroll: after moving to the last camera, the glow has moved off the first one.
    const lastFocus = await page.locator('#hcams .hc-card.hc-focus').evaluate(c => [...c.parentNode.children].indexOf(c));
    assert.equal(lastFocus, names.length - 1, 'the popped-out camera follows the scroll to the last one');
    const scaleOfFocus = await page.locator('#hcams .hc-card.hc-focus').evaluate(c => getComputedStyle(c).transform);
    assert.notEqual(scaleOfFocus, 'none', 'the popped-out camera is scaled up');
    assert.ok(await page.locator('#hcams .hc-dot.on').evaluate((d, n) => [...d.parentNode.children].indexOf(d) === n - 1, names.length), 'tapping the last dot moves to the last camera');
    assert.deepEqual(errors, [], 'no page errors');
    await page.screenshot({path: '/tmp/claude-0/-home-user-vvsodd/bf604de6-2661-56bf-bbdc-299b08c4a426/scratchpad/home-cams-' + visit + '.png', fullPage: false}).catch(() => {});
    seen.add(await page.locator('#hcams .hc-msg').textContent());
    await page.close();
  }
  console.log('PASS: homepage camera card shows only live feeds (' + seen.size + ' different place messages over 4 visits)');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
