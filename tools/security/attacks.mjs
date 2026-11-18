import { ID, call, auth } from './harness.mjs';
const out = []; const rep = (n, bad, info) => { out.push((bad ? 'CONFIRMED  ' : 'ok         ') + n + (info ? ' :: ' + info : '')); };
const J = r => { try { return JSON.parse(r.text); } catch (e) { return {}; } };
// 1) distributed password guessing: 60 wrong passwords against ONE account from 60 different IPs
let statuses = {}; for (let i = 0; i < 60; i++) { const r = await call('account', { method: 'POST', body: { action: 'login', email: 'other@test.invalid', password: 'guess' + i }, ip: '203.0.113.' + (i + 1) }); statuses[r.status] = (statuses[r.status] || 0) + 1; }
rep('Password guessing against one account from many IPs is never slowed down', !statuses[429], JSON.stringify(statuses));
// 2) setup endpoint leaks to the public
const su = await call('setup', { method: 'GET' }); rep('Public setup endpoint exposes anything about the saved AI key', /hint/.test(su.text) && /…/.test(su.text) || /"hint":"[^"]/.test(su.text), su.text.slice(0, 120));
// 3) oversize inputs on public compute endpoints
const ring = n => { const r = []; for (let i = 0; i < n; i++) r.push([-81.2 + Math.cos(i / n * 6.28) * 0.001, 28.18 + Math.sin(i / n * 6.28) * 0.001]); r.push(r[0]); return r; };
for (const fn of ['flood', 'soil', 'wetlands']) { const t0 = Date.now(); const r = await call(fn, { method: 'POST', body: { rings: [ring(300000)] }, ip: '198.51.100.7' }); rep(fn + ' accepts a 300,000-point polygon from anyone', r.status !== 400 && r.status !== 413 && r.status !== 429, 'status ' + r.status + ' in ' + (Date.now() - t0) + 'ms'); }
// 4) body size on login/signup (huge JSON)
const big = await call('account', { method: 'POST', body: JSON.stringify({ action: 'login', email: 'a@b.co', password: 'x'.repeat(5e6) }), ip: '198.51.100.8' }); rep('Login accepts a 5 MB password field without complaint', big.status !== 400 && big.status !== 413, 'status ' + big.status);
// 5) logout does not invalidate the cookie
const li = await call('account', { method: 'POST', body: { action: 'logout' }, cookie: ID.pro }); const still = J(await call('account', { cookie: ID.pro })); rep('A session cookie keeps working after logout (stolen cookie stays valid up to 30 days)', !!still.user, 'user after logout: ' + (still.user ? 'still signed in' : 'signed out'));
// 6) webhook
const wh = await call('stripe-webhook', { method: 'POST', body: '{"id":"evt_1","type":"customer.subscription.updated"}', headers: { 'stripe-signature': 't=1,v1=bad' } }); rep('Stripe webhook accepts unsigned or badly signed events', wh.status === 200, 'status ' + wh.status);
// 7) cache / CORS headers on account response
const ac = await call('account', { cookie: ID.pro }); rep('Account responses are cacheable by shared caches', !/no-store/.test(ac.headers.get('cache-control') || ''), ac.headers.get('cache-control'));
const cors = [...Object.keys({})]; 
// 8) public background function
const bg = await call('countynews-background', { method: 'POST', body: { state: 'FL', county: 'NoSuchCounty' } }); rep('Background news function runs for counties that are not on our list', bg.status === 200 || bg.status === 202, 'status ' + bg.status);
// 9) mail-config leak via owner key page? (owner only) skip. 10) usage counts to anon
const pr = await call('practice', {}); rep('Practice endpoint needs no sign-in (by design, stores nothing)', false, 'status ' + pr.status);
console.log(out.join('\n'));
process.exit(0);
