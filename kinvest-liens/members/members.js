(function () {
  const $ = id => document.getElementById(id);
  const API = '/.netlify/functions/account';
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const today = () => new Date().toISOString().slice(0, 10);
  let all = [];
  const isPaid = m => !!m.family || (!!m.paidThrough && m.paidThrough >= today());
  const post = async o => { try { const r = await fetch(API, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(o)}); return {ok: r.ok, d: await r.json()}; } catch (e) { return {ok: false, d: {error: 'Could not reach the server.'}}; } };

  function summary() {
    const s = $('sum'); s.textContent = ''; s.appendChild(mk('h3', '', 'Summary'));
    const dl = mk('dl', 'stfacts');
    const week = new Date(Date.now() - 7 * 864e5).toISOString();
    [['Total members', all.length], ['Active', all.filter(m => !m.revoked).length], ['Deactivated', all.filter(m => m.revoked).length], ['With strikes', all.filter(m => (m.strikes || []).length).length], ['Paid up', all.filter(isPaid).length], ['Joined in the last 7 days', all.filter(m => m.created > week).length]].forEach(([k, v]) => { const d = mk('div'); d.append(mk('dt', '', k), mk('dd', '', String(v))); dl.appendChild(d); });
    s.appendChild(dl);
  }
  const fmt = d => d ? d.slice(0, 10) : 'never';
  function card(m) {
    const c = mk('article', 'scard');
    const h = mk('div', 'scardh'); h.append(mk('b', '', m.email + (m.owner ? ' (owner)' : '')), mk('span', 'sscore', m.revoked ? 'Deactivated' : m.family ? 'Family (free)' : isPaid(m) ? 'Paid up' : 'Active'));
    c.appendChild(h);
    const dl = mk('dl', 'stfacts');
    [['Joined', fmt(m.created)], ['Last sign-in', fmt(m.lastLogin)], ['Favorites', m.saved], ['Portfolio liens', m.portfolio], ['Paid through', m.paidThrough || 'not set'], ['Stripe subscription', m.sub || 'none']].forEach(([k, v]) => { const d = mk('div'); d.append(mk('dt', '', k), mk('dd', '', String(v))); dl.appendChild(d); });
    c.appendChild(dl);
    if (m.alert) c.appendChild(mk('p', 'small', '\u26A0 Billing alert: ' + ({payment_failed: 'last payment failed', refunded: 'a payment was refunded', dispute: 'a customer opened a dispute', fraud_warning: 'Stripe raised an early fraud warning'}[m.alert] || m.alert)));
    if (m.note) c.appendChild(mk('p', 'small', 'Note: ' + m.note));
    if (m.revoked) c.appendChild(mk('p', 'small', 'Deactivated ' + fmt(m.revokedAt) + (m.revokeReason ? ' \u00B7 your private reason: ' + m.revokeReason : '') + '. They see: "This account has been deactivated. Please contact PricePocketAsset for more information."'));
    const sk = m.strikes || [];
    if (sk.length) { const w = mk('div', 'small'); w.appendChild(mk('b', '', sk.length + (sk.length === 1 ? ' strike' : ' strikes'))); sk.forEach(s => { const row = mk('div'); row.append(document.createTextNode(fmt(s.at) + ' \u00B7 ' + s.reason + ' '), (() => { const x = mk('button', 'btn small ghost', 'Remove'); x.type = 'button'; x.addEventListener('click', async () => { if (!confirm('Remove this strike?')) return; const r = await post({action: 'ownerMember', email: m.email, removeStrike: s.id}); $('msg').textContent = r.ok ? '' : (r.d.error || 'Could not save.'); if (r.ok) load(); }); return x; })()); w.appendChild(row); }); c.appendChild(w); }
    const act = mk('div', 'sact');
    if (!m.owner) {
      const r = mk('button', 'btn small' + (m.revoked ? '' : ' ghost'), m.revoked ? 'Reactivate' : 'Deactivate'); r.type = 'button';
      r.addEventListener('click', async () => {
        let reason = '';
        if (!m.revoked) { const v = prompt('Deactivate ' + m.email + '? They are signed out right away and cannot sign in. When they try, they see: "This account has been deactivated. Please contact PricePocketAsset for more information."\n\nYour private reason (only you see it):', ''); if (v === null) return; reason = v; }
        const x = await post({action: 'ownerMember', email: m.email, revoked: !m.revoked, reason});
        $('msg').textContent = x.ok ? '' : (x.d.error || 'Could not save.'); if (x.ok) load();
      });
      act.appendChild(r);
      const st = mk('button', 'btn small ghost', 'Add strike'); st.type = 'button';
      st.addEventListener('click', async () => {
        const v = prompt('Strike for ' + m.email + '. What did they do? (only you see it)', ''); if (v === null) return;
        const x = await post({action: 'ownerMember', email: m.email, strike: {reason: v}});
        $('msg').textContent = x.ok ? '' : (x.d.error || 'Could not save.'); if (x.ok) load();
      });
      act.appendChild(st);
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
    const fam = mk('button', 'btn small ghost', m.family ? 'Remove free access' : 'Give free access'); fam.type = 'button';
    fam.addEventListener('click', async () => {
      if (m.family && !confirm('Take away free access for ' + m.email + '?')) return;
      const x = await post({action: 'ownerMember', email: m.email, family: !m.family});
      $('msg').textContent = x.ok ? '' : (x.d.error || 'Could not save.'); if (x.ok) load();
    });
    act.append(p, fam, n); c.appendChild(act); return c;
  }
  function render() {
    summary();
    const q = $('q').value.trim().toLowerCase(), f = $('f').value;
    const rows = all.filter(m => (!q || (m.email + ' ' + m.note).toLowerCase().indexOf(q) >= 0) && (f === 'all' || (f === 'active' && !m.revoked) || (f === 'revoked' && m.revoked) || (f === 'strikes' && (m.strikes || []).length) || (f === 'paid' && isPaid(m)) || (f === 'unpaid' && !isPaid(m))));
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
    const rows = [['Email', 'Joined', 'Last sign-in', 'Status', 'Paid through', 'Favorites', 'Portfolio liens', 'Strikes', 'Note']].concat(all.map(m => [m.email, fmt(m.created), m.lastLogin ? fmt(m.lastLogin) : '', m.revoked ? 'deactivated' : 'active', m.paidThrough, m.saved, m.portfolio, (m.strikes || []).length, m.note]));
    const a = mk('a'); a.href = URL.createObjectURL(new Blob([rows.map(r => r.map(q).join(',')).join('\n')], {type: 'text/csv'})); a.download = 'members.csv'; a.click();
  });
  load();
})();

