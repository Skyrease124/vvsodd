// Shared renderers for the Florida sale box and the lien table.
const LienUI = {
  saleBox(host, county) {
    const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x) e.textContent = x; return e; };
    const box = mk('div', 'salebox');
    box.appendChild(mk('h3', '', 'Tax certificate sale' + (county ? ' (' + county + ' County)' : ' (Florida)')));
    const dl = mk('dl', 'stfacts');
    [['Next sale', FL_SALE.nextSale], ['Lists posted', FL_SALE.listsPosted]].forEach(([k, v]) => { const d = mk('div'); d.append(mk('dt', '', k), mk('dd', '', v)); dl.appendChild(d); });
    box.appendChild(dl);
    const ol = mk('ol', 'salesteps'); FL_SALE.steps.forEach(s => ol.appendChild(mk('li', '', s))); box.appendChild(ol);
    const links = mk('p', 'small');
    const a = (t, u) => { const e = mk('a', '', t); e.href = u; e.target = '_blank'; e.rel = 'noopener noreferrer'; return e; };
    links.appendChild(a(FL_SALE.statute[0], FL_SALE.statute[1]));
    if (county) {
      if (FL_SALE.lists[county]) { links.append(' · '); links.appendChild(a('Official delinquent list page', FL_SALE.lists[county])); }
      if (FL_SALE.portalCounties.indexOf(county) >= 0) { links.append(' · '); links.appendChild(a(FL_SALE.portal[0] + ' (this county sells here)', FL_SALE.portal[1])); }
    }
    box.appendChild(links);
    host.appendChild(box);
  },
  table(host, county) {
    const rows = LIENS.filter(l => !county || l.county === county);
    const h = document.createElement('h3'); h.textContent = 'Liens' + (county ? ' in ' + county + ' County' : ''); host.appendChild(h);
    if (!rows.length) {
      const p = document.createElement('p'); p.className = 'muted';
      p.textContent = 'No liens are listed yet. We only list liens copied from an official county list, with the source and date checked. The 2027 sale lists are expected in April and May.';
      host.appendChild(p); return;
    }
    const t = document.createElement('table'); t.className = 'liens';
    const hr = t.createTHead().insertRow();
    ['County', 'Parcel', 'Amount', 'Sale date', 'Status', 'Source / checked'].forEach(x => { const th = document.createElement('th'); th.textContent = x; hr.appendChild(th); });
    const tb = t.createTBody();
    rows.forEach(l => {
      const r = tb.insertRow();
      [l.county, l.parcel, '$' + Number(l.amount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}), l.saleDate, l.status + (l.rate ? ' at ' + l.rate : '')].forEach(x => { r.insertCell().textContent = x; });
      const c = r.insertCell(); const a = document.createElement('a'); a.href = l.source; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = 'Source'; c.append(a, ' ' + l.checked);
    });
    const w = document.createElement('div'); w.className = 'tablewrap'; w.appendChild(t); host.appendChild(w);
  }
};
