// Tax Sale Radar: What Changed, three map views, legend, state bottom panel, Find a state, Find my deal.
// Data: liens/states/radar.json (built by tools/radar/build.py from official county imports) + the existing STATES / STATE_DATA files.
// Nothing here is invented: if there is no verified listing or update, the page says so.
window.TaxRadarOn = true;
(function () {
  const $ = id => document.getElementById(id);
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const money = n => n == null ? '' : '$' + Number(n).toLocaleString('en-US', {minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2, maximumFractionDigits: 2});
  const NS = 'http://www.w3.org/2000/svg', mks = (t, a) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); return e; };
  const TODAY = new Date().toISOString().slice(0, 10);
  const SS = (() => { try { return window.sessionStorage; } catch (e) { return null; } })();
  const LS = (() => { try { return window.localStorage; } catch (e) { return null; } })();
  const saved = (() => { try { return JSON.parse((SS && SS.getItem('ppa_radar')) || '{}'); } catch (e) { return {}; } })();
  const S = {tab: saved.tab || 'opp', vac: !!saved.vac, types: new Set(saved.types || ['county-held', 'lien-sale', 'deed']), budget: saved.budget == null ? null : saved.budget, month: -1, sel: saved.sel || null, data: null};
  const persist = () => { try { SS && SS.setItem('ppa_radar', JSON.stringify({tab: S.tab, vac: S.vac, types: [...S.types], budget: S.budget, sel: S.sel, fOpen: typeof fOpen === 'undefined' ? false : fOpen})); } catch (e) {} };
  const TYPES = [['county-held', 'County-Held Liens'], ['lien-sale', 'Advertised Lien Sales'], ['deed', 'Tax Deed Auctions']];
  const GROUP_LABEL = {'county-held': 'County-held', 'lien-sale': 'Advertised sale', 'deed': 'Tax deed'};
  const fmtDate = d => { if (!d) return ''; const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}); };
  const bis = (a, x) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] <= x) lo = m + 1; else hi = m; } return lo; };   // count of values <= x

  // ---- filtering ("Find my deal")
  const filtersOn = () => S.vac || S.budget != null || S.types.size !== 3;
  // listings in county c that match the current filters (only listings that are open now)
  function matches(c) {
    if (!S.types.has(c.group)) return 0;
    const arr = S.vac ? c.vac : c.amounts;
    return S.budget == null ? arr.length : bis(arr, S.budget);
  }

  // ---- What Changed
  function since() {
    let last = null; try { last = LS && LS.getItem('ppa_last_visit'); } catch (e) {}
    if (last && /^\d{4}-\d\d-\d\d$/.test(last)) return {from: last, label: 'Since your last visit (' + fmtDate(last) + ')', prior: true};
    const d = new Date(); d.setDate(d.getDate() - 7); return {from: d.toISOString().slice(0, 10), label: 'Past 7 days', prior: false};
  }
  const TLAB = {new_list: 'New list', amount: 'Amount changed', schedule: 'Sale date changed', canceled: 'Sale canceled', result: 'Results published', missing: 'No longer listed', added: 'Listing added'};
  const TICON = {new_list: '★', amount: '$', schedule: '⏰', canceled: '✕', result: '✓', missing: '?', added: '+'};
  let W = since(), changes = [];
  function renderWhat() {
    const box = $('rwhat'); box.textContent = ''; changes = S.data.changes.filter(c => c.detectedAt >= W.from);
    const h = mk('h2', '', 'What Changed'); h.id = 'rwhath'; const sub = mk('span', 'rwhen', W.label); h.appendChild(sub); box.appendChild(h);
    const tr = S.data.counties.filter(c => c.tracked).length;
    if (!changes.length) {
      box.appendChild(mk('p', 'rempty', 'No updates detected ' + (W.prior ? 'since your last visit' : 'in the past 7 days') + '. We compare each new official county list with the last complete one (' + tr + ' counties tracked), and only real differences show here.'));
      if (W.prior) { const b = mk('button', 'rlink', 'Show the past 7 days instead'); b.type = 'button'; b.addEventListener('click', () => { const d = new Date(); d.setDate(d.getDate() - 7); W = {from: d.toISOString().slice(0, 10), label: 'Past 7 days', prior: false}; renderWhat(); renderMap(); }); box.appendChild(b); }
      return;
    }
    const counts = {}; changes.forEach(c => { counts[c.type] = (counts[c.type] || 0) + 1; });
    const chips = mk('div', 'rchips'); Object.keys(TLAB).filter(t => counts[t]).forEach(t => { const x = mk('button', 'rchip t-' + t); x.type = 'button'; x.setAttribute('aria-pressed', String(filterType === t)); x.append(mk('b', '', TICON[t]), ' ' + TLAB[t] + ' ' + counts[t]); x.addEventListener('click', () => { filterType = filterType === t ? null : t; feedOpen = true; renderWhat(); }); chips.appendChild(x); });
    box.appendChild(chips);
    const list = changes.filter(c => !filterType || c.type === filterType), ul = mk('ul', 'rfeed');
    const rank = {canceled: 0, schedule: 1, amount: 2, result: 3, missing: 4, added: 5, new_list: 6};
    list.sort((a, b) => rank[a.type] - rank[b.type] || b.detectedAt.localeCompare(a.detectedAt));
    const tog = mk('button', 'rlink rtoggle', feedOpen ? 'Hide' : 'Show all ' + list.length); tog.type = 'button'; tog.setAttribute('aria-expanded', String(feedOpen)); tog.addEventListener('click', () => { feedOpen = !feedOpen; renderWhat(); }); box.querySelector('h2').appendChild(tog);
    if (!feedOpen) return;
    const shown = showAll ? list : list.slice(0, 4);
    shown.forEach(c => ul.appendChild(changeItem(c)));
    box.appendChild(ul);
    if (list.length > 4) { const b = mk('button', 'rlink', showAll ? 'Show fewer' : 'Show all ' + list.length + ' updates'); b.type = 'button'; b.addEventListener('click', () => { showAll = !showAll; renderWhat(); }); box.appendChild(b); }
  }
  let filterType = null, showAll = false, feedOpen = false;
  function changeItem(c) {
    const li = mk('li', 'rchange t-' + c.type); li.dataset.state = c.state;
    const top = mk('div', 'rctop'); top.append(mk('span', 'rbadge t-' + c.type, TICON[c.type] + ' ' + TLAB[c.type]), mk('b', '', c.county + ', ' + c.state)); li.appendChild(top);
    li.appendChild(mk('p', '', c.text));
    if (c.type === 'amount') { const u = mk('ul', 'rold'); const seen = new Set(); c.items.filter(i => i.field === 'amount' || !c.items.some(j => j.key === i.key && j.field === 'amount')).slice(0, 4).forEach(i => { const k = i.key + i.field; if (seen.has(k)) return; seen.add(k); u.appendChild(mk('li', '', i.parcel + ' · ' + (i.field === 'payoff' ? 'payoff' : 'amount') + ' ' + money(i.old) + ' → ' + money(i.new))); }); li.appendChild(u); }
    if (c.type === 'result' && c.prices) li.appendChild(mk('p', 'small', 'Actual sale prices from ' + money(c.prices.min) + ' to ' + money(c.prices.max) + ' (first ' + c.items.length + ' shown by price order on the county page).'));
    if (c.type === 'missing') li.appendChild(mk('p', 'small', 'Not called sold, redeemed or withdrawn: that needs an official record.'));
    const meta = mk('p', 'small rmeta', 'Detected ' + fmtDate(c.detectedAt) + (c.publishedAt ? ' · published ' + fmtDate(c.publishedAt) : '') + ' · '); const a = mk('a', '', 'Source: ' + (c.source.name || 'official record')); a.href = c.source.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; meta.appendChild(a); li.appendChild(meta);
    const act = mk('div', 'ract'); const b1 = mk('button', 'btn small', 'Show on map'); b1.type = 'button'; b1.addEventListener('click', () => { openState(c.state, c.id); document.getElementById('usmap').scrollIntoView({block: 'center', behavior: 'smooth'}); });
    const l1 = mk('a', 'btn small ghost', 'See affected listings'); l1.href = c.link + '#' + encodeURIComponent(c.county);
    act.append(b1, l1); const it = c.items[0]; if (it && it.key) { const l2 = mk('a', 'btn small ghost', 'Open parcel ' + it.parcel); l2.href = '/liens/parcel/?k=' + encodeURIComponent(it.key); act.appendChild(l2); }
    li.appendChild(act); return li;
  }

  // ---- map markers
  let layer = null, M = null, by = {};
  const stateCounties = a => S.data.counties.filter(c => c.state === a);
  // markers are drawn bigger on small screens so a fingertip can hit them (about 30 px on screen)
  const KS = () => { const w = M && M.svg.getBoundingClientRect().width; const u = w ? w / 975 : 1; return Math.max(1, Math.min(2.8, 30 / (24 * u))); };
  let K = 1;
  function markerShape(kind, x, y, label) {
    const g = mks('g', {class: 'rmark k-' + kind, transform: 'translate(' + x + ',' + y + ') scale(' + K + ')'});
    if (kind === 'held') { g.appendChild(mks('rect', {x: -11, y: -11, width: 22, height: 22, rx: 6})); g.appendChild(mks('text', {class: 'rm-t', y: 5}, 0)); g.lastChild.textContent = 'H'; }
    else if (kind === 'auction') { g.appendChild(mks('circle', {r: 12})); const gv = mks('g', {class: 'rm-gavel', transform: 'rotate(-35)'}); gv.appendChild(mks('rect', {x: -6, y: -8, width: 12, height: 6, rx: 1.5})); gv.appendChild(mks('rect', {x: -1.4, y: -3, width: 2.8, height: 12, rx: 1.2})); g.appendChild(gv); }
    else if (kind === 'tentative') { g.appendChild(mks('circle', {r: 12})); const t = mks('text', {class: 'rm-t', y: 5}); t.textContent = '?'; g.appendChild(t); }
    else if (kind === 'canceled') { g.appendChild(mks('circle', {r: 12})); const t = mks('text', {class: 'rm-t', y: 5}); t.textContent = '✕'; g.appendChild(t); }
    else if (kind === 'sold') { g.appendChild(mks('circle', {r: 12})); const t = mks('text', {class: 'rm-t', y: 5}); t.textContent = '$'; g.appendChild(t); }
    else if (kind === 'records') { g.appendChild(mks('circle', {r: 12})); const t = mks('text', {class: 'rm-t', y: 5}); t.textContent = '≡'; g.appendChild(t); }
    return g;
  }
  function addMarker(a, kind, dx, dy, name, extra) {
    const pos = (typeof MAP_LABELS !== 'undefined' ? MAP_LABELS : {})[a]; if (!pos) return;
    const g = markerShape(kind, pos[0] + dx * K, pos[1] - 14 * K + dy); g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button'); g.setAttribute('aria-label', by[a].n + ': ' + name);
    const open = () => { M.select(a); openState(a); }; g.addEventListener('click', e => { e.stopPropagation(); open(); }); g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    if (extra) { const t = mks('text', {class: 'rm-sub', y: 26}); t.textContent = extra; g.appendChild(t); }
    layer.appendChild(g);
  }
  function addChangeMarker(a, n) {
    const pos = (typeof MAP_LABELS !== 'undefined' ? MAP_LABELS : {})[a]; if (!pos) return;
    const g = mks('g', {class: 'rchg', transform: 'translate(' + (pos[0] + 16 * K) + ',' + (pos[1] - 32 * K) + ') scale(' + (K * 0.9) + ')', tabindex: 0, role: 'button', 'aria-label': by[a].n + ': ' + n + ' recent update' + (n > 1 ? 's' : '')});
    g.appendChild(mks('circle', {class: 'ring', r: 11})); g.appendChild(mks('circle', {r: 9})); const t = mks('text', {y: 4}); t.textContent = '★'; g.appendChild(t);
    const open = () => { M.select(a); openState(a, null, true); }; g.addEventListener('click', e => { e.stopPropagation(); open(); }); g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    layer.appendChild(g);
  }
  const hasData = a => stateCounties(a).length > 0 || (a === 'NY');
  function renderMap() {
    if (!M || !S.data) return; layer.textContent = ''; K = KS();
    const stat = {};   // per state summary for the active view
    Object.keys(M.paths).forEach(a => { M.paths[a].classList.remove('glow', 'dim', 'guide', 'nomatch', 'hit'); M.paths[a].classList.toggle('guide', !hasData(a)); });
    if (S.tab === 'opp') {
      const t = {}; S.data.counties.forEach(c => { const n = matches(c); if (!n) return; (t[c.state] = t[c.state] || {held: 0, auction: 0, counties: 0, n: 0}); const k = c.group === 'county-held' ? 'held' : 'auction'; t[c.state][k]++; t[c.state].counties++; t[c.state].n += n; });
      Object.keys(t).forEach(a => { const s = t[a]; M.paths[a].classList.add('hit'); const both = s.held && s.auction; if (s.held) addMarker(a, 'held', both ? -13 : 0, 0, s.held + ' county-held lien ' + (s.held > 1 ? 'counties' : 'county') + ', ' + s.n + ' matching listings', both ? null : String(s.counties)); if (s.auction) addMarker(a, 'auction', both ? 13 : 0, 0, s.auction + ' advertised sale ' + (s.auction > 1 ? 'counties' : 'county'), both ? null : String(s.counties)); });
      if (filtersOn()) Object.keys(M.paths).forEach(a => { if (!t[a]) M.paths[a].classList.add('nomatch'); });
      stat.matches = Object.values(t).reduce((u, s) => u + s.counties, 0); stat.listings = Object.values(t).reduce((u, s) => u + s.n, 0);
    } else if (S.tab === 'cal') {
      const monthOk = d => S.month < 0 || (d && Number(d.slice(5, 7)) - 1 === S.month);
      const seen = {};
      S.data.counties.filter(c => c.group !== 'county-held').forEach(c => {
        const s = c.sale; const canceled = S.data.changes.some(x => x.county === c.county && x.type === 'canceled');
        if (canceled) { if (!seen[c.state + 'x']) { seen[c.state + 'x'] = 1; addMarker(c.state, 'canceled', -13, 0, c.county + ' sale canceled'); } return; }
        if (s.kind === 'scheduled' && monthOk(s.date)) { if (!seen[c.state + 's']) { seen[c.state + 's'] = 1; addMarker(c.state, 'auction', 0, 0, c.county + ' sale scheduled ' + fmtDate(s.date), fmtDate(s.date).slice(0, 6)); } }
        else if (s.kind === 'tentative' && S.month < 0 && c.open) { if (!seen[c.state + 't']) { seen[c.state + 't'] = 1; addMarker(c.state, 'tentative', 13, 0, c.county + ': sale date not stated on the list'); } }
      });
      // guide notes: the existing month glow (from each state's researched "when" note) stays on and is labelled tentative
      stat.cal = true;
    } else {
      const seen_h = {};
      S.data.counties.filter(c => c.history).forEach(c => { if (!seen_h[c.state]) { seen_h[c.state] = 1; addMarker(c.state, 'sold', 0, 0, c.county + ': completed sales with verified prices', null); } });
      addMarker('NY', 'records', 13, 0, 'Past sale records without verified prices', null);
    }
    // recent-update stars: every view
    const cnt = {}; changes.forEach(c => { cnt[c.state] = (cnt[c.state] || 0) + 1; }); Object.keys(cnt).forEach(a => addChangeMarker(a, cnt[a]));
    // tab-specific captions + legend
    lastStat = stat; renderLegend(stat); renderFilterStatus(stat);
    if (S.sel) M.paths[S.sel] && M.paths[S.sel].classList.add('sel');
  }

  // ---- legend (updates with the selected view)
  function renderLegend(stat) {
    const b = $('rlegendbody'); b.textContent = '';
    const row = (icon, label, text) => { const li = mk('li'); const i = mk('span', 'lgi'); if (typeof icon === 'string') i.innerHTML = icon; else i.appendChild(icon); li.append(i, mk('span', '', ''), ''); li.lastChild.remove(); const t = mk('span', 'lgt'); t.append(mk('b', '', label + ' '), text); li.append(t); return li; };
    const svgI = k => { const s = mks('svg', {viewBox: '-14 -14 28 28', width: 22, height: 22, 'aria-hidden': 'true'}); s.appendChild(markerShape(k, 0, 0)); return s; };
    const ul = mk('ul', 'rlg'); const COL = M.COL;
    const sys = mk('li', 'lgsys'); sys.appendChild(mk('b', '', 'State color = how the state sells: ')); Object.keys(COL).forEach(k => { const sp = mk('span', 'lgsw'); const i = mk('i'); i.style.background = COL[k]; sp.append(i, k); sys.appendChild(sp); }); ul.appendChild(sys);
    ul.appendChild(row('<span class="lgg">▢</span>', 'Dashed, faded state = guide only.', 'We have its rules and county links but no verified listings yet.'));
    ul.appendChild(row((() => { const s = mks('svg', {viewBox: '-14 -14 28 28', width: 22, height: 22, 'aria-hidden': 'true'}); const g = mks('g', {class: 'rchg'}); g.appendChild(mks('circle', {r: 10})); const t = mks('text', {y: 4}); t.textContent = '★'; g.appendChild(t); s.appendChild(g); return s; })(), 'Gold star = update in ' + W.label.toLowerCase() + '.', 'Tap it to see the change, when we detected it and the official source.'));
    if (S.tab === 'opp') { ul.appendChild(row(svgI('held'), 'H = county-held liens.', 'The county owns the lien certificate and can sell it to you any time (confirm with the county).')); ul.appendChild(row(svgI('auction'), 'Gavel = advertised sale.', 'A county has published a list of properties or liens for a sale.')); ul.appendChild(row('<span class="lgg">n</span>', 'Number under a marker =', 'counties matching your filters.')); }
    if (S.tab === 'cal') { ul.appendChild(row(svgI('auction'), 'Gavel + date = scheduled sale.', 'The date is on the county’s own list.')); ul.appendChild(row(svgI('tentative'), '? = tentative.', 'A list exists but states no sale date. Highlighted states are from our notes, not verified.')); ul.appendChild(row(svgI('canceled'), '✕ = canceled.', 'Shown only when an official record says so.')); }
    if (S.tab === 'hist') { ul.appendChild(row(svgI('sold'), '$ = completed sales with verified prices.', 'Actual prices from the county’s published results.')); ul.appendChild(row(svgI('records'), '≡ = past records only.', 'Lists of earlier sales without verified prices.')); }
    b.appendChild(ul);
  }
  function renderFilterStatus(stat) {
    const f = $('rfilters'); const box = f.querySelector('.rstatus'); if (!box) return; box.textContent = '';
    if (S.tab !== 'opp' || stat.matches == null) return;
    box.appendChild(mk('b', '', stat.matches + ' count' + (stat.matches === 1 ? 'y' : 'ies') + ' · ' + (stat.listings || 0).toLocaleString() + ' listing' + (stat.listings === 1 ? '' : 's')));
    if (filtersOn() && !stat.matches) box.appendChild(mk('span', 'rno', ' No verified matches. ' + (S.types.has('deed') && S.types.size === 1 ? 'No tax deed auction in our data is open right now (see Sale History). ' : '') + 'Try a higher budget or fewer filters.'));
    else if (!stat.matches) box.appendChild(mk('span', 'rno', ' No verified open listings in our data.'));
  }

  // ---- Find my deal (Opportunities)
  let fOpen = !!saved.fOpen;
  function renderFilters() {
    const f = $('rfilters'); f.textContent = ''; f.hidden = S.tab !== 'opp'; if (S.tab !== 'opp') return;
    const head = mk('div', 'rf-head'); const tg = mk('button', 'rf-toggle'); tg.type = 'button'; tg.setAttribute('aria-expanded', String(fOpen || filtersOn()));
    tg.append(mk('b', '', 'Find my deal'), mk('span', 'rf-sum', ' ' + (filtersOn() ? 'filters on' : 'filter by type, sale and budget')), mk('span', 'rf-car', fOpen || filtersOn() ? ' \u25B4' : ' \u25BE'));
    tg.addEventListener('click', () => { fOpen = !(fOpen || filtersOn()); persist(); renderFilters(); renderFilterStatus(lastStat); }); head.appendChild(tg); f.appendChild(head);
    const st = mk('div', 'rstatus'); st.setAttribute('role', 'status'); f.appendChild(st);
    if (!(fOpen || filtersOn())) return;
    const body = mk('div', 'rf-body');
    const row1 = mk('div', 'rf-row'); const lb = mk('label', 'rf-chk'); const cb = mk('input'); cb.type = 'checkbox'; cb.checked = S.vac; cb.addEventListener('change', () => { S.vac = cb.checked; persist(); renderMap(); updatePanel(); }); lb.append(cb, ' Vacant Land only'); row1.appendChild(lb); body.appendChild(row1);
    body.appendChild(mk('p', 'small muted rf-note', 'Vacant is counted only where the county list or its parcel records say so.'));
    const types = mk('div', 'rf-types'); types.setAttribute('role', 'group'); types.setAttribute('aria-label', 'Sale type');
    TYPES.forEach(([k, label]) => { const b = mk('button', 'rchip', label); b.type = 'button'; b.setAttribute('aria-pressed', String(S.types.has(k))); b.addEventListener('click', () => { if (S.types.has(k)) S.types.delete(k); else S.types.add(k); if (!S.types.size) S.types = new Set(TYPES.map(x => x[0])); persist(); renderFilters(); renderMap(); updatePanel(); }); types.appendChild(b); });
    body.appendChild(types);
    const bud = mk('div', 'rf-bud'); const bl = mk('label', '', 'Budget: under $'); bl.setAttribute('for', 'rbud'); const bi = mk('input'); bi.id = 'rbud'; bi.type = 'number'; bi.min = '0'; bi.inputMode = 'numeric'; bi.placeholder = 'any'; bi.value = S.budget == null ? '' : S.budget;
    bi.addEventListener('input', () => { S.budget = bi.value === '' ? null : Math.max(0, Number(bi.value)); persist(); renderMap(); updatePanel(); });
    const quick = mk('span', 'rq'); [250, 500, 1000, 5000].forEach(v => { const q = mk('button', 'rchip small', 'Under ' + money(v)); q.type = 'button'; q.addEventListener('click', () => { S.budget = v; bi.value = v; persist(); renderMap(); updatePanel(); }); quick.appendChild(q); });
    bud.append(bl, bi, quick); body.appendChild(bud);
    body.appendChild(mk('p', 'small muted rf-note', 'Price field by sale type: lien purchase amount (county-held), amount owed on the list (advertised lien sale), amount owed on the notice (tax deed; not an opening bid).'));
    const clr = mk('button', 'rlink rf-clear', 'Clear filters'); clr.type = 'button'; clr.hidden = !filtersOn(); clr.addEventListener('click', () => { S.vac = false; S.types = new Set(TYPES.map(x => x[0])); S.budget = null; persist(); renderFilters(); renderMap(); updatePanel(); }); body.appendChild(clr);
    f.appendChild(body);
  }
  let lastStat = {};

  // ---- bottom panel for a state
  function openState(a, focusChange, onlyChanges) {
    S.sel = a; persist(); M.select(a); if (M.paths[a]) M.paths[a].classList.add('sel'); renderPanel(a, focusChange, onlyChanges);
  }
  let panelState = null;
  function updatePanel() { if (panelState && !$('rpanel').hidden) renderPanel(panelState); }
  function renderPanel(a, focusChange, onlyChanges) {
    panelState = a; const p = $('rpanel'); p.textContent = ''; p.hidden = false; const st = M.by[a]; const cs = stateCounties(a);
    const head = mk('div', 'rp-head'); const h = mk('h3', '', st.n); h.id = 'rpanelh'; const x = mk('button', 'rp-x', 'Close'); x.type = 'button'; x.setAttribute('aria-label', 'Close ' + st.n + ' panel'); x.addEventListener('click', closePanel); head.append(h, x); p.appendChild(head);
    const sys = mk('p', 'rp-sys'); const dot = mk('i'); dot.style.background = M.COL[st.sys] || '#94a3b8'; sys.append(dot, st.sys + (st.v ? ' (verify)' : '') + ' · interest: ' + st.rate); p.appendChild(sys);
    // recent updates for this state
    const ch = changes.filter(c => c.state === a); const updEl = document.createDocumentFragment(); let showAllP = !!focusChange || ch.length <= 3;
    if (ch.length) { const sec = mk('section', 'rp-sec'); sec.id = 'rp-upd'; sec.appendChild(mk('h4', '', 'Updates (' + W.label.toLowerCase() + ')')); const ul = mk('ul', 'rfeed'); const rank = {canceled: 0, schedule: 1, amount: 2, result: 3, missing: 4, added: 5, new_list: 6}; ch.sort((q, r) => rank[q.type] - rank[r.type] || r.detectedAt.localeCompare(q.detectedAt)); (showAllP ? ch : ch.slice(0, 3)).forEach(c => { const li = changeItem(c); if (c.id === focusChange) li.classList.add('focus'); ul.appendChild(li); }); sec.appendChild(ul); if (!showAllP) { const more = mk('button', 'rlink', 'Show all ' + ch.length + ' updates'); more.type = 'button'; more.addEventListener('click', () => renderPanel(a, ch[0].id)); sec.appendChild(more); } updEl.appendChild(sec); }
    else { const e0 = mk('p', 'rempty small', 'No updates for ' + st.n + ' in ' + W.label.toLowerCase() + '.'); updEl.appendChild(e0); }
    if (onlyChanges || focusChange) p.appendChild(updEl);
    // next verified sale
    const sec2 = mk('section', 'rp-sec'); sec2.appendChild(mk('h4', '', 'Next verified sale'));
    const sched = cs.filter(c => c.sale.kind === 'scheduled').sort((q, r) => q.sale.date.localeCompare(r.sale.date))[0];
    if (sched) sec2.appendChild(mk('p', '', sched.county + ' County: ' + fmtDate(sched.sale.date) + ' (date on the county’s list)'));
    else sec2.appendChild(mk('p', 'muted', cs.length ? 'No dated upcoming sale is verified in our data. ' + (cs.some(c => c.sale.kind === 'inventory') ? 'County-held liens can be bought any time; confirm with the county.' : 'The county lists we hold do not state a sale date.') : 'None: we have this state’s rules and county links only.'));
    p.appendChild(sec2);
    // counties
    const sec3 = mk('section', 'rp-sec'); sec3.appendChild(mk('h4', '', cs.length ? 'Counties with listings' : 'Counties'));
    if (!cs.length) {
      sec3.appendChild(mk('p', 'muted', 'Guide only: no verified listings for ' + st.n + ' yet. Use the state page for rules and official county links.'));
    } else {
      const ul = mk('ul', 'rp-counties'); cs.sort((q, r) => matches(r) - matches(q) || q.county.localeCompare(r.county)).forEach(c => {
        const li = mk('li'); const m = matches(c); const top = mk('div', 'rpc-top'); top.append(mk('b', '', c.county + ' County'), mk('span', 'rbadge g-' + c.group, GROUP_LABEL[c.group])); li.appendChild(top);
        if (S.tab === 'hist') {
          if (c.history) { const h2 = c.history; li.appendChild(mk('p', 'small', 'Completed sales: ' + h2.results.toLocaleString() + ' (' + h2.label + ')')); li.appendChild(mk('p', 'small', 'Final sale prices (actual): ' + money(h2.finalMin) + ' to ' + money(h2.finalMax) + ', median ' + money(h2.finalMedian))); li.appendChild(mk('p', 'small muted', 'Opening bids: not published in the county results · Advertised amounts: not in the results file')); }
          else li.appendChild(mk('p', 'small muted', 'No completed-sale results with verified prices in our data for this county.'));
        } else {
          li.appendChild(mk('p', 'small', c.count.toLocaleString() + ' listed · ' + (filtersOn() ? m.toLocaleString() + ' match your filters' : c.open.toLocaleString() + ' open now')));
          const arr = S.vac ? c.vac : c.amounts; if (arr.length) li.appendChild(mk('p', 'small', c.priceLabel + ': from ' + money(arr[0]) + (S.budget != null ? ' (' + bis(arr, S.budget).toLocaleString() + ' under ' + money(S.budget) + ')' : '')));
          li.appendChild(mk('p', 'small muted', c.sale.kind === 'scheduled' ? 'Sale scheduled ' + fmtDate(c.sale.date) : c.sale.kind === 'inventory' ? 'County-held inventory (not an auction)' : c.sale.kind === 'completed' || c.sale.kind === 'past' ? 'Sale completed: ' + c.sale.text : 'Tentative: ' + c.sale.text));
        }
        li.appendChild(mk('p', 'small muted', 'Source checked ' + fmtDate(c.checked)));
        const act = mk('div', 'ract'); const e = mk('a', 'btn small ghost', 'See listings'); e.href = M.base + '?s=' + a + '#' + encodeURIComponent(c.county); act.appendChild(e); li.appendChild(act); ul.appendChild(li);
      }); sec3.appendChild(ul);
      const latest = cs.map(c => c.checked).sort().pop(); sec3.appendChild(mk('p', 'small muted', 'Most recent source check: ' + fmtDate(latest) + '.'));
    }
    p.appendChild(sec3);
    if (!(onlyChanges || focusChange)) p.appendChild(updEl);
    const act = mk('div', 'rp-act'); const e = mk('a', 'btn', 'Explore Counties'); e.href = M.base + '?s=' + a; act.appendChild(e);
    const course = S.data.courses.includes(a); const t = mk('a', 'btn ghost', course ? 'Take the Masterclass' : 'Take the Masterclass (general)'); t.href = course ? '/learn/course/?c=' + a.toLowerCase() : '/learn/'; act.appendChild(t); p.appendChild(act);
    p.appendChild(mk('p', 'small muted', 'Educational only. Verify everything with the county before you bid.'));
    if (focusChange) { const f = p.querySelector('.focus'); f && setTimeout(() => f.scrollIntoView({block: 'nearest'}), 50); }
    document.body.classList.add('rpanel-open');
  }
  function closePanel() { $('rpanel').hidden = true; panelState = null; document.body.classList.remove('rpanel-open'); } // selection and filters are kept

  // ---- Find a state combobox
  function setupFind() {
    const input = $('rfindin'), list = $('rfindlist'); let act = -1, opts = [];
    const all = STATES.slice().sort((a, b) => a.n.localeCompare(b.n));
    const draw = () => {
      const q = input.value.trim().toLowerCase(); opts = all.filter(s => !q || s.n.toLowerCase().includes(q) || s.a.toLowerCase() === q || s.a.toLowerCase().startsWith(q)); list.textContent = '';
      opts.slice(0, 60).forEach((s, i) => { const li = mk('li', i === act ? 'on' : ''); li.setAttribute('role', 'option'); li.id = 'rf-' + s.a; li.setAttribute('aria-selected', String(i === act)); li.append(mk('b', '', s.n), mk('span', 'small', ' ' + s.a + (hasData(s.a) ? ' · listings' : ' · guide only'))); li.addEventListener('mousedown', e => { e.preventDefault(); pick(s.a); }); li.addEventListener('touchend', e => { e.preventDefault(); pick(s.a); }); list.appendChild(li); });
      if (!opts.length) { const li = mk('li', 'none', 'No state matches that.'); list.appendChild(li); }
      list.hidden = false; input.setAttribute('aria-expanded', 'true');
    };
    const pick = a => { input.value = by[a].n; list.hidden = true; input.setAttribute('aria-expanded', 'false'); M.select(a); openState(a); $('usmap').scrollIntoView({block: 'center', behavior: 'smooth'}); };
    input.addEventListener('input', () => { act = -1; draw(); }); input.addEventListener('focus', () => { input.select(); draw(); });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); act = Math.min(act + 1, Math.min(opts.length, 60) - 1); draw(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); act = Math.max(act - 1, 0); draw(); }
      else if (e.key === 'Enter') { e.preventDefault(); const s = opts[act >= 0 ? act : 0]; if (s) pick(s.a); }
      else if (e.key === 'Escape') { list.hidden = true; input.setAttribute('aria-expanded', 'false'); }
    });
    input.addEventListener('blur', () => setTimeout(() => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); }, 150));
  }

  // ---- tabs
  function setTab(t, quiet) {
    S.tab = t; persist(); document.querySelectorAll('.rtabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
    const bar = document.querySelector('.monbar'), cap = document.querySelector('.moncap'); if (bar) bar.hidden = t !== 'cal'; if (cap) cap.hidden = t !== 'cal';
    if (t !== 'cal' && S.month >= 0) { const all = bar && bar.querySelector('button'); all && all.click(); }
    renderFilters(); renderMap(); updatePanel();
  }

  function start() {
    M = window.TaxMap; by = M.by; layer = mks('g', {class: 'rlayer'}); M.svg.appendChild(layer); M.liveLayer.style.display = 'none';
    fetch('liens/states/radar.json').then(r => r.json()).then(d => {
      S.data = d; renderWhat(); setupFind();
      document.querySelectorAll('.rtabs button').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
      let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (Math.abs(KS() - K) > 0.25) renderMap(); }, 200); });
      window.addEventListener('taxmap:month', e => { S.month = e.detail; if (S.tab === 'cal') { renderMap(); } });
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('rpanel').hidden) closePanel(); });
      setTab(S.tab); if (S.sel && M.by[S.sel]) { M.select(S.sel); }
      // remember this visit for next time (the comparison above already used the previous value)
      try { LS && LS.setItem('ppa_last_visit', TODAY); } catch (e) {}
    }).catch(err => { console.error('radar', err && err.stack || err); $('rwhat').appendChild(mk('p', 'rempty', 'Radar data could not be loaded. The map below still opens each state’s page.')); });
  }
  window.TaxRadar = {openState: a => { if (!S.data) { location.href = 'liens/states/state/?s=' + a; return; } openState(a); }, _state: S};
  if (window.TaxMap) start(); else window.addEventListener('taxmap:ready', start);
})();
