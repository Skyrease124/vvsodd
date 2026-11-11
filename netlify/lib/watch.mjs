// Watch This Parcel + Bid or Pass worksheets: shared logic. Timeline files (official events, import history) are static
// JSON written by tools/imports; this code only reads them. A member's watchlist and worksheets are stored per member.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as auth from './auth.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
function dir() {
  const root = process.env.LAMBDA_TASK_ROOT || process.cwd();
  for (const d of [path.join(root, 'kinvest-liens/liens/states/timeline'), path.join(HERE, '../../kinvest-liens/liens/states/timeline'), path.join(process.cwd(), 'kinvest-liens/liens/states/timeline')]) if (fs.existsSync(d)) return d;
  return path.join(HERE, '../../kinvest-liens/liens/states/timeline');
}
export function readTL(name) { try { return JSON.parse(fs.readFileSync(path.join(dir(), name), 'utf8')); } catch (e) { return null; } }
export const countyIndex = () => (readTL('index.json') || { counties: [] }).counties.filter(c => c.enabled);

export const CATS = { amount: ['amount_changed', 'payoff_changed'], schedule: ['saleDate_changed', 'auction_rescheduled', 'auction_canceled'], result: ['result_posted'], outcome: ['redemption_confirmed', 'withdrawn_confirmed'], availability: ['status_changed', 'no_longer_listed', 'relisted', 'added_to_list'] };
export const catOf = t => Object.keys(CATS).find(k => CATS[k].includes(t)) || 'availability';
export const DEFAULT_PREFS = { inApp: true, email: false, emailSince: '', types: { amount: true, schedule: true, result: true, outcome: true, availability: true } };

const h = s => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 32);
export const watchKey = email => 'watch_' + h(email);
export const wsKey = email => 'ws_' + h(email);
export const cleanStr = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
export const KEY_RE = /^[A-Z]{2}\|[^|]{1,40}\|[^|]{1,60}\|[^|]{0,40}$/;
export function parseKey(k) { const [state, county, parcel, cert] = String(k).split('|'); return { state, county, parcel, cert: cert || '' }; }

export async function loadWatch(email) {
  const d = (await auth.kvGet(watchKey(email))) || {};
  return { watch: d.watch || [], prefs: Object.assign({}, DEFAULT_PREFS, d.prefs || {}, { types: Object.assign({}, DEFAULT_PREFS.types, (d.prefs || {}).types || {}) }), seen: d.seen || [], emailed: d.emailed || [] };
}
export const saveWatch = (email, d) => auth.kvPut(watchKey(email), Object.assign({ email }, d));

export async function decisions() { return (await auth.kvGet('watch-review')) || {}; }
// Customer-facing events: an event flagged for review stays hidden until an admin approves its review item.
export const visible = (e, dec) => !e.review || (e.reviewId && dec[e.reviewId] && dec[e.reviewId].decision === 'approve');

export function countyTL(state, county) {
  const c = countyIndex().find(x => x.state === state && x.county === county); if (!c) return null;
  return readTL(c.slug + '.json');
}
export function eventsForKey(key, dec) {
  const { state, county } = parseKey(key); const tl = countyTL(state, county); if (!tl) return { tl: null, events: [] };
  return { tl, events: tl.events.filter(e => e.key === key && visible(e, dec)) };
}

// Notifications for a member: events detected on/after the day they started watching, in their chosen categories.
export function feed(w, dec) {
  const out = [], seen = new Set(w.seen);
  for (const it of w.watch) {
    const { events } = eventsForKey(it.key, dec); const since = String(it.addedAt || '').slice(0, 10);
    for (const e of events) {
      if (e.detectedAt < since) continue;
      if (!w.prefs.types[catOf(e.type)]) continue;
      out.push({ id: e.id, key: it.key, state: e.state, county: e.county, parcel: e.parcel, cert: e.cert || '', type: e.type, text: e.text, old: e.old, new: e.new, publishedAt: e.publishedAt, detectedAt: e.detectedAt, source: e.source, official: e.official, read: seen.has(e.id) });
    }
  }
  return out.sort((a, b) => (b.detectedAt || '').localeCompare(a.detectedAt || '') || b.id.localeCompare(a.id));
}

export function watchedView(w, dec) {
  return w.watch.map(it => {
    const { tl, events } = eventsForKey(it.key, dec);
    const latest = events.length ? events[events.length - 1] : null;
    const gone = !!(tl && tl.gone && tl.gone[it.key]) && !(latest && latest.type === 'relisted');
    return Object.assign({}, it, { latest: latest ? { type: latest.type, text: latest.text, detectedAt: latest.detectedAt, publishedAt: latest.publishedAt, source: latest.source } : null,
      noLongerListed: gone && !events.some(e => ['result_posted', 'redemption_confirmed', 'withdrawn_confirmed', 'auction_canceled'].includes(e.type)),
      lastVerified: tl && tl.lastVerified ? { at: tl.lastVerified.at, published: tl.lastVerified.published } : null });
  });
}

// Email digest: one message per member with events they have not been emailed yet, only if they turned email on, only for
// events detected after they turned it on. An event id is recorded after a successful send, so reimports can never repeat an alert.
export async function runDigest(only) {
  const dec = await decisions(), keys = await auth.kvList('watch_'); const rep = { members: 0, sent: 0, skipped: 0, errors: 0, events: 0 };
  const mailOn = await auth.mailConfig();
  for (const k of keys) {
    const doc = await auth.kvGet(k); if (!doc || !doc.prefs || !doc.prefs.email || !doc.email) continue;
    if (only && doc.email !== only) continue;
    rep.members++;
    const w = { watch: doc.watch || [], prefs: Object.assign({}, DEFAULT_PREFS, doc.prefs, { types: Object.assign({}, DEFAULT_PREFS.types, doc.prefs.types || {}) }), seen: doc.seen || [], emailed: doc.emailed || [] };
    const since = String(w.prefs.emailSince || '').slice(0, 10);
    const todo = feed(w, dec).filter(e => !w.emailed.includes(e.id) && e.detectedAt >= since);
    if (!todo.length) { rep.skipped++; continue; }
    if (!mailOn) { rep.skipped++; continue; }
    const lines = todo.slice(0, 40).map(e => '• ' + e.county + ' County, parcel ' + e.parcel + (e.cert ? ' (certificate ' + e.cert + ')' : '') + ': ' + e.text + ' (detected ' + e.detectedAt + (e.publishedAt ? ', published ' + e.publishedAt : '') + '; source: ' + (e.source && e.source.name || 'county') + ' ' + (e.source && e.source.url || '') + ')');
    const body = 'Updates on parcels you watch at PricePocketAsset:\n\n' + lines.join('\n') + '\n\nOpen your watchlist: https://pricepocketasset.com/account/watchlist/\nFigures come from official county records. Verify with the county before you bid. This is education, not investment advice.\nTurn email alerts off any time in your watchlist settings.';
    const r = await auth.sendMail(doc.email, 'Watchlist update: ' + todo.length + ' change' + (todo.length === 1 ? '' : 's') + ' on your parcels', body);
    if (r.ok) { doc.emailed = (doc.emailed || []).concat(todo.map(e => e.id)).slice(-2000); await auth.kvPut(k, doc); rep.sent++; rep.events += todo.length; } else rep.errors++;
  }
  return rep;
}
