// Web Push (OneSignal v16). Loaded only where it is needed: the account page, and any page on a device that already turned
// notifications on. Nothing here asks for permission by itself: the browser prompt appears only after the member taps "Enable".
// The member's account is tied to their device with an opaque external id (OneSignal.login) and untied on sign out (OneSignal.logout).
(function () {
  if (window.PPPush) return;
  const APP = '0bfd191b-3015-40ad-9765-952203f0e2ea', FN = '/.netlify/functions/push', SDK = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js', FLAG = 'ppPushDevice';
  const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } } };
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = !!(navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches));
  let loading = null;

  // One OneSignal for the whole page: guarded so a second include or a second call never initializes twice.
  function load(appId) {
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async OS => {
        try {
          if (!window.__ppOneSignalInit) { window.__ppOneSignalInit = true; await OS.init({ appId, serviceWorkerPath: 'OneSignalSDKWorker.js', serviceWorkerParam: { scope: '/' }, notifyButton: { enable: false }, allowLocalhostAsSecureOrigin: true,
            // The OneSignal dashboard has an automatic subscribe prompt. Turn every automatic prompt off here: permission is asked only when the member taps Enable.
            promptOptions: { slidedown: { prompts: [{ type: 'push', autoPrompt: false, text: { actionMessage: 'Get alerts about your watchlist, upcoming sales and deadlines.', acceptButton: 'Allow', cancelButton: 'Not now' } }] } }, welcomeNotification: { disable: true } }); }
          resolve(OS);
        } catch (e) { loading = null; window.__ppOneSignalInit = false; reject(e); }
      });
      if (!document.querySelector('script[data-ppos]')) { const s = document.createElement('script'); s.src = SDK; s.defer = true; s.dataset.ppos = '1'; s.onerror = () => { loading = null; reject(new Error('Could not load the notification service.')); }; document.head.appendChild(s); }
    });
    return loading;
  }
  const api = async (method, body) => { const r = await fetch(FN, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined }); let d = {}; try { d = await r.json(); } catch (e) { /* empty */ } return { ok: r.ok, status: r.status, d }; };
  const withTO = (p, ms, label) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout:' + label)), ms))]);
  const timeout = (p, ms) => Promise.race([p, new Promise(res => setTimeout(() => res(null), ms))]);

  // Called on every page by auth-nav.js with the signed-in user (or null). Keeps the device tied to the right account.
  async function sync(user) {
    if (store.get(FLAG) !== '1') return; // this device never turned notifications on: do nothing, load nothing
    try {
      if (!user) { const OS = await timeout(load(APP), 4000); if (OS && OS.logout) await OS.logout(); return; }
      const r = await api('GET'); if (!r.ok) return;
      const OS = await load(r.d.appId);
      if (r.d.prefs && r.d.prefs.enabled && r.d.pushId) await OS.login(r.d.pushId); else await OS.logout(); // another account on this device is NOT tied unless it turned notifications on itself
    } catch (e) { /* never break the page */ }
  }
  async function logout() { if (store.get(FLAG) !== '1') return; try { const OS = await timeout(load(APP), 3000); if (OS && OS.logout) await timeout(OS.logout(), 3000); } catch (e) { /* ignore */ } }

  // ---- Settings card on the account page ----
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const CATS = [['newProps', 'New properties', 'When we import a new official list for a state you follow'], ['auctions', 'Upcoming auctions', 'Sales an official county page lists within 7 days, for your states'], ['watchlist', 'Watchlist updates', 'Changes on parcels you watch'], ['portfolio', 'Portfolio reminders', 'Deadlines you saved, 7 days and 1 day before']];
  async function mount(host, user) {
    host.textContent = '';
    const card = mk('div', 'salebox pushbox'); card.appendChild(mk('h3', '', 'Notifications'));
    host.appendChild(card);
    const paid = !!(user && (user.owner || user.paid || (user.paidThrough && user.paidThrough >= new Date().toISOString().slice(0, 10))));
    if (!paid) { card.append(mk('p', 'small muted', 'Push notifications are a Pro feature: alerts for new lists, upcoming sales, watchlist changes and your deadlines.'), Object.assign(mk('a', 'btn ghost', 'See Pro'), { href: '/plans/' })); return; }
    const status = mk('p', '', 'Checking…'), msg = mk('p', 'small', ''); msg.setAttribute('role', 'status'); msg.setAttribute('aria-live', 'polite');
    const btns = mk('p', 'pushbtns'), en = mk('button', 'btn', 'Enable notifications'), off = mk('button', 'btn ghost', 'Turn off on this device'), test = mk('button', 'btn ghost', 'Send a test notification');
    [en, off, test].forEach(b => { b.type = 'button'; }); btns.append(en, off, test);
    const prefs = mk('fieldset', 'pushprefs'); prefs.appendChild(Object.assign(mk('legend', 'small', 'Send me'), {})); const boxes = {};
    CATS.forEach(([k, t, d]) => { const l = mk('label', 'pushrow'), cb = mk('input'); cb.type = 'checkbox'; boxes[k] = cb; const s = mk('span'); s.append(mk('b', '', t), mk('span', 'small muted', ' ' + d)); l.append(cb, s); prefs.appendChild(l); });
    card.append(status, btns, msg, prefs, mk('p', 'small muted', 'Notifications only say what an official record shows (a list was imported, a page lists a sale date, a deadline you saved). They never say a property is available. Confirm everything with the county.'));
    const say = (t, bad) => { msg.textContent = t || ''; msg.style.color = bad ? '#f87171' : ''; };
    let st = (await api('GET')); if (!st.ok) { status.textContent = 'Notifications are unavailable right now.'; en.hidden = off.hidden = test.hidden = true; prefs.hidden = true; return; }
    let cfg = st.d, OS = null, optedIn = false;
    const needInstall = isIOS && !standalone;
    async function refresh() {
      let perm = 'default'; try { perm = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'; } catch (e) { /* none */ }
      if (OS) { try { optedIn = !!(OS.User.PushSubscription.optedIn && OS.Notifications.permission); } catch (e) { /* keep */ } }
      const on = !!(cfg.prefs.enabled && cfg.prefs.subscribed && (optedIn || !OS));
      status.textContent = needInstall ? 'On iPhone, notifications work from the Home Screen app. Open Share, tap "Add to Home Screen", then open PricePocketPro from your Home Screen and come back here.' : perm === 'denied' ? 'Blocked in your browser settings. Allow notifications for this site there, then reload.' : on ? 'On for this device.' : 'Off.';
      en.hidden = needInstall || on || perm === 'denied' || perm === 'unsupported'; off.hidden = !on; test.hidden = !on; prefs.hidden = !cfg.prefs.enabled;
      CATS.forEach(([k]) => { boxes[k].checked = !!cfg.prefs[k]; });
      if (!cfg.configured) say('Notifications are not switched on for the site yet, so nothing will be delivered.', true);
    }
    en.addEventListener('click', async () => {
      en.disabled = true; say('One moment…');
      try {
        OS = await load(cfg.appId);
        if (!OS.Notifications.isPushSupported()) { say('This browser does not support push notifications.', true); return; }
        await OS.Notifications.requestPermission(); // the browser prompt: only now, after the member tapped Enable
        if (!OS.Notifications.permission) { say('Permission was not given, so nothing was turned on.', true); await refresh(); return; }
        await withTO(OS.login(cfg.pushId), 12000, 'login'); await withTO(OS.User.PushSubscription.optIn(), 12000, 'optIn');
        const r = await api('POST', { action: 'enable', enabled: true, subscribed: true }); if (!r.ok) { say(r.d.error || 'Could not save.', true); return; }
        cfg.prefs = r.d.prefs; store.set(FLAG, '1'); say(''); await refresh();
      } catch (e) { say(/timeout:login/.test(String(e && e.message)) ? 'This device is subscribed, but OneSignal did not link it to your account. In OneSignal, turn OFF Token Identity Verification (Settings > Keys & IDs), then tap Enable again.' : /timeout:/.test(String(e && e.message)) ? 'OneSignal is taking too long. Please try again.' : /only be used on|origin/i.test(String(e && (e.message || e))) ? 'Notifications can only be turned on at pricepocketasset.com (not on a preview address).' : 'Could not turn notifications on. Please try again.', true); } finally { en.disabled = false; }
    });
    off.addEventListener('click', async () => { off.disabled = true; try { OS = OS || await load(cfg.appId); await OS.User.PushSubscription.optOut(); } catch (e) { /* still turn off on our side */ } const r = await api('POST', { action: 'enable', enabled: false }); if (r.ok) { cfg.prefs = r.d.prefs; optedIn = false; say('Notifications are off.'); } off.disabled = false; await refresh(); });
    test.addEventListener('click', async () => { test.disabled = true; say('Sending…'); const r = await api('POST', { action: 'test' }); say(r.ok ? 'Sent. It should arrive in a few seconds.' : (r.d.error || 'Could not send.'), !r.ok); test.disabled = false; });
    CATS.forEach(([k]) => boxes[k].addEventListener('change', async () => { const r = await api('POST', { action: 'prefs', prefs: { [k]: boxes[k].checked } }); if (r.ok) { cfg.prefs = r.d.prefs; say('Saved.'); } else { boxes[k].checked = !boxes[k].checked; say(r.d.error || 'Could not save.', true); } }));
    if (store.get(FLAG) === '1' || cfg.prefs.enabled) { try { OS = await timeout(load(cfg.appId), 6000); } catch (e) { /* show state without the SDK */ } }
    await refresh();
  }
  window.PPPush = { sync, logout, mount, _isIOS: isIOS, _standalone: standalone };
})();
