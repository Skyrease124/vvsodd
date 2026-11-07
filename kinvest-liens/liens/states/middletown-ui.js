// City of Middletown, NY: the September 2025 tax lien sale list (type, tax map, amount owed). Renders into a host element.
const MiddletownUI = {
  render(host) {
    const M = MIDDLETOWN_NY, mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
    const money = n => '$' + Number(n).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    const amts = M.rows.map(r => r.a).sort((a, b) => a - b), tot = amts.reduce((a, b) => a + b, 0), med = amts[Math.floor(amts.length / 2)];
    const box = mk('div', 'salebox');
    box.appendChild(mk('h3', '', 'Middletown, NY (Orange County): the September 2025 tax lien sale'));
    box.appendChild(mk('p', 'small muted', 'New York has no statewide tax lien system. Each city or county decides whether to sell its unpaid-tax liens. Middletown’s legal notice (dated ' + M.noticeDate + ') listed properties to be sold on ' + M.saleDate + ' to ' + M.buyer + ', one bulk buyer, unless the taxes were paid by ' + M.payBy + '. So this sale is over and was not open to individual bidders. It is here as a real example of what a New York city sale looks like. Owner names and street addresses are left out.'));
    const dl = mk('dl', 'stfacts');
    [['Properties listed', String(M.rows.length)], ['Total owed', money(tot)], ['Middle amount', money(med)], ['Largest', money(amts[amts.length - 1])], ['Smallest', money(amts[0])]].forEach(([k, v]) => { const d = mk('div'); d.append(mk('dt', '', k), mk('dd', '', v)); dl.appendChild(d); });
    box.appendChild(dl);
    // by property type
    const g = {}; M.rows.forEach(r => { (g[r.t] = g[r.t] || []).push(r.a); });
    const types = Object.keys(g).sort((a, b) => g[b].length - g[a].length);
    const t1 = mk('table', 'liens'), h1 = t1.createTHead().insertRow(); ['Property type', 'Count', 'Total owed', 'Middle amount'].forEach(x => h1.appendChild(mk('th', '', x)));
    const b1 = t1.createTBody(); types.slice(0, 8).forEach(k => { const a = g[k].slice().sort((x, y) => x - y), r = b1.insertRow(); [k, String(a.length), money(a.reduce((x, y) => x + y, 0)), money(a[Math.floor(a.length / 2)])].forEach(x => r.insertCell().textContent = x); });
    const w1 = mk('div', 'tablewrap'); w1.appendChild(t1); box.appendChild(w1);
    // searchable parcel list
    const tools = mk('div', 'lientools'), q = mk('input'); q.type = 'search'; q.placeholder = 'Search tax map or property type'; q.setAttribute('aria-label', 'Search');
    const sort = mk('select'); sort.setAttribute('aria-label', 'Sort'); [['high', 'Largest amount first'], ['low', 'Smallest amount first'], ['map', 'Tax map order']].forEach(o => sort.appendChild(new Option(o[1], o[0])));
    tools.append(q, sort); box.appendChild(tools);
    const cnt = mk('p', 'small muted'); box.appendChild(cnt);
    const wrap = mk('div', 'tablewrap'); box.appendChild(wrap);
    const more = mk('button', 'btn ghost', 'Show more'); box.appendChild(more);
    let shown = 25, list = [];
    function draw() {
      wrap.textContent = ''; const t = mk('table', 'liens'), h = t.createTHead().insertRow(); ['Tax map', 'Property type', 'Amount owed*'].forEach(x => h.appendChild(mk('th', '', x)));
      const b = t.createTBody(); list.slice(0, shown).forEach(r => { const tr = b.insertRow(); [r.m, r.t, money(r.a)].forEach(x => tr.insertCell().textContent = x); });
      wrap.appendChild(t); cnt.textContent = 'Showing ' + Math.min(shown, list.length) + ' of ' + list.length + ' (*as listed in the notice; all liens carried more penalties, interest and fees)'; more.hidden = shown >= list.length;
    }
    function apply() {
      const s = q.value.trim().toLowerCase();
      list = M.rows.filter(r => !s || (r.m + ' ' + r.t).toLowerCase().indexOf(s) >= 0);
      list.sort((a, b) => sort.value === 'low' ? a.a - b.a : sort.value === 'map' ? a.m.localeCompare(b.m, undefined, {numeric: true}) : b.a - a.a);
      shown = 25; draw();
    }
    [q, sort].forEach(e => e.addEventListener('input', apply)); more.addEventListener('click', () => { shown += 50; draw(); });
    apply();
    const src = mk('p', 'small'); const a = mk('a', '', 'City of Middletown: Tax Liens notice'); a.href = M.source; a.target = '_blank'; a.rel = 'noopener noreferrer';
    src.append('Source: ', a, ' (copied ' + M.copied + '). About five of the roughly 200 entries could not be read cleanly and are left out. Educational only; confirm with the City of Middletown.'); box.appendChild(src);
    host.appendChild(box);
  }
};
