// PricePocket Live (phase 1): public live sessions on LiveKit Cloud. Storage is the same Blobs store as accounts (see auth.mjs). Key layout:
//   ls_<sessionId>   session   { id, host (community uid), room, title, visibility, is_live, started_at, ended_at, created_at }
//   la_<hostUid>     pointer to that host's ONE active session id (null when not live)
// LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET come from Netlify environment variables and never reach the browser.
// Permissions are decided here, from the signed-in account, never from anything the browser sends.
import crypto from 'node:crypto';
import { AccessToken, RoomServiceClient, WebhookReceiver } from 'livekit-server-sdk';
import * as auth from './auth.mjs';
import * as KEYS from './apikeys.mjs';
import * as C from './community.mjs';

export const TOKEN_TTL = '15m';
export const MAX_TITLE = 80;
const rid = n => crypto.randomBytes(n).toString('hex');
const now = () => new Date().toISOString();
const clean = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const err = (status, error, extra) => Object.assign({ ok: false, status, error }, extra || {});
// The three settings come from Netlify environment variables OR from the owner's key box (/owner/keys/, stored on the server). A Netlify variable wins if both exist.
const K = n => KEYS.keyOf(n);
export const loadKeys = () => KEYS.load();
export const configured = () => !!(K('LIVEKIT_URL') && K('LIVEKIT_API_KEY') && K('LIVEKIT_API_SECRET'));
export const SETUP_MESSAGE = 'PricePocket Live is not switched on yet. The owner needs to add LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET on the Owner keys page (or in Netlify environment variables).';
const httpUrl = () => String(K('LIVEKIT_URL') || '').replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');

// The room service is injectable so tests never touch the network.
let svc = null;
export const _setRoomService = s => { svc = s; svcSig = ''; };
let svcSig = '';
const rooms = () => { if (svc && !svcSig) return svc; const sig = httpUrl() + K('LIVEKIT_API_KEY') + K('LIVEKIT_API_SECRET'); if (svcSig !== sig) { svc = new RoomServiceClient(httpUrl(), K('LIVEKIT_API_KEY'), K('LIVEKIT_API_SECRET')); svcSig = sig; } return svc; };

// What each role may do in a room. Subscriber-only rooms, viewer-only mode, raise-hand and co-hosts will be new roles here later.
export function grantsFor(role, room) {
  const base = { room, roomJoin: true, canSubscribe: true, canPublishData: true };
  if (role === 'host') return Object.assign(base, { canPublish: true, roomAdmin: true });
  return Object.assign(base, { canPublish: true });   // phase 1: guests may use camera and microphone
}

const sGet = id => /^[a-f0-9]{16}$/.test(String(id)) ? auth.kvGet('ls_' + id) : null;
export async function getSession(id) { return sGet(id); }
export async function activeFor(hostUid) { const p = await auth.kvGet('la_' + hostUid); return p && p.id ? sGet(p.id).then(s => (s && s.is_live ? s : null)) : null; }
const pub = (s, host, viewers) => ({ id: s.id, title: s.title, visibility: s.visibility, is_live: !!s.is_live, started_at: s.started_at, ended_at: s.ended_at || null, viewers: viewers == null ? null : viewers,
  host: host ? { username: host.username, name: host.name, founder: !!host.founder } : null });

async function viewerCount(room) {
  try { const list = await rooms().listParticipants(room); return Math.max(0, list.filter(p => !(p.metadata && /"role":"host"/.test(p.metadata))).length); } catch (e) { return null; }
}
async function blockedBetween(a, b) { return !!(await auth.kvGet(`cb_${a}_${b}`)) || !!(await auth.kvGet(`cb_${b}_${a}`)); }

// ---- start ----
export async function start(me, b) {
  if (!configured()) return err(503, SETUP_MESSAGE, { setup: true });
  const title = clean(b.title, MAX_TITLE); if (title.length < 3) return err(400, 'Give your live a title (at least 3 characters).');
  if (b.visibility !== undefined && b.visibility !== 'public') return err(400, 'Only public lives are available right now.');
  if (b.host !== undefined && b.host !== me.uid && b.host !== me.username) return err(403, 'You can only go live from your own profile.');
  const existing = await activeFor(me.uid);
  if (existing) return { ok: true, already: true, session: pub(existing, me) };   // never two active lives for one host
  const s = { id: rid(8), host: me.uid, room: 'ppl-' + rid(10), title, visibility: 'public', is_live: true, started_at: now(), ended_at: null, created_at: now() };
  try { await rooms().createRoom({ name: s.room, emptyTimeout: 300, maxParticipants: 50 }); } catch (e) { return err(502, 'Could not start the live room. Please try again in a moment.'); }
  await auth.kvPut('ls_' + s.id, s); await auth.kvPut('la_' + me.uid, { id: s.id }); await auth.kvPut('lr_' + s.room, { id: s.id });
  return { ok: true, session: pub(s, me) };
}

