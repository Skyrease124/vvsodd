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
    const all = LIENS.filter(l => !county || l.county === county);
    const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x) e.textContent = x; return e; };
    host.appendChild(mk('h3', '', 'Liens' + (county ? ' in ' + county + ' County' : '')));
    if (!all.length) {
      host.appendChild(mk('p', 'muted', 'No liens are listed for this county yet. We only list liens copied from an official county list, with the source and date checked. New sale lists are expected in April and May 2027.'));
      return;
    }
    host.appendChild(mk('p', 'muted small', all.length + ' older liens (county-held certificates: not bought at the tax sale, so the county holds them). Copied from the county tax collector\u2019s official list. Face amount is the original tax debt; payoff is the total on the date of the file and keeps growing with interest. Confirm everything with the county before buying.'));
    const tools = mk('div', 'lientools');
    const q = mk('input'); q.type = 'search'; q.placeholder = 'Search parcel or description'; q.setAttribute('aria-label', 'Search liens');
    const yr = mk('select'); yr.setAttribute('aria-label', 'Tax year');
    const ys = Array.from(new Set(all.map(l => l.taxYear).filter(Boolean))).sort((a, b) => b - a);
    yr.appendChild(new Option('All tax years', '')); ys.forEach(y => yr.appendChild(new Option(String(y), String(y))));
    const sort = mk('select'); sort.setAttribute('aria-label', 'Sort');
    [['new', 'Newest sale first'], ['low', 'Smallest face amount'], ['high', 'Largest face amount']].forEach(o => sort.appendChild(new Option(o[1], o[0])));
    tools.append(q, yr, sort); host.appendChild(tools);
    const cnt = mk('p', 'muted small'); cnt.setAttribute('role', 'status'); host.appendChild(cnt);
    const wrap = mk('div', 'tablewrap'); host.appendChild(wrap);
    const more = mk('button', 'btn ghost', 'Show more'); host.appendChild(more);
    const money = n => '$' + Number(n).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    let shown = 50, list = [];
    function draw() {
      wrap.innerHTML = '';
      const t = mk('table', 'liens'), hr = t.createTHead().insertRow();
      ['County', 'Parcel (PIN)', 'Tax yr', 'Face', 'Rate', 'Payoff*', 'Sale date', 'Status', 'Description', 'Source / checked'].forEach(x => hr.appendChild(mk('th', '', x)));
      const tb = t.createTBody();
      list.slice(0, shown).forEach(l => {
        const r = tb.insertRow();
        [l.county, l.parcel, l.taxYear || '', money(l.amount), l.rate || '', l.payoff ? money(l.payoff) : '', l.saleDate, l.status, l.desc || ''].forEach((x, k) => { const c = r.insertCell(); c.textContent = x; if (k === 8) c.className = 'desc'; });
        const c = r.insertCell(), a = mk('a', '', 'Source'); a.href = l.source; a.target = '_blank'; a.rel = 'noopener noreferrer'; c.append(a, ' ' + l.checked);
      });
      wrap.appendChild(t);
      cnt.textContent = 'Showing ' + Math.min(shown, list.length) + ' of ' + list.length + ' (* payoff as of the source file date)';
      more.hidden = shown >= list.length;
    }
    function apply() {
      const s = q.value.trim().toLowerCase();
      list = all.filter(l => (!yr.value || String(l.taxYear) === yr.value) && (!s || (l.parcel + ' ' + (l.desc || '')).toLowerCase().indexOf(s) >= 0));
      list.sort((a, b) => sort.value === 'low' ? a.amount - b.amount : sort.value === 'high' ? b.amount - a.amount : (b.saleDate > a.saleDate ? 1 : -1));
      shown = 50; draw();
    }
    [q, yr, sort].forEach(e => e.addEventListener('input', apply));
    more.addEventListener('click', () => { shown += 100; draw(); });
    apply();
  }
};
