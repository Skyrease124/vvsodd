// Pro property exports: 100 properties per subscription week, counted on the server, one credit per property.
//  - The week comes from the member's existing subscription period (sub.periodEnd, kept current by Stripe). No separate billing system.
//  - A reservation is written BEFORE any file is made. After writing it, the ledger is re-read and ordered; a reservation that does not fit under
//    the limit is withdrawn, so simultaneous requests can never end up above 100 unique properties.
//  - Failed exports release their credits. A property exported earlier in the same week is free to export again, in any format.
//  - The owner is never limited. Free members cannot export.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { kvGet, kvPut, kvList } from './auth.mjs';
import { zip, xlsx, pdf, csv } from './filemaker.mjs';

export const WEEKLY_LIMIT = parseInt(process.env.EXPORT_WEEKLY_LIMIT || '100', 10), MAX_PER_REQUEST = 100, STALE_MS = 10 * 60e3, FILE_DAYS = 30, KEEP_FILES = 30;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const sha = s => crypto.createHash('sha256').update(String(s).toLowerCase()).digest('hex').slice(0, 16);
const ymd = d => d.toISOString().slice(0, 10);
const addDays = (s, n) => ymd(new Date(Date.parse(s + 'T00:00:00Z') + n * 864e5));

// ---------- the member's current subscription week ----------
export function periodOf(u, today = ymd(new Date())) {
  let end = u.sub && /^\d{4}-\d{2}-\d{2}$/.test(u.sub.periodEnd || '') ? u.sub.periodEnd : (/^\d{4}-\d{2}-\d{2}$/.test(u.paidThrough || '') && !u.owner && !u.family ? u.paidThrough : '');
  if (!end) { const c = String(u.created || '').slice(0, 10); end = /^\d{4}-\d{2}-\d{2}$/.test(c) ? addDays(c, 7) : addDays(today, 7); } // owner and family access: weeks counted from sign-up
  while (end < today) end = addDays(end, 7); // a late Stripe update must not leave a stale, already-ended week open
  return { end, start: addDays(end, -7) };
}

// ---------- data: the same verified records the map uses ----------
let IDX = null; const FILES = {};
const dataDir = () => { for (const d of [path.join(process.cwd(), 'kinvest-liens/map'), path.join(HERE, '../../kinvest-liens/map'), '/var/task/kinvest-liens/map']) if (fs.existsSync(path.join(d, 'index.json'))) return d; return null; };
export function resetCache() { IDX = null; for (const k in FILES) delete FILES[k]; }
function index() { if (IDX) return IDX; const d = dataDir(); if (!d) return null; try { IDX = JSON.parse(fs.readFileSync(path.join(d, 'index.json'), 'utf8')); } catch (e) { return null; } return IDX; }
function dataset(id) {
  if (FILES[id]) return FILES[id]; const d = dataDir(), ix = index(), ds = ix && ix.datasets.find(x => x.id === id); if (!d || !ds) return null;
  let j; try { j = JSON.parse(fs.readFileSync(path.join(d, 'data', ds.file), 'utf8')); } catch (e) { return null; }
  const D = j.dict, by = new Map(); for (const r of j.recs) { for (const k in D) if (r[k] != null) r[k] = D[k][r[k]]; by.set(r.i, r); }
  return FILES[id] = { meta: ds, by };
}
// Finds a record from its id. Returns null for anything we do not hold (nothing is invented).
export function lookup(item) {
  const i = String(item && item.i || ''); if (!i || i.length > 200) return null; const ix = index(); if (!ix) return null;
  const tryD = d => { const ds = dataset(d); const r = ds && ds.by.get(i); return r ? { r, meta: ds.meta } : null; };
  if (item.d && /^[A-Za-z0-9-]{2,40}$/.test(item.d)) { const x = tryD(item.d); if (x) return x; }
  const ik = i.split('|').slice(0, 2).join('|'); for (const d of ix.datasets) if (d.ik === ik) { const x = tryD(d.id); if (x) return x; }
  return null;
}
const stateRule = (st) => { const ix = index(); return ix && ix.states && ix.states[st] || null; };
export const COLUMNS = ['Owner name', 'Parcel ID', 'Property address', 'State', 'County', 'Acreage', 'Property classification', 'Record category', 'Tax year', 'Amount on the list', 'What the amount is', 'Interest rate on the list', 'Auction or sale date', 'Date label', 'Redemption (state rule)', 'Sale status', 'Latitude', 'Longitude', 'Zoning', 'Flood zone (FEMA)', 'Wetlands (NWI)', 'Official source URL', 'Last verified'];
const CAT = { tax_lien: 'Tax lien', tax_deed: 'Tax deed', land_bank: 'Land bank / state-held' };
export function rowOf({ r, meta }) {
  const S = stateRule(meta.state), pos = r.cx || null;
  const flood = r.fz ? r.fz.z + (r.fz.sfha != null ? (r.fz.sfha > 0 ? ' (' + r.fz.sfha + '% in a high-risk zone)' : ' (none in a high-risk zone)') : '') : '';
  const wet = r.wt != null ? (r.wt > 0 ? r.wt + '% of the lot touches mapped wetlands' : 'None mapped') : '';
  return [r.o || '', r.p, r.a || '', meta.state, meta.county, r.ac != null ? r.ac : '', r.va ? 'Vacant land' : (r.us || ''), CAT[r.c] || '', r.ty || '', r.amt != null ? r.amt : '', r.al || '', r.rt || '', r.sd || '', r.sl || '',
    S && S.red && (r.c === 'tax_lien' || r.c === 'tax_deed') ? S.red : '', r.t || '', pos ? pos[1] : '', pos ? pos[0] : '', r.zn || '', flood, wet, r.su || '', r.ck || ''];
}
export const infoOf = (x) => { const row = rowOf(x), o = {}; COLUMNS.forEach((c, n) => { o[c] = row[n]; }); o.id = x.r.i; o.verified = !!x.r.v; o.hasBoundary = !!x.r.g; return o; };

