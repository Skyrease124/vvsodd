// "Find liens worth a closer look" box (Palm Beach). Ranking is done by the server with fixed public rules.
(function () {
  const box = document.getElementById('screenbox'); if (!box) return;
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x) e.textContent = x; return e; };
  const money = n => '$' + Math.round(n).toLocaleString('en-US');
  const county = new URLSearchParams(location.search).get('c') || '';
  if (county !== 'Palm Beach') return;
  fetch('/.netlify/functions/screen').then(r => r.ok ? r.json() : null).then(d => { if (d && d.enabled) box.hidden = false; }).catch(() => {});
  const input = document.getElementById('screenq'), out = document.getElementById('screenout'), go = document.getElementById('screengo');
  [['Best cushion', ''], ['Cheapest vacant lots', 'cheapest vacant lots'], ['Vacant, 0.25 acres or more', 'vacant land of at least a quarter acre, tax debt under $2,000'], ['Highest land value', 'highest county land value']].forEach(([t, w]) => {
    const b = mk('button', 'chipbtn', t); b.type = 'button'; b.addEventListener('click', () => { input.value = w; run(); }); document.getElementById('screenchips').appendChild(b);
  });
  function lienFor(r) { return {county: r.county, parcel: r.parcel, amount: r.face, rate: r.rate, market: r.market, use: r.use, acres: r.acres, desc: r.desc}; }
  function card(r, i) {
    const c = mk('article', 'scard');
    const h = mk('div', 'scardh'); h.append(mk('b', '', (i + 1) + '. Parcel ' + r.parcel), mk('span', 'sscore', 'Screen score ' + r.score + '/100'));
    c.appendChild(h);
    c.appendChild(mk('p', 'small muted', [r.area, r.use && r.use.toLowerCase(), r.acres != null && r.acres + ' acres'].filter(Boolean).join(' · ')));
    const dl = mk('dl', 'stfacts');
    [['County land value', r.market != null ? money(r.market) : 'unknown'], ['Tax debt (face)', '$' + r.face.toFixed(2)], ['Payoff on file date', '$' + r.payoff.toFixed(2) + ' at ' + (r.rate || '?')], ['Unpaid tax years', r.years.join(', ')], ['Last recorded sale', r.lastPrice ? (r.lastPrice < 1000 ? 'nominal transfer, ' + money(r.lastPrice) : money(r.lastPrice)) + ' (' + r.lastSale + ')' : 'none on file']].forEach(([k, v]) => { const d = mk('div'); d.append(mk('dt', '', k), mk('dd', '', v)); dl.appendChild(d); });
    c.appendChild(dl);
    const fl = mk('ul', 'sflags');
    r.green.forEach(t => fl.appendChild(mk('li', 'g', t))); r.red.forEach(t => fl.appendChild(mk('li', 'r', t)));
    c.appendChild(fl);
    c.appendChild(mk('p', 'small', (r.aiNote ? 'AI summary: ' : '') + r.note));
    const act = mk('div', 'sact');
    const mb = mk('button', 'btn small', 'Show on map'); mb.type = 'button'; mb.addEventListener('click', () => LienMap.open(lienFor(r))); act.appendChild(mb);
    const cb = mk('a', 'btn small ghost', 'Calculate');
    cb.href = '../../?' + new URLSearchParams({amount: r.face, rate: String(r.rate || '').replace('%', ''), months: 24, fees: 0, from: 'Palm Beach parcel ' + r.parcel}).toString() + '#calculator';
    act.appendChild(cb); c.appendChild(act);
    return c;
  }
  async function run() {
    out.hidden = false; out.className = 'askout'; out.textContent = 'Screening…';
    go.disabled = true;
    try {
      const r = await fetch('/.netlify/functions/screen', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({county, wish: input.value})});
      const d = await r.json();
      if (!r.ok) { out.className = 'askout err'; out.textContent = d.error || 'Something went wrong.'; return; }
      out.className = 'askout ok'; out.textContent = '';
      out.appendChild(mk('p', 'small muted', 'Screened ' + d.total + ' parcels with county-held certificates; ' + d.matched + ' fit' + (input.value.trim() && !d.understood ? ' (I could not read your wording, so the standard screen was used)' : '') + '. Showing the top ' + d.results.length + '. Road strips, water, utility strips, government land, homesteads and lots valued below the debt are left out.'));
      if (!d.results.length) out.appendChild(mk('p', '', 'Nothing matched. Try loosening your wording.'));
      d.results.forEach((x, i) => out.appendChild(card(x, i)));
      out.appendChild(mk('p', 'small muted', 'A high score only means the numbers look worth reading about. It is not a recommendation and not a prediction. Many cheap certificates are cheap for a reason: access, flooding, liens that survive, or a county value that is out of date. Look up the owner, tax history and lot on the county site before doing anything.'));
    } catch (e) { out.className = 'askout err'; out.textContent = 'Could not reach the screener. Please try again.'; }
    finally { go.disabled = false; }
  }
  document.getElementById('screenform').addEventListener('submit', e => { e.preventDefault(); run(); });
})();
