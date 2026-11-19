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
// Every key we hold, Netlify setting first, then the one saved on the owner page. If the first is rejected we try the next,
// so one stale value can never block delivery. Returns [{key, source}].
export async function candidates() {
  const box = (await KEYS.load(true)).ONESIGNAL_REST_API_KEY || '', env = process.env.ONESIGNAL_REST_API_KEY || '', out = [];
  if (env) out.push({ key: env, source: 'Netlify setting' }); if (box && box !== env) out.push({ key: box, source: 'saved on the owner page' });
  return out;
}
export async function configured() { return (await candidates()).length > 0; }

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

// OneSignal has two key styles: new App API keys (start with os_v2_app_) use "Authorization: Key <key>"; older REST API keys use "Basic <key>".
// Try the likely one first and fall back once, so either style works. Returns {r, scheme}.
export async function post(apiKey, payload, signal) {
  const schemes = /^os_/.test(apiKey) ? ['Key'] : ['Key', 'Basic']; let r, used;
  for (const sc of schemes) {
    used = sc; r = await fetch(API, { method: 'POST', signal, headers: { 'Content-Type': 'application/json', Authorization: sc + ' ' + apiKey }, body: JSON.stringify(payload) });
    if (r.status !== 401 && r.status !== 403) break;
  }
  return { r, scheme: used };
}
// Tries each held key until one is not rejected. Returns {r, scheme, source} (r null if no key at all).
export async function postAny(payload, signal) {
  let last = { r: null, scheme: '', source: '' };
  for (const c of await candidates()) { const x = await post(c.key, payload, signal); last = { ...x, source: c.source }; if (x.r.status !== 401 && x.r.status !== 403) return last; }
  return last;
}
// send({email, title, body, path, key, topic}) -> {ok, skipped?, error?, id?}
// key: a stable unique key for this notification (event id etc.). The same key is never sent to the same member twice.
// Retail pushes may open a store page. The caller passes link only after lib/retail.mjs checked it against the store allowlist;
// this re-checks the host so nothing else can ever be used as a push destination.
const RETAIL_HOSTS = ['nike.com', 'target.com', 'walmart.com', 'amazon.com', 'bestbuy.com', 'pokemoncenter.com', 'gamestop.com'];
export function retailLink(link) { try { const u = new URL(link); const h = u.hostname.toLowerCase(); return u.protocol === 'https:' && RETAIL_HOSTS.some(x => h === x || h.endsWith('.' + x)) ? u.toString() : ''; } catch (e) { return ''; } }
const target = (link, path) => retailLink(link) || (/^\/(?!\/)/.test(path || '') ? SITE + path : SITE + '/');
// Send to every subscribed device (owner's "Send to Everyone"). One API call; idempotency key stops double sends.
export async function sendSegment({ title, body, link, path, key, priority, image }) {
  if (!(await configured())) return { ok: false, error: 'OneSignal key is not set' };
  const payload = { app_id: APP_ID, target_channel: 'push', included_segments: ['Total Subscriptions'], headings: { en: String(title).slice(0, 80) }, contents: { en: String(body).slice(0, 240) }, url: target(link, path), idempotency_key: uuidOf('seg|' + key), web_push_topic: 'retail-broadcast' };
  if (priority === 'high') payload.priority = 10; if (image) payload.chrome_web_image = image;
  const c = new AbortController(), t = setTimeout(() => c.abort(), 10000);
  try { const { r } = await postAny(payload, c.signal); if (!r) return { ok: false, error: 'OneSignal key is not set' }; let d = {}; try { d = await r.json(); } catch (e) { /* */ } return r.ok && d.id ? { ok: true, id: d.id } : { ok: false, error: ('HTTP ' + r.status + ' ' + JSON.stringify(d.errors || '')).slice(0, 200) }; }
  catch (e) { return { ok: false, error: 'network' }; } finally { clearTimeout(t); }
}
export async function send({ email, title, body, path = '/account/', key, topic, dry, link, retail }) {
  if (!email || !key) return { ok: false, error: 'missing email or key' };
  if (!retail && (!safeText(title) || !safeText(body))) return { ok: false, error: 'blocked: wording makes an availability claim' };
  const log = (await kvGet(logKey(email))) || { keys: [] };
  if (log.keys.includes(key)) return { ok: true, skipped: 'duplicate' };
  if (!(await configured())) return { ok: false, error: 'OneSignal key is not set' };
  if (dry) return { ok: true, dry: true };
  const payload = { app_id: APP_ID, target_channel: 'push', include_aliases: { external_id: [externalId(email)] }, headings: { en: String(title).slice(0, 80) }, contents: { en: String(body).slice(0, 240) }, url: target(link, path), idempotency_key: uuidOf(email + '|' + key), ttl: 86400 };
  if (topic) payload.web_push_topic = String(topic).slice(0, 60);
  const c = new AbortController(), t = setTimeout(() => c.abort(), 10000);
  try {
    const { r } = await postAny(payload, c.signal); if (!r) return { ok: false, error: 'OneSignal key is not set' };
    let d = {}; try { d = await r.json(); } catch (e) { /* not json */ }
    const errs = Array.isArray(d.errors) ? d.errors.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join('; ') : (d.errors ? JSON.stringify(d.errors) : '');
    if (!r.ok) return { ok: false, error: ('HTTP ' + r.status + (errs ? ': ' + errs : '')).slice(0, 200) };
    if (!d.id) return { ok: false, error: (errs || 'no recipients').slice(0, 200), noRecipient: true };
    log.keys = log.keys.concat(key).slice(-1500); await kvPut(logKey(email), log);
    return { ok: true, id: d.id };
  } catch (e) { return { ok: false, error: 'network' }; } finally { clearTimeout(t); }
}
export const wasSent = async (email, key) => ((await kvGet(logKey(email))) || { keys: [] }).keys.includes(key);
