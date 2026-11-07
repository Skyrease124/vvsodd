// Interactive US map: every state links to its page (liens/states/state/?s=XX).
(function () {
  const host = document.getElementById('usmap');
  if (!host || typeof MAP_PATHS === 'undefined' || typeof STATES === 'undefined') return;
  const base = host.getAttribute('data-base') || 'liens/states/state/';
  const COL = {'Tax lien certificate':'#22c55e','Tax deed':'#3b82f6','Redeemable deed':'#f59e0b','Hybrid':'#a855f7','Municipal lien':'#06b6d4','Sources differ':'#94a3b8'};
  const DESC = {'Tax lien certificate':'You buy the unpaid tax debt and earn interest when the owner pays.','Tax deed':'The property itself is sold at auction.','Redeemable deed':'You get a deed, but the owner can buy it back.','Hybrid':'Mixes liens and deeds; it varies by county.','Municipal lien':'The town keeps the lien; no investor lien sale.','Sources differ':'Our sources disagree; verify with the county.'};
  const by = {}; STATES.forEach(s => by[s.a] = s);
  const tip = document.getElementById('maptip');
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (t, at) => { const e = document.createElementNS(NS, t); for (const k in at) e.setAttribute(k, at[k]); return e; };
  const svg = mk('svg', {viewBox: '0 0 975 610', role: 'group', 'aria-label': 'Map of US states. Select a state to open its page.'});
  // Soft top-to-bottom gradients make each color feel lit instead of flat.
  const defs = mk('defs', {});
  const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); const c = k => Math.max(0, Math.min(255, Math.round(((n >> k) & 255) * f))); return 'rgb(' + c(16) + ',' + c(8) + ',' + c(0) + ')'; };
  Object.keys(COL).forEach((k, i) => {
    const g = mk('linearGradient', {id: 'g' + i, x1: '0', y1: '0', x2: '0', y2: '1'});
    g.appendChild(mk('stop', {offset: '0', 'stop-color': shade(COL[k], 1.22)})); g.appendChild(mk('stop', {offset: '1', 'stop-color': shade(COL[k], 0.78)}));
    defs.appendChild(g);
  });
  svg.appendChild(defs);
  const GRAD = {}; Object.keys(COL).forEach((k, i) => GRAD[k] = 'url(#g' + i + ')');
  const LIVE = (typeof LIEN_SUMMARY !== 'undefined' ? LIEN_SUMMARY : []).reduce((m, x) => { (m[x.state] = m[x.state] || []).push(x); return m; }, {});
  const go = a => { location.href = base + '?s=' + a; };
  function show(s) {
    if (!tip) return;
    tip.innerHTML = '<b></b><span class="ty"><i></i><u></u></span><span class="de"></span><span class="tv"></span><span class="gv"></span><span class="lv"></span><a class="dbtn" href="">Open state page &rarr;</a>';
    tip.children[0].textContent = s.n;
    tip.querySelector('.ty i').style.background = COL[s.sys] || '#94a3b8';
    tip.querySelector('.ty u').textContent = s.sys + (s.v ? ' (verify)' : '');
    tip.querySelector('.de').textContent = DESC[s.sys] || '';
    tip.querySelector('.tv').textContent = 'Interest: ' + s.rate;
    const g = typeof OFFICIALS !== 'undefined' && OFFICIALS.gov[s.a];
    tip.querySelector('.gv').textContent = g ? g.title + ': ' + g.name + ' (' + g.party + ')' : '';
    const lv = LIVE[s.a]; tip.querySelector('.lv').textContent = lv ? '\u25CF Real liens listed: ' + lv.map(x => x.county + ' County (' + x.count.toLocaleString() + ')').join(', ') : '';
    tip.lastChild.href = base + '?s=' + s.a;
  }
  const paths = {}; let cur = 'FL';
  const lab = mk('text', {class: 'stlabel'});
  const touch = window.matchMedia && window.matchMedia('(hover: none)').matches;
  function select(a) {
    if (paths[cur]) paths[cur].classList.remove('sel');
    cur = a; if (paths[a]) { paths[a].classList.add('sel'); if (paths[a].nextSibling !== liveLayer) svg.insertBefore(paths[a], liveLayer); }
    const pos = typeof MAP_LABELS !== 'undefined' && MAP_LABELS[a];
    if (pos) { lab.setAttribute('x', pos[0]); lab.setAttribute('y', pos[1] + 6); lab.textContent = by[a].n; lab.style.display = ''; }
    else lab.style.display = 'none';
    show(by[a]);
  }
  let idx = 0;
  Object.keys(MAP_PATHS).forEach(a => {
    const s = by[a]; if (!s) return;
    const p = mk('path', {d: MAP_PATHS[a], class: 'st' + (a === 'FL' ? ' sel' : ''), style: 'fill:' + (GRAD[s.sys] || COL[s.sys] || '#94a3b8') + ';--i:' + (idx++), tabindex: 0, role: 'link', 'aria-label': s.n + ': ' + s.sys + (s.v ? ' (verify)' : '')});
    let was = false;
    p.addEventListener('pointerdown', () => { was = cur === a; });
    p.addEventListener('click', () => { if (touch && !was) select(a); else go(a); });
    p.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(a); } });
    ['mouseenter', 'focus'].forEach(ev => p.addEventListener(ev, () => select(a)));
    svg.appendChild(p); paths[a] = p;
  });
  // Pulsing dots on states that have real lien lists.
  const liveLayer = mk('g', {class: 'livelayer'});
  Object.keys(LIVE).forEach(a => {
    const pos = typeof MAP_LABELS !== 'undefined' && MAP_LABELS[a]; if (!pos || !by[a]) return;
    const n = LIVE[a].reduce((t, x) => t + x.count, 0);
    const g = mk('g', {class: 'live', transform: 'translate(' + pos[0] + ',' + (pos[1] - 16) + ')', tabindex: 0, role: 'link', 'aria-label': by[a].n + ': real liens listed (' + n.toLocaleString() + ')'});
    g.appendChild(mk('circle', {class: 'ring', r: 7})); g.appendChild(mk('circle', {class: 'ring r2', r: 7})); g.appendChild(mk('circle', {class: 'core', r: 6}));
    g.addEventListener('click', () => go(a)); g.addEventListener('mouseenter', () => select(a));
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(a); } });
    liveLayer.appendChild(g);
  });
  svg.appendChild(liveLayer);
  svg.appendChild(lab);
  host.appendChild(svg);
  // Counters that count up when the map scrolls into view.
  const total = Object.values(LIVE).reduce((t, l) => t + l.reduce((u, x) => u + x.count, 0), 0), counties = Object.values(LIVE).reduce((t, l) => t + l.length, 0);
  const stats = document.getElementById('mapstats');
  if (stats) {
    [[STATES.length, 'states and DC'], [total, 'real liens listed'], [counties, 'counties with real lists']].forEach(([v, label]) => {
      const d = document.createElement('div'); d.className = 'ms'; const b = document.createElement('b'); b.textContent = '0'; b.dataset.to = String(v); const sp = document.createElement('span'); sp.textContent = label; d.append(b, sp); stats.appendChild(d);
    });
    const run = () => stats.querySelectorAll('b').forEach(b => {
      const to = +b.dataset.to, t0 = performance.now(), reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) { b.textContent = to.toLocaleString(); return; }
      const step = t => { const k = Math.min(1, (t - t0) / 1400), e = 1 - Math.pow(1 - k, 3); b.textContent = Math.round(to * e).toLocaleString(); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
    if ('IntersectionObserver' in window) { const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { run(); io.disconnect(); } }, {threshold: 0.3}); io.observe(stats); } else run();
  }
  const lg = document.getElementById('maplegend');
  if (lg) Object.keys(COL).forEach(k => { const li = document.createElement('li'); li.innerHTML = '<i></i><span></span>'; li.firstChild.style.background = COL[k]; li.lastChild.textContent = k + ' \u2013 ' + DESC[k]; lg.appendChild(li); });
  const chips = document.getElementById('mapchips');
  if (chips) ['VT','NH','MA','RI','CT','NJ','DE','MD','DC'].forEach(a => {
    const el = document.createElement('a'); el.href = base + '?s=' + a; el.textContent = a; el.title = by[a].n; el.style.borderColor = COL[by[a].sys];
    el.addEventListener('mouseenter', () => select(a)); chips.appendChild(el);
  });
  lab.style.display = 'none';
  // Florida example panel
  const fl = by.FL, fs = document.getElementById('flsvg');
  if (fs) { const p = mk('path', {d: MAP_PATHS.FL, fill: COL[fl.sys]}); fs.appendChild(p);
    const bb = (() => { fs.appendChild(p); return p.getBBox(); })(); fs.setAttribute('viewBox', [bb.x - 4, bb.y - 4, bb.width + 8, bb.height + 8].join(' ')); }
  const fc = document.getElementById('flchips');
  if (fc) ['Lee', 'Miami-Dade', 'Broward', 'Palm Beach', 'Orange', 'Hillsborough', 'Pinellas', 'Duval'].forEach(n => {
    const l = fl.links.find(x => x[0].indexOf(n + ' County Tax Collector') === 0) || fl.links.find(x => x[0].indexOf(n) === 0);
    const a = document.createElement('a'); a.textContent = n + ' County';
    a.href = l ? l[1] : base + '?s=FL'; if (l) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    fc.appendChild(a);
  });
})();
