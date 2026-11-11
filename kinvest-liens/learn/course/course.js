// Full state course: contents, lessons with inline citations, module quizzes, glossary, links, checklists,
// saved progress and the Bid or Pass exercise. Content comes from /.netlify/functions/course.
(function () {
  const API = '/.netlify/functions/course';
  const app = document.getElementById('crapp');
  const Q = new URLSearchParams(location.search), CID = (Q.get('c') || 'fl').toLowerCase();
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[ch]));
  let C = null, S = {signedIn: false, paid: false, progress: null};
  const LK = 'ppa_course_' + CID;
  const local = () => { try { return JSON.parse(localStorage.getItem(LK) || '{"lessons":{},"quizzes":{}}'); } catch (e) { return {lessons: {}, quizzes: {}}; } };
  const prog = () => S.signedIn ? (S.progress || {lessons: {}, quizzes: {}}) : local();
  const saveLocal = p => { try { localStorage.setItem(LK, JSON.stringify(p)); } catch (e) {} };
  const post = async o => { try { const r = await fetch(API, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(Object.assign({c: CID}, o))}); return {ok: r.ok, d: await r.json()}; } catch (e) { return {ok: false, d: {error: 'Could not reach the server.'}}; } };
  const TOOLS = {map: '/#map', calc: '/#calculator', portfolio: '/portfolio/', practice: '/practice/', land: '/land/', learn: '/learn/'};

  // ---------- markup ----------
  function inline(s) {
    let h = esc(s);
    h = h.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    h = h.replace(/\[\[\?(.+?)\]\]/g, (m, t) => '<span class="vfy" title="Not yet verified against an official source">Needs review: ' + t + '</span>');
    h = h.replace(/\[\[([^\]]+?)\]\]/g, (m, k) => { const src = C.sources[k]; if (!src) return ''; return '<a class="cite" href="' + esc(src.url) + '" target="_blank" rel="noopener noreferrer" title="' + esc(src.name + ' · checked ' + src.checked + (src.effective ? ' · ' + src.effective : '')) + '">' + esc(src.short || k) + '</a>'; });
    h = h.replace(/\{\{f:([a-z]+)\|(.+?)\}\}/g, '<a class="flink" href="/learn/?l=$1">Foundations: $2</a>');
    h = h.replace(/\{\{t:([a-z]+)\|(.+?)\}\}/g, (m, k, t) => '<a class="tlink" href="' + esc(TOOLS[k] || '/') + '">' + t + '</a>');
    h = h.replace(/\{\{u:([^|]+)\|(.+?)\}\}/g, (m, u, t) => /^\/[^/]/.test(u) ? '<a class="tlink" href="' + u + '">' + t + '</a>' : t);
    return h;
  }
  function render(body, host) {
    const cited = new Set();
    String(body).trim().split(/\n\s*\n/).forEach(block => {
      let lines = block.split('\n').map(x => x.trim()).filter(Boolean); if (!lines.length) return;
      (block.match(/\[\[([^\]?][^\]]*)\]\]/g) || []).forEach(m => cited.add(m.slice(2, -2)));
      let el;
      if (lines[0].startsWith('## ')) { el = mk('h2'); el.innerHTML = inline(lines[0].slice(3)); host.appendChild(el); lines = lines.slice(1); if (!lines.length) return; }
      // a block can mix plain text, bullets, numbered steps and math rows: render each run of the same kind
      if (lines[0].startsWith('?? ')) { el = mk('div', 'practice'); el.innerHTML = '<b>Practice</b>'; const p = mk('p'); p.innerHTML = inline(lines.join(' ').slice(3)); el.appendChild(p); host.appendChild(el); return; }
      if (lines[0].startsWith('!! ')) { el = mk('div', 'warnbox'); el.innerHTML = inline(lines.join(' ').slice(3)); host.appendChild(el); return; }
      if (lines[0].startsWith('>> ')) { el = mk('div', 'keybox'); el.innerHTML = inline(lines.join(' ').slice(3)); host.appendChild(el); return; }
      const kind = x => x.startsWith('= ') ? 'math' : x.startsWith('- ') ? 'ul' : /^\d+\. /.test(x) ? 'ol' : 'p';
      const runs = []; lines.forEach(x => { const k = kind(x); if (runs.length && runs[runs.length - 1].k === k) runs[runs.length - 1].l.push(x); else runs.push({k, l: [x]}); });
      runs.forEach(r => {
        if (r.k === 'math') { el = mk('div', 'math'); r.l.forEach(x => { const d = mk('div', 'mrow'); d.innerHTML = inline(x.slice(2)); el.appendChild(d); }); }
        else if (r.k === 'ul' || r.k === 'ol') { el = mk(r.k); r.l.forEach(x => { const li = mk('li'); li.innerHTML = inline(x.replace(/^(- |\d+\. )/, '')); el.appendChild(li); }); }
        else { el = mk('p'); el.innerHTML = inline(r.l.join(' ')); }
        host.appendChild(el);
      });
      return;
      host.appendChild(el);
    });
    if (cited.size) {
      const sb = mk('div', 'srcbox'); sb.appendChild(mk('b', '', 'Sources for this lesson'));
      const ul = mk('ul'); [...cited].forEach(k => { const s = C.sources[k]; if (!s) return; const li = mk('li'); const a = mk('a', '', s.name); a.href = s.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; li.append(a, ' · checked ' + s.checked + (s.effective ? ' · ' + s.effective : '')); ul.appendChild(li); });
      sb.appendChild(ul); host.appendChild(sb);
    }
  }

  // ---------- views ----------
  const go = q => { history.pushState(null, '', '?c=' + CID + (q ? '&' + q : '')); route(); window.scrollTo(0, 0); };
  const allLessons = () => C.modules.flatMap(m => m.lessons.map(l => Object.assign({m}, l)));
  function lockBox(title, signedIn, next) {
    const n = mk('div', 'salebox'); n.append(mk('h3', '', '🔒 ' + title), mk('p', '', 'Module 1 is free. The rest of the course, the quizzes and the Bid or Pass exercise are part of membership ($5.50 a week).'));
    const a = mk('a', 'btn', signedIn ? 'Become a member' : 'Sign in or create an account'); a.href = signedIn ? '/account/' : '/login/?next=' + encodeURIComponent(next || location.pathname + location.search); n.appendChild(a); return n;
  }
  function home() {
    app.textContent = '';
    const p = prog(), all = allLessons(), done = all.filter(l => p.lessons[l.id]).length;
    const hero = mk('div', 'crhero');
    hero.append(mk('p', 'hgreet', C.state + ' · full course'), (() => { const h = mk('h1', 'pfh'); h.textContent = C.title; return h; })());
    hero.appendChild(mk('p', 'lead', C.intro));
    const meta = mk('div', 'crmeta');
    [C.modules.length + ' modules', all.length + ' lessons', 'about ' + Math.round(C.totalMinutes / 60 * 10) / 10 + ' hours of reading', 'rules checked ' + C.checked].forEach(t => meta.appendChild(mk('span', '', t)));
    hero.appendChild(meta);
    if (C.review) hero.appendChild(mk('p', 'small vnote', C.review));
    const bar = mk('div', 'progbar'); const i = mk('i'); i.style.width = Math.round(100 * done / all.length) + '%'; bar.appendChild(i);
    hero.append(mk('p', 'small', done + ' of ' + all.length + ' lessons done' + (S.signedIn ? ' · saved to your account' : ' · saved on this device (sign in to keep it on your account)')), bar);
    const nx = all.find(l => !p.lessons[l.id]); if (nx) { const b = mk('button', 'btn', done ? 'Continue: ' + nx.title : 'Start lesson 1'); b.type = 'button'; b.addEventListener('click', () => go('l=' + nx.id)); hero.appendChild(b); }
    app.appendChild(hero);
    // tabs
    const tabs = mk('div', 'crtabs'); const panes = {};
    [['toc', 'Contents'], ['ex', 'Bid or Pass'], ['check', 'Checklists'], ['gloss', 'Glossary'], ['links', 'Official links']].forEach(([k, t], j) => { const b = mk('button', j ? '' : 'on', t); b.type = 'button'; b.addEventListener('click', () => { tabs.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); Object.keys(panes).forEach(z => panes[z].hidden = z !== k); }); tabs.appendChild(b); panes[k] = mk('div', 'crpane'); panes[k].hidden = !!j; });
    app.appendChild(tabs); Object.values(panes).forEach(x => app.appendChild(x));
    // contents
    C.modules.forEach((m, mi) => {
      const box = mk('section', 'crmod'); const h = mk('div', 'crmodh');
      const mdone = m.lessons.filter(l => p.lessons[l.id]).length, q = p.quizzes[m.id];
      h.append(mk('span', 'mcn', String(mi + 1)), (() => { const d = mk('div'); d.append(mk('b', '', m.title), mk('span', 'small muted', mdone + '/' + m.lessons.length + ' lessons · ' + m.lessons.reduce((t, l) => t + l.mins, 0) + ' min' + (q ? ' · quiz ' + q.score + '/' + q.of : '') + (m.free ? ' · Free' : S.paid ? '' : ' · 🔒 Members'))); return d; })());
      box.appendChild(h);
      const ol = mk('ol', 'crls');
      m.lessons.forEach(l => { const li = mk('li', p.lessons[l.id] ? 'done' : ''); const a = mk('button', '', ''); a.type = 'button'; a.append(mk('span', 'lt', l.title), mk('span', 'small muted', l.mins + ' min' + (p.lessons[l.id] ? ' · done ✓' : ''))); a.addEventListener('click', () => go('l=' + l.id)); li.appendChild(a); ol.appendChild(li); });
      if (m.quiz) { const li = mk('li', 'quizli'); const a = mk('button', '', ''); a.type = 'button'; a.append(mk('span', 'lt', '✎ Module ' + (mi + 1) + ' quiz'), mk('span', 'small muted', m.quiz + ' questions' + (q ? ' · best ' + q.score + '/' + q.of : ''))); a.addEventListener('click', () => go('q=' + m.id)); li.appendChild(a); ol.appendChild(li); }
      box.appendChild(ol); panes.toc.appendChild(box);
    });
    // exercise
    panes.ex.appendChild(mk('p', '', C.exercise ? 'Open a real listing (or, where we have none, a clearly labeled simulated one), research it with our map and calculator, enter your maximum bid and explain Bid or Pass. Then see the walkthrough.' : 'No exercise for this course yet.'));
    if (C.exercise) { const b = mk('button', 'btn', 'Start: ' + C.exercise.title); b.type = 'button'; b.addEventListener('click', () => go('x=1')); panes.ex.appendChild(b); }
    // checklists
    [['research', 'Research checklist'], ['bid', 'Bid checklist']].forEach(([k, t]) => {
      const box = mk('div', 'mccheck'); box.appendChild(mk('b', '', t)); const ul = mk('ul'); (C.checklists[k] || []).forEach(x => { const li = mk('li'); const lab = mk('label'); const inp = mk('input'); inp.type = 'checkbox'; lab.append(inp, mk('span', '', x)); li.appendChild(lab); ul.appendChild(li); }); box.appendChild(ul);
      const dl = mk('button', 'btn small ghost', 'Download as text'); dl.type = 'button';
      dl.addEventListener('click', () => { const a = mk('a'); a.href = URL.createObjectURL(new Blob([C.title + '\n' + t + ' (PricePocketAsset, rules checked ' + C.checked + ')\n\n' + C.checklists[k].map(x => '[ ] ' + x).join('\n') + '\n\nEducational only. Confirm with the county and the statute.\n'], {type: 'text/plain'})); a.download = CID + '-' + k + '-checklist.txt'; a.click(); });
      const pr = mk('button', 'btn small ghost', 'Print or save as PDF'); pr.type = 'button'; pr.addEventListener('click', () => { document.body.classList.add('printing-' + k); window.print(); setTimeout(() => document.body.classList.remove('printing-' + k), 500); });
      box.append(dl, pr); box.dataset.k = k; panes.check.appendChild(box);
    });
    // glossary
    const dl = mk('dl', 'mcgloss'); C.glossary.forEach(g => { const d = mk('div'); d.append(mk('dt', '', g[0]), mk('dd', '', g[1])); dl.appendChild(d); }); panes.gloss.appendChild(dl);
    // links
    const ul = mk('ul', 'crlinks'); C.links.forEach(l => { const li = mk('li'); const a = mk('a', '', l[0]); a.href = l[1]; a.target = '_blank'; a.rel = 'noopener noreferrer'; li.appendChild(a); if (l[2]) li.append(' · ' + l[2]); ul.appendChild(li); }); panes.links.appendChild(ul);
    panes.links.appendChild(mk('h3', '', 'Every source cited in this course'));
    const sl = mk('ul', 'crlinks'); Object.values(C.sources).forEach(s => { const li = mk('li'); const a = mk('a', '', s.name); a.href = s.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; li.append(a, ' · checked ' + s.checked + (s.effective ? ' · ' + s.effective : '')); sl.appendChild(li); }); panes.links.appendChild(sl);
  }
  async function lesson(id) {
    app.textContent = 'Loading…';
    let r, d; try { r = await fetch(API + '?c=' + CID + '&l=' + encodeURIComponent(id)); d = await r.json(); } catch (e) { app.textContent = 'Could not load the lesson. Try again.'; return; }
    app.textContent = '';
    const all = allLessons(), k = all.findIndex(x => x.id === id), cur = all[k];
    const back = mk('button', 'btn small ghost', '← Contents'); back.type = 'button'; back.addEventListener('click', () => go('')); app.appendChild(back);
    if (d.locked) { app.appendChild(mk('h1', '', d.title)); app.appendChild(lockBox('For members', d.signedIn)); return; }
    if (!d.lesson) { app.appendChild(mk('p', '', d.error || 'Lesson not found.')); return; }
    const art = mk('article', 'crlesson');
    art.appendChild(mk('p', 'small muted', 'Module ' + (C.modules.indexOf(cur.m) + 1) + ': ' + cur.m.title + ' · Lesson ' + (k + 1) + ' of ' + all.length + ' · ' + d.lesson.mins + ' min read'));
    art.appendChild(mk('h1', '', d.lesson.title)); render(d.lesson.body, art); app.appendChild(art);
    const nav = mk('div', 'crnav');
    const doneB = mk('button', 'btn', prog().lessons[id] ? 'Done ✓ · Next' : 'Mark done and continue'); doneB.type = 'button';
    doneB.addEventListener('click', async () => {
      if (S.signedIn) { const x = await post({action: 'lesson', l: id}); if (x.ok) S.progress = x.d.progress; } else { const p = local(); p.lessons[id] = new Date().toISOString().slice(0, 10); saveLocal(p); }
      const last = cur.m.lessons[cur.m.lessons.length - 1].id === id;
      if (last && cur.m.quiz) go('q=' + cur.m.id); else if (all[k + 1]) go('l=' + all[k + 1].id); else go('');
    });
    nav.appendChild(doneB);
    if (k > 0) { const pb = mk('button', 'btn ghost', '← Previous'); pb.type = 'button'; pb.addEventListener('click', () => go('l=' + all[k - 1].id)); nav.appendChild(pb); }
    app.appendChild(nav);
    app.appendChild(mk('p', 'small muted', 'Educational only. Not legal, tax or investment advice. Rules change; each citation shows when we checked it.'));
  }
  async function quiz(mid) {
    app.textContent = 'Loading…';
    let r, d; try { r = await fetch(API + '?c=' + CID + '&q=' + encodeURIComponent(mid)); d = await r.json(); } catch (e) { app.textContent = 'Could not load the quiz.'; return; }
    app.textContent = '';
    const back = mk('button', 'btn small ghost', '← Contents'); back.type = 'button'; back.addEventListener('click', () => go('')); app.appendChild(back);
    if (d.locked) { app.appendChild(mk('h1', '', d.title)); app.appendChild(lockBox('For members', d.signedIn)); return; }
    app.appendChild(mk('h1', '', 'Quiz: ' + d.title));
    const f = mk('form', 'quiz');
    d.quiz.forEach((q, i) => { const fs = mk('fieldset'); fs.appendChild(mk('legend', '', (i + 1) + '. ' + q.q)); q.a.forEach((ans, j) => { const lab = mk('label'); const rr = mk('input'); rr.type = 'radio'; rr.name = 'q' + i; rr.value = j; lab.append(rr, mk('span', '', ans)); fs.appendChild(lab); }); f.appendChild(fs); });
    const sub = mk('button', 'btn', 'Check my answers'); sub.type = 'submit'; const res = mk('p', ''); res.setAttribute('role', 'status'); f.append(sub, res); app.appendChild(f);
    f.addEventListener('submit', async e => {
      e.preventDefault(); let score = 0;
      d.quiz.forEach((q, i) => { const sel = f.querySelector('input[name=q' + i + ']:checked'), fs = f.querySelectorAll('fieldset')[i], old = fs.querySelector('.why'); if (old) old.remove(); const ok = sel && Number(sel.value) === q.c; if (ok) score++; const w = mk('p', 'why ' + (ok ? 'ok' : 'bad')); w.innerHTML = (ok ? '✔ Right. ' : '✖ ' + (sel ? 'Not quite. ' : 'No answer. ') + 'The answer is: ' + esc(q.a[q.c]) + '. ') + inline(q.why); fs.appendChild(w); });
      res.textContent = 'You got ' + score + ' of ' + d.quiz.length + '.';
      if (S.signedIn) { const x = await post({action: 'quiz', m: mid, score}); if (x.ok) S.progress = x.d.progress; } else { const p = local(); const o = p.quizzes[mid]; p.quizzes[mid] = {score: Math.max(score, o ? o.score : 0), of: d.quiz.length}; saveLocal(p); }
      const mi = C.modules.findIndex(m => m.id === mid), nm = C.modules[mi + 1];
      if (nm) { const b = mk('button', 'btn', 'Next module: ' + nm.title); b.type = 'button'; b.addEventListener('click', () => go('l=' + nm.lessons[0].id)); res.after(b); }
    });
  }
  async function exercise() {
    app.textContent = 'Loading…';
    let r, d; try { r = await fetch(API + '?c=' + CID + '&x=1'); d = await r.json(); } catch (e) { app.textContent = 'Could not load the exercise.'; return; }
    app.textContent = '';
    const back = mk('button', 'btn small ghost', '← Contents'); back.type = 'button'; back.addEventListener('click', () => go('')); app.appendChild(back);
    if (d.locked) { app.appendChild(mk('h1', '', d.title)); app.appendChild(lockBox('For members', d.signedIn)); return; }
    const x = d.exercise; app.appendChild(mk('h1', '', x.title));
    const lab = mk('div', x.simulated ? 'prdemo' : 'keybox'); lab.innerHTML = inline(x.label); app.appendChild(lab);
    const box = mk('div', 'crex');
    if (x.lien && x.lien.parcel) { const th = mk('div', 'lthumb'); box.appendChild(th); ParcelData.thumb(x.lien, th); }
    const dl = mk('dl', 'prfacts'); x.facts.forEach(f => { const dd = mk('div'); const v = mk('dd'); v.innerHTML = inline(f[1]); dd.append(mk('dt', '', f[0]), v); dl.appendChild(dd); }); box.appendChild(dl);
    const tools = mk('div', 'sact');
    if (x.lien && x.lien.parcel) { const b = mk('button', 'btn small', 'Open the parcel map and record'); b.type = 'button'; b.addEventListener('click', () => LienMap.open(x.lien)); tools.appendChild(b); }
    if (x.calc) { const a = mk('a', 'btn small ghost', 'Open the calculator'); a.href = '/?' + new URLSearchParams(x.calc).toString() + '#calculator'; a.target = '_blank'; tools.appendChild(a); }
    box.appendChild(tools); app.appendChild(box);
    const brief = mk('div', 'crbrief'); render(x.brief, brief); app.appendChild(brief);
    const f = mk('form', 'prdecide'); f.setAttribute('novalidate', '');
    const lb = mk('label', 'small', 'Your maximum bid or total cash you would put in ($)'); const mx = mk('input'); mx.inputMode = 'decimal'; mx.placeholder = 'e.g. 450'; lb.appendChild(mx);
    const row = mk('div', 'prchoices'); [['bid', 'Bid'], ['pass', 'Pass']].forEach(([v, t]) => { const l = mk('label', 'prchoice'); const rr = mk('input'); rr.type = 'radio'; rr.name = 'dec'; rr.value = v; l.append(rr, mk('b', '', t)); row.appendChild(l); });
    const why = mk('textarea'); why.rows = 4; why.placeholder = 'Explain your decision: what you checked, your math and what worried you.'; why.setAttribute('aria-label', 'Explain your decision');
    const go2 = mk('button', 'btn', 'Submit and see the walkthrough'); go2.type = 'submit'; const msg = mk('p', 'small'); msg.setAttribute('role', 'status');
    f.append(lb, row, why, go2, msg); app.appendChild(f);
    const out = mk('div', 'crwalk'); app.appendChild(out);
    f.addEventListener('submit', async e => {
      e.preventDefault(); const dec = (f.querySelector('input[name=dec]:checked') || {}).value;
      const res = await post({action: 'exercise', maxBid: mx.value, decision: dec, reason: why.value});
      if (!res.ok) { msg.textContent = res.d.error || 'Could not submit.'; return; }
      msg.textContent = ''; f.querySelectorAll('input,textarea,button').forEach(z => z.disabled = true);
      out.appendChild(mk('h2', '', 'Walkthrough')); render(res.d.walkthrough, out); out.scrollIntoView({behavior: 'smooth'});
    });
  }
  function route() {
    const q = new URLSearchParams(location.search);
    if (q.get('l')) return lesson(q.get('l'));
    if (q.get('q')) return quiz(q.get('q'));
    if (q.get('x')) return exercise();
    home();
  }
  window.addEventListener('popstate', route);
  fetch(API + '?c=' + CID).then(r => r.json()).then(d => { if (!d.course) { app.textContent = d.error || 'Course not found.'; return; } C = d.course; S = {signedIn: d.signedIn, paid: d.paid, progress: d.progress}; document.title = C.title + ' | PricePocketAsset'; route(); }).catch(() => { app.textContent = 'Could not load the course. Try again.'; });
})();
