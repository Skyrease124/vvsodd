// Keyboard focus, reduced motion and light/dark checks.
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright'); const BASE = process.env.BASE || 'http://localhost:8099';
const b = await chromium.launch(); const out = [];
for (const p of ['/', '/liens/', '/learn/', '/login/', '/plans/']) {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', colorScheme: 'dark' }); const pg = await c.newPage();
  await pg.goto(BASE + p); await pg.waitForTimeout(1200);
  const anim = await pg.evaluate(() => [...document.querySelectorAll('body *')].filter(e => { const s = getComputedStyle(e); return (parseFloat(s.animationDuration) > 0.05 && s.animationIterationCount !== '1' && s.animationName !== 'none') }).length);
  let noRing = 0, tabbed = 0;
  for (let i = 0; i < 12; i++) { await pg.keyboard.press('Tab'); const r = await pg.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const s = getComputedStyle(e); return { ring: (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none' }; }); if (r) { tabbed++; if (!r.ring) noRing++; } }
  const skip = await pg.evaluate(() => !!document.querySelector('a[href="#main"],a.skip,.skiplink'));
  out.push({ page: p, loopingAnimationsUnderReducedMotion: anim, tabStops: tabbed, withoutVisibleFocus: noRing, skipLink: skip, bodyBg: await pg.evaluate(() => getComputedStyle(document.body).backgroundColor) });
  await c.close();
}
await b.close(); console.table(out);
