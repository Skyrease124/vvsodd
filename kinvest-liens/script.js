const $ = id => document.getElementById(id);
const usd = n => n.toLocaleString('en-US', {style:'currency', currency:'USD', maximumFractionDigits:0});

function calc() {
  const a = Math.max(0, +$('amount').value || 0);
  const r = Math.max(0, +$('rate').value || 0) / 100;
  const f = Math.max(0, +$('fees').value || 0);
  const stt = $('cstate') ? $('cstate').value : '';
  const det = $('cdetail');
  if (stt && typeof LienCalc !== 'undefined' && LienCalc.verified(stt)) {
    // State-specific rules (statute text read; see the "How this is calculated" panel).
    const bought = $('cbought').value, redeem = $('credeem').value, R = LienCalc.RULES[stt];
    const e = LienCalc.estimate({state: stt, paid: a, rate: $('rate').value, bought, deedApplied: $('cevent').value, status: 'open'}, redeem ? {asOf: redeem} : {});
    const interest = e.interest == null ? 0 : e.interest, net = interest - f;
    const days = bought && redeem ? Math.max(1, (new Date(redeem) - new Date(bought)) / 864e5) : 0;
    $('r-int').textContent = e.interest == null ? 'Need more info' : usd2(interest);
    $('r-tot').textContent = e.total == null ? 'Need more info' : usd2(e.total);
    $('r-net').textContent = e.interest == null ? 'Need more info' : usd2(net);
    $('r-apr').textContent = e.interest != null && a > 0 && days ? ((net / a) * (365 / days) * 100).toFixed(1) + '%' : 'n/a';
    renderDetail(det, e, R);
    return;
  }
  if (det) det.textContent = '';
  const m = Math.max(1, +$('months').value || 1);
  const interest = a * r * (m / 12);
  const net = interest - f;
  const apr = a > 0 ? (net / a) * (12 / m) * 100 : 0;
  $('r-int').textContent = usd(interest);
  $('r-tot').textContent = usd(a + interest);
  $('r-net').textContent = usd(net);
  $('r-apr').textContent = apr.toFixed(1) + '%';
}
const usd2 = n => n.toLocaleString('en-US', {style:'currency', currency:'USD', minimumFractionDigits:2, maximumFractionDigits:2});
const KINDS = {statute: 'Calculated from the statute', estimate: 'Estimate', user: 'Entered by you', county: 'Confirmed by the county (you entered it)', basic: 'Basic estimate, not a legal deadline'};
function renderDetail(box, e, R) {
  box.textContent = '';
  const mk = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
  box.appendChild(mk('p', 'cbadge', e.label + ' (verified ' + e.verifiedOn + '). Method: ' + e.method + '.'));
  if (e.warnings.length) { const w = mk('div', 'cwarn'); e.warnings.forEach(x => w.appendChild(mk('p', '', x))); box.appendChild(w); }
  if (e.dates.length) { box.appendChild(mk('h3', '', 'Key dates')); const ul = mk('ul', 'cdl'); e.dates.slice().sort((x, y) => x.date < y.date ? -1 : 1).forEach(d => { const li = mk('li'); li.append(mk('b', '', d.date), mk('span', 'ck k-' + d.kind, KINDS[d.kind]), mk('div', '', d.label)); if (d.note) li.appendChild(mk('small', '', d.note)); ul.appendChild(li); }); box.appendChild(ul); }
  if (e.missing.length) { const m = mk('div', 'cmiss'); m.appendChild(mk('b', '', 'Missing information for a more accurate estimate')); const ul = mk('ul'); e.missing.forEach(x => ul.appendChild(mk('li', '', x))); m.appendChild(ul); box.appendChild(m); }
  const how = mk('details', 'chow'); how.appendChild(mk('summary', '', 'How this is calculated'));
  const ol = mk('ol'); e.steps.forEach(x => ol.appendChild(mk('li', '', x))); how.appendChild(ol);
  how.appendChild(mk('p', '', 'Official sources (statute text read on ' + e.verifiedOn + '):'));
  const ul = mk('ul'); e.sources.forEach(x => { const li = mk('li'), a = mk('a', '', x.label); a.href = x.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; li.appendChild(a); ul.appendChild(li); }); how.appendChild(ul);
  how.appendChild(mk('p', 'cnot', e.disclaimer)); box.appendChild(how);
}
function syncCalcMode() {
  const stt = $('cstate').value, ver = stt && typeof LienCalc !== 'undefined' && LienCalc.verified(stt);
  $('cdates').hidden = !ver; $('cmwrap').hidden = !!ver;
  if (ver) {
    const R = LienCalc.RULES[stt]; $('cevlabel').firstChild.textContent = R.eventLabel.replace(' (date)', ' (optional)');
    $('crlabel').firstChild.textContent = stt === 'IA' ? 'Interest rate (Iowa is a fixed 2% a month, not used)' : 'Your winning bid rate (% a year)';
    if (!$('cbought').value) $('cbought').value = new Date().toISOString().slice(0, 10);
  } else $('crlabel').firstChild.textContent = 'Annual interest rate (%)';
}
if ($('calc')) {
  const qs = new URLSearchParams(location.search);
  ['amount', 'rate', 'months', 'fees'].forEach(k => { const v = parseFloat(qs.get(k)); if ($(k) && isFinite(v) && v >= 0) $(k).value = v; });
  if (qs.get('from')) {
    const n = document.createElement('p'); n.className = 'notice';
    n.textContent = 'Prefilled from ' + qs.get('from').slice(0, 200) + '. The real purchase price, interest and timing can differ. Confirm with the county tax collector. Estimate only, not advice.';
    $('calc').before(n);
  }
  if ($('cstate')) { const sp = qs.get('state'); if (sp && ['FL','AZ','IA'].includes(sp.toUpperCase())) $('cstate').value = sp.toUpperCase(); $('cstate').addEventListener('change', () => { syncCalcMode(); calc(); }); syncCalcMode(); }
  $('calc').addEventListener('input', calc);
  $('calc').addEventListener('submit', e => e.preventDefault());
  calc();
}

// Lead form: submitted to Netlify Forms.
if ($('lead')) $('lead').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target, msg = $('lead-msg');
  msg.textContent = 'Sending...';
  try {
    const res = await fetch('/', {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams(new FormData(form)).toString()
    });
    if (!res.ok) throw new Error(res.status);
    msg.textContent = "Thanks! You're on the list.";
    form.reset();
  } catch (err) {
    msg.textContent = 'Sorry, something went wrong. Please try again.';
  }
});
$('yr').textContent = new Date().getFullYear();
