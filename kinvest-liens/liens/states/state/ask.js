// Question box: sends the question to our Netlify function, which answers only from our own state data.
(function () {
  const $ = id => document.getElementById(id);
  const a = (new URLSearchParams(location.search).get('s') || '').toUpperCase();
  const st = typeof STATES !== 'undefined' && STATES.find(x => x.a === a);
  const box = $('askbox'); if (!box) return;
  if (!st) { box.hidden = true; return; }
  $('askstate').textContent = st.n;
  box.hidden = true; // stays hidden until the server says the question box is switched on
  fetch('/.netlify/functions/ask').then(r => r.ok ? r.json() : null).then(d => { if (d && d.enabled) box.hidden = false; }).catch(() => {});
  const out = $('askout'), go = $('askgo'), input = $('askq');
  ['How long does the owner have to redeem?', 'What does a buyer earn?', 'When is the next sale?', 'Is anything uncertain or marked verify?'].forEach(q => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chipbtn'; b.textContent = q;
    b.addEventListener('click', () => { input.value = q; ask(); }); $('askchips').appendChild(b);
  });
  function show(kind, text, sources) {
    out.hidden = false; out.className = 'askout ' + kind; out.textContent = '';
    const p = document.createElement('p'); p.textContent = text; out.appendChild(p);
    if (sources && sources.length) {
      const h = document.createElement('p'); h.className = 'small muted'; h.textContent = 'Sources on this page and from officials:'; out.appendChild(h);
      const ul = document.createElement('ul'); ul.className = 'small';
      sources.forEach(s => { const li = document.createElement('li'), x = document.createElement('a'); x.href = s[1]; x.textContent = s[0]; x.target = '_blank'; x.rel = 'noopener noreferrer'; li.appendChild(x); ul.appendChild(li); });
      out.appendChild(ul);
    }
    if (kind === 'ok') { const d = document.createElement('p'); d.className = 'small muted'; d.textContent = 'Automated answer from the information on this page. Educational only, not advice, and it may be wrong. Confirm with the county before you act.'; out.appendChild(d); }
  }
  async function ask() {
    const q = input.value.replace(/\s+/g, ' ').trim();
    if (q.length < 3) { show('err', 'Type a question first.'); return; }
    go.disabled = true; go.textContent = 'Thinking…'; show('wait', 'Looking that up…');
    try {
      const r = await fetch('/.netlify/functions/ask', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({state: a, question: q})});
      let d = null; try { d = await r.json(); } catch (e) {}
      if (r.ok && d && d.answer) show('ok', d.answer, d.sources);
      else if (r.status === 404) show('err', 'The question box is not available on this version of the site.');
      else show('err', (d && d.error) || 'Something went wrong. Please try again.');
    } catch (e) { show('err', 'Could not reach the question service. Check your connection and try again.'); }
    go.disabled = false; go.textContent = 'Ask';
  }
  $('askform').addEventListener('submit', e => { e.preventDefault(); ask(); });
})();
