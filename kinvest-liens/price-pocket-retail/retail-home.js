// Price Pocket Retail homepage. Demonstration listings only: no live inventory, no retailer data, nothing verified.
(function () {
  'use strict';
  const CATS = { sneakers: 'Sneakers & releases', cards: 'Pokémon & cards', electronics: 'Electronics & gaming', vehicles: 'Vehicles', collectibles: 'Collectibles', other: 'Other approved' };
  const STATES = { in_stock: 'In stock', monitoring: 'Monitoring', upcoming: 'Upcoming', sold_out: 'Sold out', invite_only: 'Invite only' };
  // Sample products. Names and stores are placeholders; the states are examples for the layout, not observations.
  const DEMO = [
    { id: 'd1', cat: 'sneakers', name: 'Sample low-top sneaker release', store: 'Demo store A', state: 'upcoming' },
    { id: 'd2', cat: 'cards', name: 'Sample trading card booster box', store: 'Demo store B', state: 'monitoring' },
    { id: 'd3', cat: 'electronics', name: 'Sample gaming console bundle', store: 'Demo store C', state: 'sold_out' },
    { id: 'd4', cat: 'vehicles', name: 'Sample used-car listing', store: 'Demo source', state: 'monitoring' },
    { id: 'd5', cat: 'collectibles', name: 'Sample collectible figure', store: 'Demo store D', state: 'in_stock' },
    { id: 'd6', cat: 'other', name: 'Sample approved product', store: 'Demo store E', state: 'invite_only' },
  ];
  const $ = id => document.getElementById(id);
  const grid = $('pprtGrid'), empty = $('pprtEmpty'), q = $('pprtQ');
  let cat = 'all', LIVE = null, tab = 'stock', PAID = false, TABBED = false; const WATCH = new Set(); const API = '/.netlify/functions/retail';
  const call = async (o, q) => { try { const r = o ? await fetch(API, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) }) : await fetch(API + '?' + new URLSearchParams(q), { credentials: 'same-origin' }); return { s: r.status, j: await r.json().catch(() => ({})) }; } catch (e) { return { s: 0, j: {} }; } };
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  let _unused = null; // LIVE = real products from Retail Alerts (signed-in members); null keeps the demo cards
  const money = v => (v == null || v === '' ? '' : '$' + Number(v).toFixed(2));
  const LABEL = { in_stock: 'In stock', low_stock: 'Low stock', sold_out: 'Out of stock', out_of_stock: 'Out of stock', invite_only: 'Invite only', preorder: 'Preorder', coming_soon: 'Coming soon', waitlist: 'Waitlist', limited_access: 'Limited access', upcoming: 'Upcoming', monitoring: 'Monitoring' };
  const ago = iso => { if (!iso) return ''; const s = (Date.now() - Date.parse(iso)) / 1000; if (!(s >= 0)) return ''; if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago'; if (s < 86400) return Math.floor(s / 3600) + ' h ago'; return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
  const liveState = st => (st === 'in_stock' || st === 'low_stock' ? 'in_stock' : st === 'upcoming' ? 'upcoming' : st === 'sold_out' || st === 'out_of_stock' ? 'sold_out' : st === 'limited_access' ? 'invite_only' : 'monitoring');

  function card(item) {
    const art = document.createElement('article'); art.className = 'pprt-item';
    const thumb = document.createElement('div'); thumb.className = 'pprt-thumb'; thumb.setAttribute('aria-hidden', 'true');
    if (item.image) { thumb.style.cssText = 'background:#fff center/contain no-repeat url("' + String(item.image).replace(/["\\\n]/g, '') + '")'; }
    const body = document.createElement('div'); body.className = 'pprt-body';
    const tag = document.createElement('span'); tag.className = 'pprt-tag'; tag.textContent = item.live ? 'Live' : 'Demo';
    const h = document.createElement('h3'); h.textContent = item.name;
    const meta = document.createElement('p'); meta.className = 'pprt-meta'; meta.textContent = item.store + ' · ' + CATS[item.cat];
    const avail = document.createElement('p'); avail.className = 'pprt-avail s-' + item.state;
    const dot = document.createElement('i'); dot.setAttribute('aria-hidden', 'true');
    avail.append(dot, document.createTextNode((item.live ? (LABEL[item.raw] || STATES[item.state]) : 'Demo: ' + STATES[item.state]) + (item.price ? ' · ' + money(item.price) : '')));
    body.append(tag, h, meta, avail);
    if (item.live) { const bits = [item.checkedAt ? (item.auto ? 'Checked ' : 'Updated ') + ago(item.checkedAt) : '', item.watchers ? item.watchers + ' watching' : ''].filter(Boolean).join(' · '); if (bits) { const u = document.createElement('p'); u.className = 'pprt-meta'; u.textContent = bits; body.append(u); } }
    if (item.live && /^https:\/\//.test(item.url || '')) { const a = document.createElement('a'); a.className = 'pprt-link'; a.href = item.url; a.target = '_blank'; a.rel = 'noopener noreferrer sponsored'; a.textContent = 'View at ' + item.store + ' →'; body.append(a); }
    if (item.live) {
      const w = document.createElement('button'); w.type = 'button'; w.className = 'pprt-watch' + (WATCH.has(item.id) ? ' on' : '');
      w.textContent = WATCH.has(item.id) ? '✓ In your watchlist' : '+ Add to watchlist';
      w.addEventListener('click', async () => {
        if (!PAID) { sheet(s => { s.append(el('h3', '', 'Watching is part of Pro'), el('p', 'pprt-mute', 'Upgrade to watch products and get alerts. Everyone can still browse In Stock Now and Upcoming Drops.')); const a = el('a', 'pprt-btn', 'See plans'); a.href = '/plans/'; s.append(a); }); return; }
        w.disabled = true;
        const on = WATCH.has(item.id);
        const r = await call(on ? { action: 'unwatch', id: item.id } : { action: 'watch', id: item.id, inStock: true, release: true, priceDrop: true });
        w.disabled = false;
        if (r.s === 200) { if (on) WATCH.delete(item.id); else WATCH.add(item.id); render(); }
      });
      body.append(w);
    }
    art.append(thumb, body);
    return art;
  }

  function render() {
    const text = q.value.trim().toLowerCase();
    const base = !LIVE ? DEMO : (tab === 'watch' ? LIVE.filter(i => WATCH.has(i.id)) : LIVE.filter(i => tab === 'upcoming' ? i.group === 'upcoming' : i.group !== 'upcoming').sort((a, b) => (a.group === 'stock' ? 0 : 1) - (b.group === 'stock' ? 0 : 1)));
    const list = base.filter(item => (cat === 'all' || item.cat === cat) && (!text || (item.name + ' ' + item.store + ' ' + CATS[item.cat]).toLowerCase().includes(text)));
    grid.textContent = '';
    let sub = false;
    list.forEach(item => { if (LIVE && tab === 'stock' && !sub && item.group !== 'stock') { sub = true; const h = document.createElement('h3'); h.className = 'pprt-sub'; h.textContent = 'Being monitored'; grid.append(h); } grid.append(card(item)); });
    empty.hidden = list.length > 0;
    if (LIVE) empty.textContent = tab === 'watch' ? 'You are not watching anything yet. Tap Add to watchlist on a product.' : tab === 'upcoming' ? 'No upcoming drops yet.' : 'Nothing matches right now.';
  }

  document.querySelectorAll('.pprt-chip').forEach(btn => btn.addEventListener('click', () => {
    cat = btn.dataset.cat;
    document.querySelectorAll('.pprt-chip').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    render();
  }));
  q.addEventListener('input', render);
  render();

  // Signed-in members see the real products from Retail Alerts (with their store links). Visitors keep the demo cards.
  fetch('/.netlify/functions/retail?feed=1', { credentials: 'same-origin' })
    .then(r => (r.ok ? r.json() : null))
    .then(d => {
      if (!d || !d.ok) return;
      const all = [].concat((d.inStock || []).map(p => Object.assign({}, p, { _g: 'stock' })), (d.upcoming || []).map(p => Object.assign({}, p, { _g: 'upcoming' })), (d.other || []).map(p => Object.assign({}, p, { _g: 'other' })));
      PAID = !!d.paid;
      if (!all.length) return;
      const known = Object.keys(CATS);
      LIVE = all.map(p => ({ id: p.id, live: true, group: p._g, name: p.name, store: p.retailerName || p.retailer || 'Store', cat: p.category === 'gaming' ? 'electronics' : known.includes(p.category) ? p.category : (/pok|card/i.test(p.category + ' ' + p.name) ? 'cards' : 'other'), state: liveState(p.status), raw: p.status, checkedAt: p.checkedAt, auto: p.auto, watchers: p.watchers, price: p.price, image: p.image, url: p.buyUrl || p.url }));
      const note = document.querySelector('.pprt-notice');
      if (note) note.innerHTML = '<b>Live products.</b> From Retail Alerts. Availability is checked by our monitor; always confirm on the store\'s own page before you buy.';
      const kick = document.querySelector('.pprt-kicker'); if (kick) kick.textContent = 'Live from Retail Alerts';
      if (note) note.innerHTML += ' Some store links are affiliate links: PricePocketAsset may earn a commission at no extra cost to you.';
      startMember();
    })
    .catch(() => { /* stays on the demo cards */ });

  async function settingsSheet() {
    sheet(async sh => {
      sh.append(el('h3', '', 'Alert settings'));
      const x = await call(null, { prefs: 1 }); const p = x.j && x.j.prefs; if (!p) { sh.append(el('p', 'pprt-mute', 'Sign in to change alert settings.')); return; }
      const msg = el('p', 'pprt-mute', ''); const cats = x.j.categories || {};
      const sec = (title, obj, key, labels) => { sh.append(el('h4', '', title)); Object.entries(labels).forEach(([k, l]) => { const row = el('label', 'pprt-tog'); const i = el('input'); i.type = 'checkbox'; i.checked = !!obj[k]; i.onchange = async () => { const r = await call(Object.assign({ action: 'prefs' }, { [key]: { [k]: i.checked } })); msg.textContent = r.s === 200 ? 'Saved.' : 'Could not save.'; }; row.append(i, el('span', '', l)); sh.append(row); }); };
      sec('Categories', p.cats || {}, 'cats', cats); sec('Alert types', p.types || {}, 'types', { release: 'New releases', restock: 'Restocks', price: 'Price drops' }); sh.append(msg);
    });
  }
  function sheet(build) {
    const ov = el('div', 'pprt-ov'), sh = el('div', 'pprt-sheet'); sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true');
    const close = () => { ov.remove(); document.removeEventListener('keydown', esc); };
    const esc = e => { if (e.key === 'Escape') close(); };
    const x = el('button', 'pprt-x', 'Close'); x.type = 'button'; x.onclick = close; sh.append(x);
    ov.addEventListener('click', e => { if (e.target === ov) close(); }); document.addEventListener('keydown', esc);
    build(sh, close); ov.append(sh); document.body.append(ov); return close;
  }
  async function alertsSheet() {
    sheet(async sh => {
      sh.append(el('h3', '', 'Notifications'));
      const box = el('div', 'pprt-alist'); sh.append(box); box.textContent = 'Loading…';
      const x = await call(null, { inbox: 1 }); const items = (x.j && x.j.items) || []; box.textContent = '';
      if (!items.length) box.append(el('p', 'pprt-mute', 'No alerts yet. Alerts you receive appear here.'));
      items.forEach(i => { const href = /^https:\/\//.test(i.url || '') ? i.url : ''; const a = el(href ? 'a' : 'div', 'pprt-al' + (i.read ? '' : ' unread')); if (href) { a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; } a.append(el('b', '', i.title || 'Alert'), el('span', '', i.body || '')); box.append(a); });
      if (items.some(i => !i.read)) { const m = el('button', 'pprt-btn pprt-ghost', 'Mark all read'); m.type = 'button'; m.onclick = async () => { await call({ action: 'read', ids: 'all' }); box.querySelectorAll('.unread').forEach(n => n.classList.remove('unread')); badge(); }; sh.append(m); }
    });
  }
  async function badge() { const x = await call(null, { inbox: 1 }); const n = (x.j && x.j.unread) || 0; const b = window.pprtNotifBtn; if (b) { b.textContent = 'Notifications'; if (n) b.append(el('b', 'pprt-count', n > 99 ? '99+' : String(n))); } const ac = $('pprtAccount'); if (ac) ac.classList.toggle('has-new', n > 0); }
  async function startMember() {
    if (TABBED) return; TABBED = true;
    const tabs = $('pprtTabs'); tabs.hidden = false;
    tabs.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; tabs.querySelectorAll('[data-tab]').forEach(t => t.setAttribute('aria-selected', String(t === b))); render(); }));
    const open = $('pprtOpenAlerts'); if (open) open.addEventListener('click', e => { e.preventDefault(); $('browse').scrollIntoView({ behavior: 'smooth' }); });
    if (PAID) { const m = await call(null, { mine: 1 }); ((m.j && m.j.watches) || []).forEach(w => WATCH.add(w.id)); }
    render(); badge();
  }
  function watchSheet() {
    sheet(sh => {
      sh.append(el('h3', '', 'Watchlist'));
      const box = el('div', 'pprt-alist'); sh.append(box);
      const paint = () => { box.textContent = ''; const mine = (LIVE || []).filter(i => WATCH.has(i.id)); if (!mine.length) box.append(el('p', 'pprt-mute', PAID ? 'You are not watching anything yet. Tap Add to watchlist on a product.' : 'Watching products is part of Pro.'));
        mine.forEach(i => { const row = el('div', 'pprt-al'); row.append(el('b', '', i.name), el('span', '', i.store + ' · ' + STATES[i.state] + (i.price ? ' · ' + money(i.price) : '')));
          const rm = el('button', 'pprt-watch on', 'Stop watching'); rm.type = 'button'; rm.onclick = async () => { const r = await call({ action: 'unwatch', id: i.id }); if (r.s === 200) { WATCH.delete(i.id); paint(); render(); } }; row.append(rm); box.append(row); }); };
      paint();
    });
  }

  // Same sign-in as the rest of the site: the account endpoint says who is signed in.
  fetch('/.netlify/functions/account', { credentials: 'same-origin' })
    .then(r => (r.ok ? r.json() : null))
    .then(d => {
      const a = $('pprtAccount');
      if (d && d.user) {
        a.textContent = 'My account'; a.href = '#'; a.setAttribute('aria-haspopup', 'menu'); a.setAttribute('aria-expanded', 'false');
        const menu = $('pprtMenu');
        const item = (label, fn) => { const b = el('button', '', label); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.onclick = () => { menu.hidden = true; a.setAttribute('aria-expanded', 'false'); fn(); }; menu.append(b); return b; };
        const goTab = k => { tab = k; const t = document.querySelector('#pprtTabs [data-tab="' + k + '"]'); document.querySelectorAll('#pprtTabs [data-tab]').forEach(x => x.setAttribute('aria-selected', String(x === t))); render(); $('browse').scrollIntoView({ behavior: 'smooth' }); };
        item('Watchlist', watchSheet);
        const nb = item('Notifications', alertsSheet); window.pprtNotifBtn = nb;
        item('Alert settings', settingsSheet);
        item('Sign out', async () => { try { await fetch('/.netlify/functions/account', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) }); } catch (e) { /* reload anyway */ } location.reload(); });
        a.addEventListener('click', e => { e.preventDefault(); menu.hidden = !menu.hidden; a.setAttribute('aria-expanded', String(!menu.hidden)); });
        document.addEventListener('click', e => { if (!menu.hidden && !menu.contains(e.target) && e.target !== a) { menu.hidden = true; a.setAttribute('aria-expanded', 'false'); } });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') { menu.hidden = true; a.setAttribute('aria-expanded', 'false'); } });
      }
    })
    .catch(() => { /* stays "Sign in" */ });
})();
