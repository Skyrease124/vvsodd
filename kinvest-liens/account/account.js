(function () {
  const $ = id => document.getElementById(id);
  const API = '/.netlify/functions/account';
  const fields = window.ppaAuthFields;
  let mode = 'in';
  function setMode(m) {
    mode = m; $('tabin').className = 'btn' + (m === 'in' ? '' : ' ghost'); $('tabup').className = 'btn' + (m === 'up' ? '' : ' ghost');
    $('acodewrap').hidden = m === 'in';
    const signup = m === 'up';
    $('tabup').setAttribute('aria-pressed',String(signup));
    $('tabin').setAttribute('aria-pressed',String(!signup));
    $('pw').placeholder = signup ? 'Create a password (at least 8 characters)' : 'Password';
    fields.pending($('go'),false,signup);
    ['usernamewrap','confirmwrap','signupterms','signup-benefits'].forEach(id => { $(id).hidden = !signup; });
    $('loginopts').hidden = signup;
    ['username','confirmpw','signupaccept'].forEach(id => { $(id).required = signup; });
    $('pw').minLength = signup ? 8 : 0;
    $('pw').autocomplete = signup ? 'new-password' : 'current-password';
    $('account-title').textContent = signup ? 'Create Your Account' : 'Welcome back';
    $('account-subtitle').hidden = false;
    $('account-subtitle').textContent = signup ? 'Get a free account to search properties, explore data, save lists and track opportunities.' : 'Sign in to your PricePocketAsset account to search properties, manage lists and track opportunities.';
    const switchLink = document.createElement('a');
    switchLink.href = signup ? '/login/' : '/account/?mode=up';
    switchLink.textContent = signup ? 'Sign in →' : 'Create a free account →';
    $('account-switch').replaceChildren(signup ? 'Already have an account? ' : 'New here? ', switchLink);
    fields.clear();
  }
  let billing = null;
  // Coming from the plan page (/plans/): ?plan=pro opens the subscribe terms after sign-in; ?next= returns the member to where they were. Only same-site paths are accepted.
  const QS = new URLSearchParams(location.search), safe = p => /^\/(?!\/)[\w\-./?=&%#:+~]*$/.test(p || '') ? p : '';
  const NEXT = safe(QS.get('next')), WANT_PRO = QS.get('plan') === 'pro';
  if (NEXT) { try { sessionStorage.setItem('ppa_next', NEXT); } catch (e) {} }
  const savedNext = () => { try { return safe(sessionStorage.getItem('ppa_next')); } catch (e) { return ''; } };
  const openTerms = () => { $('subterms').hidden = false; $('subok').checked = false; $('subgo').disabled = true; $('subterms').scrollIntoView({behavior: 'smooth', block: 'nearest'}); };
  let proDone = false;
  function proFlow() {
    const u = window.__ppUser; if (!WANT_PRO || !u || !billing || proDone) return; proDone = true;
    const today = new Date().toISOString().slice(0, 10), paid = u.owner || u.paid || u.family || (u.paidThrough && u.paidThrough >= today), subOn = u.sub && ['active', 'trialing', 'past_due'].includes(u.sub.status) && !u.sub.cancelAtPeriodEnd;
    if (paid || subOn) { $('planmsg').textContent = 'You already have PricePocketPro, so there is nothing to buy.'; return; }
    if (!billing.configured) { $('planmsg').textContent = 'Membership checkout is not open yet. Please try again soon.'; return; }
    openTerms();
  }
  async function billingPost(action) { const r = await fetch('/.netlify/functions/billing', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action})}); return {ok: r.ok, d: await r.json()}; }
  async function go(action, btn) {
    btn.disabled = true; $('planmsg').textContent = 'One moment\u2026';
    const r = await billingPost(action);
    if (r.ok && r.d.url) { location.href = r.d.url; return; }
    $('planmsg').textContent = r.d.error || 'Something went wrong.'; btn.disabled = false;
  }
  // Subscribing: show the terms first; checkout starts only after the member ticks the box (the server checks this again and records it).
  const POLICY_VERSION = '2026-11-18';
  $('upgrade').addEventListener('click', openTerms);
  $('subok').addEventListener('change', () => { $('subgo').disabled = !$('subok').checked; });
  $('subcancel').addEventListener('click', () => { $('subterms').hidden = true; });
  $('subgo').addEventListener('click', async () => {
    if (!$('subok').checked) return; const b = $('subgo'); b.disabled = true; $('planmsg').textContent = 'One moment\u2026';
    const r = await fetch('/.netlify/functions/billing', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'checkout', consent: {terms: true, recurring: true, version: POLICY_VERSION}})}).then(async x => ({ok: x.ok, d: await x.json().catch(() => ({}))})).catch(() => ({ok: false, d: {error: 'Could not reach the server. Please try again.'}}));
    if (r.ok && r.d.url) { location.href = r.d.url; return; }
    $('planmsg').textContent = r.d.error || 'Something went wrong.'; b.disabled = !$('subok').checked;
  });
  $('manage').addEventListener('click', () => go('portal', $('manage')));
  function planButtons(user) {
    const subOn = user.sub && ['active', 'trialing', 'past_due'].includes(user.sub.status);
    $('planbtns').hidden = true;
    if (user.owner || !billing || !billing.configured) return;
    $('planbtns').hidden = false;
    $('upgrade').hidden = !!(subOn && !user.sub.cancelAtPeriodEnd);
    $('manage').hidden = !user.hasCustomer;
    if (user.sub && user.sub.status === 'active' && !user.sub.cancelAtPeriodEnd && user.sub.periodEnd) $('planmsg').textContent = 'Your membership renews on ' + user.sub.periodEnd + ' for $5.50 a week. Tap Manage subscription to update your card, see invoices, or cancel anytime.';
    if (user.sub && user.sub.cancelAtPeriodEnd && user.sub.periodEnd) $('planmsg').textContent = 'Your membership is set to end on ' + user.sub.periodEnd + '. You keep access until then. Tap Manage subscription if you change your mind.';
    else if (user.sub && user.sub.status === 'past_due') $('planmsg').textContent = 'Your last payment did not go through. Tap Manage subscription to update your card.';
    if (billing.mode === 'test') $('planmsg').textContent += ' (Test mode: no real money moves. Use card 4242 4242 4242 4242.)';
  }
  fetch('/.netlify/functions/billing').then(r => r.json()).then(b => { billing = b; if (window.__ppUser) { planButtons(window.__ppUser); proFlow(); } }).catch(() => {});
  if (new URLSearchParams(location.search).get('paid') === '1') {
    (async () => { $('planmsg').textContent = 'Payment received. Switching you on\u2026'; for (let i = 0; i < 4; i++) { const r = await billingPost('sync'); if (r.ok && r.d.paid) { location.replace(savedNext() || './'); return; } await new Promise(x => setTimeout(x, 2500)); } $('planmsg').textContent = 'Payment received. It can take a minute to show. Refresh this page in a moment.'; })();
  }
  if (QS.get('canceled') === '1') { const m = $('planmsg'); m.textContent = 'Checkout was canceled. You were not charged. '; const a = document.createElement('a'); a.href = '/plans/' + (savedNext() ? '?from=' + encodeURIComponent(savedNext()) : ''); a.textContent = 'Back to the plans'; m.appendChild(a); }
  function show(user) {
    window.__ppUser = user;
    if (user) { const pro = user.owner || user.paid || (user.paidThrough && user.paidThrough >= new Date().toISOString().slice(0, 10)); $('ainote').textContent = pro ? 'Ask across all states: rankings, comparisons and lien lists.' : '\uD83D\uDD12 Pro members only ($5.50 a week).'; } if (user && billing) { planButtons(user); proFlow(); }
    $('out').hidden = !!user; $('in').hidden = !user; document.body.classList.toggle('auth-entry',!user); if (!user) return;
    { const pp = () => { if (window.PPPush) { window.PPPush.mount($('pushhost'), user); window.PPPush.sync(user); } }; if (window.PPPush) pp(); else window.addEventListener('load', pp, {once: true}); }
    const today = new Date().toISOString().slice(0, 10), paid = user.owner || user.paid || (user.paidThrough && user.paidThrough >= today);
    $('codebox').hidden = !!(paid || user.owner);
    $('plantext').textContent = user.owner ? 'Owner: every Pro feature is on.' : user.family ? 'Family access: every Pro feature is on and free for you.' : paid ? 'Pro member through ' + user.paidThrough + '. Every Pro feature is on.' : (user.paidThrough ? 'Your paid time ended on ' + user.paidThrough + '. ' : 'Free account. ') + 'Lists, maps and official sources are free. Pro ($5.50 a week) adds the AI, live checks on every lot (Street View, weather, fires, crime, energy, cameras), owner mailing details, downloads and the full course. ';
    $('account-title').textContent = 'My account'; $('account-subtitle').hidden = true;
    $('who').textContent = user.email; $('ownbadge').hidden = !user.owner; $('ownerbtns').hidden = !user.owner;
    const ul = $('saved'); ul.textContent = '';
    if (!user.saved.length) { const li = document.createElement('li'); li.textContent = 'No favorites yet. Tap \u2606 Favorite on a lien to keep it here.'; ul.appendChild(li); }
    const STATE_OF = {'Palm Beach': 'FL', 'Larimer': 'CO', 'Pinal': 'AZ'};
    user.saved.forEach(s => {
      const li = document.createElement('li'); li.style.cssText = 'display:block;border-radius:12px;margin:8px 0;padding:12px';
      const h = document.createElement('b'); h.textContent = (s.county ? s.county + ' County ' : '') + 'parcel ' + s.parcel; li.appendChild(h);
      const t = document.createElement('p'); t.className = 'small muted'; t.style.margin = '4px 0 8px';
      t.textContent = [s.use && s.use.toLowerCase(), s.acres != null && s.acres + ' acres', s.market != null && 'county value $' + Math.round(s.market).toLocaleString('en-US'), s.face != null && 'tax owed $' + Number(s.face).toFixed(2), s.savedAt && 'saved ' + s.savedAt.slice(0, 10)].filter(Boolean).join(' \u00b7 ');
      li.appendChild(t);
      { const au = document.createElement('div'); li.appendChild(au); if (typeof AuctionUpdates !== 'undefined') AuctionUpdates.badge(au, s); }   // confirmed auction changes for this saved parcel
      const row = document.createElement('div'); row.className = 'sact';
      const lien = {county: s.county, parcel: s.parcel, amount: s.face, market: s.market, use: s.use, acres: s.acres, certList: s.certList, saleDate: s.saleDate};
      const bb = typeof LienBuy !== 'undefined' ? LienBuy.button(lien, 'btn small') : null; if (bb) row.appendChild(bb);
      if (typeof PARCEL_MAPS !== 'undefined' && PARCEL_MAPS[s.county]) { const m = document.createElement('button'); m.type = 'button'; m.className = 'btn small ghost'; m.textContent = 'Show on map'; m.addEventListener('click', () => LienMap.open(lien)); row.appendChild(m); }
      if (STATE_OF[s.county]) { const o = document.createElement('a'); o.className = 'btn small ghost'; o.href = '../liens/states/state/?s=' + STATE_OF[s.county]; o.textContent = 'Open ' + STATE_OF[s.county] + ' page'; row.appendChild(o); }
      const b = document.createElement('button'); b.className = 'btn small ghost'; b.type = 'button'; b.textContent = 'Remove';
      b.addEventListener('click', async () => { const r = await post({action: 'unsave', parcel: s.parcel, county: s.county}); if (r.ok) { user.saved = r.d.saved; show(user); } });
      row.appendChild(b); li.appendChild(row); ul.appendChild(li);
    });
  }
  async function post(o) { try { const r = await fetch(API, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(o)}); return {ok: r.ok, d: await r.json()}; } catch (e) { return {ok: false, d: {error: 'Could not reach the server. Try again.'}}; } }
  $('redeem').addEventListener('click', async () => { $('codemsg').textContent = 'One moment\u2026'; const r = await post({action: 'redeem', code: $('rcode').value}); if (r.ok) { location.reload(); } else $('codemsg').textContent = r.d.error || 'Something went wrong.'; });
  $('tabin').addEventListener('click', () => setMode('in')); $('tabup').addEventListener('click', () => setMode('up'));
  $('form').addEventListener('submit', async e => {
    e.preventDefault();
    const signup = mode === 'up', button = $('go');
    if (button.disabled || !fields.validate(signup)) return;
    fields.pending(button,true,signup);
    $('tabup').disabled = $('tabin').disabled = true;
    const r = await post({action: signup ? 'signup' : 'login', email: $('email').value, password: $('pw').value,
      ...(signup ? {username: $('username').value, terms: $('signupaccept').checked, accessCode: $('acode').value} : {remember: $('remember').checked})});
    if (r.ok) {
      $('pw').value = ''; $('confirmpw').value = ''; fields.resetVisibility(); show(r.d.user);
      if (signup && !WANT_PRO) { location.href = '/community/welcome/?next=' + encodeURIComponent(NEXT || '/map/'); return; }
      if (NEXT && !WANT_PRO) { location.href = NEXT; return; }
    } else fields.status(r.d.error || 'Something went wrong.');
    fields.pending(button,false,signup);
    $('tabup').disabled = $('tabin').disabled = false;
  });
  $('logout').addEventListener('click', async () => { if (window.PPPush) await window.PPPush.logout(); await post({action: 'logout'}); show(null); });
  fetch(API).then(r => r.json()).then(d => { setMode(new URLSearchParams(location.search).get('mode') === 'up' ? 'up' : 'in'); show(d.user); }).catch(() => { setMode(QS.get('mode') === 'up' ? 'up' : 'in'); show(null); });
})();
