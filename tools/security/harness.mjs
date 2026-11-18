// Security test harness: loads every Netlify function in-process with a throwaway user store (USERS_DIR) and six kinds of accounts.
// No real keys, no real accounts, no network except what a function itself would call (blocked here).
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
const D = fs.mkdtempSync(path.join(os.tmpdir(), 'ppa-sec-')); process.env.USERS_DIR = D;
process.env.SESSION_SECRET = 'test-secret-not-real'; process.env.SITE_URL = 'https://test.invalid';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const auth = await import(ROOT + '/netlify/lib/auth.mjs');
const FN = {}; for (const f of fs.readdirSync(ROOT + '/netlify/functions').filter(f => f.endsWith('.mjs'))) { try { FN[f.replace('.mjs', '')] = await import(ROOT + '/netlify/functions/' + f); } catch (e) { FN[f.replace('.mjs', '')] = { _err: e.message }; } }
const iso = d => d.toISOString().slice(0, 10), day = n => iso(new Date(Date.now() + n * 864e5));
const mk = async (email, patch) => { const u = await auth.createUser(email, 'pass word 1234', false); Object.assign(u, patch || {}); await auth.saveUser(u); return (await auth.sessionCookie(email)).split(';')[0]; };
export const ID = {
  anon: '',
  free: await mk('free@test.invalid'),
  pro: await mk('pro@test.invalid', { paidThrough: day(20), sub: { status: 'active', cancelAtPeriodEnd: false } }),
  canceledActive: await mk('cancel-active@test.invalid', { paidThrough: day(5), sub: { status: 'canceled', cancelAtPeriodEnd: true } }),   // canceled, paid period not over yet
  expired: await mk('expired@test.invalid', { paidThrough: day(-1), sub: { status: 'canceled' } }),
  owner: await mk('owner@test.invalid', { owner: true }),
  other: await mk('other@test.invalid', { paidThrough: day(20) }),
  revoked: await mk('revoked@test.invalid', { paidThrough: day(20), revoked: true })
};
export async function call(fn, { method = 'GET', q = '', body, cookie = '', headers = {}, ip = '9.9.9.9' } = {}) {
  const m = FN[fn]; if (!m || !m.default) return { status: 'NOFN', fn };
  const h = Object.assign({}, headers); if (cookie) h.cookie = cookie; h['x-nf-client-connection-ip'] = h['x-nf-client-connection-ip'] || ip;
  const req = new Request('http://x/.netlify/functions/' + fn + (q ? '?' + q : ''), { method, headers: h, body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body || {})) : undefined });
  try { const r = await m.default(req, { ip }); let t = ''; try { t = await r.text(); } catch (e) {} return { status: r.status, text: t, headers: r.headers }; } catch (e) { return { status: 'THROW', err: e.message }; }
}
export { auth, FN, D, ROOT, day };
