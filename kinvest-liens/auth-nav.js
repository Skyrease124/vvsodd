// One account menu on every page. Signed out: "Sign in" button. Signed in: "My account" menu (Portfolio, My favorites, Sign out),
// and the newsletter / sign-up prompts are hidden.
(function () {
  const API = '/.netlify/functions/account';
  const css = document.createElement('style');
  css.textContent = '.pp-menu{position:relative;display:inline-block}.pp-panel{position:absolute;right:0;top:calc(100% + 10px);width:272px;max-width:calc(100vw - 24px);max-height:min(76vh,620px);overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;background:rgba(250,251,252,.86);-webkit-backdrop-filter:saturate(1.8) blur(24px);backdrop-filter:saturate(1.8) blur(24px);color:#1d1d1f;border:.5px solid rgba(0,0,0,.12);border-radius:20px;box-shadow:0 0 0 .5px rgba(255,255,255,.6) inset,0 24px 60px -12px rgba(0,0,0,.45),0 6px 18px rgba(0,0,0,.14);padding:8px;z-index:50;transform-origin:calc(100% - 36px) -8px;animation:ppPanelIn .26s cubic-bezier(.2,.9,.25,1.1) both}' +
    '@keyframes ppPanelIn{from{opacity:0;transform:scale(.92) translateY(-6px)}to{opacity:1;transform:none}}' +
    '.pp-panel[hidden]{display:none}.pp-panel a,.pp-panel button{display:flex;align-items:center;justify-content:space-between;width:100%;box-sizing:border-box;text-align:left;padding:13px 14px;border:0;background:none;border-radius:0;font:inherit;font-size:16px;font-weight:500;letter-spacing:-.01em;color:#1d1d1f;text-decoration:none;cursor:pointer;transition:background-color .15s;-webkit-tap-highlight-color:transparent}' +
    '.pp-grp{background:rgba(255,255,255,.72);border-radius:14px;overflow:hidden;margin:0 0 10px}.pp-grp>*+*{box-shadow:0 -.5px 0 rgba(0,0,0,.12)}' +
    '.pp-grp>a::after{content:"\\203A";font-size:22px;line-height:1;color:#b4b8bf;font-weight:400;margin-left:10px}' +
    '.pp-panel a:hover,.pp-panel button:hover{background:rgba(11,110,79,.09)}.pp-panel a:active,.pp-panel button:active{background:rgba(11,110,79,.18)}' +
    '.pp-panel .pp-out{color:#d70015;justify-content:center;font-weight:600}.pp-panel .pp-ownlab{font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#6e6e73;padding:4px 14px 6px}' +
    '.pp-panel .pp-who{display:flex;align-items:center;gap:12px;padding:6px 6px 14px}.pp-av{flex:none;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;color:#fff;background:linear-gradient(160deg,#2bb585,#0b6e4f);box-shadow:0 4px 10px -3px rgba(11,110,79,.6)}' +
    '.pp-who b{display:block;font-size:15px;font-weight:600;color:#1d1d1f;word-break:break-all;line-height:1.25}.pp-who small{display:block;font-size:13px;color:#6e6e73;margin-top:2px}' +
    '@media(prefers-color-scheme:dark){.pp-panel{background:rgba(38,38,42,.82);color:#f5f5f7;border-color:rgba(255,255,255,.14)}.pp-grp{background:rgba(255,255,255,.08)}.pp-panel a,.pp-panel button,.pp-who b{color:#f5f5f7}.pp-grp>*+*{box-shadow:0 -.5px 0 rgba(255,255,255,.14)}.pp-panel .pp-out{color:#ff6961}.pp-who small,.pp-panel .pp-ownlab{color:#a1a1a6}.pp-panel a:hover,.pp-panel button:hover{background:rgba(47,191,140,.16)}}' +
    '@media(prefers-reduced-motion:reduce){.pp-panel{animation:none}}' +
    '.pp-signin{margin-right:8px;background:transparent!important;border:2px solid currentColor;color:inherit!important}.dnav .pp-signin{color:#e6ecf7!important;border-color:#e6ecf7}' +
    '.dnav .pp-signin,.dnav .dbtn{padding:9px 16px}.pp-signin,.pp-menu>a,.dnav .dbtn{white-space:nowrap}' +
    '@media(max-width:520px){.dnav-in{gap:8px!important}.dnav .dlogo small{display:none}.dnav .dlogo svg{width:34px;height:28px}.dnav .dlogo b{font-size:18px}.dnav .pp-signin,.dnav .dbtn{padding:8px 11px;font-size:14px}.pp-signin{margin-right:4px}.nav .btn.small{padding:8px 11px;font-size:14px;white-space:nowrap}}';
  document.head.appendChild(css);

  const header = document.querySelector('header');
  const cta = document.querySelector('header .dbtn[href="#contact"], header a.btn.small[href$="#contact"]');
  // Push: load push.js only when this device already turned notifications on (or on the account page). Never asks for permission.
  function ppPushLoad() { return new Promise(res => { if (window.PPPush) return res(window.PPPush); const s = document.createElement('script'); s.src = '/push.js'; s.onload = () => res(window.PPPush); s.onerror = () => res(null); document.head.appendChild(s); }); }
  function ppDevice() { try { return localStorage.getItem('ppPushDevice') === '1'; } catch (e) { return false; } }
  function ppPush(user) { if (ppDevice()) ppPushLoad().then(P => { if (P) P.sync(user || null); }); }
  const navLinks = [...document.querySelectorAll('a[href$="account/"]')].filter(a => /^\s*(Account|Sign in)\s*$/i.test(a.textContent));

  fetch(API).then(r => r.ok ? r.json() : null).then(d => {
    const user = d && d.user;
    ppPush(user); // keep this device tied to the signed-in account (only on devices that already turned notifications on)
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
      const who = document.createElement('div'); who.className = 'pp-who'; { const av = document.createElement('span'); av.className = 'pp-av'; av.textContent = (user.email || '?').charAt(0).toUpperCase(); const tx = document.createElement('div'), nm = document.createElement('b'), rl = document.createElement('small'); nm.textContent = user.email; rl.textContent = user.owner ? 'Owner' : (user.paid || (user.paidThrough && user.paidThrough >= today)) ? 'PricePocketPro member' : 'Free account'; tx.append(nm, rl); who.append(av, tx); }
      const l1 = document.createElement('a'); l1.href = '/portfolio/'; l1.textContent = 'My portfolio';
      const l2 = document.createElement('a'); l2.href = '/account/'; l2.textContent = 'My favorites';
      const l9 = document.createElement('a'); l9.href = '/account/watchlist/'; l9.textContent = 'My watchlist';
      const l10 = document.createElement('a'); l10.href = '/admin/imports/'; l10.textContent = 'Imports & review';
      const ldl = document.createElement('a'); ldl.href = '/downloads/'; ldl.textContent = 'Download Center';
      const lnot = document.createElement('a'); lnot.href = '/account/#pushhost'; lnot.textContent = 'Notifications';
      const l8 = document.createElement('a'); l8.href = '/learn/'; l8.textContent = 'Master Class';
      const ldon = document.createElement('a'); ldon.href = '/donate/'; ldon.textContent = 'Support the site';
      const l6 = document.createElement('a'); l6.href = '/land/'; l6.textContent = 'Land for sale';
      const l7 = document.createElement('a'); l7.href = '/land/sell/'; l7.textContent = 'Sell my land';
      const l4 = document.createElement('a'); l4.href = '/members/'; l4.textContent = 'Members';
      const l5 = document.createElement('a'); l5.href = '/billing/'; l5.textContent = 'Billing setup';
      const lk = document.createElement('a'); lk.href = '/owner/keys/'; lk.textContent = 'API keys';
      const lo = document.createElement('a'); lo.href = '/owner/ocr/'; lo.textContent = 'Read a county PDF';
      const lp = document.createElement('a'); lp.href = '/plans/'; lp.textContent = 'Free vs Pro';
      const l3 = document.createElement('a'); l3.href = '/usage/'; l3.textContent = 'Usage';
      const lcm = document.createElement('a'); lcm.href = '/community/'; lcm.textContent = 'Community';
      const isPro = user.owner || user.paid || (user.paidThrough && user.paidThrough >= today);
      let aiLink = null; if (isPro) { aiLink = document.createElement('a'); aiLink.href = '/map/?ai=1'; aiLink.textContent = 'Parcel Map + AI'; }
      let ms = null;
      if (user.hasCustomer) {
        ms = document.createElement('button'); ms.type = 'button'; ms.textContent = 'Manage subscription';
        ms.addEventListener('click', async () => {
          ms.disabled = true; ms.textContent = 'Opening\u2026';
          try { const r = await fetch('/.netlify/functions/billing', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'portal'})}); const d = await r.json(); if (r.ok && d.url) { location.href = d.url; return; } alert(d.error || 'Could not open billing. Please try again.'); } catch (e) { alert('Could not open billing. Please try again.'); }
          ms.disabled = false; ms.textContent = 'Manage subscription';
        });
      }
      const out = document.createElement('button'); out.type = 'button'; out.className = 'pp-out'; out.textContent = 'Sign out';
      out.addEventListener('click', async () => { if (ppDevice()) { const P = await ppPushLoad(); if (P) await P.logout(); } try { await fetch(API, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'logout'})}); } catch (e) {} location.reload(); });
      const grp = (...els) => { const g = document.createElement('div'); g.className = 'pp-grp'; els.filter(Boolean).forEach(x => g.appendChild(x)); return g; };
      p.append(who, grp(aiLink || (() => { const x = document.createElement('a'); x.href = '/map/'; x.textContent = 'Parcel Map + AI'; return x; })(), lcm, l8, l9, l1, isPro ? ldl : null, isPro ? lnot : null, l2), grp(l6, l7, ldon)); if (ms) p.append(grp(ms));
      if (user.owner) { const lab = document.createElement('div'); lab.className = 'pp-ownlab'; lab.textContent = 'Owner tools'; p.append(lab, grp(l4, l10, lk, lo, l3, l5)); }
      p.append(grp(lp), grp(out)); wrap.append(b, p);
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
        navLinks.forEach(a => { a.hidden = true; }); // one Sign in button, not a link and a button
        cta.before(s);
        if (cta.classList.contains('dbtn')) { cta.textContent = 'Sign Up'; cta.href = '/account/?mode=up'; }
      } else { const nav = header && header.querySelector('nav'); if (nav && !navLinks.length) nav.appendChild(s); }
    }
  }).catch(() => {});
})();

