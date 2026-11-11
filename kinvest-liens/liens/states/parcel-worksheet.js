// Bid or Pass worksheet. Private to the signed-in member (saved by /.netlify/functions/watch under the member's own key).
// Verified facts are prefilled from the listing, with source and date. Anything we cannot verify is left blank for the member's own,
// clearly labelled estimate. When the county changes a number a saved worksheet used, we flag it and the member reviews it first.
PF.isLien = l => { const s = (typeof STATES !== 'undefined' ? STATES : []).find(x => x.a === (l.state || 'FL')); return !!(l.cert || l.rate) || !!(s && /lien/i.test(s.sys || '')); };
PF.liveVals = l => ({amount: l.amount == null ? null : Number(l.amount), payoff: l.payoff == null ? null : Number(l.payoff), saleDate: l.saleDate || '', status: l.status || ''});
PF.FIELD_LABEL = {amount: 'Amount owed (advertised)', payoff: 'Payoff', saleDate: 'Sale date', status: 'Status'};
PF.CHECKS = [
  {id: 'access', title: 'Legal access', why: 'A lot with no recorded road or easement can be landlocked even if a road is nearby.', research: 'road'},
  {id: 'zoning', title: 'Zoning', why: 'Zoning decides what can be built. Ask the county planning office.', research: 'zoning'},
  {id: 'wetlands', title: 'Wetlands', why: 'Mapped wetlands can block or limit building.', research: 'wetlands'},
  {id: 'flood', title: 'Flood zone', why: 'A high-risk flood zone can mean required insurance and building limits.', research: 'flood'},
  {id: 'hoa', title: 'HOA and deed restrictions', why: 'Dues, special assessments and building rules can add cost or limit use.', hoa: true},
  {id: 'title', title: 'Title and other liens', why: 'Check for mortgages, IRS or other liens and what a tax sale does and does not clear in this state.'},
  {id: 'taxes', title: 'Back taxes and what you must pay at or after the sale', why: 'Confirm what is owed beyond the listed amount.'},
  {id: 'condition', title: 'Occupancy and condition', why: 'Drive by or use imagery. Buildings may be occupied or need demolition.'}
];