// ---------- ledger ----------
const pre = (u, end) => 'xr_' + sha(u.email) + '_' + end + '_';
async function entries(u, end) { const keys = (await kvList(pre(u, end))).sort(); const out = []; for (const k of keys) { const v = await kvGet(k); if (v) out.push({ k, v }); } return out; }
const live = (e, now) => e.v.state === 'done' || (e.v.state === 'reserved' && now - e.v.ts < STALE_MS);
function tally(es, now, upTo, doneOnly) { const used = new Set(); for (const e of es) { if (!live(e, now) || (doneOnly && e.v.state !== 'done')) continue; e.v.ids.forEach(i => used.add(i)); if (upTo && e.k === upTo) break; } return used; }
export async function usage(u) {
  const p = periodOf(u); if (u.owner) return { unlimited: true, limit: null, used: 0, remaining: null, resets: p.end, periodStart: p.start };
  const used = tally(await entries(u, p.end), Date.now()); return { unlimited: false, limit: WEEKLY_LIMIT, used: used.size, remaining: Math.max(0, WEEKLY_LIMIT - used.size), resets: p.end, periodStart: p.start, ids: [...used] };
}
let chain = Promise.resolve(); const serial = fn => { const run = chain.then(fn, fn); chain = run.catch(() => {}); return run; };
export async function plan(u, ids) {
  const u0 = await usage(u), have = u.owner ? new Set() : tally(await entries(u, periodOf(u).end), Date.now(), null, true), fresh = ids.filter(i => !have.has(i));
  return { total: ids.length, already: ids.length - fresh.length, fresh: fresh.length, limit: u0.limit, used: u0.used, remaining: u0.remaining, after: u0.unlimited ? null : u0.remaining - fresh.length, resets: u0.resets, unlimited: u0.unlimited, fits: u0.unlimited || fresh.length <= u0.remaining };
}
// Reserve credits. Returns { ok, job, fresh } or { ok:false, why:'limit', remaining, resets }.
export async function reserve(u, ids, fmt) {
  if (u.owner) return { ok: true, job: crypto.randomBytes(6).toString('hex'), fresh: 0, owner: true };
  const p = periodOf(u), job = crypto.randomBytes(6).toString('hex'), ts = String(Date.now()).padStart(13, '0'), key = pre(u, p.end) + ts + '_' + job;
  return serial(async () => {
    const now = Date.now(), es0 = await entries(u, p.end), before = tally(es0, now), done = tally(es0, now, null, true), fresh = ids.filter(i => !done.has(i)), newUnique = fresh.filter(i => !before.has(i));
    if (before.size + newUnique.length > WEEKLY_LIMIT) return { ok: false, why: 'limit', remaining: Math.max(0, WEEKLY_LIMIT - before.size), resets: p.end };
    if (!fresh.length) return { ok: true, job, fresh: 0, free: true, end: p.end };
    await kvPut(key, { state: 'reserved', ids: fresh, ts: now, fmt, job });
    // read back in order: if this reservation does not fit after the ones ahead of it, withdraw it (a concurrent request got there first)
    const es = await entries(u, p.end), upTo = tally(es, now, key);
    if (upTo.size > WEEKLY_LIMIT) { await kvPut(key, { state: 'failed', ids: [], ts: now, fmt, job, why: 'over limit' }); return { ok: false, why: 'limit', remaining: Math.max(0, WEEKLY_LIMIT - tally(es.filter(e => e.k !== key), now).size), resets: p.end }; }
    return { ok: true, job, fresh: fresh.length, key, end: p.end };
  });
}
export async function complete(u, r) { if (r.key) { const v = await kvGet(r.key); if (v) { v.state = 'done'; v.done = Date.now(); await kvPut(r.key, v); } } }
export async function release(u, r) { if (r.key) { const v = await kvGet(r.key); if (v && v.state !== 'done') { v.state = 'failed'; v.ids = []; await kvPut(r.key, v); } } }

