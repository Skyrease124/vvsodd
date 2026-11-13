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
    tools.appendChild(PaidDownload.button('Download list', 'arkansas-cosl-auction.csv', ['County', 'Parcel', 'Owner of record', 'Acres', 'Section-Township-Range', 'Starting bid', 'Current bid', 'Added on'], () => list.map(x => x.slice(0, 8))));
    const cnt = mk('p', 'muted small'); cnt.setAttribute('role', 'status'); box.appendChild(cnt);
    const wrap = mk('div', 'tablewrap'); box.appendChild(wrap);
    const more = mk('button', 'btn ghost', 'Show more'); more.type = 'button'; box.appendChild(more);
    let list = [], shown = 24;
    let view = 'cards';
    const vb = mk('button', 'btn small ghost', 'Table view'); vb.type = 'button'; tools.appendChild(vb);
    vb.addEventListener('click', () => { view = view === 'cards' ? 'table' : 'cards'; vb.textContent = view === 'cards' ? 'Table view' : 'Card view'; draw(); });
    const spec = x => ({file: 'ar.json', key: x[0] + '|' + x[1], parcel: x[1], desc: [x[4], x[3] ? x[3] + ' acres' : ''].filter(Boolean).join(' \u00B7 '), srcName: 'Arkansas statewide parcel map (Arkansas GIS Office)'});
    const drawCards = () => {
      wrap.textContent = ''; const g = mk('div', 'lcards');
      list.slice(0, shown).forEach(x => {
        const card = mk('article', 'lcardx'); const th = mk('div', 'lthumb loading'); card.appendChild(th); LandMap.thumb(spec(x), th);
        const h = mk('div', 'lch'); h.append(mk('b', '', x[1]), mk('span', 'small', x[0] + ' County' + (x[3] ? ' \u00B7 ' + x[3] + ' acres' : ''))); card.appendChild(h);
        const amt = mk('div', 'lamt'); amt.append(mk('span', 'small', 'Starting bid'), mk('b', '', money(x[5]))); card.appendChild(amt);
        card.appendChild(mk('div', 'small', x[6] ? 'Current bid: ' + money(x[6]) : 'No bids yet'));
        card.appendChild(mk('div', 'small muted', 'Owner of record: ' + x[2] + (x[4] ? ' \u00B7 ' + x[4] : '') + ' \u00B7 added ' + x[7]));
        const act = mk('div', 'lact'); const b = mk('button', 'btn small', 'Show on map'); b.type = 'button'; b.onclick = () => LandMap.open(spec(x)); act.appendChild(b);
        const hb = typeof LienBuy !== 'undefined' && LienBuy.button({state: 'AR', county: x[0], parcel: x[1], amount: x[5], buyKey: 'AR-COSL'}, 'btn small ghost'); if (hb) { hb.style.marginLeft = '6px'; act.appendChild(hb); }
        card.appendChild(act); g.appendChild(card);
      });
      wrap.appendChild(g); cnt.textContent = 'Showing ' + Math.min(shown, list.length).toLocaleString('en-US') + ' of ' + list.length.toLocaleString('en-US'); more.hidden = shown >= list.length;
    };
    const draw = () => { if (view === 'cards') return drawCards();
      wrap.textContent = ''; const t = mk('table', 'liens'), hr = t.createTHead().insertRow();
      ['County', 'Parcel', 'Owner', 'Acres', 'S-T-R', 'Starting bid', 'Current bid', 'Added', ''].forEach(h => hr.appendChild(mk('th', '', h)));
      const tb = t.createTBody();
      list.slice(0, shown).forEach(x => { const r = tb.insertRow(); [x[0], x[1], x[2], x[3] ? x[3] : '—', x[4] || '—', money(x[5]), x[6] ? money(x[6]) : 'No bids', x[7]].forEach(v => r.insertCell().textContent = v); const hb = typeof LienBuy !== 'undefined' && LienBuy.button({state: 'AR', county: x[0], parcel: x[1], amount: x[5], buyKey: 'AR-COSL'}, 'btn small ghost'); const cl = r.insertCell(); if (hb) cl.appendChild(hb); });
      wrap.appendChild(t); cnt.textContent = 'Showing ' + Math.min(shown, list.length).toLocaleString('en-US') + ' of ' + list.length.toLocaleString('en-US'); more.hidden = shown >= list.length;
    };
    const apply = () => {
      const s = q.value.trim().toLowerCase();
      list = AR_COSL.filter(x => (!cs.value || x[0] === cs.value) && (!bc.checked || x[6] > 0) && (!s || (x[1] + ' ' + x[2]).toLowerCase().includes(s)));
      list.sort((a, b) => so.value === 'lo' ? a[5] - b[5] : so.value === 'hi' ? b[5] - a[5] : so.value === 'new' ? b[7].localeCompare(a[7]) : b[3] - a[3]);
      shown = 24; draw();
    };
    [cs, so, bc].forEach(x => x.addEventListener('change', apply)); q.addEventListener('input', apply); more.addEventListener('click', () => { shown += 24; draw(); });
    apply();
  }
};
