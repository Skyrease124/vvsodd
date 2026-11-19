// Community layer: member profiles, follows, the protected Founder connection, blocks, reports, collections, privacy, badges.
// Storage is the same Netlify Blobs store as member accounts (see auth.mjs). Key layout (the prefix IS the index; every key is [a-z0-9_]):
//   cp_<uid>            profile                     cpe_<sha256(email)>  email -> uid        cpu_<username>  username -> uid
//   cf_<a>_<b>          a follows b                 cr_<b>_<a>           same edge, followers index
//   cb_<a>_<b>          a blocked b                 cs_<uid>             SYSTEM connection to the Founder (not a follow record)
//   cc_<uid>_<cid>      collection                  crp_<id>             report                cstat                counters
// Rules enforced HERE (server side), never only in the browser: the Founder connection cannot be removed, blocked or muted away;
// no self-follow, no duplicates, blocks cut both directions, privacy and deactivated accounts are respected.
import crypto from 'node:crypto';
import * as auth from './auth.mjs';

export const FOUNDER_EMAIL = () => auth.normEmail(process.env.FOUNDER_EMAIL || 'skyariasa@gmail.com');   // config: set FOUNDER_USER_ID to pin by id instead
export const VERIFY_MIN = () => Math.max(1, +(process.env.VERIFY_MIN_FOLLOWERS || 1000));   // followers needed before a member may ASK for the blue check (the owner still decides)
export const EARLY_UNTIL = () => process.env.EARLY_MEMBER_UNTIL || '2027-01-01';
export const ROLES = ['Tax Lien Investor', 'Tax Deed Investor', 'Land Buyer', 'Real Estate Investor', 'Realtor', 'Developer', 'Contractor', 'Wholesaler', 'Teacher', 'Student', 'Beginner Investor', 'Other'];
export const EXPERIENCE = ['Beginner', 'Intermediate', 'Advanced'];
export const INTERESTS = ['Tax Liens', 'Tax Deeds', 'Vacant Land', 'Foreclosures', 'Wholesaling', 'Development', 'Land Flipping', 'Auctions', 'County Research', 'Property Research'];
export const REPORT_CATEGORIES = ['Spam', 'Scam', 'Harassment', 'Fake account', 'Misleading property information', 'Inappropriate content', 'Other'];
export const AWARDABLE = { helpful: ['Helpful Contributor', 'Answers questions clearly'], top: ['Top Contributor', 'Consistently valuable posts'], leader: ['Community Leader', 'Helps run the community'], educator: ['Educator', 'Teaches others'] };
const RESERVED = new Set(['admin', 'administrator', 'founder', 'owner', 'official', 'support', 'staff', 'moderator', 'mod', 'system', 'community', 'pricepocketasset', 'pricepocket', 'ppa', 'help', 'security', 'billing', 'root', 'null', 'undefined', 'me', 'settings', 'profile', 'api']);
const COLORS = ['forest', 'lake', 'field', 'dusk', 'clay', 'slate'];
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const rid = n => crypto.randomBytes(n).toString('hex');
const now = () => new Date().toISOString();
const clean = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const K = { p: u => 'cp_' + u, pe: e => 'cpe_' + sha(e), pu: n => 'cpu_' + n, f: (a, b) => `cf_${a}_${b}`, r: (b, a) => `cr_${b}_${a}`, b: (a, b) => `cb_${a}_${b}`, s: u => 'cs_' + u, c: (u, c) => `cc_${u}_${c}`, stat: 'cstat' };
const idOk = s => /^[a-f0-9]{16}$/.test(String(s));
const err = (status, error) => ({ ok: false, status, error });

