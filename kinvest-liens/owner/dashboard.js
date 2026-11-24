// Owner Dashboard landing page: compact settings rows, grouped, with instant local search.
// Rows are built only after owner validation. Every row links to its existing page; no data is requested here.
window.ppaAccount.then(user => {
  const status = document.getElementById('owner-status');
  if (!user?.owner) { status.textContent = 'Owner access is required.'; return; }
  document.getElementById('owner-badge').hidden = false;
  status.hidden = true;
  const list = document.getElementById('owner-tools');
  const svg = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  const I = {
    brain: svg('<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V4a3 3 0 0 0-3 0Z"/><path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1"/>'),
    spark: svg('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16v4M17 18h4"/>'),
    key: svg('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>'),
    gauge: svg('<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-5"/>'),
    map: svg('<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>'),
    inbox: svg('<path d="M4 13l2-8h12l2 8"/><path d="M4 13v6h16v-6h-5a3 3 0 0 1-6 0z"/>'),
    cert: svg('<path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4M10 12h6M10 16h4"/>'),
    send: svg('<path d="M4 12l16-8-6 16-3-7z"/>'),
    pdf: svg('<path d="M6 3h9l4 4v14H6z"/><path d="M9 14h6M9 17h4M9 11h2"/>'),
    globe: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>'),
    people: svg('<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5a3 3 0 0 1 0 6M18 20a6 6 0 0 0-2-4.5"/>'),
    card: svg('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>'),
    receipt: svg('<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>'),
    bell: svg('<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>')
  };
  const chev = svg('<path d="M9 6l6 6-6 6"/>');
  const groups = [
    ['Intelligence', [
      ['AI Brain Control Center', '/owner/brain/', 'brain', '#7a5af8', 'ai brain agents queue'],
      ['Intelligence Center', '/owner/intelligence/', 'spark', '#d9a21b', 'research sources firecrawl'],
      ['API Keys', '/owner/keys/', 'key', '#8e8e93', 'credentials services'],
      ['Usage & Limits', '/usage/', 'gauge', '#0a84ff', 'usage limits activity']
    ]],
    ['Property & Research', [
      ['Map Coverage & Repair', '/owner/map-coverage/', 'map', '#30b46c', 'parcel locations maps'],
      ['Imports & Review', '/admin/imports/', 'inbox', '#ff9f0a', 'county data imports'],
      ['Certificate Review', '/owner/certificates/', 'cert', '#ff453a', 'florida tax certificates'],
      ['Research Releases', '/owner/research-releases/', 'send', '#1fb5ad', 'pro early access liens land'],
      ['County PDF Reader', '/owner/ocr/', 'pdf', '#e5484d', 'ocr extract records'],
      ['MapTiler Preview', '/owner/maptiler/', 'globe', '#2f80ed', 'satellite terrain boundaries']
    ]],
    ['Business', [
      ['Members', '/members/', 'people', '#0a84ff', 'access membership accounts'],
      ['Payments & Revenue', '/owner/payments/', 'card', '#30b46c', 'stripe donations pro'],
      ['Billing Setup', '/billing/', 'receipt', '#8e6bd8', 'billing configuration'],
      ['Retail Alerts', '/owner/retail/', 'bell', '#ff6b3d', 'alert settings']
    ]]
  ];
  const search = document.createElement('div'); search.className = 'od-search';
  search.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
  const input = document.createElement('input');
  input.type = 'search'; input.placeholder = 'Search settings'; input.setAttribute('aria-label', 'Search settings'); input.autocomplete = 'off';
  search.appendChild(input);
  list.before(search);
  const empty = document.createElement('p'); empty.className = 'od-empty'; empty.hidden = true; empty.textContent = 'No settings match your search.';
  const rows = [];
  groups.forEach(([title, items]) => {
    const section = document.createElement('section'); section.className = 'od-group';
    const h = document.createElement('h2'); h.textContent = title;
    const ul = document.createElement('ul'); ul.className = 'od-list';
    items.forEach(([name, url, icon, color, words]) => {
      const li = document.createElement('li');
      const a = document.createElement('a'); a.className = 'od-row'; a.href = url;
      const ico = document.createElement('span'); ico.className = 'od-ico'; ico.style.setProperty('--c', color); ico.innerHTML = I[icon];
      const label = document.createElement('span'); label.className = 'od-name'; label.textContent = name;
      const c = document.createElement('span'); c.innerHTML = chev; c.firstChild.setAttribute('class', 'od-chev');
      a.append(ico, label, c.firstChild); li.appendChild(a); ul.appendChild(li);
      rows.push({li, section, text: (name + ' ' + title + ' ' + words).toLowerCase()});
    });
    section.append(h, ul); list.appendChild(section);
  });
  list.appendChild(empty);
  const filter = () => {
    const terms = input.value.toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    rows.forEach(r => { const ok = terms.every(t => r.text.includes(t)); r.li.hidden = !ok; if (ok) shown++; });
    document.querySelectorAll('.od-group').forEach(s => { s.hidden = ![...s.querySelectorAll('li')].some(li => !li.hidden); });
    empty.hidden = shown > 0;
  };
  input.addEventListener('input', filter);
  list.hidden = false;
});
