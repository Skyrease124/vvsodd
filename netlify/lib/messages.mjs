// Private one-to-one messages. Every check happens here on the server: only the two members of a conversation can read it.
// Storage (same Blobs store as accounts):
//   mc_<cid>              conversation {id, a, b, state:'active'|'request', from, to, created, last:{at,from}, readAt:{uid:iso}, declined:{uid:iso}}
//   mm_<cid>_<ts><rand>   message {id, from, body, at, cid, cmid}         (key sorts by time; no overwrite races)
//   mk_<cid>_<cmid>       client-id -> message id (a retried send never creates a second message)
//   mi_<uid>_<cid>        inbox index {cid, other, at, unread, folder:'inbox'|'requests', hidden}
//   mp_<uid>              presence {cid, at} (who is looking at which conversation; used only to skip pushes)
// The conversation id is derived from the two member ids, so two people always share exactly one conversation.
import crypto from 'node:crypto';
import * as auth from './auth.mjs';
import * as C from './community.mjs';
import * as OS from './onesignal.mjs';
import { prefsOf } from './pushjobs.mjs';

const now = () => new Date().toISOString();
const err = (status, error, extra) => Object.assign({ ok: false, status, error }, extra || {});
export const MAX_LEN = 2000;
const REQUEST_MAX_MSGS = 3;           // a pending request can hold at most 3 messages until accepted
const DECLINE_COOLDOWN = 30 * 864e5;  // after a decline, no new request for 30 days
const PRESENCE_MS = 25e3;
export const cidOf = (x, y) => crypto.createHash('sha256').update([x, y].sort().join('|')).digest('hex').slice(0, 20);
const idOk = s => /^[a-f0-9]{20}$/.test(String(s));
// Text only. Control characters and angle brackets are removed; the page also renders with textContent, never as HTML.
export const cleanBody = s => String(s == null ? '' : s).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f<>‪-‮⁦-⁩]/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{4,}/g, '\n\n\n').trim().slice(0, MAX_LEN);

async function member(conv, uid) { return conv && (conv.a === uid || conv.b === uid); }
const otherOf = (conv, uid) => (conv.a === uid ? conv.b : conv.a);
async function blockedEither(x, y) { return !!((await auth.kvGet(`cb_${x}_${y}`)) || (await auth.kvGet(`cb_${y}_${x}`))); }
async function rule(me, target) {
  const [fo, fb] = await Promise.all([auth.kvGet(`cf_${me.uid}_${target.uid}`), auth.kvGet(`cf_${target.uid}_${me.uid}`)]);
  return C.messageRule(target.privacy, { self: me.uid === target.uid, blocked: await blockedEither(me.uid, target.uid), following: !!fo, followedBy: !!fb });
}
async function visible(p) { return p && await C.isVisible(p); }
const who = async (uid, viewer) => { const p = await C.getByUid(uid); return p ? C.miniView(p, viewer) : { uid, username: '', name: 'Member' }; };

// Open (or look at) the conversation with a username. Returns what the page needs to show the composer correctly.
export async function open(me, username) {
  const t = await C.getByUsername(username); if (!t || !(await visible(t)) || t.uid === me.uid) return err(404, 'This account is not available.');
  const cid = cidOf(me.uid, t.uid), conv = await auth.kvGet('mc_' + cid);
  if (await blockedEither(me.uid, t.uid)) return { ok: true, cid, other: await who(t.uid, me.uid), canSend: false, reason: 'unavailable', exists: !!conv };
  if (conv && conv.state === 'active') return { ok: true, cid, other: await who(t.uid, me.uid), canSend: true, mode: 'direct', exists: true };
  if (conv && conv.state === 'request' && conv.to === me.uid) return { ok: true, cid, other: await who(t.uid, me.uid), canSend: false, mode: 'incoming-request', exists: true };
  const r = await rule(me, t); const declined = conv && conv.declined && conv.declined[t.uid] && Date.now() - Date.parse(conv.declined[t.uid]) < DECLINE_COOLDOWN;
  if (!r.ok || declined) return { ok: true, cid, other: await who(t.uid, me.uid), canSend: false, reason: 'privacy', exists: !!conv };
  return { ok: true, cid, other: await who(t.uid, me.uid), canSend: true, mode: conv && conv.state === 'request' ? 'request-pending' : r.mode, exists: !!conv };
}