// ---- profiles --------------------------------------------------------------------------------------------------
export async function getByUid(uid) { return idOk(uid) ? auth.kvGet(K.p(uid)) : null; }
export async function getByUsername(name) { const m = await auth.kvGet(K.pu(String(name || '').toLowerCase())); return m && m.uid ? getByUid(m.uid) : null; }
export async function founderUid() {
  if (process.env.FOUNDER_USER_ID && idOk(process.env.FOUNDER_USER_ID)) return process.env.FOUNDER_USER_ID;
  const m = await auth.kvGet(K.pe(FOUNDER_EMAIL())); return m && m.uid ? m.uid : null;
}
export const isFounderProfile = async p => !!p && p.uid === await founderUid();

async function freeUsername(base) {
  for (let i = 0; i < 20; i++) { const n = (base + (i ? rid(2) : '')).slice(0, 20); if (!(await auth.kvGet(K.pu(n))) && !RESERVED.has(n)) return n; }
  return 'member' + rid(5);
}
// Creates the profile (and, for everyone except the Founder, the permanent Founder connection) if missing. Idempotent; safe to call on every request.
export async function ensureProfile(user) {
  if (!user || !user.email) return null;
  const email = auth.normEmail(user.email), em = await auth.kvGet(K.pe(email));
  let p = em && em.uid ? await getByUid(em.uid) : null;
  if (!p) {
    const uid = rid(8), isF = email === FOUNDER_EMAIL() || uid === process.env.FOUNDER_USER_ID;
    const username = isF && !(await auth.kvGet(K.pu('pricepocketasset'))) ? 'pricepocketasset' : await freeUsername('member' + String(Math.floor(Math.random() * 1e6)).padStart(6, '0'));
    p = { uid, email, username, name: isF ? 'PricePocketAsset' : 'New member', role: isF ? 'Founder & Owner' : '', experience: '', bio: '', interests: [], city: '', state: '', cover: isF ? 'lake' : COLORS[Math.floor(Math.random() * COLORS.length)],
      privacy: { showLocation: false, showActivity: true, whoCanFollow: 'everyone', whoCanMessage: 'followers', collectionsDefault: 'private', discoverable: true, showProBadge: true },
      notif: { founderPosts: 'on', founderAnnouncements: 'on', frequency: 'instant', follows: true, messages: true },
      verified: isF, awards: [], pinned: '', stats: { followers: 0, following: 0 }, created: user.created || now() };
    await auth.kvPut(K.pu(username), { uid }); await auth.kvPut(K.p(uid), p); await auth.kvPut(K.pe(email), { uid });
  }
  await ensureSystemConnection(p);
  return p;
}
async function bump(uid, field, d) { const p = await getByUid(uid); if (!p) return; p.stats = p.stats || { followers: 0, following: 0 }; p.stats[field] = Math.max(0, (p.stats[field] || 0) + d); await auth.kvPut(K.p(uid), p); }
// The Founder connection is its own record type (cs_), not a follow edge: nothing in the follow/unfollow/block code can touch it.
async function ensureSystemConnection(p) {
  const f = await founderUid(); if (!f || p.uid === f) return false;
  if (await auth.kvGet(K.s(p.uid))) return false;
  await auth.kvPut(K.s(p.uid), { founder: f, since: p.created || now() });
  const fp = await getByUid(f); if (fp) { fp.stats = fp.stats || {}; fp.stats.followers = (fp.stats.followers || 0) + 1; await auth.kvPut(K.p(f), fp); }
  return true;
}
// Idempotent backfill: every existing member gets a profile and the Founder connection. Running it twice changes nothing.
export async function backfill() {
  const keys = await auth.kvList('u_'); let profiles = 0, connections = 0;
  const fe = await auth.kvGet('u_' + sha(FOUNDER_EMAIL())); const order = keys.slice().sort(k => (k === 'u_' + sha(FOUNDER_EMAIL()) ? -1 : 0));   // Founder first, so connections can count up
  for (const k of order) { const u = await auth.kvGet(k); if (!u || !u.email) continue; const had = await auth.kvGet(K.pe(auth.normEmail(u.email))); const p = await ensureProfile(u); if (!had) profiles++; if (p && !(await isFounderProfile(p)) && !had) connections++; }
  return { users: keys.length, newProfiles: profiles, newConnections: connections, founderFound: !!fe };
}

