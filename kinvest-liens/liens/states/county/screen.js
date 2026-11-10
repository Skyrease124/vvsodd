// "Find liens worth a closer look". Ranking is done by the server with fixed public rules; the AI only reads the wording and explains.
window.Screener = {mount(host, county) {
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x) e.textContent = x; return e; };
  const money = n => '$' + Math.round(n).toLocaleString('en-US');
  const base = location.pathname.replace(/liens\/states\/.*$/, '');
  const larimer = county === 'Larimer';
  host.innerHTML = '<div class="askbox" id="screenbox" hidden><h2>Find liens worth a closer look</h2>' +
    '<p class="small muted">Tell us what you want (or just press Screen). We rank ' + (larimer ? 'the advertised parcels' : county === 'Pinal' ? 'the liens on the Treasurer\u2019s list' : 'the county-held liens') + ' with fixed, public rules: how much county value sits behind the tax debt, ' + (larimer ? 'size of the debt, and red flags' : 'what type of property it is, size, and red flags') + '. The AI only reads your wording and explains the numbers. Research help, not advice.</p>' +
    '<p id="screengate" class="notice" hidden><b>\uD83D\uDD12 Paid members only.</b> <a href="' + base + 'login/">Sign in</a> or <a href="' + base + 'account/?mode=up">create a free account</a>. The AI screener is for paid members ($5.50 a week).</p>' +
    '<div class="askchips" id="screenchips"></div>' +
    '<form id="screenform"><input id="screenq" type="text" maxlength="300" placeholder="' + (larimer ? 'Example: tax owed under $2,000, county value over $100,000' : 'Example: vacant land under $1,500 debt, at least 0.2 acres') + '" aria-label="What are you looking for?" style="width:100%;box-sizing:border-box;padding:10px;font:inherit;border:1px solid var(--line);border-radius:8px;margin-bottom:8px"><label class="chk small" style="display:block;margin:0 0 8px"><input type="checkbox" id="screenall"> Also show mineral rights, strips, easements and tiny slivers</label><button class="btn" id="screengo" type="submit">Screen</button></form>' +
    '<div id="screenout" hidden role="status"></div>' +
    '<details class="small"><summary>How we rank</summary><p>Start at 50. Add points for a county value many times the tax debt' + (larimer ? ' and a small debt' : ', a buildable property type, a lot of 0.1 to 5 acres and a small debt') + '. Subtract points for lots valued under the debt' + (larimer ? ', descriptions that mention an outlot, tract, road or common area, and a county value under $1,000' : ', road, utility and water strips, tiny slivers, government land, homesteads and many unpaid years') + '. The county value is an assessment, not a sale price, and can be wrong.' + (larimer ? ' Larimer\u2019s list has no property type or lot size, so the ranking is thinner than for Palm Beach. These parcels are not sold yet, and many owners pay before the sale.' : '') + '</p></details></div>';
  const $ = id => host.querySelector('#' + id);
  const box = $('screenbox'), gate = $('screengate'), form = $('screenform'), chips = $('screenchips');
  fetch('/.netlify/functions/screen').then(r => r.ok ? r.json() : null).then(d => {
    if (!d || !d.enabled) return;
    box.hidden = false; const ok = !!d.signedIn && !!d.paid; gate.hidden = ok; form.hidden = chips.hidden = !ok;
    if (d.signedIn && !d.paid) { gate.innerHTML = '<b>\uD83D\uDD12 Paid members only.</b> Your account is free, so the AI screener is locked. Paid members ($5.50 a week) can use it. <a href="' + base + 'account/">See my plan</a>'; }
  }).catch(() => {});
  const input = $('screenq'), out = $('screenout'), go = $('screengo');
  (larimer ? [['Best cushion', ''], ['Smallest tax owed', 'smallest tax owed'], ['Highest county value', 'highest county value'], ['Under $2,000 owed, worth over $100,000', 'tax owed under $2,000 and county value over $100,000']] : [['Best cushion', ''], ['Cheapest vacant lots', 'cheapest vacant lots'], ['Vacant, 0.25 acres or more', 'vacant land of at least a quarter acre, tax debt under $2,000'], ['Highest land value', 'highest county land value']]).forEach(([t, w]) => {
    const b = mk('button', 'chipbtn', t); b.type = 'button'; b.addEventListener('click', () => { input.value = w; run(); }); chips.appendChild(b);
  });
  function lienFor(r) { return {county: r.county, parcel: r.parcel, amount: r.face, rate: r.rate, market: r.market, use: r.use, acres: r.acres, desc: r.desc}; }
  function card(r, i) {
    const c = mk('article', 'scard');
    const h = mk('div', 'scardh'); h.append(mk('b', '', (i + 1) + '. Parcel ' + r.parcel), mk('span', 'sscore', 'Screen score ' + r.score + '/100'));
    c.appendChild(h);
    c.appendChild(mk('p', 'small muted', [r.area, r.use && r.use.toLowerCase(), r.acres != null && r.acres + ' acres'].filter(Boolean).join(' · ')));
    const dl = mk('dl', 'stfacts');
    [['County land value', r.market != null ? money(r.market) : 'unknown'], ['Tax debt (face)', '$' + r.face.toFixed(2)], ['Payoff on file date', '$' + r.payoff.toFixed(2) + (r.rate ? ' at ' + r.rate : '')], ['Unpaid tax years', r.years.length ? r.years.join(', ') : 'not listed'], ['Last recorded sale', r.lastPrice ? (r.lastPrice < 1000 ? 'nominal transfer, ' + money(r.lastPrice) : money(r.lastPrice)) + ' (' + r.lastSale + ')' : 'none on file']].forEach(([k, v]) => { const d = mk('div'); d.append(mk('dt', '', k), mk('dd', '', v)); dl.appendChild(d); });
    c.appendChild(dl);
    const fl = mk('ul', 'sflags');
    r.green.forEach(t => fl.appendChild(mk('li', 'g', t))); r.red.forEach(t => fl.appendChild(mk('li', 'r', t)));
    c.appendChild(fl);
    c.appendChild(mk('p', 'small', (r.aiNote ? 'AI summary: ' : '') + r.note));
    const act = mk('div', 'sact');
    const mb = mk('button', 'btn small', 'Show on map'); mb.type = 'button'; mb.addEventListener('click', () => LienMap.open(lienFor(r))); act.appendChild(mb);
    const cb = mk('a', 'btn small ghost', 'Calculate');
    cb.href = '../../?' + new URLSearchParams({amount: r.face, rate: String(r.rate || '').replace('%', ''), months: 24, fees: 0, from: r.county + ' parcel ' + r.parcel}).toString() + '#calculator';
    act.appendChild(cb);
    const bb = typeof LienBuy !== 'undefined' ? LienBuy.button({county: r.county, parcel: r.parcel, amount: r.face, certList: r.certList, saleDate: r.saleDate}, 'btn small') : null; if (bb) act.appendChild(bb);
    act.appendChild(LienSave.button({county: r.county, parcel: r.parcel, face: r.face, market: r.market, use: r.use, acres: r.acres, certList: r.certList, saleDate: r.saleDate}, 'btn small ghost')); c.appendChild(act);
    return c;
  }
  async function run() {
    out.hidden = false; out.className = 'askout'; out.textContent = 'Screening…';
    go.disabled = true;
    try {
      const r = await fetch('/.netlify/functions/screen', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({county, wish: input.value, showAll: !!(host.querySelector('#screenall') || {}).checked})});
      const d = await r.json();
      if (r.status === 402) { gate.hidden = false; gate.innerHTML = '<b>\uD83D\uDD12 Paid members only.</b> The AI screener is locked for free accounts. <a href="' + base + 'account/">See my plan</a>'; form.hidden = chips.hidden = true; out.hidden = true; return; }
      if (r.status === 401) { gate.hidden = false; form.hidden = chips.hidden = true; out.hidden = true; return; }
      if (!r.ok) { out.className = 'askout err'; out.textContent = d.error || 'Something went wrong.'; return; }
      out.className = 'askout ok'; out.textContent = '';
      out.appendChild(mk('p', 'small muted', 'Screened ' + d.total + (county === 'Larimer' ? ' advertised parcels (not sold yet); ' : county === 'Pinal' ? ' parcels on the Treasurer\u2019s list; ' : ' parcels with county-held certificates; ') + d.matched + ' fit' + (input.value.trim() && !d.understood ? ' (I could not read your wording, so the standard screen was used)' : '') + '. Showing the top ' + d.results.length + '. Road strips, water, utility strips, government land, homesteads and lots valued below the debt are left out.'));
      if (d.junkCount && d.filters && d.filters.hideJunk) out.appendChild(mk('p', 'small', d.junkCount + ' parcel' + (d.junkCount === 1 ? ' was' : 's were') + ' left out because they look like mineral rights, strips, easements or tiny slivers. Tick the box above to include them.'));
      if (!d.results.length) out.appendChild(mk('p', '', 'Nothing matched. Try loosening your wording.'));
      d.results.forEach((x, i) => out.appendChild(card(x, i)));
      out.appendChild(mk('p', 'small muted', 'A high score only means the numbers look worth reading about. It is not a recommendation and not a prediction. Many cheap certificates are cheap for a reason: access, flooding, liens that survive, or a county value that is out of date. Look up the owner, tax history and lot on the county site before doing anything.'));
    } catch (e) { out.className = 'askout err'; out.textContent = 'Could not reach the screener. Please try again.'; }
    finally { go.disabled = false; }
  }
  form.addEventListener('submit', e => { e.preventDefault(); run(); });
}};
