// One account menu on every page. Signed out: "Sign in" button. Signed in: "My account" menu (Portfolio, My favorites, Sign out),
// and the newsletter / sign-up prompts are hidden.
(function () {
  const API = '/.netlify/functions/account';
  const css = document.createElement('style');
  css.textContent = '.pp-menu{position:relative;display:inline-block}.pp-panel{position:absolute;right:0;top:calc(100% + 8px);min-width:210px;background:#fff;color:#12201a;border:1px solid #c9d6cf;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.3);padding:6px;z-index:50}' +
    '.pp-panel[hidden]{display:none}.pp-panel a,.pp-panel button{display:block;width:100%;box-sizing:border-box;text-align:left;padding:12px 14px;border:0;background:none;border-radius:8px;font:inherit;font-weight:600;color:#12201a;text-decoration:none;cursor:pointer}' +
    '.pp-panel a:hover,.pp-panel button:hover{background:#e8f3ed}.pp-panel .pp-who{font-size:12px;font-weight:500;color:#5a6b62;padding:8px 14px 4px;word-break:break-all}' +
    '.pp-signin{margin-right:8px;background:transparent!important;border:2px solid currentColor;color:inherit!important}.dnav .pp-signin{color:#e6ecf7!important;border-color:#e6ecf7}' +
    '.dnav .pp-signin,.dnav .dbtn{padding:9px 16px}.pp-signin,.pp-menu>a,.dnav .dbtn{white-space:nowrap}' +
    '@media(max-width:520px){.dnav-in{gap:8px!important}.dnav .dlogo small{display:none}.dnav .dlogo svg{width:34px;height:28px}.dnav .dlogo b{font-size:18px}.dnav .pp-signin,.dnav .dbtn{padding:8px 11px;font-size:14px}.pp-signin{margin-right:4px}.nav .btn.small{padding:8px 11px;font-size:14px;white-space:nowrap}}';
  document.head.appendChild(css);

  const header = document.querySelector('header');
  const cta = document.querySelector('header .dbtn[href="#contact"], header a.btn.small[href$="#contact"]');
  const navLinks = [...document.querySelectorAll('a[href$="account/"]')].filter(a => /^\s*(Account|Sign in)\s*$/i.test(a.textContent));

  fetch(API).then(r => r.ok ? r.json() : null).then(d => {
    const user = d && d.user;
    // Paid members (and the owner) see "PricePocketPro" instead of "PricePocketAsset".
    const today = new Date().toISOString().slice(0, 10);
    if (user && (user.owner || user.paid || (user.paidThrough && user.paidThrough >= today))) {
      const em = document.querySelector('.dlogo em');
      if (em && em.textContent === 'Asset') em.textContent = 'Pro';
      document.querySelectorAll('a.logo').forEach(a => { const t = a.lastChild; if (t && t.nodeType === 3) t.nodeValue = t.nodeValue.replace('Asset', 'Pro'); });
      const dl = document.querySelector('.dlogo'); if (dl) dl.setAttribute('aria-label', 'PricePocketPro home');
    }
    if (user) {
      navLinks.forEach(a => { a.textContent = 'My account'; });
      const wrap = document.createElement('div'); wrap.className = 'pp-menu';
      const b = document.createElement('a'); b.href = '#'; b.className = cta ? cta.className.replace(/\bghost\b/, '') : 'btn small'; b.textContent = 'My account ▾'; b.setAttribute('aria-haspopup', 'true'); b.setAttribute('aria-expanded', 'false');
      const p = document.createElement('div'); p.className = 'pp-panel'; p.hidden = true;
      const who = document.createElement('div'); who.className = 'pp-who'; who.textContent = user.email + (user.owner ? ' (owner)' : '');
      const l1 = document.createElement('a'); l1.href = '/portfolio/'; l1.textContent = 'My portfolio';
      const l2 = document.createElement('a'); l2.href = '/account/'; l2.textContent = 'My favorites';
      const l4 = document.createElement('a'); l4.href = '/members/'; l4.textContent = 'Members (owner)';
      const l5 = document.createElement('a'); l5.href = '/billing/'; l5.textContent = 'Billing setup (owner)';
      const l3 = document.createElement('a'); l3.href = '/usage/'; l3.textContent = 'Usage (owner)';
      const isPro = user.owner || user.paid || (user.paidThrough && user.paidThrough >= today);
      let aiLink = null; if (isPro) { aiLink = document.createElement('a'); aiLink.href = '/ai/'; aiLink.textContent = 'PricePocket AI'; }
      let ms = null;
      if (user.hasCustomer) {
        ms = document.createElement('button'); ms.type = 'button'; ms.textContent = 'Manage subscription';
        ms.addEventListener('click', async () => {
          ms.disabled = true; ms.textContent = 'Opening\u2026';
          try { const r = await fetch('/.netlify/functions/billing', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'portal'})}); const d = await r.json(); if (r.ok && d.url) { location.href = d.url; return; } alert(d.error || 'Could not open billing. Please try again.'); } catch (e) { alert('Could not open billing. Please try again.'); }
          ms.disabled = false; ms.textContent = 'Manage subscription';
        });
      }
      const out = document.createElement('button'); out.type = 'button'; out.textContent = 'Sign out';
      out.addEventListener('click', async () => { try { await fetch(API, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'logout'})}); } catch (e) {} location.reload(); });
      p.append(who); if (aiLink) p.append(aiLink); p.append(l1, l2); if (ms) p.append(ms); if (user.owner) p.append(l4, l3, l5); p.append(out); wrap.append(b, p);
      b.addEventListener('click', e => { e.preventDefault(); p.hidden = !p.hidden; b.setAttribute('aria-expanded', String(!p.hidden)); });
      document.addEventListener('click', e => { if (!wrap.contains(e.target)) { p.hidden = true; b.setAttribute('aria-expanded', 'false'); } });
      if (cta) cta.replaceWith(wrap);
      else { const nav = header && header.querySelector('nav'); (nav || header || document.body).appendChild(wrap); }
      // signed-in people do not need the newsletter prompts
      const c = document.getElementById('contact'); if (c) c.hidden = true;
      document.querySelectorAll('a[href$="#contact"]').forEach(a => { const holder = a.closest('p'); (holder || a).hidden = true; });
    } else {
      const next = encodeURIComponent(location.pathname + location.search);
      navLinks.forEach(a => { a.textContent = 'Sign in'; a.href = '/login/?next=' + next; });
      if (location.pathname.indexOf('/login') === 0) return;
      const s = document.createElement('a');
      s.href = '/login/?next=' + next; s.textContent = 'Sign in';
      s.className = (cta ? cta.className.replace(/\b(ghost)\b/, '') : 'btn small') + ' pp-signin';
      if (cta) {
        cta.before(s);
        if (cta.classList.contains('dbtn')) { cta.textContent = 'Sign Up'; cta.href = '/account/?mode=up'; }
      } else { const nav = header && header.querySelector('nav'); if (nav && !navLinks.length) nav.appendChild(s); }
    }
  }).catch(() => {});
})();