// Motion: reveal sections as they scroll into view, and a back-to-top button. Skipped for reduced-motion users.
(function () {
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;
  var SEL = 'main h2, main .salebox, main .askbox, main .notice, main .card, main .scard, main .setupform, main .takeaways, main .lessons li, main .stcell, main .countylist li, main .stfacts, main .dnote, main .band p, footer .wrap';
  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, {rootMargin: '0px 0px -6% 0px', threshold: 0.05});
  var vh = window.innerHeight || 800, n = 0;
  function tag(root) {
    var list = (root.matches && root.matches(SEL) ? [root] : []).concat([].slice.call(root.querySelectorAll ? root.querySelectorAll(SEL) : []));
    list.forEach(function (el) {
      if (el.classList.contains('rv') || el.closest('dialog') || el.closest('details') || el.closest('.rv')) return;
      var r = el.getBoundingClientRect();
      if (r.top < vh * 0.9 && r.bottom > 0) return; // already on screen: leave it alone
      el.style.setProperty('--rvd', (n++ % 4) * 60 + 'ms'); el.classList.add('rv'); io.observe(el);
    });
  }
  function start() {
    tag(document.body);
    if ('MutationObserver' in window) new MutationObserver(function (ms) { ms.forEach(function (m) { [].forEach.call(m.addedNodes, function (x) { if (x.nodeType === 1) tag(x); }); }); }).observe(document.querySelector('main') || document.body, {childList: true, subtree: true});
    // safety net: never leave anything hidden
    setTimeout(function () { [].forEach.call(document.querySelectorAll('.rv:not(.in)'), function (el) { var r = el.getBoundingClientRect(); if (r.top < vh && r.bottom > 0) el.classList.add('in'); }); }, 2500);
    var b = document.createElement('button'); b.type = 'button'; b.className = 'pp-top'; b.setAttribute('aria-label', 'Back to top'); b.textContent = '\u2191';
    b.addEventListener('click', function () { window.scrollTo({top: 0, behavior: 'smooth'}); }); document.body.appendChild(b);
    var tick = false; window.addEventListener('scroll', function () { if (tick) return; tick = true; requestAnimationFrame(function () { b.classList.toggle('show', window.scrollY > 700); tick = false; }); }, {passive: true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
// Skip link for keyboard and screen reader users: jumps past the header to the page's main content.
(function () {
  function add() {
    const m = document.querySelector('main'); if (!m || document.querySelector('.ppskip')) return;
    if (!m.id) m.id = 'main'; if (!m.hasAttribute('tabindex')) m.setAttribute('tabindex', '-1');
    const a = document.createElement('a'); a.className = 'ppskip'; a.href = '#' + m.id; a.textContent = 'Skip to main content';
    document.body.insertBefore(a, document.body.firstChild);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
})();
// "Add to Home Screen" help at the bottom of every page: steps for iPhone, Android and desktop. Hidden once the site is already installed.
(function () {
  function add() {
    if (document.querySelector('.a2hs')) return;
    const standalone = !!(navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches)); if (standalone) return;
    let foot = document.querySelector('footer .wrap') || document.querySelector('footer');
    if (!foot) { const m = document.querySelector('main') || document.body; foot = document.createElement('div'); foot.className = 'wrap a2hs-wrap'; foot.style.cssText = 'padding:8px 16px 32px'; m.appendChild(foot); } // pages without a footer
    const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
    const d = mk('details', 'a2hs'), s = mk('summary', '', 'Add PricePocket to your Home Screen'); d.appendChild(s);
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1), android = /Android/i.test(navigator.userAgent);
    const block = (title, steps, open) => { const b = mk('div', 'a2hs-b'); b.appendChild(mk('b', '', title)); const ol = mk('ol'); steps.forEach(x => ol.appendChild(mk('li', '', x))); b.appendChild(ol); return b; };
    const blocks = [
      [ 'iPhone or iPad (use Safari)', ['Open pricepocketasset.com in Safari.', 'Tap the Share button (the square with an arrow, at the bottom of the screen).', 'Scroll down and tap “Add to Home Screen”.', 'Tap “Add”. The icon appears on your Home Screen.', 'Open the site from that icon. Notifications on iPhone only work from the icon.'], ios ],
      [ 'Android (Chrome)', ['Open pricepocketasset.com in Chrome.', 'Tap the ⋮ menu at the top right.', 'Tap “Install app” or “Add to Home screen”.', 'Tap “Install”, then open it from the new icon.'], android ],
      [ 'Computer (Chrome or Edge)', ['Open pricepocketasset.com.', 'Click the install icon at the right of the address bar, or open the browser menu.', 'Choose “Install PricePocketAsset”.'], !ios && !android ]
    ];
    blocks.sort((a, b) => (b[2] ? 1 : 0) - (a[2] ? 1 : 0)).forEach(x => d.appendChild(block(x[0], x[1])));
    d.appendChild(mk('p', 'small muted', 'Why: one tap to open, full screen, and push notifications for your watchlist, sales and deadlines.'));
    foot.appendChild(d);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
})();
