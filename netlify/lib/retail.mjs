// Retail Alerts: one shared record per product, many watchers. Stock checks run once per product (never per user).
// Alerts go out only when the status changes (e.g. SOLD OUT -> IN STOCK), with a cooldown, and use the existing OneSignal setup.
// Storage: the same Netlify Blobs store as accounts (auth.kvGet/kvPut/kvList).
//   rp_<id> product · rpu_<urlhash> url -> id · rw_<uid>_<pid> watch · rwp_<pid>_<uid> watcher index · rpref_<uid> preferences
//   rq_<id> request · ra_<id> alert (history) · rin_<uid> inbox · rgl global broadcasts · rih_<pid> inventory history
import crypto from 'node:crypto';
import * as auth from './auth.mjs';
import * as KEYS from './apikeys.mjs';
import * as OS from './onesignal.mjs';
import { prefsOf } from './pushjobs.mjs';
import { FOUNDER_EMAIL } from './community.mjs';

const UA = 'PricePocketAsset research (https://pricepocketasset.com)';
const now = () => new Date().toISOString();
const rid = n => crypto.randomBytes(n).toString('hex');
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const clean = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const err = (status, error, extra) => Object.assign({ ok: false, status, error }, extra || {});

// Only stores we can link to. Amazon is owner-confirmed only (its terms forbid automated checks).
export const RETAILERS = {
  nike: { name: 'Nike', hosts: ['nike.com'] },
  target: { name: 'Target', hosts: ['target.com'] },
  walmart: { name: 'Walmart', hosts: ['walmart.com'] },
  amazon: { name: 'Amazon', hosts: ['amazon.com'], noFetch: true },
  bestbuy: { name: 'Best Buy', hosts: ['bestbuy.com'] },
  pokemoncenter: { name: 'Pokémon Center', hosts: ['pokemoncenter.com'] },
  gamestop: { name: 'GameStop', hosts: ['gamestop.com'] },
};
export const CATEGORIES = ['pokemon', 'sneakers', 'electronics', 'gaming', 'collectibles'];
export const CAT_LABEL = { pokemon: 'Pokémon', sneakers: 'Sneakers', electronics: 'Electronics', gaming: 'Gaming', collectibles: 'Collectibles' };
export const TYPES = ['release', 'restock', 'price'];
export const STATUSES = ['upcoming', 'monitoring', 'in_stock', 'low_stock', 'sold_out', 'disabled', 'out_of_stock', 'invite_only', 'preorder', 'coming_soon', 'waitlist', 'limited_access', 'unknown'];
// Stock states shown to people. Price alone never means in_stock. 'sold_out' is kept for older records (same as out_of_stock).
export const STOCK_LABEL = { in_stock: 'IN STOCK', low_stock: 'LOW STOCK', out_of_stock: 'OUT OF STOCK', sold_out: 'OUT OF STOCK', invite_only: 'Invite Only', preorder: 'Preorder', coming_soon: 'Coming Soon', waitlist: 'Waitlist', limited_access: 'Limited Access', unknown: 'Unknown', upcoming: 'UPCOMING', monitoring: 'MONITORING', disabled: 'DISABLED' };
const AVAILABLE = new Set(['in_stock', 'low_stock']);
const COOLDOWN_MS = () => +(process.env.RETAIL_COOLDOWN_MIN || 360) * 60e3;   // same alert type, same product: at most every 6 hours
const FRESH_MS = 3 * 3600e3;   // "In Stock Now" only shows results confirmed in the last 3 hours

// ---- URL safety: https, a known store, no credentials, tracking parameters removed ----
export function checkUrl(raw) {
  let u; try { u = new URL(String(raw || '').trim()); } catch (e) { return null; }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  const key = Object.keys(RETAILERS).find(k => RETAILERS[k].hosts.some(h => host === h || host.endsWith('.' + h)));
  if (!key) return null;
  for (const p of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref|tag|cid|irgwc|clickid|affiliate)/i.test(p)) u.searchParams.delete(p);
  u.hash = ''; return { url: u.toString().slice(0, 600), retailer: key };
}
export const safeLink = raw => { const c = checkUrl(raw); return c ? c.url : ''; };

