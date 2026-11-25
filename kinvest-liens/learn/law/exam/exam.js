// Timed final examination. Questions are drawn at random on the server; answers and explanations arrive only after submission.
(function () {
  const API = '/.netlify/functions/academy', root = document.getElementById('exam'), qs = new URLSearchParams(location.search);
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const st = (qs.get('state') || '').toUpperCase(), level = qs.get('level') || '';
  let exam = null, timer = 0, sent = false;
  const intro = () => {
    root.textContent = '';
    root.append(el('p', 'kick', 'Final examination'), el('h1', '', st + ' state law'),
      el('p', 'lead', 'Questions are drawn at random from the reviewed course, including statute identification. The clock starts when you begin. Your answers and the correct ones are shown only after you submit.'));
    const go = el('button', 'btn gold', 'Begin examination'); go.onclick = start; root.append(go, el('p', 'small muted', 'Educational only. Not legal advice.'));
  };
  function start() {
    root.textContent = 'Starting…';
    fetch(API, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start', state: st, level }) })
      .then(r => r.json().then(d => ({ ok: r.ok, d }))).then(({ ok, d }) => { if (!ok) { root.textContent = ''; root.append(el('p', 'note', d.error || 'The examination could not start.'), back()); return; } exam = d.exam; render(); });
  }
  const back = () => { const a = el('a', 'btn ghost', 'Back to Law Studies'); a.href = '/learn/law/?state=' + st; a.style.marginTop = '14px'; return a; };
  function render() {
    root.textContent = '';
    const bar = el('div', 'timer'), clock = el('b'), count = el('span', 'small muted'); bar.append(el('span', '', exam.level + ' · ' + exam.questions.length + ' questions'), count, clock); root.append(bar);
    const form = el('form'); exam.questions.forEach(q => {
      const box = el('fieldset', 'q'); box.style.border = '0'; box.append(el('legend', 'small muted', q.n + '. ' + q.kind + ' · ' + q.topic), el('p', '', q.q));
      q.options.forEach((o, i) => { const l = el('label'), r = el('input'); r.type = 'radio'; r.name = q.id; r.value = i; r.onchange = upd; l.append(r, el('span', '', o)); box.append(l); });
      form.append(box);
    });
    const sub = el('button', 'btn', 'Submit examination'); sub.type = 'submit'; form.append(sub); form.onsubmit = e => { e.preventDefault(); const left = exam.questions.length - answered(); if (left && !confirm(left + ' questions are unanswered. Submit anyway?')) return; submit(); };
    root.append(form);
    const end = Date.parse(exam.started) + exam.minutes * 60e3;
    function upd() { count.textContent = answered() + ' answered'; }
    function tick() { const ms = end - Date.now(); if (ms <= 0) { clock.textContent = '0:00'; submit(); return; } const m = Math.floor(ms / 60e3), s = Math.floor(ms % 60e3 / 1e3); clock.textContent = m + ':' + String(s).padStart(2, '0'); timer = setTimeout(tick, 1000); }
    upd(); tick();
    window.onbeforeunload = () => sent ? undefined : 'Your examination is in progress.';
  }
  const answered = () => exam.questions.filter(q => document.querySelector('input[name="' + CSS.escape(q.id) + '"]:checked')).length;
  function submit() {
    if (sent) return; sent = true; clearTimeout(timer); window.onbeforeunload = null;
    const answers = {}; exam.questions.forEach(q => { const c = document.querySelector('input[name="' + CSS.escape(q.id) + '"]:checked'); if (c) answers[q.id] = Number(c.value); });
    root.textContent = 'Grading…';
    fetch(API, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'submit', id: exam.id, answers }) })
      .then(r => r.json()).then(d => results(d)).catch(() => { root.textContent = 'Your answers could not be sent. Check your connection.'; });
  }
  function results(d) {
    root.textContent = ''; const r = d.result; if (!r) { root.append(el('p', 'note', d.error || 'Grading failed.'), back()); return; }
    root.append(el('p', 'kick', 'Result'), el('h1', '', r.score + '%'), el('p', 'lead ' + (r.passed ? 'ok' : 'bad'), (r.passed ? 'Passed. ' : 'Not passed. ') + r.right + ' of ' + r.total + ' correct.' + (r.late ? ' Submitted after the time limit, so it cannot pass.' : '')));
    if (d.certificate) { const n = el('p', 'note'); n.append(document.createTextNode('Certificate earned: ' + d.certificate.title + '. Verification ID ' + d.certificate.id + '. ')); const a = el('a', '', 'Verify'); a.href = '/learn/law/verify/?id=' + d.certificate.id; n.append(a, document.createTextNode('. ' + d.note)); root.append(n); }
    root.append(el('h2', '', 'Review'));
    r.review.forEach(q => {
      const b = el('div', 'q'); b.append(el('p', '', q.n + '. ' + q.q));
      b.append(el('p', q.correct ? 'ok' : 'bad', (q.correct ? 'Correct: ' : 'Your answer: ' + (q.yourAnswer || 'no answer') + '. Correct answer: ') + q.correctAnswer));
      b.append(el('p', 'small muted', q.why));
      (q.sources || []).forEach(s => { const a = el('a', 'small', s.name); a.href = s.url; a.target = '_blank'; a.rel = 'noopener'; b.append(a, el('span', 'small muted', '  checked ' + (s.checked || 'n/a') + (s.effective ? ' · ' + s.effective : '')), el('br')); });
      root.append(b);
    });
    root.append(back());
  }
  if (!st || !level) { root.textContent = 'Choose an examination from Law Studies.'; root.append(back()); } else intro();
})();
