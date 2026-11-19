// Run: node netlify/tests/retail-stock.test.mjs   (file-backed storage; TEST FIXTURE page text; OneSignal calls captured, never sent).
// The Best Buy fixture reproduces the text from the owner's screenshot of the Prismatic Evolutions ETB invite page.
import assert from 'node:assert/strict'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
process.env.USERS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-')); process.env.FOUNDER_EMAIL = 'founder@example.com'; process.env.ONESIGNAL_REST_API_KEY = 'os_v2_app_testkey'; process.env.SESSION_SECRET = 't';
const sent = []; globalThis.fetch = async (u, o) => { if (String(u).includes('onesignal.com')) { sent.push(JSON.parse(o.body)); return new Response(JSON.stringify({ id: 'n' + sent.length }), { status: 200 }); } throw new Error('no network in tests'); };
const auth = await import('../lib/auth.mjs'); const R = await import('../lib/retail.mjs'); const C = await import('../lib/community.mjs');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok -', m); };

const LD = (avail) => `<script type="application/ld+json">{"@type":"Product","name":"Pokémon Prismatic Evolutions Elite Trainer Box (TEST FIXTURE)","image":"https://example.com/x.jpg","offers":{"@type":"Offer","price":"54.99","availability":"${avail}"}}</script>`;
const BESTBUY_INVITE = `<html><head>${LD('https://schema.org/InStock')}</head><body>
<h1>Pokémon Prismatic Evolutions Elite Trainer Box</h1><div class="price">$54.99</div>
<section><h2>Exclusive sales event</h2>
<p>You’ve requested an invite</p>
<p>If you’re selected to participate in this event, you’ll receive an invitation with event details.</p>
<button class="btn-primary" disabled>You’ve requested an invite</button></section></body></html>`;
const NORMAL_BUY = `<html><head>${LD('https://schema.org/InStock')}</head><body><h1>Sample item</h1><div>$54.99</div><button class="add-to-cart-button">Add to Cart</button></body></html>`;
const PRICE_ONLY = `<html><head>${LD('https://schema.org/InStock')}</head><body><h1>Sample item</h1><div>$54.99</div></body></html>`;
const DISABLED_CART = `<html><head>${LD('https://schema.org/InStock')}</head><body><button class="add" disabled>Add to Cart</button></body></html>`;
const SOLD = `<html><head>${LD('https://schema.org/OutOfStock')}</head><body><div>Sold out</div><button disabled>Add to Cart</button></body></html>`;
const SHIP_UNAVAIL = `<html><body><div>Unavailable for shipping</div><button>Ship It</button></body></html>`;
const WAITLIST = `<html><body><h2>Join the waitlist</h2><button>Join waitlist</button></body></html>`;
const PREORDER = `<html><body><button>Pre-order now</button><div>$129.99</div></body></html>`;
const COMING = `<html><body><h2>Coming soon</h2><div>$40.00</div></body></html>`;
const LOTTERY = `<html><body><h2>Lottery entry</h2><p>Enter the lottery for a chance to buy.</p><button>Enter</button></body></html>`;
const WAITING = `<html><body><p>You are in line. Waiting room.</p><button>Add to Cart</button></body></html>`;

const cls = (html, retailer = 'bestbuy') => { const p = R.parseHtml(html); return R.classifyStock({ html, schemaAvail: p.schemaAvail || '', retailer, price: p.price ?? null }); };

