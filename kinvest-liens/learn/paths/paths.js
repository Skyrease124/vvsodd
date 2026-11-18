(function () {
  const app = document.getElementById('app'), Q = new URLSearchParams(location.search);
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const NAMES = { FL: 'Florida', TX: 'Texas', AZ: 'Arizona', IA: 'Iowa', MI: 'Michigan', CO: 'Colorado' };
  let cid = (Q.get('c') || 'fl').toLowerCase(), sel = Q.get('p') || 'beginner', data = null;
  const lessonLink = l => '/learn/course/?c=' + cid + '&l=' + encodeURIComponent(l.id);
  const url = () => history.replaceState(null, '', '?c=' + cid + '&p=' + sel);
  function summary(d, p) {
    const box = mk('section', 'psum'); const pct = p.total ? Math.round(100 * p.done / p.total) : 0;
    const ring = mk('div', 'ring'); ring.style.setProperty('--p', '0'); ring.setAttribute('role', 'img'); ring.setAttribute('aria-label', pct + ' percent complete'); ring.appendChild(mk('b', '', pct + '%')); requestAnimationFrame(() => requestAnimationFrame(() => ring.style.setProperty('--p', String(pct))));
    const t = mk('div'); t.append(mk('h3', '', p.title + ' path'), mk('p', 'small muted', p.blurb), mk('p', 'small muted', p.done + ' of ' + p.total + ' lessons · about ' + p.mins + ' min · chapters ' + p.chapters.join(', ')));
    const first = d.chapters.filter(x => p.chapters.includes(x.n)).flatMap(x => x.lessons).find(l => !l.done && (l.free || d.paid)) || d.chapters.find(x => x.n === p.chapters[0]).lessons[0];
    const bt = mk('p', 'drbtns'), a = mk('a', 'btn', p.done >= p.total ? 'Review' : p.done ? 'Continue' : 'Start'); a.href = lessonLink(first); const dr = mk('a', 'btn ghost', 'Drills: level ' + p.drillLevel); dr.href = '/learn/drills/?level=' + p.drillLevel; bt.append(a, dr); t.appendChild(bt);
    box.append(ring, t); return box;
  }
  function chapter(d, ch, p) {
    const inPath = p.chapters.includes(ch.n), done = ch.total && ch.doneCount >= ch.total;
    const det = mk('details', 'ch' + (inPath ? '' : ' off') + (done ? ' done' : '')); det.dataset.n = ch.n;
    const sm = mk('summary'); const n = mk('span', 'chn', done ? '✓' : String(ch.n)); const tx = mk('span'); tx.append(mk('span', 'cht', ch.title), mk('span', 'chm', ch.doneCount + ' of ' + ch.total + ' lessons · ' + ch.mins + ' min' + (inPath ? '' : ' · not in this path') + (ch.drills ? ' · drills' : ''))); sm.append(n, tx); det.appendChild(sm);
    const body = mk('div', 'chbody'); body.appendChild(mk('p', 'chcov', 'Covered in: ' + ch.modules.map(m => m.title).join('; ') + (ch.foundations ? '. For the general idea of liens versus deeds, also see the Foundations lessons.' : '')));
    ch.lessons.forEach(l => { const locked = !l.free && !d.paid; const r = mk(locked ? 'div' : 'a', 'les' + (locked ? ' lock' : '')); if (!locked) r.href = lessonLink(l); const ic = mk('span', 'ic', l.done ? '✓' : locked ? '🔒' : '○'); const tx2 = mk('span'); tx2.append(document.createTextNode(l.title), mk('span', 'lm', l.mins + ' min' + (locked ? ' · members' : ''))); r.append(ic, tx2); body.appendChild(r); });
    if (ch.foundations) { const f = mk('a', 'chlink', 'Foundations: how liens and deeds work →'); f.href = '/learn/'; body.appendChild(f); }
    if (ch.drills) { const f = mk('a', 'chlink', 'Practice with calculation drills →'); f.href = '/learn/drills/'; body.appendChild(f); }
    det.appendChild(body); return det;
  }
  function render(d) {
    data = d; app.textContent = '';
    const lab = mk('label', 'gsearch', 'State course'); const s = mk('select'); d.courses.forEach(c => { const o = mk('option', '', NAMES[c.state] || c.state); o.value = c.id; if (c.id === d.course.id) o.selected = true; s.appendChild(o); }); lab.appendChild(s); s.addEventListener('change', () => { cid = s.value; url(); load(); }); app.appendChild(lab);
    app.appendChild(mk('p', 'small muted', d.course.title + ' · last checked ' + d.course.checked + (d.signedIn ? '' : ' · sign in to save your progress')));
    const seg = mk('div', 'seg'); seg.setAttribute('role', 'tablist'); seg.setAttribute('aria-label', 'Learning path');
    const slot = mk('div'), list = mk('ol', 'chlist');
    const draw = () => { const p = d.paths.find(x => x.id === sel) || d.paths[0]; sel = p.id; slot.textContent = ''; slot.appendChild(summary(d, p)); const open = new Set([...list.querySelectorAll('details[open]')].map(x => x.dataset.n)); list.textContent = ''; d.chapters.forEach(ch => { const li = mk('li'), det = chapter(d, ch, p); if (open.has(String(ch.n))) det.open = true; li.appendChild(det); list.appendChild(li); }); seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.id === sel))); };
    d.paths.forEach(p => { const b = mk('button', '', p.title); b.type = 'button'; b.dataset.id = p.id; b.setAttribute('role', 'tab'); b.addEventListener('click', () => { sel = p.id; url(); draw(); }); seg.appendChild(b); });
    app.append(seg, slot, mk('h2', '', 'The ten chapters'), list); draw();
    if (!d.paid) app.appendChild(mk('p', 'notice small', 'Module 1 of every course is free. Lessons marked with a lock are for members. You can see the full map and your path before you join.'));
  }
  function load() { app.textContent = ''; const sk = mk('div', 'skel'); sk.innerHTML = '<i></i><i></i><i></i>'; app.appendChild(sk); fetch('/.netlify/functions/learnhub?paths=1&c=' + encodeURIComponent(cid), { credentials: 'same-origin' }).then(r => r.ok ? r.json() : Promise.reject()).then(render).catch(() => { app.textContent = 'Could not load the learning paths. Please try again.'; }); }
  load();
})();
