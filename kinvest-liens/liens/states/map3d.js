// 3D look for the lot maps (the Leaflet maps inside dialogs): a gentle tilt, a raised-card shadow and a slow sway.
// The tilt flattens while the map is being touched, dragged or zoomed so panning and taps stay exact, then eases back.
(function () {
  if (window.Map3D) return; window.Map3D = true;
  const REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  function wire(el) {
    if (el._m3d || !el.closest('dialog')) return; el._m3d = true; el.classList.add('m3d');
    if (REDUCED) el.classList.add('still');
    let t = null; const flat = () => { el.classList.add('flat'); clearTimeout(t); t = setTimeout(() => el.classList.remove('flat'), 2200); };
    ['pointerdown', 'touchstart', 'wheel', 'mousedown', 'keydown'].forEach(n => el.addEventListener(n, flat, {passive: true}));
  }
  const scan = root => (root.querySelectorAll ? root.querySelectorAll('.leaflet-container') : []).forEach(wire);
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType !== 1) return; if (n.classList && n.classList.contains('leaflet-container')) wire(n); else scan(n); }))).observe(document.documentElement, {childList: true, subtree: true});
  scan(document);
})();
