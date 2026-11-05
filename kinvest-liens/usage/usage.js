(function () {
  const $ = id => document.getElementById(id);
  const API = '/.netlify/functions/account';
  const mk = (t, x) => { const e = document.createElement(t); e.textContent = x; return e; };
  function draw(d) {
    const t = $('today'); t.textContent = '';
    [['Used today', d.today], ['Daily limit', d.limit], ['Left today', Math.max(0, d.limit - d.today)]].forEach(([k, v]) => { const w = document.createElement('div'); w.append(mk('dt', k), mk('dd', String(v))); t.appendChild(w); });
    const pct = d.limit ? Math.min(100, Math.round(d.today / d.limit * 100)) : 100;
    $('bar').style.width = pct + '%'; $('bar').style.background = pct >= 90 ? '#c2282d' : '#0b6e4f';
    $('barnote').textContent = pct + '% of today’s limit used';
    $('daily').value = d.limit;
    const tb = $('days'); tb.textContent = '';
    const hr = tb.createTHead().insertRow(); ['Day (UTC)', 'Questions', 'Screens', 'AI problems', 'Total'].forEach(h => hr.appendChild(mk('th', h)));
    const body = tb.createTBody();
    d.days.forEach(x => { const r = body.insertRow(); [x.date, x.ask, x.screen, x.fail, x.ask + x.screen].forEach(v => r.insertCell().textContent = String(v)); });
  }
  async function load() {
    try {
      const r = await fetch(API + '?usage=1');
      if (!r.ok) { $('gate').hidden = false; return; }
      $('app').hidden = false; draw(await r.json());
    } catch (e) { $('gate').hidden = false; }
  }
  $('lim').addEventListener('submit', async e => {
    e.preventDefault(); $('msg').textContent = 'Saving…';
    const r = await fetch(API, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'setLimit', daily: $('daily').value})});
    const d = await r.json();
    if (r.ok) { $('msg').textContent = 'Saved.'; load(); } else $('msg').textContent = d.error || 'Could not save.';
  });
  load();
})();
