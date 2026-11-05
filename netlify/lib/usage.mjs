// Simple usage counters the owner can see on /usage/. Stored server-side (Netlify Blobs). Best effort: a few requests
// at the exact same moment can be undercounted. This counts requests to our site, not NVIDIA's own billing.
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
  return u ? (u.ask || 0) + (u.screen || 0) : 0;
}
// kind: 'ask' | 'screen'; ok: false when the AI service failed
export async function record(kind, ok) {
  try {
    const k = 'usage-' + day();
    const u = (await kvGet(k)) || {};
    u[kind] = (u[kind] || 0) + 1;
    if (ok === false) u.fail = (u.fail || 0) + 1;
    await kvPut(k, u);
  } catch (e) { /* never block a visitor because counting failed */ }
}
export async function history(days = 14) {
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = day(new Date(Date.now() - i * 864e5));
    const u = (await kvGet('usage-' + d)) || {};
    out.push({ date: d, ask: u.ask || 0, screen: u.screen || 0, fail: u.fail || 0 });
  }
  return out;
}