// ---- views -----------------------------------------------------------------------------------------------------
export async function badgesFor(p) {
  const out = [], f = await isFounderProfile(p), u = await auth.getUser(p.email);
  if (f) out.push({ key: 'founder', label: 'Founder / Owner', desc: 'Official PricePocketAsset account' });
  if (p.verified || f) out.push({ key: 'verified', label: 'Verified', desc: 'Identity confirmed by PricePocketAsset' });
  if (u && auth.isPaid(u) && (p.privacy || {}).showProBadge !== false) out.push({ key: 'pro', label: 'Pro Member', desc: 'Active Pro membership' });
  if ((p.created || '') < EARLY_UNTIL()) out.push({ key: 'early', label: 'Early Member', desc: 'Joined in the first months' });
  for (const a of p.awards || []) if (AWARDABLE[a]) out.push({ key: a, label: AWARDABLE[a][0], desc: AWARDABLE[a][1] });
  return out;
}
export async function isVisible(p) { if (!p) return false; const u = await auth.getUser(p.email); return !!u && !u.revoked; }
export async function publicView(p, viewerUid) {
  const me = viewerUid === p.uid, pr = p.privacy || {}, f = await isFounderProfile(p);
  return { uid: p.uid, username: p.username, name: p.name, role: p.role, experience: p.experience, bio: p.bio, interests: p.interests || [], cover: p.cover, founder: f, verified: !!(p.verified || f),
    location: (me || pr.showLocation) && (p.city || p.state) ? [p.city, p.state].filter(Boolean).join(', ') : '', joined: String(p.created || '').slice(0, 7), pinned: f ? p.pinned || '' : '',
    badges: await badgesFor(p), stats: { followers: (p.stats || {}).followers || 0, following: ((p.stats || {}).following || 0) + (f ? 0 : 1), posts: 0 }, activityHidden: !me && pr.showActivity === false };
}
export async function relation(viewer, target) {
  const f = await founderUid(), tF = target.uid === f, self = viewer.uid === target.uid;
  const [fo, fb, bl, bb] = await Promise.all([auth.kvGet(K.f(viewer.uid, target.uid)), auth.kvGet(K.f(target.uid, viewer.uid)), auth.kvGet(K.b(viewer.uid, target.uid)), auth.kvGet(K.b(target.uid, viewer.uid))]);
  const pr = target.privacy || {};
  const rel = { self, system: tF, following: !!fo, followedBy: !!fb, blocked: !!bl, blockedBy: !!bb, canFollow: !self && !tF && !bl && !bb && pr.whoCanFollow !== 'nobody', canBlock: !self && !tF, canMessage: { ok: false, reason: '' } };
  if (self) rel.canMessage.reason = 'self'; else if (tF) rel.canMessage.reason = 'system'; else if (bl || bb) rel.canMessage.reason = 'blocked';
  else { const w = pr.whoCanMessage || 'followers'; rel.canMessage = w === 'everyone' || (w === 'followers' && rel.following) || (w === 'following' && rel.followedBy) ? { ok: true, reason: '' } : { ok: false, reason: 'privacy' }; }
  rel.messagingLive = false;   // direct messages are not built yet: the button is shown when privacy allows, and says "coming soon"
  return rel;
}