// 1. The Best Buy invite page from the screenshot
const bb = cls(BESTBUY_INVITE);
ok(bb.status === 'invite_only', 'Best Buy invite page -> INVITE_ONLY (not IN_STOCK), even with price and InStock data');
ok(bb.reason === 'Best Buy Exclusive sales event — invitation required', 'reason reads: "Best Buy Exclusive sales event — invitation required"');
ok(bb.matched.includes('Invite requested') && bb.matched.includes('Invitation required'), 'every matched phrase is recorded');
ok(cls(BESTBUY_INVITE.replace('disabled>', '>')).status === 'invite_only', 'invite stays INVITE_ONLY even if the request button is enabled');
// 2. price alone never means in stock
ok(cls(PRICE_ONLY).status === 'unknown' && /price alone/.test(cls(PRICE_ONLY).reason), 'price + InStock data but no buy button -> UNKNOWN (price alone does not mean in stock)');
ok(cls(PRICE_ONLY, 'target').status === 'unknown', 'same rule for every store');
// 3. real purchase capability
ok(cls(NORMAL_BUY, 'target').status === 'in_stock' && /enabled "Add to Cart"/.test(cls(NORMAL_BUY, 'target').reason), 'enabled Add to Cart -> IN_STOCK, reason names the button');
ok(cls(SHIP_UNAVAIL, 'walmart').status === 'out_of_stock', 'unavailable for shipping -> OUT_OF_STOCK even with a Ship It button');
ok(cls(DISABLED_CART, 'target').status === 'out_of_stock' && /disabled/.test(cls(DISABLED_CART, 'target').reason), 'disabled Add to Cart is not in stock');
ok(cls(SOLD, 'target').status === 'out_of_stock', 'sold out -> OUT_OF_STOCK');
ok(cls(WAITLIST, 'target').status === 'waitlist', 'waitlist -> WAITLIST');
ok(cls(PREORDER, 'target').status === 'preorder', 'enabled Pre-order -> PREORDER');
ok(cls(COMING, 'target').status === 'coming_soon', 'coming soon -> COMING_SOON');
ok(cls(LOTTERY, 'target').status === 'invite_only', 'lottery -> INVITE_ONLY');
ok(cls(WAITING, 'target').status === 'limited_access', 'waiting room beats an enabled button -> LIMITED_ACCESS');
ok(cls('<html><body>nothing here</body></html>', 'target').status === 'unknown', 'no evidence -> UNKNOWN');
// 4. the page reader carries the state through
const url = 'https://www.bestbuy.com/site/pokemon-prismatic-evolutions-etb/6000000.p?skuId=6000000';
R._setFetch(async () => new Response(BESTBUY_INVITE, { status: 200 }));
const lk = await R.lookup(url); ok(lk.info.status === 'invite_only' && lk.readable && /invitation required/.test(lk.info.reason), 'lookup returns INVITE_ONLY with the reason, and counts as a readable state');
R._setFetch(async () => new Response(PRICE_ONLY, { status: 200 }));
const lk2 = await R.lookup(url); ok(lk2.info.status === 'unknown' && lk2.readable === false, 'lookup on a price-only page is UNKNOWN and not auto-checked');
// 5. product + transitions: alerts only on real availability
const u = await auth.createUser('watcher@example.com', 'password123', false); u.push = { enabled: true, subscribed: true }; u.paidThrough = '2999-01-01'; await auth.saveUser(u);
const w = await C.ensureProfile(await auth.getUser('watcher@example.com'));
const prod = (await R.createProduct('founder', { url, name: 'Sample Prismatic ETB (TEST FIXTURE)', category: 'pokemon', status: 'invite_only', auto: true })).product;
await R.watch(w.uid, prod.id, { inStock: true, release: true, priceDrop: false });
const before = sent.length;
let r = await R.applyResult(await R.getProduct(prod.id), { status: 'invite_only', reason: lk.info.reason, price: 54.99 }, 'auto');
ok(r.length === 0 && sent.length === before, 'entering INVITE_ONLY sends NO restock alert');
ok((await R.getProduct(prod.id)).statusReason === 'Best Buy Exclusive sales event — invitation required', 'the reason is stored with the product');
r = await R.applyResult(await R.getProduct(prod.id), { status: 'in_stock', reason: 'Best Buy enabled "Add to Cart" button found', price: 54.99 }, 'auto');
ok(r.some(x => x.kind === 'restock' && x.recipients === 1), 'INVITE_ONLY -> IN_STOCK alerts the watcher');
ok(sent.some(p => /Invite Live/.test(p.headings.en)), 'the alert says "🎟️ Invite Live" (not a plain restock)');
const n1 = sent.length;
r = await R.applyResult(await R.getProduct(prod.id), { status: 'in_stock', price: 54.99 }, 'auto');
ok(sent.length === n1 && r.length === 0, 'IN_STOCK -> IN_STOCK sends nothing');
r = await R.applyResult(await R.getProduct(prod.id), { status: 'invite_only', price: 54.99 }, 'auto');
ok(r.length === 0 && sent.length === n1, 'IN_STOCK -> INVITE_ONLY sends nothing');
// 6. only real availability is shown as in stock in the feed
const pr2 = await R.getProduct(prod.id); pr2.status = 'in_stock'; pr2.confirmedAt = '2020-01-01T00:00:00Z'; await auth.kvPut('rp_' + prod.id, pr2);
ok(R.card(pr2).status !== 'in_stock', 'an old in-stock result is not shown as in stock');
ok(R.STOCK_LABEL.invite_only === 'Invite Only' && R.STOCK_LABEL.in_stock === 'IN STOCK', 'labels: Invite Only / IN STOCK');
ok(R.STATUSES.every(s => ['upcoming','monitoring','in_stock','low_stock','sold_out','disabled','out_of_stock','invite_only','preorder','coming_soon','waitlist','limited_access','unknown'].includes(s)), 'all eight stock states are valid');
// 7. Regression: the live Best Buy page keeps its invite state in page data (script JSON), not visible text.
const LIVE_DATA = `<html><head>${LD('https://schema.org/InStock')}</head><body><button>Add to Cart</button><script>window.__DATA={\"header\":\"Exclusive sales event\",\"registeredEventTitle\":\"You've requested an invite\",\"registeredEventMessage\":\"If you’re selected to participate in this event, you’ll receive an invitation with event details.\"}</script></body></html>`;
ok(cls(LIVE_DATA).status === 'invite_only' && /Exclusive sales event/.test(cls(LIVE_DATA).reason), 'invite state inside page data wins over an enabled Add to Cart (live Best Buy case)');
const REVIEW = `<html><body><script>{"reviewBody":"A winning lottery ticket would have been nice."}</script><button>Add to Cart</button><div>$49.99</div></body></html>`;
ok(cls(REVIEW).status === 'in_stock', 'a customer review mentioning a lottery does not block a real Add to Cart');
// 8. Queue / line opening: "Get in line" push once, to watchers
const qp = (await R.createProduct('founder', { url: 'https://www.pokemoncenter.com/queue-monitor-test', name: 'Pokémon Center Queue Monitor (TEST FIXTURE)', category: 'pokemon', status: 'monitoring' })).product;
await R.watch(w.uid, qp.id, { inStock: true });
const q0 = sent.length;
r = await R.applyResult(await R.getProduct(qp.id), { status: 'limited_access', reason: 'Pokémon Center waiting room or queue' }, 'owner');
ok(r.some(x => x.kind === 'queue' && x.recipients === 1) && sent.length === q0 + 1 && /Get in line/.test(sent[sent.length - 1].headings.en), 'line opens -> watcher gets a "🚦 Get in line" push');
ok(sent[sent.length - 1].url === 'https://www.pokemoncenter.com/queue-monitor-test', 'tapping it opens the exact store page');
const q1 = sent.length;
r = await R.applyResult(await R.getProduct(qp.id), { status: 'limited_access' }, 'auto'); ok(sent.length === q1, 'line still open -> no repeat push');
r = await R.applyResult(await R.getProduct(qp.id), { status: 'monitoring' }, 'auto'); ok(sent.length === q1, 'line closing sends nothing');
// 9. Product images
const fsIm = await import('node:fs');
const bbHtml = fsIm.existsSync('/tmp/bb.html') ? fsIm.readFileSync('/tmp/bb.html', 'utf8') : null;
ok(R.parseHtml('<meta name="twitter:image" content="https://cdn.example.com/a.jpg">').image === 'https://cdn.example.com/a.jpg', 'twitter:image is used when og:image is missing');
ok(R.parseHtml('<meta property="og:image" content="https://cdn.example.com/og.jpg"><meta name="twitter:image" content="https://cdn.example.com/tw.jpg">').image === 'https://cdn.example.com/og.jpg', 'og:image comes before twitter:image');
ok(R.parseHtml('<img imageSrcSet="https://img.example.com/p.jpg;maxHeight=1080?format=webp 1x">').image === 'https://img.example.com/p.jpg;maxHeight=1080?format=webp', 'product image set is used when no meta tags exist');
ok(R.parseHtml('<meta property="og:image" content="http://insecure.example.com/x.jpg">').image === undefined, 'non-https images are refused');
if (bbHtml) ok(R.parseHtml(bbHtml).image === 'https://pisces.bbystatic.com/image2/BestBuy_US/images/products/0a7fbcb9-cd3a-401d-8c6e-6f1facfe7c1a.jpg;maxHeight=1080;maxWidth=900?format=webp', 'the saved Best Buy page yields the real Prismatic ETB product image');
{ const ip = (await R.createProduct('founder', { url: 'https://www.target.com/p/img-test-1', name: 'Image test (TEST FIXTURE)', category: 'pokemon', status: 'in_stock' })).product;
  R._setFetch(async () => new Response('<meta property="og:image" content="https://cdn.example.com/found.jpg"><button>Add to Cart</button>', { status: 200 }));
  const st0 = (await R.getProduct(ip.id)).status; const r1 = await R.refreshImage(ip.id);
  ok(r1.found && r1.product.image === 'https://cdn.example.com/found.jpg' && r1.product.status === st0, 'refresh image saves the page image and does not change the stock status');
  R._setFetch(async () => new Response('<html>no picture here</html>', { status: 200 }));
  const r2 = await R.refreshImage(ip.id);
  ok(!r2.found && r2.product.imageNote === 'Image not found' && r2.product.image === 'https://cdn.example.com/found.jpg', 'no image on the page -> "Image not found" flag; the saved image is not wiped by a failed read');
  ok(R.card(r2.product).imageNote === '' && R.card({ ...r2.product, image: '' }).imageNote === 'Image not found', 'cards show the flag only when there is no image');
  R._setFetch(async () => new Response('', { status: 503 })); }
