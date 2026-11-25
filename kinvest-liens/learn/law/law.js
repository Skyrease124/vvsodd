// Law Studies hub: state and county selectors, coverage, examination levels, progress and certificates.
(function () {
  const API = '/.netlify/functions/academy', $ = id => document.getElementById(id);
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const pill = s => el('span', 'pill ' + String(s).split(' ')[0], s);
  let cat = null;
  fetch(API, { credentials: 'same-origin' }).then(r => r.json()).then(d => {
    cat = d; const sel = $('st');
    d.states.forEach(s => { const o = el('option', '', s.name + (s.status === 'Published' ? '  ·  course ready' : '')); o.value = s.state; sel.append(o); });
    const pub = d.states.filter(s => s.status === 'Published').length;
    $('me').textContent = pub + ' of ' + d.states.length + ' state courses published · ' + (d.signedIn ? (d.paid ? 'Examinations unlocked' : 'Examinations are for members') : 'Sign in to save examination results');
    d.states.filter(s => s.status === 'Published').forEach(s => { const t = el('button', 'tile'); t.type = 'button'; t.style.cssText = 'text-align:left;border:0;color:inherit;cursor:pointer;font:inherit'; t.append(el('b', '', s.name), pill(s.status)); t.onclick = () => { sel.value = s.state; showState(s.state); }; $('stgrid').append(t); });
    sel.onchange = () => sel.value && showState(sel.value);
    county(d); progress(d);
    const q = new URLSearchParams(location.search).get('state'); if (q) { sel.value = q.toUpperCase(); showState(sel.value); }
  }).catch(() => { $('stview').textContent = 'The Academy could not load. Check your connection and try again.'; });

  function showState(st) {
    const v = $('stview'); v.textContent = 'Loading…';
    fetch(API + '?state=' + st, { credentials: 'same-origin' }).then(r => r.json()).then(d => {
      v.textContent = ''; const s = d.state;
      const head = el('div', 'row'); head.append(el('h2', '', s.name), pill(s.status)); v.append(head);
      if (s.course) { const p = el('p', 'small'); const a = el('a', '', 'Open the ' + s.name + ' course'); a.href = '/learn/course/?c=' + s.course.id; p.append(a, document.createTextNode('  ·  sources last checked ' + (s.course.checked || 'date on each lesson'))); v.append(p); }
      else v.append(el('p', 'note', 'This state course is ' + s.status.toLowerCase() + '. It opens only after its lessons are written from official sources and reviewed. Nothing here is a placeholder course.'));
      v.append(el('h3', '', 'Curriculum topics'));
      const done = Object.values(s.topics).filter(x => x === 'Published' || x === 'Approved').length, bar = el('div', 'bar'), fill = el('i'); fill.style.width = Math.round(done / cat.stateTopics.length * 100) + '%'; bar.append(fill);
      v.append(el('p', 'small muted', done + ' of ' + cat.stateTopics.length + ' topic areas verified for this department'), bar);
      const list = el('div'); cat.stateTopics.forEach(t => { const r = el('div', 'row'), l = el('div'); l.append(el('div', '', t.name), el('div', 'layer', cat.layers[t.layer])); r.append(l, pill(s.topics[t.id])); list.append(r); }); v.append(list);
      v.append(el('h3', '', 'Final examinations'));
      const g = el('div', 'grid');
      d.levels.forEach(l => {
        const t = el('div', 'tile'); t.append(el('b', '', l.name), el('div', 'small muted', l.questions + ' questions · ' + l.minutes + ' minutes · pass ' + l.pass + '%'));
        const can = s.status === 'Published' && l.ready;
        const b = el('a', 'btn' + (can ? '' : ' ghost'), can ? 'Start examination' : (s.status === 'Published' ? 'Pending: ' + l.bank + ' of ' + l.questions + ' verified questions' : 'Course not published'));
        if (can) b.href = '/learn/law/exam/?state=' + st + '&level=' + l.id; else b.setAttribute('aria-disabled', 'true');
        b.style.marginTop = '10px'; t.append(b);
        const best = (d.history || []).filter(h => h.level === l.id).sort((a, b2) => b2.score - a.score)[0]; if (best) t.append(el('div', 'small ' + (best.passed ? 'ok' : 'muted'), 'Best: ' + best.score + '%' + (best.passed ? ' · passed' : '')));
        g.append(t);
      });
      v.append(g);
      if (!d.signedIn || !d.paid) v.append(el('p', 'small muted', 'Examinations and certificates are part of the Pro membership. The free lessons in each course stay free.'));
      v.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    });
  }
  function county(d) {
    const c = $('county'), sel = el('select'); sel.setAttribute('aria-label', 'Choose a state for county courses'); sel.append(el('option', '', 'Choose a state'));
    d.states.forEach(s => { const o = el('option', '', s.name); o.value = s.state; sel.append(o); });
    const out = el('div'); c.append(el('p', 'muted', 'County courses are built one county at a time from that county\'s own official pages. Counties differ: each course says which rules are state law, which are county ordinances and which are the auction office\'s own policies.'), el('div', 'pick'), out);
    c.querySelector('.pick').append(sel);
    const legend = el('div', 'pick'); Object.values(d.layers).forEach(v => legend.append(el('span', 'pill', v))); c.insertBefore(legend, out);
    sel.onchange = () => {
      out.textContent = ''; if (!sel.value || sel.value === 'Choose a state') return;
      fetch(API + '?state=' + sel.value, { credentials: 'same-origin' }).then(r => r.json()).then(x => {
        out.append(el('h3', '', 'County courses in ' + x.state.name));
        if (!x.counties.length) out.append(el('p', 'note', 'No county course has started research yet in ' + x.state.name + '. Each course will cover the topics below once its sources are verified.'));
        x.counties.forEach(k => { const r = el('div', 'row'); r.append(el('div', '', k.county), pill(k.status)); out.append(r); });
        out.append(el('h3', '', 'What every county course covers'));
        x.countyTopics.forEach(t => { const r = el('div', 'row'), l = el('div'); l.append(el('div', '', t.name), el('div', 'layer', d.layers[t.layer])); r.append(l); out.append(r); });
      });
    };
  }
  function progress(d) {
    const p = $('prog');
    if (!d.signedIn) { p.append(el('p', 'muted', 'Sign in to see your examination history and certificates.')); return; }
    p.append(el('h3', '', 'Certificates'));
    if (!d.certificates.length) p.append(el('p', 'muted small', 'No certificates yet. Pass a final examination to earn one.'));
    d.certificates.forEach(c => { const r = el('div', 'row'), l = el('div'); l.append(el('div', '', c.title), el('div', 'small muted', 'ID ' + c.id + ' · ' + c.score + '% · ' + c.issued)); const a = el('a', '', 'Verify'); a.href = '/learn/law/verify/?id=' + c.id; r.append(l, a); p.append(r); });
    p.append(el('h3', '', 'Examination history'));
    if (!d.history.length) p.append(el('p', 'muted small', 'No examinations taken yet.'));
    d.history.slice().reverse().forEach(h => { const r = el('div', 'row'); r.append(el('div', '', h.state + ' · ' + (h.levelName || h.level) + ' · ' + h.submitted.slice(0, 10)), el('b', h.passed ? 'ok' : 'bad', h.score + '%')); p.append(r); });
    p.append(el('p', 'small muted', d.note));
  }
})();
