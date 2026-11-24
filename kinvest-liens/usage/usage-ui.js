// Usage & Limits presentation. Reads only what the page already loads, plus the read-only service status list
// (counters and configuration flags, no key values). It starts no check and makes no paid request.
(function () {
  const O = window.OUI, $ = id => document.getElementById(id), app = $('app');
  if (!O || !app) return;
  const main = document.querySelector('main'); main.classList.add('ou-main-page');
  document.querySelector('h1').textContent = 'Usage & Limits';
  const back = O.el('a', 'ou-back', '← Owner Dashboard'); back.href = '/owner/'; main.querySelector('section').prepend(back);
  const note = app.querySelector(':scope > p.muted'); if (note) { note.textContent = 'Our own count. The real balance with each provider is on their site.'; note.classList.add('ou-sub'); }
  const pct = (u, l) => l ? Math.min(100, Math.round(u / l * 100)) : 100;
  const tone = p => p >= 100 ? 'bad' : p >= 80 ? 'warn' : '';
  const row = (name, color, icon, used, limit, status, kind, sub) => {
    const li = O.el('div', 'ou-item'), head = O.el('div', 'ou-head'), mainEl = O.el('div', 'ou-main');
    const bar = O.el('div', 'ou-bar ' + (limit != null ? tone(pct(used, limit)) : '')); const fill = O.el('i'); bar.appendChild(fill);
    mainEl.append(O.el('span', 'ou-title', name), O.el('span', 'ou-sub', sub || (limit != null ? used + ' of ' + limit + ' used · ' + Math.max(0, limit - used) + ' left' : 'Shared budget')));
    if (limit != null) mainEl.appendChild(bar);
    head.append(O.icon(icon, color), mainEl, O.el('div', 'ou-pills'));
    head.lastChild.appendChild(O.pill(status, kind));
    head.style.cursor = 'default'; li.appendChild(head);
    requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = limit != null ? pct(used, limit) + '%' : '0%'; }));
    return li;
  };
  // Services card
  const label = O.el('div', 'ou-label', 'Services'), list = O.el('div', 'ou-list'); list.id = 'ouServices';
  const visitor = O.el('div'); visitor.id = 'ouVisitor';
  list.appendChild(visitor);
  const first = app.querySelector('.salebox'); first.before(label, list);
  // Visitor AI row follows the page's own numbers.
  const paintVisitor = () => {
    const dd = [...$('today').querySelectorAll('dd')].map(x => Number(x.textContent));
    if (dd.length < 3) return;
    const [used, limit] = dd, left = dd[2];
    visitor.replaceChildren(row('Visitor AI questions and screens', '#7a5af8', 'spark', used, limit, limit === 0 ? 'Off' : left === 0 ? 'Exhausted' : 'Available', limit === 0 ? 'off' : left === 0 ? 'bad' : 'ok'));
  };
  new MutationObserver(paintVisitor).observe($('today'), {childList: true}); paintVisitor();
  // Provider allowances from the read-only status list (preview sites only; the list is simply absent elsewhere).
  fetch('/.netlify/functions/owner-brain-live-checks', {credentials: 'same-origin', cache: 'no-store'}).then(r => r.ok ? r.json() : null).then(d => {
    if (!d || !Array.isArray(d.items)) return;
    d.items.forEach(s => {
      const limit = s.limitPerDay, used = s.usedToday || 0;
      const exhausted = limit != null && used >= limit;
      const status = !s.available ? 'Not configured' : exhausted ? 'Exhausted' : 'Available';
      list.appendChild(row(O.clean(s.label), exhausted ? '#e5484d' : s.available ? '#30b46c' : '#8e8e93', 'bolt', used, limit, status, !s.available ? 'off' : exhausted ? 'bad' : 'ok',
        !s.available ? (s.missing || 'Not configured') : null));
    });
    list.classList.add('ou-list');
  }).catch(() => {});
  // Existing limit form and tables, in the same language.
  const lim = $('lim'); lim.classList.add('ou-card', 'ou-pad'); app.querySelector('.salebox').classList.add('ou-card', 'ou-pad');
  app.querySelector('.salebox h3').className = 'ou-label'; app.querySelector('.salebox h3').style.margin = '0 0 6px';
  $('bar').parentElement.className = 'ou-bar';
  new MutationObserver(() => { const p = parseInt($('bar').style.width, 10) || 0; $('bar').parentElement.className = 'ou-bar ' + tone(p); }).observe($('bar'), {attributes: true, attributeFilter: ['style']});
  // Password resets and the 14 day table: folded rows.
  [...app.querySelectorAll(':scope > h2')].forEach(h => {
    const box = O.el('div', 'ou-card'); const siblings = []; let n = h.nextElementSibling;
    while (n && n.tagName !== 'H2') { siblings.push(n); n = n.nextElementSibling; }
    h.before(box); box.append(h, ...siblings);
    const resets = /Password/.test(h.textContent);
    O.fold(box, [h], {icon: resets ? 'people' : 'table', color: resets ? '#ff9f0a' : '#0a84ff', sub: O.el('span', 'ou-sub', resets ? 'Requests and temporary passwords' : 'Daily totals'), open: false});
  });
  O.cleanTree(main);
})();
