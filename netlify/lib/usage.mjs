// Simple usage counters the owner can see on /usage/. Stored server-side (Netlify Blobs). Best effort: a few requests
// at the exact same moment can be undercounted. This counts requests to our site, not NVIDIA's own billing.
import crypto from 'node:crypto';
import { kvGet, kvPut } from './auth.mjs';

const day = (d = new Date()) => d.toISOString().slice(0, 10);
const DEFAULT_LIMIT = parseInt(process.env.ASK_DAILY_LIMIT || '300', 10);

export async function getLimit() {
  const v = await kvGet('limits');
  return v && Number.isFinite(v.daily) ? v.daily : DEFAULT_LIMIT;
}
export async function setLimit(n) { await kvPut('limits', { daily: n }); }
export async function today() {
  const u = await kvGet('usage-' + day());
  return u ? (u.ask || 0) + (u.screen || 0) + (u.ai || 0) : 0;
}
// Spend control. take() RESERVES a request before any AI call is made, so a burst of simultaneous requests cannot all slip
// under the daily limit (they used to be counted only after the answer came back). It also enforces a per-member daily cap.
// Writes are serialized inside one server instance; across instances the window is one small read-and-write, not a whole AI call.
const PER_USER_DAILY = parseInt(process.env.AI_PER_USER_DAILY || '120', 10);
let chain = Promise.resolve();
const serial = fn => { const run = chain.then(fn, fn); chain = run.catch(() => {}); return run; };
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 16);
// kind: 'ask' | 'screen' | 'ai'. Returns { ok: true } or { ok: false, why: 'busy' | 'user' }.
export function take(kind, email) {
  return serial(async () => {
    const k = 'usage-' + day(), u = (await kvGet(k)) || {};
    const total = (u.ask || 0) + (u.screen || 0) + (u.ai || 0);
    if (total >= (await getLimit())) return { ok: false, why: 'busy' };
    if (email) {
      const uk = 'uu-' + day() + '-' + sha(String(email).toLowerCase()), uu = (await kvGet(uk)) || { n: 0 };
      if (uu.n >= PER_USER_DAILY) return { ok: false, why: 'user' };
      uu.n++; await kvPut(uk, uu);
    }
    u[kind] = (u[kind] || 0) + 1; await kvPut(k, u);
    return { ok: true };
  });
}
// The request was already counted by take(); this only records whether the AI service failed.
export async function record(kind, ok) {
  if (ok !== false) return;
  try { await serial(async () => { const k = 'usage-' + day(), u = (await kvGet(k)) || {}; u.fail = (u.fail || 0) + 1; await kvPut(k, u); }); } catch (e) { /* never block a visitor because counting failed */ }
}
export async function history(days = 14) {
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = day(new Date(Date.now() - i * 864e5));
    const u = (await kvGet('usage-' + d)) || {};
    out.push({ date: d, ask: u.ask || 0, screen: u.screen || 0, ai: u.ai || 0, fail: u.fail || 0 });
  }
  return out;
}