async function index(uid, cid, patch) { const k = `mi_${uid}_${cid}`; const v = Object.assign((await auth.kvGet(k)) || { cid, unread: 0, folder: 'inbox' }, patch); await auth.kvPut(k, v); return v; }

// Send. cmid = the page's own id for this message, so retries and double taps never duplicate it.
export async function send(me, user, { to, body, cmid }) {
  const text = cleanBody(body); if (!text) return err(400, 'Write a message first.');
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(String(cmid || ''))) return err(400, 'Bad request.');
  const t = await C.getByUsername(to); if (!t || !(await visible(t)) || t.uid === me.uid) return err(404, 'This account is not available.');
  const cid = cidOf(me.uid, t.uid);
  const prior = await auth.kvGet(`mk_${cid}_${cmid}`); if (prior) return { ok: true, duplicate: true, message: prior, cid };
  if (await blockedEither(me.uid, t.uid)) return err(403, 'You can’t send messages to this account.');
  let conv = await auth.kvGet('mc_' + cid); const t0 = now();
  if (conv && conv.state === 'request' && conv.to === me.uid) return err(409, 'Accept the request before replying.');
  if (!conv || conv.state !== 'active') {
    const r = await rule(me, t);
    if (conv && conv.declined && conv.declined[t.uid] && Date.now() - Date.parse(conv.declined[t.uid]) < DECLINE_COOLDOWN) return err(403, 'You can’t send messages to this account.');
    if (!r.ok) return err(403, 'This member is not accepting messages from you.');
    if (r.mode === 'request') {
      if (conv && conv.state === 'request' && (conv.reqCount || 0) >= REQUEST_MAX_MSGS) return err(429, 'Wait for them to accept your request before sending more.');
      if (!conv || conv.state !== 'request') { const lim = await requestLimit(user); if (!lim.ok) return lim; }
    }
    conv = Object.assign(conv || { id: cid, a: [me.uid, t.uid].sort()[0], b: [me.uid, t.uid].sort()[1], created: t0, readAt: {}, declined: {} }, r.mode === 'request' ? { state: 'request', from: me.uid, to: t.uid } : { state: 'active' });
    if (r.mode === 'request') conv.reqCount = (conv.reqCount || 0) + 1;
  }
  // repeated identical text to the same person within 2 minutes is refused (spam)
  if (conv.lastBody && conv.lastBody.from === me.uid && conv.lastBody.h === hash(text) && Date.now() - Date.parse(conv.lastBody.at) < 120e3) return err(429, 'You just sent that message.');
  const id = String(Date.now()).padStart(13, '0') + crypto.randomBytes(3).toString('hex');
  const m = { id, cid, from: me.uid, body: text, at: t0, cmid };
  await auth.kvPut(`mm_${cid}_${id}`, m); await auth.kvPut(`mk_${cid}_${cmid}`, m);
  conv.last = { at: t0, from: me.uid }; conv.lastBody = { from: me.uid, h: hash(text), at: t0 }; conv.readAt = Object.assign({}, conv.readAt, { [me.uid]: t0 });
  await auth.kvPut('mc_' + cid, conv);
  await index(me.uid, cid, { other: t.uid, at: t0, folder: 'inbox', hidden: false, preview: text.slice(0, 90), previewFrom: me.uid });
  const ti = await auth.kvGet(`mi_${t.uid}_${cid}`) || {};
  await index(t.uid, cid, { other: me.uid, at: t0, unread: (ti.unread || 0) + 1, folder: conv.state === 'request' ? 'requests' : 'inbox', hidden: false, preview: text.slice(0, 90), previewFrom: me.uid });
  await push(me, t, conv, m).catch(() => {});   // awaited: serverless functions may stop right after responding
  return { ok: true, message: m, cid, state: conv.state };
}
const hash = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
// New accounts (under 3 days) can start 5 new requests a day; others 20.
async function requestLimit(user) {
  const young = !user.created || Date.now() - Date.parse(user.created) < 3 * 864e5, max = young ? 5 : 20;
  const k = 'mrq_' + crypto.createHash('sha256').update(user.email).digest('hex').slice(0, 24) + '_' + now().slice(0, 10);
  const n = ((await auth.kvGet(k)) || { n: 0 }).n; if (n >= max) return err(429, young ? 'New accounts can send ' + max + ' message requests a day. Try again tomorrow.' : 'You have sent a lot of message requests today. Try again tomorrow.');
  await auth.kvPut(k, { n: n + 1 }); return { ok: true };
}
async function push(me, t, conv, m) {
  const pres = await auth.kvGet('mp_' + t.uid); if (pres && pres.cid === conv.id && Date.now() - Date.parse(pres.at) < PRESENCE_MS) return;   // they are looking at it
  const nt = t.notif || {}; if (nt.messages === false) return;
  const u = await auth.getUser(t.email); if (!u || u.revoked) return; const pp = prefsOf(u); if (!pp.enabled || !pp.subscribed) return;
  if (await blockedEither(me.uid, t.uid)) return;
  const preview = nt.msgPreview !== false; const req = conv.state === 'request';
  const title = preview ? (req ? 'Message request from ' : 'New message from ') + me.name : 'New PricePocket message';
  const body = preview ? '“' + m.body.slice(0, 120) + (m.body.length > 120 ? '…' : '') + '”' : (req ? 'You have a new message request.' : 'You have a new private message.');
  await OS.send({ email: t.email, title, body, path: '/messages/?c=' + conv.id, key: 'msg:' + m.id, topic: 'msg-' + conv.id, retail: true });
}

