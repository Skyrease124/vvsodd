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
$('calc').addEventListener('input', calc);
$('calc').addEventListener('submit', e => e.preventDefault());
calc();

// Lead form: no backend yet. Replace the stub below with a real endpoint.
$('lead').addEventListener('submit', e => {
  e.preventDefault();
  $('lead-msg').textContent = 'Thanks! You\'re on the list (demo mode: connect a backend to store signups).';
  e.target.reset();
});
$('yr').textContent = new Date().getFullYear();
