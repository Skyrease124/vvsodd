// Run: node netlify/tests/exports.test.mjs   (temporary member folder; no outside network)
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import assert from 'node:assert/strict'; import zlib from 'node:zlib';
process.env.USERS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ppa-exp-')); process.env.SESSION_SECRET = 't';
const auth = await import('../lib/auth.mjs'); const X = await import('../lib/exports.mjs'); const X2 = await import('../lib/exports.mjs?second-instance'); const { default: exp } = await import('../functions/export.mjs');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok -', m); };
const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const mk = async (e, patch) => { const u = await auth.createUser(e, 'pw-123456', false); Object.assign(u, patch || {}); await auth.saveUser(u); const r = await auth.loginCookie ? null : null; return u; };
const cookieFor = async e => { const u = await auth.getUser(e); return auth.sessionCookie ? auth.sessionCookie(u) : null; };
// real records from the shipped data
const idx = JSON.parse(fs.readFileSync('kinvest-liens/map/index.json')); const ds = idx.datasets.find(d => d.id === 'CO-larimer');
const j = JSON.parse(fs.readFileSync('kinvest-liens/map/data/' + ds.file)); const ids = j.recs.slice(0, 140).map(r => ({ i: r.i })); ok(ids.length === 140, 'have 140 real records to test with');
const P = await mk('p@x.com', { paidThrough: day(5), sub: { status: 'active', periodEnd: day(3) } });
const week = X.periodOf(P).end;
// --- allowance math ---
ok(X.WEEKLY_LIMIT === 100, 'weekly limit is 100');
let u = await X.usage(P); ok(u.used === 0 && u.remaining === 100 && u.resets === day(3), 'new member: 0 used, 100 left, resets on the subscription renewal date');
let r = await X.reserve(P, [ids[0].i], 'csv'); ok(r.ok && r.fresh === 1, 'one property reserves one credit'); await X.complete(P, r); u = await X.usage(P); ok(u.used === 1 && u.remaining === 99, 'after exporting 1: 1 used');
r = await X.reserve(P, ids.slice(0, 20).map(x => x.i), 'xlsx'); ok(r.ok && r.fresh === 19, '20 selected, 1 already exported this week: 19 new credits'); await X.complete(P, r); u = await X.usage(P); ok(u.used === 20, '20 used after exporting 20 properties');
r = await X.reserve(P, ids.slice(0, 20).map(x => x.i), 'pdf'); ok(r.ok && r.fresh === 0 && r.free, 're-exporting the same properties (other format) costs nothing'); u = await X.usage(P); ok(u.used === 20, 'still 20 used');
r = await X.reserve(P, ids.slice(0, 100).map(x => x.i), 'zip'); ok(r.ok && r.fresh === 80, 'exporting up to 100 reaches the limit exactly'); await X.complete(P, r); u = await X.usage(P); ok(u.used === 100 && u.remaining === 0, '100 used, 0 left');
r = await X.reserve(P, [ids[100].i], 'csv'); ok(!r.ok && r.why === 'limit' && r.resets === week, 'the 101st unique property is blocked, with the reset date');
r = await X.reserve(P, [ids[5].i], 'csv'); ok(r.ok && r.fresh === 0, 'a property exported earlier this week is still free to export at the limit');
// --- failed export releases ---
const Q = await mk('q@x.com', { paidThrough: day(5), sub: { status: 'active', periodEnd: day(3) } });
r = await X.reserve(Q, ids.slice(0, 30).map(x => x.i), 'pdf'); u = await X.usage(Q); ok(u.used === 30, 'a reservation holds its credits while the file is made'); await X.release(Q, r); u = await X.usage(Q); ok(u.used === 0 && u.remaining === 100, 'a failed export releases all its credits');
// stale reservation (crashed job) expires on its own
const Z = await mk('z@x.com', { paidThrough: day(5), sub: { status: 'active', periodEnd: day(3) } });
r = await X.reserve(Z, ids.slice(0, 10).map(x => x.i), 'csv'); const v = JSON.parse(fs.readFileSync(path.join(process.env.USERS_DIR, r.key.replace(/[^a-z0-9_-]/gi, '_') + '.json'))); v.ts = Date.now() - 11 * 60e3; fs.writeFileSync(path.join(process.env.USERS_DIR, r.key.replace(/[^a-z0-9_-]/gi, '_') + '.json'), JSON.stringify(v)); u = await X.usage(Z); ok(u.used === 0, 'an abandoned reservation expires after 10 minutes');
// --- concurrency: two separate server instances, many simultaneous requests ---
const C = await mk('c@x.com', { paidThrough: day(5), sub: { status: 'active', periodEnd: day(3) } });
const batches = [0, 1, 2, 3, 4, 5].map(n => ids.slice(n * 23, n * 23 + 23).map(x => x.i)); // 6 x 23 = 138 distinct properties
const res = await Promise.all(batches.map((b, n) => (n % 2 ? X : X2).reserve(C, b, 'csv'))); const okN = res.filter(x => x.ok); for (const x of okN) await X.complete(C, x); u = await X.usage(C);
ok(u.used <= 100 && okN.length >= 1 && okN.length <= 4, 'simultaneous requests from two instances never go above 100 (used ' + u.used + ', accepted ' + okN.length + ' of 6)');
// --- reset with the subscription period ---
P.sub.periodEnd = day(10); await auth.saveUser(P); u = await X.usage(P); ok(u.used === 0 && u.remaining === 100 && u.resets === day(10), 'allowance resets when the subscription period renews; nothing rolls over');
const stale = await mk('s@x.com', { paidThrough: day(5), sub: { status: 'active', periodEnd: day(-2) } }); ok(X.periodOf(stale).end >= day(0), 'a late Stripe update never leaves an ended week open');
// --- plan / lookup ---
ok(X.lookup({ i: 'XX|nowhere|1|' }) === null && X.lookup({ i: 'x'.repeat(300) }) === null, 'unknown ids are not found (nothing invented)');
const pl = await X.plan(P, [ids[0].i, ids[1].i]); ok(pl.fresh === 2 && pl.after === 98 && pl.fits, 'preview says what the download will use');
// --- the function: access rules, formats, files, history, collections ---
const ck = async e => (await auth.sessionCookie(e)).split(';')[0];
const call = async (cookie, method, body, qs = '') => { const r = await exp(new Request('http://x/.netlify/functions/export' + qs, { method, headers: { cookie: cookie || '', 'content-type': 'application/json' }, body: method === 'POST' ? JSON.stringify(body || {}) : undefined })); return r; };
const J = async r => r.json();
let r2 = await call('', 'GET'); ok(r2.status === 401, 'signed-out visitors are refused');
await mk('free@x.com', {}); const fc = await ck('free@x.com');
r2 = await call(fc, 'POST', { action: 'export', items: [ids[0]], format: 'csv', confirm: true }); ok(r2.status === 402, 'Free members cannot export');
r2 = await call(fc, 'POST', { action: 'preview', items: [ids[0]] }); ok(r2.status === 402, 'Free members cannot use the Pro export tools');
r2 = await call(fc, 'GET'); ok((await J(r2)).paid === false, 'Free members just see that exports are a Pro feature');
const E = await mk('e@x.com', { paidThrough: day(5), sub: { status: 'active', periodEnd: day(3) } }); const ec = await ck('e@x.com');
r2 = await call(ec, 'POST', { action: 'export', items: [ids[0]], format: 'csv' }); ok(r2.status === 400, 'export needs the confirmation step');
r2 = await call(ec, 'POST', { action: 'export', items: [ids[0]], format: 'exe', confirm: true }); ok(r2.status === 400, 'only CSV, Excel, PDF, ZIP are allowed');
r2 = await call(ec, 'POST', { action: 'export', items: [ids[0], { i: 'CO|Nowhere|9|' }], format: 'csv', confirm: true }); let d = await J(r2); ok(r2.status === 422 && d.missing.length === 1, 'an unknown property stops the export');
d = await J(await call(ec, 'GET')); ok(d.used === 0, 'a refused export used nothing');
const counts = {};
for (const [fmt, n] of [['csv', 3], ['xlsx', 3], ['pdf', 3], ['zip', 3]]) { r2 = await call(ec, 'POST', { action: 'export', items: ids.slice(0, n), format: fmt, confirm: true }); d = await J(r2); ok(r2.status === 200 && d.count === n, fmt + ' export of ' + n + ' works'); counts[fmt] = d; }
ok(counts.csv.credits === 3 && counts.xlsx.credits === 0 && counts.pdf.credits === 0 && counts.zip.credits === 0, 'CSV, Excel, PDF and ZIP follow the same counting: 3 properties = 3 credits, other formats of the same 3 are free');
d = await J(await call(ec, 'GET')); ok(d.used === 3 && d.remaining === 97 && d.history.length === 4, 'the counter and download history update right away');
const fetchFile = async fmt => { const rr = await call(ec, 'GET', null, '?file=' + counts[fmt].job); return { rr, buf: Buffer.from(await rr.arrayBuffer()) }; };
let f = await fetchFile('csv'); const text = f.buf.toString('utf8'); ok(f.rr.status === 200 && text.split('\r\n')[0].includes('Owner name') && text.includes(ids[0].i.split('|')[2]), 'CSV downloads with readable headers and the parcel IDs');
f = await fetchFile('pdf'); ok(f.buf.slice(0, 5).toString() === '%PDF-' && f.buf.toString('latin1').includes('Property information sheet'), 'PDF is a real information sheet');
f = await fetchFile('xlsx'); ok(f.buf.slice(0, 2).toString() === 'PK', 'Excel file is a real workbook'); fs.writeFileSync(path.join(os.tmpdir(), 'ppa-test.xlsx'), f.buf);
f = await fetchFile('zip'); ok(f.buf.slice(0, 2).toString() === 'PK' && f.buf.includes(Buffer.from('properties.csv')), 'ZIP holds one PDF per property plus a CSV');
const O = await call(await ck('p@x.com'), 'GET', null, '?file=' + counts.csv.job); ok(O.status === 404, 'another member cannot download your files');
r2 = await call('', 'GET', null, '?file=' + counts.csv.job); ok(r2.status === 401, 'files need a signed-in session (no public links)');
// limit through the function
r2 = await call(ec, 'POST', { action: 'export', items: ids.slice(0, 100), format: 'csv', confirm: true }); d = await J(r2); ok(r2.status === 200 && d.remaining === 0, 'exporting 100 uses the whole week');
r2 = await call(ec, 'POST', { action: 'export', items: [ids[100]], format: 'xlsx', confirm: true }); d = await J(r2); ok(r2.status === 429 && d.limit && /resets on/.test(d.error), 'the 101st is blocked with a friendly reset message, in any format');
r2 = await call(ec, 'POST', { action: 'preview', items: ids.slice(50, 120) }); d = await J(r2); ok(d.fits === false && d.fresh === 20, 'the preview warns before the member confirms');
// owner
const OW = await mk('o@x.com', { owner: true }); const oc = await ck('o@x.com'); r2 = await call(oc, 'POST', { action: 'export', items: ids.slice(0, 100), format: 'csv', confirm: true }); d = await J(r2); ok(r2.status === 200 && d.credits === 0, 'the owner can export without using or hitting the limit');
d = await J(await call(oc, 'GET')); ok(d.unlimited === true && d.owner === true, 'the owner is shown as unlimited');
// collections
r2 = await call(ec, 'POST', { action: 'colCreate', name: 'Virginia Vacant Land', items: ids.slice(0, 5) }); d = await J(r2); ok(d.ok && d.list.items.length === 5, 'create a saved list');
const lid = d.list.id; r2 = await call(ec, 'POST', { action: 'colCreate', name: 'Properties to Research' }); d = await J(r2); const lid2 = d.list.id; ok(!!lid2, 'create a second list');
r2 = await call(ec, 'POST', { action: 'colMove', from: lid, to: lid2, items: ids.slice(0, 2) }); d = await J(r2); ok(d.lists.find(l => l.id === lid2).items.length === 2 && d.lists.find(l => l.id === lid).items.length === 3, 'move properties between lists');
r2 = await call(ec, 'POST', { action: 'selSave', items: ids.slice(0, 7) }); d = await J(await call(ec, 'GET')); ok(d.sel.length === 7 && d.used === 100, 'selection is saved to the account and organizing never changes credits');
r2 = await call(ec, 'POST', { action: 'info', items: ids.slice(0, 3) }); d = await J(r2); ok(d.rows.length === 3 && 'Owner name' in d.rows[0], 'comparing properties reads info without credits');
d = await J(await call(ec, 'GET')); ok(d.used === 100, 'viewing, comparing, saving did not use any credits');
console.log('passed', pass);