// ---- follows ---------------------------------------------------------------------------------------------------
export async function follow(me, targetUid) {
  const t = await getByUid(targetUid); if (!t || !(await isVisible(t))) return err(404, 'Member not found.');
  if (me.uid === t.uid) return err(400, 'You cannot follow yourself.');
  if (await isFounderProfile(t)) return err(400, 'You are already connected to the Founder. That connection is permanent.');
  const rel = await relation(me, t); if (rel.blocked || rel.blockedBy) return err(403, 'You cannot follow this member.');
  if ((t.privacy || {}).whoCanFollow === 'nobody') return err(403, 'This member is not accepting new followers.');
  if (rel.following) return { ok: true, already: true };
  await auth.kvPut(K.f(me.uid, t.uid), { at: now() }); await auth.kvPut(K.r(t.uid, me.uid), { at: now() });
  await bump(me.uid, 'following', 1); await bump(t.uid, 'followers', 1); return { ok: true };
}
export async function unfollow(me, targetUid) {
  const t = await getByUid(targetUid); if (!t) return err(404, 'Member not found.');
  if (await isFounderProfile(t)) return err(400, 'The Founder connection is official and cannot be removed. You can mute Founder posts in your settings.');
  if (!(await auth.kvGet(K.f(me.uid, t.uid)))) return { ok: true, already: true };
  await removeEdge(me.uid, t.uid); return { ok: true };
}
async function removeEdge(a, b) {
  if (!(await auth.kvGet(K.f(a, b)))) return false;
  await auth.kvPut(K.f(a, b), null); await auth.kvPut(K.r(b, a), null); await bump(a, 'following', -1); await bump(b, 'followers', -1); return true;
}
// A deleted key is stored as null and filtered out of every list (the blob store has no delete in this helper).
async function edges(prefix, cap = 500) { const ks = (await auth.kvList(prefix)).slice(0, cap); const out = []; for (const k of ks) { const v = await auth.kvGet(k); if (v) out.push(k.slice(prefix.length)); } return out; }
export async function listFollows(target, kind, viewer, { limit = 50, offset = 0 } = {}) {
  const ids = await edges(kind === 'followers' ? `cr_${target.uid}_` : `cf_${target.uid}_`), f = await founderUid(), rows = [];
  if (kind === 'following' && f && target.uid !== f && await auth.kvGet(K.s(target.uid))) { const fp = await getByUid(f); if (fp) rows.push(Object.assign(await miniView(fp, viewer), { system: true, since: ((await auth.kvGet(K.s(target.uid))) || {}).since })); }   // Founder stays at the top
  if (kind === 'followers' && f && target.uid === f) { /* the Founder's followers are the system connections: counted, not listed one by one */ }
  const mine = new Set(); for (const id of ids.slice(offset, offset + limit)) { const p = await getByUid(id); if (!p || !(await isVisible(p))) continue; if (await auth.kvGet(K.b(viewer.uid, id)) || await auth.kvGet(K.b(id, viewer.uid))) continue; rows.push(await miniView(p, viewer.uid, mine)); }
  return { rows, total: ids.length + (kind === 'following' && rows.some(r => r.system) ? 1 : 0), systemCount: kind === 'followers' && f && target.uid === f ? ((target.stats || {}).followers || 0) : undefined };
}
export async function mutual(target, viewer) {
  if (target.uid === viewer.uid) return { rows: [] };
  const [a, b] = await Promise.all([edges(`cf_${viewer.uid}_`), edges(`cf_${target.uid}_`)]), both = a.filter(x => b.includes(x)).slice(0, 12), rows = [];
  for (const id of both) { const p = await getByUid(id); if (p && await isVisible(p)) rows.push(await miniView(p, viewer.uid)); } return { rows };
}
export async function miniView(p, viewerUid) { const f = await isFounderProfile(p); return { uid: p.uid, username: p.username, name: p.name, role: p.role, founder: f, verified: !!(p.verified || f), cover: p.cover, following: viewerUid ? !!(await auth.kvGet(K.f(viewerUid, p.uid))) : false }; }