PF.worksheet = async function (host, l) {
  const mk = PF.mk, key = PF.key(l), lien = PF.isLien(l), live = PF.liveVals(l);
  host.textContent = ''; host.appendChild(mk('h2', '', 'Bid or Pass worksheet'));
  if (l.priceLabel === 'Sold for') host.appendChild(mk('p', 'notice', 'This parcel already sold at auction. The worksheet is for practice; it is not open to bid.'));
  host.appendChild(mk('p', 'small muted', 'Private to you. Facts from the county listing are filled in with their source; everything you type is your own estimate and is labelled that way. Not advice: it is arithmetic on the numbers you choose.'));
  await PF.load();
  let sheet = null;
  if (PF.user) { const r = await PF.api('wsGet&key=' + encodeURIComponent(key)); sheet = r.d.sheet || null; }
  const S = sheet || {decision: '', maxBid: null, budget: null, notes: '', est: {}, checks: {}, snap: Object.assign({at: new Date().toISOString().slice(0, 10)}, live), months: null, rateUser: null};
  S.est = S.est || {}; S.checks = S.checks || {};
  const snap = S.snap;   // the verified values this worksheet's maths uses until the member reviews a change
  // ---- source-change flags
  const diffs = ['amount', 'payoff', 'saleDate', 'status'].filter(f => (snap[f] == null ? null : snap[f]) !== (live[f] == null ? null : live[f]) && !(snap[f] == null && live[f] == null) && !(snap[f] === '' && !live[f]));
  if (sheet && diffs.length) {
    const b = mk('div', 'notice pfws-change'); b.setAttribute('role', 'alert');
    b.appendChild(mk('b', '', 'The county changed a number used in your worksheet. '));
    b.append('Your calculation still uses the older value until you review it.');
    const ul = mk('ul', 'small'); diffs.forEach(f => { const fmt = v => v == null || v === '' ? 'not listed' : (f === 'amount' || f === 'payoff') ? PF.money(v) : v; ul.appendChild(mk('li', '', PF.FIELD_LABEL[f] + ': ' + fmt(snap[f]) + ' → ' + fmt(live[f]))); });
    b.appendChild(ul); const ub = mk('button', 'btn small', 'I reviewed it: update my calculation'); ub.type = 'button';
    ub.addEventListener('click', () => { Object.assign(S.snap, live, {at: new Date().toISOString().slice(0, 10)}); save(true).then(() => PF.worksheet(host, l)); }); b.appendChild(ub); host.appendChild(b);
  }
  // ---- verified facts
  const facts = mk('dl', 'pfws-facts'); const add = (k, v, src) => { if (v === '' || v == null) return; facts.append(mk('dt', '', k), mk('dd', '', v + (src ? '' : ''))); };
  const sold = l.priceLabel === 'Sold for';
  add(sold ? 'Actual sale price (published results)' : PF.amountLabel(l) + ' (county list)', snap.amount != null ? PF.money(snap.amount) : '');
  add('Payoff on the list date', snap.payoff != null ? PF.money(snap.payoff) : '');
  add('Sale', snap.saleDate); add('Status on the list', snap.status);
  add('Interest rate (county list)', l.rate ? l.rate : ''); add('Acres', l.acres != null ? String(l.acres) : '');
  add('County value', l.market != null ? PF.money(l.market).replace('.00', '') : ''); add('Use', l.use || '');
  const fsrc = mk('p', 'small muted', 'Source: ' + (l.source && /^https?:/.test(l.source) ? '' : (l.source || 'county list')) + (l.checked ? ' (checked ' + l.checked + ')' : '')); if (l.source && /^https?:/.test(l.source)) { const a = mk('a', '', 'county list'); a.href = l.source; a.target = '_blank'; a.rel = 'noopener noreferrer'; fsrc.insertBefore(a, fsrc.firstChild.nextSibling); fsrc.firstChild.textContent = 'Source: '; }
  host.append(facts, fsrc);
  // ---- decision, max bid, budget
  const form = mk('div', 'pfws-form');
  const row = (label, el, hint) => { const w = mk('label', 'pfws-row'); w.appendChild(mk('span', '', label)); w.appendChild(el); if (hint) w.appendChild(mk('small', 'muted', hint)); return w; };
  const numIn = (get, set, ph) => { const i = mk('input'); i.type = 'number'; i.inputMode = 'decimal'; i.min = '0'; i.step = 'any'; i.placeholder = ph || ''; i.value = get() == null ? '' : get(); i.addEventListener('input', () => { set(i.value === '' ? null : Number(i.value)); recalc(); save(); }); return i; };
  const dec = mk('div', 'pfws-dec'); dec.setAttribute('role', 'radiogroup'); dec.setAttribute('aria-label', 'Decision');
  ['Bid', 'Needs Research', 'Pass'].forEach(d => { const b = mk('button', 'btn small ' + (S.decision === d ? '' : 'ghost'), d); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(S.decision === d));
    b.addEventListener('click', () => { S.decision = S.decision === d ? '' : d; dec.querySelectorAll('button').forEach(x => { const on = x.textContent === S.decision; x.className = 'btn small ' + (on ? '' : 'ghost'); x.setAttribute('aria-checked', String(on)); }); save(); }); dec.appendChild(b); });
  form.append(mk('p', 'small', 'My decision'), dec);
  form.appendChild(row('My maximum bid ($)', numIn(() => S.maxBid, v => { S.maxBid = v; }, 'Your own number'), 'Your limit, not a recommendation.'));
  form.appendChild(row('My total budget ($)', numIn(() => S.budget, v => { S.budget = v; }, 'Optional'), ''));
  host.appendChild(form);
  // ---- calculations
  const calc = mk('div', 'pfws-calc'); host.appendChild(calc);
  const E = k => S.est[k] == null ? null : Number(S.est[k]);
  const est = (label, k, hint) => form.appendChild(row(label, numIn(() => S.est[k], v => { S.est[k] = v; }, 'Your estimate'), hint)); // appended to costs box below
  const costs = mk('div', 'pfws-form'); host.insertBefore(costs, calc);
  const cin = (label, k, hint) => costs.appendChild(row(label, numIn(() => S.est[k], v => { S.est[k] = v; }, 'Your estimate'), hint));
  if (lien) {
    costs.appendChild(mk('h3', '', 'Lien return estimate'));
    const lr = parseFloat(String(l.rate || '').replace('%', '')); const hasRate = isFinite(lr) && lr > 0;
    costs.appendChild(mk('p', 'small muted', hasRate ? 'Interest rate: ' + lr + '% a year, from the county list. Interest is shown as simple interest. State minimum-interest rules and county fees are not applied unless you enter them below.' : 'We do not have a verified interest rate for this parcel, so nothing is projected until you enter your own estimate below (labelled as yours).'));
    if (!hasRate) cin('My interest rate estimate (% a year)', 'rate', 'Look up the rate for this sale and enter it.');
    cin('Amount I would invest ($)', 'invest', snap.amount != null ? 'Blank = the amount owed on the list (' + PF.money(snap.amount) + ').' : 'No amount on the list: enter yours.');
    cin('Premium above the amount owed ($)', 'premium', 'Some states let bidders pay a premium. We assume it earns no interest and is not returned.');
    cin('Fees I expect to pay ($)', 'fees', 'Purchase, recording or other fees you have confirmed.');
    cin('Another redemption date, in months', 'months', 'Optional: adds a column.');
  } else {
    costs.appendChild(mk('h3', '', 'Full cost estimate'));
    costs.appendChild(mk('p', 'small muted', 'Tax deeds are bought with the bid plus costs. Enter what you expect; we add them up and show the room left in your budget. Blank means unknown, not zero.'));
    cin('Bid ($)', 'bid', S.maxBid != null ? 'Blank = your maximum bid.' : ''); cin('Auction or buyer’s fees ($)', 'fees', ''); cin('Recording fees ($)', 'rec', ''); cin('Title work ($)', 'title', ''); cin('Any other costs ($)', 'other', 'Back taxes you must pay, cleanup, legal, insurance.');
  }
  function recalc() {
    calc.textContent = '';
    if (lien) {
      const lr = parseFloat(String(l.rate || '').replace('%', '')), listed = isFinite(lr) && lr > 0, rate = listed ? lr : E('rate');
      const face = E('invest') != null ? E('invest') : snap.amount, prem = E('premium') || 0, fees = E('fees') || 0;
      if (face == null || rate == null) { calc.appendChild(mk('p', 'muted', face == null ? 'No amount to invest yet.' : 'Enter a rate estimate to see redemption proceeds.')); return; }
      const cash = face + prem + fees;
      const t = mk('table', 'pfws-tbl'); const ms = [3, 6, 12, 24]; if (E('months') && !ms.includes(E('months'))) ms.push(E('months')); ms.sort((a, b) => a - b);
      const hr = t.createTHead().insertRow(); hr.appendChild(mk('th', '', '')); ms.forEach(m => hr.appendChild(mk('th', '', 'At ' + m + ' mo')));
      const rows = [['Redemption proceeds', m => face + face * rate / 100 * m / 12], ['Total return', m => face + face * rate / 100 * m / 12 - cash], ['Annualized return', m => (face * rate / 100 * m / 12 - prem - fees) / cash * 12 / m * 100]];
      const tb = t.createTBody(); rows.forEach((r, i) => { const tr = tb.insertRow(); tr.appendChild(mk('th', '', r[0])); ms.forEach(m => { const v = r[1](m); tr.appendChild(mk('td', '', i === 2 ? v.toFixed(1) + '%' : PF.money(v))); }); });
      const sum = mk('dl', 'pfws-facts'); sum.append(mk('dt', '', 'Amount invested'), mk('dd', '', PF.money(face)), mk('dt', '', 'Estimated cash tied up'), mk('dd', '', PF.money(cash) + (prem || fees ? ' (amount + premium + fees)' : '')));
      calc.append(sum, t, mk('p', 'small muted', 'Assumptions: ' + rate + '% a year ' + (listed ? '(county list)' : '(your estimate)') + ', simple interest on ' + PF.money(face) + (prem ? '; premium ' + PF.money(prem) + ' assumed not returned' : '') + (fees ? '; fees ' + PF.money(fees) : '') + '. The owner can redeem at any time, and the sale may not complete. Returns are before taxes and are not guaranteed.'));
      const ca = mk('a', 'btn small ghost', 'Open the full calculator'); ca.href = '/?' + new URLSearchParams({amount: face, rate: String(rate), months: 12, fees: fees, from: l.county + ' parcel ' + l.parcel}).toString() + '#calculator'; calc.appendChild(ca);
    } else {
      const bid = E('bid') != null ? E('bid') : S.maxBid; const parts = [['Bid', bid], ['Auction or buyer’s fees', E('fees')], ['Recording fees', E('rec')], ['Title work', E('title')], ['Other costs', E('other')]];
      if (parts.every(p => p[1] == null)) { calc.appendChild(mk('p', 'muted', 'Enter a bid and any costs to see the total.')); return; }
      const total = parts.reduce((a, p) => a + (p[1] || 0), 0); const dl = mk('dl', 'pfws-facts');
      parts.forEach(p => dl.append(mk('dt', '', p[0]), mk('dd', '', p[1] == null ? 'not entered' : PF.money(p[1]))));
      dl.append(mk('dt', '', 'Estimated full cost'), mk('dd', 'pfws-total', PF.money(total)));
      if (S.budget != null) { const left = S.budget - total; dl.append(mk('dt', '', 'Room left under my budget'), mk('dd', left < 0 ? 'pfws-over' : 'pfws-total', (left < 0 ? 'Over by ' + PF.money(-left) : PF.money(left)))); }
      calc.append(dl, mk('p', 'small muted', 'Costs you did not enter are left out of the total. ' + (sold ? 'This parcel already sold at auction for ' + PF.money(snap.amount) + ' (actual price), so use this sheet to learn from it, not to bid.' : 'Amounts owed on the listing (' + (snap.amount != null ? PF.money(snap.amount) : 'none listed') + ') may or may not be payable by a buyer: confirm with the county.')));
    }
  }
  // ---- research checklist
  const ck = mk('div', 'pfws-ck'); host.appendChild(ck); ck.appendChild(mk('h3', '', 'Research checklist'));
  let found = {}; try { if (typeof LienResearch !== 'undefined') LienResearch.items(l).forEach(i => { found[i.key] = i; }); } catch (e) { found = {}; }
  const recLink = (typeof PARCEL_MAPS !== 'undefined' && PARCEL_MAPS[l.county] && PARCEL_MAPS[l.county].page) ? [PARCEL_MAPS[l.county].pageName || 'County property record', PARCEL_MAPS[l.county].page(l.parcel)] : null;
  PF.CHECKS.forEach(c => {
    const st = S.checks[c.id] || (S.checks[c.id] = {done: false, note: ''}); const w = mk('div', 'pfws-item');
    const lb = mk('label', 'pfws-cb'); const cb = mk('input'); cb.type = 'checkbox'; cb.checked = !!st.done; cb.addEventListener('change', () => { st.done = cb.checked; save(); }); lb.append(cb, ' ', mk('b', '', c.title)); w.appendChild(lb); w.appendChild(mk('p', 'small muted', c.why));
    let fi = c.research && found[c.research] && found[c.research].finding; if (c.hoa && typeof HoaData !== 'undefined' && (l.state || 'FL') === 'FL') { try { fi = (HoaData.LABEL && HoaData.LABEL[HoaData.statusNow(l)]) || ''; } catch (e) {} }
    if (fi) w.appendChild(mk('p', 'small', 'From our parcel data: ' + fi));
    const lk = mk('p', 'small'); const adds = [];
    if (c.research && found[c.research] && found[c.research].lookup && found[c.research].lookup.href) adds.push([found[c.research].lookup.text || 'Look it up', found[c.research].lookup.href]);
    if (['title', 'taxes', 'access', 'condition'].includes(c.id) && recLink) adds.push(recLink);
    if (c.id === 'hoa' || c.id === 'wetlands' || c.id === 'flood' || c.id === 'zoning') adds.push(['Parcel map and Land Information', PF.href(l) + '#map']);
    adds.forEach((a, i) => { const x = mk('a', '', a[0]); x.href = a[1]; if (/^https?:/.test(a[1])) { x.target = '_blank'; x.rel = 'noopener noreferrer'; } lk.append(i ? ' · ' : 'Links: ', x); }); if (adds.length) w.appendChild(lk);
    const ni = mk('input'); ni.type = 'text'; ni.maxLength = 300; ni.placeholder = 'My note'; ni.value = st.note || ''; ni.setAttribute('aria-label', 'Note: ' + c.title); ni.addEventListener('input', () => { st.note = ni.value; save(); }); w.appendChild(ni); ck.appendChild(w);
  });
  const notes = mk('textarea'); notes.rows = 4; notes.maxLength = 2000; notes.placeholder = 'My notes (private)'; notes.value = S.notes || ''; notes.setAttribute('aria-label', 'Notes'); notes.addEventListener('input', () => { S.notes = notes.value; save(); });
  host.appendChild(mk('h3', '', 'Notes')); host.appendChild(notes);
  const foot = mk('div', 'pfws-foot'); const status = mk('span', 'small muted', PF.user ? (sheet ? 'Saved ' + (sheet.updated || '').slice(0, 10) : 'Not saved yet. Changes save automatically.') : 'Sign in to save this worksheet.'); status.setAttribute('role', 'status');
  const del = mk('button', 'btn small ghost', 'Delete worksheet'); del.type = 'button'; del.hidden = !sheet; del.addEventListener('click', async () => { if (!confirm('Delete this worksheet?')) return; await PF.api('wsDelete', {key}); PF.worksheet(host, l); });
  foot.append(status, del); host.appendChild(foot);
  let timer = null, dirty = false;
  async function save(now) {
    if (!PF.user) { dirty = true; status.textContent = 'Sign in to save this worksheet.'; if (now) PF.toLogin(); return; }
    clearTimeout(timer); const go = async () => { status.textContent = 'Saving…'; const r = await PF.api('wsSave', {key, sheet: S}); status.textContent = r.d.ok ? 'Saved' : (r.d.error || 'Could not save.'); if (r.d.ok) { sheet = r.d.sheet; del.hidden = false; } };
    if (now) return go(); timer = setTimeout(go, 700);
  }
  if (!PF.user) { const a = mk('a', 'btn small', 'Sign in to save'); a.href = '/login/?next=' + encodeURIComponent(location.pathname + location.search); foot.insertBefore(a, del); }
  recalc();
};
