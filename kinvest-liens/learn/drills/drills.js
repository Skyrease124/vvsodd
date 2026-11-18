(function () {
  const app = document.getElementById('app'), API = '/.netlify/functions/drills', Q = new URLSearchParams(location.search);
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  let info = null, state = (Q.get('state') || 'FL').toUpperCase(), level = Number(Q.get('level') || 1), cur = null;
  const api = async (method, body, qs) => { const r = await fetch(API + (qs || ''), { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined }); let d = {}; try { d = await r.json(); } catch (e) { /* empty */ } return { ok: r.ok, status: r.status, d }; };
  function src(list, verifiedOn, label) { const p = mk('p', 'small muted', (label ? label + '. ' : '') + (verifiedOn ? 'Statute text read ' + verifiedOn + '. ' : '') + 'Sources: '); (list || []).forEach((s, i) => { if (i) p.appendChild(document.createTextNode(' · ')); const a = mk('a', '', s.name || s.label || 'Official text'); a.href = s.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; p.appendChild(a); }); return p; }
  function facts(q) { const dl = mk('dl', 'drfacts'); q.facts.forEach(f => { const d = mk('div'); d.append(mk('dt', '', f.label), mk('dd', '', f.value)); dl.appendChild(d); }); return dl; }
  function working(r) { const box = mk('div', 'drwork'); box.appendChild(mk('b', '', 'The working')); const ol = mk('ol'); (r.steps || []).forEach(s => ol.appendChild(mk('li', '', s))); box.appendChild(ol); return box; }
  function progress() {
    const box = mk('div', 'drprog'); box.appendChild(mk('h2', '', 'Your progress')); const t = mk('table', 'drtable'); const hr = t.createTHead().insertRow(); ['State', 'Level 1', 'Level 2', 'Level 3'].forEach(x => hr.appendChild(mk('th', '', x))); const tb = t.createTBody();
    Object.keys(info.states).forEach(s => { const tr = tb.insertRow(); tr.insertCell().textContent = info.states[s]; [1, 2, 3].forEach(l => { const p = (info.progress || {})[s + '-' + l]; tr.insertCell().textContent = p && p.tries ? p.right + ' of ' + p.tries + (p.best ? ' (best streak ' + p.best + ')' : '') : '–'; }); });
    box.appendChild(t); return box;
  }
  function picker() {
    const w = mk('div'); const sb = mk('div', 'gchips'); sb.setAttribute('role', 'group'); sb.setAttribute('aria-label', 'State');
    Object.keys(info.states).forEach(k => { const b = mk('button', 'chip' + (k === state ? ' on' : ''), info.states[k]); b.type = 'button'; b.setAttribute('aria-pressed', String(k === state)); b.addEventListener('click', () => { state = k; cur = null; draw(); }); sb.appendChild(b); });
    const lb = mk('div', 'gchips'); lb.setAttribute('role', 'group'); lb.setAttribute('aria-label', 'Level');
    Object.keys(info.levels).forEach(k => { const b = mk('button', 'chip' + (Number(k) === level ? ' on' : ''), info.levels[k]); b.type = 'button'; b.setAttribute('aria-pressed', String(Number(k) === level)); b.addEventListener('click', () => { level = Number(k); cur = null; draw(); }); lb.appendChild(b); });
    w.append(sb, lb); return w;
  }
  function card(q) {
    const c = mk('article', 'drcard'); c.append(mk('p', 'small muted', q.stateName + ' · ' + q.levelName + ' · ' + q.practice), facts(q), mk('p', 'drq', q.prompt));
    const lab = mk('label', 'gsearch', 'Your answer'); const inp = mk('input'); inp.type = 'text'; inp.inputMode = q.kind === 'date' ? 'numeric' : 'decimal'; inp.autocomplete = 'off'; inp.placeholder = q.kind === 'date' ? 'YYYY-MM-DD' : 'for example 137.50'; lab.appendChild(inp);
    const go = mk('button', 'btn', 'Check my answer'), nx = mk('button', 'btn ghost', 'New question'); go.type = nx.type = 'button'; const out = mk('div'); out.setAttribute('role', 'status'); out.setAttribute('aria-live', 'polite');
    go.addEventListener('click', async () => { go.disabled = true; const r = await api('POST', { token: q.token, answer: inp.value }); go.disabled = false; out.textContent = ''; if (!r.ok) { out.appendChild(mk('p', 'bad', r.d.error || 'Could not check that.')); return; }
      const d = r.d; out.appendChild(mk('p', d.correct ? 'good' : 'bad', d.correct ? 'Correct.' : 'Not quite. The answer is ' + (d.kind === 'date' ? d.answer : '$' + Number(d.answer).toFixed(2)) + '.')); out.appendChild(working(d)); out.appendChild(src(d.sources, d.verifiedOn, d.rulesLabel)); out.appendChild(mk('p', 'small muted', d.note)); info.progress = d.progress; go.hidden = true; inp.readOnly = true; const pg = document.getElementById('drprog'); if (pg) pg.replaceWith(Object.assign(progress(), { id: 'drprog' })); });
    nx.addEventListener('click', () => next()); inp.addEventListener('keydown', e => { if (e.key === 'Enter') go.click(); });
    c.append(lab, mk('p', 'drbtns'), out); c.querySelector('.drbtns').append(go, nx); return c;
  }
  async function next() { const slot = document.getElementById('drslot'); slot.textContent = 'One moment…'; const r = await api('GET', null, '?state=' + state + '&level=' + level); slot.textContent = ''; if (!r.ok) { slot.appendChild(mk('p', 'bad', r.d.error || 'Could not get a question.')); return; } cur = r.d.question; slot.appendChild(card(cur)); }
  async function preview() {
    const r = await api('GET', null, '?preview=1'); const box = mk('div'); if (!r.ok) return box; const p = r.d.preview;
    box.append(mk('h2', '', 'A worked example'), mk('p', 'small muted', p.practice), facts(p), mk('p', 'drq', p.prompt), mk('p', 'good', 'Answer: ' + (p.kind === 'date' ? p.answer : '$' + Number(p.answer).toFixed(2))), working(p), src(p.sources, p.verifiedOn, p.rulesLabel)); return box;
  }
  async function draw() {
    app.textContent = ''; const r = await api('GET', null, '?info=1'); if (!r.ok) { app.textContent = 'Could not load the drills. Please try again.'; return; } info = r.d;
    if (!info.states[state]) state = 'FL'; if (!info.levels[level]) level = 1;
    if (!info.paid) {
      app.appendChild(mk('p', 'notice', info.signedIn ? 'Calculation drills are for Pro members. Here is a worked example so you can see how they work.' : 'Sign in as a Pro member to practice. Here is a worked example so you can see how the drills work.'));
      const a = mk('a', 'btn', info.signedIn ? 'See Pro' : 'Sign in'); a.href = info.signedIn ? '/plans/' : '/login/?next=' + encodeURIComponent(location.pathname); app.appendChild(a); app.appendChild(await preview()); return;
    }
    app.appendChild(picker()); const slot = mk('div'); slot.id = 'drslot'; app.appendChild(slot); const pg = progress(); pg.id = 'drprog'; app.appendChild(pg); next();
  }
  draw();
})();
