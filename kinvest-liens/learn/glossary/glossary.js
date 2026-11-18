(function () {
  const $ = id => document.getElementById(id), app = $('app');
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  let all = [], scope = 'all';
  const NAMES = { national: 'All states', FL: 'Florida', TX: 'Texas', AZ: 'Arizona', IA: 'Iowa', MI: 'Michigan', CO: 'Colorado' };
  const norm = s => String(s).toLowerCase();
  function filter(q) {
    const t = norm(q).trim(), words = t.split(/\s+/).filter(Boolean);
    return all.filter(e => scope === 'all' || e.scope === scope).map(e => {
      const term = norm(e.term), hay = term + ' ' + norm(e.def); let s = 0; if (!words.length) return { e, s: 0 };
      if (term === t) s += 100; else if (term.startsWith(t)) s += 50; else if (term.includes(t)) s += 30;
      for (const w of words) { if (hay.includes(w)) s += 5; else return null; } return { e, s };
    }).filter(Boolean).sort((a, b) => b.s - a.s || a.e.term.localeCompare(b.e.term)).map(x => x.e);
  }
  // safe highlighting: only text nodes and <mark> elements are created
  function hl(el, text, words) {
    if (!words.length) { el.appendChild(document.createTextNode(text)); return; }
    const re = new RegExp('(' + words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'ig');
    text.split(re).forEach((part, i) => { if (i % 2) el.appendChild(mk('mark', '', part)); else if (part) el.appendChild(document.createTextNode(part)); });
  }
  function draw() {
    const q = $('gq').value, words = norm(q).split(/\s+/).filter(Boolean), list = filter(q), out = $('gout'); out.textContent = '';
    $('gcount').textContent = list.length + (list.length === 1 ? ' term' : ' terms') + (q.trim() ? ' for “' + q.trim() + '”' : '');
    if (!list.length) { out.appendChild(mk('p', 'muted', 'No term matches that. Try one word, such as “redemption”, “deed” or “bid”.')); return; }
    const dl = mk('dl', 'gl2');
    list.forEach((e, i) => { const d = mk('div'); d.style.animationDelay = Math.min(i, 8) * 25 + 'ms'; const dt = mk('dt'); hl(dt, e.term, words); dt.appendChild(mk('span', 'gtag' + (e.scope === 'national' ? '' : ' st'), e.scope === 'national' ? 'General' : (NAMES[e.scope] || e.scope))); const dd = mk('dd'); hl(dd, e.def, words);
      if (e.course) { dd.appendChild(document.createTextNode(' ')); const a = mk('a', 'small', 'From the ' + (NAMES[e.scope] || e.scope) + ' course' + (e.checked ? ' (checked ' + e.checked + ')' : '') + ' →'); a.href = '/learn/course/?c=' + e.course; dd.appendChild(a); }
      d.append(dt, dd); dl.appendChild(d); });
    out.appendChild(dl);
  }
  fetch('/.netlify/functions/learnhub?glossary=1').then(r => r.json()).then(d => {
    all = d.terms; app.textContent = '';
    const st = mk('div', 'gstick'); const lab = mk('label', 'gsearch', 'Search terms'); const inp = mk('input'); inp.id = 'gq'; inp.type = 'search'; inp.placeholder = 'Try “redemption”'; inp.autocomplete = 'off'; inp.setAttribute('aria-controls', 'gout'); lab.appendChild(inp);
    const chips = mk('div', 'gchips'); chips.setAttribute('role', 'group'); chips.setAttribute('aria-label', 'Show terms for');
    [['all', 'Everything'], ['national', 'General'], ...d.states.filter(s => s !== 'national').sort().map(s => [s, NAMES[s] || s])].forEach(([k, t]) => { const b = mk('button', 'chip' + (k === scope ? ' on' : ''), t); b.type = 'button'; b.setAttribute('aria-pressed', String(k === scope)); b.addEventListener('click', () => { scope = k; chips.querySelectorAll('button').forEach(x => { const on = x === b; x.className = 'chip' + (on ? ' on' : ''); x.setAttribute('aria-pressed', String(on)); }); draw(); }); chips.appendChild(b); });
    st.append(lab, chips); const cnt = mk('p', 'small muted'); cnt.id = 'gcount'; cnt.setAttribute('role', 'status'); const out = mk('div'); out.id = 'gout';
    app.append(st, cnt, out); inp.addEventListener('input', draw); const pre = new URLSearchParams(location.search).get('q'); if (pre) inp.value = pre; draw();
  }).catch(() => { app.textContent = 'Could not load the glossary. Please try again.'; });
})();
