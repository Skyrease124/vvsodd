// API Keys presentation: one compact row per provider with connection and configuration status, controls folded inside.
// It only moves existing elements and reads the status line the page already shows (the last four characters at most).
// No secret value is read, stored or sent here, and no request is made.
(function () {
  const O = window.OUI, $ = id => document.getElementById(id), main = document.querySelector('main.okeys');
  if (!O || !main) return;
  document.body.classList.add('ou');
  const COLORS = ['#7a5af8', '#2f80ed', '#30b46c', '#ff9f0a', '#e5484d', '#1fb5ad', '#d9a21b', '#8e6bd8', '#ff6b3d', '#0a84ff'];
  const colorFor = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return COLORS[h % COLORS.length]; };
  const h1 = main.querySelector('h1'); h1.textContent = 'API Keys';
  const intro = main.querySelector(':scope > p.st'); intro.textContent = 'Saved keys stay on the server. Only the last 4 characters are ever shown.'; intro.classList.add('ou-sub');
  const back = O.el('a', 'ou-back', '← Owner Dashboard'); back.href = '/owner/'; main.prepend(back);
  const pdfLink = main.querySelector('a[href="/owner/ocr/"]'); if (pdfLink) { pdfLink.textContent = 'County PDF Reader'; pdfLink.parentElement.classList.add('ou-sub'); }
  // Search over providers.
  const search = O.el('div', 'ou-search'); search.innerHTML = O.ICON.search;
  const input = O.el('input'); input.type = 'search'; input.placeholder = 'Search providers'; input.setAttribute('aria-label', 'Search providers'); input.autocomplete = 'off'; search.appendChild(input);
  const list = $('list'); list.before(search);
  const empty = O.el('p', 'ou-empty', 'No provider matches your search.'); empty.hidden = true; list.after(empty);
  const listLabel = O.el('div', 'ou-label', 'Providers'); search.after(listLabel);
  const apply = () => {
    const t = input.value.toLowerCase().split(/\s+/).filter(Boolean); let n = 0;
    list.querySelectorAll(':scope > .ou-item').forEach(r => { const ok = t.every(x => r.dataset.text.includes(x)); r.classList.toggle('ou-hide', !ok); if (ok) n++; });
    empty.hidden = n > 0 || !list.querySelector('.ou-item');
  };
  input.addEventListener('input', apply);
  const statusOf = pre => pre.classList.contains('good') ? ['Test passed', 'ok'] : pre.classList.contains('bad') ? ['Test failed', 'bad'] : null;
  const enhance = () => {
    const cards = [...list.querySelectorAll(':scope > section.okey')];
    if (!cards.length) return;
    list.classList.add('ou-list');
    cards.forEach(card => {
      const title = card.querySelector('h2'), st = card.querySelector('p.st');
      const saved = /^Saved/.test(st ? st.textContent : '');
      const source = saved && st.textContent.includes('·') ? st.textContent.split('·').slice(1).join('·').trim() : '';
      const name = O.clean(title.textContent);
      const pills = [O.pill(saved ? 'Key saved' : 'No key', saved ? 'ok' : 'off')];
      const test = O.pill('Not tested', 'off'); test.classList.add('ou-hide'); pills.push(test);
      const sub = O.el('span', 'ou-sub', saved ? (source || 'Configured') : 'Not configured');
      const pre = card.querySelector('pre');
      if (pre) new MutationObserver(() => { const s = statusOf(pre); if (s) { test.textContent = s[0]; test.className = 'ou-pill ' + s[1]; } }).observe(pre, {attributes: true, childList: true, characterData: true, subtree: true});
      card.className = ''; title.textContent = name;
      O.fold(card, [title], {icon: 'key', color: colorFor(name), sub, pills});
      if (st) st.classList.add('ou-hide');
      card.dataset.text = (name + ' ' + (saved ? 'saved connected' : 'not configured')).toLowerCase();
    });
    apply();
  };
  new MutationObserver(enhance).observe(list, {childList: true});
  enhance();
  // Provider setup notes and research controls: folded rows after the list.
  const notes = [...main.querySelectorAll(':scope > section.okey')];
  const wrapNotes = O.el('div', 'ou-list'); const noteLabel = O.el('div', 'ou-label', 'Setup notes and limits');
  const rc = $('researchControls');
  notes.forEach(sec => {
    const h = sec.querySelector('h2'); if (!h) return;
    if (sec === rc) {
      const rcTitle = h; rcTitle.textContent = 'AI Research Controls';
      sec.className = '';
      // Groq has its own heading inside; keep it as part of the folded body.
      O.fold(sec, [rcTitle], {icon: 'sliders', color: '#7a5af8', sub: O.el('span', 'ou-sub', 'Tavily and Groq limits')});
    } else {
      sec.className = ''; h.textContent = O.clean(h.textContent);
      O.fold(sec, [h], {icon: 'info', color: colorFor(h.textContent), sub: O.el('span', 'ou-sub', 'Setup notes')});
    }
    wrapNotes.appendChild(sec);
  });
  const lastKey = list.nextElementSibling === empty ? empty : list;
  empty.after(noteLabel, wrapNotes);
  O.cleanTree(main);
  document.querySelectorAll('hr').forEach(x => x.classList.add('ou-hide'));
})();
