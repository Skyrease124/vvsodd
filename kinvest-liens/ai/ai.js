// PricePocket AI page: map to focus states + a chat box. Answers come from /.netlify/functions/ai.
(function () {
  const $ = id => document.getElementById(id);
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const money = n => '$' + Math.round(n).toLocaleString('en-US');
  const COL = {'Tax lien certificate':'#22c55e','Tax deed':'#3b82f6','Redeemable deed':'#f59e0b','Hybrid':'#a855f7','Municipal lien':'#06b6d4','Sources differ':'#94a3b8'};
  const by = {}; STATES.forEach(s => by[s.a] = s);
  const selected = new Set();

  function drawMap() {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 975 610'); svg.setAttribute('role', 'group'); svg.setAttribute('aria-label', 'Map of US states. Tap states to focus the AI.');
    Object.keys(MAP_PATHS).forEach(a => {
      const s = by[a]; if (!s) return;
      const p = document.createElementNS(NS, 'path'); p.setAttribute('d', MAP_PATHS[a]); p.setAttribute('class', 'aist'); p.style.fill = COL[s.sys] || '#94a3b8';
      p.setAttribute('tabindex', '0'); p.setAttribute('role', 'button'); p.setAttribute('aria-pressed', 'false'); p.setAttribute('aria-label', s.n);
      const toggle = () => { if (selected.has(a)) selected.delete(a); else selected.add(a); p.classList.toggle('on', selected.has(a)); p.setAttribute('aria-pressed', String(selected.has(a))); label(); };
      p.addEventListener('click', toggle); p.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      const t = document.createElementNS(NS, 'title'); t.textContent = s.n + ': ' + s.sys; p.appendChild(t);
      svg.appendChild(p);
    });
    $('aimap').appendChild(svg);
  }
  function label() {
    const l = [...selected].map(a => by[a].n);
    $('aisel').textContent = l.length ? 'Focused on: ' + l.join(', ') : 'All states';
    $('aiclear').hidden = !l.length;
  }
  $('aiclear').addEventListener('click', () => { selected.clear(); document.querySelectorAll('.aist.on').forEach(p => { p.classList.remove('on'); p.setAttribute('aria-pressed', 'false'); }); label(); });

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
      const st = mk('a', 'btn small ghost', 'Open ' + r.state + ' page'); st.href = '../liens/states/state/?s=' + r.state; act.appendChild(st);
      c.appendChild(act); box.appendChild(c);
    });
    return box;
  }

  function add(q) {
    $('chat').textContent = ''; // one answer at a time
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
        out.appendChild(mk('p', 'small muted', 'What I searched: ' + d.searched + (d.understood ? '' : ' (I could not fully read your wording, so I used a broad search)')));
        if (d.kind === 'states' && d.results.length) { out.appendChild(mk('p', 'small muted', 'Showing ' + d.results.length + ' of ' + d.total + ' states:')); out.appendChild(statesTable(d.results)); }
        else if (d.kind === 'liens' && d.results.length) { out.appendChild(mk('p', 'small muted', 'Showing ' + d.results.length + ' of ' + d.total + ' liens:')); out.appendChild(lienCards(d.results)); }
        out.appendChild(mk('p', 'small muted', 'Automated answer from our own data. Educational only, not advice. Verify with the county.'));
      }
    } catch (e) { out.className = 'aiout err'; out.textContent = 'Could not reach PricePocket AI. Please try again.'; }
    $('aigo').disabled = false;
  }
  $('aiform').addEventListener('submit', e => { e.preventDefault(); ask($('aiq').value); });
  [['Highest interest', 'Which states pay the highest interest?'], ['Shortest redemption', 'Which states have the shortest redemption period?'], ['Cheapest liens', 'List the cheapest liens with the most land value behind them'], ['Most valuable lots', 'Most valuable lots with under $2,000 tax owed'], ['Lien states, bid-down', 'Tax lien certificate states that use bid-down bidding']].forEach(([t, q]) => {
    const b = mk('button', 'chipbtn', t); b.type = 'button'; b.addEventListener('click', () => ask(q)); $('aichips').appendChild(b);
  });

  (async () => {
    let d = null; try { d = await (await fetch('/.netlify/functions/ai')).json(); } catch (e) {}
    const g = $('gate');
    if (!d || !d.enabled) { g.hidden = false; g.textContent = 'PricePocket AI is not switched on yet.'; return; }
    if (!d.signedIn) { g.hidden = false; g.innerHTML = '<b>🔒 Pro members only.</b> <a href="/login/?next=/ai/">Sign in</a> or <a href="/account/?mode=up">create an account</a>. PricePocket AI is for Pro members ($5.50 a week).'; return; }
    if (!d.paid) { g.hidden = false; g.innerHTML = '<b>🔒 Pro members only.</b> Your account is free, so PricePocket AI is locked. Pro members ($5.50 a week) can use it. <a href="/account/">See my plan</a>'; return; }
    $('app').hidden = false; drawMap();
  })();
})();
