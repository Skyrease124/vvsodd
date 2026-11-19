// Run: node netlify/tests/messages.test.mjs  (file-backed storage; TEST FIXTURE accounts; OneSignal calls captured, never sent).
import assert from 'node:assert/strict'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
process.env.USERS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'msg-')); process.env.FOUNDER_EMAIL = 'founder@example.com'; process.env.ONESIGNAL_REST_API_KEY = 'os_v2_app_testkey'; process.env.SESSION_SECRET = 't'; process.env.COMMUNITY_WRITE_LIMIT = '100000'; process.env.COMMUNITY_READ_LIMIT = '100000';
const sent = []; globalThis.fetch = async (url, o) => { if (String(url).includes('onesignal.com')) { sent.push(JSON.parse(o.body)); return new Response(JSON.stringify({ id: 'n' + sent.length }), { status: 200 }); } throw new Error('no network in tests'); };
const auth = await import('../lib/auth.mjs'); const OSL = await import('../lib/onesignal.mjs'); const api = (await import('../functions/messages.mjs')).default; const comm = (await import('../functions/community.mjs')).default;
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok -', m); };
const old = new Date(Date.now() - 30 * 864e5).toISOString();
const mk = async (e, patch) => { const u = await auth.createUser(e, 'password123', false); Object.assign(u, { created: old }, patch || {}); await auth.saveUser(u); return (await auth.sessionCookie(e)).split(';')[0]; };
const F = await mk('founder@example.com', { owner: true }), A = await mk('ann@example.com', { push: { enabled: true, subscribed: true } }), B = await mk('bob@example.com', { push: { enabled: true, subscribed: true } }), Cy = await mk('cy@example.com'), N = await mk('new@example.com', { created: new Date().toISOString() });
const call = async (fn, c, o) => { const post = !!o.action; const r = await fn(new Request('http://x/m' + (post ? '' : '?' + new URLSearchParams(o)), { method: post ? 'POST' : 'GET', body: post ? JSON.stringify(o) : undefined, headers: { cookie: c || '' } }), {}); return { s: r.status, j: await r.json() }; };
const m = (c, o) => call(api, c, o), cm = (c, o) => call(comm, c, o);
const me = async c => (await cm(c, { me: 1 })).j.me; const setName = async (c, u, n) => cm(c, { action: 'saveProfile', username: u, name: n });
await setName(A, 'ann_t', 'Ann Sample'); await setName(B, 'bob_t', 'Bob Sample'); await setName(Cy, 'cy_t', 'Cy Sample'); await setName(N, 'newbie_t', 'New Sample');
const ma = await me(A), mb = await me(B), mc = await me(Cy);
let id = 0; const cmid = () => 'cm' + String(++id).padStart(8, '0');
ok((await m('', { list: 'inbox' })).s === 401, 'messages need sign-in');
// B lets everyone message: direct
await cm(B, { action: 'saveProfile', privacy: { whoCanMessage: 'everyone' } });
let r = await m(A, { to: 'bob_t' }); ok(r.j.canSend && r.j.mode === 'direct', 'open conversation: direct when privacy allows');
sent.length = 0; r = await m(A, { action: 'send', to: 'bob_t', body: 'Hey <script>alert(1)</script> did you see that drop?', cmid: cmid() }); const cid = r.j.cid;
ok(r.s === 200 && !/[<>]/.test(r.j.message.body), 'send works; HTML characters removed');
ok(sent.length === 1 && sent[0].include_aliases.external_id[0] === OSL.externalId('bob@example.com') && /New message from Ann Sample/.test(sent[0].headings.en) && sent[0].url === 'https://pricepocketasset.com/messages/?c=' + cid, 'push to Bob by External ID; tapping opens the conversation');
const again = await m(A, { action: 'send', to: 'bob_t', body: 'Hey again', cmid: 'cm00000001' }); ok(again.j.duplicate && again.j.message.id === r.j.message.id, 'retried send (same client id) never duplicates');
let u = await m(B, { unread: 1 }); ok(u.j.unread === 1, 'unread count for recipient');
let inbox = await m(B, { list: 'inbox' }); ok(inbox.j.rows.length === 1 && inbox.j.rows[0].other.username === 'ann_t' && inbox.j.rows[0].unread === 1 && inbox.j.rows[0].preview.startsWith('Hey'), 'inbox preview with unread badge');
let conv = await m(B, { c: cid }); ok(conv.j.messages.length === 1 && !conv.j.messages[0].mine, 'recipient reads the conversation');
ok((await m(B, { unread: 1 })).j.unread === 0, 'opening marks read');
ok((await m(A, { c: cid })).j.theirReadAt, 'sender sees read receipt');
// presence: B is viewing -> no push
sent.length = 0; await m(A, { action: 'send', to: 'bob_t', body: 'second', cmid: cmid() }); ok(sent.length === 0, 'no push while the recipient is looking at the conversation');
let since = conv.j.messages[0].id; conv = await m(B, { c: cid, since }); ok(conv.j.messages.length === 1 && conv.j.messages[0].body === 'second', 'polling returns only new messages');
r = await m(A, { action: 'send', to: 'bob_t', body: 'second', cmid: cmid() }); ok(r.s === 429, 'identical message repeated quickly is refused');
// access control
ok((await m(Cy, { c: cid })).s === 404, 'a third member cannot read the conversation by changing the id');
ok((await m(Cy, { c: 'ffffffffffffffffffff' })).s === 404 && (await m(Cy, { c: '../x' })).s === 404, 'bad or unknown ids give the same not-found');
r = await m(Cy, { action: 'report', cid, category: 'Spam' }); ok(r.s === 404, 'outsiders cannot report inside a conversation');
// privacy: C allows followers only; A doesn't follow C -> request
await cm(Cy, { action: 'saveProfile', privacy: { whoCanMessage: 'followers' } });
r = await m(A, { to: 'cy_t' }); ok(r.j.canSend && r.j.mode === 'request', 'not connected: message goes as a request');
sent.length = 0; r = await m(A, { action: 'send', to: 'cy_t', body: 'Hi, quick question', cmid: cmid() }); const rcid = r.j.cid; ok(r.j.state === 'request', 'request created');
ok((await m(Cy, { list: 'inbox' })).j.rows.length === 0 && (await m(Cy, { list: 'requests' })).j.rows.length === 1, 'request lands in Message Requests, not the inbox');
let rc = await m(Cy, { c: rcid }); ok(rc.j.incomingRequest && !rc.j.canSend, 'recipient sees the request and cannot reply until accepting');
await m(A, { action: 'send', to: 'cy_t', body: 'two', cmid: cmid() }); await m(A, { action: 'send', to: 'cy_t', body: 'three', cmid: cmid() });
r = await m(A, { action: 'send', to: 'cy_t', body: 'four', cmid: cmid() }); ok(r.s === 429, 'a pending request holds at most 3 messages (no spam)');
r = await m(Cy, { action: 'decide', cid: rcid, decision: 'accept' }); ok(r.s === 200 && (await m(Cy, { list: 'inbox' })).j.rows.length === 1, 'accept moves it to the inbox');
r = await m(Cy, { action: 'send', to: 'ann_t', body: 'Sure, ask away', cmid: cmid() }); ok(r.s === 200 && r.j.state === 'active', 'after accepting, both can message');
// decline cooldown
await cm(B, { action: 'saveProfile', privacy: { whoCanMessage: 'mutual' } });
const n1 = await m(N, { action: 'send', to: 'bob_t', body: 'hello from new', cmid: cmid() }); ok(n1.j.state === 'request', 'mutual-only: stranger sends a request');
await m(B, { action: 'decide', cid: n1.j.cid, decision: 'decline' }); r = await m(N, { action: 'send', to: 'bob_t', body: 'please', cmid: cmid() }); ok(r.s === 403, 'after a decline the sender cannot send another request (30 days)');
ok(!(await m(B, { list: 'requests' })).j.rows.length, 'declined request disappears');
// requests off / nobody
await cm(B, { action: 'saveProfile', privacy: { whoCanMessage: 'followers', allowRequests: false } });
r = await m(Cy, { to: 'bob_t' }); ok(!r.j.canSend && r.j.reason === 'privacy', 'requests off: strangers cannot message');
ok(!(await cm(Cy, { u: 'bob_t' })).j.rel.canMessage.ok, 'profile hides the Message button when not allowed');
await cm(B, { action: 'saveProfile', privacy: { whoCanMessage: 'nobody', allowRequests: true } }); r = await m(Cy, { action: 'send', to: 'bob_t', body: 'x', cmid: cmid() }); ok(r.s === 403, 'nobody: refused on the server');
ok((await m(A, { action: 'send', to: 'bob_t', body: 'existing chats keep working', cmid: cmid() })).s === 200, 'an already accepted conversation keeps working');
// new-account request limit (5/day)
for (const [i, e] of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].entries()) { const c = await mk(e + '@example.com'); await setName(c, 'tgt_' + e, 'T'); }
let last; for (const e of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']) last = await m(N, { action: 'send', to: 'tgt_' + e, body: 'hi ' + e, cmid: cmid() }); ok(last.s === 429 && /New accounts/.test(last.j.error), 'brand-new accounts: 5 new message requests a day');
// blocking
sent.length = 0; r = await m(B, { action: 'block', cid }); ok(r.s === 200, 'block from inside the conversation');
r = await m(A, { action: 'send', to: 'bob_t', body: 'are you there', cmid: cmid() }); ok(r.s === 403 && !/block/i.test(r.j.error), 'blocked: cannot send (message does not say "blocked")');
ok(!(await m(A, { c: cid })).j.canSend && !(await m(B, { c: cid })).j.canSend, 'conversation becomes read-only for both');
ok(sent.length === 0, 'no push between blocked members');
ok(!(await m(A, { to: 'bob_t' })).j.canSend, 'blocked member cannot start a new request');
// report a message -> existing report queue with only that message
const ac = await m(A, { c: rcid }); const cyMsg = (await m(Cy, { c: rcid })).j.messages.find(x => x.mine);
const theirs = (await m(Cy, { c: rcid })).j.messages.find(x => !x.mine); r = await m(Cy, { action: 'report', cid: rcid, category: 'Spam', messageId: theirs.id }); ok(r.s === 200, 'report a message');
r = await m(Cy, { action: 'report', cid: rcid, category: 'Spam', messageId: cyMsg.id }); ok(r.s === 404, 'cannot report your own message');
const reps = (await cm(F, { reports: 1 })).j.reports; const dm = reps.find(x => x.dm); ok(dm && dm.dm.text === theirs.body && dm.targetName === 'ann_t', 'report reaches the existing owner queue with only the reported message');
// owner remove (logged), members cannot
r = await m(A, { action: 'ownerRemove', cid: rcid, messageId: dm.dm.messageId }); ok(r.s === 403, 'members cannot remove messages');
r = await m(F, { action: 'ownerRemove', cid: rcid, messageId: dm.dm.messageId }); ok(r.s === 200 && (await auth.kvGet('mlog'))[0].action === 'remove-message', 'owner removes a reported message; action logged');
ok((await m(F, { c: rcid })).s === 404, 'the owner cannot open private conversations directly');
// notifications off / preview off
await cm(Cy, { action: 'saveProfile', notif: { msgPreview: false } }); const cyU = await auth.getUser('cy@example.com'); cyU.push = { enabled: true, subscribed: true }; await auth.saveUser(cyU);
await auth.kvPut('mp_' + mc.uid, null);
sent.length = 0; await m(A, { action: 'send', to: 'cy_t', body: 'secret details', cmid: cmid() }); ok(sent.length === 1 && sent[0].headings.en === 'New PricePocket message' && !/secret/.test(sent[0].contents.en), 'preview off: push hides sender and text');
await cm(Cy, { action: 'saveProfile', notif: { messages: false } }); sent.length = 0; await m(A, { action: 'send', to: 'cy_t', body: 'more', cmid: cmid() }); ok(sent.length === 0, 'message notifications off: no push');
// hide
r = await m(A, { action: 'hide', cid: rcid }); ok(r.s === 200 && !(await m(A, { list: 'inbox' })).j.rows.some(x => x.cid === rcid), 'delete conversation from my inbox');
// burst limit
process.env.MSG_PER_MIN = '3'; let lim; for (let i = 0; i < 5; i++) lim = await m(Cy, { action: 'send', to: 'ann_t', body: 'b' + i, cmid: cmid() }); ok(lim.s === 429, 'rate limit on bursts');
console.log('# pass ' + pass);
