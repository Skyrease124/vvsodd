(function () {
  const $ = id => document.getElementById(id);
  const API = '/.netlify/functions/account';
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const today = () => new Date().toISOString().slice(0, 10);
  let all = [];
  const isPaid = m => !!m.family || (!!m.paidThrough && m.paidThrough >= today());
  const post = async o => { try { const r = await fetch(API, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(o)}); return {ok: r.ok, d: await r.json()}; } catch (e) { return {ok: false, d: {error: 'Could not reach the server.'}}; } };

  // Apple-style sheet instead of the browser's plain pop-ups. Resolves to the typed text (or true), or null when cancelled.
  function ask(o) {
    return new Promise(res => {
      const ov = mk('div', 'mb-ov'), sh = mk('div', 'mb-sheet'); sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true'); sh.setAttribute('aria-label', o.title);
      sh.appendChild(mk('h3', '', o.title)); if (o.text) sh.appendChild(mk('p', 'mb-sub', o.text));
      if (o.preview) sh.appendChild(mk('p', 'mb-quote', o.preview));
      let inp = null; if (o.field) { inp = mk(o.multiline ? 'textarea' : 'input', 'mb-in'); if (o.multiline) inp.rows = 3; else inp.type = 'text'; inp.maxLength = o.max || 300; inp.placeholder = o.field; inp.value = o.value || ''; inp.setAttribute('aria-label', o.field); sh.appendChild(inp); }
      const row = mk('div', 'mb-row'), no = mk('button', 'mb-btn', 'Cancel'), yes = mk('button', 'mb-btn ' + (o.danger ? 'danger solid' : 'primary solid'), o.confirm || 'OK'); no.type = yes.type = 'button';
      const done = v => { document.removeEventListener('keydown', key); ov.classList.remove('on'); setTimeout(() => ov.remove(), 180); res(v); };
      const key = e => { if (e.key === 'Escape') done(null); };
      no.addEventListener('click', () => done(null)); yes.addEventListener('click', () => done(inp ? inp.value.trim() : true)); ov.addEventListener('click', e => { if (e.target === ov) done(null); }); document.addEventListener('keydown', key);
      row.append(no, yes); sh.appendChild(row); ov.appendChild(sh); document.body.appendChild(ov); requestAnimationFrame(() => { ov.classList.add('on'); if (inp) inp.focus({preventScroll: true}); else yes.focus(); });
    });
  }
  const initials = e => (e.split('@')[0].replace(/[^a-z0-9]/gi, ' ').trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('') || '?').toUpperCase();
  function summary() {
    const s = $('sum'); s.textContent = ''; s.className = 'mb-sum';
    const week = new Date(Date.now() - 7 * 864e5).toISOString();
    [['Members', all.length], ['Active', all.filter(m => !m.revoked).length], ['Paid up', all.filter(isPaid).length], ['New this week', all.filter(m => m.created > week).length], ['Deactivated', all.filter(m => m.revoked).length], ['With strikes', all.filter(m => (m.strikes || []).length).length]].forEach(([k, v]) => { const d = mk('div', 'mb-stat'); d.append(mk('b', '', String(v)), mk('span', '', k)); s.appendChild(d); });
  }
  const fmt = d => d ? d.slice(0, 10) : 'never';
  const status = m => m.revoked ? ['Deactivated', 'off'] : m.family ? ['Family', 'fam'] : isPaid(m) ? ['Paid', 'paid'] : ['Active', 'on'];
  function card(m) {
    const c = mk('article', 'mb-card' + (m.revoked ? ' is-off' : ''));
    const h = mk('div', 'mb-head'), av = mk('div', 'mb-av', initials(m.email)), who = mk('div', 'mb-who'), st = status(m);
    who.append(mk('b', '', m.email), mk('span', '', (m.owner ? 'Owner · ' : '') + 'Joined ' + fmt(m.created) + ' · Last sign-in ' + fmt(m.lastLogin)));
    h.append(av, who, mk('span', 'mb-pill ' + st[1], st[0])); c.appendChild(h);
    const f = mk('dl', 'mb-facts');
    [['Favorites', m.saved], ['Portfolio', m.portfolio], ['Paid through', m.paidThrough || 'not set'], ['Stripe', m.sub || 'none']].forEach(([k, v]) => { const d = mk('div'); d.append(mk('dt', '', k), mk('dd', '', String(v))); f.appendChild(d); });
    c.appendChild(f);
    if (m.alert) c.appendChild(mk('p', 'mb-note warn', '⚠ Billing alert: ' + ({payment_failed: 'last payment failed', refunded: 'a payment was refunded', dispute: 'a customer opened a dispute', fraud_warning: 'Stripe raised an early fraud warning'}[m.alert] || m.alert)));
    if (m.note) c.appendChild(mk('p', 'mb-note', 'Note: ' + m.note));
    if (m.revoked) c.appendChild(mk('p', 'mb-note warn', 'Deactivated ' + fmt(m.revokedAt) + (m.revokeReason ? ' · your private reason: ' + m.revokeReason : '') + '. When they sign in they see: “This account has been deactivated. Please contact PricePocketAsset for more information.”'));
    const sk = m.strikes || [];
    if (sk.length) {
      const w = mk('div', 'mb-strikes'); w.appendChild(mk('h4', '', sk.length + (sk.length === 1 ? ' strike' : ' strikes')));
      sk.forEach(s => { const row = mk('div', 'mb-srow'), t = mk('div'); t.append(mk('b', '', s.reason), mk('span', '', fmt(s.at))); const x = mk('button', 'mb-link', 'Remove'); x.type = 'button';
        x.addEventListener('click', async () => { if (!(await ask({title: 'Remove this strike?', text: '“' + s.reason + '” will be taken off ' + m.email + '.', confirm: 'Remove'}))) return; const r = await post({action: 'ownerMember', email: m.email, removeStrike: s.id}); $('msg').textContent = r.ok ? '' : (r.d.error || 'Could not save.'); if (r.ok) load(); });
        row.append(t, x); w.appendChild(row); });
      c.appendChild(w);
    }
    const save = async o => { const x = await post(Object.assign({action: 'ownerMember', email: m.email}, o)); $('msg').textContent = x.ok ? '' : (x.d.error || 'Could not save.'); if (x.ok) load(); };
    const btn = (label, cls, fn) => { const b = mk('button', 'mb-btn ' + (cls || ''), label); b.type = 'button'; b.addEventListener('click', fn); return b; };
    const act = mk('div', 'mb-act');
    if (!m.owner) {
      if (m.revoked) act.appendChild(btn('Reactivate', 'primary solid', async () => { if (await ask({title: 'Reactivate ' + m.email + '?', text: 'They can sign in again. Their strikes stay on record.', confirm: 'Reactivate'})) save({revoked: false}); }));
      else act.appendChild(btn('Deactivate', 'danger', async () => { const v = await ask({title: 'Deactivate ' + m.email + '?', text: 'They are signed out right away and cannot sign in. When they try, they see:', preview: '“This account has been deactivated. Please contact PricePocketAsset for more information.”', field: 'Your private reason (only you see it)', multiline: true, confirm: 'Deactivate', danger: true}); if (v !== null) save({revoked: true, reason: v === true ? '' : v}); }));
      act.appendChild(btn('Add strike', '', async () => { const v = await ask({title: 'Add a strike', text: 'For ' + m.email + '. Only you see this. Strikes never deactivate anyone by themselves.', field: 'What did they do?', multiline: true, max: 200, confirm: 'Add strike'}); if (v) save({strike: {reason: v}}); }));
    }
    act.appendChild(btn('Paid through', '', async () => { const v = await ask({title: 'Paid through', text: 'Type a date like 2026-12-31. Leave empty to clear.', field: 'YYYY-MM-DD', value: m.paidThrough || '', max: 10, confirm: 'Save'}); if (v !== null) save({paidThrough: v === true ? '' : v}); }));
    act.appendChild(btn(m.family ? 'Remove free access' : 'Free access', '', async () => { if (m.family && !(await ask({title: 'Take away free access?', text: m.email + ' will need to pay like everyone else.', confirm: 'Take away', danger: true}))) return; save({family: !m.family}); }));
    act.appendChild(btn('Note', '', async () => { const v = await ask({title: 'Note', text: 'A note about this member (only you see it).', field: 'Note', value: m.note || '', max: 200, multiline: true, confirm: 'Save'}); if (v !== null) save({note: v === true ? '' : v}); }));
    c.appendChild(act); return c;
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
