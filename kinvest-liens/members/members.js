(function () {
  const $ = id => document.getElementById(id);
  const API = '/.netlify/functions/account';
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const today = () => new Date().toISOString().slice(0, 10);
  let all = [];
  const isPaid = m => !!m.paidThrough && m.paidThrough >= today();
  const post = async o => { try { const r = await fetch(API, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(o)}); return {ok: r.ok, d: await r.json()}; } catch (e) { return {ok: false, d: {error: 'Could not reach the server.'}}; } };

  function summary() {
    const s = $('sum'); s.textContent = ''; s.appendChild(mk('h3', '', 'Summary'));
    const dl = mk('dl', 'stfacts');
    const week = new Date(Date.now() - 7 * 864e5).toISOString();
    [['Total members', all.length], ['Active', all.filter(m => !m.revoked).length], ['Turned off', all.filter(m => m.revoked).length], ['Paid up', all.filter(isPaid).length], ['Joined in the last 7 days', all.filter(m => m.created > week).length]].forEach(([k, v]) => { const d = mk('div'); d.append(mk('dt', '', k), mk('dd', '', String(v))); dl.appendChild(d); });
    s.appendChild(dl);
  }
  const fmt = d => d ? d.slice(0, 10) : 'never';
  function card(m) {
    const c = mk('article', 'scard');
    const h = mk('div', 'scardh'); h.append(mk('b', '', m.email + (m.owner ? ' (owner)' : '')), mk('span', 'sscore', m.revoked ? 'Turned off' : isPaid(m) ? 'Paid up' : 'Active'));
    c.appendChild(h);
    const dl = mk('dl', 'stfacts');
    [['Joined', fmt(m.created)], ['Last sign-in', fmt(m.lastLogin)], ['Saved liens', m.saved], ['Portfolio liens', m.portfolio], ['Paid through', m.paidThrough || 'not set']].forEach(([k, v]) => { const d = mk('div'); d.append(mk('dt', '', k), mk('dd', '', String(v))); dl.appendChild(d); });
    c.appendChild(dl);
    if (m.note) c.appendChild(mk('p', 'small', 'Note: ' + m.note));
    const act = mk('div', 'sact');
    if (!m.owner) {
      const r = mk('button', 'btn small' + (m.revoked ? '' : ' ghost'), m.revoked ? 'Turn back on' : 'Turn off access'); r.type = 'button';
      r.addEventListener('click', async () => {
        if (!m.revoked && !confirm('Turn off access for ' + m.email + '? They are signed out right away.')) return;
        const x = await post({action: 'ownerMember', email: m.email, revoked: !m.revoked});
        $('msg').textContent = x.ok ? '' : (x.d.error || 'Could not save.'); if (x.ok) load();
      });
      act.appendChild(r);
    }
    const p = mk('button', 'btn small ghost', 'Set paid through'); p.type = 'button';
    p.addEventListener('click', async () => {
      const v = prompt('Paid through which date? Type it like 2026-12-31. Leave empty to clear.', m.paidThrough || '');
      if (v === null) return;
      const x = await post({action: 'ownerMember', email: m.email, paidThrough: v.trim()});
      $('msg').textContent = x.ok ? '' : (x.d.error || 'Could not save.'); if (x.ok) load();
    });
    const n = mk('button', 'btn small ghost', 'Note'); n.type = 'button';
    n.addEventListener('click', async () => {
      const v = prompt('A note about this member (only you see it):', m.note || ''); if (v === null) return;
      const x = await post({action: 'ownerMember', email: m.email, note: v});
      $('msg').textContent = x.ok ? '' : (x.d.error || 'Could not save.'); if (x.ok) load();
    });
    act.append(p, n); c.appendChild(act); return c;
  }
  function render() {
    summary();
    const q = $('q').value.trim().toLowerCase(), f = $('f').value;
    const rows = all.filter(m => (!q || (m.email + ' ' + m.note).toLowerCase().indexOf(q) >= 0) && (f === 'all' || (f === 'active' && !m.revoked) || (f === 'revoked' && m.revoked) || (f === 'paid' && isPaid(m)) || (f === 'unpaid' && !isPaid(m))));
    const l = $('list'); l.textContent = '';
    if (!rows.length) l.appendChild(mk('p', 'muted', 'No members match.'));
    rows.forEach(m => l.appendChild(card(m)));
  }
  async function load() {
    try {
      const r = await fetch(API + '?members=1');
      if (!r.ok) { $('gate').hidden = false; return; }
      all = (await r.json()).members; $('app').hidden = false; render();
    } catch (e) { $('gate').hidden = false; }
  }
  $('q').addEventListener('input', render); $('f').addEventListener('change', render);
  $('csv').addEventListener('click', () => {
    const q = v => { let s = String(v == null ? '' : v); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
    const rows = [['Email', 'Joined', 'Last sign-in', 'Status', 'Paid through', 'Saved liens', 'Portfolio liens', 'Note']].concat(all.map(m => [m.email, fmt(m.created), m.lastLogin ? fmt(m.lastLogin) : '', m.revoked ? 'turned off' : 'active', m.paidThrough, m.saved, m.portfolio, m.note]));
    const a = mk('a'); a.href = URL.createObjectURL(new Blob([rows.map(r => r.map(q).join(',')).join('\n')], {type: 'text/csv'})); a.download = 'members.csv'; a.click();
  });
  load();
})();
