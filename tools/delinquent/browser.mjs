// Browser test of /liens/delinquent/ against the REAL function (test accounts, temp member data).
import http from 'node:http'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium, devices } = require('playwright');
process.env.USERS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ppa-dqb-')); process.env.SESSION_SECRET = 'x';
const SITE = path.resolve('kinvest-liens'); const auth = await import('../../netlify/lib/auth.mjs'); const dq = (await import('../../netlify/functions/delinquent.mjs')).default;
const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const mk = async (e, patch) => { const u = await auth.createUser(e, 'pw-123456', false); Object.assign(u, patch || {}); await auth.saveUser(u); return (await auth.sessionCookie(e)).split(';')[0]; };
const pro = await mk('pro@t.invalid', { paidThrough: day(30) }), free = await mk('free@t.invalid');
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/.netlify/functions/delinquent') { const r = await dq(new Request('http://x' + req.url, { headers: { cookie: req.headers.cookie || '' } })); res.statusCode = r.status; r.headers.forEach((v, k) => res.setHeader(k, v)); return res.end(await r.text()); }
  if (u.pathname === '/.netlify/functions/account') { const c = req.headers.cookie || ''; const email = c.includes(pro.split('=')[1].slice(0, 20)) ? 'pro@t.invalid' : c.includes(free.split('=')[1].slice(0, 20)) ? 'free@t.invalid' : null; res.setHeader('content-type', 'application/json'); const usr = email && await auth.getUser(email); return res.end(JSON.stringify({ user: usr ? { email, paid: auth.isPaid(usr), paidThrough: usr.paidThrough || '' } : null })); }
  let p = path.join(SITE, decodeURIComponent(u.pathname)); if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html'); if (!p.startsWith(SITE) || !fs.existsSync(p)) { res.statusCode = 404; return res.end('nf'); }
  res.setHeader('content-type', MIME[path.extname(p)] || 'application/octet-stream'); res.end(fs.readFileSync(p));
}); await new Promise(r => server.listen(8096, r));
const B = 'http://localhost:8096', b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) bad++; };
const open = async (cookie, dev = devices['iPhone 14']) => { const ctx = await b.newContext({ ...dev }); if (cookie) await ctx.addCookies([{ name: cookie.split('=')[0], value: cookie.split('=').slice(1).join('='), url: B }]); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); await p.goto(B + '/liens/delinquent/'); await p.waitForTimeout(2000); return { ctx, p, errs }; };
let { ctx, p, errs } = await open(null);
ok(/Not a sale list/.test(await p.locator('.dqnote').innerText()), 'the "not a sale list" notice is the first thing under the title');
ok(await p.locator('.dqtile').count() === 4 && /3,116/.test(await p.locator('.dqtiles').innerText()), 'four summary tiles with 3,116 parcels');
ok(await p.locator('.dqbar').count() === 12, 'two bar charts (12 bars)');
ok(await p.locator('.dqcard').count() === 0 && /Pro members/.test(await p.locator('.dqsearch').innerText()), 'signed out: no parcel rows, a sign-in prompt instead');
await p.screenshot({ path: 'tools/delinquent/shots/top-iphone.png' }); ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scrolling'); ok(!errs.length, 'no page errors ' + errs.join('|')); await ctx.close();
({ ctx, p } = await open(free)); ok(await p.locator('.dqcard').count() === 0 && await p.locator('a:has-text("See Pro")').count() === 1, 'free account: upgrade prompt, no parcel rows'); await ctx.close();
({ ctx, p, errs } = await open(pro));
ok(await p.locator('.dqcard').count() === 20, 'pro: first 20 parcels shown');
ok(/3,116 parcels match/.test(await p.locator('.dqsearch [role=status]').innerText()), 'pro: shows how many match');
const txt = await p.locator('.dqsearch').innerText(); ok(!/owner|mailing/i.test(txt.replace(/Owner/g, '')) || !/ owner name|mailing address/i.test(txt), 'no owner or mailing information on screen');
await p.selectOption('.dqform select >> nth=0', '10000'); await p.click('.dqform button[type=submit]'); await p.waitForTimeout(800); ok(/434 parcels match/.test(await p.locator('.dqsearch [role=status]').innerText()), 'filter $10,000 or more -> 434 parcels');
await p.fill('.dqform input[type=search]', 'zzzz nothing'); await p.click('.dqform button[type=submit]'); await p.waitForTimeout(800); ok(/0 parcels match/.test(await p.locator('.dqsearch [role=status]').innerText()), 'no match is stated plainly');
await p.fill('.dqform input[type=search]', ''); await p.selectOption('.dqform select >> nth=0', ''); await p.click('.dqform input[type=checkbox]'); await p.click('.dqform button[type=submit]'); await p.waitForTimeout(800); ok(/116 parcels|\d+ parcels match/.test(await p.locator('.dqsearch [role=status]').innerText()) && !(await p.locator('.dqcard b').first().innerText()).includes('0 '), 'no-street-address filter works');
const first = await p.locator('.dqcard').first().innerText(); ok(/No street address/.test(first) && /Overdue tax only/.test(first), 'no-address card says so, and every card says it is not a listing');
await p.locator('.dqsearch').scrollIntoViewIfNeeded(); await p.screenshot({ path: 'tools/delinquent/shots/search-iphone.png' }); ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'pro: no sideways scrolling'); ok(!errs.length, 'no page errors'); await ctx.close();
({ ctx, p } = await open(null, { viewport: { width: 1200, height: 900 } })); await p.screenshot({ path: 'tools/delinquent/shots/top-desktop.png' }); await ctx.close();
await b.close(); server.close(); console.log(bad ? 'FAILED ' + bad : 'ALL PASS'); process.exit(bad ? 1 : 0);