// ---------- building the file ----------
const slugn = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'property';
const PDF_NOTE = ['Information from county records we checked. Verify before you bid. Confirm owner, taxes, status and sale rules with the county.', 'Not legal, tax or investment advice. Availability shown only as the official list we checked said on its check date.'];
function pdfLines(x) {
  const row = rowOf(x), L = []; COLUMNS.forEach((c, n) => { if (row[n] !== '' && row[n] != null) L.push([c, String(row[n])]); }); return L;
}
export function build(fmt, xs) {
  const rows = xs.map(rowOf), date = ymd(new Date());
  if (fmt === 'csv') return { name: 'ppa-properties-' + date + '.csv', mime: 'text/csv; charset=utf-8', data: Buffer.from('﻿' + csv([COLUMNS].concat(rows)), 'utf8') };
  if (fmt === 'xlsx') return { name: 'ppa-properties-' + date + '.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', data: xlsx(COLUMNS, rows) };
  if (fmt === 'pdf') return { name: 'ppa-properties-' + date + '.pdf', mime: 'application/pdf', data: pdf(xs.map(x => ({ title: (x.r.a || 'Parcel ' + x.r.p), sub: x.meta.county + ', ' + x.meta.state + ' · ' + (CAT[x.r.c] || ''), lines: pdfLines(x) })), PDF_NOTE) };
  if (fmt === 'zip') { const used = new Set(), files = xs.map(x => { let n = slugn(x.meta.state + '-' + x.meta.county + '-' + x.r.p), k = n, c = 2; while (used.has(k)) k = n + '-' + c++; used.add(k); return { name: k + '.pdf', data: pdf([{ title: x.r.a || 'Parcel ' + x.r.p, sub: x.meta.county + ', ' + x.meta.state + ' · ' + (CAT[x.r.c] || ''), lines: pdfLines(x) }], PDF_NOTE) }; }); files.push({ name: 'properties.csv', data: Buffer.from('﻿' + csv([COLUMNS].concat(rows)), 'utf8') }); return { name: 'ppa-properties-' + date + '.zip', mime: 'application/zip', data: zip(files) }; }
  return null;
}
export const FORMATS = ['csv', 'xlsx', 'pdf', 'zip'];

// ---------- history and files ----------
const hk = u => 'xh_' + sha(u.email), fk = (u, job) => 'xf_' + sha(u.email) + '_' + job;
export async function saveFile(u, job, f, meta) {
  await kvPut(fk(u, job), { name: f.name, mime: f.mime, b64: f.data.toString('base64'), at: Date.now() });
  const h = (await kvGet(hk(u))) || { items: [] }; h.items.unshift(Object.assign({ job, name: f.name, fmt: meta.fmt, n: meta.n, credits: meta.credits, at: new Date().toISOString(), week: meta.week }, {})); h.items = h.items.slice(0, 200);
  for (const old of h.items.slice(KEEP_FILES)) if (old.job) { try { await kvPut(fk(u, old.job), null); } catch (e) {} }
  await kvPut(hk(u), h);
}
export async function history(u) { const h = (await kvGet(hk(u))) || { items: [] }, cut = Date.now() - FILE_DAYS * 864e5; return h.items.map((x, n) => ({ ...x, fileAvailable: n < KEEP_FILES && Date.parse(x.at) > cut })); }
export async function getFile(u, job) { if (!/^[a-f0-9]{12}$/.test(job)) return null; const f = await kvGet(fk(u, job)); if (!f || !f.b64 || Date.now() - f.at > FILE_DAYS * 864e5) return null; return { name: f.name, mime: f.mime, data: Buffer.from(f.b64, 'base64') }; }

// ---------- saved selection and collections (organizing never uses credits) ----------
const ck = u => 'xc_' + sha(u.email);
export async function getCollections(u) { return (await kvGet(ck(u))) || { sel: [], lists: [] }; }
export async function putCollections(u, c) { await kvPut(ck(u), c); }
export const cleanItems = (arr, max = 500) => { const seen = new Set(), out = []; for (const x of Array.isArray(arr) ? arr : []) { const i = String(x && x.i || '').slice(0, 200); if (!i || seen.has(i)) continue; seen.add(i); out.push({ i, d: x.d ? String(x.d).slice(0, 40) : undefined, t: x.t ? String(x.t).slice(0, 120) : undefined }); if (out.length >= max) break; } return out; };
