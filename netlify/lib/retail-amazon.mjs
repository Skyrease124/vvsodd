// Amazon stock checks through Bright Data's Amazon Products scraper (Web Scraper API). Amazon pages are never loaded by us.
// Cost safety: free tier only. A hard monthly cap in code (below the 5,000 free credits) is reserved BEFORE every request,
// and the owner keeps the Bright Data account unfunded so the provider stops at the free limit. Nothing runs without the owner's
// switch, the saved key, and credits left. Two fast phases so no function waits on a slow scrape:
//   1) trigger: ask for fresh data for the products that are due (returns a snapshot id at once)
//   2) collect: on a later run, read the finished snapshot and apply it
import * as auth from './auth.mjs';
import * as KEYS from './apikeys.mjs';
import * as R from './retail.mjs';
const DATASET = 'gd_l7q7dkf244hwjntr0';          // Bright Data "Amazon Products" scraper
const API = 'https://api.brightdata.com/datasets/v3';
export const MONTHLY_CAP = 4500;                  // credits we allow ourselves; the free pool is 5,000
export const PER_RUN = 5;                         // at most this many products per run
const CTRL = 'retail-amazon-control-v1', USE = 'retail-amazon-usage-v1', PEND = 'retail-amazon-pending-v1';
const month = () => new Date().toISOString().slice(0, 7);
const now = () => new Date().toISOString();
export const isAmazonProduct = p => p && p.retailer === 'amazon' && p.active !== false;

export async function usage() { const u = (await auth.kvGet(USE)) || {}; return u.month === month() ? { month: u.month, used: u.used || 0 } : { month: month(), used: 0 }; }
// Counts the credits first. If it would pass the cap, nothing is requested.
async function reserve(n) { const u = await usage(); if (u.used + n > MONTHLY_CAP) return false; await auth.kvPut(USE, { month: u.month, used: u.used + n }); return true; }
export async function status() {
  const c = (await auth.kvGet(CTRL)) || {}, p = (await auth.kvGet(PEND)) || { jobs: [] }; await KEYS.load();
  return { enabled: c.enabled === true, keySaved: !!KEYS.keyOf('BRIGHTDATA_API_KEY'), cap: MONTHLY_CAP, ...(await usage()), pending: (p.jobs || []).length };
}
export const setEnabled = async (owner, enabled) => { await auth.kvPut(CTRL, { enabled: enabled === true, by: owner, at: now() }); return { ok: true }; };

// How often each Amazon product is worth a credit: often near a release, rarely otherwise.
export function dueMs(p) {
  if (p.fails >= 3) return 12 * 3600e3;
  if (p.releaseDate) { const ms = Date.parse(p.releaseDate) - Date.now(); if (ms > 7 * 864e5) return 24 * 3600e3; if (ms > 864e5) return 4 * 3600e3; if (ms > -864e5) return 60 * 60e3; }
  return p.status === 'in_stock' || p.status === 'low_stock' ? 2 * 3600e3 : 4 * 3600e3;
}
const isAmazonSeller = s => /^\s*(amazon(\.com)?(\s+services|\s+sales)?|amazon\.com services llc)\s*$/i.test(String(s || ''));
// Stock rules. In stock needs Amazon itself as the seller (third-party listings are often resellers at inflated prices).
export function classify(rec) {
  const av = String(rec.availability || '').toLowerCase().trim(), seller = rec.seller_name || rec.buybox_seller || '';
  const price = Number(rec.final_price ?? rec.price); const px = Number.isFinite(price) && price > 0 ? price : null;
  if (!av) return { status: 'unknown', reason: 'Bright Data returned no availability for this product.' };
  if (/(currently )?unavailable|out of stock|sold out|temporarily out/.test(av)) return { status: 'out_of_stock', reason: 'Amazon availability: "' + rec.availability + '"', price: px };
  if (/in stock|only \d+ left|left in stock/.test(av)) {
    if (isAmazonSeller(seller)) return { status: 'in_stock', reason: 'Amazon availability: "' + rec.availability + '", sold by Amazon', price: px };
    return { status: 'unknown', reason: 'In stock from a third-party seller (' + (seller || 'seller not shown') + ')' + (px ? ' at $' + px.toFixed(2) : '') + ', not counted as in stock.', note: true };
  }
  return { status: 'unknown', reason: 'Availability text not recognised: "' + String(rec.availability).slice(0, 80) + '"' };
}

