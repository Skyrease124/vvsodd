// Push notification settings for the signed-in member + a test notification. Pro only (all new features are paid).
// The OneSignal REST key never leaves the server. The browser gets only the public App ID and the member's opaque external id.
import * as auth from '../lib/auth.mjs';
import * as OS from '../lib/onesignal.mjs';
import * as RL from '../lib/ratelimit.mjs';
import { prefsOf, run } from '../lib/pushjobs.mjs';
const json = (code, body) => new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const CATS = ['newProps', 'auctions', 'watchlist', 'portfolio'];
const view = u => { const p = prefsOf(u); return { enabled: p.enabled, subscribed: p.subscribed, newProps: p.newProps, auctions: p.auctions, watchlist: p.watchlist, portfolio: p.portfolio }; };

export default async (req) => {
  const me = await auth.userFromCookie(req.headers.get('cookie') || '');
  if (!me) return json(401, { error: 'Sign in to manage notifications.' });
  const paid = auth.isPaid(me);
  if (req.method === 'GET') return json(200, { appId: OS.APP_ID, configured: await OS.configured(), paid, pushId: paid ? OS.externalId(me.email) : null, prefs: view(me) });
  if (req.method !== 'POST') return json(405, { error: 'Use GET or POST.' });
  let b; try { b = JSON.parse(await req.text() || '{}'); } catch (e) { return json(400, { error: 'Bad request.' }); }
  if (b.action === 'run') {
    if (!me.owner) return json(403, { error: 'Owner only.' });
    return json(200, { report: await run({ only: b.only ? String(b.only) : undefined, dry: !!b.dry }) });
  }
  if (!paid) return json(402, { error: 'Notifications are for Pro members.', needPaid: true });
  me.push = Object.assign({}, prefsOf(me), me.push || {});
  if (b.action === 'enable') {
    const on = !!b.enabled; me.push.enabled = on; me.push.subscribed = on && !!b.subscribed;
    if (on && !me.pushSince) me.pushSince = new Date().toISOString().slice(0, 10); // only changes after opting in are pushed, never old backlog
    await auth.saveUser(me); return json(200, { prefs: view(me), pushId: OS.externalId(me.email) });
  }
  if (b.action === 'prefs') {
    for (const k of CATS) if (typeof (b.prefs || {})[k] === 'boolean') me.push[k] = b.prefs[k];
    await auth.saveUser(me); return json(200, { prefs: view(me) });
  }
  if (b.action === 'test') {
    if (!me.push.enabled || !me.push.subscribed) return json(409, { error: 'Turn on notifications on this device first.' });
    if (!(await OS.configured())) return json(503, { error: 'Notifications are not switched on for the site yet.', notConfigured: true });
    if (!(await RL.hit('pushtest:' + me.email, 3, 3600e3)).ok) return json(429, { error: 'Test limit reached. Try again in an hour.' });
    const r = await OS.send({ email: me.email, title: 'PricePocketAsset test', body: 'Notifications are working on this device. Nothing to act on.', path: '/account/', key: 'test:' + Date.now(), topic: 'test' });
    if (!r.ok) return json(502, { error: r.noRecipient ? 'No subscribed device found for your account. Tap Enable on this device, then try again.' : 'Could not send: ' + r.error, noRecipient: !!r.noRecipient });
    return json(200, { ok: true });
  }
  return json(400, { error: 'Unknown action.' });
};
