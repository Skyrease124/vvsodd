// Liens & Deeds Master Class: outline, lessons, quizzes and progress.
(function () {
  const API = '/.netlify/functions/learn';
  const $ = id => document.getElementById(id);
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  let state = {lessons: [], signedIn: false, paid: false, progress: {}};
  const PASS = 2; // 2 of 3 right counts as done
  const local = () => { try { return JSON.parse(localStorage.getItem('ppa_learn') || '{}'); } catch (e) { return {}; } };
  const saveLocal = p => { try { localStorage.setItem('ppa_learn', JSON.stringify(p)); } catch (e) {} };
  const prog = () => state.signedIn ? state.progress : local();
  const isDone = id => { const p = prog()[id]; return !!(p && p.score >= PASS); };

  function home() {
    $('home').hidden = false; $('lesson').hidden = true;
    const done = state.lessons.filter(l => isDone(l.id)).length, n = state.lessons.length;
    const pb = $('prog'); pb.textContent = '';
    pb.appendChild(mk('b', '', done === n ? '🎓 Master Class complete!' : 'Your progress: ' + done + ' of ' + n + ' lessons'));
    const bar = mk('div', 'progbar'); const i = mk('i'); i.style.width = Math.round(100 * done / (n || 1)) + '%'; bar.appendChild(i); pb.appendChild(bar);
    if (done === n) pb.appendChild(mk('p', '', 'You finished all 10 lessons. Nice work. Now put it to use: pick one county, screen its list, and check Land Information before you bid.'));
    if (!state.signedIn) { const p = mk('p', 'small muted'); const a = mk('a', '', 'Sign in'); a.href = '/login/?next=/learn/'; p.append(a, ' to save your progress to your account.'); pb.appendChild(p); }
    const ol = $('outline'); ol.textContent = '';
    state.lessons.forEach((l, k) => {
      const li = mk('li', isDone(l.id) ? 'done' : ''); const b = mk('button'); b.type = 'button';
      const t = mk('span', 'lt'); t.append(mk('b', '', l.title), mk('span', 'small muted', l.mins + ' min' + (isDone(l.id) ? ' · done ✔' : '')));
      b.append(mk('span', 'num', isDone(l.id) ? '✓' : String(k + 1)), t, mk('span', 'tag' + (l.free ? ' free' : ''), l.free ? 'Free' : (state.paid ? 'Pro' : '🔒 Pro')));
      b.addEventListener('click', () => go(l.id)); li.appendChild(b); ol.appendChild(li);
    });
  }
  function go(id) { history.pushState(null, '', id ? '?l=' + id : location.pathname); route(); window.scrollTo(0, 0); }
  async function route() {
    const id = new URLSearchParams(location.search).get('l');
    if (!id) return home();
    $('home').hidden = true; const box = $('lesson'); box.hidden = false; box.textContent = 'Loading…';
    let r, d; try { r = await fetch(API + '?id=' + encodeURIComponent(id)); d = await r.json(); } catch (e) { box.textContent = 'Could not load the lesson. Try again.'; return; }
    box.textContent = '';
    const back = mk('button', 'btn small ghost', '← All lessons'); back.type = 'button'; back.addEventListener('click', () => go('')); box.appendChild(back);
    if (d.locked) {
      box.appendChild(mk('h1', '', d.title));
      const n = mk('div', 'salebox'); n.append(mk('h3', '', '🔒 For members'), mk('p', '', 'Lessons 4 to 10 are part of membership ($5.50 a week), along with the AI, the screener and Land for sale.'));
      const a = mk('a', 'btn', d.signedIn ? 'Become a member' : 'Sign in or create an account'); a.href = d.signedIn ? '/account/' : '/login/?next=' + encodeURIComponent('/learn/?l=' + id); n.appendChild(a); box.appendChild(n); return;
    }
    if (!d.lesson) { box.appendChild(mk('p', '', d.error || 'Lesson not found.')); return; }
    const l = d.lesson, k = state.lessons.findIndex(x => x.id === l.id);
    box.appendChild(mk('p', 'small muted', 'Lesson ' + (k + 1) + ' of ' + state.lessons.length + ' · ' + l.mins + ' min read'));
    box.appendChild(mk('h1', '', l.title)); box.appendChild(mk('p', 'lead', l.intro));
    l.sections.forEach(s => { box.appendChild(mk('h2', '', s.h)); s.p.forEach(t => box.appendChild(mk('p', '', t))); });
    const tk = mk('div', 'takeaways'); tk.appendChild(mk('h3', '', 'Key takeaways')); const ul = mk('ul'); l.takeaways.forEach(t => ul.appendChild(mk('li', '', t))); tk.appendChild(ul); box.appendChild(tk);
    if (l.tryIt) { const p = mk('p'); p.append(mk('b', '', 'Try it on the site: '), l.tryIt.text + ' '); const a = mk('a', '', 'Open it →'); a.href = l.tryIt.href; p.appendChild(a); box.appendChild(p); }
    // quiz
    box.appendChild(mk('h2', '', 'Quick quiz'));
    const f = mk('form', 'quiz');
    l.quiz.forEach((q, i) => {
      const fs = mk('fieldset'); fs.appendChild(mk('legend', '', (i + 1) + '. ' + q.q));
      q.a.forEach((ans, j) => { const lab = mk('label'); const r = mk('input'); r.type = 'radio'; r.name = 'q' + i; r.value = j; lab.append(r, mk('span', '', ans)); fs.appendChild(lab); });
      f.appendChild(fs);
    });
    const sub = mk('button', 'btn', 'Check my answers'); sub.type = 'submit'; const res = mk('p', '', ''); res.setAttribute('role', 'status'); f.append(sub, res); box.appendChild(f);
    f.addEventListener('submit', async e => {
      e.preventDefault(); let score = 0;
      l.quiz.forEach((q, i) => {
        const sel = f.querySelector('input[name=q' + i + ']:checked'); const fs = f.querySelectorAll('fieldset')[i];
        const old = fs.querySelector('.why'); if (old) old.remove();
        const ok = sel && Number(sel.value) === q.c; if (ok) score++;
        fs.appendChild(mk('p', 'why ' + (ok ? 'ok' : 'bad'), (ok ? '✔ Right. ' : '✖ ' + (sel ? 'Not quite. ' : 'No answer. ') + 'The answer is: ' + q.a[q.c] + '. ') + q.why));
      });
      res.textContent = 'You got ' + score + ' of ' + l.quiz.length + '. ' + (score >= PASS ? 'Lesson complete!' : 'Read it again and retry. You need ' + PASS + ' right.');
      if (state.signedIn) { try { const r = await fetch(API, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id: l.id, score})}); const x = await r.json(); if (x.progress) state.progress = x.progress; } catch (er) {} }
      else { const p = local(); const o = p[l.id]; p[l.id] = {score: Math.max(score, o ? o.score : 0), of: l.quiz.length}; saveLocal(p); }
      nav.hidden = false;
    });
    const nav = mk('p', 'sact'); nav.hidden = true;
    const nx = state.lessons[k + 1];
    if (nx) { const b = mk('button', 'btn', 'Next lesson: ' + nx.title + ' →'); b.type = 'button'; b.addEventListener('click', () => go(nx.id)); nav.appendChild(b); }
    const al = mk('button', 'btn ghost', 'All lessons'); al.type = 'button'; al.addEventListener('click', () => go('')); nav.appendChild(al);
    box.appendChild(nav);
    box.appendChild(mk('p', 'small muted', 'Educational only. Not legal, tax or investment advice. Laws change and differ by state and county; confirm with the county and a professional.'));
  }
  window.addEventListener('popstate', route);
  fetch(API).then(r => r.json()).then(d => { state = d; route(); }).catch(() => { $('outline').textContent = 'Could not load the course. Try again.'; });
})();
