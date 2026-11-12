// Arkansas COSL tax-delinquent land auction listing: county filter, search, sort, show more.
const ArCoslUI = {
  render(host) {
    const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
    const money = n => '$' + Number(n).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    const box = mk('div', 'salebox'); host.appendChild(box);
    box.appendChild(mk('h3', '', 'State land auction (Arkansas Commissioner of State Lands)'));
    box.appendChild(mk('p', 'small', AR_COSL.length.toLocaleString('en-US') + ' tax-delinquent parcels in ' + new Set(AR_COSL.map(x => x[0])).size + ' counties on the COSL online auction list (export dated 2026-11-12). Listings end and new ones are added all the time: check the official auction before you bid.'));
    const src = mk('p', 'small'); const a = mk('a', '', 'Official COSL auction site'); a.href = 'https://www.cosl.org/'; a.target = '_blank'; a.rel = 'noopener noreferrer'; src.append(a, ' · Owner shown is the owner of record on the list.'); box.appendChild(src);
    const tools = mk('div', 'lientools');
    const cs = mk('select'); cs.setAttribute('aria-label', 'County'); const counts = {}; AR_COSL.forEach(x => { counts[x[0]] = (counts[x[0]] || 0) + 1; });
    cs.appendChild(new Option('All counties', '')); Object.keys(counts).sort().forEach(c => cs.appendChild(new Option(c + ' (' + counts[c] + ')', c)));
    const q = mk('input'); q.type = 'search'; q.placeholder = 'Search parcel or owner'; q.setAttribute('aria-label', 'Search');
    const so = mk('select'); so.setAttribute('aria-label', 'Sort'); [['lo', 'Lowest starting bid'], ['hi', 'Highest starting bid'], ['new', 'Newest added'], ['ac', 'Most acres']].forEach(o => so.appendChild(new Option(o[1], o[0])));
    const bl = mk('label', 'chk'); const bc = mk('input'); bc.type = 'checkbox'; bl.append(bc, ' Only with bids');
    tools.append(cs, q, so, bl); box.appendChild(tools);
    const cnt = mk('p', 'muted small'); cnt.setAttribute('role', 'status'); box.appendChild(cnt);
    const wrap = mk('div', 'tablewrap'); box.appendChild(wrap);
    const more = mk('button', 'btn ghost', 'Show more'); more.type = 'button'; box.appendChild(more);
    let list = [], shown = 50;
    const draw = () => {
      wrap.textContent = ''; const t = mk('table', 'liens'), hr = t.createTHead().insertRow();
      ['County', 'Parcel', 'Owner', 'Acres', 'S-T-R', 'Starting bid', 'Current bid', 'Added'].forEach(h => hr.appendChild(mk('th', '', h)));
      const tb = t.createTBody();
      list.slice(0, shown).forEach(x => { const r = tb.insertRow(); [x[0], x[1], x[2], x[3] ? x[3] : '—', x[4] || '—', money(x[5]), x[6] ? money(x[6]) : 'No bids', x[7]].forEach(v => r.insertCell().textContent = v); });
      wrap.appendChild(t); cnt.textContent = 'Showing ' + Math.min(shown, list.length).toLocaleString('en-US') + ' of ' + list.length.toLocaleString('en-US'); more.hidden = shown >= list.length;
    };
    const apply = () => {
      const s = q.value.trim().toLowerCase();
      list = AR_COSL.filter(x => (!cs.value || x[0] === cs.value) && (!bc.checked || x[6] > 0) && (!s || (x[1] + ' ' + x[2]).toLowerCase().includes(s)));
      list.sort((a, b) => so.value === 'lo' ? a[5] - b[5] : so.value === 'hi' ? b[5] - a[5] : so.value === 'new' ? b[7].localeCompare(a[7]) : b[3] - a[3]);
      shown = 50; draw();
    };
    [cs, so, bc].forEach(x => x.addEventListener('change', apply)); q.addEventListener('input', apply); more.addEventListener('click', () => { shown += 50; draw(); });
    apply();
  }
};
