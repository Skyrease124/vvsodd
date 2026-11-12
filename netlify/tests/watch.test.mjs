// Run: node netlify/tests/watch.test.mjs   (uses a temporary folder for member data; no network)
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import assert from 'node:assert/strict';
process.env.USERS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ppa-watch-')); process.env.SESSION_SECRET = 't';
const auth = await import('../lib/auth.mjs'); const { default: watch } = await import('../functions/watch.mjs'); const W = await import('../lib/watch.mjs');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok -', m); };
const mk = async e => { await auth.createUser(e, 'pw-123456', false); return (await auth.sessionCookie(e)).split(';')[0]; };
const call = async (cookie, action, body, method) => { const r = await watch(new Request('http://x/.netlify/functions/watch' + (method === 'GET' ? '?action=' + action + (body ? '&' + new URLSearchParams(body) : '') : ''), { method: method || 'POST', headers: { cookie: cookie || '' }, body: method === 'GET' ? undefined : JSON.stringify(Object.assign({ action }, body || {})) }), {}); return { s: r.status, j: await r.json() }; };
const A = await mk('a@example.com'), B = await mk('b@example.com');
ok((await call('', 'me', null, 'GET')).s === 401, 'signed-out visitors cannot read a watchlist');
const CHG = 'CO|Larimer|9517411019|', GONE = 'CO|Larimer|9433000009|', SOLD = 'MI|Wayne|01002263|';
for (const k of [CHG, GONE, SOLD]) ok((await call(A, 'watch', { key: k, label: k })).j.ok, 'watch ' + k);
ok(!(await call(A, 'watch', { key: 'bad key' })).j.ok, 'a malformed parcel key is refused');
// the live data was imported on 2026-11-11: pretend A started watching before that, so the test does not depend on today's date
{ const f = fs.readdirSync(process.env.USERS_DIR).find(x => x.startsWith('watch_') && JSON.parse(fs.readFileSync(path.join(process.env.USERS_DIR, x))).email === 'a@example.com'); const d = JSON.parse(fs.readFileSync(path.join(process.env.USERS_DIR, f))); d.watch.filter(x => !x.key.startsWith('MI|')).forEach(x => { x.addedAt = '2026-11-05T00:00:00Z'; }); fs.writeFileSync(path.join(process.env.USERS_DIR, f), JSON.stringify(d)); }
let me = (await call(A, 'me', null, 'GET')).j;
ok(me.watch.length === 3, 'three parcels on the watchlist');
const n = me.notifications;
const amt = n.find(x => x.key === CHG && x.type === 'amount_changed');
ok(amt && amt.old === 1662.07 && amt.new === 62.15 && amt.detectedAt && amt.source.url, 'changed amount shows previous value, new value, date detected and source');
ok(n.some(x => x.key === GONE && x.type === 'no_longer_listed' && x.text === 'No longer listed. Outcome unconfirmed.'), 'a parcel missing from the later list says: No longer listed. Outcome unconfirmed.');
ok(!n.some(x => x.key === GONE && /sold|redeemed|withdrawn/i.test(x.text)), 'a missing parcel is never labelled sold, redeemed or withdrawn without an official record');
const sold = me.watch.find(x => x.key === SOLD).latest; ok(sold && sold.type === 'result_posted' && /\$14,500\.00/.test(sold.text) && /actual sale price/.test(sold.text), 'confirmed sale shows the actual published price ($14,500) as the latest verified update');
ok(!n.some(x => x.key === SOLD), 'events that happened before you started watching are in the timeline, not sent as new alerts');
ok(me.watch.find(x => x.key === GONE).noLongerListed, 'watchlist row flags No longer listed');
// preferences / read state
ok((await call(A, 'prefs', { types: { amount: false } })).j.prefs.types.amount === false, 'alert preferences save');
ok(!(await call(A, 'me', null, 'GET')).j.notifications.some(x => x.type === 'amount_changed'), 'turning a category off hides those alerts');
await call(A, 'seen', {}); ok((await call(A, 'me', null, 'GET')).j.unread === 0, 'mark all read');
ok((await call(A, 'unwatch', { key: SOLD })).j.watching === false && (await call(A, 'me', null, 'GET')).j.watch.length === 2, 'unwatch at any time');
// review gating: an unmatched result stays hidden until approved
const tl = W.readTL('wayne.json'); const held = tl.events.find(e => e.review);
ok(held && !W.visible(held, {}), 'an event waiting for admin review is hidden from customers');
ok(W.visible(held, { [held.reviewId]: { decision: 'approve' } }) && !W.visible(held, { [held.reviewId]: { decision: 'reject' } }), 'approve shows it, reject keeps it hidden');
// worksheets are private
const sheet = { decision: 'Bid', maxBid: 5000, notes: 'private note', est: { fees: 120 }, snap: { amount: 62.15 } };
ok((await call(A, 'wsSave', { key: CHG, sheet })).j.ok, 'member A saves a worksheet');
ok((await call(A, 'wsGet', { key: CHG }, 'GET')).j.sheet.notes === 'private note', 'member A can read it');
ok((await call(B, 'wsGet', { key: CHG }, 'GET')).j.sheet === null, 'member B cannot read member A\'s worksheet');
ok((await call(B, 'wsList', null, 'GET')).j.sheets.length === 0, 'member B\'s worksheet list is empty');
ok((await call('', 'wsGet', { key: CHG }, 'GET')).s === 401, 'signed-out visitors cannot read worksheets');
ok(!(await call(A, 'wsSave', { key: CHG, sheet: { decision: 'Hack', maxBid: 'abc', est: { 'bad key': 1 } } })).j.sheet.decision, 'worksheet fields are validated');
ok((await call(A, 'review', { id: 'x', decision: 'approve' })).s === 403, 'only the owner can approve reviews');
// email digest: sends once, never twice, and only after the member turned email on
import http from 'node:http';
const sent = []; const srv = http.createServer((q, r) => { let b = ''; q.on('data', c => b += c); q.on('end', () => { sent.push(JSON.parse(b)); r.writeHead(200, { 'content-type': 'application/json' }); r.end('{}'); }); }).listen(0);
process.env.MAIL_API_URL = 'http://127.0.0.1:' + srv.address().port + '/emails'; process.env.RESEND_API_KEY = 'test';
ok((await W.runDigest()).sent === 0 && sent.length === 0, 'no email is sent before the member turns email alerts on');
await call(A, 'prefs', { email: true, types: { amount: true } });
let d = JSON.parse(fs.readFileSync(path.join(process.env.USERS_DIR, fs.readdirSync(process.env.USERS_DIR).find(f => f.startsWith('watch_') && JSON.parse(fs.readFileSync(path.join(process.env.USERS_DIR, f))).email === 'a@example.com'))));
d.prefs.emailSince = '2026-11-01'; fs.writeFileSync(path.join(process.env.USERS_DIR, fs.readdirSync(process.env.USERS_DIR).find(f => f.startsWith('watch_') && JSON.parse(fs.readFileSync(path.join(process.env.USERS_DIR, f))).email === 'a@example.com')), JSON.stringify(d));
const r1 = await W.runDigest(); ok(r1.sent === 1 && sent.length === 1 && /1,662\.07 to \$62\.15/.test(sent[0].text), 'digest email lists the change with old and new values');
const r2 = await W.runDigest(); ok(r2.sent === 0 && sent.length === 1, 'running the digest again (or reimporting the same file) never sends a duplicate');
srv.close();
console.log('\n' + pass + ' checks passed');
