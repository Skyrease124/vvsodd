// PricePocket Live API. Members only; every permission is decided here from the signed-in account.
//   GET  ?u=username            -> { live: {id,title,viewers,host} | null }   (profile page)
//   GET  ?s=sessionId           -> { session }                                  (room page)
//   GET  ?token=sessionId       -> { token, url, role, session, me }            (short-lived LiveKit token, identity = the member's own id)
//   POST {action:'start', title, visibility:'public'} | {action:'end', id} | {action:'remove', id, identity}
import * as auth from '../lib/auth.mjs';
import * as C from '../lib/community.mjs';
import * as L from '../lib/live.mjs';
import * as RL from '../lib/ratelimit.mjs';

const json = (code, body) => new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
const fail = r => json(r.status || 400, Object.assign({ ok: false, error: r.error }, r.setup ? { setup: true } : {}, r.ended ? { ended: true } : {}));

export default async function handler(req) {
  const user = await auth.userFromCookie(req.headers.get('cookie'));
  if (!user) return json(401, { ok: false, error: 'Sign in to use PricePocket Live.', signin: true });
  if (!(await RL.hit('live:' + user.email, req.method === 'POST' ? +(process.env.LIVE_WRITE_LIMIT || 30) : +(process.env.LIVE_READ_LIMIT || 240), 60e3)).ok) return json(429, { ok: false, error: 'Too many requests. Please slow down.' });
  const me = await C.ensureProfile(user);
  const q = new URL(req.url).searchParams;
  if (req.method === 'GET') {
    if (q.get('u')) return json(200, await L.statusByUsername(q.get('u')));
    if (q.get('s')) { const r = await L.statusById(q.get('s')); return r.ok === false ? fail(r) : json(200, r); }
    if (q.get('token')) { const r = await L.token(me, q.get('token')); return r.ok === false ? fail(r) : json(200, r); }
    return json(200, { ok: true, configured: L.configured() });
  }
  if (req.method !== 'POST') return json(405, { ok: false });
  let b; try { b = await req.json(); } catch (e) { return json(400, { ok: false, error: 'Bad request.' }); }
  const act = String(b.action || ''); let r;
  if (act === 'start') r = await L.start(me, b);
  else if (act === 'end') r = await L.end(me, b.id);
  else if (act === 'remove') r = await L.remove(me, b.id, b.identity);
  else return json(400, { ok: false, error: 'Unknown action.' });
  return r.ok === false ? fail(r) : json(200, r);
}
