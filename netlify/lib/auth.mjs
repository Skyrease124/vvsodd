// Member accounts: email + password, stored server-side in Netlify Blobs. Passwords are hashed (scrypt), never stored as text.
// Sessions are signed, HttpOnly cookies. USERS_DIR switches storage to a folder for local tests.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getStore } from '@netlify/blobs';

const COOKIE = 'ppa_s', DAYS = 30;
const CODE_HASH = process.env.SETUP_CODE_HASH || '7bcea3ec427a6a4ee2a7a7320f380be5ab648b3659bb38ca3420e92b17e7ae7b';
const store = () => getStore({ name: 'pricepocketasset-users', consistency: 'strong' });
const dirFile = k => path.join(process.env.USERS_DIR, k.replace(/[^a-z0-9_-]/gi, '_') + '.json');
async function get(k) {
  if (process.env.USERS_DIR) { try { return JSON.parse(fs.readFileSync(dirFile(k), 'utf8')); } catch (e) { return null; } }
  try { return await store().get(k, { type: 'json' }); } catch (e) { return null; }
}
async function put(k, v) {
  if (process.env.USERS_DIR) { fs.mkdirSync(process.env.USERS_DIR, { recursive: true }); fs.writeFileSync(dirFile(k), JSON.stringify(v)); return; }
  await store().setJSON(k, v);
}

export const kvGet = get;
export const kvPut = put;
export const normEmail = e => String(e || '').trim().toLowerCase();
export const validEmail = e => e.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const userKey = e => 'u_' + crypto.createHash('sha256').update(e).digest('hex');

let secretCache = null;
async function secret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (secretCache) return secretCache;
  let s = await get('session-secret');
  if (!s || !s.v) { s = { v: crypto.randomBytes(32).toString('hex') }; await put('session-secret', s); s = (await get('session-secret')) || s; }
  return (secretCache = s.v);
}
const b64 = b => Buffer.from(b).toString('base64url');
async function sign(payload) {
  const body = b64(JSON.stringify(payload));
  return body + '.' + crypto.createHmac('sha256', await secret()).update(body).digest('base64url');
}
async function verify(tok) {
  const [body, sig] = String(tok || '').split('.');
  if (!body || !sig) return null;
  const want = crypto.createHmac('sha256', await secret()).update(body).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(want);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url').toString()); return p.exp > Date.now() ? p : null; } catch (e) { return null; }
}
const hashPw = (pw, salt) => new Promise((res, rej) => crypto.scrypt(pw, salt, 64, (e, k) => e ? rej(e) : res(k.toString('hex'))));

export function codeOk(code) {
  const norm = String(code || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  const dashed = norm.match(/.{1,5}/g) ? norm.match(/.{1,5}/g).join('-') : '';
  const got = crypto.createHash('sha256').update(dashed).digest(), want = Buffer.from(CODE_HASH, 'hex');
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

export async function createUser(email, password, isOwner) {
  const k = userKey(email);
  if (await get(k)) return null;
  const salt = crypto.randomBytes(16).toString('hex');
  const u = { email, salt, hash: await hashPw(password, salt), owner: !!isOwner, created: new Date().toISOString(), saved: [] };
  await put(k, u);
  return u;
}
export async function checkLogin(email, password) {
  const u = await get(userKey(email));
  const salt = u ? u.salt : 'x'.repeat(32);
  const h = Buffer.from(await hashPw(password, salt), 'hex'), want = Buffer.from(u ? u.hash : '0'.repeat(128), 'hex');
  return u && crypto.timingSafeEqual(h, want) ? u : null;
}
export async function sessionCookie(email) {
  const tok = await sign({ e: email, iat: Date.now(), exp: Date.now() + DAYS * 864e5 });
  return `${COOKIE}=${tok}; Path=/; Max-Age=${DAYS * 86400}; HttpOnly; Secure; SameSite=Lax`;
}
export const clearCookie = () => `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
// Returns the user for a request's cookie header, or null.
export async function userFromCookie(cookieHeader) {
  const m = String(cookieHeader || '').match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)'));
  const p = m && await verify(m[1]);
  if (!p) return null;
  const u = await get(userKey(p.e));
  // a password change signs out every older session
  if (!u || (p.iat || 0) < (u.pwChanged || 0)) return null;
  return markOwner(u);
}
export async function saveUser(u) { await put(userKey(u.email), u); }

export const getUser = async email => { const u = await get(userKey(email)); return u ? markOwner(u) : u; };
export async function setPassword(email, password) {
  const u = await get(userKey(email)); if (!u) return null;
  u.salt = crypto.randomBytes(16).toString('hex'); u.hash = await hashPw(password, u.salt); u.pwChanged = Date.now();
  delete u.reset; await put(userKey(email), u); return u;
}
// One-hour, single-use reset link token. Only a hash of it is stored.
export async function makeResetToken(email) {
  const u = await get(userKey(email)); if (!u) return null;
  const tok = crypto.randomBytes(32).toString('base64url');
  u.reset = { h: crypto.createHash('sha256').update(tok).digest('hex'), exp: Date.now() + 3600e3 };
  await put(userKey(email), u); return tok;
}
export async function useResetToken(email, tok, password) {
  const u = await get(userKey(email)); if (!u || !u.reset || u.reset.exp < Date.now()) return false;
  const a = Buffer.from(crypto.createHash('sha256').update(String(tok)).digest('hex')), b = Buffer.from(u.reset.h);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  return !!(await setPassword(email, password));
}
export async function addResetRequest(email) {
  const l = (await get('resetreqs')) || { list: [] };
  l.list = l.list.filter(x => x.email !== email); l.list.unshift({ email, at: new Date().toISOString() }); l.list = l.list.slice(0, 50);
  await put('resetreqs', l);
}
export const getResetRequests = async () => ((await get('resetreqs')) || { list: [] }).list;
export async function clearResetRequest(email) {
  const l = (await get('resetreqs')) || { list: [] }; l.list = l.list.filter(x => x.email !== email); await put('resetreqs', l);
}
// Email through Resend (https://resend.com). Needs RESEND_API_KEY. Returns true if the provider accepted it.
export async function sendMail(to, subject, text) {
  const key = process.env.RESEND_API_KEY; if (!key) return false;
  try {
    const r = await fetch(process.env.MAIL_API_URL || 'https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.MAIL_FROM || 'PricePocketAsset <noreply@pricepocketasset.com>', to: [to], subject, text }) });
    return r.ok;
  } catch (e) { return false; }
}

// The site owner's own email, for the account that already existed when this rule was added (so nobody can
// register that address later and become owner). Everyone else becomes owner only with the setup code.
const OWNER_EMAIL = 'skyariasa@gmail.com', OWNER_CUTOFF = '2026-11-05T18:58:30Z';
function markOwner(u) {
  if (!u.owner && u.email === OWNER_EMAIL && u.created && u.created < OWNER_CUTOFF) u.owner = true;
  return u;
}
export { markOwner };
