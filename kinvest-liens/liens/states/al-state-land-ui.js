// Map + satellite preview: lot outline from the county's own GIS (parcels/al-<code>.json, exact parcel-ID matches only), imagery drawn live from Esri.
const AlStateLandUI = {
  render(host) {
    const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
    const money = n => '$' + Number(n).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    const all = []; AL_STATE_LAND.forEach(c => c.rows.forEach(r => all.push({c, r})));
    const box = mk('div', 'salebox'); host.appendChild(box);
    box.appendChild(mk('h3', '', 'State-held tax delinquent land (Alabama Department of Revenue)'));
    box.appendChild(mk('p', 'small', all.length.toLocaleString('en-US') + ' parcels in ' + AL_STATE_LAND.length + ' county lists that the State of Alabama bought in at past tax sales and now offers for sale. The amount shown is what was bid at the original tax sale, not today’s price: taxes, interest and fees have been added since. Ask the Department of Revenue for the current price before you apply.'));
    const src = mk('p', 'small'); AL_STATE_LAND.forEach((c, i) => { if (i) src.append(' · '); const a = mk('a', '', c.county + ' transcript (' + c.date + ')'); a.href = c.source; a.target = '_blank'; a.rel = 'noopener noreferrer'; src.append(a); });
    src.append(' · '); const h = mk('a', '', 'How to buy (ADOR)'); h.href = 'https://www.revenue.alabama.gov/property-tax/tax-delinquent-property-and-land-sales/'; h.target = '_blank'; h.rel = 'noopener noreferrer'; src.append(h, ' · Owner shown is the owner of record on the transcript.'); box.appendChild(src);
    const tools = mk('div', 'lientools');
    const cs = mk('select'); cs.setAttribute('aria-label', 'County'); cs.appendChild(new Option('All counties', '')); AL_STATE_LAND.forEach(c => cs.appendChild(new Option(c.county + ' (' + c.rows.length + ')', c.co)));
    const q = mk('input'); q.type = 'search'; q.placeholder = 'Search owner, parcel or description'; q.setAttribute('aria-label', 'Search');
    const so = mk('select'); so.setAttribute('aria-label', 'Sort'); [['lo', 'Lowest amount'], ['hi', 'Highest amount'], ['new', 'Most recent tax sale'], ['old', 'Oldest tax sale']].forEach(o => so.appendChild(new Option(o[1], o[0])));
    tools.append(cs, q, so); box.appendChild(tools);
    const cnt = mk('p', 'muted small'); cnt.setAttribute('role', 'status'); box.appendChild(cnt);
    const wrap = mk('div', 'tablewrap'); box.appendChild(wrap);
    const more = mk('button', 'btn ghost', 'Show more'); more.type = 'button'; box.appendChild(more);
    let list = [], shown = 24;
    let view = 'cards';
    const vb = mk('button', 'btn small ghost', 'Table view'); vb.type = 'button'; tools.appendChild(vb);
    vb.addEventListener('click', () => { view = view === 'cards' ? 'table' : 'cards'; vb.textContent = view === 'cards' ? 'Table view' : 'Card view'; draw(); });
    const drawCards = () => {
      wrap.textContent = ''; const g = mk('div', 'lcards');
      list.slice(0, shown).forEach(({c, r}) => {
        const card = mk('article', 'lcardx'); const th = mk('div', 'lthumb loading'); card.appendChild(th); LandMap.thumb({file: 'al-' + c.co + '.json', key: r[4], parcel: r[4], desc: r[5], srcName: c.county + ' GIS'}, th);
        const h = mk('div', 'lch'); h.append(mk('b', '', r[4] || 'No parcel ID'), mk('span', 'small', c.county.replace(' County', '') + ' \u00B7 tax sale ' + r[1])); card.appendChild(h);
        const amt = mk('div', 'lamt'); amt.append(mk('span', 'small', 'Bid at the tax sale (not today\u2019s price)'), mk('b', '', r[6] == null ? 'Not shown' : money(r[6]))); card.appendChild(amt);
        card.appendChild(mk('div', 'small', r[5]));
        card.appendChild(mk('div', 'small muted', 'Owner of record: ' + r[0] + ' \u00B7 cert ' + r[2]));
        const act = mk('div', 'lact'); const b = mk('button', 'btn small', 'Show on map'); b.type = 'button'; b.onclick = () => LandMap.open({file: 'al-' + c.co + '.json', key: r[4], parcel: r[4], desc: r[5], srcName: c.county + ' GIS'}); act.appendChild(b); const hb = typeof LienBuy !== 'undefined' && LienBuy.button({state: 'AL', county: c.county.replace(' County', ''), parcel: r[4], cert: r[2], amount: r[6], buyKey: 'AL-ADOR', alCounty: c.county, alDate: c.date, desc: r[5]}, 'btn small ghost'); if (hb) { hb.style.marginLeft = '6px'; act.appendChild(hb); } card.appendChild(act);
        g.appendChild(card);
      });
      wrap.appendChild(g); cnt.textContent = 'Showing ' + Math.min(shown, list.length).toLocaleString('en-US') + ' of ' + list.length.toLocaleString('en-US'); more.hidden = shown >= list.length;
    };
    const draw = () => { if (view === 'cards') return drawCards();
      wrap.textContent = ''; const t = mk('table', 'liens'), hr = t.createTHead().insertRow();
      ['County', 'Parcel', 'Owner of record', 'Description', 'Tax sale year', 'Cert #', 'Bid at tax sale', ''].forEach(x => hr.appendChild(mk('th', '', x)));
      const tb = t.createTBody();
      list.slice(0, shown).forEach(({c, r}) => { const row = tb.insertRow(); [c.county.replace(' County', ''), r[4], r[0], r[5], r[1], r[2], r[6] == null ? 'Not shown' : money(r[6])].forEach(v => row.insertCell().textContent = v); const b = mk('button', 'btn small ghost', 'Map'); b.type = 'button'; b.onclick = () => LandMap.open({file: 'al-' + c.co + '.json', key: r[4], parcel: r[4], desc: r[5], srcName: c.county + ' GIS'}); row.insertCell().appendChild(b); });
      wrap.appendChild(t); cnt.textContent = 'Showing ' + Math.min(shown, list.length).toLocaleString('en-US') + ' of ' + list.length.toLocaleString('en-US'); more.hidden = shown >= list.length;
    };
    const apply = () => {
      const s = q.value.trim().toLowerCase();
      list = all.filter(({c, r}) => (!cs.value || c.co === cs.value) && (!s || (r[0] + ' ' + r[4] + ' ' + r[5]).toLowerCase().includes(s)));
      list.sort((a, b) => so.value === 'lo' ? (a.r[6] ?? 1e12) - (b.r[6] ?? 1e12) : so.value === 'hi' ? (b.r[6] ?? -1) - (a.r[6] ?? -1) : so.value === 'new' ? b.r[1].localeCompare(a.r[1]) : a.r[1].localeCompare(b.r[1]));
      shown = 24; draw();
    };
    [cs, so].forEach(x => x.addEventListener('change', apply)); q.addEventListener('input', apply); more.addEventListener('click', () => { shown += 24; draw(); });
    apply();
  }
};
