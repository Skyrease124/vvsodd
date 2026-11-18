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

  // Calculations come from the shared, state-specific engine (liens/lien-rules.js).
  // States whose statutes have been read use their own rules; every other state gets a clearly labeled basic estimate.
  const calcFor = (h, asOf) => LienCalc.estimate(h, asOf ? {asOf} : {});
  const interest = h => { const r = calcFor(h); return r.interest == null ? 0 : r.interest; };
  const KIND = {statute: ['Calculated from the statute', 'statute'], estimate: ['Estimate', 'estimate'], user: ['Entered by you', 'user'], county: ['Confirmed by the county (you entered it)', 'county'], basic: ['Basic estimate, not a legal deadline', 'basic']};

  function countUp(el, to, f) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = f(to); return; }
    const t0 = performance.now();
    const step = t => { const k = Math.min(1, (t - t0) / 1100), e = 1 - Math.pow(1 - k, 3); el.textContent = f(to * e); if (k < 1) requestAnimationFrame(step); else el.textContent = f(to); };
    requestAnimationFrame(step);
  }
  function summary() {
    const box = $('sum'); box.textContent = '';
    const open = items.filter(h => h.status === 'open');
    const calcs = items.map(h => ({h, r: calcFor(h)}));
    const inv = items.reduce((a, h) => a + h.paid, 0), est = calcs.reduce((a, x) => a + (x.r.interest || 0), 0);
    const nBasic = calcs.filter(x => !x.r.verified).length;
    const dl = mk('div', 'pftiles');
    [['Liens tracked', items.length, v => String(v), items.length ? open.length + ' open' : 'none yet'], ['Money in', inv, money, 'what you paid'], ['Estimated interest to date', est, money, nBasic ? 'state rules where verified; basic estimate for ' + nBasic + ' lien' + (nBasic === 1 ? '' : 's') : 'using each state\u2019s rules']].forEach(([k, v, f, sub], i) => {
      const d = mk('div', 'pftile'); d.style.setProperty('--d', (i * 0.1) + 's'); const bn = mk('b', '', f(0)); const run = () => countUp(bn, v, f);
      d.append(mk('span', 'pfk', k), bn, mk('span', 'pfsub', sub)); dl.appendChild(d); setTimeout(run, 150 + i * 120);
    });
    box.appendChild(dl);
    const today = new Date().toISOString().slice(0, 10), up = [];
    calcs.filter(x => x.h.status === 'open').forEach(x => x.r.dates.filter(d => d.kind !== 'basic' && d.date >= today).forEach(d => up.push({h: x.h, d})));
    up.sort((a, b) => a.d.date < b.d.date ? -1 : 1);
    if (up.length) {
      box.appendChild(mk('p', 'small', 'Upcoming key dates (each one is labeled with how we got it):'));
      const ul = mk('ul', 'small'); up.slice(0, 5).forEach(x => { const left = Math.ceil((parseD(x.d.date) - new Date()) / DAY); ul.appendChild(mk('li', '', x.d.date + ' · ' + x.h.state + (x.h.county ? ' ' + x.h.county : '') + ' ' + x.h.parcel + ' · ' + x.d.label + ' [' + KIND[x.d.kind][0] + '] · ' + left + ' days')); }); box.appendChild(ul);
    }
  }
  const parseD = d => new Date(d + 'T00:00:00');
  function card(h) {
    const s = st(h.state) || {n: h.state}, c = mk('article', 'scard pfcard pf-' + h.status);
    const head = mk('div', 'scardh'); head.append(mk('b', '', s.n + (h.county ? ' · ' + h.county : '') + (h.parcel ? ' · ' + h.parcel : '')), mk('span', 'sscore', {open: 'Open', redeemed: 'Redeemed', foreclosure: 'Foreclosure started', other: 'Closed'}[h.status]));
    c.appendChild(head);
    const holder = mk('div', 'pfcalc'); c.appendChild(holder);
    const draw = asOf => {
      holder.textContent = ''; const r = calcFor(h, asOf), closedAt = h.status !== 'open' && h.closed;
      holder.appendChild(mk('span', 'pfbadge ' + (r.verified ? 'ok' : 'basic'), r.verified ? r.label + ' (verified ' + r.verifiedOn + ')' : r.label));
      const res = mk('div', 'pfres'); const cell = (k, v, sub, cls) => { const d = mk('div', 'pfcell' + (cls ? ' ' + cls : '')); d.append(mk('span', 'pfk', k), mk('b', '', v)); if (sub) d.appendChild(mk('span', 'pfsub', sub)); res.appendChild(d); };
      const rateTxt = r.rateUsed == null ? 'Not entered' : (h.state === 'IA' ? '24% a year (2% a month, fixed)' : r.rateUsed + '% a year');
      cell('Invested', money(h.paid + (h.extra || 0)), h.extra ? 'includes ' + money(h.extra) + ' later taxes and fees' : 'what you paid');
      cell(h.state === 'FL' ? 'Bid rate' : h.state === 'AZ' ? 'Bid rate' : r.verified ? 'Rate' : 'Rate (you entered)', rateTxt, r.floorApplied ? '5% Florida minimum applies' : (r.monthsCharged != null ? r.monthsCharged + ' month' + (r.monthsCharged === 1 ? '' : 's') + ' of interest' : ''));
      cell(closedAt ? 'Interest earned' : 'Estimated interest', r.interest == null ? 'Need more info' : money(r.interest), (closedAt ? 'through ' : 'if redeemed on ') + r.asOf, r.interest == null ? 'warn' : '');
      cell(closedAt ? 'Total received (estimate)' : 'Projected redemption total', r.total == null ? 'Need more info' : money(r.total), 'amount + interest, not guaranteed', r.total == null ? 'warn' : 'strong');
      holder.appendChild(res);
      if (h.status === 'open') {
        const pr = mk('label', 'pfproj'); pr.append('Try another redemption date ', (() => { const i = mk('input'); i.type = 'date'; i.value = r.asOf; i.addEventListener('change', () => { if (i.value) draw(i.value); }); return i; })()); holder.appendChild(pr);
      }
      if (r.dates.length) {
        const ul = mk('ul', 'pfdates'); r.dates.slice().sort((a, b) => a.date < b.date ? -1 : 1).forEach(d => { const li = mk('li'), k = KIND[d.kind]; const top = mk('div', 'pfdtop'); top.append(mk('b', '', d.date), mk('span', 'pfk2 k-' + k[1], k[0])); li.append(top, mk('div', 'pfdl', d.label)); if (d.note) li.appendChild(mk('div', 'pfdn', d.note)); ul.appendChild(li); });
        holder.append(mk('p', 'pfsec', 'Key dates'), ul);
      }
      if (r.warnings.length) { const w = mk('div', 'pfwarn'); r.warnings.forEach(x => w.appendChild(mk('p', '', x))); holder.appendChild(w); }
      if (r.missing.length) { const m = mk('div', 'pfmiss'); m.appendChild(mk('b', '', 'Missing information for a more accurate estimate')); const ul = mk('ul'); r.missing.forEach(x => ul.appendChild(mk('li', '', x))); m.appendChild(ul); holder.appendChild(m); }
      const how = mk('details', 'pfhow'); how.appendChild(mk('summary', '', 'How this is calculated'));
      how.appendChild(mk('p', '', 'Method: ' + r.method + '.'));
      const ol = mk('ol'); r.steps.forEach(x => ol.appendChild(mk('li', '', x))); how.appendChild(ol);
      if (r.sources.length) { how.appendChild(mk('p', 'small', 'Official sources (statute text read on ' + r.verifiedOn + (r.edition ? '; ' + r.edition : '') + '):')); const ul = mk('ul', 'pfsrc'); r.sources.forEach(x => { const li = mk('li'), a = mk('a', '', x.label); a.href = x.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; li.appendChild(a); ul.appendChild(li); }); how.appendChild(ul); }
      else how.appendChild(mk('p', 'small', 'No official source is attached because this state\u2019s rules have not been verified here yet. Check the state page and the county tax collector.'));
      how.appendChild(mk('p', 'small pfnot', r.disclaimer)); holder.appendChild(how);
    };
    draw();
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
    const s = st($('state').value); if (!s) return; const R = LienCalc.RULES[$('state').value];
    $('rulebox').hidden = !R; $('monthswrap').hidden = !!R;
    if (R) {
      $('rulebox').textContent = ''; $('rulebox').append(mk('b', '', R.name + ': we use the state\u2019s own rules. '), R.method + '. Verified from the statute on ' + R.verifiedOn + '. The redemption period in months is not used for this state.');
      $('evlabel').firstChild.textContent = R.eventLabel + ' ';
      $('evhint').textContent = R.eventHint;
      $('ratelabel').firstChild.textContent = $('state').value === 'IA' ? 'Interest rate (Iowa is a fixed 2% a month, so this is not used) ' : 'Your winning bid rate (% a year) ';
      $('mhint').textContent = '';
    } else {
      $('evlabel').firstChild.textContent = 'Notice, tax deed application or foreclosure filed (date, optional) ';
      $('evhint').textContent = 'We have not verified this state\u2019s rules, so this date is only shown back to you. Confirm real deadlines with the county.';
      $('ratelabel').firstChild.textContent = 'Interest rate (% per year) ';
      $('mhint').textContent = 'Basic estimate only: ' + s.n + ' is not verified on PricePocketAsset yet. Our guide says: ' + s.red + (s.v ? ' (verify)' : '') + '. Type the number of months that applies to your lien, or leave it blank.';
    }
  }
  function openForm(h) {
    editing = h || null; $('form').hidden = false; $('ftitle').textContent = h ? 'Edit lien' : 'Add a lien'; $('msg').textContent = '';
    const v = h || {state: 'FL', county: '', parcel: '', paid: '', rate: '', bought: '', months: '', status: 'open', closed: '', notes: '', deedApplied: '', countyDeadline: '', extra: ''};
    $('state').value = v.state; $('county').value = v.county; $('parcel').value = v.parcel; $('paid').value = v.paid; $('rate').value = v.rate == null ? '' : v.rate; $('bought').value = v.bought; $('months').value = v.months == null ? '' : v.months; $('status').value = v.status; $('closed').value = v.closed || ''; $('notes').value = v.notes;
    $('deedApplied').value = v.deedApplied || ''; $('countyDeadline').value = v.countyDeadline || ''; $('extra').value = v.extra == null ? '' : v.extra;
    if (!h) { const s = st(v.state); if (s && s.m > 0 && !LienCalc.RULES[v.state]) $('months').value = s.m; if (s && s.r) $('rate').value = ''; }
    $('closedwrap').hidden = $('status').value === 'open'; hint();
    const sv = user.saved || []; $('fromwrap').hidden = !sv.length || !!h;
    if (sv.length) { $('from').textContent = ''; $('from').appendChild(new Option('Choose…', '')); sv.forEach((x, i) => $('from').appendChild(new Option(x.county + ' ' + x.parcel, String(i)))); }
    $('form').scrollIntoView({behavior: 'smooth'});
  }
  $('from').addEventListener('change', () => { const x = user.saved[+$('from').value]; if (!x) return; $('state').value = {'Palm Beach': 'FL', 'Larimer': 'CO', 'Pinal': 'AZ'}[x.county] || $('state').value; $('county').value = x.county; $('parcel').value = x.parcel; if (x.face != null && !$('paid').value) $('paid').value = x.face; const s = st($('state').value); if (s && s.m > 0 && !LienCalc.RULES[$('state').value]) $('months').value = s.m; hint(); });
  $('state').addEventListener('change', () => { hint(); if (!editing) { const s = st($('state').value); $('months').value = s && s.m > 0 && !LienCalc.RULES[$('state').value] ? s.m : ''; } });
  $('status').addEventListener('change', () => { $('closedwrap').hidden = $('status').value === 'open'; });
  $('addbtn').addEventListener('click', () => openForm(null));
  $('cancel').addEventListener('click', () => { $('form').hidden = true; });
  $('form').addEventListener('submit', async e => {
    e.preventDefault(); $('save').disabled = true; $('msg').textContent = 'Saving…';
    const h = {id: editing && editing.id, state: $('state').value, county: $('county').value.trim(), parcel: $('parcel').value.trim(), paid: $('paid').value.replace(/[$,]/g, ''), rate: $('rate').value, bought: $('bought').value, months: $('months').value, status: $('status').value, closed: $('status').value === 'open' ? '' : $('closed').value, notes: $('notes').value, deedApplied: $('deedApplied').value, countyDeadline: $('countyDeadline').value, extra: $('extra').value.replace(/[$,]/g, '')};
    const r = await post({action: 'pfSave', holding: h}); $('save').disabled = false;
    if (r.ok) { items = r.d.portfolio; $('form').hidden = true; render(); } else $('msg').textContent = r.d.error || 'Could not save.';
  });
  $('csv').addEventListener('click', () => {
    const q = v => { let s = String(v == null ? '' : v); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
    // The first 12 columns are unchanged so older spreadsheets keep working. "Est. end of redemption" is only filled for basic estimates; verified states leave it blank because their dates are listed in the new columns.
    const rows = [['State', 'County', 'Parcel', 'Paid', 'Rate %', 'Bought', 'Redemption months', 'Est. end of redemption', 'Status', 'Closed', 'Est. interest', 'Notes', 'Calculation basis', 'Rules verified on', 'Projected redemption total', 'Key dates (how we got them)', 'Missing information', 'Tax deed / foreclosure / notice date', 'County-confirmed deadline', 'Later taxes and fees']].concat(items.map(h => {
      const r = calcFor(h), basic = r.dates.find(d => d.kind === 'basic');
      return [h.state, h.county, h.parcel, h.paid, h.rate, h.bought, h.months, basic ? basic.date : '', h.status, h.closed, r.interest == null ? '' : r.interest.toFixed(2), h.notes,
        r.verified ? r.label : 'Basic estimate (rules not verified)', r.verifiedOn || '', r.total == null ? '' : r.total.toFixed(2),
        r.dates.map(d => d.date + ' ' + d.label + ' [' + KIND[d.kind][0] + ']').join(' | '), r.missing.join(' | '), h.deedApplied || '', h.countyDeadline || '', h.extra == null ? '' : h.extra];
    }));
    const a = mk('a'); a.href = URL.createObjectURL(new Blob([rows.map(r => r.map(q).join(',')).join('\n')], {type: 'text/csv'})); a.download = 'my-portfolio.csv'; a.click();
  });
  (function () { const g = $('pfgreet'), h = new Date().getHours(); g.textContent = (h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening') + ' \u00b7 here is where your liens stand'; })();
  fetch(API).then(r => r.json()).then(d => { user = d.user; if (!user) { $('gate').hidden = false; return; } items = user.portfolio || []; $('app').hidden = false; render(); }).catch(() => { $('gate').hidden = false; });
})();
