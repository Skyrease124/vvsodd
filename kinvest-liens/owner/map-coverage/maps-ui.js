// Map Coverage & Repair presentation: compact statistics, an overall progress bar and tidy county rows.
// Presentation only: it reads numbers the page already shows, makes no request and changes no handler.
(function () {
  const O = window.OUI, $ = id => document.getElementById(id), app = $('app');
  if (!O || !app) return;
  document.body.classList.add('ou', 'p-map');
  document.querySelector('h1').textContent = 'Map Coverage & Repair';
  app.querySelectorAll(':scope > p.small, :scope > p.muted').forEach(p => p.classList.add('ou-hide'));
  const grid = app.querySelector('.grid'); grid.className = 'ou-stats ou-stats4';
  const labels = {total: 'Total records', mapped: 'Verified mapped', missing: 'Missing location', counties: 'Counties'};
  [...grid.children].forEach(d => { d.className = 'ou-stat'; const small = d.querySelector('.small'); const v = d.querySelector('.value'); const id = v.id;
    small.className = ''; const span = O.el('span', '', labels[id]); small.replaceWith(span); v.className = ''; d.prepend(v); });
  // Overall progress: mapped as a share of all records.
  const num = id => Number(($(id).textContent || '').replace(/[^0-9]/g, '')) || 0;
  const card = O.el('div', 'ou-card ou-pad'), head = O.el('div', 'ou-row'), bar = O.el('div', 'ou-bar'), fill = O.el('i'); bar.appendChild(fill);
  const title = O.el('span', 'ou-title', 'Mapping progress'), pct = O.el('span', 'ou-sub', '');
  head.append(title, pct); card.append(head, bar); grid.after(card);
  const paint = () => { const t = num('total'), m = num('mapped'); const p = t ? Math.round(1000 * m / t) / 10 : 0;
    pct.textContent = t ? m.toLocaleString() + ' of ' + t.toLocaleString() + ' · ' + p + '%' : ''; requestAnimationFrame(() => { fill.style.width = p + '%'; }); };
  ['total', 'mapped'].forEach(id => new MutationObserver(paint).observe($(id), {childList: true, characterData: true, subtree: true})); paint();
  // Panels become soft cards; the footnote is shortened.
  app.querySelectorAll('.panel').forEach(p => { if (!p.classList.contains('ou-stat')) p.classList.add('ou-card', 'ou-pad'); });
  const note = app.querySelector(':scope > p.small:last-of-type'); if (note) { note.textContent = 'Read only. GIS matches still need official verification before any map change.'; note.classList.remove('ou-hide'); note.classList.add('ou-sub'); }
  O.cleanTree(app);
  new MutationObserver(() => O.cleanTree($('detail'))).observe($('detail'), {childList: true, subtree: true});
})();
