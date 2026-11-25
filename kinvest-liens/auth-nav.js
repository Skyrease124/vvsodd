// One account menu on every page. Signed out: "Sign in" button. Signed in: "My account" menu (Portfolio, My favorites, Sign out),
// and the newsletter / sign-up prompts are hidden.
(function () {
  const API = '/.netlify/functions/account';
  const isEmbeddedMap = new URLSearchParams(location.search).get('embed') === '1' && window.top !== window;
  if (isEmbeddedMap) return;
  if (!window.__ppxSwitch) { const sw = document.createElement('script'); sw.src = '/experience-switch.js'; sw.defer = true; document.head.appendChild(sw); }
  if (!document.querySelector('link[href="/app-shell.css"]')) {
    const appCss = document.createElement('link'); appCss.rel = 'stylesheet'; appCss.href = '/app-shell.css'; document.head.appendChild(appCss);
  }
  window.ppaAccount ||= fetch(API).then(r => r.ok ? r.json() : null).then(d => d?.user || null).catch(() => null);
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
    'header .pp-panel a,header .pp-panel button{color:#1d1d1f!important}header .pp-panel .pp-out{color:#d70015!important}@media(prefers-color-scheme:dark){header .pp-panel a,header .pp-panel button{color:#f5f5f7!important}header .pp-panel .pp-out{color:#ff6961!important}}.nav .pp-panel a,.nav nav .pp-panel a:not(.btn){display:flex!important}.pp-panel a::after{position:static;height:auto;background:none;transform:none}' +
    '.pp-menu{display:inline-flex!important;align-items:center;gap:8px}.pp-bell{position:relative;display:inline-flex!important;align-items:center;justify-content:center;width:42px;height:42px;border-radius:21px;background:linear-gradient(135deg,#f5d77a,#c99a2e)!important;color:#1a1200!important;box-shadow:0 4px 12px rgba(201,154,46,.35);text-decoration:none}.pp-bell::after{display:none!important}.pp-bell b{position:absolute;top:-3px;right:-3px;min-width:19px;height:19px;border-radius:10px;background:#d70015;color:#fff;font-size:11px;font-weight:700;display:grid;place-items:center;padding:0 5px;line-height:1}' +
    '@media(max-width:440px){header a.logo{font-size:13px!important;letter-spacing:-.01em;gap:0}header a.logo img{margin-right:4px;width:auto!important;height:28px!important}.pp-hdr-r{gap:6px}.pp-hdr-r::before{margin-right:0}.pp-menu>a:not(.pp-bell){font-size:13px!important;padding:0 12px!important;min-height:34px!important}.pp-bell{width:34px!important;height:34px!important}.pp-back{width:34px!important;height:34px!important;min-width:34px!important}}@media(max-width:400px){header a.logo{font-size:0!important}header a.logo img{margin-right:0!important}}' +
    '.pp-back{width:36px!important;min-width:36px!important;height:36px!important;min-height:36px!important;margin-right:2px!important;font-size:20px!important;transition:transform .25s cubic-bezier(.32,.72,0,1)}.pp-back:active{transform:scale(.92)}' +
    '.pp-bell{width:36px!important;height:36px!important;transition:transform .25s cubic-bezier(.32,.72,0,1)}.pp-bell:active{transform:scale(.92)}' +
    '.pp-menu>button,.pp-menu .pp-btn,header .btn.small{min-height:36px!important;padding:0 14px!important;border-radius:999px!important;font-size:14px!important;font-weight:600!important;box-shadow:0 2px 8px rgba(11,110,79,.18)!important;transition:transform .25s cubic-bezier(.32,.72,0,1)}.pp-menu>button:active{transform:scale(.96)}' +
    '@media(prefers-reduced-motion:reduce){.pp-back,.pp-bell,.pp-menu>button{transition:none!important;transform:none!important}}' +
    '.nav{background:rgba(250,250,252,.72)!important;-webkit-backdrop-filter:saturate(180%) blur(22px);backdrop-filter:saturate(180%) blur(22px);border-bottom:.5px solid transparent!important;transition:border-color .35s cubic-bezier(.32,.72,0,1),background-color .35s}' +
    '.nav.pp-scrolled{border-bottom-color:rgba(0,0,0,.12)!important}' +
    '.pp-menu>a:not(.pp-bell),.pp-menu>button{background:linear-gradient(180deg,#14885f,#0b6e4f)!important;color:#fff!important;padding:0 16px!important;display:inline-flex!important;align-items:center!important}' +
    'header.nav .nav-in{justify-content:flex-start!important;gap:10px}header.nav .logo{margin-right:0!important}header.nav nav{margin-left:0!important}'+
    '.pp-hdr-r{display:flex;align-items:center;gap:8px;margin-left:auto}.pp-hdr-r::before{content:"";width:1px;height:26px;background:rgba(0,0,0,.14);margin-right:2px}.pp-menu>a:not(.pp-bell){border:1.5px solid #e2b85c!important;box-shadow:0 0 0 .5px rgba(255,255,255,.6) inset,0 2px 10px rgba(11,110,79,.28)!important}.pp-hdr-r .pp-menu{display:inline-flex}' +
    '@media(prefers-color-scheme:dark){.nav{background:rgba(12,12,14,.72)!important}}' +
    '@media(prefers-reduced-motion:reduce){.nav{transition:none!important}}' +
    '.pp-back{display:inline-flex;align-items:center;justify-content:center;min-width:40px;min-height:40px;margin-right:6px;border:0;border-radius:20px;background:rgba(127,127,127,.14);color:inherit;font-size:24px;line-height:1;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
    '.pp-signin{margin-right:8px;background:transparent!important;border:2px solid currentColor;color:inherit!important}.dnav .pp-signin{color:#e6ecf7!important;border-color:#e6ecf7}' +
    '.dnav .pp-signin,.dnav .dbtn{padding:9px 16px}.pp-signin,.pp-menu>a,.dnav .dbtn{white-space:nowrap}' +
    '@media(max-width:520px){.dnav-in{gap:8px!important}.dnav .dlogo small{display:none}.dnav .dlogo svg{width:34px;height:28px}.dnav .dlogo b{font-size:18px}.dnav .pp-signin,.dnav .dbtn{padding:8px 11px;font-size:14px}.pp-signin{margin-right:4px}.nav .btn.small{padding:8px 11px;font-size:14px;white-space:nowrap}}';
  css.textContent += `
    .ppx-sheet{position:fixed;inset:auto 0 0;width:min(100%,490px);max-height:92dvh;margin:0 auto;overflow:auto;overscroll-behavior:contain;color:#f5f8ff;background:#071426;border:1px solid #395169;border-bottom:0;border-radius:26px 26px 0 0;box-shadow:0 -14px 46px #0008;z-index:2147483000;font-family:system-ui,sans-serif;text-align:left;color-scheme:dark}
    .ppx-sheet[hidden],.ppx-sheet [hidden]{display:none!important}
    .ppx-brandbar{display:none}
    .ppx-body{padding:9px 13px calc(22px + env(safe-area-inset-bottom));background:radial-gradient(ellipse 63% 26% at 100% 0%,#078749a8,transparent 73%),radial-gradient(ellipse at 7% 0%,#233850 0%,transparent 34%),linear-gradient(165deg,#101d30,#061121 64%,#101e34);min-height:100%;box-sizing:border-box}
    .ppx-handle{width:39px;height:5px;border-radius:8px;background:#62748d;margin:0 auto 9px}
    .ppx-hd{position:relative;display:flex;align-items:center;gap:10px;padding:0 40px 0 4px;margin:0 0 12px;min-height:74px}
    .ppx-av{position:relative;flex:none;display:grid;place-items:center;width:73px;height:73px;border-radius:50%;border:2px solid #f2cc66;box-shadow:0 0 15px #dcb44f36;color:#fff;background:linear-gradient(155deg,#276958,#16283b);font-size:1.45rem;font-weight:700}
    .ppx-av img{position:absolute;inset:0;width:100%;height:100%;border-radius:inherit;object-fit:cover}
    .ppx-camera{position:absolute;right:-2px;bottom:-2px;display:grid;place-items:center;width:26px;height:26px;border:1px solid #f1c65d;border-radius:50%;background:#122236;color:#fff}
    .ppx-camera svg{width:15px;height:15px}
    .ppx-inf{min-width:0}.ppx-nm{font-size:clamp(1rem,4.4vw,1.2rem);font-weight:750;line-height:1.2;overflow-wrap:anywhere}.ppx-user{font-size:.92rem;color:#a9b8cc;margin-top:1px;overflow-wrap:anywhere}
    .ppx-role{display:inline-block;margin-top:5px;padding:1px 10px;border-radius:999px;border:1px solid #e9b84f;color:#ffdb7c;font-size:.69rem;font-weight:800;letter-spacing:.02em;text-transform:uppercase}
    .ppx-x{position:absolute;right:2px;top:5px;width:33px;height:33px;border:1px solid #7799b333;border-radius:50%;background:#163148;color:#fff;font:inherit;font-size:1.4rem;line-height:1;display:grid;place-items:center;padding:0;cursor:pointer}
    .ppx-search{position:relative;margin:0 0 12px}.ppx-search svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);width:19px;color:#dce6f3;pointer-events:none}
    .ppx-find{display:block;width:100%;min-height:40px;border-radius:13px;border:1px solid #526880;background:linear-gradient(130deg,#1c2d43,#172438);box-shadow:inset 0 1px 2px #9db4ce29;color:#f5f8ff;padding:0 10px 0 40px;font:inherit;font-size:16px;box-sizing:border-box;appearance:none}.ppx-find::placeholder{color:#a0aec1}
    .ppx-tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .ppx-sheet a{color:#f5f8ff;text-decoration:none}
    .ppx-tile{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:76px;border-radius:17px;border:1px solid #475e7994;background:linear-gradient(145deg,#20334c,#111e32 72%,#1a2b44);box-shadow:inset 0 1px 0 #94adcb22,0 5px 11px #0002;font-weight:700;font-size:clamp(.91rem,3.9vw,1.05rem);text-align:center;padding:5px;box-sizing:border-box}
    .ppx-tile svg{width:26px;height:26px}.ppx-tile.ppx-hi{background:linear-gradient(140deg,#00b04f 0%,#00754b 45%,#03483c 75%,#076b50);border-color:#54e3a1;box-shadow:inset 2px 2px 8px #dbff6670,0 0 15px #15e0704d}
    .ppx-list,.ppx-more .ppx-grp{border:1px solid #3f557099;border-radius:13px;background:linear-gradient(145deg,#152741,#0e1d30);overflow:hidden}
    .ppx-list{margin-top:12px}.ppx-row{display:grid;grid-template-columns:25px minmax(0,1fr) auto;align-items:center;gap:14px;min-height:36px;padding:4px 12px;box-sizing:border-box;font-weight:650;font-size:.95rem}
    .ppx-row+.ppx-row{border-top:1px solid #6d849c4a}.ppx-row svg{width:21px;height:21px}.ppx-row i{font-style:normal;color:#c5d3e3;font-size:1.3rem;line-height:1}
    .ppx-sheet .ppx-more,.ppx-sheet .ppx-own{margin:9px 0 0;border:0;background:transparent;padding:0}.ppx-more summary,.ppx-own summary{list-style:none;cursor:pointer;padding:6px 5px;font-weight:750;color:#ffdb7c;display:flex;justify-content:space-between;align-items:center}
    .ppx-sheet summary::-webkit-details-marker{display:none}.ppx-sheet summary::after{content:"";width:7px;height:7px;margin-right:7px;border:solid #edf4ff;border-width:0 2px 2px 0;transform:rotate(45deg)}.ppx-sheet details[open]>summary::after{transform:rotate(225deg)}
    .ppx-more .ppx-row{font-weight:500}.ppx-sheet .ppx-own{border:1px solid #8d6a30;border-radius:13px;padding:0 9px}.ppx-own .ppx-grp a{display:block;padding:8px 5px}
    .ppx-foot{margin-top:17px;padding-top:9px;border-top:1px solid #62789255}.ppx-foot .ppx-grp{display:flex;flex-wrap:wrap;gap:7px 14px}.ppx-foot a,.ppx-foot button{background:none;border:0;color:#f5f8ff;font:inherit;font-size:.87rem;font-weight:600;padding:4px 2px;cursor:pointer}.ppx-foot .pp-out{color:#ff8894}
    .ppx-sheet :focus-visible{outline:2px solid #ffe08e;outline-offset:-3px}.ppx-sheet a:hover{filter:brightness(1.15)}
    @media(max-width:600px){
      body:has(.ppx-sheet:not([hidden])){overflow:hidden}
      .ppx-sheet{inset:0;width:100%;max-height:none;border:0;border-radius:0;box-shadow:none;display:flex;flex-direction:column;overflow:hidden;background:#071326}
      .ppx-brandbar{display:flex;align-items:center;justify-content:space-between;gap:7px;padding:calc(16px + env(safe-area-inset-top)) 15px 14px;background:linear-gradient(#071222,#09182d)}
      .ppx-brand{display:flex;align-items:center;gap:5px;white-space:nowrap;font-size:clamp(.83rem,4.1vw,1.1rem);font-weight:800;letter-spacing:-.035em}.ppx-brand img{width:39px;height:auto}.ppx-brand em{color:#16c878;font-style:normal}
      .ppx-sheet .ppx-bell{position:relative;display:grid;place-items:center;flex:none;width:33px;height:33px;border-radius:50%;background:linear-gradient(145deg,#ffe589,#dbaa36);color:#1d180d;box-shadow:0 3px 12px #dba73850}.ppx-bell svg{width:20px}.ppx-bell b{position:absolute;top:-4px;right:-5px;padding:1px 4px;border-radius:10px;background:#be1736;color:white;font-size:.6rem}
      .ppx-account{white-space:nowrap;min-height:33px;padding:0 9px;border:1.5px solid #f0c65e;border-radius:11px;background:linear-gradient(#15815a,#07533d);color:#fff;font:inherit;font-size:clamp(.75rem,3.4vw,.96rem);font-weight:750;box-shadow:0 0 0 1px #ffdd7340 inset;cursor:pointer}
      .ppx-secondary{margin-top:12px}
      .ppx-body{min-height:0;flex:1;overflow:auto;overscroll-behavior:contain;border:1px solid #4a65818c;border-bottom:0;border-radius:24px 24px 0 0}
    }
  `;
  document.head.appendChild(css);

  // Approved header design: stacked logo, gold divider, green bell with count, gold-ringed account pill, gold + green swoosh.
  const hcss = document.createElement('style');
  hcss.textContent = "header.nav{background:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 44' preserveAspectRatio='none'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' x2='1'%3E%3Cstop offset='0' stop-color='%23f6e3a0'/%3E%3Cstop offset='.5' stop-color='%23d4a63c'/%3E%3Cstop offset='1' stop-color='%23f6e3a0'/%3E%3C/linearGradient%3E%3ClinearGradient id='w' x1='0' x2='1'%3E%3Cstop offset='0' stop-color='%230b6e4f' stop-opacity='0'/%3E%3Cstop offset='.55' stop-color='%230b6e4f' stop-opacity='.35'/%3E%3Cstop offset='1' stop-color='%230a4d38' stop-opacity='.9'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M180 44 C250 34 320 20 400 4 L400 44Z' fill='url(%23w)'/%3E%3Cpath d='M0 10 C60 0 110 26 210 26 C300 26 350 12 400 8' fill='none' stroke='url(%23g)' stroke-width='2.5'/%3E%3Cpath d='M0 16 C60 8 110 32 210 31 C300 31 350 17 400 14' fill='none' stroke='url(%23g)' stroke-width='1' stroke-opacity='.6'/%3E%3C/svg%3E\") bottom/100% 40px no-repeat,linear-gradient(180deg,rgba(255,255,255,.97),rgba(247,243,234,.97))!important;border-radius:0 0 26px 26px!important;border-bottom:0!important;box-shadow:0 8px 24px rgba(0,0,0,.08)!important}" +
    "header.nav .nav-in{height:auto!important;min-height:60px;padding:6px 12px 24px!important;gap:8px!important;max-width:none}" +
    "header.nav a.logo{display:flex!important;flex-direction:column;align-items:center;gap:1px;font-size:12.5px!important;font-weight:800!important;letter-spacing:-.01em!important;color:#0b4a34!important;line-height:1.1;margin-right:0!important;text-decoration:none}" +
    "header.nav a.logo img,header.nav a.logo img.logoimg{height:34px!important;width:auto!important;margin:0!important}" +
    "header.nav .pp-back{width:38px!important;height:38px!important;min-width:38px!important;background:#fff!important;color:#0b4a34!important;border:.5px solid rgba(0,0,0,.06)!important;box-shadow:0 2px 8px rgba(0,0,0,.14)!important;font-size:22px!important}" +
    "header.nav .pp-hdr-r{gap:8px!important}header.nav .pp-hdr-r::before{width:1px!important;height:42px!important;background:linear-gradient(transparent,#d6ad4f,transparent)!important;margin:0 2px 0 0!important}" +
    "header.nav .pp-bell{width:40px!important;height:40px!important;background:linear-gradient(145deg,#fff7dc,#efce78)!important;color:#0b6e4f!important;border:1px solid #e2b85c!important;box-shadow:0 4px 12px rgba(201,154,46,.3),inset 0 1px 0 #fff!important}" +
    "header.nav .pp-bell b{top:-6px!important;right:-6px!important;border:2px solid #fff;box-sizing:content-box;min-width:16px!important;height:16px!important;font-size:10px!important}" +
    "header.nav .pp-menu>a:not(.pp-bell){background:linear-gradient(180deg,#1f8a5c,#0a4d38)!important;border:1.5px solid #e6bd62!important;color:#fff!important;font-size:14px!important;font-weight:600!important;min-height:38px!important;padding:0 14px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 4px 12px rgba(10,77,56,.35)!important}";
  document.head.appendChild(hcss);
  document.querySelectorAll('header.nav img.logoimg').forEach(i => { i.src = '/img/logo-mark-light.png'; });

  const header = document.querySelector('header');
  // Back button on every page except the home page (the Home Screen app has no browser back button).
  if (header && location.pathname !== '/' && !header.querySelector('.pp-back')) {
    const logo = header.querySelector('.logo, a.logo'); const bk = document.createElement('button'); bk.type = 'button'; bk.className = 'pp-back'; bk.setAttribute('aria-label', 'Back'); bk.textContent = '\u2039';
    bk.addEventListener('click', () => { let same = false; try { same = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch (e) { /* none */ } if (same && history.length > 1) history.back(); else location.href = '/'; });
    if (logo && logo.parentNode) logo.parentNode.insertBefore(bk, logo); }
  const cta = document.querySelector('header .dbtn[href="#contact"], header a.btn.small[href$="#contact"], header .dbtn[href="/account/?mode=up"], header a.btn.small[href="/account/?mode=up"]');
  // Push: load push.js only when this device already turned notifications on (or on the account page). Never asks for permission.
  function ppPushLoad() { return new Promise(res => { if (window.PPPush) return res(window.PPPush); const s = document.createElement('script'); s.src = '/push.js'; s.onload = () => res(window.PPPush); s.onerror = () => res(null); document.head.appendChild(s); }); }
  function ppDevice() { try { return localStorage.getItem('ppPushDevice') === '1'; } catch (e) { return false; } }
  function ppPush(user) { if (ppDevice()) ppPushLoad().then(P => { if (P) P.sync(user || null); }); }
  const navLinks = [...document.querySelectorAll('a[href$="account/"]')].filter(a => /^\s*(Account|Sign in)\s*$/i.test(a.textContent));

  window.ppaAccount.then(user => {
    window.dispatchEvent(new CustomEvent('ppa:account', { detail:user }));
    if (document.body.classList.contains('ppa-home')) document.body.dataset.account = user ? (user.paid ? 'pro' : 'free') : 'guest';
    ppPush(user); // keep this device tied to the signed-in account (only on devices that already turned notifications on)
    // Paid members (and the owner) see "PricePocketPro" instead of "PricePocketAsset".
    if (user && (user.owner || user.paid)) {
      const em = document.querySelector('.dlogo em,.app-brand em');
      if (em && em.textContent === 'Asset') em.textContent = 'Pro';
      document.querySelectorAll('a.logo').forEach(a => { const t = a.lastChild; if (t && t.nodeType === 3) t.nodeValue = t.nodeValue.replace('Asset', 'Pro'); });
      const dl = document.querySelector('.dlogo'); if (dl) dl.setAttribute('aria-label', 'PricePocketPro home');
    }
    if (user) {
      navLinks.forEach(a => { a.textContent = 'My account'; });
      header?.querySelectorAll('.app-actions a[href="/login/"], .app-actions a[href^="/login/?"]').forEach(a => { a.hidden = true; });
      const nav = document.createElement('nav'); nav.className = 'app-bottom'; nav.setAttribute('aria-label', 'Mobile navigation');
      const bottomPaths = [
        ['Home','/','M3 11l9-8 9 8v10h-6v-6H9v6H3z'],
        [(user.owner || user.paid) ? 'Map + AI' : 'Map','/map/','M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14m6-12v14'],
        ['Tools',null,'M3 8l9-5 9 5-9 5zM3 13l9 5 9-5M3 18l9 5 9-5'],
        ['Watchlist','/account/watchlist/','M6 3h12v18l-6-4-6 4z'],
        ['Community','/community/','M2 21v-2a7 7 0 0 1 14 0v2m0-16a3 3 0 0 1 0 6m3 3a5 5 0 0 1 3 5v2M12.5 8a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z'],
        ['Profile','/community/profile/','M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM4 21v-2a8 8 0 0 1 16 0v2']
      ];
      bottomPaths.forEach(([label,href,path]) => {
        const link = document.createElement(href ? 'a' : 'button');
        if (href) {
          link.href = href;
          const current = label === 'Community' ? location.pathname === href || (location.pathname.startsWith(href) && !location.pathname.startsWith('/community/profile/') && !location.pathname.startsWith('/community/settings/')) : location.pathname === href;
          if (current) link.setAttribute('aria-current','page');
        } else { link.type = 'button'; link.addEventListener('click', () => openSheet()); }
        link.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + path + '"/></svg>';
        link.append(label); nav.appendChild(link);
      });
      document.body.classList.add('ppa-app-member'); document.body.appendChild(nav);
      const wrap = document.createElement('div'); wrap.className = 'pp-menu';
      const b = document.createElement('a'); b.href = '#'; b.className = cta ? cta.className.replace(/\bghost\b/, '') : 'btn small'; b.textContent = 'My account ▾'; b.setAttribute('aria-haspopup', 'true'); b.setAttribute('aria-expanded', 'false');
      const p = document.createElement('div'); p.className = 'ppx-sheet'; p.hidden = true;
      const l1 = document.createElement('a'); l1.href = '/portfolio/'; l1.textContent = 'My portfolio';
      const l2 = document.createElement('a'); l2.href = '/account/'; l2.textContent = 'My favorites';
      const l9 = document.createElement('a'); l9.href = '/account/watchlist/'; l9.textContent = 'My watchlist';
      const ldl = document.createElement('a'); ldl.href = '/downloads/'; ldl.textContent = 'Download Center';
      const lnot = document.createElement('a'); lnot.href = '/account/#pushhost'; lnot.textContent = 'Notifications';
      const lset = document.createElement('a'); lset.href = '/account/#settings'; lset.textContent = 'Settings';
      const l8 = document.createElement('a'); l8.href = '/learn/'; l8.textContent = 'Master Class';
      const ldon = document.createElement('a'); ldon.href = '/donate/'; ldon.textContent = 'Support the site';
      const lp = document.createElement('a'); lp.href = '/plans/'; lp.textContent = 'Free vs Pro';
      const lcm = document.createElement('a'); lcm.href = '/community/'; lcm.textContent = 'Community';
      const lpf = document.createElement('a'); lpf.href = '/community/profile/'; lpf.textContent = 'Profile';
      const lcam = document.createElement('a'); lcam.href = '/cams/'; lcam.textContent = 'Live Cams';
      const lmsg = document.createElement('a'); lmsg.href = '/messages/'; lmsg.textContent = 'Messages';
      fetch('/.netlify/functions/messages?unread=1', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => { const n = d ? (d.unread || 0) + (d.requests || 0) : 0; if (n) { const b = document.createElement('b'); b.textContent = n > 99 ? '99+' : String(n); b.style.cssText = 'margin-left:8px;min-width:20px;height:20px;border-radius:10px;background:#d70015;color:#fff;font-size:.72rem;display:inline-grid;place-items:center;padding:0 5px'; (lmsg.querySelector('span') || lmsg).append(b); } }).catch(() => {});
      const lrt = document.createElement('a'); lrt.href = '/retail/'; lrt.textContent = 'Retail Alerts';
      const lcalc = document.createElement('a'); lcalc.href = '/tools/calculator/'; lcalc.textContent = 'Lien calculator';
      const isPro = user.owner || user.paid;
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
      // ---- menu look (own class names, so older menu styles cannot reach it)
      const ico = d => '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
      const el = (tag, cls, txt) => { const x = document.createElement(tag); if (cls) x.className = cls; if (txt != null) x.textContent = txt; return x; };
      const aiMain = aiLink || el('a', '', 'Map'); if (!aiLink) aiMain.href = '/map/';
      const tile = (a, label, svg, hi) => { a.textContent = ''; a.className = 'ppx-tile' + (hi ? ' ppx-hi' : ''); a.innerHTML = ico(svg); a.appendChild(el('span', '', label)); return a; };
      const tiles = el('div', 'ppx-tiles');
      tiles.append(
        tile(lpf, 'Profile', '<circle cx="12" cy="6.5" r="4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2"/>', true),
        tile(aiMain, isPro ? 'Map + AI' : 'Map', '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
        tile(l1, 'Portfolio', '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
        tile(l8, 'Master Class', '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5"/>'));
      const rowOf = (a, svg, label) => { const t = label || a.textContent; a.textContent = ''; a.className = 'ppx-row'; a.innerHTML = ico(svg); a.appendChild(el('span', '', t)); const chevron = el('i', '', '\u203a'); chevron.setAttribute('aria-hidden', 'true'); a.appendChild(chevron); return a; };
      if (!isPro) { ldl.href = '/plans/?src=Download%20Center'; ldl.textContent = 'Download Center · Pro'; }
      const list = el('div', 'ppx-list');
      list.append(
        rowOf(l9, '<path d="M6 3h12v18l-6-4-6 4z"/>', 'Watchlist'),
        rowOf(lcm, '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.6 3-6 7-6s7 2.4 7 6"/><circle cx="17" cy="7" r="2.5"/><path d="M22 18c0-2.6-1.8-4.5-4.5-4.8"/>'),
        rowOf(ldl, '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>'));
      const bellIcon = '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21h4"/>';
      const more = el('details', 'ppx-more'); more.open = true; more.appendChild(el('summary', '', 'More'));
      const mg = el('div', 'ppx-grp');
      mg.append(
        rowOf(lmsg, '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>', 'Messages'),
        rowOf(lcam, '<rect x="2" y="5" width="14" height="14" rx="2"/><path d="m16 9 6-3v12l-6-3"/>'),
        rowOf(lcalc, '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 11h2m4 0h2M8 15h2m4 0h2M8 19h2m4 0h2"/>'),
        rowOf(lrt, bellIcon + '<path d="M3 6 2 9m19-3 1 3"/>'));
      lnot.href = '/notifications/';
      mg.appendChild(rowOf(lnot, bellIcon));
      more.appendChild(mg);
      const ownerBox = user.owner ? el('div', 'ppx-own') : null;
      if (ownerBox) { const ownerLink = el('a', '', 'Owner Dashboard →'); ownerLink.href = '/owner/'; ownerLink.dataset.tool = 'owner dashboard'; ownerBox.appendChild(ownerLink); }
      const fullAi = el('a', '', 'PricePocket AI · Pro'); fullAi.href = isPro ? '/ai/' : '/plans/?src=PricePocket%20AI';
      const hd = el('div', 'ppx-hd');
      const av3 = el('div', 'ppx-av');
      const initial = el('span', '', '?'); initial.setAttribute('aria-hidden','true');
      const portrait = el('a', 'ppx-av-link'); portrait.href = lpf.href; portrait.setAttribute('aria-label','Open profile');
      av3.append(initial,portrait);
      const camera = el('a', 'ppx-camera');
      camera.href = '/community/settings/';
      camera.setAttribute('aria-label', 'Edit profile photo');
      camera.innerHTML = ico('<path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="4"/>');
      av3.appendChild(camera);
      const nm = el('div', 'ppx-nm', 'My profile');
      const handle = el('div', 'ppx-user'); handle.hidden = true;
      const inf = el('a', 'ppx-inf'); inf.href = lpf.href; inf.append(nm, handle, el('span', 'ppx-role', user.owner ? 'Owner' : (isPro ? 'Pro' : 'Free')));
      const close = el('button', 'ppx-x', '\u00d7'); close.type = 'button'; close.setAttribute('aria-label', 'Close menu');
      hd.append(av3, inf, close);
      const search = el('div', 'ppx-search');
      search.innerHTML = ico('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>');
      const find = el('input', 'ppx-find'); find.type = 'search'; find.placeholder = 'Find a tool'; find.setAttribute('aria-label', 'Find a tool');
      search.appendChild(find);
      const foot = el('div', 'ppx-foot');
      const extras = el('div', 'ppx-grp'); extras.append(l2, fullAi, lset, lp, ldon); if (ms) extras.append(ms); extras.append(out); foot.appendChild(extras);
      const brandbar = el('div', 'ppx-brandbar');
      const brand = el('a', 'ppx-brand'); brand.href = '/';
      const mark = el('img'); mark.src = '/img/logo-mark.png'; mark.alt = '';
      const brandName = el('span', '', 'PricePocket'); brandName.append(el('em', '', isPro ? 'Pro' : 'Asset')); brand.append(mark, brandName);
      const menuBell = el('a', 'ppx-bell'); menuBell.href = '/notifications/'; menuBell.setAttribute('aria-label', 'Notifications'); menuBell.innerHTML = ico(bellIcon);
      const menuButton = el('button', 'ppx-account', 'My account ▾'); menuButton.type = 'button'; menuButton.setAttribute('aria-label', 'Close account menu');
      brandbar.append(brand, menuBell, menuButton);
      const secondary = el('div', 'ppx-secondary');
      if (ownerBox) secondary.appendChild(ownerBox);
      secondary.appendChild(foot);
      const drag = el('div', 'ppx-drag'); drag.append(el('div', 'ppx-handle')); drag.setAttribute('aria-hidden','true');
      const empty = el('p', 'ppx-empty', 'No tools match your search.'); empty.hidden = true; empty.setAttribute('role', 'status');
      const body = el('div', 'ppx-body'); body.append(drag, hd, search, empty, tiles, list, more, secondary);
      p.id = 'ppx-account-menu'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Account menu');
      b.setAttribute('aria-haspopup', 'dialog'); b.setAttribute('aria-controls', p.id);
      p.append(brandbar, body);
      const tools = [...body.querySelectorAll('.ppx-tile,.ppx-row,.ppx-grp a,.ppx-grp button,.ppx-own a')];
      tools.forEach(item => { item.dataset.tool = item.textContent.toLowerCase(); });
      find.addEventListener('input', () => {
        const q = find.value.trim().toLowerCase();
        tools.forEach(item => { item.hidden = !!q && !item.dataset.tool.includes(q); });
        empty.hidden = !q || tools.some(item => !item.hidden);
        for (const group of [tiles, list, more, ownerBox, foot].filter(Boolean)) {
          group.hidden = !group.querySelector('[data-tool]:not([hidden])');
          if (q && group.tagName === 'DETAILS' && !group.hidden) group.open = true;
        }
        secondary.hidden = foot.hidden && (!ownerBox || ownerBox.hidden);
      });
      wrap.append(b);
      const backdrop = el('div', 'ppx-backdrop'); backdrop.hidden = true;
      document.body.appendChild(backdrop);
      let requestedProfile = false, returnFocus = null;
      p.setAttribute('aria-modal','true');
      const openSheet = () => {
        returnFocus = document.activeElement; backdrop.hidden = false; p.hidden = false; p.scrollTop = 0; b.setAttribute('aria-expanded', 'true'); close.focus({preventScroll:true});
        if (requestedProfile) return;
        requestedProfile = true;
        fetch('/.netlify/functions/community?me=1', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(data => {
          const profile = data?.me;
          if (!profile) { requestedProfile = false; return; }
          if (profile.name) { nm.textContent = profile.name; initial.textContent = profile.name.charAt(0).toUpperCase(); }
          if (profile.username) { handle.textContent = '@' + profile.username; handle.hidden = false; }
          if (profile.photo) {
            const photo = el('img'); photo.src = profile.photo; photo.alt = '';
            photo.addEventListener('error', () => photo.remove(), { once:true }); portrait.append(photo);
          }
        }).catch(() => { requestedProfile = false; });
      };
      const closeSheet = (focus = false) => { p.hidden = true; backdrop.hidden = true; b.setAttribute('aria-expanded', 'false'); if (focus) (returnFocus || b).focus(); };
      backdrop.addEventListener('click', () => closeSheet(true));
      p.addEventListener('keydown', e => {
        if (e.key !== 'Tab') return;
        const items = [...p.querySelectorAll('a[href],button:not([disabled]),input,summary')].filter(x => x.getClientRects().length);
        const first = items[0], last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      });
      let dragStart = null;
      drag.addEventListener('pointerdown', e => { dragStart = e.clientY; drag.setPointerCapture(e.pointerId); });
      drag.addEventListener('pointermove', e => {
        if (dragStart != null) p.style.translate = '0 ' + Math.max(0,e.clientY - dragStart) + 'px';
      });
      const endDrag = e => {
        if (dragStart != null && e.type !== 'pointercancel' && e.clientY - dragStart > 70) closeSheet(true);
        p.style.translate = ''; dragStart = null;
      };
      drag.addEventListener('pointerup', endDrag); drag.addEventListener('pointercancel', endDrag);
      close.addEventListener('click', () => closeSheet(true));
      menuButton.addEventListener('click', () => closeSheet(true));
      b.addEventListener('click', e => { e.preventDefault(); if (p.hidden) openSheet(); else closeSheet(); });
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && !p.hidden) { e.preventDefault(); closeSheet(true); } });
      document.addEventListener('click', e => { if (!p.hidden && !wrap.contains(e.target) && !p.contains(e.target)) closeSheet(); });
      document.body.appendChild(p);
      // the bell: one count for messages, follows, likes, comments and retail alerts
      const bell = document.createElement('a'); bell.href = '/notifications/'; bell.className = 'pp-bell'; bell.setAttribute('aria-label', 'Notifications'); bell.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
      fetch('/.netlify/functions/notifications?count=1', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => { if (d && d.count) { const n = document.createElement('b'); n.textContent = d.count > 99 ? '99+' : String(d.count); bell.append(n); menuBell.append(n.cloneNode(true)); menuBell.setAttribute('aria-label', 'Notifications, ' + d.count + ' new'); bell.setAttribute('aria-label', 'Notifications, ' + d.count + ' new'); } }).catch(() => {});
      wrap.insertBefore(bell, wrap.firstChild);
      // hairline appears only after scrolling
      if (header && !window.__ppScrollBound) { window.__ppScrollBound = 1; const on = () => header.classList.toggle('pp-scrolled', scrollY > 6); addEventListener('scroll', on, { passive: true }); on(); }
      if (cta) cta.replaceWith(wrap);
      else { const nav = header && header.querySelector('nav'); (nav || header || document.body).appendChild(wrap); }
      // group the header actions on the right: back, bell, account
      const hdr = header; if (hdr && wrap.parentNode && wrap.parentNode.tagName === 'NAV') { const grp2 = document.createElement('div'); grp2.className = 'pp-hdr-r'; wrap.parentNode.insertBefore(grp2, wrap); grp2.append(wrap); }

      // signed-in people do not need the newsletter prompts
      const c = document.getElementById('contact'); if (c) c.hidden = true;
      document.querySelectorAll('a[href$="#contact"]').forEach(a => { const holder = a.closest('p'); (holder || a).hidden = true; });
    } else {
      const next = encodeURIComponent(location.pathname + location.search);
      navLinks.forEach(a => { a.textContent = 'Sign in'; a.href = '/login/?next=' + next; });
      if (location.pathname.indexOf('/login') === 0 || header?.classList.contains('app-bar')) return;
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
  if (document.body.classList.contains('ppa-home') || document.body.classList.contains('ppa-auth')) return;
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
    if (location.pathname !== '/' && location.pathname !== '/index.html') return;
    if (document.body.classList.contains('ppa-home') && document.getElementById('install')) return;
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
