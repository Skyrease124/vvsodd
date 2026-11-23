// Retail Alerts API. Reading the catalog needs sign-in; watching, price alerts and requests are for paid members (server-enforced).
// Owner-only actions are checked here, never in the page.
//   GET  ?feed=1 | ?mine=1 | ?prefs=1 | ?inbox=1 | owner: ?admin=1 | ?lookup=<url>
//   POST watch|unwatch|prefs|read|request | owner: create|update|broadcast|decide|test
import * as auth from '../lib/auth.mjs';
import * as C from '../lib/community.mjs';
import * as R from '../lib/retail.mjs';
import * as RL from '../lib/ratelimit.mjs';

const json = (code, body) => new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
const done = r => json(r.ok === false ? (r.status || 400) : 200, r.ok === false ? { ok: false, error: r.error, id: r.id } : r);

export default async function handler(req, context) {
  const user = await auth.userFromCookie(req.headers.get('cookie'));
  if (!user) return json(401, { ok: false, error: 'Sign in to use Retail Alerts.', signin: true });
  if (!(await RL.hit('retail:' + user.email, req.method === 'POST' ? 60 : 240, 60e3)).ok) return json(429, { ok: false, error: 'Too many requests. Please slow down.' });
  const me = await C.ensureProfile(user), paid = auth.isPaid(user), owner = !!user.owner, q = new URL(req.url).searchParams;

  if (req.method === 'GET') {
    if (q.get('feed')) { const ps = (await R.listProducts()).map(R.card); return json(200, { ok: true, paid, owner, inStock: ps.filter(p => p.status === 'in_stock' || p.status === 'low_stock'), upcoming: ps.filter(p => p.status === 'upcoming').sort((a, b) => (a.releaseDate || '9') < (b.releaseDate || '9') ? -1 : 1), other: ps.filter(p => !['in_stock', 'low_stock', 'upcoming'].includes(p.status)), categories: R.CAT_LABEL, retailers: Object.fromEntries(Object.entries(R.RETAILERS).map(([k, v]) => [k, v.name])) }); }
    if (q.get('mine')) return json(200, { ok: true, paid, watches: await R.myWatches(me.uid) });
    if (q.get('prefs')) return json(200, { ok: true, prefs: await R.getPrefs(me.uid), categories: R.CAT_LABEL, retailers: Object.fromEntries(Object.entries(R.RETAILERS).map(([k, v]) => [k, v.name])) });
    if (q.get('inbox')) return json(200, Object.assign({ ok: true }, await R.inbox(me.uid)));
    if (!owner) return json(403, { ok: false, error: 'Owner only.' });
    if (q.get('admin')) return json(200, { ok: true, products: (await R.listProducts({ all: true })).map(p => Object.assign(R.card(p), { rawStatus: p.status, active: p.active, lastError: p.lastError || '', fails: p.fails || 0, priceManual: p.priceManual })), requests: await R.listRequests(), history: await R.history(30) });
    if (q.get('lookup')) return done(await R.lookup(q.get('lookup')));
    if (q.get('checkJob')) return done(await R.checkStatus(q.get('checkJob')));
    return json(400, { ok: false, error: 'Nothing asked.' });
  }
  if (req.method !== 'POST') return json(405, { ok: false });
  let b; try { b = await req.json(); } catch (e) { return json(400, { ok: false, error: 'Bad request.' }); }
  const a = String(b.action || '');
  if (a === 'prefs') return done(await R.setPrefs(me.uid, b));
  if (a === 'read') return done(await R.markRead(me.uid, b.ids === 'all' ? 'all' : [].concat(b.ids || []).map(String).slice(0, 200)));
  if (a === 'watch' || a === 'unwatch' || a === 'request') {
    if (!paid) return json(402, { ok: false, error: 'Watching products and requesting alerts is for paid members.', upgrade: true });
    if (a === 'watch') return done(await R.watch(me.uid, b.id, b));
    if (a === 'unwatch') return done(await R.unwatch(me.uid, b.id));
    if (!(await RL.hit('rreq:' + user.email, 10, 86400e3)).ok) return json(429, { ok: false, error: 'You have sent several requests today. Please try tomorrow.' });
    const r = await R.request(me.uid, b); if (r.ok) R.notifyOwner('New product alert request', r.request.name + ' · ' + R.RETAILERS[r.request.retailer].name, '/owner/retail/#requests', 'rq' + r.request.id).catch(() => {});
    return done(r);
  }
  if (!owner) return json(403, { ok: false, error: 'Owner only.' });
  if (a === 'create') return done(await R.createProduct(me.uid, b));
  if (a === 'update') return done(await R.updateProduct(b.id, b));
  if (a === 'refreshImage') return done(await R.refreshImage(b.id));
  if (a === 'checkNow') return done(await R.checkNow(b.id, { origin: new URL(req.url).origin }));
  if (a === 'broadcast') return done(await R.broadcast(b));
  if (a === 'decide') return done(await R.decide(me.uid, b.id, b));
  if (a === 'test') return done(await R.notifyOwner('Test owner alert', 'Owner notifications are working.', '/owner/retail/'));
  return json(400, { ok: false, error: 'Unknown action.' });
}
