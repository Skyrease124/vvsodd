// Intelligence Center presentation: grouped, expandable source monitoring. Moves existing elements only;
// every button keeps its original handler and no request is made here.
(function () {
  const O = window.OUI, $ = id => document.getElementById(id);
  const main = $('ownerMain'), ws = $('workspace');
  if (!O || !main || !ws) return;
  const back = main.querySelector('a[href="/owner/"]'); if (back) back.classList.add('ou-back');
  main.querySelector('h1').textContent = 'Intelligence Center';
  const hero = main.querySelector('.hero'); if (hero) { hero.classList.add('ou-hero'); }
  // Statistics: three compact tiles.
  const stats = ws.querySelector('.stats'); stats.className = 'ou-stats';
  [...stats.children].forEach(d => d.classList.add('ou-stat'));
  // Research controls: one folded row.
  const ctl = [...ws.querySelectorAll(':scope > .card')].find(c => /Private research controls/.test(c.textContent));
  const h = n => n.querySelector('h2');
  if (ctl) { ctl.classList.add('ou-card'); O.fold(ctl, [h(ctl)], {icon: 'sliders', color: '#7a5af8', sub: O.el('span', 'ou-sub', 'Method and AI summary')}); }
  const msg = $('message'); if (msg) msg.classList.add('ou-sub');
  // Source monitoring: a section label, then groups by verification status.
  const srcHeading = [...ws.children].find(n => n.tagName === 'H2' && /source monitoring/i.test(n.textContent));
  if (srcHeading) { srcHeading.className = 'ou-label'; srcHeading.textContent = 'Source monitoring'; }
  const GROUPS = [
    ['pending', 'Pending discoveries', 'flag', '#ff9f0a', 'warn'],
    ['monitored', 'Monitored and verified', 'check', '#30b46c', 'ok'],
    ['unchecked', 'Not checked yet', 'eye', '#8e8e93', 'off']
  ];
  const kindOf = t => /needs owner review/i.test(t) ? 'pending' : /^Not checked/i.test(t) ? 'unchecked' : 'monitored';
  const root = $('sourceCards');
  const enhance = () => {
    const cards = [...root.querySelectorAll(':scope > article.card')];
    if (!cards.length) return;
    const buckets = {pending: [], monitored: [], unchecked: []};
    cards.forEach(card => {
      const status = card.children[2] ? card.children[2].textContent : '';
      const title = card.querySelector('h2'), kind = card.querySelector('.pill');
      const hasSummary = [...card.querySelectorAll('p')].some(p => /^AI summary:/.test(p.textContent));
      const pills = [];
      if (hasSummary) pills.push(O.pill('Summary', 'ok'));
      const g = kindOf(status);
      if (card.children[2]) card.children[2].classList.add('ou-hide');
      card.classList.remove('card');
      O.fold(card, [title, kind].filter(Boolean), {icon: 'doc', color: g === 'pending' ? '#ff9f0a' : g === 'monitored' ? '#30b46c' : '#8e8e93', sub: O.el('span', 'ou-sub', status), pills, open: g === 'pending'});
      if (kind) kind.className = 'ou-sub';
      buckets[g].push(card);
    });
    const frag = document.createDocumentFragment();
    GROUPS.forEach(([key, label, , , cls]) => {
      if (!buckets[key].length) return;
      const wrap = O.el('section', 'ou-group');
      const lab = O.el('div', 'ou-label'); lab.append(label + ' ', O.pill(String(buckets[key].length), cls));
      const list = O.el('div', 'ou-list'); buckets[key].forEach(c => list.appendChild(c));
      wrap.append(lab, list); frag.appendChild(wrap);
    });
    root.replaceChildren(frag);
    O.cleanTree(root);
  };
  new MutationObserver(enhance).observe(root, {childList: true});
  enhance();
  // Upcoming tools: a folded row, with its original details element kept.
  const up = ws.querySelector('details.card'); if (up) up.classList.add('ou-card', 'ou-pad');
  if (hero) hero.querySelectorAll('p.muted').forEach(p => p.classList.add('ou-hide'));
  O.cleanTree(main);
  new MutationObserver(() => O.cleanTree($('fcStatus'))).observe($('fcStatus'), {childList: true});
})();
