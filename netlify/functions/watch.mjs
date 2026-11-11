// Watchlist, notifications, alert preferences, private Bid or Pass worksheets, and the admin review tools.
// Everything here is per signed-in member: the member id comes from the session cookie, never from the request.
import * as auth from '../lib/auth.mjs';
import * as W from '../lib/watch.mjs';

const json = (code, body) => new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const MAX_WATCH = 200, MAX_SHEETS = 150;
const hits = new Map();
function limited(k, n, ms) { const now = Date.now(), r = (hits.get(k) || []).filter(t => now - t < ms); if (r.length >= n) return true; r.push(now); hits.set(k, r); return false; }
const num = v => (v === '' || v == null || !isFinite(Number(v))) ? null : Math.round(Number(v) * 100) / 100;

function cleanSheet(b) {
  const est = {}; Object.entries(b.est || {}).slice(0, 30).forEach(([k, v]) => { if (/^[a-zA-Z0-9_]{1,30}$/.test(k)) est[k] = num(v); });
  const checks = {}; Object.entries(b.checks || {}).slice(0, 30).forEach(([k, v]) => { if (/^[a-zA-Z0-9_]{1,30}$/.test(k) && v) checks[k] = { done: !!v.done, note: W.cleanStr(v.note, 300) }; });
  const sn = b.snap || {}; const snap = { amount: num(sn.amount), payoff: num(sn.payoff), saleDate: W.cleanStr(sn.saleDate, 40), status: W.cleanStr(sn.status, 120), at: W.cleanStr(sn.at, 10) };
  const dec = ['Bid', 'Pass', 'Needs Research'].includes(b.decision) ? b.decision : '';
  return { decision: dec, maxBid: num(b.maxBid), budget: num(b.budget), notes: W.cleanStr(b.notes, 2000).length ? String(b.notes).replace(/[\u0000-\u0009\u000b-\u001f]/g, ' ').slice(0, 2000) : '', est, checks, snap,
    months: num(b.months), rateUser: num(b.rateUser), updated: new Date().toISOString() };
}

