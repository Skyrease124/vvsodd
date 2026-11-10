// Mississippi state-held (tax-forfeited) land: list with county filter, search, How to buy, Land Information and Favorites.
const MsForfeitedUI = {
  render(host) {
    const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
    const money = n => '$' + Number(n).toLocaleString('en-US');
    const box = mk('div', 'salebox');
    box.appendChild(mk('h3', '', 'State-held tax-forfeited land (Mississippi Secretary of State)'));
    box.appendChild(mk('p', 'small', MS_TFL.length.toLocaleString('en-US') + ' parcels in ' + new Set(MS_TFL.map(x => x[0])).size + ' counties on the Secretary of State’s tax-forfeited lands list (downloaded ' + MS_TFL_CHECKED + '). This is land that forfeited to the State for unpaid taxes. The State sells it directly, outside the yearly county tax sales. Owner names and addresses are left out here. County value is the county’s market value from the list ($0 means none was given).'));
    const tools = mk('div', 'lientools');
    const cs = mk('select'); cs.setAttribute('aria-label', 'County');
    const counts = {}; MS_TFL.forEach(x => { counts[x[0]] = (counts[x[0]] || 0) + 1; });
    cs.appendChild(new Option('All counties', '')); Object.keys(counts).sort().forEach(c => cs.appendChild(new Option(c + ' (' + counts[c] + ')', c)));
    const q = mk('input'); q.type = 'search'; q.placeholder = 'Search parcel number'; q.setAttribute('aria-label', 'Search parcel');
    const so = mk('select'); so.setAttribute('aria-label', 'Sort'); [['hi', 'Highest county value'], ['lo', 'Lowest county value'], ['co', 'County A to Z']].forEach(o => so.appendChild(new Option(o[1], o[0])));
    const zero = mk('label', 'chk'); const zc = mk('input'); zc.type = 'checkbox'; zero.append(zc, ' Hide $0 value');
    tools.append(cs, q, so, zero); box.appendChild(tools);
    const cnt = mk('p', 'muted small'); cnt.setAttribute('role', 'status'); box.appendChild(cnt);
    const wrap = mk('div', 'tablewrap'); box.appendChild(wrap);
    const more = mk('button', 'btn ghost', 'Show more'); box.appendChild(more);
    let list = [], shown = 50;
    const item = x => ({county: x[0], state: 'MS', parcel: x[1], market: x[2] || null, buyKey: 'MS-TFL', status: 'State-held (tax-forfeited)', desc: 'Mississippi tax-forfeited land, ' + x[0] + ' County'});
    function draw() {
      wrap.textContent = '';
      const t = mk('table', 'liens'), hr = t.createTHead().insertRow();
      ['County', 'Parcel', 'County value', ''].forEach(h => hr.appendChild(mk('th', '', h)));
      const tb = t.createTBody();
      list.slice(0, shown).forEach(x => {
        const r = tb.insertRow(), l = item(x);
        r.insertCell().textContent = x[0]; r.insertCell().textContent = x[1]; r.insertCell().textContent = x[2] ? money(x[2]) : '—';
        const c = r.insertCell(); const b = LienBuy.button(l, 'btn small'); if (b) c.appendChild(b); const f = LienSave.button(l, 'btn small ghost'); f.style.marginLeft = '6px'; c.appendChild(f);
      });
      wrap.appendChild(t);
      cnt.textContent = 'Showing ' + Math.min(shown, list.length).toLocaleString('en-US') + ' of ' + list.length.toLocaleString('en-US');
      more.hidden = shown >= list.length;
    }
    function apply() {
      const s = q.value.trim().toLowerCase().replace(/\s+/g, ' ');
      list = MS_TFL.filter(x => (!cs.value || x[0] === cs.value) && (!zc.checked || x[2] > 0) && (!s || x[1].toLowerCase().indexOf(s) >= 0));
      list.sort((a, b) => so.value === 'hi' ? b[2] - a[2] : so.value === 'lo' ? a[2] - b[2] : (a[0] + a[1]).localeCompare(b[0] + b[1]));
      shown = 50; draw();
    }
    [cs, q, so, zc].forEach(e => e.addEventListener('input', apply));
    more.addEventListener('click', () => { shown += 100; draw(); });
    host.appendChild(box); apply();
  }
};
