// Run: node netlify/tests/push.test.mjs   (temporary member folder; a local stand-in for OneSignal, no outside network)
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import http from 'node:http'; import assert from 'node:assert/strict';
process.env.USERS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ppa-push-')); process.env.SESSION_SECRET = 't';
const sent = []; let mode = 'ok';
const mock = http.createServer((q, r) => { let b = ''; q.on('data', d => b += d); q.on('end', () => { const body = JSON.parse(b || '{}'); sent.push({ auth: q.headers.authorization, body }); r.setHeader('content-type', 'application/json'); if (mode === 'norecip') return r.end(JSON.stringify({ id: '', errors: ['All included players are not subscribed'] })); if (mode === 'bad') { r.statusCode = 400; return r.end(JSON.stringify({ errors: ['app_id invalid'] })); } r.end(JSON.stringify({ id: 'n-' + sent.length })); }); });
await new Promise(r => mock.listen(0, r)); process.env.ONESIGNAL_API_URL = 'http://127.0.0.1:' + mock.address().port + '/notifications?c=push';
const auth = await import('../lib/auth.mjs'); const OS = await import('../lib/onesignal.mjs'); const J = await import('../lib/pushjobs.mjs'); const { default: push } = await import('../functions/push.mjs');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok -', m); };
const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const mk = async (e, patch) => { const u = await auth.createUser(e, 'pw-123456', false); Object.assign(u, patch || {}); await auth.saveUser(u); return (await auth.sessionCookie(e)).split(';')[0]; };
const call = async (cookie, method, body) => { const r = await push(new Request('http://x/.netlify/functions/push', { method, headers: { cookie, 'content-type': 'application/json' }, body: method === 'POST' ? JSON.stringify(body) : undefined })); return { s: r.status, j: await r.json() }; };