// Read a conversation. since = last message id the page already has (only newer ones are returned).
export async function read(me, cid, { since } = {}) {
  if (!idOk(cid)) return err(404, 'Conversation not found.');
  const conv = await auth.kvGet('mc_' + cid); if (!conv || !(await member(conv, me.uid))) return err(404, 'Conversation not found.');   // same answer whether it exists or not
  const oid = otherOf(conv, me.uid), op = await C.getByUid(oid);
  let keys = (await auth.kvList('mm_' + cid + '_')).sort(); if (since && /^\d{13}[a-f0-9]{6}$/.test(since)) keys = keys.filter(k => k.slice(24) > since); else keys = keys.slice(-200);
  const msgs = []; for (const k of keys) { const m = await auth.kvGet(k); if (m && !m.deleted) msgs.push({ id: m.id, mine: m.from === me.uid, body: m.body, at: m.at, cmid: m.from === me.uid ? m.cmid : undefined }); }
  await auth.kvPut('mp_' + me.uid, { cid, at: now() });
  const mi = await auth.kvGet(`mi_${me.uid}_${cid}`); const incomingReq = conv.state === 'request' && conv.to === me.uid;
  if (!incomingReq && mi && mi.unread) await index(me.uid, cid, { unread: 0 });
  if (!incomingReq && msgs.length) { conv.readAt = Object.assign({}, conv.readAt, { [me.uid]: now() }); await auth.kvPut('mc_' + cid, conv); }
  const blocked = await blockedEither(me.uid, oid);
  return { ok: true, cid, state: conv.state, incomingRequest: incomingReq, outgoingRequest: conv.state === 'request' && conv.from === me.uid, other: blocked ? { uid: oid, username: op ? op.username : '', name: op ? op.name : 'Member' } : await who(oid, me.uid), messages: msgs, theirReadAt: (conv.readAt || {})[oid] || '', canSend: !blocked && !incomingReq && !!op && await visible(op), blocked };
}
export async function list(me, folder = 'inbox') {
  const out = []; for (const k of await auth.kvList('mi_' + me.uid + '_')) { const v = await auth.kvGet(k); if (!v || v.hidden || (v.folder || 'inbox') !== folder) continue; const p = await C.getByUid(v.other); if (!p || !(await visible(p))) continue;
    out.push({ cid: v.cid, other: await C.miniView(p, me.uid), at: v.at, unread: v.unread || 0, preview: v.preview || '', mine: v.previewFrom === me.uid }); }
  return out.sort((a, b) => (a.at < b.at ? 1 : -1));
}
export async function unread(me) { let n = 0, r = 0; for (const k of await auth.kvList('mi_' + me.uid + '_')) { const v = await auth.kvGet(k); if (!v || v.hidden) continue; if ((v.folder || 'inbox') === 'requests') r++; else n += v.unread || 0; } return { unread: n, requests: r }; }
export async function decide(me, cid, decision) {
  if (!idOk(cid)) return err(404, 'Conversation not found.'); const conv = await auth.kvGet('mc_' + cid); if (!conv || conv.state !== 'request' || conv.to !== me.uid) return err(404, 'Request not found.');
  if (decision === 'accept') { conv.state = 'active'; await auth.kvPut('mc_' + cid, conv); await index(me.uid, cid, { folder: 'inbox' }); return { ok: true }; }
  if (decision === 'decline' || decision === 'delete') { conv.declined = Object.assign({}, conv.declined, { [me.uid]: now() }); conv.state = 'declined'; await auth.kvPut('mc_' + cid, conv); await index(me.uid, cid, { hidden: true, unread: 0 }); return { ok: true }; }
  return err(400, 'Unknown choice.');
}
export async function hide(me, cid) { if (!idOk(cid)) return err(404, 'Conversation not found.'); const conv = await auth.kvGet('mc_' + cid); if (!conv || !(await member(conv, me.uid))) return err(404, 'Conversation not found.'); await index(me.uid, cid, { hidden: true, unread: 0 }); return { ok: true }; }
// Report a member or one message into the existing community report queue. Only the reported message text is copied.
export async function report(me, cid, { messageId, category, details }) {
  if (!idOk(cid)) return err(404, 'Conversation not found.'); const conv = await auth.kvGet('mc_' + cid); if (!conv || !(await member(conv, me.uid))) return err(404, 'Conversation not found.');
  const oid = otherOf(conv, me.uid); let text = '';
  if (messageId) { const m = /^\d{13}[a-f0-9]{6}$/.test(messageId) ? await auth.kvGet(`mm_${cid}_${messageId}`) : null; if (!m || m.from !== oid) return err(404, 'Message not found.'); text = m.body.slice(0, 500); }
  const r = await C.report(me, oid, category, details); if (!r.ok) return r;
  if (text) { const ks = (await auth.kvList('crp_')); for (const k of ks.slice(-20)) { const x = await auth.kvGet(k); if (x && x.by === me.uid && x.target === oid && !x.dm && Date.now() - Date.parse(x.at) < 60e3) { x.dm = { cid, messageId, text }; await auth.kvPut(k, x); break; } } }
  return { ok: true };
}
// Owner moderation: remove one reported message. Logged.
export async function ownerRemove(owner, cid, messageId) {
  const m = /^\d{13}[a-f0-9]{6}$/.test(String(messageId)) && idOk(cid) ? await auth.kvGet(`mm_${cid}_${messageId}`) : null; if (!m) return err(404, 'Message not found.');
  m.deleted = true; m.body = ''; await auth.kvPut(`mm_${cid}_${messageId}`, m);
  const log = (await auth.kvGet('mlog')) || []; log.unshift({ at: now(), by: owner, action: 'remove-message', cid, messageId }); await auth.kvPut('mlog', log.slice(0, 500)); return { ok: true };
}
