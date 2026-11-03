(function () {
  const $ = id => document.getElementById(id);
  const API = '/.netlify/functions/account';
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const money = n => '$' + Number(n).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  const DAY = 864e5;
  let user = null, items = [], editing = null;
  const st = a => STATES.find(s => s.a === a);
  STATES.forEach(s => $('state').appendChild(new Option(s.n, s.a)));
  const parse = d => new Date(d + 'T00:00:00');
  const iso = d => d.toISOString().slice(0, 10);
  const addMonths = (d, m) => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x; };
  const post = async o => { try { const r = await fetch(API, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(o)}); return {ok: r.ok, d: await r.json()}; } catch (e) { return {ok: false, d: {error: 'Could not reach the server.'}}; } };

  // Simple-interest estimate only. Premium-bid and penalty states work differently.
  function interest(h) {
    const end = h.status === 'open' || !h.closed ? new Date() : parse(h.closed);
    const days = Math.max(0, Math.floor((end - parse(h.bought)) / DAY));
    return h.paid * (h.rate / 100) * days / 365;
  }
  function deadline(h) { return h.months ? addMonths(parse(h.bought), h.months) : null; }

  function summary() {
    const box = $('sum'); box.textContent = '';
    const open = items.filter(h => h.status === 'open');
    const inv = items.reduce((a, h) => a + h.paid, 0), est = items.reduce((a, h) => a + interest(h), 0);
    box.appendChild(mk('h3', '', 'Summary'));
    const dl = mk('dl', 'stfacts');
    [['Liens tracked', items.length + ' (' + open.length + ' open)'], ['Money in', money(inv)], ['Estimated interest so far', money(est)]].forEach(([k, v]) => { const d = mk('div'); d.append(mk('dt', '', k), mk('dd', '', v)); dl.appendChild(d); });
    box.appendChild(dl);
    const up = open.map(h => ({h, d: deadline(h)})).filter(x => x.d).sort((a, b) => a.d - b.d).slice(0, 5);
    if (up.length) {
      box.appendChild(mk('p', 'small', 'Upcoming dates (estimates):'));
      const ul = mk('ul', 'small'); up.forEach(x => { const left = Math.ceil((x.d - new Date()) / DAY); ul.appendChild(mk('li', '', iso(x.d) + ' · ' + x.h.state + (x.h.county ? ' ' + x.h.county : '') + ' ' + x.h.parcel + ' · ' + (left >= 0 ? left + ' days left' : 'date passed ' + (-left) + ' days ago'))); }); box.appendChild(ul);
    }
  }
  function card(h) {
    const s = st(h.state) || {n: h.state}, c = mk('article', 'scard');
    const head = mk('div', 'scardh'); head.append(mk('b', '', s.n + (h.county ? ' · ' + h.county : '') + (h.parcel ? ' · ' + h.parcel : '')), mk('span', 'sscore', {open: 'Open', redeemed: 'Redeemed', foreclosure: 'Foreclosure started', other: 'Closed'}[h.status]));
    c.appendChild(head);
    const dl = mk('dl', 'stfacts'), dd = deadline(h), left = dd ? Math.ceil((dd - new Date()) / DAY) : null;
    [['Paid', money(h.paid)], ['Rate', h.rate != null ? h.rate + '%' : 'not entered'], ['Bought', h.bought], ['Estimated interest', money(interest(h)) + (h.status === 'open' ? ' to date' : '')],
     ['End of redemption (estimate)', dd ? iso(dd) + (h.status === 'open' ? (left >= 0 ? ' (' + left + ' days left)' : ' (passed ' + (-left) + ' days ago)') : '') : 'not entered']].forEach(([k, v]) => { const d = mk('div'); d.append(mk('dt', '', k), mk('dd', '', v)); dl.appendChild(d); });
    c.appendChild(dl);
    if (s.sys) {
      const t = mk('div', 'askout'); t.appendChild(mk('p', '', s.n + ' terms from our state guide'));
      const ul = mk('ul'); [['System', s.sys], ['Bidding', s.bid], ['Interest or penalty', s.rate], ['Redemption', s.red]].forEach(([k, v]) => ul.appendChild(mk('li', '', k + ': ' + v))); t.appendChild(ul);
      if (s.note) t.appendChild(mk('p', 'small', s.note));
      if (s.v) t.appendChild(mk('p', 'small', 'Verify: sources disagree or only one source was found for some figures in this state.'));
      const a = mk('a', '', 'Open the ' + s.n + ' page'); a.href = '../liens/states/state/?s=' + h.state; t.appendChild(a);
      c.appendChild(t);
    }
    if (h.notes) c.appendChild(mk('p', 'small', 'Notes: ' + h.notes));
    const act = mk('div', 'sact');
    const e = mk('button', 'btn small', 'Edit'); e.type = 'button'; e.addEventListener('click', () => openForm(h));
    const x = mk('button', 'btn small ghost', 'Delete'); x.type = 'button';
    x.addEventListener('click', async () => { if (!confirm('Delete this lien from your portfolio?')) return; const r = await post({action: 'pfDelete', id: h.id}); if (r.ok) { items = r.d.portfolio; render(); } });
    act.append(e, x); c.appendChild(act); return c;
  }
  function render() {
    summary(); const l = $('list'); l.textContent = '';
    if (!items.length) l.appendChild(mk('p', 'muted', 'Nothing here yet. Tap “Add a lien I bought”.'));
    items.slice().sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || (b.bought > a.bought ? 1 : -1)).forEach(h => l.appendChild(card(h)));
  }
  function hint() {
    const s = st($('state').value); if (!s) return;
    $('mhint').textContent = 'Our guide for ' + s.n + ': ' + s.red + (s.v ? ' (verify)' : '') + '. Type the number of months that applies to your lien.';
  }
  function openForm(h) {
    editing = h || null; $('form').hidden = false; $('ftitle').textContent = h ? 'Edit lien' : 'Add a lien'; $('msg').textContent = '';
    const v = h || {state: 'FL', county: '', parcel: '', paid: '', rate: '', bought: '', months: '', status: 'open', closed: '', notes: ''};
    $('state').value = v.state; $('county').value = v.county; $('parcel').value = v.parcel; $('paid').value = v.paid; $('rate').value = v.rate == null ? '' : v.rate; $('bought').value = v.bought; $('months').value = v.months == null ? '' : v.months; $('status').value = v.status; $('closed').value = v.closed || ''; $('notes').value = v.notes;
    if (!h) { const s = st(v.state); if (s && s.m > 0) $('months').value = s.m; if (s && s.r) $('rate').value = ''; }
    $('closedwrap').hidden = $('status').value === 'open'; hint();
    const sv = user.saved || []; $('fromwrap').hidden = !sv.length || !!h;
    if (sv.length) { $('from').textContent = ''; $('from').appendChild(new Option('Choose…', '')); sv.forEach((x, i) => $('from').appendChild(new Option(x.county + ' ' + x.parcel, String(i)))); }
    $('form').scrollIntoView({behavior: 'smooth'});
  }
  $('from').addEventListener('change', () => { const x = user.saved[+$('from').value]; if (!x) return; $('state').value = {'Palm Beach': 'FL', 'Larimer': 'CO'}[x.county] || $('state').value; $('county').value = x.county; $('parcel').value = x.parcel; if (x.face != null && !$('paid').value) $('paid').value = x.face; if (x.county === 'Palm Beach') $('rate').value = 18; const s = st($('state').value); if (s && s.m > 0) $('months').value = s.m; hint(); });
  $('state').addEventListener('change', () => { hint(); if (!editing) { const s = st($('state').value); $('months').value = s && s.m > 0 ? s.m : ''; } });
  $('status').addEventListener('change', () => { $('closedwrap').hidden = $('status').value === 'open'; });
  $('addbtn').addEventListener('click', () => openForm(null));
  $('cancel').addEventListener('click', () => { $('form').hidden = true; });
  $('form').addEventListener('submit', async e => {
    e.preventDefault(); $('save').disabled = true; $('msg').textContent = 'Saving…';
    const h = {id: editing && editing.id, state: $('state').value, county: $('county').value.trim(), parcel: $('parcel').value.trim(), paid: $('paid').value.replace(/[$,]/g, ''), rate: $('rate').value, bought: $('bought').value, months: $('months').value, status: $('status').value, closed: $('status').value === 'open' ? '' : $('closed').value, notes: $('notes').value};
    const r = await post({action: 'pfSave', holding: h}); $('save').disabled = false;
    if (r.ok) { items = r.d.portfolio; $('form').hidden = true; render(); } else $('msg').textContent = r.d.error || 'Could not save.';
  });
  $('csv').addEventListener('click', () => {
    const q = v => { let s = String(v == null ? '' : v); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
    const rows = [['State', 'County', 'Parcel', 'Paid', 'Rate %', 'Bought', 'Redemption months', 'Est. end of redemption', 'Status', 'Closed', 'Est. interest', 'Notes']].concat(items.map(h => { const d = deadline(h); return [h.state, h.county, h.parcel, h.paid, h.rate, h.bought, h.months, d ? iso(d) : '', h.status, h.closed, interest(h).toFixed(2), h.notes]; }));
    const a = mk('a'); a.href = URL.createObjectURL(new Blob([rows.map(r => r.map(q).join(',')).join('\n')], {type: 'text/csv'})); a.download = 'my-portfolio.csv'; a.click();
  });
  fetch(API).then(r => r.json()).then(d => { user = d.user; if (!user) { $('gate').hidden = false; return; } items = user.portfolio || []; $('app').hidden = false; render(); }).catch(() => { $('gate').hidden = false; });
})();
