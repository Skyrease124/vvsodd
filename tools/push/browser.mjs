// Browser test of the notification flow with a recorded stand-in for the OneSignal SDK (the real SDK only runs on pricepocketasset.com).
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8099', OUT = 'tools/push/shots';
let bad = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) bad++; };
const FAKE = `window.__os=[];window.OneSignalDeferred=window.OneSignalDeferred||[];
const st={perm:false,opted:false,ext:null};const rec=(n,a)=>window.__os.push(n+(a!==undefined?':'+a:''));
const OS={init:async o=>{rec('init',o.appId);rec('autoPromptOff:'+(o.promptOptions.slidedown.prompts[0].autoPrompt===false));rec('sw:'+o.serviceWorkerPath)},
 login:async id=>{st.ext=id;rec('login',id)},logout:async()=>{st.ext=null;rec('logout')},
 Notifications:{get permission(){return st.perm},isPushSupported:()=>true,requestPermission:async()=>{rec('requestPermission');st.perm=true}},
 User:{PushSubscription:{get optedIn(){return st.opted},optIn:async()=>{st.opted=true;rec('optIn')},optOut:async()=>{st.opted=false;rec('optOut')}}}};
const q=window.OneSignalDeferred;window.OneSignalDeferred={push:f=>{Promise.resolve().then(()=>f(OS))}};q.forEach(f=>window.OneSignalDeferred.push(f));`;
const users = { a: { email: 'a@x.com', paid: true, paidThrough: '2099-01-01', portfolio: [], saved: [] }, b: { email: 'b@x.com', paid: true, paidThrough: '2099-01-01', portfolio: [], saved: [] }, free: { email: 'f@x.com', paid: false, portfolio: [], saved: [] } };
const state = { who: 'a', prefs: { a: { enabled: false, subscribed: false, newProps: true, auctions: true, watchlist: true, portfolio: true }, b: { enabled: false, subscribed: false, newProps: true, auctions: true, watchlist: true, portfolio: true } }, posts: [] };
async function setup(ctx, who) {
  state.who = who; if (!ctx.__noperm) await ctx.addInitScript(() => { try { Object.defineProperty(Notification, 'permission', { get: () => 'default' }); } catch (e) { /* keep */ } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/cdn.onesignal.com/**', r => r.fulfill({ contentType: 'application/javascript', body: FAKE }));
  await p.route('**/functions/account**', r => { const m = r.request().method(); if (m === 'POST') { const b = JSON.parse(r.request().postData() || '{}'); if (b.action === 'logout') state.who = null; return r.fulfill({ contentType: 'application/json', body: '{"ok":true}' }); } r.fulfill({ contentType: 'application/json', body: JSON.stringify({ user: state.who ? users[state.who] : null }) }); });
  await p.route('**/functions/billing**', r => r.fulfill({ contentType: 'application/json', body: '{"mode":"test","enabled":false}' }));
  await p.route('**/functions/push', r => {
    const m = r.request().method(), pr = state.prefs[state.who] || {}; if (!state.who) return r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"x"}' });
    if (users[state.who].paid === false) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ appId: 'app', configured: true, paid: false, pushId: null, prefs: pr }) });
    if (m === 'GET') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ appId: '0bfd191b-3015-40ad-9765-952203f0e2ea', configured: true, paid: true, pushId: 'pp_' + state.who, prefs: pr }) });
    const b = JSON.parse(r.request().postData() || '{}'); state.posts.push(state.who + ':' + b.action); if (b.action === 'enable') { pr.enabled = b.enabled; pr.subscribed = !!b.subscribed; } if (b.action === 'prefs') Object.assign(pr, b.prefs);
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ prefs: pr, ok: true }) });
  });
  return { p, errs };
}
const b = await chromium.launch();
// 1. desktop: nothing is requested until the button is clicked
let ctx = await b.newContext({ viewport: { width: 1200, height: 900 }, permissions: ['notifications'] }); let { p, errs } = await setup(ctx, 'a');
await p.goto(BASE + '/account/'); await p.waitForTimeout(12000);
ok(await p.evaluate(() => !window.__os), 'no SDK loaded and no permission prompt 12 seconds after opening the account page');
ok(await p.locator('text=Enable notifications').isVisible(), 'Enable notifications button is shown');
await p.screenshot({ path: OUT + '/desktop-before.png', fullPage: false });
await p.click('text=Enable notifications'); await p.waitForTimeout(800);
let log = await p.evaluate(() => window.__os);
ok(log.join() === 'init:0bfd191b-3015-40ad-9765-952203f0e2ea,autoPromptOff:true,sw:OneSignalSDKWorker.js,requestPermission,login:pp_a,optIn', 'order after click: init, auto-prompt off, permission asked, login(external id), optIn -> ' + log.join(' > '));
ok(state.posts.includes('a:enable'), 'server told the member is subscribed');
ok(await p.locator('.pushbox p:has-text("On for this device")').first().isVisible(), 'status shows On for this device');
await p.screenshot({ path: OUT + '/desktop-after.png' });
await p.click('label:has-text("Upcoming auctions") input'); await p.waitForTimeout(300); ok(state.prefs.a.auctions === false && state.posts.includes('a:prefs'), 'preference change is saved');
// 2. reload: the device stays tied to the same account, SDK initialized once
await p.reload(); await p.waitForTimeout(1500); log = await p.evaluate(() => window.__os);
ok(log.filter(x => x.startsWith('init')).length === 1 && log.includes('login:pp_a'), 'after reload: one init, login with the same external id');
// 3. sign out clears the external id
await p.evaluate(() => document.getElementById('logout').click()); await p.waitForTimeout(800); log = await p.evaluate(() => window.__os);
ok(log.includes('logout'), 'sign out calls OneSignal.logout');
// 4. a different account on the same device is NOT tied unless it turned notifications on itself
state.who = 'b'; await p.goto(BASE + '/account/'); await p.waitForTimeout(1500); log = await p.evaluate(() => window.__os);
ok(!log.includes('login:pp_b') && log.includes('logout'), 'account B (never enabled) is not tied to this device');
await p.click('text=Enable notifications'); await p.waitForTimeout(800); log = await p.evaluate(() => window.__os);
ok(log.includes('login:pp_b'), 'account B is tied only after B taps Enable');
ok(!errs.length, 'no page errors ' + errs.join('|'));
await ctx.close();
// 5. free account: upgrade note, no button
ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ['notifications'] }); ({ p } = await setup(ctx, 'free')); await p.goto(BASE + '/account/'); await p.waitForTimeout(1500);
ok(await p.locator('text=Push notifications are a Pro feature').isVisible() && !(await p.locator('text=Enable notifications').count()), 'free account sees an upgrade note, no Enable button');
await ctx.close();
// 6. iPhone in Safari (not installed): instructions, no button. Android: button.
ctx = await b.newContext({ ...devices['iPhone 14'], permissions: ['notifications'] }); ({ p } = await setup(ctx, 'a')); await p.goto(BASE + '/account/'); await p.waitForTimeout(1500);
ok(await p.locator('text=Add to Home Screen').isVisible() && !(await p.locator('button:has-text("Enable notifications")').isVisible()), 'iPhone in Safari: Add to Home Screen instructions, no dead button');
await p.locator('.pushbox').screenshot({ path: OUT + '/iphone-safari.png' }); await ctx.close();
ctx = await b.newContext({ ...devices['iPhone 14'], permissions: ['notifications'] }); await ctx.addInitScript(() => { Object.defineProperty(navigator, 'standalone', { get: () => true }); }); ({ p } = await setup(ctx, 'a')); await p.goto(BASE + '/account/'); await p.waitForTimeout(1500);
ok(await p.locator('button:has-text("Enable notifications")').isVisible(), 'iPhone Home Screen app: Enable button shown');
await p.locator('.pushbox').screenshot({ path: OUT + '/iphone-homescreen.png' }); await ctx.close();
ctx = await b.newContext({ ...devices['Pixel 7'], permissions: ['notifications'] }); ({ p } = await setup(ctx, 'a')); await p.goto(BASE + '/account/'); await p.waitForTimeout(1500);
ok(await p.locator('button:has-text("Enable notifications")').isVisible(), 'Android: Enable button shown'); await p.locator('.pushbox').screenshot({ path: OUT + '/android.png' });
ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Android: no sideways scrolling'); await ctx.close();
// 6b. permission already blocked in the browser: clear message, no button
ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); ctx.__noperm = true; ({ p } = await setup(ctx, 'a')); await p.goto(BASE + '/account/'); await p.waitForTimeout(1500);
ok(await p.locator('text=Blocked in your browser settings').isVisible(), 'blocked permission: explains how to fix, no button'); await ctx.close();
// 7. manifest and worker
const r1 = await fetch(BASE + '/OneSignalSDKWorker.js'); const w = await r1.text(); ok(r1.ok && /importScripts\("https:\/\/cdn\.onesignal\.com\/sdks\/web\/v16\/OneSignalSDK\.sw\.js"\)/.test(w), 'service worker file is at the site root with the OneSignal v16 import');
const mf = await (await fetch(BASE + '/manifest.webmanifest')).json(); ok(mf.display === 'standalone' && mf.icons.length >= 2 && mf.start_url, 'web app manifest is valid for Home Screen install');
await b.close(); console.log(bad ? 'FAILED ' + bad : 'ALL PASS'); process.exit(bad ? 1 : 0);
