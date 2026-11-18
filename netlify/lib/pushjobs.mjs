// Push jobs: which members get which notification. Runs daily (push-run.mjs) and can be run for one member.
// Rules: paid + opted in + subscribed only; each category respects the member's preference; every notification has a stable key so
// it is never sent twice; wording only says what an OFFICIAL record says (a list was imported, a page lists a sale date, a deadline
// the member typed), never that a property is available. Sale dates must come from an official page, in the next 7 days.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as auth from './auth.mjs';
import * as OS from './onesignal.mjs';
import * as W from './watch.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), DAY = 864e5;
export const DEFAULT_PUSH = { enabled: false, subscribed: false, newProps: true, auctions: true, watchlist: true, portfolio: true };
export const prefsOf = u => Object.assign({}, DEFAULT_PUSH, (u && u.push) || {});
function readStates(name) {
  const root = process.env.LAMBDA_TASK_ROOT || process.cwd();
  for (const d of [path.join(root, 'kinvest-liens/liens/states'), path.join(HERE, '../../kinvest-liens/liens/states'), path.join(process.cwd(), 'kinvest-liens/liens/states')]) { try { return JSON.parse(fs.readFileSync(path.join(d, name), 'utf8')); } catch (e) { /* next */ } }
  return null;
}
const day = ms => new Date(ms).toISOString().slice(0, 10);
const parse = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null; };
const nice = iso => { const d = new Date(parse(iso)); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }); };
const TYPE = { taxdeed: 'tax deed', otc: 'over-the-counter', lien: 'tax lien', foreclosure: 'foreclosure', sheriff: 'sheriff' };
const hid = a => crypto.createHash('sha256').update(a.join('|')).digest('hex').slice(0, 16);

export async function interestStates(u, watchDoc) {
  const s = new Set();
  for (const h of u.portfolio || []) if (h.state) s.add(h.state);
  for (const w of (watchDoc && watchDoc.watch) || []) { const st = String(w.key || '').split('|')[0]; if (/^[A-Z]{2}$/.test(st)) s.add(st); }
  return s;
}

// Returns the notifications to send for one member (pure: no sending). now = 'YYYY-MM-DD'.
export function plan(u, ctx) {
  const p = prefsOf(u), out = [], now = parse(ctx.now);
  if (p.auctions && ctx.sales) {
    const hits = ctx.sales.filter(e => ctx.states.has(e.state) && e.status === 'scheduled' && e.officialPage && !e.newDate && parse(e.saleDate) >= now && parse(e.saleDate) - now <= 7 * DAY);
    for (const e of hits.slice(0, 3)) out.push({ cat: 'auctions', key: 'auction:' + e.saleId + ':' + e.saleDate, title: 'Upcoming sale: ' + e.county + ' County, ' + e.state, body: 'An official county page lists a ' + (TYPE[e.type] || e.type) + ' sale for ' + nice(e.saleDate) + (e.saleTime ? ' at ' + e.saleTime + ' ' + (e.tz || '') : '') + '. Dates can change: confirm with the county.', path: '/liens/states/state/?s=' + e.state, topic: 'auction-' + e.saleId });
  }
  if (p.newProps && ctx.changes) {
    const hits = ctx.changes.filter(c => c.type === 'new_list' && c.official && ctx.states.has(c.state) && c.detectedAt && now - parse(c.detectedAt) <= 7 * DAY && parse(c.detectedAt) <= now);
    if (hits.length) { const ids = hits.map(c => c.id).sort(); out.push({ cat: 'newProps', key: 'new:' + hid(ids), title: hits.length === 1 ? 'New official list: ' + hits[0].county + ' County, ' + hits[0].state : hits.length + ' new official lists imported', body: (hits.length === 1 ? hits[0].text + '. ' : hits.slice(0, 3).map(c => c.county + ' (' + c.state + ')').join(', ') + (hits.length > 3 ? ' and more. ' : '. ')) + 'Lists change: confirm with the county before relying on any listing.', path: hits.length === 1 ? hits[0].link || '/liens/' : '/liens/', topic: 'newlists' }); }
  }
  if (p.watchlist && ctx.watchTodo && ctx.watchTodo.length) {
    const t = ctx.watchTodo, ids = t.map(e => e.id).sort();
    out.push({ cat: 'watchlist', key: 'watch:' + hid(ids), ids, title: t.length === 1 ? 'Update on a parcel you watch' : t.length + ' updates on parcels you watch', body: (t.length === 1 ? t[0].county + ' County, parcel ' + t[0].parcel + ': ' + t[0].text : t.slice(0, 2).map(e => e.county + ' ' + e.parcel).join('; ') + (t.length > 2 ? ' and more' : '')) + '. Official records can change: confirm with the county.', path: '/account/watchlist/', topic: 'watchlist' });
  }
  if (p.portfolio) {
    const due = [];
    for (const h of u.portfolio || []) {
      if ((h.status || 'open') !== 'open' || !h.countyDeadline) continue; const d = parse(h.countyDeadline); if (d == null) continue;
      const left = Math.round((d - now) / DAY); const b = left === 1 ? 1 : (left >= 0 && left <= 7 ? 7 : null); if (b == null) continue;
      due.push({ h, left, b });
    }
    if (due.length) out.push({ cat: 'portfolio', key: 'pf:' + hid(due.map(x => x.h.id + ':' + x.h.countyDeadline + ':' + x.b).sort()), title: 'Portfolio reminder', body: (due.length === 1 ? 'The county deadline you saved for ' + (due[0].h.county || due[0].h.state) + (due[0].h.parcel ? ' parcel ' + due[0].h.parcel : '') + ' is ' + nice(due[0].h.countyDeadline) + '.' : due.length + ' of your saved county deadlines are within 7 days.') + ' This is the date you entered: confirm it with the county.', path: '/portfolio/', topic: 'portfolio' });
  }
  return out;
}

