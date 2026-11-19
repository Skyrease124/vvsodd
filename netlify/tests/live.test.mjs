// Run: node netlify/tests/live.test.mjs   (file-backed storage; the LiveKit room service is mocked, tokens are really signed and verified)
import assert from 'node:assert/strict'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
process.env.USERS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'live-')); process.env.FOUNDER_EMAIL = 'founder@example.com';
process.env.COMMUNITY_WRITE_LIMIT = process.env.COMMUNITY_READ_LIMIT = process.env.LIVE_WRITE_LIMIT = process.env.LIVE_READ_LIMIT = '100000';
const auth = await import('../lib/auth.mjs'); const L = await import('../lib/live.mjs'); const api = (await import('../functions/live.mjs')).default; const C = await import('../lib/community.mjs');
const { TokenVerifier } = await import('livekit-server-sdk');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok -', m); };
const calls = { create: [], del: [], rm: [] }, people = {};
L._setRoomService({ createRoom: async o => { calls.create.push(o); return o; }, deleteRoom: async n => { calls.del.push(n); }, removeParticipant: async (r, i) => { calls.rm.push([r, i]); },
  listParticipants: async r => people[r] || [] });
for (const e of ['founder@example.com', 'hostie@example.com', 'guesty@example.com', 'other@example.com']) await auth.createUser(e, 'password123', e === 'founder@example.com');
const ck = async e => (await auth.sessionCookie(e)).split(';')[0];
const H = await ck('hostie@example.com'), G = await ck('guesty@example.com'), O = await ck('other@example.com');
let n = 0;
const call = async (cookie, o) => { const post = !!o.action; const r = await api(new Request('http://x/l' + (post ? '' : '?' + new URLSearchParams(o)), { method: post ? 'POST' : 'GET', body: post ? JSON.stringify(o) : undefined, headers: { cookie: cookie || '', 'x-nf-client-connection-ip': '5.5.5.' + (++n % 250) } }), {}); return { s: r.status, j: await r.json() }; };
const profile = async (e) => C.ensureProfile(await auth.getUser(e));
const hp = await profile('hostie@example.com'), gp = await profile('guesty@example.com');
// ---- not configured: a clear message, nothing is created
let r = await call(H, { action: 'start', title: 'Florida Tax Deed Q&A' });
ok(r.s === 503 && r.j.setup === true && /LIVEKIT_URL/.test(r.j.error) && /Netlify/.test(r.j.error) && calls.create.length === 0, 'without the three LiveKit variables: a clear "add them in Netlify" message and nothing is created');
process.env.LIVEKIT_URL = 'wss://example.livekit.cloud'; process.env.LIVEKIT_API_KEY = 'APITESTKEY'; process.env.LIVEKIT_API_SECRET = 'testsecret-0123456789-0123456789-0123456789';
// ---- auth required
ok((await call('', { token: 'x' })).s === 401 && (await call('', { action: 'start', title: 'abc' })).s === 401 && (await call('', { u: 'x' })).s === 401, 'no sign-in: every request is refused (test 10)');
// ---- start validation
ok((await call(H, { action: 'start', title: 'ab' })).s === 400, 'a title is required');
ok((await call(H, { action: 'start', title: 'Subscribers only', visibility: 'subscribers' })).s === 400, 'only public lives are accepted for now');
ok((await call(H, { action: 'start', title: 'Hijack', host: gp.uid })).s === 403 && calls.create.length === 0, 'cannot start a live under another member\'s profile');
r = await call(H, { action: 'start', title: '  Florida <b>Tax</b> Deed Q&A  ' }); const sid = r.j.session.id;
ok(r.s === 200 && !/[<>]/.test(r.j.session.title) && r.j.session.is_live && r.j.session.visibility === 'public' && calls.create.length === 1 && /^ppl-/.test(calls.create[0].name), 'host starts a live: sanitized title, a private-looking room name is created on LiveKit');
r = await call(H, { action: 'start', title: 'Second try' }); ok(r.s === 200 && r.j.already && r.j.session.id === sid && calls.create.length === 1, 'a second start returns the same live (never two active lives for one host)');
// ---- profile status
r = await call(G, { u: hp.username }); ok(r.j.live && r.j.live.id === sid && r.j.live.title.startsWith('Florida') && r.j.live.host.username === hp.username, 'another member sees LIVE NOW with the title on the host profile (test 2)');
ok(!JSON.stringify(r.j).includes(calls.create[0].name) && !/room/i.test(JSON.stringify(r.j.live)), 'the status response never reveals the room name');
// ---- tokens
const ver = new TokenVerifier(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
r = await call(H, { token: sid }); let claims = await ver.verify(r.j.token);
ok(r.s === 200 && r.j.role === 'host' && claims.sub === hp.uid && claims.video.roomAdmin === true && claims.video.canPublish && claims.video.room === calls.create[0].name && claims.video.roomJoin, 'host token: identity is the host\'s own id, can publish and administer the room');
ok(claims.exp - claims.nbf <= 15 * 60 + 5 && JSON.parse(claims.metadata).role === 'host', 'token is short-lived (15 minutes) and carries the role');
r = await call(G, { token: sid }); claims = await ver.verify(r.j.token);
ok(r.s === 200 && r.j.role === 'guest' && claims.sub === gp.uid && !claims.video.roomAdmin && claims.video.canPublish && claims.video.canSubscribe, 'guest token: identity is the guest\'s own id, may use camera and microphone, cannot administer the room (test 3)');
ok(claims.video.room === calls.create[0].name && !('identity' in (r.j.me || {})), 'token is for exactly this room');
r = await call(G, { token: 'ffffffffffffffff' }); ok(r.s === 404, 'a room that does not exist cannot be entered (test 11)');
r = await call(G, { token: '../../etc/passwd' }); ok(r.s === 404, 'a malformed room id is refused');
// identity can never be chosen by the browser: extra parameters are ignored
r = await call(G, { token: sid, identity: hp.uid, user: hp.uid }); claims = await ver.verify(r.j.token); ok(claims.sub === gp.uid && r.j.role === 'guest', 'asking for a token "as the host" still gives the caller their own identity');
// ---- blocks and removal
await C.block(gp, hp.uid); ok((await call(G, { token: sid })).s === 403, 'a blocked member cannot join (either direction)'); await C.unblock(gp, hp.uid);
people[calls.create[0].name] = [{ identity: hp.uid, metadata: JSON.stringify({ role: 'host' }) }, { identity: gp.uid, metadata: JSON.stringify({ role: 'guest' }) }];
ok((await call(G, { u: hp.username })).j.live.viewers === 1, 'viewer count excludes the host');
ok((await call(G, { action: 'remove', id: sid, identity: gp.uid })).s === 403 && calls.rm.length === 0, 'a guest cannot remove anyone');
ok((await call(H, { action: 'remove', id: sid, identity: hp.uid })).s === 400, 'the host cannot remove themself');
ok((await call(H, { action: 'remove', id: sid, identity: 'zz' })).s === 400, 'removal needs a real participant id');
r = await call(H, { action: 'remove', id: sid, identity: gp.uid }); ok(r.s === 200 && calls.rm.length === 1 && calls.rm[0][1] === gp.uid && calls.rm[0][0] === calls.create[0].name, 'host removes a participant (test 7): LiveKit is told to disconnect them');
r = await call(G, { token: sid }); ok(r.s === 403 && /removed/.test(r.j.error), 'a removed guest cannot walk straight back in');
// ---- ending
ok((await call(O, { action: 'end', id: sid })).s === 403 && (await call(G, { action: 'end', id: sid })).s === 403, 'only the host can end a live');
ok((await call(O, { action: 'end', id: 'ffffffffffffffff' })).s === 404, 'ending an unknown live is a clear error');
r = await call(H, { action: 'end', id: sid }); ok(r.s === 200 && calls.del.length === 1 && calls.del[0] === calls.create[0].name, 'host ends the live (test 8): the LiveKit room is closed');
ok((await call(G, { u: hp.username })).j.live === null, 'the host profile stops showing LIVE immediately and stays ended on refresh (test 9)');
r = await call(O, { token: sid }); ok(r.s === 410 && r.j.ended === true, 'nobody can use an ended room: "This live has ended"');
r = await call(O, { s: sid }); ok(r.j.session.is_live === false && r.j.session.ended_at, 'the session record keeps is_live=false and ended_at');
ok((await call(H, { action: 'end', id: sid })).j.already === true, 'ending twice is harmless');
r = await call(H, { action: 'start', title: 'Round two' }); ok(r.s === 200 && !r.j.already && r.j.session.id !== sid && calls.create.length === 2, 'after ending, the host can start a new live');
// ---- LiveKit webhook: signed, closes a room that LiveKit ended on its own
{ const { AccessToken } = await import('livekit-server-sdk'); const wh = (await import('../functions/livekit-webhook.mjs')).default; const cryptoMod = await import('node:crypto');
  const s2 = (await call(G, { action: 'start', title: 'Guest live' })).j.session, room2 = calls.create[calls.create.length - 1].name;
  const body = JSON.stringify({ event: 'room_finished', room: { name: room2 }, id: 'EV_1', createdAt: Math.floor(Date.now() / 1000) });
  const sign = b => { const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET); at.sha256 = cryptoMod.createHash('sha256').update(b).digest('base64'); return at.toJwt(); };
  const hit = async (b, auth_) => (await wh(new Request('http://x/w', { method: 'POST', body: b, headers: { authorization: auth_ } }), {})).status;
  ok(await hit(body, 'bogus') === 401 && (await call(O, { token: s2.id })).s === 200, 'webhook without a valid LiveKit signature is refused and changes nothing');
  ok(await hit(body.replace('EV_1', 'EV_2'), await sign(body)) === 401, 'a signature for a different body is refused');
  ok(await hit(body, await sign(body)) === 200 && (await call(O, { token: s2.id })).s === 410 && (await call(O, { u: gp.username })).j.live === null, 'a signed room_finished marks the live ended (host closed the app): profile stops showing LIVE');
  ok(await hit(JSON.stringify({ event: 'participant_joined', room: { name: 'x' } }), await sign(JSON.stringify({ event: 'participant_joined', room: { name: 'x' } }))) === 200, 'other event types are accepted and ignored'); }
// ---- deactivated hosts disappear
const hu = await auth.getUser('hostie@example.com'); hu.revoked = true; await auth.saveUser(hu);
ok((await call(G, { u: hp.username })).j.live === null, 'a deactivated host never shows as live');
console.log(pass + ' passed');
