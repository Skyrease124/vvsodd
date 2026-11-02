const $ = id => document.getElementById(id);
const usd = n => n.toLocaleString('en-US', {style:'currency', currency:'USD', maximumFractionDigits:0});

function calc() {
  const a = Math.max(0, +$('amount').value || 0);
  const r = Math.max(0, +$('rate').value || 0) / 100;
  const m = Math.max(1, +$('months').value || 1);
  const f = Math.max(0, +$('fees').value || 0);
  const interest = a * r * (m / 12);
  const net = interest - f;
  const apr = a > 0 ? (net / a) * (12 / m) * 100 : 0;
  $('r-int').textContent = usd(interest);
  $('r-tot').textContent = usd(a + interest);
  $('r-net').textContent = usd(net);
  $('r-apr').textContent = apr.toFixed(1) + '%';
}
if ($('calc')) {
  const qs = new URLSearchParams(location.search);
  ['amount', 'rate', 'months', 'fees'].forEach(k => { const v = parseFloat(qs.get(k)); if ($(k) && isFinite(v) && v >= 0) $(k).value = v; });
  if (qs.get('from')) {
    const n = document.createElement('p'); n.className = 'notice';
    n.textContent = 'Prefilled from ' + qs.get('from').slice(0, 200) + '. The real purchase price, interest and timing can differ. Confirm with the county tax collector. Estimate only, not advice.';
    $('calc').before(n);
  }
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
