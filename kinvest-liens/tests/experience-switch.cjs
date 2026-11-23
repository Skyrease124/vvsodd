// Run: node kinvest-liens/tests/experience-switch.cjs
// Serves the built files from kinvest-liens with mocked account endpoints. Checks the switch on Assets, Retail and account
// pages at phone and desktop widths, both switching directions, direct loads, back and forward, reduced motion, and the
// Retail demo search and filters.
const fs = require('node:fs'); const path = require('node:path'); const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
function fileFor(pathname) {
  let p = path.join(ROOT, pathname);
  if (pathname.endsWith('/')) p = path.join(ROOT, pathname, 'index.html');
  return fs.existsSync(p) && fs.statSync(p).isFile() ? p : null;
}
async function open(browser, opts = {}) {
  const context = await browser.newContext({ viewport: opts.viewport || { width: 390, height: 844 }, reducedMotion: opts.reduced ? 'reduce' : 'no-preference', deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.errors = []; page.on('pageerror', e => page.errors.push(e.message));
  await page.route('**/*', route => {
    const u = new URL(route.request().url());
    if (u.hostname !== 'site.test') return route.fulfill({ status: 404, body: '' });
    if (u.pathname.startsWith('/.netlify/functions/')) {
      if (u.pathname.endsWith('/account')) return route.fulfill({ json: { user: opts.owner ? { email: 'owner@example.com', owner: true, paid: true, name: 'Owner' } : null } });
      return route.fulfill({ status: 401, json: { error: 'Sign in' } });
    }
    const f = fileFor(u.pathname);
    if (!f) return route.fulfill({ status: 404, body: 'not found' });
    return route.fulfill({ body: fs.readFileSync(f), contentType: TYPES[path.extname(f)] || 'text/html; charset=utf-8' });
  });
  return { context, page };
}
const rect = (page, sel) => page.evaluate(s => { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) }; }, sel);
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok -', m); };

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--no-sandbox'] });
  try {
    // 1. The switch sits after the logo on an Assets page, on phone and desktop, without overlap or sideways scroll
    for (const width of [390, 1280]) {
      const { context, page } = await open(browser, { viewport: { width, height: 844 } });
      await page.goto('http://site.test/plans/'); await page.waitForSelector('.ppx-switch', { timeout: 15000 });
      const sw = await rect(page, '.ppx-switch'), logo = await rect(page, 'header a.logo');
      ok(sw && logo && sw.x >= logo.right - 1, `[${width}px] the switch sits after the logo (switch x=${sw.x}, logo right=${logo.right})`);
      ok(sw.x >= 0 && sw.right <= width, `[${width}px] the switch fits on screen (${sw.x}..${sw.right})`);
      ok((await overflow(page)) <= 0, `[${width}px] no sideways scrolling on the Assets page`);
      ok((await page.locator('.ppx-switch a[aria-current="page"]').textContent()) === 'Assets', `[${width}px] Assets is the current experience on Assets pages`);
      await context.close();
    }

    // 2. Assets -> Retail, Retail -> Assets (returns to the last Assets page), and the active label follows
    {
      const { context, page } = await open(browser);
      await page.goto('http://site.test/plans/'); await page.waitForSelector('.ppx-switch');
      const t0 = Date.now();
      await page.click('.ppx-switch a:has-text("Retail")');
      await page.waitForURL('**/price-pocket-retail/');
      ok(Date.now() - t0 >= 200, `Assets -> Retail fades before it leaves (${Date.now() - t0} ms)`);
      await page.waitForSelector('.pprt-hero h1');
      ok((await page.textContent('.pprt-hero h1')).includes('in stock'), 'Assets -> Retail lands on the Retail homepage');
      ok((await page.locator('.ppx-switch a[aria-current="page"]').textContent()) === 'Retail', 'Retail is the current experience on the Retail page');
      ok((await page.getAttribute('.ppx-switch a:has-text("Assets")', 'href')) === '/plans/', 'the Assets link on Retail returns to the last Assets page');
      await page.click('.ppx-switch a:has-text("Assets")');
      await page.waitForURL('**/plans/');
      ok((await page.locator('.ppx-switch a[aria-current="page"]').textContent()) === 'Assets', 'Retail -> Assets restores the Assets experience');
      await context.close();
    }

    // 3. Direct load, refresh, and browser back / forward
    {
      const { context, page } = await open(browser);
      const resp = await page.goto('http://site.test/price-pocket-retail/');
      ok(resp.status() === 200 && (await page.title()).includes('Price Pocket Retail'), 'the Retail homepage loads directly');
      await page.reload(); await page.waitForSelector('.pprt-hero h1');
      ok(page.url().endsWith('/price-pocket-retail/'), 'refreshing the Retail page stays on Retail');
      await page.goto('http://site.test/plans/'); await page.waitForSelector('.ppx-switch');
      await page.click('.ppx-switch a:has-text("Retail")'); await page.waitForURL('**/price-pocket-retail/'); await page.waitForSelector('.pprt-hero h1');
      await page.goBack(); await page.waitForURL('**/plans/'); await page.waitForTimeout(700);
      ok((await page.evaluate(() => getComputedStyle(document.body).opacity)) === '1', 'browser back returns to Assets fully visible (no stuck fade)');
      await page.goForward(); await page.waitForURL('**/price-pocket-retail/'); await page.waitForTimeout(700);
      ok((await page.evaluate(() => getComputedStyle(document.body).opacity)) === '1', 'browser forward returns to Retail fully visible');
      await context.close();
    }

    // 4. Reduced motion: no fade, the switch still works
    {
      const { context, page } = await open(browser, { reduced: true });
      await page.goto('http://site.test/plans/'); await page.waitForSelector('.ppx-switch');
      const t0 = Date.now();
      await page.click('.ppx-switch a:has-text("Retail")'); await page.waitForURL('**/price-pocket-retail/');
      const ms = Date.now() - t0;
      ok(ms < 1000, `reduced motion switches without the fade (${ms} ms)`);
      await context.close();
    }

    // 5. Retail demo listings: search, categories, and clear demo labelling
    {
      const { context, page } = await open(browser);
      await page.goto('http://site.test/price-pocket-retail/'); await page.waitForSelector('.pprt-item');
      const total = await page.locator('.pprt-item').count();
      ok(total === 6, `six demonstration listings are shown (${total})`);
      ok((await page.locator('.pprt-item .pprt-tag', { hasText: 'Demo' }).count()) === total, 'every listing is labelled Demo');
      ok((await page.locator('.pprt-item .pprt-avail', { hasText: 'Demo:' }).count()) === total, 'every availability state is labelled Demo');
      await page.fill('#pprtQ', 'card');
      ok((await page.locator('.pprt-item').count()) === 1, 'search narrows the listings');
      await page.fill('#pprtQ', '');
      await page.click('.pprt-chip[data-cat="vehicles"]');
      ok((await page.locator('.pprt-item').count()) === 1 && (await page.getAttribute('.pprt-chip[data-cat="vehicles"]', 'aria-pressed')) === 'true', 'a category filter narrows the listings and shows which is selected');
      await page.click('.pprt-chip[data-cat="all"]');
      await page.fill('#pprtQ', 'zzzz-no-match');
      ok(await page.isVisible('#pprtEmpty'), 'a search with no match says so');
      ok(total > 0 && (await page.textContent('.pprt-notice')).includes('not live inventory'), 'the page says the listings are not live inventory');
      ok((await overflow(page)) <= 0, 'no sideways scrolling on the Retail page');
      await context.close();
    }

    // 6. Retail header on a phone: switch, sign-in and brand all fit
    {
      const { context, page } = await open(browser);
      await page.goto('http://site.test/price-pocket-retail/'); await page.waitForSelector('.ppx-switch');
      const sw = await rect(page, '.ppx-switch'), acc = await rect(page, '.pprt-account'), brand = await rect(page, '.pprt-brand');
      ok(sw.x >= brand.right - 1 && acc.x >= sw.right - 1 && acc.right <= 390, `Retail header fits at 390px (brand ends ${brand.right}, switch ${sw.x}-${sw.right}, account ${acc.x}-${acc.right})`);
      await context.close();
    }

    // 7. Owner and account pages (app bar header) at phone width
    {
      const { context, page } = await open(browser, { owner: true });
      await page.goto('http://site.test/account/'); await page.waitForSelector('.ppx-switch', { timeout: 15000 });
      const sw = await rect(page, '.ppx-switch'), brand = await rect(page, 'header .app-brand'), acts = await rect(page, 'header .app-actions');
      ok(sw && brand && sw.y >= brand.y + brand.h - 1 && sw.x >= 0 && sw.right <= 390, `app bar: on phones the switch takes its own line under the brand (brand bottom ${brand.y + brand.h}, switch top ${sw.y})`);
      ok(acts && acts.right <= 390 && acts.y < sw.y, 'app bar: the existing account controls stay on the top line, on screen');
      ok((await overflow(page)) <= 0, 'app bar: no sideways scrolling');
      await context.close();
    }

    // 7b. Retail Alerts (/retail/) is part of the Retail experience: Retail is current, and Assets returns to the last Assets page
    {
      const { context, page } = await open(browser);
      await page.goto('http://site.test/plans/'); await page.waitForSelector('.ppx-switch');
      await page.goto('http://site.test/retail/'); await page.waitForSelector('.ppx-switch');
      ok((await page.locator('.ppx-switch a[aria-current="page"]').textContent()) === 'Retail', 'Retail Alerts (/retail/) shows Retail as the current experience');
      ok((await page.getAttribute('.ppx-switch a:has-text("Assets")', 'href')) === '/plans/', 'from Retail Alerts, Assets returns to the last Assets page');
      await context.close();
    }

    // 8. Home page header (dnav) at phone width
    {
      const { context, page } = await open(browser);
      await page.goto('http://site.test/'); await page.waitForSelector('.ppx-switch', { timeout: 15000 });
      const sw = await rect(page, '.ppx-switch'), brand = await rect(page, 'header .dlogo');
      ok(sw && brand && sw.y >= brand.y + brand.h - 1 && sw.x >= 0 && sw.right <= 390 && sw.w < 200, `home header: on phones the switch takes its own line under the brand (brand bottom ${brand.y + brand.h}, switch ${sw.x}-${sw.right}, top ${sw.y})`);
      ok((await overflow(page)) <= 0, 'home page: no sideways scrolling at 390px');
      await context.close();
    }

    console.log('# pass ' + pass);
  } finally { await browser.close(); }
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