export async function run({ only, dry, now } = {}) {
  const rep = { members: 0, eligible: 0, sent: 0, duplicates: 0, failed: 0, noRecipient: 0, errors: [] };
  const today = now || day(Date.now()), sales = (readStates('upcoming-sales.json') || {}).events || [], changes = (readStates('radar.json') || {}).changes || [], dec = await W.decisions();
  for (const k of await auth.kvList('u_')) {
    let u; try { u = await auth.kvGet(k); } catch (e) { continue; } if (!u || !u.email) continue;
    if (only && u.email !== only) continue; rep.members++;
    const p = prefsOf(u); if (!p.enabled || !p.subscribed || !auth.isPaid(u) || u.revoked) continue; rep.eligible++;
    let wdoc = null; try { wdoc = await auth.kvGet(W.watchKey(u.email)); } catch (e) { /* none */ }
    const states = await interestStates(u, wdoc);
    let watchTodo = [];
    if (wdoc) { const w = { watch: wdoc.watch || [], prefs: Object.assign({}, W.DEFAULT_PREFS, wdoc.prefs || {}, { types: Object.assign({}, W.DEFAULT_PREFS.types, (wdoc.prefs || {}).types || {}) }), seen: wdoc.seen || [] }; const pushed = new Set(wdoc.pushed || []); const since = String((wdoc.prefs && wdoc.prefs.pushSince) || u.pushSince || '').slice(0, 10); watchTodo = W.feed(w, dec).filter(e => !pushed.has(e.id) && (!since || e.detectedAt >= since)); }
    for (const n of plan(u, { now: today, sales, changes, states, watchTodo })) {
      const r = await OS.send({ email: u.email, title: n.title, body: n.body, path: n.path, key: n.key, topic: n.topic, dry });
      if (r.skipped) rep.duplicates++; else if (r.ok) { rep.sent++; if (n.cat === 'watchlist' && wdoc && !dry) { wdoc.pushed = (wdoc.pushed || []).concat(n.ids).slice(-2000); await auth.kvPut(W.watchKey(u.email), wdoc); } }
      else if (r.noRecipient) rep.noRecipient++; else { rep.failed++; if (rep.errors.length < 5) rep.errors.push(r.error); }
    }
  }
  return rep;
}