// ---- blocks and reports ------------------------------------------------------------------------------------------
export async function block(me, targetUid) {
  const t = await getByUid(targetUid); if (!t) return err(404, 'Member not found.');
  if (await isFounderProfile(t)) return err(400, 'The official PricePocketAsset account cannot be blocked. You can mute its posts in your settings.');
  if (t.uid === me.uid) return err(400, 'You cannot block yourself.');
  await removeEdge(me.uid, t.uid); await removeEdge(t.uid, me.uid); await auth.kvPut(K.b(me.uid, t.uid), { at: now() }); return { ok: true };
}
export async function unblock(me, targetUid) { if (!(await auth.kvGet(K.b(me.uid, targetUid)))) return { ok: true, already: true }; await auth.kvPut(K.b(me.uid, targetUid), null); return { ok: true }; }
export async function report(me, targetUid, category, details) {
  const t = await getByUid(targetUid); if (!t) return err(404, 'Member not found.'); if (t.uid === me.uid) return err(400, 'You cannot report yourself.');
  if (!REPORT_CATEGORIES.includes(category)) return err(400, 'Pick a reason for the report.');
  const id = rid(8); await auth.kvPut('crp_' + id, { id, by: me.uid, target: t.uid, category, details: clean(details, 500), at: now(), status: 'open' }); return { ok: true };
}
export async function listReports() { const out = []; for (const k of (await auth.kvList('crp_')).slice(0, 200)) { const r = await auth.kvGet(k); if (!r) continue; const t = await getByUid(r.target), b = await getByUid(r.by); out.push(Object.assign({}, r, { targetName: t ? t.username : '?', byName: b ? b.username : '?' })); } return out.sort((a, b) => (a.at < b.at ? 1 : -1)); }

// ---- profile editing -------------------------------------------------------------------------------------------
const USERNAME = /^[a-z][a-z0-9_]{2,19}$/;
export async function saveProfile(p, b, { founder }) {
  const next = JSON.parse(JSON.stringify(p));
  if (b.username !== undefined) {
    const n = String(b.username).trim().toLowerCase();
    if (n !== p.username) {
      if (!USERNAME.test(n)) return err(400, 'Usernames are 3 to 20 characters: lowercase letters, numbers and underscores, starting with a letter.');
      if (RESERVED.has(n) && !(founder && n === 'pricepocketasset')) return err(400, 'That username is reserved.');
      const taken = await auth.kvGet(K.pu(n)); if (taken && taken.uid !== p.uid) return err(409, 'That username is taken.');
      await auth.kvPut(K.pu(n), { uid: p.uid }); await auth.kvPut(K.pu(p.username), null); next.username = n;
    }
  }
  if (b.name !== undefined) { const n = clean(b.name, 40); if (n.length < 2) return err(400, 'Enter a display name (2 to 40 characters).'); next.name = n; }
  if (b.role !== undefined) { if (b.role !== '' && !ROLES.includes(b.role) && !(founder && b.role === 'Founder & Owner')) return err(400, 'Pick a role from the list.'); next.role = b.role; }
  if (b.experience !== undefined) { if (b.experience !== '' && !EXPERIENCE.includes(b.experience)) return err(400, 'Pick an experience level from the list.'); next.experience = b.experience; }
  if (b.bio !== undefined) next.bio = clean(b.bio, 280);
  if (b.interests !== undefined) { if (!Array.isArray(b.interests) || b.interests.some(i => !INTERESTS.includes(i))) return err(400, 'Pick interests from the list.'); next.interests = [...new Set(b.interests)].slice(0, 10); }
  if (b.city !== undefined) next.city = clean(b.city, 40); if (b.state !== undefined) next.state = clean(b.state, 2).toUpperCase();
  if (b.cover !== undefined) { if (!COLORS.includes(b.cover)) return err(400, 'Pick a cover from the list.'); next.cover = b.cover; }
  if (b.pinned !== undefined) { if (!founder) return err(403, 'Only the Founder account can pin a Founder message.'); next.pinned = clean(b.pinned, 600); }
  const pv = b.privacy; if (pv) {
    const en = (k, vals) => { if (pv[k] !== undefined) { if (!vals.includes(pv[k])) return false; next.privacy[k] = pv[k]; } return true; };
    for (const k of ['showLocation', 'showActivity', 'discoverable', 'showProBadge']) if (pv[k] !== undefined) next.privacy[k] = !!pv[k];
    if (!en('whoCanFollow', ['everyone', 'nobody']) || !en('whoCanMessage', ['everyone', 'following', 'followers', 'nobody']) || !en('collectionsDefault', ['public', 'private'])) return err(400, 'That privacy choice is not valid.');
  }
  const nt = b.notif; if (nt) {
    // Founder posts and announcements can be MUTED (notifications only). Muting never touches the connection itself.
    for (const k of ['founderPosts', 'founderAnnouncements']) if (nt[k] !== undefined) { if (!['on', 'muted'].includes(nt[k])) return err(400, 'That notification choice is not valid.'); next.notif[k] = nt[k]; }
    if (nt.frequency !== undefined) { if (!['instant', 'daily', 'weekly'].includes(nt.frequency)) return err(400, 'That notification choice is not valid.'); next.notif.frequency = nt.frequency; }
    for (const k of ['follows', 'messages']) if (nt[k] !== undefined) next.notif[k] = !!nt[k];
  }
  await auth.kvPut(K.p(p.uid), next); return { ok: true, profile: next };
}
export async function ownerAward(p, { verified, awards }) {
  if (verified !== undefined) p.verified = !!verified;
  if (awards !== undefined) { if (!Array.isArray(awards) || awards.some(a => !AWARDABLE[a])) return err(400, 'Unknown badge.'); p.awards = [...new Set(awards)]; }
  await auth.kvPut(K.p(p.uid), p); return { ok: true };
}

