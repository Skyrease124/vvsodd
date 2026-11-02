// Interactive US map: every state links to its page (liens/states/state/?s=XX).
(function () {
  const host = document.getElementById('usmap');
  if (!host || typeof MAP_PATHS === 'undefined' || typeof STATES === 'undefined') return;
  const base = host.getAttribute('data-base') || 'liens/states/state/';
  const by = {}; STATES.forEach(s => by[s.a] = s);
  const tip = document.getElementById('maptip');
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (t, at) => { const e = document.createElementNS(NS, t); for (const k in at) e.setAttribute(k, at[k]); return e; };
  const svg = mk('svg', {viewBox: '0 0 975 610', role: 'group', 'aria-label': 'Map of US states. Select a state to open its page.'});
  const go = a => { location.href = base + '?s=' + a; };
  function show(s) {
    if (!tip) return;
    tip.innerHTML = '<b></b><span></span><span class="tv"></span><a class="dbtn" href="">Open state page &rarr;</a>';
    tip.children[0].textContent = s.n;
    tip.children[1].textContent = s.sys + (s.v ? ' (verify)' : '');
    tip.children[2].textContent = 'Interest: ' + s.rate;
    tip.children[3].href = base + '?s=' + s.a;
  }
  const paths = {}; let cur = 'FL';
  const lab = mk('text', {class: 'stlabel'});
  const touch = window.matchMedia && window.matchMedia('(hover: none)').matches;
  function select(a) {
    if (paths[cur]) paths[cur].classList.remove('sel');
    cur = a; if (paths[a]) paths[a].classList.add('sel');
    const pos = typeof MAP_LABELS !== 'undefined' && MAP_LABELS[a];
    if (pos) { lab.setAttribute('x', pos[0]); lab.setAttribute('y', pos[1] + 6); lab.textContent = by[a].n; lab.style.display = ''; }
    else lab.style.display = 'none';
    show(by[a]);
  }
  Object.keys(MAP_PATHS).forEach(a => {
    const s = by[a]; if (!s) return;
    const p = mk('path', {d: MAP_PATHS[a], class: 'st' + (a === 'FL' ? ' sel' : ''), tabindex: 0, role: 'link', 'aria-label': s.n + ': ' + s.sys + (s.v ? ' (verify)' : '')});
    let was = false;
    p.addEventListener('pointerdown', () => { was = cur === a; });
    p.addEventListener('click', () => { if (touch && !was) select(a); else go(a); });
    p.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(a); } });
    ['mouseenter', 'focus'].forEach(ev => p.addEventListener(ev, () => select(a)));
    svg.appendChild(p); paths[a] = p;
  });
  svg.appendChild(lab);
  host.appendChild(svg);
  const chips = document.getElementById('mapchips');
  if (chips) ['VT','NH','MA','RI','CT','NJ','DE','MD','DC'].forEach(a => {
    const el = document.createElement('a'); el.href = base + '?s=' + a; el.textContent = a; el.title = by[a].n;
    el.addEventListener('mouseenter', () => select(a)); chips.appendChild(el);
  });
  lab.style.display = 'none';
  // Florida example panel
  const fl = by.FL, fs = document.getElementById('flsvg');
  if (fs) { const p = mk('path', {d: MAP_PATHS.FL, fill: '#22c55e'}); fs.appendChild(p);
    const bb = (() => { fs.appendChild(p); return p.getBBox(); })(); fs.setAttribute('viewBox', [bb.x - 4, bb.y - 4, bb.width + 8, bb.height + 8].join(' ')); }
  const fc = document.getElementById('flchips');
  if (fc) ['Lee', 'Miami-Dade', 'Broward', 'Palm Beach', 'Orange', 'Hillsborough', 'Pinellas', 'Duval'].forEach(n => {
    const l = fl.links.find(x => x[0].indexOf(n + ' County Tax Collector') === 0) || fl.links.find(x => x[0].indexOf(n) === 0);
    const a = document.createElement('a'); a.textContent = n + ' County';
    a.href = l ? l[1] : base + '?s=FL'; if (l) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    fc.appendChild(a);
  });
})();
