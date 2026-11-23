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
  let cat = 'all';

  function card(item) {
    const art = document.createElement('article'); art.className = 'pprt-item';
    const thumb = document.createElement('div'); thumb.className = 'pprt-thumb'; thumb.setAttribute('aria-hidden', 'true');
    const body = document.createElement('div'); body.className = 'pprt-body';
    const tag = document.createElement('span'); tag.className = 'pprt-tag'; tag.textContent = 'Demo';
    const h = document.createElement('h3'); h.textContent = item.name;
    const meta = document.createElement('p'); meta.className = 'pprt-meta'; meta.textContent = item.store + ' · ' + CATS[item.cat];
    const avail = document.createElement('p'); avail.className = 'pprt-avail s-' + item.state;
    const dot = document.createElement('i'); dot.setAttribute('aria-hidden', 'true');
    avail.append(dot, document.createTextNode('Demo: ' + STATES[item.state]));
    body.append(tag, h, meta, avail);
    art.append(thumb, body);
    return art;
  }

  function render() {
    const text = q.value.trim().toLowerCase();
    const list = DEMO.filter(item => (cat === 'all' || item.cat === cat) && (!text || (item.name + ' ' + item.store + ' ' + CATS[item.cat]).toLowerCase().includes(text)));
    grid.textContent = '';
    list.forEach(item => grid.append(card(item)));
    empty.hidden = list.length > 0;
  }

  document.querySelectorAll('.pprt-chip').forEach(btn => btn.addEventListener('click', () => {
    cat = btn.dataset.cat;
    document.querySelectorAll('.pprt-chip').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    render();
  }));
  q.addEventListener('input', render);
  render();

  // Same sign-in as the rest of the site: the account endpoint says who is signed in.
  fetch('/.netlify/functions/account', { credentials: 'same-origin' })
    .then(r => (r.ok ? r.json() : null))
    .then(d => {
      const a = $('pprtAccount');
      if (d && d.user) { a.textContent = 'My account'; a.href = '/account/'; }
    })
    .catch(() => { /* stays "Sign in" */ });
})();