// ---- collections ----------------------------------------------------------------------------------------------
export async function listCollections(target, viewerUid) {
  const me = viewerUid === target.uid, out = [];
  for (const k of (await auth.kvList(`cc_${target.uid}_`)).slice(0, 100)) { const c = await auth.kvGet(k); if (!c) continue; if (c.visibility !== 'public' && !me) continue; out.push({ id: c.id, name: c.name, visibility: c.visibility, count: (c.items || []).length, items: me || c.visibility === 'public' ? c.items || [] : [], updated: c.updated }); }
  return out.sort((a, b) => (a.updated < b.updated ? 1 : -1));
}
export async function saveCollection(p, b) {
  const name = clean(b.name, 60); if (b.id === undefined && name.length < 2) return err(400, 'Give the collection a name.');
  if (b.visibility !== undefined && !['public', 'private'].includes(b.visibility)) return err(400, 'Choose Public or Private.');
  let c; if (b.id) { if (!/^[a-f0-9]{8}$/.test(String(b.id))) return err(400, 'Bad collection.'); c = await auth.kvGet(K.c(p.uid, b.id)); if (!c) return err(404, 'Collection not found.'); }
  else { if ((await auth.kvList(`cc_${p.uid}_`)).length >= 50) return err(400, 'You can have up to 50 collections.'); c = { id: rid(4), items: [], created: now(), visibility: (p.privacy || {}).collectionsDefault === 'public' ? 'public' : 'private' }; }
  if (name) c.name = name; if (b.visibility) c.visibility = b.visibility;
  if (b.addItem) { const it = b.addItem, st = clean(it.state, 2).toUpperCase(), co = clean(it.county, 40), pa = clean(it.parcel, 40); if (!st || !co || !pa) return err(400, 'A property needs a state, county and parcel.'); if ((c.items || []).length >= 200) return err(400, 'A collection holds up to 200 properties.'); if (!(c.items || []).some(x => x.state === st && x.county === co && x.parcel === pa)) c.items.push({ state: st, county: co, parcel: pa, note: clean(it.note, 120) }); }
  if (b.removeItem) c.items = (c.items || []).filter(x => !(x.state === b.removeItem.state && x.county === b.removeItem.county && x.parcel === b.removeItem.parcel));
  c.updated = now(); await auth.kvPut(K.c(p.uid, c.id), c); return { ok: true, id: c.id };
}
export async function deleteCollection(p, id) { if (!/^[a-f0-9]{8}$/.test(String(id)) || !(await auth.kvGet(K.c(p.uid, id)))) return err(404, 'Collection not found.'); await auth.kvPut(K.c(p.uid, id), null); return { ok: true }; }

