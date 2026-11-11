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
    const done = state.lessons.filter(l => isDone(l.id)).length, n = state.lessons.length, sdone = Object.keys(prog()).filter(k => /^st_/.test(k) && prog()[k].score >= PASS).length;
    const pb = $('prog'); pb.textContent = '';
    const pct = Math.round(100 * done / (n || 1)), R = 34, C = 2 * Math.PI * R;
    const ring = mk('div', 'mcring'); ring.innerHTML = '<svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="' + R + '" class="t"/><circle cx="40" cy="40" r="' + R + '" class="p" style="--c:' + C.toFixed(1) + ';--o:' + (C * (1 - pct / 100)).toFixed(1) + '"/></svg>';
    ring.appendChild(mk('b', '', done + '/' + n)); pb.appendChild(ring);
    const tx = mk('div', 'mctx'); tx.appendChild(mk('b', '', done === n ? '🎓 Master Class complete!' : done ? 'Nice. Keep going.' : 'Start with lesson 1')); tx.appendChild(mk('span', 'small', done + ' of ' + n + ' lessons done · ' + pct + '%'));
    const bar = mk('div', 'progbar'); const i = mk('i'); i.style.width = pct + '%'; bar.appendChild(i); tx.appendChild(bar); pb.appendChild(tx);
    if (done === n) pb.appendChild(mk('p', 'mcwide', 'You finished all 10 lessons. Nice work. Now put it to use: pick one county, screen its list, and check Land Information before you bid.'));
    if (!state.signedIn) { const p = mk('p', 'small muted mcwide'); const a = mk('a', '', 'Sign in'); a.href = '/login/?next=/learn/'; p.append(a, ' to save your progress to your account.'); pb.appendChild(p); }
    extras(); grid();
    const ol = $('outline'); ol.textContent = '';
    const nextI = state.lessons.findIndex(l => !isDone(l.id));
    const MODS = {0: 'Module 1 · Foundations', 3: 'Module 2 · How a sale works', 6: 'Module 3 · Protect yourself', 8: 'Module 4 · Deeds and your plan'};
    state.lessons.forEach((l, k) => {
      if (MODS[k]) ol.appendChild(mk('li', 'modlabel', MODS[k]));
      const li = mk('li', (isDone(l.id) ? 'done' : '') + (k === nextI ? ' next' : '')); const b = mk('button'); b.type = 'button';
      const t = mk('span', 'lt'); t.append(mk('b', '', l.title), mk('span', 'small muted', l.mins + ' min' + (isDone(l.id) ? ' · done ✔' : k === nextI ? ' · up next' : '')));
      b.append(mk('span', 'num', isDone(l.id) ? '✓' : String(k + 1)), t, mk('span', 'tag' + (l.free ? ' free' : ''), l.free ? 'Free' : (state.paid ? 'Pro' : '🔒 Pro')));
      b.addEventListener('click', () => go(l.id)); li.appendChild(b); ol.appendChild(li);
    });
  }
  function grid() {
    const g = $('stgrid'); if (!g || typeof STATES === 'undefined') return; g.textContent = '';
    STATES.forEach(s => { const a = mk('a', 'stcell' + (prog()['st_' + s.a] && prog()['st_' + s.a].score >= PASS ? ' done' : '')); a.href = '/learn/state/?s=' + s.a; a.append(mk('b', '', s.n), mk('span', 'small muted', s.sys)); g.appendChild(a); });
  }

  // ---------- Extras: exam, walkthroughs, glossary, checklists ----------
  const GLOSS = [
    ['Delinquent', 'Behind on paying property tax.'],
    ['Tax lien', 'A claim on a property for unpaid tax. Buying one means buying the debt.'],
    ['Tax lien certificate', 'The paper or electronic record that you bought a lien.'],
    ['Tax deed', 'A deed given to the winning bidder when the property itself is sold for unpaid tax.'],
    ['Redeemable deed', 'A deed sale where the owner can still buy the property back for a set time.'],
    ['Redemption', 'The owner paying what is owed (plus interest or a penalty) to clear the lien or get the property back.'],
    ['Redemption period', 'How long the owner has to redeem. It is set by state law and differs a lot.'],
    ['Face amount', 'The tax, interest and fees owed on a parcel. It is what you pay for a lien at a basic sale.'],
    ['Bid-down', 'Bidders compete by accepting a lower interest rate. The lowest rate wins.'],
    ['Premium bid', 'Bidders pay extra above the amount owed. The extra often earns no interest.'],
    ['Interest vs. penalty', 'Interest grows with time. A penalty is a flat amount no matter how fast the owner pays.'],
    ['Parcel number (PIN)', 'The county’s ID number for a property. Always match on it, not just the street.'],
    ['County-held lien', 'A lien nobody bought at auction. Some counties sell these later.'],
    ['Foreclosure', 'The legal process a lien holder uses to try to get the property when the owner never redeems.'],
    ['Quiet title', 'A court action to clear up who owns a property so the title is clean.'],
    ['Senior lien', 'A claim that gets paid before others. Tax liens are often senior, but check your state.'],
    ['Easement', 'A right for someone else to use part of a property, such as a utility line or a path.'],
    ['Mineral rights', 'The right to what is under the ground, which can be sold separately from the land.'],
    ['Sliver or strip', 'A very narrow or tiny parcel, often a leftover between properties, that cannot be used.'],
    ['High-risk flood zone', 'An area FEMA maps as having a high chance of flooding. It can mean required insurance and building limits.'],
    ['Wetlands', 'Wet areas mapped by the US Fish and Wildlife Service. They can block building.'],
    ['Excess proceeds (surplus)', 'Money left over when a property sells for more than is owed. Usually it belongs to the former owner.'],
    ['W-9', 'The tax form most counties ask bidders to file before they bid.']
  ];
  const CHECK = ['Which system is my state: lien, deed or redeemable deed?', 'Rate or penalty, and how bidding works', 'Redemption period', 'Registered, W-9 filed, deposit sent', 'Parcel is a real, usable lot (not a sliver, easement or mineral-only)', 'Road access checked', 'Flood zone and wetlands checked (Land Information)', 'Other liens and bankruptcy checked', 'Maximum bid written down before the sale', 'Funds ready by the payment deadline', 'Records saved in My portfolio', 'Confirmed everything with the county'];
  function extras() {
    const x = $('extras'); if (!x) return; x.textContent = '';
    const exam = prog().exam, passed = !!(exam && exam.score >= 16), all = state.lessons.every(l => isDone(l.id));
    const box = mk('div', 'mcxtra');
    const card = (t, d, label, fn, cls) => { const c = mk('div', 'mccard' + (cls ? ' ' + cls : '')); c.append(mk('b', '', t), mk('span', 'small', d)); const b = mk('button', 'btn small', label); b.type = 'button'; b.addEventListener('click', fn); c.appendChild(b); return c; };
    box.appendChild(card(passed ? '🏆 Certificate earned' : '🎓 Final exam', passed ? 'You scored ' + exam.score + ' of 20. Open your certificate.' : '20 questions from the whole course. You need 16 to pass and can retake it. Members only.' + (all ? '' : ' Finish the lessons first for the best result.'), passed ? 'Open certificate' : 'Start the exam', () => go('exam'), 'gold'));
    box.appendChild(card('🧭 Walkthroughs', 'Follow a lien sale and a deed sale from start to finish, using the researched steps for each state.', 'Open walkthroughs', () => go('walk')));
    box.appendChild(card('📖 Glossary', GLOSS.length + ' plain-English words you will see on every sale notice.', 'Open glossary', () => go('glossary')));
    box.appendChild(card('✅ Before-you-bid checklist', 'A one-page checklist to print or save as a PDF from your phone.', 'Open checklist', () => go('checklist')));
    x.appendChild(box);
  }
  function backBtn(box) { const back = mk('button', 'btn small ghost', '← All lessons'); back.type = 'button'; back.addEventListener('click', () => go('')); box.appendChild(back); }
  const note = box => box.appendChild(mk('p', 'small muted', 'Educational only. Not legal, tax or investment advice. Laws change and differ by state and county; confirm with the county and a professional.'));
  function showGlossary(box) {
    backBtn(box); box.appendChild(mk('h1', '', 'Glossary')); box.appendChild(mk('p', 'lead', 'The words on every tax sale notice, in plain English.'));
    const dl = mk('dl', 'mcgloss'); GLOSS.forEach(g => { const d = mk('div'); d.append(mk('dt', '', g[0]), mk('dd', '', g[1])); dl.appendChild(d); }); box.appendChild(dl); note(box);
  }
  function showChecklist(box) {
    backBtn(box); box.appendChild(mk('h1', '', 'Before-you-bid checklist')); box.appendChild(mk('p', 'lead', 'Go through this for every parcel. Tap to tick. Use Print to save a PDF.'));
    const ul = mk('ul', 'mcchk'); CHECK.forEach(c => { const li = mk('li'); const lab = mk('label'); const i = mk('input'); i.type = 'checkbox'; lab.append(i, mk('span', '', c)); li.appendChild(lab); ul.appendChild(li); }); box.appendChild(ul);
    const pr = mk('button', 'btn', 'Print or save as PDF'); pr.type = 'button'; pr.addEventListener('click', () => window.print()); box.appendChild(pr); note(box);
  }
  function loadSD(cb) { if (typeof STATE_DATA !== 'undefined') return cb(); const sc = document.createElement('script'); sc.src = '/liens/states/state-data.js'; sc.onload = cb; sc.onerror = () => cb(); document.head.appendChild(sc); }
  function showWalk(box, code) {
    backBtn(box); box.appendChild(mk('h1', '', 'Walkthrough: a tax sale, start to finish'));
    box.appendChild(mk('p', 'lead', 'Pick a state. You will see the steps of its sale from our researched notes, with the checks we recommend between them.'));
    const sel = mk('select', 'mcsel'); sel.setAttribute('aria-label', 'State');
    const out = mk('div', 'mcwalk');
    loadSD(() => {
      const have = (typeof STATE_DATA !== 'undefined') ? STATES.filter(s => STATE_DATA[s.a] && STATE_DATA[s.a].sale && STATE_DATA[s.a].sale.steps) : [];
      have.forEach(s => sel.appendChild(new Option(s.n + ' (' + s.sys + ')', s.a)));
      const draw = a => {
        out.textContent = ''; const s = STATES.find(x => x.a === a), sd = STATE_DATA[a].sale; if (!s) return;
        history.replaceState(null, '', '?l=walk&s=' + a);
        const stage = (n, t, items, cls) => { const c = mk('section', 'mcstage ' + (cls || '')); c.appendChild(mk('span', 'mcn', String(n))); const b = mk('div'); b.appendChild(mk('h3', '', t)); items.forEach(i => b.appendChild(mk('p', '', i))); c.appendChild(b); out.appendChild(c); };
        stage(1, 'Know the system', [s.n + ' is a ' + s.sys.toLowerCase() + ' state. Rate or penalty: ' + s.rate + '. Redemption: ' + s.red + '.' + (s.v ? ' (Our sources differ here. Verify with the state.)' : '')]);
        stage(2, 'When the sale happens', [sd.when || 'Check the county’s sale notice.']);
        stage(3, 'The steps, from the law and official sources', sd.steps, 'steps');
        stage(4, 'Check the land before you bid', ['Open the county list and tap Land Information on a parcel: flood zone (FEMA), wetlands (US Fish and Wildlife), road access, and zoning.', 'Skip slivers, easements and mineral-only parcels. Confirm everything with the county.']);
        stage(5, 'After the sale', ['Write down your records in My portfolio: parcel, amount, rate, date, and the end of the redemption period.']);
        const a1 = mk('a', 'btn small', 'Open the ' + s.n + ' state page'); a1.href = '/liens/states/state/?s=' + a; out.appendChild(a1);
      };
      sel.addEventListener('change', () => draw(sel.value));
      box.appendChild(sel); box.appendChild(out);
      const want = code && have.some(s => s.a === code) ? code : (have.some(s => s.a === 'AZ') ? 'AZ' : (have[0] && have[0].a));
      if (want) { sel.value = want; draw(want); } else out.textContent = 'Could not load the walkthroughs. Try again.';
      note(box);
    });
  }
  async function showExam(box) {
    backBtn(box); box.appendChild(mk('h1', '', 'Final exam'));
    const prev = prog().exam;
    if (prev && prev.score >= 16) certificate(box, prev);
    let d; try { const r = await fetch(API + '?id=exam'); d = await r.json(); } catch (e) { box.appendChild(mk('p', '', 'Could not load the exam. Try again.')); return; }
    if (d.locked) {
      const n = mk('div', 'salebox'); n.append(mk('h3', '', '🔒 For members'), mk('p', '', 'The final exam and certificate are part of membership ($5.50 a week).'));
      const a = mk('a', 'btn', d.signedIn ? 'Become a member' : 'Sign in or create an account'); a.href = d.signedIn ? '/account/' : '/login/?next=/learn/?l=exam'; n.appendChild(a); box.appendChild(n); return;
    }
    const ex = d.exam; box.appendChild(mk('p', 'lead', '20 questions from the whole course. You need ' + ex.pass + ' right to pass. You can retake it as often as you like.'));
    const f = mk('form', 'quiz');
    ex.questions.forEach((q, i) => {
      const fs = mk('fieldset'); fs.appendChild(mk('legend', '', (i + 1) + '. ' + q.q));
      q.a.forEach((ans, j) => { const lab = mk('label'); const r = mk('input'); r.type = 'radio'; r.name = 'q' + i; r.value = j; lab.append(r, mk('span', '', ans)); fs.appendChild(lab); });
      f.appendChild(fs);
    });
    const sub = mk('button', 'btn', 'Submit my exam'); sub.type = 'submit'; const res = mk('p', '', ''); res.setAttribute('role', 'status'); f.append(sub, res); box.appendChild(f);
    f.addEventListener('submit', async e => {
      e.preventDefault(); let score = 0;
      ex.questions.forEach((q, i) => {
        const sel = f.querySelector('input[name=q' + i + ']:checked'), fs = f.querySelectorAll('fieldset')[i], old = fs.querySelector('.why'); if (old) old.remove();
        const ok = sel && Number(sel.value) === q.c; if (ok) score++;
        fs.appendChild(mk('p', 'why ' + (ok ? 'ok' : 'bad'), (ok ? '✔ Right. ' : '✖ ' + (sel ? 'Not quite. ' : 'No answer. ') + 'The answer is: ' + q.a[q.c] + '. ') + q.why));
      });
      const pass = score >= ex.pass;
      res.textContent = 'You got ' + score + ' of 20. ' + (pass ? 'You passed! 🎉' : 'You need ' + ex.pass + '. Review the lessons and retake it.');
      try { const r = await fetch(API, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id: 'exam', score})}); const x = await r.json(); if (x.progress) { state.progress = x.progress; if (pass) certificate(box, x.progress.exam, true); } } catch (er) {}
    });
    note(box);
  }
  function certificate(box, rec, fresh) {
    const old = box.querySelector('.mccert'); if (old) old.remove();
    const c = mk('div', 'mccert'); c.append(mk('span', 'mcseal', '★'), mk('p', 'small', 'PricePocketAsset'), mk('h2', '', 'Certificate of Completion'), mk('p', '', 'Liens & Deeds Master Class'));
    const name = mk('input', 'mcname'); name.placeholder = 'Type your name'; name.maxLength = 60; name.setAttribute('aria-label', 'Your name'); try { name.value = localStorage.getItem('ppa_certname') || ''; } catch (e) {}
    name.addEventListener('input', () => { try { localStorage.setItem('ppa_certname', name.value); } catch (e) {} });
    c.append(name, mk('p', 'small', 'Exam score: ' + rec.score + ' of 20 · ' + String(rec.at || new Date().toISOString()).slice(0, 10)), mk('p', 'small', 'Educational completion only. Not a license, and not legal, tax or investment advice.'));
    const pr = mk('button', 'btn small', 'Print or save as PDF'); pr.type = 'button'; pr.addEventListener('click', () => window.print()); c.appendChild(pr);
    box.insertBefore(c, box.querySelector('h1').nextSibling);
    if (fresh) c.scrollIntoView({behavior: 'smooth', block: 'center'});
  }
  // calculator used inside lessons
  function calc() {
    const w = mk('div', 'mccalc'); w.appendChild(mk('h3', '', 'Try it: simple interest and dates'));
    const row = (l, v) => { const lab = mk('label', '', l); const i = mk('input'); i.inputMode = 'decimal'; i.value = v; lab.appendChild(i); w.appendChild(lab); return i; };
    const a = row('Amount paid ($)', '1000'), r = row('Interest rate (% a year)', '12'), m = row('Months until the owner pays', '6');
    const lab = mk('label', '', 'Date bought'); const d = mk('input'); d.type = 'date'; lab.appendChild(d); w.appendChild(lab);
    const out = mk('p', 'mcout'); out.setAttribute('role', 'status'); w.appendChild(out);
    const upd = () => { const P = parseFloat(a.value.replace(/[$,]/g, '')), R = parseFloat(r.value), M = parseFloat(m.value); if (!(P >= 0) || !(R >= 0) || !(M >= 0)) { out.textContent = 'Enter numbers to see the result.'; return; }
      const i = P * R / 100 * M / 12; let t = '$' + P.toLocaleString('en-US') + ' earns about $' + i.toFixed(2) + ' in ' + M + ' months, so you get back about $' + (P + i).toFixed(2) + '.';
      if (d.value) { const e = new Date(d.value + 'T00:00:00'); e.setMonth(e.getMonth() + Math.round(M)); t += ' Estimated date: ' + e.toISOString().slice(0, 10) + '.'; }
      out.textContent = t + ' Simple interest only. Your state may work differently.'; };
    [a, r, m, d].forEach(x => x.addEventListener('input', upd)); upd(); return w;
  }
  function drill(box, items) {
    box.appendChild(mk('h2', '', 'Spot the red flag')); box.appendChild(mk('p', 'small muted', 'Made-up scenarios, not graded.'));
    items.forEach(q => { const fs = mk('fieldset', 'mcdrill'); fs.appendChild(mk('legend', '', q.q)); const out = mk('p', 'why'); q.a.forEach((ans, j) => { const b = mk('button', 'btn small ghost', ans); b.type = 'button'; b.addEventListener('click', () => { out.className = 'why ' + (j === q.c ? 'ok' : 'bad'); out.textContent = (j === q.c ? '✔ Right. ' : '✖ Not quite. ') + q.why; }); fs.appendChild(b); }); fs.appendChild(out); box.appendChild(fs); });
  }
  function go(id) { history.pushState(null, '', id ? '?l=' + id : location.pathname); route(); window.scrollTo(0, 0); }
  async function route() {
    const id = new URLSearchParams(location.search).get('l');
    if (!id) return home();
    $('home').hidden = true; const box = $('lesson'); box.hidden = false;
    if (id === 'glossary') { box.textContent = ''; return showGlossary(box); }
    if (id === 'checklist') { box.textContent = ''; return showChecklist(box); }
    if (id === 'walk') { box.textContent = ''; return showWalk(box, new URLSearchParams(location.search).get('s')); }
    if (id === 'exam') { box.textContent = ''; return showExam(box); }
    box.textContent = 'Loading…';
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
    if (l.example) { const ex = mk('div', 'mcexample'); ex.append(mk('b', '', 'Worked example'), mk('p', '', l.example)); box.appendChild(ex); }
    if (l.mistakes) { const mm = mk('div', 'mcmist'); mm.appendChild(mk('b', '', 'Common mistakes')); const u = mk('ul'); l.mistakes.forEach(t => u.appendChild(mk('li', '', t))); mm.appendChild(u); box.appendChild(mm); }
    const tk = mk('div', 'takeaways'); tk.appendChild(mk('h3', '', 'Key takeaways')); const ul = mk('ul'); l.takeaways.forEach(t => ul.appendChild(mk('li', '', t))); tk.appendChild(ul); box.appendChild(tk);
    if (l.tryIt) { const p = mk('p'); p.append(mk('b', '', 'Try it on the site: '), l.tryIt.text + ' '); const a = mk('a', '', 'Open it →'); a.href = l.tryIt.href; p.appendChild(a); box.appendChild(p); }
    if (l.tool === 'calc') box.appendChild(calc());
    if (l.drill) drill(box, l.drill);
    if (l.checklist) { const ck = mk('div', 'mccheck'); ck.appendChild(mk('b', '', 'Your checklist for this lesson')); const u = mk('ul'); l.checklist.forEach(t => { const li = mk('li'); const lab = mk('label'); const i = mk('input'); i.type = 'checkbox'; lab.append(i, mk('span', '', t)); li.appendChild(lab); u.appendChild(li); }); ck.appendChild(u); box.appendChild(ck); }
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
  (function () { const g = $('mcgreet'); if (!g) return; const h = new Date().getHours(); g.textContent = (h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening') + ' \u00b7 ready to learn something?'; })();
  window.addEventListener('popstate', route);
  fetch(API).then(r => r.json()).then(d => { state = d; route(); }).catch(() => { $('outline').textContent = 'Could not load the course. Try again.'; });
})();
