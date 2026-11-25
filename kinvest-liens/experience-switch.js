// Experience switch: Price Pocket Assets | Price Pocket Retail.
// Loaded by auth-nav.js on every Assets page, and directly by the Retail homepage. It puts a compact control after
// the logo in the page header, fades the page out, and lets the next page fade in. Retail lives at /price-pocket-retail/
// (the existing /retail/ page is Retail Alerts). Assets returns to the last Assets page visited in this tab.
(function () {
  'use strict';
  if (window.__ppxSwitch) return;
  window.__ppxSwitch = true;
  const RETAIL = '/price-pocket-retail/';
  // Retail pages: the Retail homepage and the Retail Alerts pages (/retail/ and the owner's /owner/retail/).
  const onRetail = /^\/(price-pocket-retail|retail|owner\/retail)(\/|$)/.test(location.pathname);
  const root = document.documentElement;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LAST = 'ppx-last-assets', ENTER = 'ppx-enter';
  const store = {
    get: k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) { /* private mode: the links still work */ } },
    del: k => { try { sessionStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };
  if (!onRetail) store.set(LAST, location.pathname + location.search);

  if (!document.querySelector('link[href="/experience-switch.css"]')) {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/experience-switch.css'; document.head.appendChild(css);
  }

  // Arriving from the other experience: the page starts hidden and fades in.
  if (store.get(ENTER) && !reduced()) {
    store.del(ENTER);
    root.classList.add('ppx-entering');
    setTimeout(() => root.classList.remove('ppx-entering'), 520);
  } else store.del(ENTER);

  function go(href, target) {
    if (reduced()) { location.assign(href); return; }
    store.set(ENTER, target);
    root.classList.add('ppx-leaving');
    setTimeout(() => location.assign(href), 280);
  }

  const BRAND = 'a.logo, a.app-brand, a.dlogo, a.pprt-brand';
  const HEADERS = 'header.nav, header.dnav, header.app-bar, header.pprt-bar';
  function mount() {
    const header = document.querySelector(HEADERS);
    if (!header) return false;
    if (header.querySelector('.ppx-switch')) return true;
    const brand = header.querySelector(BRAND);
    if (!brand) return false;
    // A div with the navigation role, not a <nav>: the site hides links inside header <nav> elements on phones.
    const sw = document.createElement('div');
    sw.className = 'ppx-switch' + (onRetail ? ' ppx-switch--retail' : '');
    sw.setAttribute('role', 'navigation');
    sw.setAttribute('aria-label', 'Choose experience');
    const assets = document.createElement('a'), retail = document.createElement('a');
    assets.href = onRetail ? (store.get(LAST) || '/') : location.pathname + location.search;
    assets.textContent = 'Assets';
    retail.href = RETAIL; retail.textContent = 'Retail';
    (onRetail ? retail : assets).setAttribute('aria-current', 'page');
    [assets, retail].forEach(link => link.addEventListener('click', e => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;   // let the browser open a new tab
      e.preventDefault();
      if (link === assets && !onRetail) return;                                        // already here
      go(link.href, link === retail ? 'retail' : 'assets');
    }));
    sw.append(assets, retail);
    brand.insertAdjacentElement('afterend', sw);
    fitHeader();
    return true;
  }
  // A bar that overflows gets the switch on its own line. Checked once the account menu is in place, and on resize.
  function fitHeader() {
    const h = document.querySelector(HEADERS);
    if (!h || !h.querySelector('.ppx-switch')) return;
    h.classList.remove('ppx-own-line');
    if (h.scrollWidth > h.clientWidth + 1) h.classList.add('ppx-own-line');
  }
  if (window.ppaAccount) window.ppaAccount.then(() => setTimeout(fitHeader, 0));
  let fitQueued = false;
  window.addEventListener('resize', () => { if (fitQueued) return; fitQueued = true; requestAnimationFrame(() => { fitQueued = false; fitHeader(); }); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitHeader);
  setTimeout(fitHeader, 300);
  // Back and forward can restore a page that was mid-fade from the browser cache: show it again.
  window.addEventListener('pageshow', e => { if (e.persisted) root.classList.remove('ppx-leaving', 'ppx-entering'); });
  // Headers can be built after this script runs (the account header does this), so keep watching until the switch is in.
  if (!mount()) {
    const obs = new MutationObserver(() => { if (mount()) obs.disconnect(); });
    obs.observe(document.body || root, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', () => { if (mount()) obs.disconnect(); });
  }
})();