async function bd(path, init) {
  const key = KEYS.keyOf('BRIGHTDATA_API_KEY'); if (!key) return null;
  return fetch(API + path, Object.assign({ signal: AbortSignal.timeout(15000) }, init, { headers: Object.assign({ Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, (init || {}).headers) }));
}
const KP = id => 'rp_' + id;
async function apply(p, rec, reader) {
  let c = classify(rec);
  if (c.status === 'unknown' && !c.note && reader && rec.availability) {
    const ai = await reader(p, 'availability: ' + rec.availability + '\nseller: ' + (rec.seller_name || '') + '\nprice: ' + (rec.final_price || '')).catch(() => null);
    if (ai && ai.status === 'out_of_stock') c = { status: 'out_of_stock', reason: 'AI reader on Amazon data: "' + ai.evidence + '"', price: null };
  }
  const before = p.status; p.fails = 0; p.lastError = '';
  if (rec.image || rec.main_image) { p.image = p.image || rec.image || rec.main_image; }
  const sent = await R.applyResult(p, { status: c.status === 'unknown' ? p.status : c.status, price: c.price ?? undefined, reason: c.reason }, 'auto');
  await R.recordFinding(p, { source: 'amazon', reason: c.reason, attention: c.status === 'unknown', note: c.status === 'unknown' ? (c.note ? 'Not counted as in stock. Confirm on Amazon.' : 'No clear signal. Status unchanged.') : '' });
  return { changed: p.status !== before, alerts: sent.filter(x => !x.skipped).length };
}

// One step: collect finished snapshots, then ask for fresh data on products that are due.
export async function step({ force = false, limit = PER_RUN, reader = null } = {}) {
  const st = await status(); const out = { collected: 0, requested: 0, changed: 0, alerts: 0, skipped: '' };
  if (!st.keySaved) return Object.assign(out, { skipped: 'No Bright Data key saved.' });
  if (!st.enabled && !force) return Object.assign(out, { skipped: 'Amazon checks are off.' });
  // 1) collect
  const pend = (await auth.kvGet(PEND)) || { jobs: [] }; const keep = [];
  for (const j of pend.jobs || []) {
    try {
      const pr = await bd('/progress/' + encodeURIComponent(j.snapshot));
      const pj = pr && pr.ok ? await pr.json() : null;
      if (!pj || pj.status === 'running' || pj.status === 'starting' || pj.status === 'building') { if (Date.now() - Date.parse(j.at) < 30 * 60e3) keep.push(j); continue; }
      if (pj.status !== 'ready') continue;                               // failed: dropped, product fails count below
      const sr = await bd('/snapshot/' + encodeURIComponent(j.snapshot) + '?format=json'); const recs = sr && sr.ok ? await sr.json() : [];
      for (const pid of j.ids) {
        const p = await R.getProduct(pid); if (!p) continue;
        const asin = R.asinOf(p.url), list = Array.isArray(recs) ? recs : [];
        const rec = list.find(r => asin && (String(r.asin || '').toUpperCase() === asin || String(r.input?.url || r.url || '').includes(asin))) || (j.ids.length === 1 ? list[0] : null);
        if (!rec || rec.error) { p.fails = (p.fails || 0) + 1; p.checkedAt = now(); p.lastError = 'Amazon data was not returned'; await auth.kvPut(KP(p.id), p); await R.recordFinding(p, { source: 'amazon', reason: p.lastError, attention: true, note: 'No data returned. Status kept.' }); continue; }
        const a = await apply(p, rec, reader); out.collected++; out.changed += a.changed ? 1 : 0; out.alerts += a.alerts;
      }
    } catch (e) { if (Date.now() - Date.parse(j.at) < 30 * 60e3) keep.push(j); }
  }
  // 2) request fresh data for due products (credits reserved first)
  const busy = new Set(keep.flatMap(j => j.ids));
  const due = (await R.listProducts()).filter(p => isAmazonProduct(p) && !busy.has(p.id) && (force || !p.checkedAt || Date.now() - Date.parse(p.checkedAt) >= dueMs(p))).slice(0, limit);
  if (due.length) {
    if (!(await reserve(due.length))) { await auth.kvPut(PEND, { jobs: keep }); return Object.assign(out, { skipped: 'Monthly credit cap reached (' + MONTHLY_CAP + '). No more requests this month.' }); }
    try {
      const r = await bd('/trigger?dataset_id=' + DATASET + '&include_errors=true', { method: 'POST', body: JSON.stringify(due.map(p => ({ url: p.url }))) });
      const j = r && r.ok ? await r.json() : null;
      if (j && j.snapshot_id) { keep.push({ snapshot: j.snapshot_id, ids: due.map(p => p.id), at: now() }); out.requested = due.length; }
      else out.skipped = 'Bright Data did not accept the request' + (r ? ' (HTTP ' + r.status + ')' : '') + '.';
    } catch (e) { out.skipped = 'Could not reach Bright Data.'; }
  }
  await auth.kvPut(PEND, { jobs: keep });
  return out;
}
