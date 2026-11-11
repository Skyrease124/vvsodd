// Free guided practice case. No sign-in. The outcome is requested from the server only after the visitor submits a decision.
(function () {
  const API = '/.netlify/functions/practice';
  const app = document.getElementById('prapp');
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const id = new URLSearchParams(location.search).get('case') || 'lee-demo';
  const SK = 'ppa_practice_' + id;
  const load = () => { try { return JSON.parse(localStorage.getItem(SK) || '{}'); } catch (e) { return {}; } };
  const save = o => { try { localStorage.setItem(SK, JSON.stringify(o)); } catch (e) {} };
  let st = Object.assign({marks: {}, opened: [], decision: '', reason: ''}, load());

  fetch(API + '?case=' + encodeURIComponent(id)).then(r => r.json()).then(d => { if (!d.case) { app.textContent = d.error || 'That practice case is not published yet.'; return; } render(d.case); }).catch(() => { app.textContent = 'Could not load the case. Try again.'; });

  function facts(obj) { const dl = mk('dl', 'prfacts'); Object.keys(obj).forEach(k => { const d = mk('div'); d.append(mk('dt', '', k), mk('dd', '', obj[k])); dl.appendChild(d); }); return dl; }
  function step(n, title, sub) { const h = mk('div', 'prstep'); h.append(mk('span', 'mcn', String(n)), (() => { const d = mk('div'); d.append(mk('h2', '', title)); if (sub) d.appendChild(mk('p', 'small muted', sub)); return d; })()); return h; }

  function render(c) {
    app.textContent = '';
    if (c.demo) { const b = mk('div', 'prdemo'); b.setAttribute('role', 'note'); b.append(mk('b', '', 'DEMO CASE: every number, date and source here is made up. '), 'It lets you practice the steps while the real ' + c.county + ' County case is prepared from verified county records.'); app.appendChild(b); }
    app.appendChild(mk('p', 'lead', 'You are looking at a tax lien certificate in ' + c.county + ' County, Florida, as it was when it was sold. Do your research, make a call, then see what actually happened.'));

    app.appendChild(step(1, 'The certificate', 'What was for sale.'));
    app.appendChild(facts(c.certificate));
    app.appendChild(step(2, 'The parcel', 'What the county records showed at the time.'));
    app.appendChild(facts(c.parcel));

    app.appendChild(step(3, 'Check before you decide', 'Tap Check this on each item. Then mark it Verified, Needs follow-up or Unknown. Leaving something Unknown is allowed, and it shows up in your feedback.'));
    const items = c.checks.map(k => Object.assign({}, k, {revealed: st.opened.indexOf(k.key) >= 0}));
    app.appendChild(Research.build(items, st.marks, m => { st.marks = m; save(st); }, {onOpen: k => { if (st.opened.indexOf(k) < 0) st.opened.push(k); save(st); }}));

    app.appendChild(step(4, 'Your call', 'Buy, Watch or Pass, and why.'));
    const f = mk('form', 'prdecide'); f.setAttribute('novalidate', '');
    const row = mk('div', 'prchoices'); row.setAttribute('role', 'radiogroup'); row.setAttribute('aria-label', 'Your decision');
    [['buy', 'Buy', 'I would bid.'], ['watch', 'Watch', 'I need more information.'], ['pass', 'Pass', 'I would skip it.']].forEach(([v, t, d]) => {
      const lab = mk('label', 'prchoice'); const r = mk('input'); r.type = 'radio'; r.name = 'dec'; r.value = v; r.checked = st.decision === v;
      lab.append(r, mk('b', '', t), mk('span', 'small', d)); r.addEventListener('change', () => { st.decision = v; save(st); sync(); }); row.appendChild(lab);
    });
    const why = mk('textarea'); why.rows = 4; why.maxLength = 1500; why.placeholder = 'Why? Say what you checked and what worried you or reassured you.'; why.setAttribute('aria-label', 'Explain your decision'); why.value = st.reason;
    why.addEventListener('input', () => { st.reason = why.value; save(st); sync(); });
    const go = mk('button', 'btn', 'Submit and see what happened'); go.type = 'submit'; go.disabled = true;
    const msg = mk('p', 'small', ''); msg.setAttribute('role', 'status'); msg.setAttribute('aria-live', 'polite');
    const sync = () => { go.disabled = !(st.decision && st.reason.trim().length >= 15); };
    f.append(row, why, go, msg); app.appendChild(f); sync();
    const out = mk('div', 'prout'); out.setAttribute('aria-live', 'polite'); app.appendChild(out);
    f.addEventListener('submit', async e => {
      e.preventDefault(); go.disabled = true; msg.textContent = 'Checking the records…';
      let r, d; try { r = await fetch(API, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({case: id, decision: st.decision, reason: st.reason, marks: st.marks})}); d = await r.json(); } catch (er) { msg.textContent = 'Could not reach the server. Try again.'; go.disabled = false; return; }
      if (!r.ok) { msg.textContent = d.error || 'Could not show the result.'; go.disabled = false; return; }
      msg.textContent = ''; f.querySelectorAll('input,textarea,button').forEach(x => x.disabled = true);
      result(out, d, c);
    });
  }

  function result(out, d, c) {
    out.textContent = '';
    out.appendChild(step(5, 'What actually happened', d.demo ? 'Demo outcome (made up).' : 'From the official record.'));
    const o = d.outcome;
    const tiles = mk('div', 'pftiles');
    [['Result', o.status], ['Purchase amount', o.purchase], ['Winning rate', o.ratePct], ['Holding period', o.months + ' months'], ['Interest earned', o.interest], ['Redemption payout', o.payout]].forEach(([k, v], i) => { const t = mk('div', 'pftile'); t.style.setProperty('--d', (i * 0.08) + 's'); t.append(mk('span', 'pfk', k), mk('b', '', v)); tiles.appendChild(t); });
    out.appendChild(tiles);
    out.appendChild(mk('p', 'small muted', 'Source: ' + o.source.name + ' · ' + o.date));
    out.appendChild(mk('h2', '', 'Your feedback'));
    out.appendChild(mk('p', 'lead', d.summary));
    d.items.forEach(i => { const c2 = mk('article', 'rsitem fb ' + i.flag); const h = mk('div', 'rsh'); h.append(mk('b', '', i.title), mk('span', 'rschip ' + i.marked, Research.LABEL[i.marked])); c2.append(h, mk('p', '', i.message)); out.appendChild(c2); });
    out.appendChild(mk('p', 'prlesson', d.lesson));
    const act = mk('p', 'sact');
    const again = mk('button', 'btn ghost', 'Practice again'); again.type = 'button'; again.addEventListener('click', () => { st = {marks: {}, opened: [], decision: '', reason: ''}; save(st); render(c); window.scrollTo(0, 0); });
    const cty = mk('a', 'btn', 'Open the ' + c.county + ' County page'); cty.href = '/liens/states/county/?c=' + encodeURIComponent(c.county);
    const mc = mk('a', 'btn ghost', 'Master Class'); mc.href = '/learn/';
    act.append(cty, mc, again); out.appendChild(act);
    out.scrollIntoView({behavior: 'smooth', block: 'start'});
  }
})();
