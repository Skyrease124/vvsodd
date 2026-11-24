// Navigation layer for the AI Brain Control Center: grouped jump rows and instant local search over the panels.
// It reads headings already on the page and hides or shows panels. It makes no requests and changes no panel content.
(function () {
  const main = document.querySelector('main');
  if (!main) return;
  const svg = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  const ICON = {
    bolt: svg('<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>'), map: svg('<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>'),
    check: svg('<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>'), spark: svg('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>'),
    inbox: svg('<path d="M4 13l2-8h12l2 8"/><path d="M4 13v6h16v-6h-5a3 3 0 0 1-6 0z"/>'), list: svg('<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>'),
    send: svg('<path d="M4 12l16-8-6 16-3-7z"/>'), shield: svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>')
  };
  const colors = {bolt: '#30b46c', map: '#2f80ed', check: '#ff9f0a', spark: '#7a5af8', inbox: '#1fb5ad', list: '#8e8e93', send: '#d9a21b', shield: '#e5484d'};
  const panels = [...main.querySelectorAll('section')].filter(s => s.querySelector('h2'));
  const meta = s => {
    const t = s.querySelector('h2').textContent.trim(), l = t.toLowerCase();
    if (s.id === 'unattendedStatus') return ['Automation', 'bolt'];
    if (/monitor|photon|geoapify|publication/.test(l)) return ['Automation', /publication/.test(l) ? 'map' : 'bolt'];
    if (/approval queue|nvidia|correction review|review queue/.test(l)) return ['Review & Approval', /nvidia/.test(l) ? 'spark' : 'check'];
    if (/intake/.test(l)) return ['Property Data', 'inbox'];
    if (/parcel matches/.test(l)) return ['Property Data', 'map'];
    if (/research releases/.test(l)) return ['Property Data', 'send'];
    if (/live checks/.test(l)) return ['Property Data', 'shield'];
    return ['Property Data', 'list'];
  };
  const nav = document.createElement('nav'); nav.className = 'bn'; nav.setAttribute('aria-label', 'Control Center sections');
  const box = document.createElement('div'); box.className = 'bn-search';
  box.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
  const input = document.createElement('input'); input.type = 'search'; input.placeholder = 'Search the Control Center'; input.setAttribute('aria-label', 'Search the Control Center'); input.autocomplete = 'off';
  box.appendChild(input); nav.appendChild(box);
  const groups = new Map(), rows = [];
  const seen = new Set();
  panels.forEach((s, i) => {
    const title = s.querySelector('h2').textContent.replace(/\s+/g, ' ').trim();
    if (seen.has(title)) return;
    seen.add(title);
    if (!s.id) s.id = 'bn-panel-' + i;
    const [g, ic] = meta(s);
    if (!groups.has(g)) { const sec = document.createElement('div'); sec.className = 'bn-group'; sec.innerHTML = '<h3></h3><ul class="bn-list"></ul>'; sec.firstChild.textContent = g; groups.set(g, sec); nav.appendChild(sec); }
    const li = document.createElement('li'), a = document.createElement('a'); a.className = 'bn-row'; a.href = '#' + s.id;
    const ico = document.createElement('span'); ico.className = 'bn-ico'; ico.style.setProperty('--c', colors[ic]); ico.innerHTML = ICON[ic];
    const name = document.createElement('span'); name.className = 'bn-name'; name.textContent = s.querySelector('h2').textContent.replace(/\s+/g, ' ').trim().replace(/\s[\u2014\u2013-]\s/g, ': ');
    const chev = document.createElement('span'); chev.innerHTML = svg('<path d="M9 6l6 6-6 6"/>'); chev.firstChild.setAttribute('class', 'bn-chev');
    a.append(ico, name, chev.firstChild); li.appendChild(a); groups.get(g).querySelector('ul').appendChild(li);
    rows.push({li, s, text: (s.querySelector('section') ? s.querySelector('h2').textContent : (s.textContent || '')).toLowerCase().replace(/\s+/g, ' ')});
  });

  // Tools: the two links that sit above the panels become compact rows. The original links stay in the page, hidden.
  const tools = [['County Connectors', '/owner/brain/connectors/', 'map'], ['NVIDIA Pulse Reactor', '/owner/brain/activity/', 'spark']];
  const toolRows = [];
  const toolGroup = document.createElement('div'); toolGroup.className = 'bn-group'; toolGroup.innerHTML = '<h3>Tools</h3><ul class="bn-list"></ul>';
  tools.forEach(([name, href, ic]) => {
    const li = document.createElement('li'), a = document.createElement('a'); a.className = 'bn-row'; a.href = href;
    const ico = document.createElement('span'); ico.className = 'bn-ico'; ico.style.setProperty('--c', ic === 'map' ? '#2f80ed' : '#7a5af8'); ico.innerHTML = ICON[ic];
    const label = document.createElement('span'); label.className = 'bn-name'; label.textContent = name;
    const chev = document.createElement('span'); chev.innerHTML = svg('<path d="M9 6l6 6-6 6"/>'); chev.firstChild.setAttribute('class', 'bn-chev');
    a.append(ico, label, chev.firstChild); li.appendChild(a); toolGroup.querySelector('ul').appendChild(li); toolRows.push({li, text: name.toLowerCase() + ' tools'});
  });
  nav.insertBefore(toolGroup, box.nextSibling);
  main.querySelectorAll(':scope > p').forEach(p => {
    if (p.querySelector('a[href="/owner/brain/connectors/"], a[href="/owner/brain/activity/"]')) p.classList.add('bn-hide');
    else if (/AI Brain runs scheduled research/.test(p.textContent)) {
      p.classList.add('bn-hide');
      const d = document.createElement('details'); d.className = 'bn-about'; const sm = document.createElement('summary'); sm.textContent = 'About the AI Brain';
      const t = document.createElement('p'); t.textContent = p.textContent; d.append(sm, t); nav.appendChild(d);
    }
  });
  const empty = document.createElement('p'); empty.className = 'bn-empty'; empty.hidden = true; empty.textContent = 'Nothing matches your search.';
  nav.appendChild(empty);
  main.querySelector('h1').after(nav);
  const filter = () => {
    const terms = input.value.toLowerCase().split(/\s+/).filter(Boolean); let n = 0;
    rows.forEach(r => { const ok = terms.every(t => r.text.includes(t)); r.li.classList.toggle('bn-hide', !ok && !r.s.querySelector('section')); if (!r.s.querySelector('section')) r.s.classList.toggle('bn-hide', !ok); if (ok) n++; });
    toolRows.forEach(r => r.li.classList.toggle('bn-hide', !terms.every(t => r.text.includes(t))));
    toolGroup.classList.toggle('bn-hide', !toolRows.some(r => !r.li.classList.contains('bn-hide')));
    groups.forEach(g => g.classList.toggle('bn-hide', ![...g.querySelectorAll('li')].some(li => !li.classList.contains('bn-hide'))));
    empty.hidden = n > 0 || toolRows.some(r => !r.li.classList.contains('bn-hide'));
  };
  input.addEventListener('input', filter);
})();
