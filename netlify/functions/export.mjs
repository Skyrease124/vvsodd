// Pro property export service: selection, 100-per-week allowance, confirmation preview, file building, history, saved collections.
// Everything is checked here on the server. The browser only asks; it can never raise its own limit.
import crypto from 'node:crypto';
import * as auth from '../lib/auth.mjs';
import * as RL from '../lib/ratelimit.mjs';
import * as X from '../lib/exports.mjs';
import * as EV from '../lib/evidence.mjs';
const json = (code, body) => new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const nice = d => { const t = new Date(d + 'T00:00:00Z'); return t.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' }); };
const rid = () => crypto.randomBytes(5).toString('hex');

const evCtx = req => ({ ip: (req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null, ua: req.headers.get('user-agent') || null, session: EV.sessionOf(req.headers.get('cookie') || '') });
export default async (req) => {
  const me = await auth.userFromCookie(req.headers.get('cookie') || '');
  if (!me) return json(401, { error: 'Sign in to use property downloads.', needSignIn: true });
  const paid = auth.isPaid(me), url = new URL(req.url);
  if (req.method === 'GET') {
    const job = url.searchParams.get('file');
    if (job) { if (!paid) return json(402, { error: 'Downloads are for Pro members.', needPaid: true }); const f = await X.getFile(me, job); if (!f) return json(404, { error: 'That file is no longer stored. Export the properties again (properties you already exported this week do not use more of your allowance).' }); EV.logActivity(me, 'file_download', { ...evCtx(req), file: f.name, resource: 'property export', count: 1, page: 'downloads' }).catch(() => {});
      return new Response(f.data, { status: 200, headers: { 'Content-Type': f.mime, 'Content-Disposition': 'attachment; filename="' + f.name.replace(/[^\w.\-]/g, '_') + '"', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } }); }
    if (!paid) return json(200, { paid: false, owner: false, limit: X.WEEKLY_LIMIT });
    const u = await X.usage(me), c = await X.getCollections(me);
    return json(200, { paid: true, owner: !!me.owner, limit: X.WEEKLY_LIMIT, used: u.used, remaining: u.remaining, unlimited: u.unlimited, resets: u.resets, resetsText: nice(u.resets), periodStart: u.periodStart, history: await X.history(me), sel: c.sel, lists: c.lists, formats: X.FORMATS });
  }
  if (req.method !== 'POST') return json(405, { error: 'Use GET or POST.' });
  if (!paid) return json(402, { error: 'Property downloads are for Pro members.', needPaid: true });
  let b; try { b = JSON.parse(await req.text() || '{}'); } catch (e) { return json(400, { error: 'Bad request.' }); }
  const act = String(b.action || '');
  if (!(await RL.hit('xp:' + me.email, 240, 60e3)).ok) return json(429, { error: 'Too many requests. Please wait a moment.' });
  const items = X.cleanItems(b.items, X.MAX_PER_REQUEST);

  if (act === 'info' || act === 'preview') {
    const found = [], missing = []; for (const it of items) { const x = X.lookup(it); if (x) found.push({ it, x }); else missing.push(it.i); }
    if (act === 'info') return json(200, { rows: found.slice(0, 50).map(f => X.infoOf(f.x)), missing });
    const p = await X.plan(me, found.map(f => f.it.i)); return json(200, { ...p, missing, resetsText: nice(p.resets) });
  }
  if (act === 'export') {
    if (b.confirm !== true) return json(400, { error: 'Please confirm the download first.' });
    const fmt = String(b.format || ''); if (!X.FORMATS.includes(fmt)) return json(400, { error: 'Choose CSV, Excel, PDF or ZIP.' });
    if (!items.length) return json(400, { error: 'Select at least one property first.' });
    if (!(await RL.hit('xe:' + me.email, 30, 3600e3)).ok) return json(429, { error: 'Export limit reached for this hour. Browsing and saving are not limited.' });
    const found = [], missing = []; for (const it of items) { const x = X.lookup(it); if (x) found.push({ it, x }); else missing.push(it.i); }
    if (missing.length) return json(422, { error: missing.length + ' selected ' + (missing.length === 1 ? 'property is' : 'properties are') + ' not in our records yet, so nothing was exported and nothing was used. Remove ' + (missing.length === 1 ? 'it' : 'them') + ' and try again.', missing });
    const r = await X.reserve(me, found.map(f => f.it.i), fmt);
    if (!r.ok) return json(429, { error: 'This would go over your weekly allowance. You have ' + r.remaining + ' of ' + X.WEEKLY_LIMIT + ' left. Your allowance resets on ' + nice(r.resets) + '.', limit: true, remaining: r.remaining, resets: r.resets, resetsText: nice(r.resets) });
    let f; try { f = X.build(fmt, found.map(x => x.x)); if (!f || !f.data.length) throw new Error('empty'); await X.saveFile(me, r.job, f, { fmt, n: found.length, credits: r.fresh, week: X.periodOf(me).end }); await X.complete(me, r); }
    catch (e) { await X.release(me, r); return json(500, { error: 'The file could not be made, so nothing was used from your allowance. Please try again.' }); }
    EV.logActivity(me, 'export_created', { ...evCtx(req), detail: fmt, count: found.length, resource: 'property export', page: 'exports' }).catch(() => {});
    const u = await X.usage(me); return json(200, { ok: true, job: r.job, name: f.name, bytes: f.data.length, count: found.length, credits: r.fresh, remaining: u.remaining, used: u.used, resets: u.resets, resetsText: nice(u.resets), url: '/.netlify/functions/export?file=' + r.job });
  }

  // saved selection and collections: organizing never touches the allowance
  const c = await X.getCollections(me); const find = id => c.lists.find(l => l.id === id);
  if (act === 'selSave') { c.sel = X.cleanItems(b.items, 500); await X.putCollections(me, c); return json(200, { ok: true, count: c.sel.length }); }
  if (act === 'colCreate') { const name = String(b.name || '').trim().slice(0, 60); if (!name) return json(400, { error: 'Give the list a name.' }); if (c.lists.length >= 30) return json(400, { error: 'You can keep up to 30 lists.' }); if (c.lists.some(l => l.name.toLowerCase() === name.toLowerCase())) return json(409, { error: 'You already have a list with that name.' }); const l = { id: rid(), name, items: X.cleanItems(b.items, 1000), created: new Date().toISOString().slice(0, 10) }; c.lists.push(l); await X.putCollections(me, c); return json(200, { ok: true, list: l, lists: c.lists }); }
  const l = find(String(b.id || b.from || ''));
  if (!l) return json(404, { error: 'That list was not found.' });
  if (act === 'colRename') { const name = String(b.name || '').trim().slice(0, 60); if (!name) return json(400, { error: 'Give the list a name.' }); l.name = name; }
  else if (act === 'colDelete') c.lists = c.lists.filter(x => x !== l);
  else if (act === 'colAdd') { const have = new Set(l.items.map(x => x.i)); for (const it of X.cleanItems(b.items, 1000)) if (!have.has(it.i) && l.items.length < 2000) l.items.push(it); }
  else if (act === 'colRemove') { const rm = new Set(X.cleanItems(b.items, 1000).map(x => x.i)); l.items = l.items.filter(x => !rm.has(x.i)); }
  else if (act === 'colMove') { const to = find(String(b.to || '')); if (!to || to === l) return json(404, { error: 'Choose a different list to move to.' }); const mv = new Set(X.cleanItems(b.items, 1000).map(x => x.i)), have = new Set(to.items.map(x => x.i)); for (const it of l.items) if (mv.has(it.i) && !have.has(it.i)) to.items.push(it); l.items = l.items.filter(x => !mv.has(x.i)); }
  else return json(400, { error: 'Unknown request.' });
  await X.putCollections(me, c); return json(200, { ok: true, lists: c.lists });
};
