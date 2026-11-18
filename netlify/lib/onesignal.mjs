// OneSignal Web Push delivery. The REST API key is read only on the server: Netlify environment variable ONESIGNAL_REST_API_KEY
// (or, as a fallback, the owner key box). The App ID is public by design and also ships in the browser.
// Duplicate protection: (1) our own sent-log per member, (2) OneSignal idempotency_key made from the same unique key.
import crypto from 'node:crypto';
import * as KEYS from './apikeys.mjs';
import { kvGet, kvPut } from './auth.mjs';

export const APP_ID = process.env.ONESIGNAL_APP_ID || '0bfd191b-3015-40ad-9765-952203f0e2ea';
const API = process.env.ONESIGNAL_API_URL || 'https://api.onesignal.com/notifications?c=push';
const SITE = 'https://pricepocketasset.com';
const h = s => crypto.createHash('sha256').update(String(s)).digest('hex');

export async function restKey() { await KEYS.load(); return KEYS.keyOf('ONESIGNAL_REST_API_KEY'); }
export async function configured() { return !!(await restKey()); }

// Opaque id for OneSignal (never the email). Same member always gets the same id.
export function externalId(email) {
  const secret = process.env.SESSION_SECRET || 'dev-secret';
  return 'pp_' + crypto.createHmac('sha256', secret).update('push|' + String(email).toLowerCase()).digest('base64url').slice(0, 24);
}
const uuidOf = k => { const x = h('pp-push|' + k); return `${x.slice(0, 8)}-${x.slice(8, 12)}-4${x.slice(13, 16)}-8${x.slice(17, 20)}-${x.slice(20, 32)}`; };
const logKey = email => 'pushlog_' + h(String(email).toLowerCase()).slice(0, 32);

// Texts must never claim a property is available. Callers pass already-careful wording; this adds a hard stop.
const BANNED = /\b(available now|now available|still available|is available|guaranteed|can't lose|act now|last chance|sure thing)\b/i;
export const safeText = s => !BANNED.test(String(s || ''));

// send({email, title, body, path, key, topic}) -> {ok, skipped?, error?, id?}
// key: a stable unique key for this notification (event id etc.). The same key is never sent to the same member twice.
export async function send({ email, title, body, path = '/account/', key, topic, dry }) {
  if (!email || !key) return { ok: false, error: 'missing email or key' };
  if (!safeText(title) || !safeText(body)) return { ok: false, error: 'blocked: wording makes an availability claim' };
  const log = (await kvGet(logKey(email))) || { keys: [] };
  if (log.keys.includes(key)) return { ok: true, skipped: 'duplicate' };
  const apiKey = await restKey(); if (!apiKey) return { ok: false, error: 'OneSignal key is not set' };
  if (dry) return { ok: true, dry: true };
  const payload = { app_id: APP_ID, target_channel: 'push', include_aliases: { external_id: [externalId(email)] }, headings: { en: String(title).slice(0, 80) }, contents: { en: String(body).slice(0, 240) }, url: SITE + path, idempotency_key: uuidOf(email + '|' + key), ttl: 86400 };
  if (topic) payload.web_push_topic = String(topic).slice(0, 60);
  const c = new AbortController(), t = setTimeout(() => c.abort(), 10000);
  try {
    const r = await fetch(API, { method: 'POST', signal: c.signal, headers: { 'Content-Type': 'application/json', Authorization: 'Key ' + apiKey }, body: JSON.stringify(payload) });
    let d = {}; try { d = await r.json(); } catch (e) { /* not json */ }
    const errs = Array.isArray(d.errors) ? d.errors.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join('; ') : (d.errors ? JSON.stringify(d.errors) : '');
    if (!r.ok) return { ok: false, error: ('HTTP ' + r.status + (errs ? ': ' + errs : '')).slice(0, 200) };
    if (!d.id) return { ok: false, error: (errs || 'no recipients').slice(0, 200), noRecipient: true };
    log.keys = log.keys.concat(key).slice(-1500); await kvPut(logKey(email), log);
    return { ok: true, id: d.id };
  } catch (e) { return { ok: false, error: 'network' }; } finally { clearTimeout(t); }
}
export const wasSent = async (email, key) => ((await kvGet(logKey(email))) || { keys: [] }).keys.includes(key);
