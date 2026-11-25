// Certificate Review presentation: compact, searchable rows with expandable property details.
// Cards the page already renders are moved into rows; the Review button and every handler stay as they were.
(function () {
  const O = window.OUI, $ = id => document.getElementById(id), main = document.querySelector('main');
  if (!O || !main) return;
  document.body.classList.add('ou', 'p-cert');
  const h1 = main.querySelector('h1'); h1.textContent = 'Certificate Review';
  const sub = main.querySelector('p.sub'); if (sub) sub.classList.add('ou-hide');
  const access = $('access'); if (access) access.classList.add('ou-sub');
  // The research-only notice folds into one row.
  const notice = main.querySelector('.notice');
  if (notice) { const t = O.el('h2', '', 'Research only, not for sale'); notice.prepend(t); notice.querySelector('strong')?.remove(); notice.classList.add('ou-card'); O.fold(notice, [t], {icon: 'info', color: '#ff9f0a', sub: O.el('span', 'ou-sub', 'How decisions are published')}); }
  const sum = main.querySelector('section.summary'); if (sum) sum.classList.add('ou-card', 'ou-pad');
  const auto = main.querySelector('.auto-tools');
  if (auto) { auto.classList.add('ou-card'); const h = auto.querySelector('h2'); h.textContent = 'AI Auto Review'; O.fold(auto, [h], {icon: 'spark', color: '#7a5af8', sub: O.el('span', 'ou-sub', 'Owner only review scans')}); }
  const rp = $('reviewPanel'); if (rp) rp.classList.add('ou-card', 'ou-pad');
  // Certificate records: one row each.
  const cards = $('cards');
  const enhance = () => {
    [...cards.querySelectorAll(':scope > article.card')].forEach(card => {
      const title = card.querySelector('h2'), tag = card.querySelector('.pill');
      const parcel = [...card.querySelectorAll('p')].map(p => p.textContent).find(t => /^Parcel:/.test(t)) || '';
      const year = [...card.querySelectorAll('p')].map(p => p.textContent).find(t => /^Tax year:/.test(t)) || '';
      const decision = tag ? tag.textContent : 'Awaiting review';
      const kind = /approved/i.test(decision) ? 'ok' : /reject/i.test(decision) ? 'bad' : /follow/i.test(decision) ? 'warn' : 'off';
      if (tag) tag.remove();
      card.classList.remove('card');
      O.fold(card, [title], {icon: 'doc', color: kind === 'ok' ? '#30b46c' : kind === 'bad' ? '#e5484d' : kind === 'warn' ? '#ff9f0a' : '#8e8e93',
        sub: O.el('span', 'ou-sub', [parcel.replace(/^Parcel:\s*/, 'Parcel '), year.replace(/^Tax year:\s*/, 'Year ')].filter(Boolean).join(' · ')), pills: [O.pill(decision.replace(/-/g, ' '), kind)]});
    });
    cards.classList.add('ou-list');
  };
  new MutationObserver(enhance).observe(cards, {childList: true}); enhance();
  // Automatic review items: the same rows, and the page keeps its own buttons.
  const items = $('autoItems');
  if (items) new MutationObserver(() => O.cleanTree(items)).observe(items, {childList: true, subtree: true});
  O.cleanTree(main);
  const stats = $('stats'); if (stats) new MutationObserver(() => O.cleanTree(stats)).observe(stats, {childList: true, characterData: true, subtree: true});
})();