// ---- verification requests ---------------------------------------------------------------------------------------
// The blue check is chosen by the owner. A member may only ASK once they have enough followers and a complete profile; nothing is granted automatically.
export async function verifyStatus(p) {
  const f = (p.stats || {}).followers || 0, min = VERIFY_MIN(), req = await auth.kvGet('cv_' + p.uid), done = !!p.verified || await isFounderProfile(p);
  const complete = !!(p.name && p.name !== 'New member' && p.role && p.bio);
  return { verified: done, followers: f, min, complete, requested: !!(req && req.status === 'open'), canRequest: !done && f >= min && complete && !(req && req.status === 'open') };
}
export async function requestVerify(p, note) {
  const s = await verifyStatus(p); if (s.verified) return err(400, 'This account is already verified.');
  if (s.requested) return err(400, 'Your request is already with PricePocketAsset.');
  if (s.followers < s.min) return err(403, 'Verification requests open at ' + s.min.toLocaleString('en-US') + ' followers. You have ' + s.followers.toLocaleString('en-US') + '.');
  if (!s.complete) return err(400, 'Add your name, role and a short bio before asking for verification.');
  await auth.kvPut('cv_' + p.uid, { uid: p.uid, username: p.username, note: clean(note, 300), at: now(), status: 'open', followers: s.followers }); return { ok: true };
}
export async function listVerifyRequests() { const out = []; for (const k of (await auth.kvList('cv_')).slice(0, 200)) { const r = await auth.kvGet(k); if (r && r.status === 'open') { const p = await getByUid(r.uid); out.push(Object.assign({}, r, { name: p ? p.name : '?', username: p ? p.username : r.username })); } } return out.sort((a, b) => (a.at < b.at ? 1 : -1)); }
export async function closeVerifyRequest(uid, approve) { const r = await auth.kvGet('cv_' + uid); if (!r) return err(404, 'No request found.'); r.status = approve ? 'approved' : 'declined'; r.closed = now(); await auth.kvPut('cv_' + uid, r); return { ok: true }; }

// ---- discovery -------------------------------------------------------------------------------------------------
export async function search(q, viewer, limit = 20) {
  const n = String(q || '').trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, ''); if (n.length < 2) return { rows: [] };
  const rows = [];
  for (const k of (await auth.kvList('cpu_' + n)).slice(0, 60)) { const m = await auth.kvGet(k); const p = m && await getByUid(m.uid); if (!p || !(await isVisible(p)) || (p.privacy || {}).discoverable === false || p.uid === viewer.uid) continue; if (await auth.kvGet(K.b(p.uid, viewer.uid)) || await auth.kvGet(K.b(viewer.uid, p.uid))) continue; rows.push(await miniView(p, viewer.uid)); if (rows.length >= limit) break; }
  return { rows };
}
export async function suggestions(viewer, limit = 8) {
  const rows = [], fol = new Set(await edges(`cf_${viewer.uid}_`)), keys = (await auth.kvList('cp_')).slice(-60).reverse(), f = await founderUid();
  for (const k of keys) { const p = await auth.kvGet(k); if (!p || p.uid === viewer.uid || p.uid === f || fol.has(p.uid) || (p.privacy || {}).discoverable === false || !p.name || p.name === 'New member' || !(await isVisible(p))) continue; if (await auth.kvGet(K.b(p.uid, viewer.uid)) || await auth.kvGet(K.b(viewer.uid, p.uid))) continue; rows.push(await miniView(p, viewer.uid)); if (rows.length >= limit) break; }
  return { rows };
}