// 10. Amazon links: short links resolve by redirect only, one product per ASIN, affiliate kept separately
const hops = {
  'https://a.co/d/abc123': { status: 301, location: 'https://www.amazon.com/Sample-Item/dp/B0ABCDE123/ref=sr_1?tag=ppa-20&keywords=x' },
  'https://amzn.to/xyz789': { status: 302, location: 'https://www.amazon.com/gp/product/B0ABCDE123?psc=1' },
  'https://link.amazon/q1': { status: 301, location: 'https://www.amazon.co.uk/dp/B0ZZZZZZZZ' },
  'https://a.co/loop': { status: 301, location: 'https://evil.example.com/steal' },
};
const calls = []; R._setFetch(async (u, o) => { calls.push(String(u)); const h = hops[String(u)]; if (h) return new Response(null, { status: h.status, headers: { location: h.location } }); return new Response('<html>page</html>', { status: 200 }); });
const a1 = await R.createProduct('founder', { url: 'https://a.co/d/abc123', name: 'Sample Amazon item (TEST FIXTURE)', category: 'electronics', affiliateUrl: 'https://a.co/d/abc123' });
ok(a1.ok && a1.product.url === 'https://www.amazon.com/dp/B0ABCDE123' && a1.product.asin === 'B0ABCDE123', 'a.co link resolves to the canonical Amazon product URL and saves the ASIN');
ok(a1.product.affiliateUrl === 'https://a.co/d/abc123' && R.card(a1.product).buyUrl === 'https://a.co/d/abc123', 'the affiliate link is kept separately and the Buy button uses it');
ok(a1.product.url === 'https://www.amazon.com/dp/B0ABCDE123' && R.card(a1.product).url === 'https://www.amazon.com/dp/B0ABCDE123', 'monitoring uses the canonical link, not the affiliate link');
ok(calls.length === 1 && calls[0] === 'https://a.co/d/abc123', 'only the short link itself is requested: the product page is never read');
const a2 = await R.createProduct('founder', { url: 'https://amzn.to/xyz789', name: 'Same item (TEST FIXTURE)', category: 'electronics' });
ok(a2.status === 409 && a2.id === a1.product.id, 'a different Amazon link to the same ASIN is not a second product (dedupe by ASIN)');
const a3 = await R.createProduct('founder', { url: 'https://www.amazon.com/Item/dp/B0ABCDE123?tag=zz-20', name: 'Same item again', category: 'electronics' });
ok(a3.status === 409 && a3.id === a1.product.id, 'a full Amazon link with a tag to the same ASIN is also deduplicated');
const a4 = await R.createProduct('founder', { url: 'https://link.amazon/q1', name: 'UK item', category: 'electronics' });
ok(!a4.ok && /Amazon\.com/.test(a4.error), 'an Amazon link that leads to amazon.co.uk is refused with a clear message');
const a5 = await R.createProduct('founder', { url: 'https://a.co/loop', name: 'Bad redirect', category: 'electronics' });
ok(!a5.ok && /does not lead to Amazon/.test(a5.error), 'a short link that redirects off Amazon is refused');
ok(R.checkUrl('https://a.co/d/abc123').retailer === 'amazon' && R.checkUrl('https://amzn.to/x').short === true && R.checkUrl('https://evil.com/a.co') === null, 'short links are accepted as Amazon; look-alike domains are not');
ok(R.safeAffiliate('https://evil.example.com/?tag=x') === '' && R.safeAffiliate('http://www.amazon.com/dp/B0ABCDE123') === '', 'affiliate field only accepts https Amazon links');
console.log('# pass ' + pass);
