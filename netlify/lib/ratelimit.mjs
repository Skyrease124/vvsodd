// Rate limits that hold across all server instances (counts are stored, not kept in one instance's memory).
// hit(key, limit, windowMs) counts an attempt and says whether it is allowed. Within one instance writes are serialized;
// across instances the exposure is one small read-and-write, not an unlimited bypass.
import crypto from 'node:crypto';
import { kvGet, kvPut } from './auth.mjs';
let chain = Promise.resolve();
const serial = fn => { const run = chain.then(fn, fn); chain = run.catch(() => {}); return run; };
export const h = s => crypto.createHash('sha256').update(String(s).toLowerCase()).digest('hex').slice(0, 20);
const key = k => 'rl_' + h(k);
// Counts an attempt. Returns { ok, retryAfterSec }.
export function hit(k, limit, windowMs) {
  return serial(async () => {
    const now = Date.now(), kk = key(k); let r = (await kvGet(kk)) || { t: [] };
    r.t = (r.t || []).filter(x => now - x < windowMs);
    if (r.t.length >= limit) return { ok: false, retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - r.t[0])) / 1000)) };
    r.t.push(now); await kvPut(kk, r); return { ok: true, retryAfterSec: 0 };
  });
}
// Looks without counting.
export function peek(k, limit, windowMs) {
  return serial(async () => { const now = Date.now(), r = (await kvGet(key(k))) || { t: [] }; const t = (r.t || []).filter(x => now - x < windowMs); return t.length >= limit ? { ok: false, retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - t[0])) / 1000)) } : { ok: true, retryAfterSec: 0 }; });
}
export function clear(k) { return serial(async () => { await kvPut(key(k), { t: [] }); }); }
