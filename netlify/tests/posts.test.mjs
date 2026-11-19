// Run: node netlify/tests/posts.test.mjs   (file-backed storage; TEST FIXTURE accounts). Posts and profile photos through the real API.
import assert from 'node:assert/strict'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
process.env.USERS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'posts-')); process.env.FOUNDER_EMAIL = 'founder@example.com'; process.env.COMMUNITY_WRITE_LIMIT = '100000'; process.env.COMMUNITY_READ_LIMIT = '100000'; process.env.POST_LIMIT_HOUR = '4';
const auth = await import('../lib/auth.mjs'); const api = (await import('../functions/community.mjs')).default; const media = (await import('../functions/media.mjs')).default;
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok -', m); };
await auth.createUser('founder@example.com', 'password123', true); await auth.createUser('ann@example.com', 'password123', false); await auth.createUser('pat@example.com', 'password123', false);
const pat = await auth.getUser('pat@example.com'); pat.paidThrough = '2999-01-01'; await auth.kvPut('u_' + (await import('node:crypto')).createHash('sha256').update('pat@example.com').digest('hex'), pat);
const ck = async e => (await auth.sessionCookie(e)).split(';')[0];
const F = await ck('founder@example.com'), A = await ck('ann@example.com'), P = await ck('pat@example.com');
let n = 0; const call = async (cookie, o) => { const post = !!o.action; const r = await api(new Request('http://x/c' + (post ? '' : '?' + new URLSearchParams(o)), { method: post ? 'POST' : 'GET', body: post ? JSON.stringify(o) : undefined, headers: { cookie: cookie || '', 'x-nf-client-connection-ip': '7.7.7.' + (++n % 250) } }), {}); return { s: r.status, j: await r.json() }; };
const ma = (await call(A, { me: 1 })).j.me, mp = (await call(P, { me: 1 })).j.me, mf = (await call(F, { me: 1 })).j.me;
ok(auth.isPaid(await auth.getUser('pat@example.com')) && mp.paid && !ma.paid, 'TEST FIXTURE: pat is paid, ann is free');
let r = await call(A, { action: 'createPost', text: 'hello' }); ok(r.s === 402 && r.j.upgrade, 'free member cannot post (server refuses)');
r = await call(P, { action: 'createPost', text: '   ' }); ok(r.s === 400, 'empty post refused');
r = await call(P, { action: 'createPost', text: 'First <script>alert(1)</script> post\n\n\n\nline two https://evil.example' }); ok(r.s === 200 && !/[<>]/.test(r.j.post.text) && r.j.post.text.includes('\n\nline two'), 'post saved; < > removed, line breaks kept');
r = await call(P, { action: 'createPost', text: 'x'.repeat(5000) }); ok(r.s === 200 && r.j.post.text.length === 1000, 'posts are cut at 1,000 characters');
r = await call(F, { action: 'createPost', text: 'From the founder' }); ok(r.s === 200, 'owner can post');
let fd = await call(A, { feed: 1 }); ok(fd.s === 200 && fd.j.rows.length === 3 && fd.j.rows[0].text === 'From the founder' && !fd.j.canPost, 'free members read the feed, newest first');
ok(fd.j.rows[0].author.username === 'pricepocketasset' && fd.j.rows[0].author.verified, 'post shows author and blue check');
let pp = await call(A, { u: mp.username, posts: 1 }); ok(pp.j.rows.length === 2 && pp.j.rows.every(x => x.author.uid === mp.uid), 'profile shows only that member\'s posts');
ok((await call(A, { u: mp.username })).j.profile.stats.posts === 2, 'post count on profile');
const key = pp.j.rows[0].key;
r = await call(A, { action: 'deletePost', key }); ok(r.s === 403, 'cannot delete someone else\'s post');
r = await call(A, { action: 'reportPost', key, category: 'Spam', details: 'x' }); ok(r.s === 200, 'member can report a post');
let rep = await call(F, { reports: 1 }); ok(rep.j.reports.some(x => x.post === key && x.postText), 'report reaches the owner with the post text');
r = await call(P, { action: 'createPost', text: 'third' }); r = await call(P, { action: 'createPost', text: 'fourth' }); ok(r.s === 429, 'posting is rate limited');
r = await call(F, { action: 'deletePost', key }); ok(r.s === 200, 'owner can delete any post');
pp = await call(A, { u: mp.username, posts: 1 }); ok(!pp.j.rows.some(x => x.key === key), 'deleted post is gone');
r = await call(P, { action: 'deletePost', key: pp.j.rows[0].key }); ok(r.s === 200, 'member deletes own post');
{ const c = (await call(A, { u: mp.username })).j.profile.stats.posts; ok(c === 1, 'post count goes down (got ' + c + ')'); }
// blocks hide posts
await call(A, { action: 'block', uid: mp.uid }); fd = await call(A, { feed: 1 }); ok(!fd.j.rows.some(x => x.author.uid === mp.uid), 'blocked member\'s posts are hidden'); await call(A, { action: 'unblock', uid: mp.uid });
// photos
const jpg = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xdb]), Buffer.alloc(400, 7), Buffer.from([0xff, 0xd9])]).toString('base64');
const exif = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0, 20]), Buffer.from('Exif\0\0', 'latin1'), Buffer.alloc(400, 7)]).toString('base64');
r = await call(A, { action: 'setPhoto', kind: 'avatar', data: jpg }); ok(r.s === 402, 'free member cannot change photos (server refuses)');
r = await call(P, { action: 'setPhoto', kind: 'avatar', data: 'data:image/jpeg;base64,' + Buffer.from('<html>' + 'a'.repeat(400)).toString('base64') }); ok(r.s === 400, 'non-picture refused even if labeled JPEG');
r = await call(P, { action: 'setPhoto', kind: 'avatar', data: exif }); ok(r.s === 400 && /camera data/.test(r.j.error), 'picture with hidden EXIF data refused');
r = await call(P, { action: 'setPhoto', kind: 'cover', data: 'data:image/jpeg;base64,' + Buffer.alloc(2e6, 1).toString('base64') }); ok(r.s === 413, 'too-large picture refused');
r = await call(P, { action: 'setPhoto', kind: 'avatar', data: jpg }); ok(r.s === 200, 'paid member sets a profile photo');
r = await call(P, { action: 'setPhoto', kind: 'cover', data: jpg }); ok(r.s === 200, 'paid member sets a background photo');
const prof = (await call(A, { u: mp.username })).j.profile; ok(/media\?k=avatar/.test(prof.photo) && /media\?k=cover/.test(prof.coverPhoto), 'profile returns photo links');
let m = await media(new Request('http://x' + prof.photo, { headers: { cookie: A } })); ok(m.status === 200 && m.headers.get('content-type') === 'image/jpeg' && (await m.arrayBuffer()).byteLength > 400, 'photo is served to signed-in members');
m = await media(new Request('http://x' + prof.photo)); ok(m.status === 401, 'photos need sign-in');
r = await call(A, { action: 'ownerRemovePhoto', username: mp.username, kind: 'avatar' }); ok(r.s === 403, 'only the owner can remove someone else\'s photo');
r = await call(F, { action: 'ownerRemovePhoto', username: mp.username, kind: 'avatar' }); ok(r.s === 200 && !(await call(A, { u: mp.username })).j.profile.photo, 'owner removes a photo');
r = await call(P, { action: 'setPhoto', kind: 'cover', data: null }); ok(r.s === 200 && !(await call(A, { u: mp.username })).j.profile.coverPhoto, 'member removes own background photo');
console.log('# pass ' + pass);
