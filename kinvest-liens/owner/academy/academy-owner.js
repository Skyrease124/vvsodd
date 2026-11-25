(function () {
  const API = '/.netlify/functions/owner-academy', $ = id => document.getElementById(id);
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const post = b => fetch(API, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json());
  const say = t => { $('msg').textContent = t; };
  let D = null;
  const load = () => fetch(API, { credentials: 'same-origin' }).then(r => r.json()).then(d => { if (!d.ok) { say(d.error || 'Owner access required.'); return; } D = d; draw(); });
  const statusSel = (v, on, noPub) => { const s = el('select'); D.statuses.forEach(x => { if (noPub && x === 'Published') return; const o = el('option', '', x); o.value = x; if (x === v) o.selected = true; s.append(o); }); s.onchange = () => on(s.value); return s; };
  function draw() {
    // levels
    const L = $('levels'); L.textContent = ''; const t = el('div');
    D.settings.levels.forEach(l => { const r = el('div', 'row'); r.append(el('b', '', l.name)); const box = el('div', 'pick');
      ['questions', 'minutes', 'pass'].forEach(k => { const i = el('input'); i.type = 'number'; i.value = l[k]; i.dataset.level = l.id; i.dataset.k = k; i.style.width = '92px'; i.setAttribute('aria-label', l.name + ' ' + k); const lab = el('label', 'small muted', k === 'pass' ? 'Pass %' : k[0].toUpperCase() + k.slice(1) + ' '); lab.append(i); box.append(lab); });
      r.append(box); t.append(r); });
    const rr = el('div', 'pick'); [['waitHours', 'Hours between attempts'], ['maxPerWeek', 'Attempts per week']].forEach(([k, n]) => { const i = el('input'); i.type = 'number'; i.value = D.settings.retake[k]; i.dataset.r = k; i.style.width = '92px'; const lab = el('label', 'small muted', n + ' '); lab.append(i); rr.append(lab); });
    const save = el('button', 'btn', 'Save examination settings'); save.onclick = () => { const levels = {}; L.querySelectorAll('input[data-level]').forEach(i => { (levels[i.dataset.level] = levels[i.dataset.level] || {})[i.dataset.k] = Number(i.value); }); const retake = {}; L.querySelectorAll('input[data-r]').forEach(i => { retake[i.dataset.r] = Number(i.value); }); post({ action: 'settings', levels, retake }).then(d => { say(d.ok ? 'Saved.' : d.error); load(); }); };
    L.append(t, el('h3', '', 'Retake policy'), rr, save);
    // states
    const S = $('states'); S.textContent = '';
    const counts = {}; D.states.forEach(s => counts[s.status] = (counts[s.status] || 0) + 1);
    S.append(el('p', 'small muted', D.statuses.map(x => x + ': ' + (counts[x] || 0)).join(' · ') + '. Published needs a reviewed course in the curriculum; until then it shows as Approved.'));
    D.states.forEach(s => {
      const d = el('details'); const sm = el('summary', 'row'); sm.style.cursor = 'pointer'; sm.append(el('span', '', s.name + (s.course ? '  ·  course: ' + s.course.title : '') + '  ·  ' + s.bank + ' verified questions'));
      sm.append(statusSel(s.status, v => post({ action: 'state-status', state: s.state, status: v }).then(x => say(x.ok ? s.name + ': ' + v : x.error))));
      d.append(sm);
      if (s.work && s.work.research) { const w = el('div', 'tile'); [['Batch', s.work.batch], ['System', s.work.system], ['Research', s.work.research], ['Writing', s.work.writing], ['Review', s.work.review], ['Publication', s.work.publication], ['What remains', s.work.remaining]].forEach(([k, v]) => { if (v) { const r = el('div', 'small'); r.append(el('span', 'layer', k + ' '), document.createTextNode(v)); w.append(r); } }); d.append(w); }
      D.stateTopics.forEach(tp => { const r = el('div', 'row'); r.append(el('span', 'small', tp.name), statusSel(s.topics[tp.id], v => post({ action: 'state-status', state: s.state, topic: tp.id, status: v }).then(x => say(x.ok ? s.name + ' · ' + tp.name + ': ' + v : x.error)))); d.append(r); });
      S.append(d);
    });
    // counties
    const C = $('counties'); C.textContent = '';
    const f = el('div', 'pick'), st = el('select'), co = el('input'); D.states.forEach(s => { const o = el('option', '', s.name); o.value = s.state; st.append(o); }); co.placeholder = 'County name';
    const add = el('button', 'btn', 'Start county course'); add.onclick = () => co.value.trim() && post({ action: 'county-status', state: st.value, county: co.value.trim(), status: 'Researching' }).then(d => { say(d.ok ? 'Added.' : d.error); load(); });
    f.append(st, co, add); C.append(f);
    if (!D.counties.length) C.append(el('p', 'small muted', 'No county courses started yet.'));
    D.counties.forEach(k => { const r = el('div', 'row'); r.append(el('span', '', k.county + ', ' + k.state), statusSel(k.status, v => post({ action: 'county-status', state: k.state, county: k.county, status: v }).then(x => say(x.ok ? 'Saved.' : x.error)), true)); C.append(r); });
    // attempts
    const A = $('attempts'); A.textContent = ''; if (!D.attempts.length) A.append(el('p', 'small muted', 'No examinations taken yet.'));
    D.attempts.forEach(a => { const r = el('div', 'row'); r.append(el('span', 'small', a.submitted.slice(0, 16).replace('T', ' ') + ' · ' + a.email + ' · ' + a.state + ' ' + (a.levelName || a.level)), el('b', a.passed ? 'ok' : 'bad', a.score + '%')); A.append(r); });
    // certificates
    const K = $('certs'); K.textContent = ''; if (!D.certificates.length) K.append(el('p', 'small muted', 'No certificates issued yet.'));
    D.certificates.forEach(c => { const r = el('div', 'row'), b = el('button', 'btn ghost', 'Revoke'); b.onclick = () => post({ action: 'certificate-revoke', id: c.id, revoked: true }).then(x => say(x.ok ? c.id + ' revoked.' : x.error)); r.append(el('span', 'small', c.id + ' · ' + c.title + ' · ' + c.email + ' · ' + c.issued), b); K.append(r); });
    // proposals
    const P = $('props'); P.textContent = ''; if (!D.proposals.length) P.append(el('p', 'small muted', 'No proposed updates. The research workflow will add them here for your approval; nothing is published automatically.'));
    D.proposals.forEach(p => { const r = el('div', 'tile'); r.append(el('b', '', p.title || p.id), el('p', 'small', p.summary || ''), el('p', 'small muted', (p.sources || []).join(' · '))); if (!p.decision) { ['approved', 'rejected'].forEach(x => { const b = el('button', x === 'approved' ? 'btn' : 'btn ghost', x === 'approved' ? 'Approve' : 'Reject'); b.onclick = () => post({ action: 'proposal', id: p.id, decision: x }).then(() => load()); r.append(b); }); } else r.append(el('span', 'pill', p.decision)); P.append(r); });
  }
  load();
})();