// --- wording, ids, no key ---
ok(OS.externalId('A@x.com') === OS.externalId('a@x.com') && !/@/.test(OS.externalId('a@x.com')) && OS.externalId('a@x.com') !== OS.externalId('b@x.com'), 'external id is stable, opaque and per member');
ok(!OS.safeText('This lot is now available!') && OS.safeText('An official county page lists a sale for Nov 20.'), 'availability claims are blocked');
delete process.env.ONESIGNAL_REST_API_KEY; ok(!(await OS.configured()) && (await OS.send({ email: 'a@x.com', title: 't', body: 'b', key: 'k1' })).error === 'OneSignal key is not set', 'nothing is sent without the key');
process.env.ONESIGNAL_REST_API_KEY = 'os_v2_app_testkey';
// --- send(): payload, auth header, duplicate protection ---
let r = await OS.send({ email: 'a@x.com', title: 'Hi', body: 'Body', key: 'k1', path: '/account/' });
ok(r.ok && sent.length === 1 && sent[0].auth === 'Key os_v2_app_testkey' && sent[0].body.app_id === '0bfd191b-3015-40ad-9765-952203f0e2ea' && sent[0].body.include_aliases.external_id[0] === OS.externalId('a@x.com') && /^[0-9a-f-]{36}$/.test(sent[0].body.idempotency_key), 'payload has app id, external id target, idempotency key and server-side key');
ok(!JSON.stringify(sent[0].body).includes('os_v2_app'), 'the key is never in the body');
r = await OS.send({ email: 'a@x.com', title: 'Hi', body: 'Body', key: 'k1' }); ok(r.skipped === 'duplicate' && sent.length === 1, 'same key to same member is never sent twice');
r = await OS.send({ email: 'b@x.com', title: 'Hi', body: 'Body', key: 'k1' }); ok(r.ok && sent.length === 2, 'same key to another member is separate');
mode = 'norecip'; r = await OS.send({ email: 'c@x.com', title: 'Hi', body: 'B', key: 'k9' }); ok(!r.ok && r.noRecipient, 'no subscribed device is reported, not logged as sent'); mode = 'bad'; r = await OS.send({ email: 'c@x.com', title: 'Hi', body: 'B', key: 'k9' }); ok(!r.ok && /400/.test(r.error), 'API errors are reported'); mode = 'ok';
// --- plan(): categories, windows, wording ---
const now = day(0), states = new Set(['FL', 'CO']);
const sales = [{ saleId: 's1', saleDate: day(3), saleTime: '09:00', tz: 'ET', status: 'scheduled', type: 'taxdeed', county: 'Volusia', state: 'FL', officialPage: 'https://x' }, { saleId: 's2', saleDate: day(30), status: 'scheduled', type: 'taxdeed', county: 'Volusia', state: 'FL', officialPage: 'https://x' }, { saleId: 's3', saleDate: day(2), status: 'scheduled', type: 'taxdeed', county: 'Other', state: 'TX', officialPage: 'https://x' }, { saleId: 's4', saleDate: day(2), status: 'canceled', type: 'taxdeed', county: 'Volusia', state: 'FL', officialPage: 'https://x' }, { saleId: 's5', saleDate: day(2), status: 'scheduled', type: 'taxdeed', county: 'Volusia', state: 'FL', officialPage: '' }, { saleId: 's6', saleDate: day(-2), status: 'scheduled', type: 'taxdeed', county: 'Volusia', state: 'FL', officialPage: 'https://x' }];
const changes = [{ id: 'c1', type: 'new_list', official: true, state: 'CO', county: 'El Paso', detectedAt: day(-1), text: 'New list added: 171 listings', link: '/liens/states/state/?s=CO' }, { id: 'c2', type: 'new_list', official: true, state: 'CO', county: 'Old', detectedAt: day(-20), text: 'New list added: 5 listings' }, { id: 'c3', type: 'new_list', official: true, state: 'TX', county: 'X', detectedAt: day(-1), text: 'New list added: 9 listings' }, { id: 'c4', type: 'amount', official: true, state: 'CO', county: 'Y', detectedAt: day(-1), text: 'changed' }];
const U = { email: 'u@x.com', push: { enabled: true, subscribed: true }, portfolio: [{ id: 'h1', state: 'FL', county: 'Leon', parcel: 'P1', status: 'open', countyDeadline: day(7) }, { id: 'h2', state: 'FL', county: 'Leon', parcel: 'P2', status: 'redeemed', countyDeadline: day(2) }, { id: 'h3', state: 'FL', county: 'Leon', parcel: 'P3', status: 'open', countyDeadline: day(40) }] };
const watchTodo = [{ id: 'e1', county: 'Larimer', parcel: '9517411019', text: 'Amount changed' }];
let P = J.plan(U, { now, sales, changes, states, watchTodo });
ok(P.map(x => x.cat).sort().join() === 'auctions,newProps,portfolio,watchlist', 'one notification per category');
const A = P.find(x => x.cat === 'auctions'); ok(/Volusia/.test(A.title) && !/s2|Other/.test(JSON.stringify(A)), 'auction: only official, scheduled, next 7 days, member states (' + A.body.slice(0, 60) + '...)');
ok(P.find(x => x.cat === 'newProps').title.includes('El Paso') && !/Old|X County/.test(P.find(x => x.cat === 'newProps').body), 'new lists: official, recent, member states only');
ok(/saved|entered/.test(P.find(x => x.cat === 'portfolio').body) && /Leon/.test(P.find(x => x.cat === 'portfolio').body) && !/P2|P3/.test(P.find(x => x.cat === 'portfolio').body), 'portfolio: open holdings only, due within 7 days, says it is the member’s own date');
ok(P.every(x => OS.safeText(x.title) && OS.safeText(x.body) && /confirm/i.test(x.body)), 'every text passes the availability check and tells the member to confirm');
U.push.auctions = false; U.push.portfolio = false; ok(J.plan(U, { now, sales, changes, states, watchTodo }).map(x => x.cat).sort().join() === 'newProps,watchlist', 'turned-off categories are skipped');
ok(J.plan(U, { now, sales, changes, states, watchTodo }).find(x => x.cat === 'newProps').key === P.find(x => x.cat === 'newProps').key, 'keys are stable between runs (so duplicates are caught)');
// --- endpoint access and flow ---
const anon = '', free = await mk('free@x.com'), pro = await mk('pro@x.com', { paidThrough: day(20) }), other = await mk('other@x.com', { paidThrough: day(20) }), owner = await mk('own@x.com', { owner: true, paidThrough: day(20) });
ok((await call(anon, 'GET')).s === 401, 'signed-out: 401');
let g = await call(free, 'GET'); ok(g.s === 200 && g.j.pushId === null && g.j.paid === false, 'free: sees settings but gets no push id');
ok((await call(free, 'POST', { action: 'enable', enabled: true, subscribed: true })).s === 402, 'free cannot enable notifications');
g = await call(pro, 'GET'); ok(g.j.pushId && g.j.pushId.startsWith('pp_') && g.j.appId === '0bfd191b-3015-40ad-9765-952203f0e2ea' && !JSON.stringify(g.j).includes('os_v2'), 'pro: gets app id and opaque id, never the key');
ok((await call(pro, 'POST', { action: 'test' })).s === 409, 'test is refused until notifications are turned on');
g = await call(pro, 'POST', { action: 'enable', enabled: true, subscribed: true }); ok(g.j.prefs.enabled && g.j.prefs.subscribed, 'pro enables');
g = await call(pro, 'POST', { action: 'prefs', prefs: { auctions: false, junk: true } }); ok(g.j.prefs.auctions === false && g.j.prefs.watchlist === true && !('junk' in g.j.prefs), 'preferences save; unknown keys ignored');
const before = sent.length; g = await call(pro, 'POST', { action: 'test' }); ok(g.s === 200 && sent.length === before + 1 && sent.at(-1).body.include_aliases.external_id[0] === OS.externalId('pro@x.com'), 'test notification goes to this member only');
const meB = await auth.getUser('other@x.com'); ok(!(meB.push && meB.push.enabled), 'another member is unaffected');
for (let i = 0; i < 3; i++) g = await call(pro, 'POST', { action: 'test' }); ok(g.s === 429, 'test notifications are rate limited');
ok((await call(pro, 'POST', { action: 'run' })).s === 403, 'only the owner can trigger a run');
// --- run(): only opted-in paid members, never twice ---
const bumped = await auth.getUser('pro@x.com'); bumped.portfolio = [{ id: 'z1', state: 'FL', county: 'Leon', parcel: 'PZ', status: 'open', countyDeadline: day(1) }]; await auth.saveUser(bumped);
const b2 = sent.length; let rep = await J.run({}); ok(rep.eligible === 1 && rep.sent >= 1 && sent.length > b2, 'run: only the opted-in paid member is eligible');
const b3 = sent.length; rep = await J.run({}); ok(sent.length === b3 && rep.duplicates >= 1, 'run again: nothing is sent twice');
const lapsed = await auth.getUser('pro@x.com'); lapsed.paidThrough = day(-3); lapsed.sub = { status: 'canceled' }; await auth.saveUser(lapsed); rep = await J.run({}); ok(rep.eligible === 0, 'lapsed member gets nothing');
console.log('\n' + pass + ' checks passed'); mock.close(); process.exit(0);
