(function () {
  const $ = id => document.getElementById(id);
  const API = '/.netlify/functions/account';
  let mode = 'in';
  function setMode(m) {
    mode = m; $('tabin').className = 'btn' + (m === 'in' ? '' : ' ghost'); $('tabup').className = 'btn' + (m === 'up' ? '' : ' ghost');
    $('go').textContent = m === 'in' ? 'Sign in' : 'Create account'; $('pwhint').hidden = m === 'in';
    $('pw').autocomplete = m === 'in' ? 'current-password' : 'new-password'; $('msg').textContent = '';
  }
  let billing = null;
  async function billingPost(action) { const r = await fetch('/.netlify/functions/billing', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action})}); return {ok: r.ok, d: await r.json()}; }
  async function go(action, btn) {
    btn.disabled = true; $('planmsg').textContent = 'One moment\u2026';
    const r = await billingPost(action);
    if (r.ok && r.d.url) { location.href = r.d.url; return; }
    $('planmsg').textContent = r.d.error || 'Something went wrong.'; btn.disabled = false;
  }
  $('upgrade').addEventListener('click', () => go('checkout', $('upgrade')));
  $('manage').addEventListener('click', () => go('portal', $('manage')));
  function planButtons(user) {
    const subOn = user.sub && ['active', 'trialing', 'past_due'].includes(user.sub.status);
    $('planbtns').hidden = true;
    if (user.owner || !billing || !billing.configured) return;
    $('planbtns').hidden = false;
    $('upgrade').hidden = !!(subOn && !user.sub.cancelAtPeriodEnd);
    $('manage').hidden = !user.hasCustomer;
    if (user.sub && user.sub.cancelAtPeriodEnd && user.sub.periodEnd) $('planmsg').textContent = 'Your membership is set to end on ' + user.sub.periodEnd + '. You keep access until then.';
    else if (user.sub && user.sub.status === 'past_due') $('planmsg').textContent = 'Your last payment did not go through. Use Manage billing to update your card.';
    if (billing.mode === 'test') $('planmsg').textContent += ' (Test mode: no real money moves. Use card 4242 4242 4242 4242.)';
  }
  fetch('/.netlify/functions/billing').then(r => r.json()).then(b => { billing = b; if (window.__ppUser) planButtons(window.__ppUser); }).catch(() => {});
  if (new URLSearchParams(location.search).get('paid') === '1') {
    (async () => { $('planmsg').textContent = 'Payment received. Switching you on\u2026'; for (let i = 0; i < 4; i++) { const r = await billingPost('sync'); if (r.ok && r.d.paid) { location.replace('./'); return; } await new Promise(x => setTimeout(x, 2500)); } $('planmsg').textContent = 'Payment received. It can take a minute to show. Refresh this page in a moment.'; })();
  }
  function show(user) {
    window.__ppUser = user; if (user && billing) planButtons(user);
    $('out').hidden = !!user; $('in').hidden = !user; if (!user) return;
    const today = new Date().toISOString().slice(0, 10), paid = user.owner || (user.paidThrough && user.paidThrough >= today);
    $('plantext').textContent = user.owner ? 'Owner: AI tools are on.' : paid ? 'Paid member through ' + user.paidThrough + '. The AI question box and screener are on.' : (user.paidThrough ? 'Your paid time ended on ' + user.paidThrough + '. ' : 'Free account. ') + 'The AI question box and screener are locked. Paid members ($5.50 a week) can use them. ';
    $('who').textContent = user.email; $('ownbadge').hidden = !user.owner; $('ownlink').hidden = !!user.owner; $('ownerbtns').hidden = !user.owner;
    const ul = $('saved'); ul.textContent = '';
    if (!user.saved.length) { const li = document.createElement('li'); li.textContent = 'Nothing saved yet.'; ul.appendChild(li); }
    user.saved.forEach(s => {
      const li = document.createElement('li'); li.style.cssText = 'display:block;border-radius:10px;margin:6px 0;padding:10px';
      const a = document.createElement('a'); a.href = '../liens/states/county/?c=' + encodeURIComponent(s.county); a.textContent = s.county + ' parcel ' + s.parcel;
      const t = document.createElement('span'); t.className = 'small muted'; t.textContent = ' · ' + [s.use && s.use.toLowerCase(), s.acres != null && s.acres + ' acres', s.market != null && 'county value $' + Math.round(s.market).toLocaleString('en-US'), s.face != null && 'debt $' + s.face.toFixed(2)].filter(Boolean).join(', ') + ' ';
      const b = document.createElement('button'); b.className = 'btn small ghost'; b.type = 'button'; b.textContent = 'Remove';
      b.addEventListener('click', async () => { const r = await post({action: 'unsave', parcel: s.parcel}); if (r.ok) { user.saved = r.d.saved; show(user); } });
      li.append(a, t, b); ul.appendChild(li);
    });
  }
  async function post(o) { try { const r = await fetch(API, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(o)}); return {ok: r.ok, d: await r.json()}; } catch (e) { return {ok: false, d: {error: 'Could not reach the server. Try again.'}}; } }
  $('eye').addEventListener('click', () => {
    const show = $('pw').type === 'password'; $('pw').type = show ? 'text' : 'password';
    $('eyeon').style.display = show ? 'none' : ''; $('eyeoff').style.display = show ? '' : 'none'; $('eye').setAttribute('aria-pressed', String(show)); $('eye').setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });
  $('tabin').addEventListener('click', () => setMode('in')); $('tabup').addEventListener('click', () => setMode('up'));
  $('form').addEventListener('submit', async e => {
    e.preventDefault(); $('go').disabled = true; $('msg').textContent = 'One moment…';
    const r = await post({action: mode === 'in' ? 'login' : 'signup', email: $('email').value, password: $('pw').value, ownerCode: ''});
    $('go').disabled = false;
    if (r.ok) { $('pw').value = ''; $('pw').type = 'password'; $('eyeon').style.display = ''; $('eyeoff').style.display = 'none'; show(r.d.user); } else $('msg').textContent = r.d.error || 'Something went wrong.';
  });
  $('logout').addEventListener('click', async () => { await post({action: 'logout'}); show(null); });
  fetch(API).then(r => r.json()).then(d => { setMode(new URLSearchParams(location.search).get('mode') === 'up' ? 'up' : 'in'); show(d.user); }).catch(() => { setMode('in'); show(null); });
})();
