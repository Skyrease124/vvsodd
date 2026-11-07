// New York City tax lien sale history (summary numbers only). Renders into a host element on the New York state page.
const NycUI = {
  render(host) {
    const H = NYC_HISTORY, mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
    const n = v => v == null ? '–' : Number(v).toLocaleString('en-US');
    const box = mk('div', 'salebox nyc');
    box.appendChild(mk('h3', '', 'New York City: tax lien sale history'));
    box.appendChild(mk('p', 'small muted', 'The city publishes lists of properties heading toward its tax lien sale: unpaid property tax, water bills and other charges. Notices go out at 90, 60, 30 and 10 days, then the property is either dropped from the list (for example, the debt was paid) or goes to the Final Sale. The city sells these liens in bulk, not to individual investors, so this is here to learn from, not to buy from.'));
    const dl = mk('dl', 'stfacts');
    [['Properties on the lists, 2019 to 2025', n(H.properties)], ['Reached a Final Sale', n(H.reachedSale)], ['Yearly cycles in the file', H.cycles.map(c => c.year).join(', ')]].forEach(([k, v]) => { const d = mk('div'); d.append(mk('dt', '', k), mk('dd', '', v)); dl.appendChild(d); });
    box.appendChild(dl);
    const tabs = mk('div', 'askchips'); const body = mk('div');
    function show(c) {
      body.textContent = '';
      const first = c.stages['90'], stages = [['90 days', '90'], ['60 days', '60'], ['30 days', '30'], ['10 days', '10'], ['Final Sale', 'sale']];
      body.appendChild(mk('h4', '', c.year + ' cycle: how many properties stayed on the list'));
      stages.forEach(([label, k]) => {
        const v = c.stages[k], row = mk('div', 'nycrow');
        const bar = mk('div', 'nycbar'), fill = mk('i'); fill.style.width = v == null ? '0%' : Math.max(2, Math.round(100 * v / first)) + '%'; if (k === 'sale') fill.className = 'sale'; bar.appendChild(fill);
        row.append(mk('span', 'nyclab', label), bar, mk('span', 'nycval', v == null ? 'no list in the file' : n(v) + ' (' + Math.round(100 * v / first) + '%)'));
        body.appendChild(row);
      });
      if (c.stages.sale != null) body.appendChild(mk('p', 'small', 'About ' + Math.round(100 * c.stages.sale / first) + ' of every 100 properties on the 90-day notice reached the Final Sale. Every Final Sale property had been on that cycle’s 90-day list.'));
      const t = mk('table', 'liens'), hr = t.createTHead().insertRow();
      ['Borough', '90-day notice', 'Final Sale', 'Share that reached sale'].forEach(x => hr.appendChild(mk('th', '', x)));
      const tb = t.createTBody();
      H.boroughNames.forEach(b => { const r = tb.insertRow(); const f = c.boroughs['90'][b], s = c.boroughs.sale ? c.boroughs.sale[b] : null; [b, n(f), n(s), s == null || !f ? '–' : Math.round(100 * s / f) + '%'].forEach(x => r.insertCell().textContent = x); });
      const wrap = mk('div', 'tablewrap'); wrap.appendChild(t); body.appendChild(wrap);
      if (c.waterOnly['90'] != null) body.appendChild(mk('p', 'small', 'Water debt only: ' + c.waterOnly['90'] + '% of the 90-day list' + (c.waterOnly.sale != null ? ' and ' + c.waterOnly.sale + '% of the Final Sale list.' : '.')));
      else body.appendChild(mk('p', 'small muted', 'The ' + c.year + ' lists do not say which properties owe only water charges.'));
    }
    H.cycles.slice().reverse().forEach((c, i) => { const b = mk('button', 'chipbtn', String(c.year)); b.type = 'button'; b.addEventListener('click', () => { tabs.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); show(c); }); if (i === 0) b.classList.add('on'); tabs.appendChild(b); });
    box.append(tabs, body);
    show(H.cycles[H.cycles.length - 1]);
    box.appendChild(mk('p', 'small muted', 'Source: ' + H.source + '. ' + H.note + ' Counts only: no owner names, addresses or dollar amounts are shown. Educational only; confirm anything with the NYC Department of Finance.'));
    host.appendChild(box);
  }
};
