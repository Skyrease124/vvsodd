// Run: node netlify/tests/community.test.mjs   (file-backed storage; TEST FIXTURE accounts). Every permission rule is checked through the real API handler.
import assert from 'node:assert/strict'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
process.env.USERS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'comm-')); process.env.FOUNDER_EMAIL = 'founder@example.com'; process.env.COMMUNITY_WRITE_LIMIT = '100000'; process.env.COMMUNITY_READ_LIMIT = '100000';
const auth = await import('../lib/auth.mjs'); const C = await import('../lib/community.mjs'); const acct = await import('../functions/account.mjs'); const api = (await import('../functions/community.mjs')).default;
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok -', m); };
// An existing member created BEFORE the community feature existed (no profile yet)
await auth.createUser('legacy@example.com', 'password123', false);
await auth.createUser('founder@example.com', 'password123', true);
const signup = async e => (await acct.default(new Request('http://x/a', { method: 'POST', body: JSON.stringify({ action: 'signup', email: e, password: 'password123' }), headers: { 'x-nf-client-connection-ip': '9.9.9.' + Math.floor(Math.random() * 250) } }), {})).status;
ok(await signup('ann@example.com') === 200 && await signup('bob@example.com') === 200 && await signup('cy@example.com') === 200, 'signup still works and creates the community profile');
const ck = async e => (await auth.sessionCookie(e)).split(';')[0];
const F = await ck('founder@example.com'), A = await ck('ann@example.com'), B = await ck('bob@example.com'), Cy = await ck('cy@example.com'), L = await ck('legacy@example.com');
let n = 0;
const call = async (cookie, o) => { const post = !!o.action; const r = await api(new Request('http://x/c' + (post ? '' : '?' + new URLSearchParams(o)), { method: post ? 'POST' : 'GET', body: post ? JSON.stringify(o) : undefined, headers: { cookie: cookie || '', 'x-nf-client-connection-ip': '7.7.7.' + (++n % 250) } }), {}); return { s: r.status, j: await r.json() }; };
const me = async c => (await call(c, { me: 1 })).j.me;
const mf = await me(F), ma = await me(A), mb = await me(B), mc = await me(Cy);
ok((await call('', { me: 1 })).s === 401, 'the community needs a signed-in member');
ok(mf.founder && mf.username === 'pricepocketasset' && mf.verified && mf.badges.some(b => b.key === 'founder') && mf.badges.some(b => b.key === 'verified'), 'Founder profile: official username, Founder / Owner and Verified badges');
ok(/^member\d{6}$/.test(ma.username) && !ma.username.includes('ann') && ma.name === 'New member' && !ma.founder, 'new member gets a private placeholder username (nothing derived from their email)');
let fing = await call(A, { u: ma.username, list: 'following' });
ok(fing.j.rows.length === 1 && fing.j.rows[0].system === true && fing.j.rows[0].founder && /./.test(fing.j.rows[0].since), 'every new member is connected to the Founder first (system connection, "since you joined")');
// --- Founder protections, server side, called directly (no UI involved) ---
const fu = mf.uid;
let r = await call(A, { action: 'unfollow', uid: fu }); ok(r.s === 400 && /cannot be removed/.test(r.j.error), 'unfollow the Founder: refused by the server');
r = await call(A, { action: 'block', uid: fu }); ok(r.s === 400 && /cannot be blocked/.test(r.j.error), 'block the Founder: refused by the server');
r = await call(A, { action: 'follow', uid: fu }); ok(r.s === 400, 'a normal follow of the Founder is refused (the connection is not a follow record)');
r = await call(A, { action: 'saveProfile', notif: { founderPosts: 'muted', founderAnnouncements: 'muted', frequency: 'weekly' } }); ok(r.s === 200, 'members can mute Founder posts, announcements and set frequency');
fing = await call(A, { u: ma.username, list: 'following' }); ok(fing.j.rows[0].system === true, 'after muting, the Founder connection is still there');
ok((await me(A)).notif.founderPosts === 'muted', 'the mute setting is saved');
r = await call(A, { action: 'saveProfile', notif: { founderPosts: 'gone' } }); ok(r.s === 400, 'only valid notification choices are accepted');
await call(A, { action: 'saveProfile', pinned: 'hi' }); ok(!(await call(F, { u: 'pricepocketasset' })).j.profile.pinned.includes('hi'), 'a normal member cannot pin a Founder message');
r = await call(F, { action: 'saveProfile', pinned: 'Welcome to PricePocketAsset.' }); ok(r.s === 200 && (await call(A, { u: 'pricepocketasset' })).j.profile.pinned === 'Welcome to PricePocketAsset.', 'the Founder can pin an official message, members see it');
const fv = (await call(A, { u: 'pricepocketasset' })).j; ok(fv.rel.system && !fv.rel.canFollow && !fv.rel.canBlock && fv.rel.canMessage.mode === 'request', 'Founder profile for a member: system connection, no follow / block; messages go to the Founder\'s requests');
ok(fv.profile.stats.followers === 3, 'Founder follower count counts the system connections');
// --- normal follow system ---
r = await call(A, { action: 'follow', uid: ma.uid }); ok(r.s === 400, 'cannot follow yourself');
r = await call(A, { action: 'follow', uid: mb.uid }); ok(r.s === 200, 'follow a member');
r = await call(A, { action: 'follow', uid: mb.uid }); ok(r.s === 200 && r.j.already, 'a second follow is a no-op (no duplicates)');
let pb = (await call(A, { u: mb.username })).j; ok(pb.profile.stats.followers === 1 && pb.rel.following, 'follower count is right after duplicate attempts');
ok((await call(A, { u: ma.username })).j.profile.stats.following === 2, 'following count includes the Founder connection');
await call(B, { action: 'follow', uid: ma.uid }); await call(A, { action: 'follow', uid: mc.uid }); await call(B, { action: 'follow', uid: mc.uid });
const mu = (await call(A, { u: mb.username, mutual: 1 })).j; ok(mu.rows.length === 1 && mu.rows[0].uid === mc.uid, 'mutual connections (both follow Cy)');
r = await call(A, { u: mb.username, list: 'followers' }); ok(r.j.rows.length === 1 && r.j.rows[0].uid === ma.uid, 'followers list');
r = await call(A, { action: 'unfollow', uid: mb.uid }); pb = (await call(A, { u: mb.username })).j; ok(r.s === 200 && pb.profile.stats.followers === 0 && !pb.rel.following, 'unfollow works and counts go back down');
await call(A, { action: 'unfollow', uid: mb.uid }); ok((await call(A, { u: mb.username })).j.profile.stats.followers === 0, 'unfollowing twice does not make counts negative');
// --- privacy ---
await call(B, { action: 'saveProfile', city: 'Orlando', state: 'fl' });
ok((await call(A, { u: mb.username })).j.profile.location === '', 'location is hidden by default');
await call(B, { action: 'saveProfile', privacy: { showLocation: true } }); ok((await call(A, { u: mb.username })).j.profile.location === 'Orlando, FL', 'location shows only after the member chooses to show it');
await call(B, { action: 'saveProfile', privacy: { whoCanFollow: 'nobody' } }); r = await call(A, { action: 'follow', uid: mb.uid }); ok(r.s === 403, 'who can follow me: nobody is enforced on the server');
await call(B, { action: 'saveProfile', privacy: { whoCanFollow: 'everyone', whoCanMessage: 'nobody' } }); ok(!(await call(A, { u: mb.username })).j.rel.canMessage.ok, 'who can message me: nobody');
await call(B, { action: 'saveProfile', privacy: { whoCanMessage: 'everyone' } }); ok((await call(A, { u: mb.username })).j.rel.canMessage.mode === 'direct' && (await call(A, { u: mb.username })).j.rel.messagingLive, 'who can message me: everyone (button allowed; messaging itself is not live yet)');
await call(B, { action: 'saveProfile', privacy: { whoCanMessage: 'followers' } }); ok((await call(A, { u: mb.username })).j.rel.canMessage.mode === 'request', 'followers-only messaging: a non-follower can only send a message request');
await call(B, { action: 'saveProfile', privacy: { showActivity: false } }); ok((await call(A, { u: mb.username })).j.profile.activityHidden === true && (await call(B, { u: mb.username })).j.profile.activityHidden === false, 'activity can be hidden from others, never from yourself');
// --- no sensitive data ever leaves ---
const dump = JSON.stringify([await call(A, { u: mb.username }), await call(A, { u: mb.username, list: 'followers' }), await call(A, { search: 'member' }), await call(A, { suggest: 1 }), await call(A, { u: 'pricepocketasset' })]);
ok(!/@example\.com|password|hash|salt/i.test(dump) && !dump.includes(mb.uid + '@'), 'no email, password data or other private fields appear in any public response');
// --- blocking ---
await call(A, { action: 'follow', uid: mc.uid }); r = await call(A, { action: 'block', uid: mc.uid });
ok(r.s === 200 && (await call(Cy, { u: ma.username })).s === 404 && (await call(A, { u: mc.username })).j.blockedByMe, 'block: the other person can no longer see you; you see the unblock option');
ok((await call(A, { u: mc.username })).j.profile.stats === undefined && (await call(Cy, { action: 'follow', uid: ma.uid })).s === 403, 'blocked members cannot follow you');
ok((await call(A, { u: ma.username, list: 'following' })).j.rows.every(x => x.uid !== mc.uid), 'follows are cut in both directions and the blocked member disappears from lists');
r = await call(A, { action: 'unblock', uid: mc.uid }); ok(r.s === 200 && (await call(Cy, { u: ma.username })).s === 200, 'unblock restores normal visibility');
r = await call(A, { action: 'report', uid: mb.uid, category: 'Made up' }); ok(r.s === 400, 'reports need a real category');
r = await call(A, { action: 'report', uid: mb.uid, category: 'Spam', details: 'test' }); ok(r.s === 200 && (await call(F, { reports: 1 })).j.reports.length === 1 && (await call(A, { reports: 1 })).s === 403, 'reports are saved and only the owner can read them');
// --- profile editing validation ---
r = await call(A, { action: 'saveProfile', username: 'pricepocketasset' }); ok(r.s === 400, 'the official username is reserved');
r = await call(A, { action: 'saveProfile', username: 'admin' }); ok(r.s === 400, 'reserved words cannot be usernames');
r = await call(A, { action: 'saveProfile', username: 'Bad Name!' }); ok(r.s === 400, 'usernames must be simple');
r = await call(A, { action: 'saveProfile', username: mb.username }); ok(r.s === 409, 'usernames are unique');
r = await call(A, { action: 'saveProfile', username: 'ann_land', name: 'Ann Lee', role: 'Land Buyer', experience: 'Advanced', bio: 'Buying <b>land</b> in AL', interests: ['Vacant Land', 'Tax Deeds'] }); const na = (await call(A, { u: 'ann_land' })).j.profile;
ok(r.s === 200 && na.name === 'Ann Lee' && na.role === 'Land Buyer' && !na.bio.includes('<') && na.interests.length === 2 && (await call(A, { u: ma.username })).s === 404, 'profile saved; markup stripped; old username released');
ok((await call(A, { action: 'saveProfile', role: 'Wizard' })).s === 400 && (await call(A, { action: 'saveProfile', interests: ['Nope'] })).s === 400, 'role and interests must come from the lists');
ok((await call(B, { search: 'ann_' })).j.rows.some(x => x.username === 'ann_land') && !(await call(A, { search: 'ann_' })).j.rows.some(x => x.uid === ma.uid), 'member search by username (never returns yourself)');
await call(A, { action: 'saveProfile', privacy: { discoverable: false } }); ok(!(await call(B, { search: 'ann_' })).j.rows.length, 'members who turn off discovery do not appear in search');
// --- collections ---
r = await call(A, { action: 'saveCollection', name: 'Florida Tax Liens', visibility: 'public' }); const cid = r.j.id; await call(A, { action: 'saveCollection', name: 'Secret list' });
await call(A, { action: 'saveCollection', id: cid, addItem: { state: 'fl', county: 'Palm Beach', parcel: '00-42-45-10-14-002-0000' } });
const pubV = (await call(B, { u: 'ann_land', collections: 1 })).j.collections, mineV = (await call(A, { u: 'ann_land', collections: 1 })).j.collections;
ok(pubV.length === 1 && pubV[0].visibility === 'public' && pubV[0].items.length === 1 && mineV.length === 2, 'collections: others see only public ones; you see all, each labeled public or private');
ok((await call(B, { action: 'saveCollection', id: cid, name: 'Hacked' })).s === 404, 'you can only edit your own collections');
// --- badges ---
const badgeKeys = async (c, u) => (await call(c, { u })).j.profile.badges.map(b => b.key);
ok(!(await badgeKeys(B, 'ann_land')).includes('verified') && (await badgeKeys(B, 'ann_land')).includes('early'), 'badges: Early Member automatic; Verified is not automatic');
ok((await call(A, { action: 'ownerAward', username: 'ann_land', verified: true })).s === 403, 'members cannot award themselves badges');
await call(F, { action: 'ownerAward', username: 'ann_land', verified: true, awards: ['helpful', 'educator'] }); ok((await badgeKeys(B, 'ann_land')).join() === 'verified,early,helpful,educator', 'owner awards Verified, Helpful Contributor and Educator');
ok((await call(F, { action: 'ownerAward', username: 'ann_land', awards: ['founder'] })).s === 400, 'the Founder badge cannot be handed out');
// --- the blue check: only the Founder by default; members can ASK after enough followers; the owner decides ---
ok((await call(A, { u: 'pricepocketasset' })).j.profile.badges.some(b => b.key === 'verified') && !(await call(F, { u: mc.username })).j.profile.verified && !(await call(F, { u: mb.username })).j.profile.verified, 'only the Founder has the blue check; regular members do not');
r = await call(Cy, { action: 'requestVerify' }); ok(r.s === 403 && /1,000 followers/.test(r.j.error), 'a member below the follower minimum cannot even ask for the check');
process.env.VERIFY_MIN_FOLLOWERS = '2'; await call(F, { action: 'ownerAward', username: 'ann_land', verified: false }); await call(Cy, { action: 'follow', uid: (await me(A)).uid });
ok((await me(A)).verify.min === 2 && (await me(A)).verify.canRequest === true, 'status says the member may now ask');
r = await call(B, { action: 'requestVerify' }); ok(r.s === 403, 'not enough followers: refused by the server');
r = await call(A, { action: 'requestVerify', note: 'Land educator' }); ok(r.s === 200, 'with enough followers and a complete profile a member can send a request');
r = await call(A, { action: 'requestVerify' }); ok(r.s === 400, 'a second request while one is open is refused');
ok((await call(A, { verifyRequests: 1 })).s === 403 && (await call(F, { verifyRequests: 1 })).j.requests.length === 1, 'only the owner sees verification requests');
ok((await call(A, { action: 'ownerVerifyDecision', username: 'ann_land', approve: true })).s === 403, 'members cannot approve their own request');
r = await call(F, { action: 'ownerVerifyDecision', username: 'ann_land', approve: true }); ok(r.s === 200 && (await call(B, { u: 'ann_land' })).j.profile.verified === true && (await call(F, { verifyRequests: 1 })).j.requests.length === 0, 'owner approves: the check appears and the request closes');
delete process.env.VERIFY_MIN_FOLLOWERS;
// --- deactivated members disappear ---
const u = await auth.getUser('bob@example.com'); u.revoked = true; await auth.saveUser(u);
ok((await call(A, { u: mb.username })).s === 404, 'a deactivated member\'s profile is hidden');
u.revoked = false; await auth.saveUser(u);
// --- legacy members and backfill ---
ok((await auth.kvList('cpe_')).length === 5 - 1, 'before any visit the legacy member has no profile yet (4 of 5 have one)');
const b1 = await C.backfill(); const keysAfter = (await auth.kvList('cs_')).length, ff = (await me(F)).stats.followers;
ok(b1.newProfiles === 1 && keysAfter === 4 && (await call(L, { u: (await me(L)).username, list: 'following' })).j.rows[0].system, 'backfill gives the legacy member a profile and the Founder connection');
const b2 = await C.backfill(); ok(b2.newProfiles === 0 && b2.newConnections === 0 && (await auth.kvList('cs_')).length === keysAfter && (await me(F)).stats.followers === ff, 'backfill is idempotent: a second run creates nothing and does not change counts');
ok((await call(A, { action: 'ownerBackfill' })).s === 403 && (await call(F, { action: 'ownerBackfill' })).s === 200, 'only the owner can run the backfill');
// social links
{ const sx = (await import('../lib/community.mjs')).cleanSocial;
  ok(sx('x', 'https://x.com/sample_investor').ok && sx('x', 'https://www.twitter.com/sample').ok, 'X and Twitter links accepted');
  ok(!sx('x', 'https://evil.example.com/x').ok && !sx('instagram', 'https://x.com/a').ok, 'a link must point to its own platform');
  ok(!sx('website', 'http://example.com').ok && !sx('website', 'javascript:alert(1)').ok && !sx('website', 'https://user:pw@example.com').ok, 'http, javascript: and login-in-link are refused');
  ok(sx('website', 'https://example.com/page').ok && sx('website', '').value === '', 'any secure website is accepted; empty clears');
  ok(!sx('youtube', 'https://youtube.com.evil.example/x').ok, 'look-alike domains are refused');
  let r = await call(A, { action: 'saveProfile', social: { x: 'https://evil.example.com/x' } }); ok(r.s === 400, 'server refuses a bad social link');
  r = await call(A, { action: 'saveProfile', social: { x: 'https://x.com/ann_t', website: 'https://ann.example.com' } }); ok(r.s === 200, 'member saves social links (free members too)');
  const mA = (await call(A, { me: 1 })).j.me; let v = (await call(F, { u: mA.username })).j.profile; ok(v.social.x === 'https://x.com/ann_t' && v.social.website === 'https://ann.example.com/', 'other members see the links');
  await call(A, { action: 'saveProfile', privacy: { showSocial: false } });
  v = (await call(F, { u: mA.username })).j.profile; ok(!v.social || Object.keys(v.social).length === 0, 'hidden social links are not sent to other members');
  v = (await call(A, { u: mA.username })).j.profile; ok(v.social.x === 'https://x.com/ann_t', 'the member still sees their own links');
  await call(A, { action: 'saveProfile', privacy: { showSocial: true } });
  r = await call(F, { action: 'ownerRemoveSocial', username: mA.username, key: 'x' }); ok(r.s === 200 && (await call(F, { u: mA.username })).j.profile.social.x === undefined, 'owner removes a link');
  r = await call(A, { action: 'ownerRemoveSocial', username: mA.username, key: 'x' }); ok(r.s === 403, "members cannot remove others' links");
  ok((await auth.kvGet('soclog'))[0].key === 'x', 'owner removal is logged'); }
console.log(pass + ' passed');
