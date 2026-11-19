// Run: node netlify/tests/retail.test.mjs   (file-backed storage; TEST FIXTURE accounts and products; OneSignal calls are captured, never sent).
import assert from 'node:assert/strict'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
process.env.USERS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'retail-')); process.env.FOUNDER_EMAIL = 'founder@example.com'; process.env.ONESIGNAL_REST_API_KEY = 'os_v2_app_testkey'; process.env.SESSION_SECRET = 't';
const sent = []; const realFetch = globalThis.fetch;
globalThis.fetch = async (url, o) => { if (String(url).includes('onesignal.com')) { const p = JSON.parse(o.body); sent.push(p); return new Response(JSON.stringify({ id: 'n' + sent.length }), { status: 200 }); } return realFetch(url, o); };
const auth = await import('../lib/auth.mjs'); const R = await import('../lib/retail.mjs'); const api = (await import('../functions/retail.mjs')).default; const OSL = await import('../lib/onesignal.mjs');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok -', m); };
const mk = async (e, patch) => { const u = await auth.createUser(e, 'password123', false); Object.assign(u, patch || {}); await auth.saveUser(u); return (await auth.sessionCookie(e)).split(';')[0]; };
const F = await mk('founder@example.com', { owner: true }), P = await mk('pat@example.com', { paidThrough: '2999-01-01', push: { enabled: true, subscribed: true } }), Q = await mk('quinn@example.com', { paidThrough: '2999-01-01', push: { enabled: true, subscribed: true } }), A = await mk('ann@example.com', { push: { enabled: true, subscribed: true } }), Z = await mk('zed@example.com', { paidThrough: '2999-01-01' });
let n = 0; const call = async (c, o) => { const post = !!o.action; const r = await api(new Request('http://x/r' + (post ? '' : '?' + new URLSearchParams(o)), { method: post ? 'POST' : 'GET', body: post ? JSON.stringify(o) : undefined, headers: { cookie: c || '' } }), {}); n++; return { s: r.status, j: await r.json() }; };
const toWho = p => (p.include_aliases || {}).external_id || p.included_segments;
const ext = e => OSL.externalId(e);
ok((await call('', { feed: 1 })).s === 401, 'retail needs sign-in');
// URL safety
ok(!R.checkUrl('http://www.target.com/p/x') && !R.checkUrl('https://evil.com/target.com') && !R.checkUrl('https://target.com.evil.com/x') && !R.checkUrl('javascript:alert(1)'), 'only https links on supported stores are accepted');
ok(R.checkUrl('https://www.target.com/p/x?utm_source=a&preselect=1').url === 'https://www.target.com/p/x?preselect=1', 'tracking parameters removed');
ok(OSL.retailLink('https://evil.com/') === '' && OSL.retailLink('https://www.nike.com/t/x') !== '', 'push destinations re-checked against the store list');
// owner-only
let r = await call(P, { action: 'create', url: 'https://www.target.com/p/x', name: 'x', category: 'pokemon' }); ok(r.s === 403, 'members cannot add products');
r = await call(P, { action: 'broadcast', title: 't', message: 'm', audience: { type: 'everyone' }, confirmEveryone: true }); ok(r.s === 403, 'members cannot broadcast');
ok((await call(P, { admin: 1 })).s === 403, 'members cannot open the owner dashboard');
// create
r = await call(F, { action: 'create', url: 'https://www.target.com/p/prismatic-etb/-/A-1?utm_source=x', name: 'Sample Prismatic Evolutions ETB (TEST FIXTURE)', category: 'pokemon', status: 'sold_out', price: '54.99' });
ok(r.s === 200 && r.j.product.price === 54.99 && r.j.product.status === 'sold_out', 'owner adds a product by link');
const pid = r.j.product.id;
r = await call(F, { action: 'create', url: 'https://www.target.com/p/prismatic-etb/-/A-1', name: 'dup', category: 'pokemon' }); ok(r.s === 409 && r.j.id === pid, 'the same link is never added twice');
r = await call(F, { action: 'create', url: 'https://www.nike.com/launch/t/sample-jordan', name: 'Sample Air Jordan (TEST FIXTURE)', category: 'sneakers', status: 'upcoming', releaseDate: '2026-12-05T10:00' }); const jid = r.j.product.id; ok(r.s === 200, 'owner adds an upcoming drop');
// watching is paid
r = await call(A, { action: 'watch', id: pid }); ok(r.s === 402, 'free members cannot watch (server refuses)');
ok((await call(A, { feed: 1 })).s === 200, 'free members can browse the feed');
r = await call(P, { action: 'watch', id: pid, inStock: true, release: true, maxPrice: '60' }); ok(r.s === 200 && r.j.watch.maxPrice === 60, 'paid member watches with max price $60');
r = await call(Q, { action: 'watch', id: pid, inStock: true, maxPrice: '50' }); ok(r.s === 200, 'second member watches with max price $50');
r = await call(Z, { action: 'watch', id: pid, inStock: true }); ok(r.s === 200, 'third watcher has push turned off');
r = await call(P, { action: 'watch', id: jid, release: true, inStock: false }); ok(r.s === 200, 'watch the upcoming drop for release');
// preferences: ann (free) follows Pokémon restocks at Target only
r = await call(A, { action: 'prefs', cats: { pokemon: true, hacked: true }, stores: { target: true } }); ok(r.s === 200 && r.j.prefs.cats.pokemon && !('hacked' in r.j.prefs.cats), 'preferences saved; unknown keys ignored');
// SOLD OUT -> IN STOCK
sent.length = 0;
r = await call(F, { action: 'update', id: pid, status: 'in_stock' }); const s1 = r.j.sent[0];
ok(s1.kind === 'restock' && s1.recipients === 3 && s1.inbox === 3, 'restock reaches matching watchers + preference match; over-max-price watcher excluded');
ok(sent.length === 2, 'pushes only to members with notifications on and matching max price (pat $60 ok, quinn $50 skipped, zed push off)');
ok(sent.some(p => toWho(p)[0] === ext('pat@example.com')) && sent.some(p => toWho(p)[0] === ext('ann@example.com')) && !sent.some(p => toWho(p)[0] === ext('quinn@example.com')), 'routing by OneSignal External ID; $54.99 > $50 skipped');
ok(sent.every(p => p.url === 'https://www.target.com/p/prismatic-etb/-/A-1'), 'tapping opens the exact store page');
ok(/Pokémon Restock/.test(sent[0].headings.en) && /\$54\.99/.test(sent[0].contents.en), 'push text: "🔥 Pokémon Restock … $54.99 … Tap to buy"');
// IN STOCK -> IN STOCK: nothing
sent.length = 0; r = await call(F, { action: 'update', id: pid, status: 'in_stock' }); ok(sent.length === 0, 'IN STOCK -> IN STOCK sends nothing');
// IN STOCK -> SOLD OUT -> IN STOCK within cooldown: no spam
await call(F, { action: 'update', id: pid, status: 'sold_out' }); r = await call(F, { action: 'update', id: pid, status: 'in_stock' }); ok(sent.length === 0 && r.j.sent[0].skipped === 'cooldown', 'restock again within the cooldown is held back');
// after cooldown -> allowed again
const pr = await R.getProduct(pid); pr.lastAlert.restock = '2020-01-01T00:00:00Z'; await auth.kvPut('rp_' + pid, pr);
await call(F, { action: 'update', id: pid, status: 'sold_out' }); await call(F, { action: 'update', id: pid, status: 'in_stock' }); ok(sent.length === 2, 'SOLD OUT -> IN STOCK after the cooldown alerts again');
// dedupe via key: same alert never twice to the same member
ok((await auth.kvGet('pushlog_' + (await import('node:crypto')).createHash('sha256').update('pat@example.com').digest('hex').slice(0, 32))).keys.filter(k => k.startsWith('retail:')).length === 2, 'each alert logged once per member');
// price drop while in stock
sent.length = 0; r = await call(F, { action: 'update', id: pid, price: '49.99' }); ok(r.j.sent.some(x => x.kind === 'price'), 'price drop detected');
// no invented prices: product without price + max price watcher -> skipped
const r2 = await call(F, { action: 'create', url: 'https://www.walmart.com/ip/123', name: 'Sample console (TEST FIXTURE)', category: 'gaming', status: 'sold_out' }); const wid = r2.j.product.id;
await call(P, { action: 'watch', id: wid, inStock: true, maxPrice: '400' }); sent.length = 0; r = await call(F, { action: 'update', id: wid, status: 'in_stock' }); ok(r.j.sent[0].recipients === 0 && sent.length === 0, 'unknown price: max-price alert not sent (never invents a price)');
// release
sent.length = 0; r = await call(F, { action: 'update', id: jid, status: 'in_stock' }); ok(r.j.sent[0].kind === 'release' && /Release Live/.test(sent[0].headings.en) && sent[0].url.startsWith('https://www.nike.com/'), 'UPCOMING -> IN STOCK sends the release alert to the Nike page');
// feed freshness
let fd = (await call(A, { feed: 1 })).j; ok(fd.inStock.some(p => p.id === pid), 'in stock product shows in In Stock Now');
const st = await R.getProduct(wid); st.confirmedAt = '2020-01-01T00:00:00Z'; await auth.kvPut('rp_' + wid, st); fd = (await call(A, { feed: 1 })).j; ok(!fd.inStock.some(p => p.id === wid), 'stale "in stock" never shown as in stock');
// inbox
let ib = (await call(P, { inbox: 1 })).j; ok(ib.items.length >= 3 && ib.unread >= 3 && ib.items[0].retailer, 'alerts center lists alerts with unread status');
await call(P, { action: 'read', ids: 'all' }); ok((await call(P, { inbox: 1 })).j.unread === 0, 'mark all read');
// requests
r = await call(A, { action: 'request', url: 'https://www.gamestop.com/x', name: 'n', category: 'gaming' }); ok(r.s === 402, 'free members cannot request');
r = await call(P, { action: 'request', url: 'https://sketchy.example/x', name: 'n', category: 'gaming' }); ok(r.s === 400, 'requests only for supported stores');
sent.length = 0; r = await call(P, { action: 'request', url: 'https://www.gamestop.com/sample-item', name: 'Sample GameStop item (TEST FIXTURE)', category: 'collectibles', note: 'please' }); ok(r.s === 200, 'paid member requests a product');
await new Promise(res => setTimeout(res, 50)); ok(sent.length === 1 && toWho(sent[0])[0] === ext('founder@example.com'), 'owner gets a private push about the request (only the owner)');
let ad = (await call(F, { admin: 1 })).j; ok(ad.requests.length === 1 && !ad.products.some(p => p.url.includes('gamestop')), 'request waits in the queue, not monitored');
r = await call(F, { action: 'decide', id: ad.requests[0].id, decision: 'approve', edit: { name: 'Sample GameStop item edited (TEST FIXTURE)' } }); ok(r.s === 200 && (await call(F, { admin: 1 })).j.products.some(p => p.name.includes('edited')), 'owner approves with edits; added to catalog');
ok((await call(P, { mine: 1 })).j.watches.some(w => w.name.includes('edited')), 'requester automatically watches the approved product');
r = await call(P, { action: 'request', url: 'https://www.target.com/p/prismatic-etb/-/A-1', name: 'dupe', category: 'pokemon' }); ad = (await call(F, { admin: 1 })).j;
r = await call(F, { action: 'decide', id: ad.requests[0].id, decision: 'merge' }); ok(r.s === 200 && r.j.request.product === pid, 'duplicate request merges into the existing product');
// broadcasts
sent.length = 0; r = await call(F, { action: 'broadcast', title: 'Hi', message: 'Test', audience: { type: 'everyone' } }); ok(r.s === 400, 'Send to Everyone needs confirmation');
r = await call(F, { action: 'broadcast', title: 'Big news', message: 'Sample broadcast (TEST FIXTURE)', audience: { type: 'everyone' }, confirmEveryone: true }); ok(r.s === 200 && sent.length === 1 && sent[0].included_segments[0] === 'Total Subscriptions', 'Send to Everyone: one OneSignal call to all subscribers');
ok((await call(Z, { inbox: 1 })).j.items.some(x => x.title === 'Big news'), 'everyone broadcast shows in every alerts center');
sent.length = 0; r = await call(F, { action: 'broadcast', title: 'Poke', message: 'Sample (TEST FIXTURE)', url: 'https://www.pokemoncenter.com/x', audience: { type: 'category', value: 'pokemon' } }); ok(r.j.recipients === 1 && sent.length === 1 && toWho(sent[0])[0] === ext('ann@example.com'), 'category broadcast reaches only members who chose Pokémon');
r = await call(F, { action: 'broadcast', title: 'x', message: 'y', url: 'https://evil.com/', audience: { type: 'category', value: 'pokemon' } }); ok(r.s === 400, 'broadcast links must be a supported store or our site (no open redirect)');
r = await call(F, { action: 'broadcast', title: 'x', message: 'y', url: '//evil.com', audience: { type: 'category', value: 'pokemon' } }); ok(r.s === 400, 'protocol-relative link refused');
// monitor: one fetch per product no matter how many watchers
let fetches = 0; R._setFetch(async () => { fetches++; return new Response('<script type="application/ld+json">{"@type":"Product","name":"X","offers":{"@type":"Offer","price":"44.00","availability":"https://schema.org/InStock"}}</script><button class="add">Add to Cart</button>', { status: 200 }); });
const g = await R.getProduct(wid); g.auto = true; g.status = 'sold_out'; g.checkedAt = ''; g.lastAlert = {}; await auth.kvPut('rp_' + wid, g);
for (const c of [Q, Z, F]) await call(c === F ? P : c, { action: 'watch', id: wid, inStock: true });
let m = await R.monitor(); ok(fetches === 1 && m.checked === 1 && m.changed === 1, 'monitor: one check for a product with many watchers');
m = await R.monitor(); ok(fetches === 1, 'not checked again before it is due (cached result reused)');
ok(R.dueIn({ status: 'upcoming', releaseDate: new Date(Date.now() + 30 * 864e5).toISOString() }) > R.dueIn({ status: 'upcoming', releaseDate: new Date(Date.now() + 3600e3).toISOString() }), 'checks speed up near release');
R._setFetch(async () => new Response('blocked', { status: 403 })); const g2 = await R.getProduct(wid); g2.checkedAt = ''; await auth.kvPut('rp_' + wid, g2);
for (let i = 0; i < 3; i++) { const x = await R.getProduct(wid); x.checkedAt = ''; await auth.kvPut('rp_' + wid, x); m = await R.monitor(); }
ok(m.failed.length === 1 && (await R.getProduct(wid)).status === 'monitoring', 'blocked source: after repeated failures it stops claiming in stock and the owner is told');
const lk = await R.lookup('https://www.amazon.com/dp/B000'); ok(lk.ok && !lk.readable && /does not allow/.test(lk.note), 'Amazon is owner-confirmed only (no automated checks)');
console.log('# pass ' + pass);
