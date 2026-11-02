// Renders STATE_DATA sections (sale rules and sale history) on a state page.
const StateExtra = {
  render(host, st) {
    const d = typeof STATE_DATA !== 'undefined' && STATE_DATA[st]; if (!d) return false;
    const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x) e.textContent = x; return e; };
    const link = (t, u) => { const a = mk('a', '', t); a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; };
    if (d.sale) {
      const box = mk('div', 'salebox'); box.appendChild(mk('h3', '', d.sale.title));
      const dl = mk('dl', 'stfacts'), row = mk('div'); row.append(mk('dt', '', 'When'), mk('dd', '', d.sale.when)); dl.appendChild(row); box.appendChild(dl);
      const ol = mk('ol', 'salesteps'); d.sale.steps.forEach(s => ol.appendChild(mk('li', '', s))); box.appendChild(ol);
      const p = mk('p', 'small'); d.sale.links.forEach((l, i) => { if (i) p.append(' · '); p.appendChild(link(l[0], l[1])); }); box.appendChild(p);
      host.appendChild(box);
    }
    if (d.history) {
      const h = d.history, box = mk('div', 'salebox'); box.appendChild(mk('h3', '', h.title)); box.appendChild(mk('p', 'muted small', h.note));
      const t = mk('table', 'liens'), hr = t.createTHead().insertRow();
      ['Tax year', 'Liens sold', 'Tax value', 'Avg rate', 'Still outstanding', 'Redeemed', '% redeemed'].forEach(x => hr.appendChild(mk('th', '', x)));
      const tb = t.createTBody(), n = v => Number(v).toLocaleString();
      h.rows.forEach(r => { const tr = tb.insertRow();
        [r.year, n(r.sold), '$' + Math.round(r.value).toLocaleString(), r.rate.toFixed(2) + '%', n(r.outstanding), n(r.redeemed), Math.round(100 * r.redeemed / r.sold) + '%'].forEach(x => { tr.insertCell().textContent = x; }); });
      const w = mk('div', 'tablewrap'); w.appendChild(t); box.appendChild(w);
      const p = mk('p', 'small'); p.appendChild(link('Source: Maricopa County Treasurer', h.source)); p.append(' · checked ' + h.checked); box.appendChild(p);
      host.appendChild(box);
    }
    if (d.sales) {
      const h = d.sales, box = mk('div', 'salebox'); box.appendChild(mk('h3', '', h.title)); box.appendChild(mk('p', 'muted small', h.note));
      const t = mk('table', 'liens'), hr = t.createTHead().insertRow();
      const hasCo = h.rows.some(r => r.county);
      ['Place', hasCo ? 'County' : null, 'Date', 'Time', 'How', 'Status', 'Link'].forEach(x => { if (x) hr.appendChild(mk('th', '', x)); });
      const tb = t.createTBody(), today = new Date().toISOString().slice(0, 10);
      h.rows.slice().sort((a, b) => b.date.localeCompare(a.date)).forEach(r => { const tr = tb.insertRow();
        [r.town, hasCo ? (r.county || '') : null, r.dateText || r.date, r.time || '', r.how, r.dateText ? 'Expected' : (r.date >= today ? 'Upcoming' : 'Past')].forEach(x => { if (x !== null) tr.insertCell().textContent = x; });
        const c = tr.insertCell(); c.appendChild(link(r.linkText, r.link)); });
      const w = mk('div', 'tablewrap'); w.appendChild(t); box.appendChild(w);
      const p = mk('p', 'small'); p.appendChild(link('Source: TCTANJ tax sales page', h.source)); p.append(' \u00b7 checked ' + h.checked); box.appendChild(p);
      host.appendChild(box);
    }
    if (d.counts) {
      const h = d.counts, box = mk('div', 'salebox'); box.appendChild(mk('h3', '', h.title)); box.appendChild(mk('p', 'muted small', h.note));
      const t = mk('table', 'liens'), hr = t.createTHead().insertRow(); h.head.forEach(x => hr.appendChild(mk('th', '', x)));
      const tb = t.createTBody(); let tot = 0;
      h.rows.forEach(r => { const tr = tb.insertRow(); tot += r[1]; r.forEach(x => { tr.insertCell().textContent = x; }); });
      const fr = tb.insertRow(); fr.insertCell().textContent = 'Total'; fr.insertCell().textContent = tot; fr.style.fontWeight = '700';
      const w = mk('div', 'tablewrap'); w.appendChild(t); box.appendChild(w);
      const p = mk('p', 'small'); p.appendChild(link('Source: Woodbury County Treasurer', h.source)); p.append(' \u00b7 checked ' + h.checked); box.appendChild(p);
      host.appendChild(box);
    }
    return true;
  }
};