// ---- reading a product page. A price alone never means in stock. ----
// Stock is only IN_STOCK when the page has an ENABLED purchase control (Add to Cart, Buy Now, Ship It, Add for Shipping...).
// Restriction text (invite, lottery, exclusive event, waitlist, waiting room, coming soon) always wins over everything else.
const RESTRICT = [
  { status: 'invite_only', label: 'Exclusive sales event', why: 'invitation required', re: /exclusive sales event/i },
  { status: 'invite_only', label: 'Invite requested', why: 'invitation required', re: /you[’']ve requested an invite|request(ed)? an invite/i },
  { status: 'invite_only', label: 'Invitation required', why: 'invitation required', re: /invitation required|you[’']ll receive an invitation|if you[’']re selected (to participate)?/i },
  { status: 'invite_only', label: 'Invite available by request', why: 'invitation required', re: /ask for an invite|available by invitation|request an invite/i },
  { status: 'invite_only', label: 'Lottery', why: 'lottery entry required', re: /\blottery\b|enter (the|our) drawing/i, visibleOnly: true },
  { status: 'waitlist', label: 'Waitlist', why: 'waitlist, not for sale yet', re: /join (the )?waitlist|you[’']re on (the )?waitlist/i },
  { status: 'limited_access', label: 'Waiting room', why: 'waiting room or queue', re: /waiting room|you (are|[’']re) in (the )?line/i },
  { status: 'coming_soon', label: 'Coming soon', why: 'not released yet', re: /coming soon/i },
];
const BUY = /add to cart|add to bag|buy now|ship it|add for shipping|add to order/i;
const PREORDER_BTN = /pre-?order/i;
const SOLD = /sold out|out of stock|currently unavailable|unavailable for (shipping|pickup|pick-up|pick up|delivery)|not available for (shipping|pickup|pick-up|delivery)|sold out online/i;
const stripHtml = h => h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&#39;|&rsquo;/gi, '’').replace(/\s+/g, ' ').trim();
// Every button, link or input on the page with its label and whether it is disabled.
export function controls(html) {
  const out = [];
  for (const m of html.matchAll(/<(button|a)\b([^>]*)>([\s\S]{0,400}?)<\/\1>/gi)) out.push({ label: stripHtml(m[3]), disabled: isDisabled(m[2]) });
  for (const m of html.matchAll(/<input\b([^>]*)>/gi)) { const v = (m[1].match(/value=["']([^"']*)/i) || [])[1] || ''; out.push({ label: v, disabled: isDisabled(m[1]) }); }
  return out.filter(c => c.label && (BUY.test(c.label) || PREORDER_BTN.test(c.label)));
}
function isDisabled(attrs) { return /\bdisabled\b|aria-disabled=["']true["']/i.test(attrs) || /class=["'][^"']*\bdisabled\b/i.test(attrs); }
// Decides the stock state and writes the reason in plain words. Returns {status, reason, matched}.
export function classifyStock({ html = '', schemaAvail = '', retailer = '', price = null }) {
  const store = (RETAILERS[retailer] || { name: 'Retailer' }).name, text = stripHtml(html), ctrls = controls(html);
  // Restriction wording is looked for in the page data too (many stores put the invite state inside script data, not visible text).
  const data = html.replace(/\\"/g, '"').replace(/\\u0027/gi, "'").replace(/\\u2019/gi, '’').replace(/<[^>]+>/g, ' ');
  const vis = stripHtml(html);   // visible text only: customer reviews are never treated as the page's own state
  const hit = RESTRICT.filter(r => r.re.test(r.visibleOnly ? vis : data));
  if (hit.length) return { status: hit[0].status, reason: store + ' ' + hit[0].label + ' — ' + hit[0].why, matched: hit.map(h => h.label) };
  const enabled = ctrls.filter(c => !c.disabled);
  const enabledPre = enabled.filter(c => PREORDER_BTN.test(c.label));
  if (enabledPre.length) return { status: 'preorder', reason: store + ' enabled "' + enabledPre[0].label + '" button — preorder', matched: [enabledPre[0].label] };
  const enabledBuy = enabled.filter(c => BUY.test(c.label));
  const noWay = /(unavailable|not available) for (shipping|pickup|pick-up|pick up|delivery)/i.exec(text);   // no way to buy this way, whatever the button says
  if (noWay) return { status: 'out_of_stock', reason: store + ' page says "' + noWay[0] + '"', matched: [noWay[0]] };
  const sold = SOLD.exec(text), schemaOut = /OutOfStock|SoldOut|Discontinued/i.test(schemaAvail);
  if (enabledBuy.length && sold) return { status: 'unknown', reason: store + ' shows an enabled "' + enabledBuy[0].label + '" button but also says "' + sold[0] + '" — conflicting, confirm on the store', matched: [] };
  if (enabledBuy.length) return { status: 'in_stock', reason: store + ' enabled "' + enabledBuy[0].label + '" button found', matched: [enabledBuy[0].label] };
  if (sold) return { status: 'out_of_stock', reason: store + ' page says "' + sold[0] + '"', matched: [sold[0]] };
  const dis = ctrls.filter(c => c.disabled && BUY.test(c.label));
  if (dis.length) return { status: 'out_of_stock', reason: store + ' "' + dis[0].label + '" button is disabled', matched: [dis[0].label] };
  if (schemaOut) return { status: 'out_of_stock', reason: store + ' listing data says out of stock', matched: [] };
  return { status: 'unknown', reason: (price != null ? 'Price found ($' + Number(price).toFixed(2) + ') but no enabled purchase button — a price alone does not mean in stock' : 'No enabled purchase button or stock status found on the page'), matched: [] };
}
export function parseHtml(html) {
  const out = {}; const lds = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  const walk = (o, f) => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) return o.forEach(x => walk(x, f)); f(o); Object.values(o).forEach(x => walk(x, f)); };
  for (const t of lds) { let j; try { j = JSON.parse(t.trim()); } catch (e) { continue; }
    walk(j, o => { const ty = [].concat(o['@type'] || []); if (!ty.includes('Product') || out.name) return; out.name = clean(o.name, 160); const im = [].concat(o.image || [])[0]; out.image = typeof im === 'string' ? im : im && im.url;
      const of = [].concat(o.offers || []).flatMap(x => x && x['@type'] === 'AggregateOffer' ? [].concat(x.offers || [x]) : [x]).filter(Boolean)[0];
      if (of) { const pr = parseFloat(of.price ?? of.lowPrice); if (isFinite(pr) && pr > 0) out.price = Math.round(pr * 100) / 100; out.schemaAvail = String(of.availability || ''); }
      if (o.releaseDate) out.releaseDate = String(o.releaseDate).slice(0, 10); }); }
  const og = p => { const m = html.match(new RegExp('<meta[^>]+property=["\']og:' + p + '["\'][^>]+content=["\']([^"\']+)', 'i')) || html.match(new RegExp('<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:' + p, 'i')); return m ? m[1] : ''; };
  if (!out.name) out.name = clean(og('title').replace(/&amp;/g, '&').replace(/&#39;/g, "'"), 160) || undefined;
  if (!out.image) out.image = og('image') || undefined;
  if (out.image && !/^https:\/\//.test(out.image)) delete out.image;
  return out;
}
let fetchImpl = (...a) => fetch(...a);
export const _setFetch = f => { fetchImpl = f; };
// Best Buy's API gives name and price only. It does not say whether the item can be bought, so stock still comes from the page.
async function bestBuy(url) {
  await KEYS.load(); const key = KEYS.keyOf('BESTBUY_API_KEY'); const sku = (url.match(/skuId=(\d{5,9})/) || url.match(/\/(\d{6,9})\.p/) || [])[1];
  if (!key || !sku) return null;
  const r = await fetchImpl(`https://api.bestbuy.com/v1/products/${sku}.json?show=name,image,salePrice,releaseDate&apiKey=${encodeURIComponent(key)}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error('Best Buy answered ' + r.status);
  const d = await r.json(); return { name: clean(d.name, 160), image: d.image, price: +d.salePrice || undefined, releaseDate: d.releaseDate || undefined };
}
// {ok, info:{name,image,price,status,reason,releaseDate}, readable, note}. readable = a real state was found (not UNKNOWN), so automatic checks can run.
export async function lookup(url) {
  const c = checkUrl(url); if (!c) return err(400, 'Paste a https link from a supported store.');
  const store = RETAILERS[c.retailer].name;
  if (RETAILERS[c.retailer].noFetch) return { ok: true, info: { status: 'unknown', reason: store + ' does not allow automatic checks. You confirm stock yourself.' }, readable: false, note: store + ' does not allow automatic checks. You confirm stock yourself.' };
  try {
    const r = await fetchImpl(c.url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(9000) });
    if (!r.ok) return { ok: true, info: { status: 'unknown', reason: store + ' answered ' + r.status }, readable: false, note: store + ' answered ' + r.status + '. Fill in the details yourself; stock is owner-confirmed.' };
    const html = (await r.text()).slice(0, 3e6); const info = parseHtml(html);
    if (c.retailer === 'bestbuy') { try { const a = await bestBuy(c.url); if (a) { info.name = a.name || info.name; if (a.price) info.price = a.price; if (a.releaseDate) info.releaseDate = a.releaseDate; } } catch (e) { /* the page still decides stock */ } }
    const k = classifyStock({ html, schemaAvail: info.schemaAvail || '', retailer: c.retailer, price: info.price ?? null });
    info.status = k.status; info.reason = k.reason; info.matched = k.matched; delete info.schemaAvail;
    return { ok: true, info, readable: k.status !== 'unknown', note: k.reason };
  } catch (e) { return { ok: true, info: { status: 'unknown', reason: 'Could not read the page' }, readable: false, note: 'Could not read the page (' + String(e.message || e).slice(0, 60) + '). Fill in the details yourself.' }; }
}

// ---- products ----
const KP = id => 'rp_' + id, KU = url => 'rpu_' + sha(url).slice(0, 32);
export const getProduct = async id => /^[a-f0-9]{12}$/.test(String(id)) ? auth.kvGet(KP(id)) : null;
const num = v => { const n = typeof v === 'string' ? parseFloat(v.replace(/[$,]/g, '')) : +v; return isFinite(n) && n > 0 && n < 1e6 ? Math.round(n * 100) / 100 : null; };
function fields(p, b) {
  if (b.name !== undefined) p.name = clean(b.name, 160) || p.name;
  if (b.image !== undefined) p.image = /^https:\/\/[^\s"'<>]{4,500}$/.test(String(b.image)) ? String(b.image) : '';
  if (b.category !== undefined) { if (!CATEGORIES.includes(b.category)) throw new Error('Pick a category.'); p.category = b.category; }
  if (b.variant !== undefined) p.variant = clean(b.variant, 60);
  if (b.releaseDate !== undefined) p.releaseDate = /^\d{4}-\d{2}-\d{2}/.test(String(b.releaseDate)) ? String(b.releaseDate).slice(0, 16) : '';
  if (b.price !== undefined) { const blank = b.price === '' || b.price === null; const n = blank ? null : num(b.price); if (!blank && n === null) throw new Error('Price must be a number.'); p.priceManual = n; }
  if (b.auto !== undefined) p.auto = !!b.auto && !RETAILERS[p.retailer].noFetch;
}
export async function createProduct(owner, b) {
  const c = checkUrl(b.url); if (!c) return err(400, 'Paste a https link from a supported store.');
  const dupe = await auth.kvGet(KU(c.url)); if (dupe && dupe.id && await getProduct(dupe.id)) return err(409, 'That product is already in the catalog.', { id: dupe.id });
  const p = { id: rid(6), url: c.url, retailer: c.retailer, name: '', image: '', category: '', variant: '', releaseDate: '', price: null, prevPrice: null, priceManual: null, status: 'monitoring', prevStatus: '', auto: false, active: true,
    checkedAt: '', stockChangeAt: '', confirmedAt: '', statusReason: 'Added by the owner', lastAlert: {}, fails: 0, createdBy: owner, created: now(), updated: now(), watchers: 0 };
  try { fields(p, b); } catch (e) { return err(400, e.message); }
  if (!p.name) return err(400, 'Add a product name.'); if (!p.category) return err(400, 'Pick a category.');
  if (STATUSES.includes(b.status)) p.status = b.status;
  if (p.priceManual != null) p.price = p.priceManual;
  if (AVAILABLE.has(p.status)) p.confirmedAt = p.checkedAt = now();
  await auth.kvPut(KP(p.id), p); await auth.kvPut(KU(c.url), { id: p.id }); return { ok: true, product: p };
}
export async function updateProduct(id, b) {
  const p = await getProduct(id); if (!p) return err(404, 'Product not found.');
  try { fields(p, b); } catch (e) { return err(400, e.message); }
  if (b.active !== undefined) p.active = !!b.active;
  p.updated = now(); await auth.kvPut(KP(p.id), p);
  const st = STATUSES.includes(b.status) ? b.status : p.status, pr = p.priceManual != null ? p.priceManual : p.price;
  const sent = (st !== p.status || pr !== p.price || (b.status && AVAILABLE.has(b.status))) ? await applyResult(p, { status: st, price: pr, reason: 'Set by the owner' }, 'owner') : [];
  return { ok: true, product: await getProduct(id), sent };
}
export async function listProducts({ all } = {}) {
  const out = []; for (const k of (await auth.kvList('rp_')).slice(0, 1000)) { const p = await auth.kvGet(k); if (p && p.id && (all || (p.active && p.status !== 'disabled'))) out.push(p); }
  return out.sort((a, b) => (a.updated < b.updated ? 1 : -1));
}
// Public card: verified facts only. "In stock" shows only while the last confirmation is fresh.
export function card(p) {
  const fresh = p.confirmedAt && Date.now() - Date.parse(p.confirmedAt) < FRESH_MS;
  const status = AVAILABLE.has(p.status) && !fresh ? 'monitoring' : p.status;
  return { id: p.id, name: p.name, retailer: p.retailer, retailerName: RETAILERS[p.retailer].name, url: p.url, image: p.image, price: p.price, prevPrice: p.prevPrice, status, statusReason: p.statusReason || '', category: p.category, variant: p.variant, releaseDate: p.releaseDate, checkedAt: p.confirmedAt && AVAILABLE.has(status) ? p.confirmedAt : (p.checkedAt || p.updated), auto: !!p.auto, watchers: p.watchers || 0 };
}

// ---- state change -> alerts. Called by the monitor (source 'auto') and by the owner (source 'owner') ----
export async function applyResult(p, r, source) {
  const t = now(), prevStatus = p.status, prevPrice = p.price;
  const nextStatus = STATUSES.includes(r.status) ? r.status : prevStatus, nextPrice = r.price != null ? num(r.price) : prevPrice;
  p.checkedAt = t; if (AVAILABLE.has(nextStatus)) p.confirmedAt = t;
  if (r.reason) p.statusReason = clean(r.reason, 240);
  const events = [];
  if (nextStatus !== prevStatus) {
    p.prevStatus = prevStatus; p.status = nextStatus; p.stockChangeAt = t;
    if (AVAILABLE.has(nextStatus) && !AVAILABLE.has(prevStatus)) events.push(prevStatus === 'upcoming' ? 'release' : 'restock');
    if (nextStatus === 'limited_access') events.push('queue');   // the line / waiting room just opened: "Get in line"
    const h = (await auth.kvGet('rih_' + p.id)) || []; h.unshift({ at: t, from: prevStatus, to: nextStatus, price: nextPrice, source }); await auth.kvPut('rih_' + p.id, h.slice(0, 60));
  }
  if (nextPrice != null && nextPrice !== prevPrice) { p.prevPrice = prevPrice; p.price = nextPrice; if (prevPrice != null && nextPrice < prevPrice && AVAILABLE.has(p.status)) events.push('price'); }
  p.updated = t; const sent = [];
  for (const kind of events) {
    const last = (p.lastAlert || {})[kind]; if (last && Date.now() - Date.parse(last) < COOLDOWN_MS()) { sent.push({ kind, skipped: 'cooldown' }); continue; }
    p.lastAlert = Object.assign({}, p.lastAlert, { [kind]: t }); sent.push(Object.assign({ kind }, await notifyProduct(p, kind)));
  }
  await auth.kvPut(KP(p.id), p); return sent;
}
const EMOJI = { pokemon: '🔥', sneakers: '👟', electronics: '⚡', gaming: '🎮', collectibles: '⭐' };
export function message(p, kind) {
  const store = RETAILERS[p.retailer].name, cat = CAT_LABEL[p.category] || 'Retail', price = p.price != null ? ' $' + p.price.toFixed(2) + '.' : '';
  if (kind === 'queue') return { title: '🚦 Get in line', body: p.name + ' — the line is open at ' + store + '. Tap to get in line.' };
  if (kind === 'restock' && p.prevStatus === 'invite_only') return { title: '🎟️ Invite Live', body: p.name + ' is now available to buy at ' + store + '.' + price + ' Tap to shop.' };
  if (kind === 'release') return { title: (EMOJI[p.category] || '🛍️') + ' ' + cat + ' Release Live', body: p.name + ' is live at ' + store + '.' + price + ' Tap to shop.' };
  if (kind === 'price') return { title: '💸 Price Drop', body: p.name + ' dropped to $' + p.price.toFixed(2) + ' at ' + store + (p.prevPrice != null ? ' (was $' + p.prevPrice.toFixed(2) + ')' : '') + '. Tap to shop.' };
  return { title: (EMOJI[p.category] || '🛍️') + ' ' + cat + ' Restock', body: p.name + ' is back in stock at ' + store + '.' + price + ' Tap to buy.' };
}
export function prefMatch(pr, category, retailer, kind) {
  if (!pr) return false; if (category && !(pr.cats || {})[category]) return false; if (kind && !(pr.types || {})[kind]) return false;
  const stores = Object.keys(pr.stores || {}).filter(s => pr.stores[s]); if (retailer && stores.length && !stores.includes(retailer)) return false; return true;
}
// Who gets a product alert: its watchers (by their choices and max price) plus members whose preferences match.
export async function recipients(p, kind) {
  const set = new Map();
  for (const k of await auth.kvList('rwp_' + p.id + '_')) { const uid = k.slice(4 + p.id.length + 1); const w = await auth.kvGet('rw_' + uid + '_' + p.id); if (!w) continue;
    const want = kind === 'release' ? w.release : kind === 'restock' ? w.inStock : kind === 'queue' ? (w.inStock || w.release) : w.priceDrop; if (!want) continue;
    if (w.maxPrice != null && (p.price == null || p.price > w.maxPrice)) continue;   // no price, no price-qualified alert
    set.set(uid, 'watch'); }
  for (const k of await auth.kvList('rpref_')) { const uid = k.slice(6); if (set.has(uid)) continue; if (prefMatch(await auth.kvGet(k), p.category, p.retailer, kind === 'queue' ? 'restock' : kind)) set.set(uid, 'prefs'); }
  return set;
}
async function emailOf(uid) { const p = await auth.kvGet('cp_' + uid); return p && p.email; }
async function deliver(uids, alert) {
  let pushed = 0, inbox = 0, failed = 0, off = 0;
  for (const uid of uids) {
    const ib = (await auth.kvGet('rin_' + uid)) || { items: [] }; if (!ib.items.some(x => x.id === alert.id)) { ib.items.unshift({ id: alert.id, read: false }); ib.items = ib.items.slice(0, 150); await auth.kvPut('rin_' + uid, ib); inbox++; }
    const email = await emailOf(uid); if (!email) continue; const u = await auth.getUser(email); if (!u || u.revoked) continue;
    const pp = prefsOf(u); if (!pp.enabled || !pp.subscribed) { off++; continue; }
    if (((await auth.kvGet('rpref_' + uid)) || {}).muted) { off++; continue; }   // member turned retail pushes off (still in their alerts center)   // only members who turned notifications on
    const r = await OS.send({ email, title: alert.title, body: alert.body, link: alert.url || '', path: '/retail/?alert=' + alert.id, key: 'retail:' + alert.dedupe, topic: 'retail-' + (alert.product || alert.id), retail: true });
    if (r.ok && !r.skipped) pushed++; else if (!r.ok) failed++;
  }
  return { pushed, inbox, failed, pushOff: off };
}
async function saveAlert(a) { a.id = a.id || rid(6); a.at = a.at || now(); await auth.kvPut('ra_' + a.id, a); return a; }
export async function notifyProduct(p, kind) {
  const m = message(p, kind); const to = await recipients(p, kind);
  const a = await saveAlert({ kind, title: m.title, body: m.body, url: p.url, product: p.id, productName: p.name, retailer: p.retailer, category: p.category, status: p.status, price: p.price, dedupe: p.id + ':' + kind + ':' + p.stockChangeAt + ':' + p.price, audience: 'matching', count: to.size });
  return Object.assign({ alert: a.id, recipients: to.size }, await deliver([...to.keys()], a));
}
export async function history(limit = 40) { const out = []; for (const k of (await auth.kvList('ra_')).slice(-400)) { const a = await auth.kvGet(k); if (a) out.push(a); } return out.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, limit); }

// ---- owner broadcast. audience: {type:'everyone'|'category'|'retailer'|'product', value} ----
export async function broadcast(b) {
  const title = clean(b.title, 70), body = clean(b.message, 220); if (!title || !body) return err(400, 'Add a title and a message.');
  let url = ''; if (b.url) { url = safeLink(b.url) || (/^\/(?!\/)[a-z0-9/_\-?=&.]*$/i.test(b.url) ? b.url : ''); if (!url) return err(400, 'The link must be a supported store or a page on PricePocketAsset.'); }
  const image = b.image && /^https:\/\/[^\s"'<>]{4,500}$/.test(b.image) ? b.image : '';
  const aud = b.audience || {}, type = aud.type;
  if (type === 'everyone' && !b.confirmEveryone) return err(400, 'Confirm that this goes to everyone.');
  const a = { kind: 'broadcast', title, body, url, image, category: CATEGORIES.includes(aud.value) ? aud.value : (CATEGORIES.includes(b.category) ? b.category : ''), retailer: RETAILERS[aud.value] ? aud.value : '', priority: b.priority === 'high' ? 'high' : 'normal', audience: type, audienceValue: aud.value || '', dedupe: 'b:' + rid(6) };
  if (type === 'everyone') {
    await saveAlert(a); const g = (await auth.kvGet('rgl')) || { ids: [] }; g.ids.unshift(a.id); g.ids = g.ids.slice(0, 50); await auth.kvPut('rgl', g);
    const r = await OS.sendSegment({ title, body, link: url, path: '/retail/?alert=' + a.id, key: 'retail:' + a.dedupe, priority: a.priority, image });
    a.count = 'all'; await auth.kvPut('ra_' + a.id, a); return { ok: true, alert: a.id, everyone: true, push: r };
  }
  let uids = [];
  if (type === 'category' && CATEGORIES.includes(aud.value)) { for (const k of await auth.kvList('rpref_')) if (prefMatch(await auth.kvGet(k), aud.value, null, null)) uids.push(k.slice(6)); }
  else if (type === 'retailer' && RETAILERS[aud.value]) { for (const k of await auth.kvList('rpref_')) { const pr = await auth.kvGet(k); if (pr && (pr.stores || {})[aud.value]) uids.push(k.slice(6)); } }
  else if (type === 'product' && await getProduct(aud.value)) uids = (await auth.kvList('rwp_' + aud.value + '_')).map(k => k.slice(4 + aud.value.length + 1));
  else return err(400, 'Pick who gets this alert.');
  await saveAlert(a); a.count = uids.length; await auth.kvPut('ra_' + a.id, a);
  return Object.assign({ ok: true, alert: a.id, recipients: uids.length }, await deliver(uids, a));
}

// ---- watches, preferences, inbox ----
export async function watch(uid, pid, b) {
  const p = await getProduct(pid); if (!p || !p.active) return err(404, 'Product not found.');
  const blank = b.maxPrice === '' || b.maxPrice == null;
  const w = { inStock: b.inStock !== false, release: b.release !== false, priceDrop: !!b.priceDrop, maxPrice: blank ? null : num(b.maxPrice), variant: clean(b.variant, 40), at: now() };
  if (!blank && w.maxPrice == null) return err(400, 'Maximum price must be a number.');
  if (!w.inStock && !w.release && !w.priceDrop) return err(400, 'Choose at least one alert.');
  const had = await auth.kvGet('rw_' + uid + '_' + pid); await auth.kvPut('rw_' + uid + '_' + pid, w); await auth.kvPut('rwp_' + pid + '_' + uid, { at: w.at });
  if (!had) { p.watchers = (p.watchers || 0) + 1; await auth.kvPut(KP(pid), p); } return { ok: true, watch: w };
}
export async function unwatch(uid, pid) {
  if (!(await auth.kvGet('rw_' + uid + '_' + pid))) return { ok: true };
  await auth.kvDel('rw_' + uid + '_' + pid); await auth.kvDel('rwp_' + pid + '_' + uid);
  const p = await getProduct(pid); if (p) { p.watchers = Math.max(0, (p.watchers || 0) - 1); await auth.kvPut(KP(pid), p); } return { ok: true };
}
export async function myWatches(uid) {
  const out = []; for (const k of await auth.kvList('rw_' + uid + '_')) { const w = await auth.kvGet(k); if (!w) continue; const p = await getProduct(k.slice(4 + uid.length)); if (p && p.active) out.push(Object.assign(card(p), { watch: w })); } return out;
}
export const defaultPrefs = () => ({ cats: {}, types: { release: true, restock: true, price: true }, stores: {} });
export async function getPrefs(uid) { return Object.assign(defaultPrefs(), (await auth.kvGet('rpref_' + uid)) || {}); }
export async function setPrefs(uid, b) {
  const p = await getPrefs(uid); const pick = (src, allowed) => { const o = {}; for (const k of allowed) if (typeof (src || {})[k] === 'boolean') o[k] = src[k]; return o; };
  p.cats = Object.assign({}, p.cats, pick(b.cats, CATEGORIES)); p.types = Object.assign({}, p.types, pick(b.types, TYPES)); p.stores = Object.assign({}, p.stores, pick(b.stores, Object.keys(RETAILERS)));
  if (typeof b.muted === 'boolean') p.muted = b.muted;
  await auth.kvPut('rpref_' + uid, p); return { ok: true, prefs: p };
}
export async function inbox(uid) {
  const ib = (await auth.kvGet('rin_' + uid)) || { items: [] }, g = (await auth.kvGet('rgl')) || { ids: [] }, readG = new Set(ib.readGlobal || []);
  const ids = ib.items.map(x => [x.id, x.read]).concat(g.ids.map(id => [id, readG.has(id)])); const out = [], seen = new Set();
  for (const [id, read] of ids) { if (seen.has(id)) continue; seen.add(id); const a = await auth.kvGet('ra_' + id); if (a) out.push({ id, read: !!read, title: a.title, body: a.body, url: a.url, at: a.at, kind: a.kind, category: a.category, retailer: a.retailer ? RETAILERS[a.retailer].name : '', product: a.productName || '', status: a.status || '' }); }
  out.sort((a, b) => (a.at < b.at ? 1 : -1)); return { items: out.slice(0, 100), unread: out.filter(x => !x.read).length };
}
export async function markRead(uid, ids) {
  const ib = (await auth.kvGet('rin_' + uid)) || { items: [] }, g = (await auth.kvGet('rgl')) || { ids: [] }; const all = ids === 'all', set = new Set([].concat(ids || []));
  ib.items.forEach(x => { if (all || set.has(x.id)) x.read = true; }); ib.readGlobal = [...new Set((ib.readGlobal || []).concat(g.ids.filter(id => all || set.has(id))))].slice(0, 100);
  await auth.kvPut('rin_' + uid, ib); return { ok: true };
}

// ---- requests -> owner approval queue. Nothing is monitored until approved ----
export async function request(uid, b) {
  const c = checkUrl(b.url); if (!c) return err(400, 'Paste a https link from one of the supported stores.');
  const name = clean(b.name, 160); if (!name) return err(400, 'Add the product name.'); if (!CATEGORIES.includes(b.category)) return err(400, 'Pick a category.');
  const dupe = await auth.kvGet(KU(c.url)); const q = { id: rid(6), uid, url: c.url, retailer: c.retailer, name, category: b.category, note: clean(b.note, 300), status: 'open', at: now(), existing: (dupe && dupe.id) || '' };
  await auth.kvPut('rq_' + q.id, q); return { ok: true, request: q };
}
export async function listRequests() { const out = []; for (const k of (await auth.kvList('rq_')).slice(0, 300)) { const q = await auth.kvGet(k); if (q && q.status === 'open') out.push(q); } return out.sort((a, b) => (a.at < b.at ? 1 : -1)); }
export async function decide(owner, id, b) {
  const q = await auth.kvGet('rq_' + String(id).replace(/[^a-f0-9]/g, '')); if (!q || q.status !== 'open') return err(404, 'Request not found.');
  let pid = '';
  if (b.decision === 'reject') q.status = 'rejected';
  else if (b.decision === 'merge') { const p = await getProduct(b.productId || q.existing); if (!p) return err(404, 'Pick an existing product to merge into.'); pid = p.id; q.status = 'merged'; }
  else if (b.decision === 'approve') { const r = await createProduct(owner, Object.assign({ url: q.url, name: q.name, category: q.category }, b.edit || {})); if (!r.ok) return r; pid = r.product.id; q.status = 'approved'; }
  else return err(400, 'Unknown decision.');
  q.product = pid; q.decidedAt = now(); await auth.kvPut('rq_' + q.id, q);
  if (pid) await watch(q.uid, pid, { inStock: true, release: true });   // the member who asked watches it automatically
  return { ok: true, request: q };
}

// ---- monitor: one check per product, faster near release, slower when a source keeps failing ----
export function dueIn(p) {
  if (p.fails >= 3) return 6 * 3600e3;
  if (p.status === 'upcoming' && p.releaseDate) { const ms = Date.parse(p.releaseDate) - Date.now(); if (ms > 7 * 864e5) return 12 * 3600e3; if (ms > 2 * 864e5) return 3 * 3600e3; if (ms > -864e5) return 10 * 60e3; }
  return AVAILABLE.has(p.status) ? 20 * 60e3 : 30 * 60e3;
}
export async function monitor({ limit = 25 } = {}) {
  const ps = (await listProducts()).filter(p => p.auto && !RETAILERS[p.retailer].noFetch && (!p.checkedAt || Date.now() - Date.parse(p.checkedAt) >= dueIn(p)));
  const res = { checked: 0, changed: 0, alerts: 0, failed: [] };
  for (const p of ps.slice(0, limit)) {
    const r = await lookup(p.url); res.checked++;
    if (!r.ok || !r.readable) { p.fails = (p.fails || 0) + 1; p.checkedAt = now(); p.lastError = r.note || r.error || 'unreadable'; if (AVAILABLE.has(p.status) && p.fails >= 2) { p.prevStatus = p.status; p.status = 'monitoring'; } await auth.kvPut(KP(p.id), p); if (p.fails === 3) res.failed.push({ id: p.id, name: p.name, retailer: p.retailer, error: p.lastError }); continue; }
    p.fails = 0; p.lastError = ''; const before = p.status; const sent = await applyResult(p, { status: r.info.status, price: r.info.price, reason: r.info.reason }, 'auto');
    if (p.status !== before) res.changed++; res.alerts += sent.filter(x => !x.skipped).length;
  }
  return res;
}

// ---- private pushes to the owner only ----
export async function notifyOwner(title, body, path = '/owner/retail/', key) {
  const email = FOUNDER_EMAIL(); const u = await auth.getUser(email); if (!u || !u.owner) return { ok: false, error: 'owner account not found' };
  return OS.send({ email, title: clean(title, 70), body: clean(body, 220), path, key: 'owner:' + (key || rid(8)), topic: 'owner' });
}
