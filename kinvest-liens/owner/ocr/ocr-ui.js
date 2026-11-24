// County PDF Reader presentation: a simple upload row, a progress bar, and a result card with review controls.
// The reading itself is the page's own script; nothing is uploaded or stored by this file.
(function () {
  const O = window.OUI, $ = id => document.getElementById(id), main = document.querySelector('main.ocr');
  if (!O || !main) return;
  document.body.classList.add('ou', 'p-ocr');
  main.querySelector('h1').textContent = 'County PDF Reader';
  const back = O.el('a', 'ou-back', '← Owner Dashboard'); back.href = '/owner/'; main.prepend(back);
  const intro = main.querySelector(':scope > p.st');
  const about = O.el('div', 'ou-card'); const h = O.el('h2', '', 'About this tool'); intro.before(about); about.append(h, intro);
  O.fold(about, [h], {icon: 'info', color: '#2f80ed', sub: O.el('span', 'ou-sub', 'PDF up to about 4 MB, not stored')});
  const up = main.querySelector('.box'); up.className = 'ou-card ou-pad ou-upload';
  const res = $('res'); res.className = 'ou-card ou-pad'; const rh = res.querySelector('h2'); rh.className = 'ou-title'; rh.removeAttribute('style');
  const bar = up.querySelector('.bar'); bar.className = 'ou-bar'; $('bar').removeAttribute('class');
  O.cleanTree(main);
})();
