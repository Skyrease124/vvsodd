// Browser test of the Master Class hub pages against the REAL functions (test accounts, temp data).
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium, devices } = require('playwright');
process.env.PORT = '8097'; const { server, COOKIES } = await import('./serve.mjs'); await new Promise(r => server.listen(8097, r));
const BASE = 'http://localhost:8097', OUT = 'tools/masterclass/shots'; let bad = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) bad++; };
const b = await chromium.launch();
const open = async (dev, cookie, path) => { const ctx = await b.newContext({ ...dev }); if (cookie) await ctx.addCookies([{ name: cookie.split('=')[0], value: cookie.split('=').slice(1).join('='), url: BASE }]); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); await p.goto(BASE + path); await p.waitForTimeout(1500); return { ctx, p, errs }; };
const phone = devices['iPhone 14'];
// glossary
let { ctx, p, errs } = await open(phone, null, '/learn/glossary/');
ok(await p.locator('#gout dt').count() > 90, 'glossary lists all terms (' + await p.locator('#gout dt').count() + ')');
await p.fill('#gq', 'redemption'); await p.waitForTimeout(300); const n = await p.locator('#gout dt').count(); ok(n >= 6 && n < 30, 'search "redemption" narrows to ' + n);
ok((await p.locator('#gout dt').first().innerText()).toLowerCase().startsWith('redemption'), 'best match first');
await p.fill('#gq', 'zzzqqq'); await p.waitForTimeout(300); ok(await p.locator('text=No term matches').isVisible(), 'no-match message');
await p.fill('#gq', ''); await p.click('button.chip:has-text("Florida")'); await p.waitForTimeout(300); ok(await p.locator('#gout .gtag.st').count() === await p.locator('#gout dt').count(), 'state filter shows only Florida terms');
await p.fill('#gq', 'redemption'); await p.waitForTimeout(300); await p.screenshot({ path: OUT + '/glossary-iphone.png' }); ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'glossary: no sideways scroll'); ok(!errs.length, 'no page errors'); await ctx.close();
// paths (pro with progress)
({ ctx, p, errs } = await open(phone, COOKIES.pro, '/learn/paths/?c=fl'));
ok(await p.locator('.pathcard').count() === 3, 'three path cards');
ok(/3 of \d+ lessons/.test(await p.locator('.pathcard').first().innerText()), 'beginner shows saved progress (3 lessons done)');
ok(await p.locator('.chlist > li').count() === 10, 'ten chapters');
await p.locator('.chlist summary').nth(2).click(); ok(await p.locator('.chlist details[open] .chles a').count() > 3, 'chapter opens with lesson links');
const href = await p.locator('.chlist details[open] .chles a').first().getAttribute('href'); ok(/^\/learn\/course\/\?c=fl&l=fl-/.test(href), 'lesson link goes to the real course lesson (' + href + ')');
await p.screenshot({ path: OUT + '/paths-iphone.png', fullPage: false }); ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'paths: no sideways scroll'); ok(!errs.length, 'no page errors'); await ctx.close();
// paths as free account: locks
({ ctx, p } = await open(phone, COOKIES.free, '/learn/paths/?c=tx')); await p.locator('.chlist summary').nth(3).click(); ok(await p.locator('.chlist details[open] span.muted').count() > 0 && /free/i.test(await p.locator('.notice').innerText()), 'free account: locked lessons are shown as locked, not linked'); await ctx.close();
// drills: pro
({ ctx, p, errs } = await open(phone, COOKIES.pro, '/learn/drills/'));
ok(await p.locator('.drcard').count() === 1 && await p.locator('.drfacts dt').count() >= 4, 'pro gets a practice question');
ok(!/answer/i.test(await p.locator('.drcard').innerText().then(t => t.replace(/Your answer|Check my answer/g, ''))), 'the question does not show the answer');
await p.fill('.drcard input', '0.01'); await p.click('button:has-text("Check my answer")'); await p.waitForTimeout(800);
ok(await p.locator('.drwork li').count() >= 2 && await p.locator('.drcard .bad').count() === 1, 'wrong answer: shown wrong with the working');
ok(await p.locator('.drcard a[href^="http"]').count() >= 1 && /Statute text read 20/.test(await p.locator('.drcard').innerText()), 'sources and verified date are shown');
ok(/1/.test(await p.locator('#drprog').innerText()), 'progress table updated');
await p.screenshot({ path: OUT + '/drills-iphone.png', fullPage: false });
await p.click('button:has-text("New question")'); await p.waitForTimeout(800); ok(await p.locator('.drcard input').isEditable(), 'new question is ready');
await p.click('button.chip:has-text("Arizona")'); await p.waitForTimeout(800); ok(/Arizona/.test(await p.locator('.drcard').innerText()), 'switching state loads that state'); ok(!errs.length, 'no page errors'); await ctx.close();
// drills: free sees preview only
({ ctx, p } = await open(phone, COOKIES.free, '/learn/drills/')); ok(await p.locator('text=worked example').first().isVisible() && await p.locator('.drcard input').count() === 0, 'free: worked example and upgrade, no live drills'); await ctx.close();
// county
({ ctx, p, errs } = await open(phone, null, '/learn/county/')); ok(await p.locator('.cty li a').count() >= 20, 'county list (' + await p.locator('.cty li a').count() + ' counties)'); await ctx.close();
({ ctx, p, errs } = await open(phone, null, '/learn/county/?c=Palm%20Beach'));
ok(/Palm Beach County, Florida/.test(await p.locator('h2').first().innerText()) && await p.locator('.chles li').count() >= 4, 'Palm Beach guide with buying steps');
ok(await p.locator('a[href*="realtaxlien.com"]').count() >= 1, 'official county link present');
await p.screenshot({ path: OUT + '/county-iphone.png', fullPage: false }); ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'county: no sideways scroll'); ok(!errs.length, 'no page errors'); await ctx.close();
({ ctx, p } = await open(phone, null, '/learn/county/?c=Nowhere')); ok(await p.locator('text=do not have a guide').isVisible(), 'unknown county: honest message'); await ctx.close();
// hub links + desktop
({ ctx, p } = await open({ viewport: { width: 1200, height: 900 } }, null, '/learn/')); ok(await p.locator('a[href="/learn/paths/"]').count() >= 1 && await p.locator('a[href="/learn/drills/"]').count() >= 1, 'Master Class home links to the new tools'); await p.screenshot({ path: OUT + '/hub-desktop.png' }); await ctx.close();
await b.close(); server.close(); console.log(bad ? 'FAILED ' + bad : 'ALL PASS'); process.exit(bad ? 1 : 0);
