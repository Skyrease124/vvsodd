// MapTiler Preview: surrounding interface only. The map, its scripts, its requests and its controls are untouched.
(function () {
  const O = window.OUI, wrap = document.querySelector('.wrap');
  if (!O || !wrap) return;
  document.body.classList.add('oum');
  const h1 = wrap.querySelector('h1'); h1.textContent = 'MapTiler Preview';
  const back = wrap.querySelector('a[href="/owner/"]'); if (back) back.classList.add('ou-back');
  const intro = wrap.querySelector(':scope > p'); if (intro) intro.classList.add('ou-hide');
  // The licensing and quota note folds into one row.
  const note = [...wrap.querySelectorAll(':scope > .panel')].find(p => /MapTiler testing only/.test(p.textContent));
  if (note) {
    const t = O.el('h2', '', 'Usage and quota notice'); note.prepend(t); note.querySelector('b')?.remove();
    const status = note.querySelector('#status'), setup = note.querySelector('#setup');
    note.classList.add('ou-card');
    // The status line and setup link stay visible below the row, outside the fold.
    const keep = [status, setup].filter(Boolean); keep.forEach(n => note.after(n));
    O.fold(note, [t], {icon: 'info', color: '#ff9f0a', sub: O.el('span', 'ou-sub', 'Each map load may use your MapTiler quota')});
    if (status) status.classList.add('ou-sub');
  }
  O.cleanTree(wrap);
  new MutationObserver(() => { const s = document.getElementById('status'); if (s) O.cleanTree(s); }).observe(document.getElementById('status') || wrap, {childList: true, characterData: true, subtree: true});
})();
