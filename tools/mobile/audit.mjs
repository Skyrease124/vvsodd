// Mobile audit: overflow, small tap targets, unlabeled controls, console errors, failed requests, screenshots.
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright'); import fs from 'fs';
const BASE = process.env.BASE || 'http://localhost:8099', OUT = process.env.OUT || 'tools/mobile/shots/before';
fs.mkdirSync(OUT, { recursive: true });
const PAGES = ['/', '/liens/', '/land/', '/learn/', '/learn/course/?c=fl', '/portfolio/', '/ai/', '/account/', '/plans/', '/login/', '/practice/', '/about/'];
const VPS = { iphone: { width: 390, height: 844, dpr: 3, mobile: true }, android: { width: 412, height: 915, dpr: 2.6, mobile: true }, tablet: { width: 820, height: 1180, dpr: 2, mobile: true }, desktop: { width: 1440, height: 900, dpr: 1, mobile: false } };
const res = [];
const b = await chromium.launch();
for (const [vn, v] of Object.entries(VPS)) for (const p of PAGES) {
  const ctx = await b.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: 1, isMobile: v.mobile, hasTouch: v.mobile });
  const pg = await ctx.newPage(); const errs = [], fails = [];
  pg.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)); });
  pg.on('pageerror', e => errs.push('JS: ' + String(e.message).slice(0, 140)));
  pg.on('requestfailed', r => fails.push(r.url().slice(0, 100)));
  pg.on('response', r => { if (r.status() >= 400 && !/netlify\/functions/.test(r.url())) fails.push(r.status() + ' ' + r.url().slice(0, 100)); });
  let ok = true; try { await pg.goto(BASE + p, { waitUntil: 'load', timeout: 20000 }); await pg.waitForTimeout(1500); } catch (e) { ok = false; }
  const m = ok ? await pg.evaluate((vw) => {
    const vis = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
    const over = [...document.querySelectorAll('body *')].filter(e => vis(e) && e.getBoundingClientRect().right > vw + 1 && !e.closest('.leaflet-container,[style*="overflow"]')).slice(0, 5).map(e => e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : ''));
    const taps = [...document.querySelectorAll('a,button,input,select,textarea,[role=button]')].filter(e => vis(e)).filter(e => { const r = e.getBoundingClientRect(); return r.height < 40 || r.width < 40; });
    const nolabel = [...document.querySelectorAll('button,a,input,select')].filter(e => vis(e) && !(e.textContent.trim() || e.getAttribute('aria-label') || e.getAttribute('title') || e.getAttribute('alt') || (e.labels && e.labels.length) || e.getAttribute('placeholder') || e.querySelector('img[alt]')));
    const imgs = [...document.images].filter(i => !i.hasAttribute('alt') || (i.complete && i.naturalWidth === 0));
    const fs = [...document.querySelectorAll('p,li,a,span,label,td')].filter(e => vis(e) && e.childNodes.length && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 11);
    return { scrollW: document.documentElement.scrollWidth, over, smallTaps: taps.length, tapEx: taps.slice(0, 4).map(e => (e.textContent.trim() || e.getAttribute('aria-label') || e.tagName).slice(0, 24)), nolabel: nolabel.length, imgBad: imgs.length, tinyText: fs.length, viewportMeta: !!document.querySelector('meta[name=viewport]') };
  }, v.width) : {};
  const slug = (p === '/' ? 'home' : p.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, ''));
  if (ok) await pg.screenshot({ path: `${OUT}/${vn}-${slug}.png`, fullPage: false });
  res.push({ vp: vn, page: p, ok, ...m, hOverflow: ok && m.scrollW > v.width + 1, errors: [...new Set(errs)].slice(0, 3), failed: [...new Set(fails)].slice(0, 3) });
  await ctx.close();
}
await b.close(); fs.writeFileSync(OUT + '/results.json', JSON.stringify(res, null, 1));
for (const r of res) console.log(r.vp.padEnd(8), r.page.padEnd(20), r.ok ? `ovf:${r.hOverflow ? 'YES' : 'no'} taps<40:${r.smallTaps} nolabel:${r.nolabel} imgBad:${r.imgBad} tiny:${r.tinyText} err:${r.errors.length} fail:${r.failed.length}` : 'LOAD FAIL');