(function () {
  const $ = id => document.getElementById(id);
  async function loadCodes() {
    const box = $('codelist'); if (!box) return;
    let d; try { d = await (await fetch('/.netlify/functions/account?codes=1')).json(); } catch (e) { return; }
    box.textContent = '';
    (d.codes || []).forEach(c => {
      const row = document.createElement('p'); row.className = 'small';
      const b = document.createElement('b'); b.textContent = c.code; row.appendChild(b);
      row.appendChild(document.createTextNode(' \u2014 ' + (c.note ? c.note + ' \u2014 ' : '') + (c.usedBy ? 'used by ' + c.usedBy : 'not used yet') + ' '));
      const del = document.createElement('button'); del.type = 'button'; del.className = 'btn small ghost'; del.textContent = c.usedBy ? 'Hide' : 'Cancel code';
      del.addEventListener('click', async () => { await fetch('/.netlify/functions/account', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'deleteCode', code: c.code})}); loadCodes(); });
      row.appendChild(del); box.appendChild(row);
    });
  }
  if ($('mkcode')) { $('mkcode').addEventListener('click', async () => {
    const r = await fetch('/.netlify/functions/account', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'makeCode', note: $('cnote').value})});
    const d = await r.json(); $('newcode').textContent = r.ok ? 'New code: ' + d.code + ' (tap and hold to copy it)' : (d.error || 'Could not make a code.'); $('cnote').value = ''; loadCodes();
  }); loadCodes(); }
})();
