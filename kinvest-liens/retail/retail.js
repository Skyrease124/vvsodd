/* Retail Alerts pages. Everything shown comes from /.netlify/functions/retail; permissions are enforced on the server. */
(function () {
  'use strict';
  const API = '/.netlify/functions/retail', $ = id => document.getElementById(id);
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const get = async q => { try { const r = await fetch(API + '?' + new URLSearchParams(q), { credentials: 'same-origin' }); return { s: r.status, j: await r.json().catch(() => ({})) }; } catch (e) { return { s: 0, j: { error: 'Could not reach PricePocketAsset.' } }; } };
  const post = async o => { try { const r = await fetch(API, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) }); return { s: r.status, j: await r.json().catch(() => ({})) }; } catch (e) { return { s: 0, j: { error: 'Could not reach PricePocketAsset.' } }; } };
  const STATUS = { in_stock: 'IN STOCK', low_stock: 'LOW STOCK', sold_out: 'OUT OF STOCK', out_of_stock: 'OUT OF STOCK', invite_only: 'Invite Only', preorder: 'Preorder', coming_soon: 'Coming Soon', waitlist: 'Waitlist', limited_access: 'Limited Access', unknown: 'Unknown', upcoming: 'UPCOMING', monitoring: 'MONITORING', disabled: 'DISABLED' };
  const STOCK_OPTS = [['upcoming', 'Upcoming'], ['monitoring', 'Monitoring'], ['in_stock', 'In stock'], ['low_stock', 'Low stock'], ['out_of_stock', 'Out of stock'], ['invite_only', 'Invite only'], ['preorder', 'Preorder'], ['coming_soon', 'Coming soon'], ['waitlist', 'Waitlist'], ['limited_access', 'Limited access (queue open)'], ['unknown', 'Unknown']];
  const ICON = { pokemon: '🔥', sneakers: '👟', electronics: '⚡', gaming: '🎮', collectibles: '⭐' };
  const money = n => n == null ? '' : '$' + Number(n).toFixed(2);
  const ago = iso => { if (!iso) return ''; const s = (Date.now() - Date.parse(iso)) / 1000; if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago'; if (s < 86400) return Math.floor(s / 3600) + ' h ago'; return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
  const when = d => { if (!d) return ''; const t = new Date(d.length === 10 ? d + 'T12:00' : d); return isNaN(t) ? d : t.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: d.length > 10 ? 'numeric' : undefined, minute: d.length > 10 ? '2-digit' : undefined }); };
  const safeHref = u => /^https:\/\//.test(u || '') ? u : (/^\/(?!\/)/.test(u || '') ? u : '');

  function sheet(build) {
    return new Promise(res => {
      const ov = mk('div', 'rt-ov'), sh = mk('div', 'rt-sheet'); sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true');
      const close = v => { ov.classList.remove('on'); setTimeout(() => ov.remove(), 220); res(v); };
      ov.onclick = e => { if (e.target === ov) close(null); }; document.addEventListener('keydown', function k(e) { if (e.key === 'Escape') { document.removeEventListener('keydown', k); close(null); } });
      build(sh, close); ov.append(sh); document.body.append(ov); requestAnimationFrame(() => ov.classList.add('on'));
    });
  }
  const confirmSheet = (title, text, yes, danger) => sheet((sh, close) => { sh.append(mk('h3', '', title), mk('p', 'rt-muted', text)); const r = mk('div', 'rt-row'), n = mk('button', 'rt-btn', 'Cancel'), y = mk('button', 'rt-btn ' + (danger ? 'danger' : 'gold'), yes); n.type = y.type = 'button'; n.onclick = () => close(false); y.onclick = () => close(true); r.append(n, y); sh.append(r); });
  const field = (label, el) => { const l = mk('label', '', label); l.append(el); return l; };
  const input = (v, ph, type) => { const i = mk('input'); i.type = type || 'text'; if (v != null) i.value = v; if (ph) i.placeholder = ph; return i; };
  const select = (opts, v) => { const s = mk('select'); opts.forEach(([k, l]) => { const o = mk('option', '', l); o.value = k; s.append(o); }); if (v != null) s.value = v; return s; };
  const toggle = (title, sub, on) => { const d = mk('div', 'rt-tog'), t = mk('div'); t.append(mk('b', '', title)); if (sub) t.append(mk('div', 'rt-muted rt-small', sub)); const w = mk('label', 'rt-sw'), i = mk('input'); i.type = 'checkbox'; i.checked = !!on; i.setAttribute('aria-label', title); w.append(i, mk('i')); d.append(t, w); return [d, i]; };

  // A clean PricePocket text card, used when there is no usable product image. Never a blank black box.
  function fallbackFace(p) { const f = mk('div', 'rt-fb'); f.append(mk('div', 'rt-fb-s', (ICON[p.category] || '') + ' ' + (p.retailerName || p.retailer || '')), mk('div', 'rt-fb-n', p.name || 'Product'), mk('div', 'rt-fb-p', 'PRICEPOCKET')); return f; }
  // Puts the product photo into a box (lazy, cropped with object-fit). Falls back to the text card if it is missing or fails to load.
  function imageInto(box, p, cls) {
    if (!p.image) { box.classList.add('none'); box.append(fallbackFace(p)); return; }
    const i = mk('img'); i.alt = p.name || ''; i.loading = 'lazy'; i.decoding = 'async'; i.referrerPolicy = 'no-referrer'; if (cls) i.className = cls;
    i.onerror = () => { i.remove(); box.classList.add('none'); box.append(fallbackFace(p)); };
    i.src = p.image; box.append(i);
  }
  function productCard(p, ctx) {
    const c = mk('article', 'rt-card'), im = mk('div', 'rt-img');
    imageInto(im, p, 'rt-card-img');
    im.append(mk('span', 'rt-pill ' + p.status, STATUS[p.status] || p.status)); c.append(im);
    const b = mk('div', 'rt-body'); b.append(mk('div', 'rt-store', p.retailerName + (ctx.cats[p.category] ? ' · ' + ctx.cats[p.category] : '')), mk('div', 'rt-name', p.name));
    if (p.price != null) { const pr = mk('div', 'rt-price', money(p.price)); if (p.prevPrice != null && p.prevPrice > p.price) pr.append(mk('s', '', money(p.prevPrice))); b.append(pr); }
    if (p.variant) b.append(mk('div', 'rt-meta', 'Variant: ' + p.variant));
    if (p.status === 'upcoming' && p.releaseDate) b.append(mk('div', 'rt-meta', '📅 Expected ' + when(p.releaseDate) + ' (verify with the store)'));
    b.append(mk('div', 'rt-meta', (p.auto ? 'Checked ' : 'Updated ') + ago(p.checkedAt) + (p.watchers ? ' · ' + p.watchers + ' watching' : '')));
    const row = mk('div', 'rt-row'), w = mk('button', 'rt-btn' + (ctx.watched.has(p.id) ? ' on' : ''), ctx.watched.has(p.id) ? '✓ Watching' : (p.status === 'upcoming' ? 'Watch This' : 'Alert Me')); w.type = 'button';
    w.onclick = () => watchSheet(p, ctx).then(ch => { if (ch) ctx.reload(); });
    row.append(w);
    // Every card has a button that opens the exact store page. Only a verified in-stock product says "Buy Now".
    { const act = { in_stock: ['Buy Now', 'buy'], low_stock: ['Buy Now', 'buy'], invite_only: ['Request Invite', 'gold'], limited_access: ['Get in Line', 'gold'], waitlist: ['Join Waitlist', 'gold'], preorder: ['Pre-order', 'buy'], upcoming: ['View', 'buy'] }[p.status] || ['View at ' + p.retailerName, 'outline'];
      const a = mk('a', 'rt-btn ' + act[1], act[0]); a.href = p.buyUrl || p.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; row.append(a); }
    b.append(row); c.append(b); return c;
  }
  function upsell() { return sheet((sh, close) => { sh.append(mk('h3', '', 'Product alerts are for Pro members'), mk('p', 'rt-muted', 'Upgrade to watch products, set a maximum price and request alerts. Everyone can still browse In Stock Now and Upcoming Drops.')); const r = mk('div', 'rt-row'), n = mk('button', 'rt-btn', 'Not now'), y = mk('a', 'rt-btn gold', 'See plans'); n.type = 'button'; y.href = '/plans/'; n.onclick = () => close(false); r.append(n, y); sh.append(r); }); }
  function watchSheet(p, ctx) {
    if (!ctx.paid) return upsell().then(() => false);
    const cur = ctx.watchMap[p.id];
    return sheet((sh, close) => {
      sh.append(mk('h3', '', 'Alert me: ' + p.name), mk('p', 'rt-muted rt-small', p.retailerName + (p.price != null ? ' · now ' + money(p.price) : '')));
      const [t1, inS] = toggle('Notify when in stock', 'Sold out → in stock', cur ? cur.inStock : true), [t2, rel] = toggle('Notify on release', 'Upcoming → live', cur ? cur.release : true), [t3, pd] = toggle('Notify when price drops', '', cur ? cur.priceDrop : false);
      const box = mk('div', 'rt-box'); box.append(t1, t2, t3);
      const mx = input(cur && cur.maxPrice != null ? cur.maxPrice : '', 'Any price', 'number'); mx.inputMode = 'decimal'; mx.min = '0'; mx.step = '0.01'; const vr = input(cur ? cur.variant : '', 'e.g. Men’s 10');
      const f = mk('div', 'rt-form'); f.append(field('Maximum price (optional)', mx), field('Size or variant (optional)', vr)); const msg = mk('p', 'rt-msg');
      const r = mk('div', 'rt-row'), save = mk('button', 'rt-btn gold', 'Save alert'); save.type = 'button'; r.append(save);
      if (cur) { const rm = mk('button', 'rt-btn danger', 'Stop watching'); rm.type = 'button'; rm.onclick = async () => { await post({ action: 'unwatch', id: p.id }); close(true); }; r.prepend(rm); }
      save.onclick = async () => { save.disabled = true; const x = await post({ action: 'watch', id: p.id, inStock: inS.checked, release: rel.checked, priceDrop: pd.checked, maxPrice: mx.value, variant: vr.value }); save.disabled = false; if (x.s === 200) close(true); else { msg.className = 'rt-msg bad'; msg.textContent = x.j.error || 'Could not save.'; } };
      sh.append(box, f, msg, r, mk('p', 'rt-muted rt-small', 'Alerts with a maximum price are only sent when the store shows a price at or below it. If the price is unknown, that alert is not sent.'));
    });
  }

  // ---------------- member page ----------------
  async function userPage() {
    const root = $('root'), q = new URLSearchParams(location.search);
    const f = await get({ feed: 1 }); if (f.s === 401) { root.textContent = ''; const b = mk('div', 'rt-empty'); b.append(mk('h3', '', 'Sign in to see Retail Alerts')); const a = mk('a', 'rt-btn gold', 'Sign in'); a.href = '/login/?next=/retail/'; b.append(a); root.append(b); return; }
    const ctx = { paid: f.j.paid, cats: f.j.categories, stores: f.j.retailers, watched: new Set(), watchMap: {}, reload: () => render(cur) };
    root.textContent = ''; const hero = mk('div', 'rt-hero'), h = mk('div'); h.append(mk('h1', '', 'Retail Alerts'), mk('p', 'rt-muted', 'Restocks, drops and price alerts. Verify with the store before you buy.'));
    const bell = mk('button', 'rt-bell', '🔔 Alerts'); bell.type = 'button'; bell.onclick = () => render('alerts'); hero.append(h, bell); root.append(hero);
    const seg = mk('div', 'rt-seg'); seg.setAttribute('role', 'tablist'); const pane = mk('div'); root.append(seg, pane);
    const T = [['stock', 'In Stock Now'], ['upcoming', 'Upcoming Drops'], ['watches', 'My Watches'], ['alerts', 'Alerts'], ['prefs', 'Preferences'], ['request', 'Request']];
    T.forEach(([k, l]) => { const b = mk('button', '', l); b.type = 'button'; b.dataset.k = k; b.setAttribute('role', 'tab'); b.onclick = () => render(k); seg.append(b); });
    const badge = async () => { const x = await get({ inbox: 1 }); const n = x.j.unread || 0; bell.textContent = '🔔 Alerts'; if (n) bell.append(mk('b', '', n > 99 ? '99+' : String(n))); return x; };
    let cur = T.some(t => t[0] === q.get('tab')) ? q.get('tab') : (q.get('alert') ? 'alerts' : 'stock');
    async function render(k) {
      cur = k; seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.k === k))); history.replaceState(null, '', '/retail/' + (k === 'stock' ? '' : '?tab=' + k)); pane.textContent = '';
      const mine = ctx.paid ? (await get({ mine: 1 })).j.watches || [] : []; ctx.watched = new Set(mine.map(w => w.id)); ctx.watchMap = Object.fromEntries(mine.map(w => [w.id, w.watch]));
      const feed = (await get({ feed: 1 })).j;
      pane.append(mk('p', 'rt-muted rt-small', 'Some Buy links are affiliate links. PricePocketAsset may earn a commission on purchases made through them, at no extra cost to you.'));
      const grid = list => { const g = mk('div', 'rt-grid'); list.forEach(p => g.append(productCard(p, ctx))); return g; };
      if (k === 'stock') { pane.append(feed.inStock.length ? grid(feed.inStock) : mk('div', 'rt-empty', 'Nothing is confirmed in stock right now. Watch a product and we will tell you when it is.')); if (feed.other.length) { pane.append(mk('h2', '', 'Watching for restocks')); pane.append(grid(feed.other)); } }
      if (k === 'upcoming') pane.append(feed.upcoming.length ? grid(feed.upcoming) : mk('div', 'rt-empty', 'No upcoming drops yet.'));
      if (k === 'watches') { if (!ctx.paid) { const e = mk('div', 'rt-empty'); e.append(mk('p', '', 'Watching products is part of Pro.')); const a = mk('a', 'rt-btn gold', 'See plans'); a.href = '/plans/'; e.append(a); pane.append(e); } else pane.append(mine.length ? grid(mine) : mk('div', 'rt-empty', 'You are not watching anything yet. Tap Alert Me on any product.')); }
      if (k === 'alerts') await alertsPane(pane);
      if (k === 'prefs') await prefsPane(pane);
      if (k === 'request') requestPane(pane, ctx);
      badge();
    }
    async function alertsPane(host) {
      const x = await get({ inbox: 1 }); const items = x.j.items || [];
      const top = mk('div', 'rt-row'); top.style.cssText = 'justify-content:flex-end;margin-bottom:8px'; const all = mk('button', 'rt-btn', 'Mark all read'); all.type = 'button'; all.style.flex = '0 0 auto'; all.onclick = async () => { await post({ action: 'read', ids: 'all' }); render('alerts'); }; top.append(all); if (items.some(i => !i.read)) host.append(top);
      if (!items.length) host.append(mk('div', 'rt-empty', 'No alerts yet. Alerts you receive also appear here, so you can catch ones you missed.'));
      items.forEach(i => { const href = safeHref(i.url); const a = mk(href ? 'a' : 'div', 'rt-al' + (i.read ? '' : ' unread')); if (href) { a.href = href; if (/^https:/.test(href)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; } }
        a.onclick = () => { if (!i.read) post({ action: 'read', ids: [i.id] }); a.classList.remove('unread'); };
        const t = mk('div'); t.append(mk('b', '', i.title), mk('p', '', i.body), mk('small', '', [ctx.cats[i.category], i.retailer, ago(i.at), i.status && STATUS[i.status] ? STATUS[i.status].toLowerCase() : ''].filter(Boolean).join(' · '))); a.append(mk('span', 'dot'), t); host.append(a); });
      const pid = new URLSearchParams(location.search).get('alert'); if (pid) post({ action: 'read', ids: [pid] });
    }
    async function prefsPane(host) {
      const x = (await get({ prefs: 1 })).j, p = x.prefs; const save = async patch => { const r = await post(Object.assign({ action: 'prefs' }, patch)); msg.className = 'rt-msg ' + (r.s === 200 ? 'ok' : 'bad'); msg.textContent = r.s === 200 ? 'Saved.' : (r.j.error || 'Could not save.'); };
      const msg = mk('p', 'rt-msg'); msg.setAttribute('role', 'status');
      const sec = (title, sub, obj, key, labels) => { const b = mk('div', 'rt-box'); b.append(mk('h3', '', title)); if (sub) b.append(mk('p', 'rt-muted rt-small', sub)); Object.entries(labels).forEach(([k, l]) => { const [d, i] = toggle(l, '', obj[k]); i.onchange = () => save({ [key]: { [k]: i.checked } }); b.append(d); }); return b; };
      host.append(sec('Categories', 'You only get alerts for categories you turn on (plus products you watch).', p.cats, 'cats', x.categories), sec('Alert types', '', p.types, 'types', { release: 'New releases', restock: 'Restocks', price: 'Price drops' }), sec('Stores', 'Leave all off to hear from every store.', p.stores, 'stores', x.retailers), msg);
      const n = mk('div', 'rt-box'); n.append(mk('h3', '', 'Push notifications'), mk('p', 'rt-muted rt-small', 'Turn on notifications on this device so alerts arrive even when PricePocketAsset is closed. On iPhone, add PricePocket to your Home Screen first.')); const a = mk('a', 'rt-btn gold', 'Notification settings'); a.href = '/account/#pushhost'; n.append(a); host.append(n);
    }
    render(cur);
  }
  function requestPane(host, ctx) {
    const b = mk('div', 'rt-box'); b.append(mk('h3', '', 'Request an alert'), mk('p', 'rt-muted rt-small', 'Paste a product link from ' + Object.values(ctx.stores).join(', ') + '. PricePocketAsset reviews every request before it is monitored.'));
    if (!ctx.paid) { const a = mk('a', 'rt-btn gold', 'See plans'); a.href = '/plans/'; b.append(mk('p', '', 'Requesting alerts is part of Pro.'), a); host.append(b); return; }
    const url = input('', 'https://www.target.com/p/…', 'url'), name = input('', 'Product name'), cat = select(Object.entries(ctx.cats)), note = mk('textarea'); note.maxLength = 300; note.placeholder = 'Anything we should know? (optional)';
    const f = mk('div', 'rt-form'); f.append(field('Product link', url), field('Product name', name), field('Category', cat), field('Note', note)); const msg = mk('p', 'rt-msg'); const go = mk('button', 'rt-btn gold', 'Send request'); go.type = 'button';
    go.onclick = async () => { go.disabled = true; const r = await post({ action: 'request', url: url.value, name: name.value, category: cat.value, note: note.value }); go.disabled = false; msg.className = 'rt-msg ' + (r.s === 200 ? 'ok' : 'bad'); msg.textContent = r.s === 200 ? 'Sent. You will be watching it automatically if it is approved.' : (r.j.error || 'Could not send.'); if (r.s === 200) { url.value = name.value = note.value = ''; } };
    b.append(f, msg, go); host.append(b);
  }

  // ---------------- owner page ----------------
  async function ownerPage() {
    const root = $('root'); const x = await get({ admin: 1 }); if (x.s !== 200) { root.textContent = ''; root.append(mk('div', 'rt-empty', x.s === 401 ? 'Sign in as the owner.' : 'Owner only.')); return; }
    const meta = (await get({ feed: 1 })).j, cats = Object.entries(meta.categories), stores = Object.entries(meta.retailers);
    root.textContent = ''; root.append(mk('h1', '', 'Retail Alerts'), mk('p', 'rt-muted', 'Owner tools. Members never see this page.'));
    let flash = ''; try { flash = sessionStorage.getItem('rt-flash') || ''; sessionStorage.removeItem('rt-flash'); } catch (e) { /* ignore */ }
    if (flash) root.append(mk('div', 'rt-box rt-flash', flash));
    // monitor findings: what the automatic checks found, and why
    { const fd = x.j.findings || { items: [], control: {}, last: null }, box = mk('div', 'rt-box');
      box.append(mk('h3', '', 'Stock monitor'));
      const on = fd.control && fd.control.enabled === true;
      box.append(mk('p', 'rt-muted rt-small', (on ? 'ON: checks due products about every 30 minutes (up to 10 per run).' : 'OFF: nothing is checked automatically. Turn it on to check every 30 minutes.') + (fd.last ? ' Last run ' + ago(fd.last.at) + (fd.last.status === 'completed' ? ': ' + fd.last.checked + ' checked, ' + fd.last.changed + ' changed.' : ': ' + (fd.last.reason || 'error')) : '')));
      const row = mk('div', 'rt-row'), tg = mk('button', 'rt-btn ' + (on ? '' : 'gold'), on ? 'Turn off' : 'Turn on'); tg.type = 'button';
      tg.onclick = async () => { if (!(await confirmSheet(on ? 'Turn the monitor off?' : 'Turn the monitor on?', on ? 'Products will stop being checked automatically.' : 'The live site will check store pages every 30 minutes and send alerts when stock changes. If a page cannot be read, an AI reader may help; it can only mark a product out of stock, never in stock.', on ? 'Turn off' : 'Turn on'))) return; const r = await post({ action: 'monitorControl', enabled: !on }); toast(r.s === 200 ? 'Saved.' : (r.j.error || 'Not saved')); setTimeout(() => location.reload(), 600); };
      const cl = mk('button', 'rt-btn', 'Clear notes'); cl.type = 'button'; cl.onclick = async () => { await post({ action: 'clearFindings' }); location.reload(); };
      row.append(cl, tg); box.append(row);
      box.append(mk('h4', '', 'What the monitor found (' + fd.items.length + ')'));
      if (!fd.items.length) box.append(mk('p', 'rt-muted rt-small', 'Nothing yet. Findings appear after the first check.'));
      fd.items.slice(0, 40).forEach(i => { const d = mk('div', 'rt-al' + (i.attention ? ' unread' : '')), t = mk('div'); t.append(mk('b', '', i.name + ' · ' + i.retailer), mk('p', '', (STATUS[i.status] || i.status) + (i.price != null ? ' · ' + money(i.price) : '') + ' — ' + (i.reason || '')), i.note ? mk('p', 'rt-err', i.note) : mk('span'), mk('small', '', ago(i.at) + ' · ' + (i.source === 'ai' ? 'AI reader' : 'page rules'))); d.append(mk('span', 'dot'), t); box.append(d); });
      { const am = x.j.amazon || {}; const ab = mk('div', 'rt-box'); ab.append(mk('h3', '', 'Amazon checks (Bright Data)'));
        ab.append(mk('p', 'rt-muted rt-small', (am.keySaved ? 'Key saved. ' : 'No Bright Data key yet: save it in Owner API Keys. ') + 'Free credits used this month: ' + (am.used || 0) + ' of ' + (am.cap || 4500) + ' allowed (the free pool is 5,000). When the allowed amount is reached, checks stop. ' + (am.enabled ? 'Automatic Amazon checks are ON.' : 'Automatic Amazon checks are OFF.') + (am.pending ? ' ' + am.pending + ' request(s) waiting for results.' : '') + ' Keep the Bright Data account unfunded so it can never bill you.'));
        const ar = mk('div', 'rt-row'), at = mk('button', 'rt-btn ' + (am.enabled ? '' : 'gold'), am.enabled ? 'Turn Amazon off' : 'Turn Amazon on'); at.type = 'button';
        at.onclick = async () => { if (!(await confirmSheet(am.enabled ? 'Turn Amazon checks off?' : 'Turn Amazon checks on?', am.enabled ? 'Amazon products go back to owner-confirmed.' : 'Amazon products are checked through Bright Data, often near a release date and every few hours otherwise, using free credits only and stopping at ' + (am.cap || 4500) + ' a month. The monitor above must also be on.', am.enabled ? 'Turn off' : 'Turn on'))) return; const r = await post({ action: 'amazonControl', enabled: !am.enabled }); toast(r.s === 200 ? 'Saved.' : (r.j.error || 'Not saved')); setTimeout(() => location.reload(), 600); };
        const ac = mk('button', 'rt-btn', 'Check Amazon now (up to 3 credits)'); ac.type = 'button';
        ac.onclick = async () => { if (!(await confirmSheet('Check Amazon now?', 'Uses up to 3 of your free credits. Press it again a minute later to collect the results.', 'Check'))) return; ac.disabled = true; const r = await post({ action: 'amazonCheck' }); ac.disabled = false; toast(r.s === 200 ? (r.j.skipped || ('Requested ' + r.j.requested + ', collected ' + r.j.collected + '.')) : (r.j.error || 'Failed')); setTimeout(() => location.reload(), 1500); };
        ar.append(ac, at); ab.append(ar); box.append(ab); }
      root.append(box); }
    // add product
    const add = mk('div', 'rt-box'); add.append(mk('h3', '', 'Add a product'));
    const url = input('', 'Paste a product link', 'url'), look = mk('button', 'rt-btn rt-read', 'Read page'); look.type = 'button';
    const name = input('', 'Product name'), img = input('', 'https://… image link (optional)', 'url'), price = input('', 'e.g. 54.99'); price.inputMode = 'decimal';
    const cat = select(cats), st = select(STOCK_OPTS, 'monitoring'), rel = input('', '', 'datetime-local'), vr = input('', 'Size / color (optional)');
    const [autoRow, auto] = toggle('Automatic stock checks', 'Only for pages where stock status could be read.', false); auto.disabled = true;
    const note = mk('p', 'rt-muted rt-small'), amsg = mk('p', 'rt-msg');
    const f = mk('div', 'rt-form'); const two = (a, b) => { const d = mk('div', 'rt-two'); d.append(a, b); return d; };
    const urow = mk('div', 'rt-row'); urow.style.paddingTop = '0'; urow.append(url, look); url.style.flex = '3';
    const aff = input('', 'Associates / affiliate link (optional)', 'url');
    f.append(field('Product link', urow), field('Affiliate link (optional)', aff), note, field('Name', name), two(field('Category', cat), field('Status', st)), two(field('Price', price), field('Release date', rel)), field('Variant', vr), field('Image', img), autoRow);
    look.onclick = async () => { look.disabled = true; note.textContent = 'Reading…'; const r = await get({ lookup: url.value }); look.disabled = false; if (r.s !== 200) { note.textContent = r.j.error || 'Could not read.'; return; } const i = r.j.info || {}; if (i.name) name.value = i.name; if (i.image) img.value = i.image; if (i.price != null) price.value = i.price; if (i.status) st.value = i.status; if (i.releaseDate) rel.value = i.releaseDate.slice(0, 16); auto.disabled = !r.j.readable; auto.checked = !!r.j.readable; note.textContent = r.j.note || ''; };
    const create = mk('button', 'rt-btn gold', 'Add product'); create.type = 'button';
    create.onclick = async () => { create.disabled = true; const r = await post({ action: 'create', url: url.value, affiliateUrl: aff.value, name: name.value, image: img.value, price: price.value, category: cat.value, status: st.value, releaseDate: rel.value, variant: vr.value, auto: auto.checked }); create.disabled = false; amsg.className = 'rt-msg ' + (r.s === 200 ? 'ok' : 'bad'); amsg.textContent = r.s === 200 ? 'Added.' : (r.j.error || 'Could not add.'); if (r.s === 200) setTimeout(() => location.reload(), 600); };
    add.append(f, amsg, create); root.append(add);
    // catalog
    root.append(mk('h2', '', 'Catalog (' + x.j.products.length + ')')); const list = mk('div', 'rt-adm'); root.append(list);
    if (!x.j.products.length) list.append(mk('div', 'rt-empty', 'No products yet.'));
    x.j.products.forEach(p => { const d = mk('div', 'rt-ap'), th = mk('div', 'th'); if (p.image) { const ti = mk('img'); ti.alt = ''; ti.loading = 'lazy'; ti.referrerPolicy = 'no-referrer'; ti.src = p.image; ti.onerror = () => { ti.remove(); th.classList.add('miss'); th.textContent = 'No image'; }; th.append(ti); } else { th.classList.add('miss'); th.textContent = 'Image not found'; } const g = mk('div');
      g.append(mk('b', '', p.name), mk('div', 'rt-meta', p.retailerName + ' · ' + (meta.categories[p.category] || '') + ' · ' + (STATUS[p.rawStatus] || p.rawStatus) + (p.price != null ? ' · ' + money(p.price) : '') + ' · ' + p.watchers + ' watching · ' + (p.auto ? 'auto' : 'owner-confirmed') + (p.active ? '' : ' · OFF')));
      g.append(mk('div', 'rt-why', 'Status: ' + (STATUS[p.rawStatus] || p.rawStatus) + (p.statusReason ? ' — ' + p.statusReason : ''))); if (!p.image) g.append(mk('div', 'rt-err', 'Image not found. Paste an image link in Edit, or tap Refresh image.'));
      if (p.lastError) g.append(mk('div', 'rt-err', 'Last check failed: ' + p.lastError));
      const acts = mk('div', 'acts'), sel = select([['', 'Set status…']].concat(STOCK_OPTS, [['disabled', 'Disabled']]));
      sel.onchange = async () => { if (!sel.value) return; if ((sel.value === 'in_stock' || sel.value === 'low_stock') && !(await confirmSheet('Mark as ' + STATUS[sel.value].toLowerCase() + '?', 'If it was not in stock before, matching members get a push now. Only do this after you checked the store page.', 'Confirm'))) { sel.value = ''; return; } const r = await post({ action: 'update', id: p.id, status: sel.value }); const s = (r.j.sent || [])[0]; toast(r.s === 200 ? (s ? (s.skipped ? 'Saved. Alert held back (cooldown).' : 'Saved. Alert sent to ' + s.recipients + ' (' + s.pushed + ' push).') : 'Saved.') : (r.j.error || 'Error')); setTimeout(() => location.reload(), 900); };
      const ed = mk('button', '', 'Edit'); ed.type = 'button'; ed.onclick = () => editSheet(p, cats);
      const ri = mk('button', '', 'Refresh image'); ri.type = 'button';
      ri.onclick = async () => { ri.disabled = true; ri.textContent = 'Reading page…'; const r = await post({ action: 'refreshImage', id: p.id });
        if (r.s !== 200) { ri.disabled = false; ri.textContent = 'Refresh image'; toast(r.j.error || 'Could not read the page.'); return; }
        const msg = await waitCheck(r.j.jobId);
        try { sessionStorage.setItem('rt-flash', msg); } catch (e) { /* private mode: the card still shows the result */ }
        location.reload(); };
      const ck = mk('button', '', 'Check now'); ck.type = 'button';
      ck.onclick = async () => { ck.disabled = true; ck.textContent = 'Checking…'; const r = await post({ action: 'checkNow', id: p.id });
        if (r.s !== 200) { ck.disabled = false; ck.textContent = 'Check now'; toast(r.j.error || 'Could not check.'); return; }
        const msg = await waitCheck(r.j.jobId);
        try { sessionStorage.setItem('rt-flash', msg); } catch (e) { /* private mode: the card still shows the result */ }
        location.reload(); };
      const on = mk('button', '', p.active ? 'Turn off' : 'Turn on'); on.type = 'button'; on.onclick = async () => { await post({ action: 'update', id: p.id, active: !p.active }); location.reload(); };
      const op = mk('a', '', 'Open'); op.href = p.url; op.target = '_blank'; op.rel = 'noopener noreferrer'; op.style.cssText = 'display:inline-flex;align-items:center;min-height:38px;padding:0 12px;border-radius:999px;background:var(--fill);font-weight:600;font-size:.85rem;color:inherit;text-decoration:none';
      acts.append(sel, ed, ri); if (p.auto) acts.append(ck); acts.append(on, op); g.append(acts); d.append(th, g); list.append(d); });
    // requests
    const rq = mk('div'); rq.id = 'requests'; rq.append(mk('h2', '', 'Product requests (' + x.j.requests.length + ')')); root.append(rq);
    if (!x.j.requests.length) rq.append(mk('div', 'rt-empty', 'No requests waiting.'));
    x.j.requests.forEach(q => { const d = mk('div', 'rt-box'); d.append(mk('b', '', q.name), mk('div', 'rt-meta', meta.retailers[q.retailer] + ' · ' + meta.categories[q.category] + ' · ' + ago(q.at)), mk('div', 'rt-meta', q.url)); if (q.note) d.append(mk('p', 'rt-small', '“' + q.note + '”')); if (q.existing) d.append(mk('p', 'rt-msg ok', 'Already in the catalog: Merge adds the member as a watcher.'));
      const r = mk('div', 'rt-row'); const act = async (decision, extra) => { const x2 = await post(Object.assign({ action: 'decide', id: q.id, decision }, extra || {})); toast(x2.s === 200 ? 'Done.' : (x2.j.error || 'Error')); setTimeout(() => location.reload(), 700); };
      const ap = mk('button', 'rt-btn gold', 'Approve'); ap.type = 'button'; ap.onclick = () => sheet((sh, close) => { const n = input(q.name), c = select(cats, q.category), s = select([['monitoring', 'Monitoring'], ['upcoming', 'Upcoming'], ['sold_out', 'Sold out']], 'monitoring'), pr = input('', 'Price (optional)'); const ff = mk('div', 'rt-form'); ff.append(field('Name', n), field('Category', c), field('Status', s), field('Price', pr)); const go = mk('button', 'rt-btn gold', 'Approve and add'); go.type = 'button'; go.onclick = () => { close(); act('approve', { edit: { name: n.value, category: c.value, status: s.value, price: pr.value } }); }; sh.append(mk('h3', '', 'Approve request'), ff, mk('p'), go); });
      const mg = mk('button', 'rt-btn', 'Merge'); mg.type = 'button'; mg.onclick = () => sheet((sh, close) => { const s = select(x.j.products.map(p => [p.id, p.name + ' · ' + p.retailerName]), q.existing); const go = mk('button', 'rt-btn gold', 'Merge'); go.type = 'button'; go.onclick = () => { close(); act('merge', { productId: s.value }); }; const ff = mk('div', 'rt-form'); ff.append(field('Merge into', s)); sh.append(mk('h3', '', 'Merge with an existing product'), ff, mk('p'), go); });
      const rj = mk('button', 'rt-btn danger', 'Reject'); rj.type = 'button'; rj.onclick = () => act('reject');
      r.append(rj, mg, ap); d.append(r); rq.append(d); });
    // broadcast
    const bc = mk('div', 'rt-box'); bc.append(mk('h3', '', 'Send an alert'));
    const bt = input('', 'Title'), bm = mk('textarea'); bm.maxLength = 220; bm.placeholder = 'Message'; const bu = input('', 'Store link or /page (optional)'), bi = input('', 'https://… image (optional)'), bp = select([['normal', 'Normal'], ['high', 'High']]);
    const at = select([['category', 'A category (respects preferences)'], ['retailer', 'A store (respects preferences)'], ['product', 'Watchers of a product'], ['everyone', 'EVERYONE (global broadcast)']]);
    const av = select([]); const fillAv = () => { av.textContent = ''; const o = at.value === 'category' ? cats : at.value === 'retailer' ? stores : at.value === 'product' ? x.j.products.map(p => [p.id, p.name]) : []; o.forEach(([k, l]) => { const e = mk('option', '', l); e.value = k; av.append(e); }); av.parentElement && (av.parentElement.hidden = at.value === 'everyone'); }; at.onchange = fillAv;
    const bf = mk('div', 'rt-form'); bf.append(field('Title', bt), field('Message', bm), field('Link', bu), field('Image', bi), field('Audience', at), field('Who', av), field('Priority', bp)); fillAv();
    const bmsg = mk('p', 'rt-msg'), send = mk('button', 'rt-btn gold', 'Send alert'); send.type = 'button';
    send.onclick = async () => { const ev = at.value === 'everyone'; if (ev && !(await confirmSheet('Send to everyone?', 'Every member with notifications on gets this push, whatever their preferences. Use it for important alerts only.', 'Send to everyone', true))) return; if (!ev && !(await confirmSheet('Send this alert?', 'It goes to the members you picked.', 'Send'))) return;
      send.disabled = true; const r = await post({ action: 'broadcast', title: bt.value, message: bm.value, url: bu.value, image: bi.value, priority: bp.value, audience: { type: at.value, value: av.value }, confirmEveryone: ev }); send.disabled = false;
      bmsg.className = 'rt-msg ' + (r.s === 200 ? 'ok' : 'bad'); bmsg.textContent = r.s === 200 ? (r.j.everyone ? (r.j.push && r.j.push.ok ? 'Sent to everyone.' : 'Saved to everyone’s alerts center. Push: ' + ((r.j.push && r.j.push.error) || 'not sent')) : 'Sent to ' + r.j.recipients + ' members (' + r.j.pushed + ' push).') : (r.j.error || 'Could not send.'); };
    const tst = mk('button', 'rt-btn', 'Test owner push'); tst.type = 'button'; tst.onclick = async () => { const r = await post({ action: 'test' }); toast(r.s === 200 ? 'Sent to your devices.' : (r.j.error || 'Not sent')); };
    const br = mk('div', 'rt-row'); br.append(tst, send); bc.append(bf, bmsg, br); root.append(mk('h2', '', 'Broadcast'), bc);
    // history
    root.append(mk('h2', '', 'Recent alerts')); const hl = mk('div'); (x.j.history || []).forEach(a => { const d = mk('div', 'rt-al'); const t = mk('div'); t.append(mk('b', '', a.title), mk('p', '', a.body), mk('small', '', ago(a.at) + ' · ' + (a.audience || '') + ' · ' + (a.count != null ? a.count + ' members' : ''))); d.append(t); hl.append(d); }); if (!(x.j.history || []).length) hl.append(mk('div', 'rt-empty', 'No alerts sent yet.')); root.append(hl);
    if (location.hash === '#requests') rq.scrollIntoView();
  }
  function editSheet(p, cats) {
    return sheet((sh, close) => { const n = input(p.name), im = input(p.image || ''), pr = input(p.priceManual != null ? p.priceManual : (p.price != null ? p.price : '')), c = select(cats, p.category), rd = input((p.releaseDate || '').slice(0, 16), '', 'datetime-local'), v = input(p.variant || '');
      const [ar, au] = toggle('Automatic stock checks', '', p.auto); const f = mk('div', 'rt-form'); f.append(field('Name', n), field('Image', im), field('Price', pr), field('Category', c), field('Release date', rd), field('Variant', v), ar); const msg = mk('p', 'rt-msg');
      const go = mk('button', 'rt-btn gold', 'Save'); go.type = 'button'; go.onclick = async () => { const r = await post({ action: 'update', id: p.id, name: n.value, image: im.value, price: pr.value, category: c.value, releaseDate: rd.value, variant: v.value, auto: au.checked }); if (r.s === 200) { close(); location.reload(); } else { msg.className = 'rt-msg bad'; msg.textContent = r.j.error || 'Could not save.'; } };
      sh.append(mk('h3', '', 'Edit product'), f, msg, go, mk('p', 'rt-muted rt-small', 'Changing the price to a lower one while in stock sends a price-drop alert.')); });
  }
  // Polls a queued check until it finishes, or about 100 seconds pass.
  async function waitCheck(jobId) {
    const until = Date.now() + 100e3;
    while (Date.now() < until) {
      await new Promise(res => setTimeout(res, 2000));
      const s = await get({ checkJob: jobId });
      if (s.s !== 200) return s.j.error || 'Could not read the check result.';
      if (s.j.status === 'done') return (s.j.result && s.j.result.message) || 'Checked.';
    }
    return 'Still checking in the background. Reload in a minute to see the result.';
  }
  function toast(t) { const d = mk('div', 'rt-ov on'); d.style.alignItems = 'center'; const s = mk('div', 'rt-sheet', t); s.style.cssText = 'width:auto;border-radius:18px;padding:14px 20px;transform:none'; d.append(s); document.body.append(d); setTimeout(() => d.remove(), 1400); }

  ({ user: userPage, owner: ownerPage }[document.body.dataset.page] || (() => {}))();
})();
