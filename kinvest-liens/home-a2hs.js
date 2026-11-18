// Home page: "Put PricePocket on your Home Screen". Steps for iPhone, Android and computer, with the device picked for you. Hidden once the site is installed.
(function () {
  'use strict';
  const about = document.querySelector('#about .narrow'); if (!about || document.getElementById('a2hsCard')) return;
  const standalone = !!(navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches)); // installed: the card still shows, as a confirmation, with the steps tucked away for sharing
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const ico = {
    share: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    dots: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
    dl: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7.5 11 12 15.5 16.5 11"/><path d="M5 20h14"/></svg>',
    safari: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5Z"/></svg>'
  };
  const TABS = {
    ios: { name: 'iPhone', steps: [['safari', 'Open in Safari', 'Visit pricepocketasset.com in Safari. (Other iPhone browsers can’t add it.)'], ['share', 'Tap Share', 'The square with an arrow, in the bar at the bottom of the screen.'], ['plus', 'Add to Home Screen', 'Scroll down the share sheet and tap “Add to Home Screen”.'], ['check', 'Tap Add', 'The PricePocket icon appears on your Home Screen. Open the site from it.']], tip: 'On iPhone, push notifications only work from the Home Screen icon.' },
    android: { name: 'Android', steps: [['safari', 'Open in Chrome', 'Visit pricepocketasset.com in Chrome.'], ['dots', 'Open the menu', 'Tap the ⋮ menu at the top right.'], ['dl', 'Install app', 'Tap “Install app” or “Add to Home screen”.'], ['check', 'Tap Install', 'Open PricePocket from the new icon.']], tip: 'Installed, it opens full screen like an app.' },
    pc: { name: 'Computer', steps: [['safari', 'Open in Chrome or Edge', 'Visit pricepocketasset.com.'], ['dl', 'Click the install icon', 'At the right end of the address bar (or open the browser menu).'], ['check', 'Choose Install', 'Pick “Install PricePocketAsset”. It opens in its own window.']], tip: 'Pin it to your taskbar or dock for one-click access.' }
  };
  const ua = navigator.userAgent, ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1), android = /Android/i.test(ua);
  let cur = ios ? 'ios' : android ? 'android' : 'pc';
  const card = mk('section', 'a2c'); card.id = 'a2hsCard'; card.setAttribute('aria-labelledby', 'a2hsh');
  const head = mk('div', 'a2c-head'), icon = mk('div', 'a2c-icon'); const img = mk('img'); img.src = '/img/apple-touch-icon.png'; img.alt = ''; img.width = 56; img.height = 56; icon.appendChild(img);
  const tx = mk('div'); const h = mk('h3', '', standalone ? 'PricePocket is on your Home Screen' : 'Put PricePocket on your Home Screen'); h.id = 'a2hsh'; tx.append(h, mk('p', '', standalone ? 'Opens in one tap, full screen.' : 'One tap to open, full screen, and push notifications for your watchlist, sales and deadlines.')); head.append(icon, tx);
  const seg = mk('div', 'a2c-seg'); seg.setAttribute('role', 'tablist'); seg.setAttribute('aria-label', 'Device');
  const body = mk('div', 'a2c-body'); body.setAttribute('aria-live', 'polite');
  function draw() {
    const T = TABS[cur]; body.textContent = ''; seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.k === cur)));
    const ol = mk('ol', 'a2c-steps'); T.steps.forEach(([ic, t, d], i) => { const li = mk('li'); li.style.setProperty('--i', i); const n = mk('span', 'n'); n.innerHTML = ico[ic]; const x = mk('div'); x.append(mk('b', '', t), mk('span', '', d)); li.append(n, x); ol.appendChild(li); }); body.appendChild(ol);
    if (cur === 'ios') { const bar = mk('div', 'a2c-bar'); bar.setAttribute('aria-hidden', 'true'); const sh = mk('span', 'pulse'); sh.innerHTML = ico.share; const mkk = (s) => { const e = mk('span'); e.innerHTML = s; return e; }; bar.append(mkk('<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5-7 7 7 7"/></svg>'), mkk('<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg>'), sh, mkk('<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5h6v14H5zM13 5h6v14h-6z"/></svg>'), mkk('<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="13" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-3"/></svg>')); const cap = mk('span', 'a2c-cap', 'Safari’s bottom bar: tap the middle button'); body.append(bar, cap); }
    body.appendChild(mk('p', 'a2c-tip', T.tip));
  }
  Object.keys(TABS).forEach(k => { const b = mk('button', '', TABS[k].name); b.type = 'button'; b.dataset.k = k; b.setAttribute('role', 'tab'); b.addEventListener('click', () => { cur = k; draw(); }); seg.appendChild(b); });
  if (standalone) {
    card.classList.add('done'); const ok = mk('div', 'a2c-ok'); ok.innerHTML = ico.check; const ot = mk('div'); ot.append(mk('b', '', 'You\u2019re all set'), mk('span', '', 'PricePocket is on this Home Screen. Notifications, if you turned them on, work from here.')); ok.appendChild(ot);
    const det = mk('details', 'a2c-more'); det.appendChild(mk('summary', '', 'Show the steps (to set it up on another device)')); det.append(seg, body); card.append(head, ok, det); draw();
  } else { card.append(head, seg, body); draw(); }
  const anchor = about.querySelector('.abtbtns'); about.insertBefore(card, anchor || null);
})();
