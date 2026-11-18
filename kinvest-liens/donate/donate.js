// Donate page: pick an amount, go to Stripe Checkout (created on the server, amount checked there too).
(function () {
  'use strict';
  const $ = id => document.getElementById(id), mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  if (/[?&]thanks=1/.test(location.search)) $('dnThanks').hidden = false;
  const PRE = [5, 10, 25, 50]; let amt = 10, custom = false, off = false; { const q = parseInt((location.search.match(/[?&]amount=(\d+)/) || [])[1], 10); if (PRE.includes(q)) amt = q; } const box = $('dnAmts'), go = $('dnGo'), other = $('dnOther'), msg = $('dnMsg');
  const val = () => custom ? parseFloat(String(other.value).replace(/[$,\s]/g, '')) : amt, valid = v => Number.isFinite(v) && v >= 1 && v <= 500;
  const fmt = v => '$' + (Math.round(v * 100) % 100 ? v.toFixed(2) : String(Math.round(v)));
  function paint() { box.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(!custom && +b.dataset.a === amt))); const v = val(); go.textContent = valid(v) ? 'Donate ' + fmt(v) + ' with Stripe' : 'Donate with Stripe'; go.disabled = off || !valid(v) || !$('dnOk').checked; }
  PRE.forEach(a => { const b = mk('button', 'dn-amt', '$' + a); b.type = 'button'; b.dataset.a = a; b.addEventListener('click', () => { amt = a; custom = false; other.value = ''; msg.hidden = true; paint(); }); box.appendChild(b); });
  $('dnOk').addEventListener('change', () => { msg.hidden = true; paint(); });
  other.addEventListener('input', () => { custom = other.value.trim() !== ''; msg.hidden = true; paint(); });
  go.addEventListener('click', async () => {
    const v = val(); if (!valid(v) || !$('dnOk').checked) return; go.disabled = true; go.textContent = 'Opening Stripe…'; msg.hidden = true;
    try { const r = await fetch('/.netlify/functions/donate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: v, ack: { optional: true, version: '2026-11-18' } }) }); const d = await r.json().catch(() => ({})); if (r.ok && d.url && /^https:\/\/checkout\.stripe\.com\//.test(d.url)) { location.href = d.url; return; } msg.textContent = d.error || 'Something went wrong. Please try again.'; }
    catch (e) { msg.textContent = 'Could not reach the server. Check your connection and try again.'; }
    msg.hidden = false; paint();
  });
  fetch('/.netlify/functions/donate').then(r => r.json()).then(d => { if (d && d.configured === false) { off = true; go.disabled = true; msg.textContent = 'Online donations are not switched on yet. Please check back soon.'; msg.hidden = false; } }).catch(() => {});
  paint();
})();