export default async function handler(req, context) {
  const u = new URL(req.url), q = u.searchParams;
  const ip = req.headers.get('x-nf-client-connection-ip') || (context && context.ip) || 'x';
  if (limited('w' + ip, 240, 60000)) return json(429, { error: 'Too many requests. Wait a minute.' });
  const act = req.method === 'GET' ? q.get('action') || 'me' : null;
  let b = {};
  if (req.method === 'POST') { try { b = await req.json(); } catch (e) { return json(400, { error: 'Bad request.' }); } }
  const action = act || String(b.action || '');

  // Public: which review items an admin has decided (ids only), so the timeline can hide events still waiting for review.
  if (action === 'reviewed') { const d = await W.decisions(); const o = {}; Object.entries(d).forEach(([k, v]) => { o[k] = v.decision; }); return json(200, { decided: o }); }

  const me = await auth.userFromCookie(req.headers.get('cookie') || '');
  if (!me) return json(401, { error: 'Sign in to use your watchlist and worksheets.' });
  const email = me.email;

  // ---- admin (site owner only)
  if (action === 'admin' || action === 'review' || action === 'digest') {
    if (!auth.markOwner(me).owner) return json(403, { error: 'Owner only.' });
    if (action === 'digest') return json(200, { ok: true, report: await W.runDigest(b.email || undefined) });
    if (action === 'review') {
      const id = W.cleanStr(b.id, 40), decision = b.decision === 'approve' ? 'approve' : b.decision === 'reject' ? 'reject' : '';
      if (!id || !decision) return json(400, { error: 'Missing id or decision.' });
      const d = await W.decisions(); d[id] = { decision, by: email, at: new Date().toISOString() }; await auth.kvPut('watch-review', d); return json(200, { ok: true });
    }
    const imports = (W.readTL('imports.json') || { imports: [] }).imports, review = (W.readTL('review.json') || { items: [] }).items, dec = await W.decisions();
    return json(200, { imports: imports.slice().reverse(), review: review.map(r => Object.assign({}, r, { decision: dec[r.id] ? dec[r.id].decision : '' })), counties: W.countyIndex() });
  }

  // ---- watchlist
  if (['me', 'feed'].includes(action)) {
    const w = await W.loadWatch(email), dec = await W.decisions(), f = W.feed(w, dec);
    return json(200, { watch: W.watchedView(w, dec), prefs: w.prefs, notifications: f.slice(0, 200), unread: f.filter(x => !x.read).length, mailReady: !!(await auth.mailConfig()), counties: W.countyIndex() });
  }
  if (action === 'status') { // is this parcel watched? (used by the Watch button)
    const w = await W.loadWatch(email); const k = W.cleanStr(q.get('key'), 160); return json(200, { watching: w.watch.some(x => x.key === k) });
  }
  if (action === 'watching') { const w = await W.loadWatch(email); return json(200, { keys: w.watch.map(x => x.key) }); }
  if (action === 'watch' || action === 'unwatch') {
    const key = W.cleanStr(b.key, 160); if (!W.KEY_RE.test(key)) return json(400, { error: 'That parcel could not be identified.' });
    const w = await W.loadWatch(email); w.watch = w.watch.filter(x => x.key !== key);
    if (action === 'watch') {
      if (w.watch.length >= MAX_WATCH) return json(400, { error: 'You can watch up to ' + MAX_WATCH + ' parcels.' });
      const p = W.parseKey(key); const today = new Date().toISOString().slice(0, 10);
      w.watch.unshift({ key, state: p.state, county: p.county, parcel: p.parcel, cert: p.cert, label: W.cleanStr(b.label, 120), addedAt: new Date().toISOString(),
        baseline: { amount: num(b.amount), payoff: num(b.payoff), saleDate: W.cleanStr(b.saleDate, 40), status: W.cleanStr(b.status, 120), at: today } });
    }
    await W.saveWatch(email, w); return json(200, { ok: true, watching: action === 'watch', count: w.watch.length });
  }
  if (action === 'prefs') {
    const w = await W.loadWatch(email), t = b.types || {}, was = w.prefs.email;
    Object.keys(W.DEFAULT_PREFS.types).forEach(k => { if (k in t) w.prefs.types[k] = !!t[k]; });
    if ('inApp' in b) w.prefs.inApp = !!b.inApp;
    if ('email' in b) { w.prefs.email = !!b.email; if (w.prefs.email && !was) w.prefs.emailSince = new Date().toISOString().slice(0, 10); }
    await W.saveWatch(email, w); return json(200, { ok: true, prefs: w.prefs });
  }
  if (action === 'seen') {
    const w = await W.loadWatch(email), dec = await W.decisions(); const ids = Array.isArray(b.ids) ? b.ids.map(x => W.cleanStr(x, 40)) : W.feed(w, dec).map(x => x.id);
    w.seen = Array.from(new Set(w.seen.concat(ids))).slice(-3000); await W.saveWatch(email, w); return json(200, { ok: true });
  }

  // ---- worksheets: stored under the member's own key only
  const wk = W.wsKey(email);
  if (action === 'wsList') { const d = (await auth.kvGet(wk)) || { sheets: {} }; return json(200, { sheets: Object.entries(d.sheets).map(([key, s]) => ({ key, decision: s.decision, maxBid: s.maxBid, updated: s.updated })) }); }
  if (action === 'wsGet') { const d = (await auth.kvGet(wk)) || { sheets: {} }; const k = W.cleanStr(q.get('key'), 160); return json(200, { sheet: d.sheets[k] || null }); }
  if (action === 'wsSave' || action === 'wsDelete') {
    const key = W.cleanStr(b.key, 160); if (!W.KEY_RE.test(key)) return json(400, { error: 'That parcel could not be identified.' });
    const d = (await auth.kvGet(wk)) || { sheets: {} };
    if (action === 'wsDelete') { delete d.sheets[key]; await auth.kvPut(wk, d); return json(200, { ok: true }); }
    if (!d.sheets[key] && Object.keys(d.sheets).length >= MAX_SHEETS) return json(400, { error: 'You can keep up to ' + MAX_SHEETS + ' worksheets.' });
    const s = cleanSheet(b.sheet || {}); if (JSON.stringify(s).length > 9000) return json(400, { error: 'That worksheet is too large.' });
    d.sheets[key] = s; await auth.kvPut(wk, d); return json(200, { ok: true, sheet: s });
  }
  return json(400, { error: 'Unknown action.' });
}
