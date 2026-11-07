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
    const hr = tb.createTHead().insertRow(); ['Day (UTC)', 'Questions', 'Screens', 'PricePocket AI', 'AI problems', 'Total'].forEach(h => hr.appendChild(mk('th', h)));
    const body = tb.createTBody();
    d.days.forEach(x => { const r = body.insertRow(); [x.date, x.ask, x.screen, x.ai, x.fail, x.ask + x.screen + x.ai].forEach(v => r.insertCell().textContent = String(v)); });
  }
  async function load() {
    try {
      const r = await fetch(API + '?usage=1');
      if (!r.ok) {
        const me = await (await fetch(API)).json().catch(() => ({}));
        if (me && me.user && /[?&]claim=1/.test(location.search)) { $('claim').hidden = false; } else $('gate').hidden = false;
        return;
      }
      $('app').hidden = false; draw(await r.json());
    } catch (e) { $('gate').hidden = false; }
  }
  $('lim').addEventListener('submit', async e => {
    e.preventDefault(); $('msg').textContent = 'Saving…';
    const r = await fetch(API, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'setLimit', daily: $('daily').value})});
    const d = await r.json();
    if (r.ok) { $('msg').textContent = 'Saved.'; load(); } else $('msg').textContent = d.error || 'Could not save.';
  });
  async function loadResets() {
    const ul = $('resets'); ul.textContent = '';
    try {
      const r = await fetch(API + '?resets=1'); if (!r.ok) return; const d = await r.json();
      if (!d.requests.length) { const li = document.createElement('li'); li.textContent = 'No requests.'; ul.appendChild(li); return; }
      d.requests.forEach(x => {
        const li = document.createElement('li'); li.style.cssText = 'display:block;border-radius:10px;margin:6px 0;padding:10px';
        const b = document.createElement('button'); b.className = 'btn small'; b.type = 'button'; b.textContent = 'Set temporary password';
        b.addEventListener('click', async () => {
          const rr = await fetch(API, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'ownerSetPassword', email: x.email})});
          const dd = await rr.json();
          $('rmsg').textContent = rr.ok ? 'Temporary password for ' + dd.email + ': ' + dd.temp + '  (shown once; send it to them)' : (dd.error || 'Could not set it.');
          if (rr.ok) loadResets();
        });
        li.append(document.createTextNode(x.email + ' \u00b7 ' + x.at.slice(0, 16).replace('T', ' ') + ' UTC '), b); ul.appendChild(li);
      });
    } catch (e) {}
  }
  $('claim').addEventListener('submit', async e => {
    e.preventDefault(); $('cmsg').textContent = 'One moment\u2026';
    const r = await fetch(API, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'claimOwner', code: $('ccode').value})});
    const d = await r.json();
    if (r.ok) location.reload(); else $('cmsg').textContent = d.error || 'Could not do that.';
  });
  load(); loadResets();
})();
