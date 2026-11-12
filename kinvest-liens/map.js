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
  // Texture by system: lien = diagonal stripes, redeemable = dots, hybrid = crosshatch, municipal = lines, deed = solid.
  const TEX = {
    'Tax lien certificate': '<path d="M-1 9L9-1M-1 1L1-1M7 9L9 7" stroke="rgba(0,0,0,.3)" stroke-width="1.7"/>',
    'Redeemable deed': '<circle cx="2" cy="2" r="1.3" fill="rgba(255,255,255,.45)"/><circle cx="6" cy="6" r="1.3" fill="rgba(255,255,255,.45)"/>',
    'Hybrid': '<path d="M-1 9L9-1M-1 -1L9 9" stroke="rgba(0,0,0,.25)" stroke-width="1.2"/>',
    'Municipal lien': '<path d="M0 2.5H8M0 6.5H8" stroke="rgba(0,0,0,.28)" stroke-width="1.3"/>'
  };
  Object.keys(TEX).forEach((k, i) => {
    const pt = mk('pattern', {id: 'tx' + i, width: 8, height: 8, patternUnits: 'userSpaceOnUse'});
    pt.appendChild(mk('rect', {width: 8, height: 8, fill: shade(COL[k], 1.05)}));
    const tmp = document.createElementNS(NS, 'g'); tmp.innerHTML = TEX[k]; while (tmp.firstChild) pt.appendChild(tmp.firstChild);
    defs.appendChild(pt);
  });
  svg.appendChild(defs);
  const GRAD = {}; Object.keys(COL).forEach((k, i) => GRAD[k] = TEX[k] ? 'url(#tx' + Object.keys(TEX).indexOf(k) + ')' : 'url(#g' + i + ')');
  const LIVE = (typeof LIEN_SUMMARY !== 'undefined' ? LIEN_SUMMARY : []).reduce((m, x) => { (m[x.state] = m[x.state] || []).push(x); return m; }, {});
  const go = a => { if (window.TaxRadar) window.TaxRadar.openState(a); else location.href = base + '?s=' + a; };
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
    const lv = LIVE[s.a], hv = (typeof HISTORY_SUMMARY !== 'undefined' ? HISTORY_SUMMARY : []).filter(x => x.state === s.a);
    tip.querySelector('.lv').textContent = lv ? '\u25CF Real liens listed: ' + lv.map(x => x.county + ' County (' + x.count.toLocaleString() + ')').join(', ') : hv.length ? 'Past sale records: ' + hv.reduce((t, x) => t + x.count, 0).toLocaleString() + ' (history, not open to buy)' : '';
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
    const p = mk('path', {d: MAP_PATHS[a], class: 'st' + (a === 'FL' ? ' sel' : ''), style: 'fill:' + (GRAD[s.sys] || COL[s.sys] || '#94a3b8') + ';--i:' + (idx++), 'data-a': a, tabindex: 0, role: 'link', 'aria-label': s.n + ': ' + s.sys + (s.v ? ' (verify)' : '')});
    let was = false;
    p.addEventListener('pointerdown', () => { was = cur === a; });
    p.addEventListener('click', () => { if (window.TaxRadar) { select(a); go(a); } else if (touch && !was) select(a); else go(a); });
    p.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(a); } });
    if (!window.TaxRadarOn) ['mouseenter', 'focus'].forEach(ev => p.addEventListener(ev, () => select(a)));
    svg.appendChild(p); paths[a] = p;
  });
  // Pulsing dots on states that have real lien lists.
  const liveLayer = mk('g', {class: 'livelayer'});
  Object.keys(LIVE).forEach(a => {
    const pos = typeof MAP_LABELS !== 'undefined' && MAP_LABELS[a]; if (!pos || !by[a]) return;
    const n = LIVE[a].reduce((t, x) => t + x.count, 0);
    const stEl = svg.querySelector('path.st[data-a="' + a + '"]'); if (stEl) stEl.classList.add('haslive');
    const rr = Math.max(5, Math.min(13, 4 + Math.log10(n + 1) * 2.4));
    const g = mk('g', {class: 'live', transform: 'translate(' + pos[0] + ',' + (pos[1] - 16) + ')', tabindex: 0, role: 'link', 'aria-label': by[a].n + ': real liens listed (' + n.toLocaleString() + ')'});
    g.appendChild(mk('circle', {class: 'ring', r: rr + 1})); g.appendChild(mk('circle', {class: 'ring r2', r: rr + 1})); g.appendChild(mk('circle', {class: 'core', r: rr}));
    const gv = mk('g', {class: 'gavel', transform: 'rotate(-35) scale(' + (rr / 9).toFixed(2) + ')'});
    gv.appendChild(mk('rect', {x: -5, y: -7, width: 10, height: 5, rx: 1.2})); gv.appendChild(mk('rect', {x: -1, y: -3, width: 2, height: 10, rx: 1}));
    g.appendChild(gv);
    g.addEventListener('click', () => go(a)); g.addEventListener('mouseenter', () => select(a));
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(a); } });
    liveLayer.appendChild(g);
  });
  svg.appendChild(liveLayer);
  svg.appendChild(lab);
  host.appendChild(svg);
  // Counters that count up when the map scrolls into view.
  const total = Object.values(LIVE).reduce((t, l) => t + l.reduce((u, x) => u + x.count, 0), 0), counties = Object.values(LIVE).reduce((t, l) => t + l.length, 0);
  const HIST = typeof HISTORY_SUMMARY !== 'undefined' ? HISTORY_SUMMARY : [];
  const histTotal = HIST.reduce((t, x) => t + x.count, 0);
  const stats = document.getElementById('mapstats');
  if (stats) {
    [[50, 'states + DC'], [total, 'real listings (liens and land)'], [counties, 'counties with real lists'], [histTotal, 'past sale records']].forEach(([v, label]) => {
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
  // Sale month switch: states whose researched "when" note names the month glow; the rest dim.
  (function () {
    const MN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const bar = document.createElement('div'); bar.className = 'monbar'; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Sale month');
    const cap = document.createElement('p'); cap.className = 'moncap small'; cap.setAttribute('role', 'status');
    const hint = 'Tap a month to see which states hold sales then.';
    cap.textContent = hint;
    let sel = -1, months = null;
    const apply = () => {
      Object.keys(paths).forEach(a => { const on = sel >= 0 && months && months[a] && months[a][sel]; paths[a].classList.toggle('glow', !!on); paths[a].classList.toggle('dim', sel >= 0 && !on); });
      liveLayer.classList.toggle('dimlive', sel >= 0);
      if (sel < 0) { cap.textContent = hint; return; }
      const n = Object.keys(paths).filter(a => months && months[a] && months[a][sel]).length;
      cap.textContent = n ? n + ' state' + (n > 1 ? 's' : '') + ' mention a ' + MN[sel] + ' sale in our notes. Dates change, so confirm with the county.' : 'No state notes mention a ' + MN[sel] + ' sale. Many states do not publish a fixed month.';
    };
    const load = cb => {
      if (months) return cb();
      if (typeof STATE_DATA === 'undefined') { const sc = document.createElement('script'); sc.src = 'liens/states/state-data.js'; sc.onload = () => { build(); cb(); }; sc.onerror = () => { cap.textContent = 'Could not load sale months. Try again.'; }; document.head.appendChild(sc); }
      else { build(); cb(); }
    };
    const build = () => { months = {}; Object.keys(STATE_DATA).forEach(a => { const w = (STATE_DATA[a].sale && STATE_DATA[a].sale.when) || ''; const m = MN.map(x => w.indexOf(x) >= 0); if (m.some(Boolean)) months[a] = m; }); };
    ['All'].concat(MN.map(x => x.slice(0, 3))).forEach((t, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false'); if (i === 0) b.className = 'on';
      b.addEventListener('click', () => { sel = i - 1; bar.querySelectorAll('button').forEach((x, j) => { x.classList.toggle('on', j === i); x.setAttribute('aria-pressed', j === i ? 'true' : 'false'); }); window.dispatchEvent(new CustomEvent('taxmap:month', {detail: sel})); if (sel < 0) apply(); else load(apply); });
      bar.appendChild(b);
    });
    host.parentNode.insertBefore(bar, host); host.parentNode.insertBefore(cap, host);
  })();
  const lg = document.getElementById('maplegend');
  if (lg) Object.keys(COL).forEach(k => { const li = document.createElement('li'); li.innerHTML = '<i></i><span></span>'; li.firstChild.style.background = COL[k]; const sw = {'Tax lien certificate':'repeating-linear-gradient(135deg,rgba(0,0,0,.3) 0 2px,transparent 2px 5px),','Redeemable deed':'radial-gradient(rgba(255,255,255,.55) 1.3px,transparent 1.6px) 0 0/6px 6px,','Hybrid':'repeating-linear-gradient(45deg,rgba(0,0,0,.25) 0 1px,transparent 1px 5px),repeating-linear-gradient(135deg,rgba(0,0,0,.25) 0 1px,transparent 1px 5px),','Municipal lien':'repeating-linear-gradient(0deg,rgba(0,0,0,.3) 0 1.5px,transparent 1.5px 5px),'}[k]; if (sw) li.firstChild.style.background = sw + COL[k]; li.lastChild.textContent = k + ' \u2013 ' + DESC[k]; lg.appendChild(li); });
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
  window.TaxMap = {svg, paths, by, COL, select, liveLayer, base, host, MN: ['January','February','March','April','May','June','July','August','September','October','November','December']};
  window.dispatchEvent(new Event('taxmap:ready'));
})();
