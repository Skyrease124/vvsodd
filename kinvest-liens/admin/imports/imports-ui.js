// Imports & Review presentation: each part of the page becomes an expandable section with its own status.
// Existing containers are moved, not rebuilt, so every control and handler is unchanged. No request is made here.
(function () {
  const O = window.OUI, $ = id => document.getElementById(id), root = $('ad');
  if (!O || !root) return;
  document.body.classList.add('ou', 'p-imp');
  document.querySelector('h1').textContent = 'Imports & Review';
  document.querySelectorAll('.pfpage > p.muted').forEach(p => p.classList.add('ou-hide'));
  const back = O.el('a', 'ou-back', '← Owner Dashboard'); back.href = '/owner/'; document.querySelector('.pfpage').prepend(back);
  const META = {
    'Ambiguous matches': ['check', '#ff9f0a', 'Pending records waiting for your decision'],
    'Import history': ['clock', '#2f80ed', 'Every county import and its status'],
    'Counties tracked': ['map', '#30b46c', 'Counties with imports'],
    'Estate links (reviewer)': ['link', '#8e6bd8', 'Confirm or remove an estate link'],
    'Email alerts': ['mail', '#ff6b3d', 'Run the member digest']
  };
  const badge = $('ad-n');
  const items = O.sectionize([...root.querySelectorAll(':scope > h2')], h => {
    const name = h.firstChild.textContent.trim(); const [ic, color, sub] = META[name] || ['info', '#8e8e93', ''];
    const pills = []; if (badge && h.contains(badge)) { pills.push(badge); }
    h.firstChild.textContent = name;
    return {icon: ic, color, sub: O.el('span', 'ou-sub', sub), pills, open: name === 'Ambiguous matches'};
  });
  // Keep the open count badge readable in the row.
  if (badge) badge.className = 'ou-pill warn';
  new MutationObserver(() => { badge.classList.toggle('ou-hide', badge.hidden); }).observe(badge, {attributes: true, attributeFilter: ['hidden'], childList: true});
  O.cleanTree(root);
  new MutationObserver(() => O.cleanTree(root)).observe(root, {childList: true, subtree: true});
})();
