// The bell: one list of what happened (follows, likes, comments, retail alerts) plus unread message counts.
import * as auth from '../lib/auth.mjs';
import * as C from '../lib/community.mjs';
import * as N from '../lib/notify.mjs';
import * as M from '../lib/messages.mjs';
import * as R from '../lib/retail.mjs';
const json = (code, body) => new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export default async function handler(req) {
  const user = await auth.userFromCookie(req.headers.get('cookie')); if (!user) return json(401, { ok: false, signin: true });
  const me = await C.ensureProfile(user), q = new URL(req.url).searchParams;
  if (req.method === 'POST') { await N.markRead(me.uid); const ib = await R.inbox(me.uid); await R.markRead(me.uid, 'all'); return json(200, { ok: true, cleared: ib.unread }); }
  const msgs = await M.unread(me), retail = await R.inbox(me.uid), social = await N.list(me.uid);
  const socialUnread = social.filter(x => !x.read).length;
  const count = msgs.unread + msgs.requests + retail.unread + socialUnread;
  if (q.get('count')) return json(200, { ok: true, count, messages: msgs.unread + msgs.requests });
  const people = {}; for (const it of social.slice(0, 60)) for (const a of (it.actors || [it.actor]).slice(0, 3)) if (!people[a]) { const p = await C.getByUid(a); people[a] = p && await C.isVisible(p) ? await C.miniView(p, me.uid) : null; }
  const items = social.slice(0, 60).map(it => { const as = (it.actors || [it.actor]).map(a => people[a]).filter(Boolean); if (!as.length) return null; const extra = (it.actors || []).length - 1; return { id: it.id, kind: it.kind, at: it.at, read: it.read, path: it.path, actor: as[0], text: as[0].name + (extra > 0 ? ' and ' + extra + (extra === 1 ? ' other ' : ' others ') : ' ') + it.text }; }).filter(Boolean)
    .concat(retail.items.slice(0, 30).map(a => ({ id: 'r' + a.id, kind: 'retail', at: a.at, read: a.read, path: '/retail/?tab=alerts', text: a.title + ' · ' + a.body })))
    .sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 80);
  return json(200, { ok: true, count, messages: msgs, items });
}
