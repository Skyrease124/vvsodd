(function () {
  const app = document.getElementById('app'), Q = new URLSearchParams(location.search);
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  let cid = (Q.get('c') || 'fl').toLowerCase();
  function lessonLink(l) { return '/learn/course/?c=' + cid + '&l=' + encodeURIComponent(l.id); }
  function bar(done, total) { const b = mk('div', 'pbar'); b.setAttribute('role', 'progressbar'); b.setAttribute('aria-valuemin', '0'); b.setAttribute('aria-valuemax', String(total)); b.setAttribute('aria-valuenow', String(done)); const i = mk('span'); i.style.width = (total ? Math.round(100 * done / total) : 0) + '%'; b.appendChild(i); return b; }
  function render(d) {
    app.textContent = '';
    const sel = mk('label', 'gsearch', 'State course'); const s = mk('select'); d.courses.forEach(c => { const o = mk('option', '', c.state); o.value = c.id; if (c.id === d.course.id) o.selected = true; s.appendChild(o); }); sel.appendChild(s); s.addEventListener('change', () => { cid = s.value; history.replaceState(null, '', '?c=' + cid); load(); }); app.appendChild(sel);
    app.appendChild(mk('p', 'small muted', d.course.title + ' · last checked ' + d.course.checked + (d.signedIn ? '' : ' · sign in to save your progress')));
    const pg = mk('div', 'pathgrid');
    d.paths.forEach(p => {
      const c = mk('article', 'pathcard'), h = mk('h3', '', p.title); c.append(h, mk('p', 'small', p.blurb), bar(p.done, p.total), mk('p', 'small muted', p.done + ' of ' + p.total + ' lessons · about ' + p.mins + ' min · chapters ' + p.chapters.join(', ')));
      const first = d.chapters.filter(x => p.chapters.includes(x.n)).flatMap(x => x.lessons).find(l => !l.done && (l.free || d.paid)) || d.chapters.find(x => x.n === p.chapters[0]).lessons[0];
      const a = mk('a', 'btn small', p.done ? (p.done >= p.total ? 'Review' : 'Continue') : 'Start'); a.href = lessonLink(first); c.appendChild(a);
      const dr = mk('a', 'btn small ghost', 'Drills: level ' + p.drillLevel); dr.href = '/learn/drills/?level=' + p.drillLevel; c.appendChild(dr); pg.appendChild(c);
    });
    app.appendChild(pg); app.appendChild(mk('h2', '', 'The ten chapters'));
    const ol = mk('ol', 'chlist');
    d.chapters.forEach(ch => {
      const li = mk('li'), det = mk('details'); const sm = mk('summary'); sm.appendChild(mk('b', '', ch.n + '. ' + ch.title)); sm.appendChild(mk('span', 'small muted', '  ' + ch.doneCount + '/' + ch.total + ' lessons' + (ch.drills ? ' + drills' : ''))); det.appendChild(sm);
      det.appendChild(mk('p', 'small muted', 'Covered in: ' + ch.modules.map(m => m.title).join('; ') + (ch.foundations ? '. For the general idea of liens versus deeds, also see the Foundations lessons.' : '')));
      const ul = mk('ul', 'chles'); ch.lessons.forEach(l => { const it = mk('li'); const locked = !l.free && !d.paid; const a = mk(locked ? 'span' : 'a', '', (l.done ? '✓ ' : locked ? '🔒 ' : '') + l.title + ' (' + l.mins + ' min)'); if (!locked) a.href = lessonLink(l); else a.className = 'muted'; it.appendChild(a); ul.appendChild(it); }); det.appendChild(ul);
      if (ch.foundations) { const f = mk('a', 'small', 'Foundations: how liens and deeds work →'); f.href = '/learn/'; det.appendChild(f); }
      if (ch.drills) { const f = mk('a', 'small', 'Practice with calculation drills →'); f.href = '/learn/drills/'; det.appendChild(f); }
      li.appendChild(det); ol.appendChild(li);
    });
    app.appendChild(ol);
    if (!d.paid) app.appendChild(mk('p', 'notice small', 'Module 1 of every course is free. The lessons marked with a lock are for members. You can see the full map and your path before you join.'));
  }
  function load() { fetch('/.netlify/functions/learnhub?paths=1&c=' + encodeURIComponent(cid), { credentials: 'same-origin' }).then(r => r.ok ? r.json() : Promise.reject()).then(render).catch(() => { app.textContent = 'Could not load the learning paths. Please try again.'; }); }
  load();
})();
