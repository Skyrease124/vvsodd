// Run: node netlify/tests/retail-cadence.test.mjs   (file-backed storage; TEST FIXTURE accounts and products; OneSignal calls are captured, never sent).
import assert from 'node:assert/strict'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
process.env.USERS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'retail-cadence-')); process.env.FOUNDER_EMAIL = 'founder@example.com'; process.env.ONESIGNAL_REST_API_KEY = 'os_v2_app_testkey'; process.env.SESSION_SECRET = 't';
const sent = []; const realFetch = globalThis.fetch;
globalThis.fetch = async (url, o) => { if (String(url).includes('onesignal.com')) { sent.push(JSON.parse(o.body)); return new Response(JSON.stringify({ id: 'n' + sent.length }), { status: 200 }); } return realFetch(url, o); };
const auth = await import('../lib/auth.mjs'); const R = await import('../lib/retail.mjs'); const monitorFn = await import('../functions/retail-monitor.mjs');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok -', m); };
const mk = async (e, patch) => { const u = await auth.createUser(e, 'password123', false); Object.assign(u, patch || {}); await auth.saveUser(u); return (await auth.sessionCookie(e)).split(';')[0]; };
const F = await mk('founder@example.com', { owner: true }), M = await mk('member@example.com', { paidThrough: '2999-01-01' });
const ago = min => new Date(Date.now() - min * 60e3).toISOString();
const p = (await R.createProduct('founder', { url: 'https://www.target.com/p/cadence-test', name: 'Cadence test (TEST FIXTURE)', category: 'pokemon', status: 'sold_out' })).product;

// 1. Owner-confirmed stock stays in stock; automatically checked stock still expires after 3 hours
await R.applyResult(await R.getProduct(p.id), { status: 'in_stock', price: 54.99, reason: 'Set by the owner' }, 'owner');
let cur = await R.getProduct(p.id); cur.confirmedAt = ago(6 * 60); await auth.kvPut('rp_' + p.id, cur);
ok(R.card(cur).status === 'in_stock', 'owner-confirmed in stock is still shown after 6 hours');
cur.confirmedBy = 'auto'; await auth.kvPut('rp_' + p.id, cur);
ok(R.card(cur).status === 'monitoring', 'automatically checked in stock expires after 3 hours');

// 2. Restock alerts: owner-confirmed changes are held for 30 minutes; automatic ones for 6 hours
cur = await R.getProduct(p.id); cur.status = 'sold_out'; cur.lastAlert = { restock: ago(10) }; await auth.kvPut('rp_' + p.id, cur);
let r = await R.applyResult(await R.getProduct(p.id), { status: 'in_stock' }, 'owner');
ok(r.some(x => x.kind === 'restock' && x.skipped === 'cooldown'), 'owner restock 10 minutes after the last restock alert is held back');
cur = await R.getProduct(p.id); cur.status = 'sold_out'; cur.lastAlert = { restock: ago(45) }; await auth.kvPut('rp_' + p.id, cur);
r = await R.applyResult(await R.getProduct(p.id), { status: 'in_stock' }, 'owner');
ok(r.some(x => x.kind === 'restock' && !x.skipped), 'owner restock 45 minutes later is sent');
cur = await R.getProduct(p.id); cur.status = 'sold_out'; cur.lastAlert = { restock: ago(45) }; await auth.kvPut('rp_' + p.id, cur);
r = await R.applyResult(await R.getProduct(p.id), { status: 'in_stock' }, 'auto');
ok(r.some(x => x.kind === 'restock' && x.skipped === 'cooldown'), 'automatic restock 45 minutes later is still held back (6-hour cooldown)');

// 3. The manual product check is owner-only and has no schedule
const noCookie = await monitorFn.default(new Request('http://x/.netlify/functions/retail-monitor'));
ok(noCookie.status === 403, 'the product check refuses anyone who is not signed in as the owner');
const member = await monitorFn.default(new Request('http://x/.netlify/functions/retail-monitor', { headers: { cookie: M } }));
ok(member.status === 403, 'members cannot run the product check');
const owner = await monitorFn.default(new Request('http://x/.netlify/functions/retail-monitor', { headers: { cookie: F } }));
const body = await owner.json();
ok(owner.status === 200 && body.ok === true, 'the owner can run the product check by hand');
ok(monitorFn.config === undefined, 'no schedule is set on the product check');
console.log('# pass ' + pass);
