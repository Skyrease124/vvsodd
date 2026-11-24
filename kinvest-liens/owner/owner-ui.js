// Shared helpers for owner settings pages: icons, expandable items, and separator cleanup in visible text.
// Pure presentation. It moves existing elements and never reads, stores or sends any value.
window.OUI = (function () {
  const svg = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  const ICON = {
    chev: svg('<path d="M9 6l6 6-6 6"/>'), key: svg('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>'),
    globe: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>'),
    spark: svg('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>'),
    doc: svg('<path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4M10 12h6M10 16h4"/>'),
    gauge: svg('<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-5"/>'),
    eye: svg('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    flag: svg('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'), check: svg('<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>'),
    sliders: svg('<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>'),
    info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'), bolt: svg('<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>'),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'), people: svg('<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/>'),
    table: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M9 10v9"/>')
  };
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const icon = (name, color) => { const s = el('span', 'ou-ico'); s.style.setProperty('--c', color || '#8e8e93'); s.innerHTML = ICON[name] || ICON.info; return s; };
  const pill = (text, kind) => el('span', 'ou-pill ' + (kind || ''), text);
  // "Name: Detail" for " - " style separators between words in visible text.
  const clean = t => String(t).replace(/\s[—–-]\s/g, ': ');
  function cleanTree(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {acceptNode: n => /\s[—–-]\s/.test(n.nodeValue) && !n.parentElement.closest('script,style,textarea,pre') ? 1 : 2});
    const nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
    nodes.forEach(n => { n.nodeValue = clean(n.nodeValue); });
  }
  // Turns `box` into an expandable item. `headNodes` move into the row; every other child moves into the folded body.
  function fold(box, headNodes, o = {}) {
    if (box.classList.contains('ou-item')) return box;
    const body = el('div', 'ou-in');
    [...box.childNodes].forEach(n => { if (!headNodes.includes(n)) body.appendChild(n); });
    const head = el('div', 'ou-head'); head.tabIndex = 0; head.setAttribute('role', 'button'); head.setAttribute('aria-expanded', 'false');
    const main = el('div', 'ou-main');
    headNodes.forEach(n => { if (n.tagName && /^H[1-6]$/.test(n.tagName)) { n.className = 'ou-title'; } main.appendChild(n); });
    if (o.sub) main.appendChild(o.sub);
    head.append(icon(o.icon, o.color), main);
    if (o.pills) { const p = el('div', 'ou-pills'); o.pills.forEach(x => p.appendChild(x)); head.appendChild(p); }
    const chev = el('span'); chev.innerHTML = ICON.chev; chev.firstChild.setAttribute('class', 'ou-chev'); head.appendChild(chev.firstChild);
    const wrap = el('div', 'ou-fold'); wrap.appendChild(body);
    box.append(head, wrap); box.classList.add('ou-item');
    const set = open => { box.classList.toggle('open', open); head.setAttribute('aria-expanded', String(open)); if (open) body.removeAttribute('inert'); else body.setAttribute('inert', ''); };
    head.addEventListener('click', () => set(!box.classList.contains('open')));
    head.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); set(!box.classList.contains('open')); } });
    set(!!o.open);
    return box;
  }
  return {svg, ICON, el, icon, pill, clean, cleanTree, fold};
})();
