// PricePocket AI page: map to focus states + a chat box. Answers come from /.netlify/functions/ai.
(function () {
  const $ = id => document.getElementById(id);
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const money = n => '$' + Math.round(n).toLocaleString('en-US');
  const COL = {'Tax lien certificate':'#22c55e','Tax deed':'#3b82f6','Redeemable deed':'#f59e0b','Hybrid':'#a855f7','Municipal lien':'#06b6d4','Sources differ':'#94a3b8'};
  const by = {}; STATES.forEach(s => by[s.a] = s);
  const selected = new Set();

  let svgEl = null, badgeLayer = null;
  const NS = 'http://www.w3.org/2000/svg';
  const sn = (t, at) => { const e = document.createElementNS(NS, t); for (const k in at) e.setAttribute(k, at[k]); return e; };
  const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); const c = k => Math.max(0, Math.min(255, Math.round(((n >> k) & 255) * f))); return 'rgb(' + c(16) + ',' + c(8) + ',' + c(0) + ')'; };
  function drawMap() {
    const svg = sn('svg', {viewBox: '30 55 915 520', role: 'group', 'aria-label': 'Map of US states. Tap states to focus the AI.'}); svgEl = svg;
    const defs = sn('defs', {});
    Object.keys(COL).forEach((k, i) => { const g = sn('linearGradient', {id: 'ag' + i, x1: '0', y1: '0', x2: '0', y2: '1'}); g.appendChild(sn('stop', {offset: '0', 'stop-color': shade(COL[k], 1.22)})); g.appendChild(sn('stop', {offset: '1', 'stop-color': shade(COL[k], 0.78)})); defs.appendChild(g); });
    svg.appendChild(defs);
    const GRAD = {}; Object.keys(COL).forEach((k, i) => GRAD[k] = 'url(#ag' + i + ')');
    let idx = 0;
    Object.keys(MAP_PATHS).forEach(a => {
      const s = by[a]; if (!s) return;
      const p = sn('path', {d: MAP_PATHS[a], class: 'aist', style: 'fill:' + (GRAD[s.sys] || COL[s.sys] || '#94a3b8') + ';--i:' + (idx++), tabindex: '0', role: 'button', 'aria-pressed': 'false', 'aria-label': s.n, 'data-a': a});
      const toggle = () => { if (selected.has(a)) selected.delete(a); else selected.add(a); p.classList.toggle('on', selected.has(a)); p.setAttribute('aria-pressed', String(selected.has(a))); label(); };
      p.addEventListener('click', toggle); p.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      const t = sn('title', {}); t.textContent = s.n + ': ' + s.sys; p.appendChild(t);
      svg.appendChild(p);
    });
    // pulsing dots where real lien lists exist
    (typeof LIEN_SUMMARY !== 'undefined' ? LIEN_SUMMARY : []).forEach(x => {
      const pos = typeof MAP_LABELS !== 'undefined' && MAP_LABELS[x.state]; if (!pos) return;
      const g = sn('g', {class: 'live', transform: 'translate(' + pos[0] + ',' + (pos[1] - 16) + ')', 'pointer-events': 'none'});
      g.appendChild(sn('circle', {class: 'ring', r: 7})); g.appendChild(sn('circle', {class: 'ring r2', r: 7})); g.appendChild(sn('circle', {class: 'core', r: 6}));
      svg.appendChild(g);
    });
    badgeLayer = sn('g', {class: 'badges', 'pointer-events': 'none'}); svg.appendChild(badgeLayer);
    $('aimap').appendChild(svg);
  }
  function label() {
    const l = [...selected].map(a => by[a].n);
    $('aisel').textContent = l.length ? 'Focused: ' + l.join(', ') : 'Tap states to focus, or just ask';
    $('aiclear').hidden = !l.length && !document.querySelector('.aist.hit');
  }
  // The map reacts to answers: states in the answer glow, the rest dim, and gold badges show rank or count.
  function react(d) {
    clearReact();
    const codes = []; const counts = {};
    if (d.kind === 'states' || d.kind === 'liens') (d.results || []).forEach(r => { if (r.state) { if (!codes.includes(r.state)) codes.push(r.state); counts[r.state] = (counts[r.state] || 0) + 1; } });
    else (d.scope || []).forEach(c => codes.push(c));
    if (!codes.length) return;
    document.querySelectorAll('.aist').forEach(p => { const code = p.getAttribute('data-a'); p.classList.toggle('hit', codes.includes(code)); p.classList.toggle('dim', !codes.includes(code)); });
    const ranked = d.kind === 'states' && ['rate', 'months'].includes(d.sortBy);
    codes.forEach((c, i) => {
      let pos = typeof MAP_LABELS !== 'undefined' && MAP_LABELS[c];
      if (!pos) { const el = document.querySelector('.aist[data-a="' + c + '"]'); if (el) { const bb = el.getBBox(); pos = [bb.x + bb.width / 2, bb.y + bb.height / 2]; } }
      if (!pos) return;
      const g = sn('g', {class: 'badge', transform: 'translate(' + pos[0] + ',' + pos[1] + ')', style: '--d:' + (i * 90) + 'ms'});
      g.appendChild(sn('circle', {r: 15})); const t = sn('text', {y: 6}); t.textContent = ranked ? String(i + 1) : (d.kind === 'liens' && counts[c] > 1 ? '\u00d7' + counts[c] : '\u2713'); g.appendChild(t);
      badgeLayer.appendChild(g);
    });
    $('aiclear').hidden = false;
  }
  function clearReact() { document.querySelectorAll('.aist.hit,.aist.dim').forEach(p => p.classList.remove('hit', 'dim')); if (badgeLayer) badgeLayer.textContent = ''; }
  $('aiclear').addEventListener('click', () => { selected.clear(); document.querySelectorAll('.aist.on').forEach(p => { p.classList.remove('on'); p.setAttribute('aria-pressed', 'false'); }); clearReact(); $('chat').textContent = ''; label(); });

  function statesTable(rows) {
    const wrap = mk('div', 'tablewrap'), t = mk('table', 'liens'), hr = t.createTHead().insertRow();
    ['State', 'Type', 'Interest / penalty', 'Redemption', 'Bidding'].forEach(h => hr.appendChild(mk('th', '', h)));
    const tb = t.createTBody();
    rows.forEach(r => {
      const tr = tb.insertRow(); const c0 = tr.insertCell(); const a = mk('a', '', r.name); a.href = '../liens/states/state/?s=' + r.state; c0.appendChild(a); if (r.verify) c0.appendChild(mk('span', 'small muted', ' (verify)'));
      [r.system, r.rate, r.redemption, r.bidding].forEach(v => tr.insertCell().textContent = v);
    });
    wrap.appendChild(t); return wrap;
  }
  function lienCards(rows) {
    const box = mk('div');
    rows.forEach((r, i) => {
      const c = mk('article', 'scard'), h = mk('div', 'scardh');
      h.append(mk('b', '', (i + 1) + '. ' + r.county + ' County parcel ' + r.parcel), mk('span', 'sscore', 'Score ' + r.score + '/100'));
      c.appendChild(h);
      c.appendChild(mk('p', 'small muted', [r.area, r.use && r.use.toLowerCase(), r.acres != null && r.acres + ' acres'].filter(Boolean).join(' · ')));
      const dl = mk('dl', 'stfacts');
      [['Tax owed', '$' + Number(r.face).toFixed(2)], ['County land value', r.market != null ? money(r.market) : 'unknown'], ['Value vs tax owed', r.coverage != null ? r.coverage + 'x' : 'n/a']].forEach(([k, v]) => { const d = mk('div'); d.append(mk('dt', '', k), mk('dd', '', v)); dl.appendChild(d); });
      c.appendChild(dl);
      const fl = mk('ul', 'sflags'); (r.green || []).forEach(t => fl.appendChild(mk('li', 'g', t))); (r.red || []).forEach(t => fl.appendChild(mk('li', 'r', t))); c.appendChild(fl);
      const act = mk('div', 'sact');
      const mb = mk('button', 'btn small', 'Show on map'); mb.type = 'button'; mb.addEventListener('click', () => LienMap.open({county: r.county, parcel: r.parcel, amount: r.face, market: r.market, use: r.use, acres: r.acres})); act.appendChild(mb);
      const bb = LienBuy.button({county: r.county, parcel: r.parcel, amount: r.face, certList: r.certList, saleDate: r.saleDate}, 'btn small'); if (bb) act.appendChild(bb);
      const st = mk('a', 'btn small ghost', 'Open ' + r.state + ' page'); st.href = '../liens/states/state/?s=' + r.state; act.appendChild(st);
      c.appendChild(act); box.appendChild(c);
    });
    return box;
  }

  function add(q) {
    $('chat').textContent = ''; clearReact(); // one answer at a time
    const turn = mk('section', 'aiturn');
    turn.appendChild(mk('p', 'aiq', 'You: ' + q));
    const out = mk('div', 'aiout'); out.textContent = 'Searching…'; turn.appendChild(out);
    $('chat').appendChild(turn); turn.scrollIntoView({behavior: 'smooth', block: 'start'});
    return out;
  }
  async function ask(q) {
    q = (q || '').replace(/\s+/g, ' ').trim(); if (q.length < 3) return;
    $('aigo').disabled = true; $('aiq').value = '';
    const out = add(q);
    try {
      const r = await fetch('/.netlify/functions/ai', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({question: q, states: [...selected]})});
      const d = await r.json().catch(() => ({}));
      out.textContent = '';
      if (!r.ok) { out.className = 'aiout err'; out.textContent = d.error || 'Something went wrong. Please try again.'; }
      else {
        out.appendChild(mk('p', '', d.answer));
        out.appendChild(mk('p', 'small muted', d.searched + (d.understood ? '' : ' (I could not fully read your wording, so I used a broad search)')));
        if (d.kind === 'states' && d.results.length) { out.appendChild(mk('p', 'small muted', 'Showing ' + d.results.length + ' of ' + d.total + ' states:')); out.appendChild(statesTable(d.results)); }
        else if (d.kind === 'liens' && d.results.length) { out.appendChild(mk('p', 'small muted', 'Showing ' + d.results.length + ' of ' + d.total + ' liens:')); out.appendChild(lienCards(d.results)); }
        if (d.table && d.table.rows.length) { const wrap = mk('div', 'tablewrap'), t = mk('table', 'liens'), hr = t.createTHead().insertRow(); d.table.columns.forEach(c => hr.appendChild(mk('th', '', c))); const tb = t.createTBody(); d.table.rows.forEach(r => { const tr = tb.insertRow(); r.forEach(v => tr.insertCell().textContent = v == null ? '\u2013' : (typeof v === 'number' ? v.toLocaleString('en-US') : String(v))); }); wrap.appendChild(t); out.appendChild(wrap); const a = mk('a', 'small', 'Open the New York page \u2192'); a.href = '../liens/states/state/?s=NY'; out.appendChild(a); }
        react(d);
      }
    } catch (e) { out.className = 'aiout err'; out.textContent = 'Could not reach PricePocket AI. Please try again.'; }
    $('aigo').disabled = false;
  }
  $('aiform').addEventListener('submit', e => { e.preventDefault(); ask($('aiq').value); });
  [['Highest interest', 'Which states pay the highest interest?'], ['Shortest redemption', 'Which states have the shortest redemption period?'], ['Cheapest liens', 'List the cheapest liens with the most land value behind them'], ['Most valuable lots', 'Most valuable lots with under $2,000 tax owed']].forEach(([t, q]) => {
    const b = mk('button', 'aichip', t); b.type = 'button'; b.addEventListener('click', () => ask(q)); $('aichips').appendChild(b);
  });

  (async () => {
    let d = null; try { d = await (await fetch('/.netlify/functions/ai')).json(); } catch (e) {}
    const g = $('gate');
    if (!d || !d.enabled) { g.hidden = false; g.textContent = 'PricePocket AI is not switched on yet.'; return; }
    if (!d.signedIn) { g.hidden = false; g.innerHTML = '<b>🔒 Pro members only.</b> <a href="/login/?next=/ai/">Sign in</a> or <a href="/account/?mode=up">create an account</a>. PricePocket AI is for Pro members ($5.50 a week).'; return; }
    if (!d.paid) { g.hidden = false; g.innerHTML = '<b>🔒 Pro members only.</b> PricePocket AI is for Pro members ($5.50 a week). <a href="/account/">See my plan</a>'; return; }
    $('app').hidden = false; drawMap();
  })();
})();
