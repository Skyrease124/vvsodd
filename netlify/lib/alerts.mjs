// Owner alerts: tells the site owner (by email and/or text message) when someone signs up.
// Settings are saved by the owner on /billing/ (kv key "owner-alerts"); Twilio keys may instead come from env (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM).
// An alert can never block or break a signup: every send is time-limited and its result is only logged.
import { kvGet, kvPut, sendMail, mailConfig } from './auth.mjs';
const KEY = 'owner-alerts', LOG = 'owner-alerts-log', DEFAULT_EMAIL = 'skyariasa@gmail.com';
const TWILIO = process.env.TWILIO_API_URL || 'https://api.twilio.com/2010-04-01/Accounts/';

export const normPhone = s => { const d = String(s || '').replace(/[^\d+]/g, ''); if (/^\+[1-9]\d{9,14}$/.test(d)) return d; if (/^1?\d{10}$/.test(d.replace(/^\+/, ''))) { const t = d.replace(/^\+/, ''); return '+' + (t.length === 10 ? '1' + t : t); } return ''; };
export async function getSettings() {
  const s = (await kvGet(KEY)) || {};
  const sid = process.env.TWILIO_ACCOUNT_SID || s.sid || '', token = process.env.TWILIO_AUTH_TOKEN || s.token || '', from = process.env.TWILIO_FROM || s.from || '';
  return { emailOn: s.emailOn !== false, email: s.email || DEFAULT_EMAIL, smsOn: !!s.smsOn, phone: s.phone || '', sid, token, from, twilioSource: process.env.TWILIO_ACCOUNT_SID ? 'env' : 'saved', saved: s };
}
export async function saveSettings(patch) { const old = (await kvGet(KEY)) || {}; await kvPut(KEY, Object.assign({}, old, patch)); }
export const getLog = async () => ((await kvGet(LOG)) || { list: [] }).list;
async function logIt(entry) { const l = (await kvGet(LOG)) || { list: [] }; l.list.unshift(entry); l.list = l.list.slice(0, 20); await kvPut(LOG, l); }

export async function sendSms(cfg, body) {
  if (!cfg.sid || !cfg.token || !cfg.from || !cfg.phone) return { ok: false, error: 'not configured' };
  const c = new AbortController(), t = setTimeout(() => c.abort(), 6000);
  try {
    const r = await fetch(TWILIO + encodeURIComponent(cfg.sid) + '/Messages.json', { method: 'POST', signal: c.signal,
      headers: { Authorization: 'Basic ' + Buffer.from(cfg.sid + ':' + cfg.token).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: cfg.phone, From: cfg.from, Body: String(body).slice(0, 300) }).toString() });
    if (r.ok) return { ok: true };
    let msg = ''; try { msg = (await r.json()).message || ''; } catch (e) {}
    return { ok: false, error: (msg || 'HTTP ' + r.status).slice(0, 160) };
  } catch (e) { return { ok: false, error: 'network' }; } finally { clearTimeout(t); }
}
async function sendEmailAlert(cfg, subject, text) {
  if (!(await mailConfig())) return { ok: false, error: 'email sending is not set up yet (add the Resend key on this page)' };
  const r = await Promise.race([sendMail(cfg.email, subject, text), new Promise(res => setTimeout(() => res({ ok: false, error: 'timeout' }), 6000))]); return r;
}
// Sends the alert on every channel the owner turned on. Always resolves; never throws.
export async function notifyOwner(subject, text, sms, kind) {
  try {
    const cfg = await getSettings(), out = { at: new Date().toISOString(), kind: kind || 'alert', subject };
    const jobs = [];
    if (cfg.emailOn && cfg.email) jobs.push(sendEmailAlert(cfg, subject, text).then(r => { out.email = r.ok ? 'sent' : 'failed: ' + r.error; }));
    if (cfg.smsOn) jobs.push(sendSms(cfg, sms || subject).then(r => { out.sms = r.ok ? 'sent' : 'failed: ' + r.error; }));
    await Promise.all(jobs); if (jobs.length) await logIt(out); return out;
  } catch (e) { return { ok: false }; }
}
export function notifySignup(user, how) {
  if (!user || user.owner) return Promise.resolve(null);
  const when = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' }) + ' ET';
  return notifyOwner('New signup on PricePocketAsset: ' + user.email,
    'Someone just signed up on PricePocketAsset.\n\nEmail: ' + user.email + '\nWhen: ' + when + (how ? '\nHow: ' + how : '') + '\n\nSee all members: https://pricepocketasset.com/usage/', 'PricePocketAsset: new signup ' + user.email + (how ? ' (' + how + ')' : ''), 'signup');
}
