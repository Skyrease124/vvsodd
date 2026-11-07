// Home page card: finds the visitor's state (connection guess, or exact location if they tap), links to its rules,
// and gives paid members an AI question box for that state. Nothing about location is saved on our servers.
(function () {
  const host = document.getElementById('yourstate'); if (!host || typeof STATES === 'undefined') return;
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const byA = a => STATES.find(s => s.a === a);
  const base = location.pathname.replace(/[^/]*$/, '');
  let state = null, paid = false, signedIn = false, askBox = null;
  const store = { get() { try { return localStorage.getItem('ppa_state'); } catch (e) { return null; } }, set(v) { try { localStorage.setItem('ppa_state', v); } catch (e) {} } };

  const wrap = mk('div', 'ys-card'); host.appendChild(wrap);
  const title = mk('h2', 'ys-title'), sub = mk('p', 'ys-sub'), row = mk('div', 'ys-row'), note = mk('p', 'ys-note small');
  const rules = mk('a', 'dbtn', 'See rules'); rules.href = '#';
  const pick = mk('select', 'ys-pick'); pick.setAttribute('aria-label', 'Choose your state');
  pick.appendChild(new Option('Not your state? Choose one', ''));
  STATES.slice().sort((a, b) => a.n.localeCompare(b.n)).forEach(s => pick.appendChild(new Option(s.n, s.a)));
  const loc = mk('button', 'ys-ghost', 'Use my exact location'); loc.type = 'button';
  row.append(rules, pick, loc);
  const aiHost = mk('div', 'ys-ai');
  wrap.append(title, sub, row, note, aiHost);

  function setState(a, how) {
    const s = byA(a); if (!s) return;
    state = a; store.set(a);
    title.textContent = how === 'guess' ? 'You look like you are in ' + s.n : s.n;
    sub.textContent = s.sys + ' state. ' + s.rate + ' · Redemption: ' + s.red;
    rules.textContent = 'See ' + s.n + '’s rules'; rules.href = base + 'liens/states/state/?s=' + a;
    pick.value = '';
    renderAi();
  }

  function renderAi() {
    aiHost.textContent = ''; const s = byA(state); if (!s) return;
    aiHost.appendChild(mk('h3', 'ys-h3', 'Ask the AI about ' + s.n));
    if (!paid) {
      const lock = mk('p', 'ys-lock');
      lock.append(mk('b', '', '🔒 Members only. '));
      lock.append(signedIn ? 'Your account is free, so the AI is locked. Pro members ($5.50 a week) can use it. ' : 'The AI question box is for Pro members ($5.50 a week). ');
      const a = mk('a', '', signedIn ? 'See my plan' : 'Sign in or create an account'); a.href = signedIn ? '/account/' : '/login/?next=' + encodeURIComponent(location.pathname);
      lock.appendChild(a); aiHost.appendChild(lock); return;
    }
    const form = mk('form', 'ys-form'), inp = mk('input'); inp.type = 'text'; inp.maxLength = 300; inp.placeholder = 'e.g. How long does the owner have to redeem?'; inp.setAttribute('aria-label', 'Your question');
    const go = mk('button', 'dbtn', 'Ask'); go.type = 'submit'; form.append(inp, go);
    const chips = mk('div', 'ys-chips'), out = mk('div', 'ys-out'); out.hidden = true;
    ['How long does the owner have to redeem?', 'What does a buyer earn?', 'When is the next sale?'].forEach(q => { const b = mk('button', 'ys-chip', q); b.type = 'button'; b.addEventListener('click', () => { inp.value = q; ask(); }); chips.appendChild(b); });
    async function ask() {
      const q = inp.value.replace(/\s+/g, ' ').trim(); if (q.length < 3) return;
      go.disabled = true; out.hidden = false; out.textContent = 'Looking that up…';
      try {
        const r = await fetch('/.netlify/functions/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state, question: q }) });
        const d = await r.json().catch(() => ({}));
        out.textContent = '';
        if (r.ok && d.answer) {
          out.appendChild(mk('p', '', d.answer));
          if (d.sources && d.sources.length) { const ul = mk('ul', 'small'); d.sources.forEach(x => { const li = mk('li'), a = mk('a', '', x[0]); a.href = x[1]; a.target = '_blank'; a.rel = 'noopener noreferrer'; li.appendChild(a); ul.appendChild(li); }); out.appendChild(ul); }
          out.appendChild(mk('p', 'small', 'Automated answer from the information on this site. Educational only, not advice, and it may be wrong. Confirm with the county.'));
        } else out.textContent = d.error || 'Something went wrong. Please try again.';
      } catch (e) { out.textContent = 'Could not reach the question service. Try again.'; }
      go.disabled = false;
    }
    form.addEventListener('submit', e => { e.preventDefault(); ask(); });
    aiHost.append(form, chips, out);
  }

  pick.addEventListener('change', () => { if (pick.value) setState(pick.value, 'pick'); });
  loc.addEventListener('click', () => {
    if (!navigator.geolocation) { note.textContent = 'Your browser cannot share its location. Choose your state from the list.'; return; }
    note.textContent = 'Asking your phone for your location…'; loc.disabled = true;
    navigator.geolocation.getCurrentPosition(async pos => {
      try {
        const r = await fetch('/.netlify/functions/where?lat=' + pos.coords.latitude.toFixed(4) + '&lon=' + pos.coords.longitude.toFixed(4));
        const d = await r.json();
        if (d.state && byA(d.state)) { setState(d.state, 'exact'); note.textContent = 'Found you. We use your location for this one lookup and do not save it.'; }
        else note.textContent = 'That location is not in a US state we cover. Choose your state from the list.';
      } catch (e) { note.textContent = 'Could not look that up. Choose your state from the list.'; }
      loc.disabled = false;
    }, err => { note.textContent = err && err.code === 1 ? 'Location is off for this site. You can choose your state from the list instead.' : 'Could not get your location. Choose your state from the list.'; loc.disabled = false; }, { timeout: 12000, maximumAge: 600000 });
  });

  (async () => {
    try {
      const [acct, guess] = await Promise.all([
        fetch('/.netlify/functions/account').then(r => r.json()).catch(() => ({})),
        fetch('/.netlify/functions/where').then(r => r.json()).catch(() => ({}))
      ]);
      const u = acct && acct.user; signedIn = !!u;
      const today = new Date().toISOString().slice(0, 10);
      paid = !!(u && (u.owner || (u.paidThrough && u.paidThrough >= today)));
      host.hidden = false;
      const saved = store.get();
      if (saved && byA(saved)) setState(saved, 'pick');
      else if (guess && guess.state && byA(guess.state)) setState(guess.state, 'guess');
      else { title.textContent = 'Find your state'; sub.textContent = 'Choose your state to see its rules and ask the AI about it.'; rules.hidden = true; }
      pick.addEventListener('change', () => { rules.hidden = false; });
      if (!state) { rules.hidden = true; }
    } catch (e) { host.hidden = true; }
  })();
})();