// ---- token ----
export async function token(me, id) {
  if (!configured()) return err(503, SETUP_MESSAGE, { setup: true });
  const s = await sGet(id); if (!s) return err(404, 'This live does not exist.');
  if (!s.is_live) return err(410, 'This live has ended.', { ended: true });
  const host = await C.getByUid(s.host), isHost = s.host === me.uid;
  if (!host || !(await C.isVisible(host))) return err(404, 'This live is not available.');
  if (!isHost && (await blockedBetween(me.uid, s.host))) return err(403, 'You cannot join this live.');
  if (!isHost && (await wasRemoved(s.id, me.uid))) return err(403, 'You were removed from this live.');
  if (s.visibility !== 'public') return err(403, 'This live is not open to you.');   // later: subscriber-only checks go here
  const role = isHost ? 'host' : 'guest';
  const at = new AccessToken(K('LIVEKIT_API_KEY'), K('LIVEKIT_API_SECRET'), { identity: me.uid, name: me.name, ttl: TOKEN_TTL,
    metadata: JSON.stringify({ role, username: me.username, name: me.name, founder: !!me.founder }) });
  at.addGrant(grantsFor(role, s.room));
  return { ok: true, token: await at.toJwt(), url: K('LIVEKIT_URL'), role, session: pub(s, host), me: { uid: me.uid, username: me.username, name: me.name } };
}

// ---- status (profile page + room polling) ----
export async function statusByUsername(username) {
  const p = await C.getByUsername(username); if (!p || !(await C.isVisible(p))) return { ok: true, live: null };
  const s = await activeFor(p.uid); if (!s) return { ok: true, live: null };
  return { ok: true, live: pub(s, p, configured() ? await viewerCount(s.room) : null) };
}
export async function statusById(id) {
  const s = await sGet(id); if (!s) return err(404, 'This live does not exist.');
  const host = await C.getByUid(s.host);
  return { ok: true, session: pub(s, host, s.is_live && configured() ? await viewerCount(s.room) : null) };
}

// ---- end / remove ----
async function closeSession(s) {
  s.is_live = false; s.ended_at = now(); await auth.kvPut('ls_' + s.id, s); await auth.kvPut('la_' + s.host, null);
  try { await rooms().deleteRoom(s.room); } catch (e) { /* the room may already be gone: the database is the source of truth */ }
}
export async function end(me, id) {
  const s = await sGet(id); if (!s) return err(404, 'This live does not exist.');
  if (s.host !== me.uid) return err(403, 'Only the host can end this live.');
  if (!s.is_live) return { ok: true, already: true };
  await closeSession(s); return { ok: true };
}
export async function remove(me, id, identity) {
  const s = await sGet(id); if (!s) return err(404, 'This live does not exist.');
  if (s.host !== me.uid) return err(403, 'Only the host can remove people.');
  if (!s.is_live) return err(410, 'This live has ended.', { ended: true });
  if (!/^[a-f0-9]{16}$/.test(String(identity))) return err(400, 'Pick someone to remove.');
  if (identity === me.uid) return err(400, 'You cannot remove yourself. Use End live instead.');
  await auth.kvPut(`lk_${s.id}_${identity}`, { at: now() });   // removed people cannot come straight back into this same live
  try { await rooms().removeParticipant(s.room, identity); } catch (e) { /* they may already have left */ }
  return { ok: true };
}
export async function wasRemoved(id, uid) { return !!(await auth.kvGet(`lk_${id}_${uid}`)); }

// ---- LiveKit webhook: when LiveKit closes a room by itself (everyone left, host's phone died), the database must stop saying "live" ----
export async function webhook(body, authHeader) {
  if (!configured()) return err(503, SETUP_MESSAGE, { setup: true });
  let ev; try { ev = await new WebhookReceiver(K('LIVEKIT_API_KEY'), K('LIVEKIT_API_SECRET')).receive(body, authHeader); } catch (e) { return err(401, 'Bad signature.'); }
  if (ev.event === 'room_finished' && ev.room && ev.room.name) {
    const m = await auth.kvGet('lr_' + ev.room.name); const s = m && m.id ? await sGet(m.id) : null;
    if (s && s.is_live) { s.is_live = false; s.ended_at = now(); await auth.kvPut('ls_' + s.id, s); await auth.kvPut('la_' + s.host, null); return { ok: true, closed: s.id }; }
  }
  return { ok: true, ignored: ev.event };
}

// Owner "Test it": asks LiveKit Cloud for the room list using the saved URL/key/secret. Never returns the secret.
export async function selfTest() {
  if (!configured()) return { ok: false, error: 'Save all three LiveKit boxes first (URL, API key, API secret).' };
  try { const r = await rooms().listRooms(); return { ok: true, text: 'LiveKit answered: URL, API key and secret all work. Rooms open right now: ' + r.length + '.' }; }
  catch (e) { return { ok: false, error: 'LiveKit did not accept these settings (' + String((e && e.message) || e).replace(/[A-Za-z0-9_\-]{24,}/g, '…').slice(0, 120) + '). Check the URL, key and secret match.' }; }
}
