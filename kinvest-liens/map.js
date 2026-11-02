// Interactive US map: every state links to its page (liens/states/state/?s=XX).
(function () {
  const host = document.getElementById('usmap');
  if (!host || typeof MAP_PATHS === 'undefined' || typeof STATES === 'undefined') return;
  const base = host.getAttribute('data-base') || 'liens/states/state/';
  const COL = {'Tax lien certificate':'#22c55e','Tax deed':'#3b82f6','Redeemable deed':'#f59e0b','Hybrid':'#a855f7','Municipal lien':'#06b6d4','Sources differ':'#94a3b8'};
  const by = {}; STATES.forEach(s => by[s.a] = s);
  const tip = document.getElementById('maptip');
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 975 610'); svg.setAttribute('role', 'group'); svg.setAttribute('aria-label', 'Map of US states. Select a state to open its page.');
  const info = s => s.n + ': ' + s.sys + (s.v ? ' (verify)' : '');
  function show(s, e) {
    if (!tip) return;
    tip.innerHTML = '<b></b><span></span><em>Open state page &rarr;</em>';
    tip.firstChild.textContent = s.n; tip.children[1].textContent = s.sys + ' · ' + s.rate;
    tip.hidden = false;
  }
  function go(a) { location.href = base + '?s=' + a; }
  Object.keys(MAP_PATHS).forEach(a => {
    const s = by[a]; if (!s) return;
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', MAP_PATHS[a]); p.setAttribute('class', 'st'); p.style.fill = COL[s.sys] || '#64748b';
    p.setAttribute('tabindex', '0'); p.setAttribute('role', 'link'); p.setAttribute('aria-label', info(s));
    p.addEventListener('click', () => go(a));
    p.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(a); } });
    ['mouseenter', 'focus'].forEach(ev => p.addEventListener(ev, e => show(s, e)));
    svg.appendChild(p);
  });
  host.appendChild(svg);
  // Small states and DC as tappable chips (hard to hit on a phone map)
  const chips = document.getElementById('mapchips');
  if (chips) ['VT','NH','MA','RI','CT','NJ','DE','MD','DC'].forEach(a => {
    const el = document.createElement('a'); el.href = base + '?s=' + a; el.textContent = a; el.title = by[a].n;
    el.style.borderColor = COL[by[a].sys]; chips.appendChild(el);
  });
  const lg = document.getElementById('maplegend');
  if (lg) Object.keys(COL).forEach(k => { const li = document.createElement('li'); li.innerHTML = '<i></i>' + k; li.firstChild.style.background = COL[k]; lg.appendChild(li); });
})();
