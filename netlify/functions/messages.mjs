// Private messages API. Signed-in members only; every permission check lives in lib/messages.mjs.
//   GET  ?list=inbox|requests | ?c=<cid>[&since=<id>] | ?to=<username> | ?unread=1
//   POST send | decide | hide | report | block | owner: ownerRemove
import * as auth from '../lib/auth.mjs';
import * as C from '../lib/community.mjs';
import * as M from '../lib/messages.mjs';
import * as RL from '../lib/ratelimit.mjs';

const json = (code, body) => new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
const done = r => json(r.ok === false ? (r.status || 400) : 200, r.ok === false ? { ok: false, error: r.error } : r);

export default async function handler(req) {
  const user = await auth.userFromCookie(req.headers.get('cookie'));
  if (!user) return json(401, { ok: false, error: 'Sign in to use messages.', signin: true });
  if (user.revoked) return json(403, { ok: false, error: 'This account cannot send messages.' });
  const me = await C.ensureProfile(user), q = new URL(req.url).searchParams;
  if (req.method === 'GET') {
    if (!(await RL.hit('msgr:' + user.email, 300, 60e3)).ok) return json(429, { ok: false, error: 'Too many requests. Please slow down.' });
    if (q.get('unread')) return json(200, Object.assign({ ok: true }, await M.unread(me)));
    if (q.get('list')) return json(200, { ok: true, rows: await M.list(me, q.get('list') === 'requests' ? 'requests' : 'inbox'), counts: await M.unread(me) });
    if (q.get('c')) return done(await M.read(me, q.get('c'), { since: q.get('since') || '' }));
    if (q.get('to')) return done(await M.open(me, q.get('to')));
    return json(400, { ok: false, error: 'Nothing asked.' });
  }
  if (req.method !== 'POST') return json(405, { ok: false });
  let b; try { b = await req.json(); } catch (e) { return json(400, { ok: false, error: 'Bad request.' }); }
  const a = String(b.action || '');
  if (a === 'send') {
    const burst = await RL.hit('msgs:' + user.email, +(process.env.MSG_PER_MIN || 30), 60e3), day = await RL.hit('msgd:' + user.email, +(process.env.MSG_PER_DAY || 1000), 86400e3);
    if (!burst.ok || !day.ok) return json(429, { ok: false, error: 'You are sending messages very quickly. Please wait a moment.' });
    return done(await M.send(me, user, b));
  }
  if (!(await RL.hit('msga:' + user.email, 60, 60e3)).ok) return json(429, { ok: false, error: 'Too many requests. Please slow down.' });
  if (a === 'decide') return done(await M.decide(me, b.cid, b.decision));
  if (a === 'hide') return done(await M.hide(me, b.cid));
  if (a === 'report') { if (!(await RL.hit('report:' + user.email, 10, 3600e3)).ok) return json(429, { ok: false, error: 'You have sent several reports. Please wait before sending more.' }); return done(await M.report(me, b.cid, b)); }
  if (a === 'block') { const r = await M.read(me, b.cid); if (!r.ok) return done(r); return done(await C.block(me, r.other.uid)); }
  if (a === 'ownerRemove') { if (!user.owner) return json(403, { ok: false, error: 'Owner only.' }); return done(await M.ownerRemove(me.uid, b.cid, b.messageId)); }
  return json(400, { ok: false, error: 'Unknown action.' });
}
