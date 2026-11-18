import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium, devices } = require('playwright');
process.env.PORT = '8097'; const { server, COOKIES } = await import('./serve.mjs'); await new Promise(r => server.listen(8097, r));
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) bad++; };
for (const [path, cookie] of [['/learn/paths/?c=fl', COOKIES.pro], ['/learn/glossary/', null], ['/learn/drills/', COOKIES.pro], ['/learn/county/?c=Palm%20Beach', null], ['/learn/county/', null]]) {
  const ctx = await b.newContext({ ...devices['iPhone 14'], reducedMotion: 'reduce' }); if (cookie) await ctx.addCookies([{ name: cookie.split('=')[0], value: cookie.split('=').slice(1).join('='), url: 'http://localhost:8097' }]);
  const p = await ctx.newPage(); await p.goto('http://localhost:8097' + path); await p.waitForTimeout(1800);
  const small = await p.evaluate(() => [...document.querySelectorAll('.mchub a,.mchub button,.mchub input,.mchub select,.mchub summary')].filter(e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && (r.height < 43.5) && !(e.closest('p.small,.small') && e.tagName === 'A' && e.parentElement && e.parentElement.tagName !== 'DIV'); }).map(e => e.tagName + ':' + (e.textContent || e.placeholder || '').trim().slice(0, 28) + ' ' + Math.round(e.getBoundingClientRect().height)));
  ok(small.length === 0, path + ': every button, row and field is at least 44px tall' + (small.length ? ' (small: ' + small.slice(0, 4).join(' | ') + ')' : ''));
  const anim = await p.evaluate(() => [...document.querySelectorAll('.mchub *')].filter(e => { const s = getComputedStyle(e); return s.animationName !== 'none' && parseFloat(s.animationDuration) > 0.01; }).length); ok(anim === 0, path + ': no animation under reduced motion (' + anim + ')');
  await p.keyboard.press('Tab'); let ring = 0, n = 0; for (let i = 0; i < 8; i++) { await p.keyboard.press('Tab'); const r = await p.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const s = getComputedStyle(e); return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none'; }); if (r !== null) { n++; if (r) ring++; } }
  ok(n === 0 || ring === n, path + ': visible focus on every tab stop (' + ring + '/' + n + ')');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), path + ': no sideways scrolling'); await ctx.close();
}
await b.close(); server.close(); console.log(bad ? 'FAILED ' + bad : 'ALL PASS'); process.exit(bad ? 1 : 0);
