// Member accounts: sign up, sign in, sign out, saved liens.
import * as auth from '../lib/auth.mjs';

const tries = new Map();
const json = (code, body, cookie) => ({ statusCode: code, cookie, body: JSON.stringify(body) });
const pub = u => ({ email: u.email, owner: !!u.owner, saved: u.saved || [] });

async function handle(event) {
  const me = await auth.userFromCookie(event.headers.cookie);
  if (event.httpMethod === 'GET') return json(200, { user: me ? pub(me) : null });
  if (event.httpMethod !== 'POST') return json(405, { error: 'Use POST.' });
  let b; try { b = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Bad request.' }); }
  const act = String(b.action || '');

  if (act === 'logout') return json(200, { ok: true }, auth.clearCookie());

  if (act === 'save' || act === 'unsave') {
    if (!me) return json(401, { error: 'Please sign in first.' });
    const parcel = String(b.parcel || '').slice(0, 40);
    if (!/^[0-9A-Za-z-]{6,40}$/.test(parcel)) return json(400, { error: 'Bad parcel.' });
    me.saved = (me.saved || []).filter(x => x.parcel !== parcel);
    if (act === 'save') {
      if (me.saved.length >= 100) return json(400, { error: 'You can save up to 100 liens.' });
      const n = (v, max) => (typeof v === 'number' && isFinite(v) ? v : null);
      me.saved.unshift({ parcel, county: String(b.county || '').slice(0, 40), use: String(b.use || '').slice(0, 60), face: n(b.face), market: n(b.market), acres: n(b.acres), savedAt: new Date().toISOString() });
    }
    await auth.saveUser(me);
    return json(200, { saved: me.saved });
  }

  if (act !== 'login' && act !== 'signup') return json(400, { error: 'Bad request.' });
  const ip = ((event.headers || {})['x-nf-client-connection-ip'] || (event.headers || {})['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  const now = Date.now(), recent = (tries.get(ip) || []).filter(t => now - t < 600000);
  if (recent.length >= 8) return json(429, { error: 'Too many tries. Please wait 10 minutes.' });
  recent.push(now); tries.set(ip, recent);

  const email = auth.normEmail(b.email), pw = String(b.password || '');
  if (!auth.validEmail(email)) return json(400, { error: 'Enter a valid email.' });
  if (act === 'signup') {
    if (pw.length < 8) return json(400, { error: 'Password must be at least 8 characters.' });
    if (pw.length > 200) return json(400, { error: 'Password is too long.' });
    const owner = !!String(b.ownerCode || '').trim() && auth.codeOk(b.ownerCode);
    if (String(b.ownerCode || '').trim() && !owner) return json(400, { error: 'That owner code is not right. Leave it empty if you are not the owner.' });
    const u = await auth.createUser(email, pw, owner);
    if (!u) return json(409, { error: 'That email already has an account. Please sign in.' });
    return json(200, { user: pub(u) }, await auth.sessionCookie(email));
  }
  const u = await auth.checkLogin(email, pw);
  if (!u) return json(401, { error: 'Wrong email or password.' });
  return json(200, { user: pub(u) }, await auth.sessionCookie(email));
}

async function toEvent(req, context) {
  return { httpMethod: req.method, body: req.method === 'POST' ? await req.text() : null,
    headers: { cookie: req.headers.get('cookie') || '', 'x-nf-client-connection-ip': req.headers.get('x-nf-client-connection-ip') || (context && context.ip) || '', 'x-forwarded-for': req.headers.get('x-forwarded-for') || '' } };
}
export default async (req, context) => {
  const r = await handle(await toEvent(req, context));
  const h = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  if (r.cookie) h.append('Set-Cookie', r.cookie);
  return new Response(r.body, { status: r.statusCode, headers: h });
};
export { handle as _handle };
