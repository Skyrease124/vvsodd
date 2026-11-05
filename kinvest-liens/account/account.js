(function () {
  const $ = id => document.getElementById(id);
  const API = '/.netlify/functions/account';
  let mode = 'in';
  function setMode(m) {
    mode = m; $('tabin').className = 'btn' + (m === 'in' ? '' : ' ghost'); $('tabup').className = 'btn' + (m === 'up' ? '' : ' ghost');
    $('go').textContent = m === 'in' ? 'Sign in' : 'Create account'; $('pwhint').hidden = m === 'in';
    $('pw').autocomplete = m === 'in' ? 'current-password' : 'new-password'; $('msg').textContent = '';
  }
  function show(user) {
    $('out').hidden = !!user; $('in').hidden = !user; if (!user) return;
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
