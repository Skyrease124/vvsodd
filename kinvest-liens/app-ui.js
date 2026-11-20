(function () {
  const paths = {
    email:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
    bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 9h18c0-1-3-2-3-9M10 21h4"/>',
    tag:'<path d="M3 12 12 3h8v8l-9 9z"/><circle cx="16" cy="7" r="1"/>',
    userplus:'<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a7 7 0 0 1 14 0v2m4-12v8m-4-4h8"/>',
    crown:'<path d="m2 7 5 4 5-7 5 7 5-4-3 11H5zM5 21h14"/>',
    check:'<path d="m4 12 5 5L20 6"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8v.1"/>',
    home:'<path d="m3 11 9-8 9 8v10h-6v-6H9v6H3z"/>',
    profile:'<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    map:'<path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2zm6-2v14m6-12v14"/>',
    chart:'<path d="M4 20h17M7 17v-5m5 5V7m5 10V4"/>',
    learn:'<path d="m2 9 10-5 10 5-10 5zm4 2v6c3 4 9 4 12 0v-6"/>',
    layers:'<path d="m3 8 9-5 9 5-9 5zm0 5 9 5 9-5M3 18l9 5 9-5"/>',
    bookmark:'<path d="M6 3h12v18l-6-4-6 4z"/>',
    community:'<circle cx="9" cy="8" r="3.4"/><path d="M2 21v-2a7 7 0 0 1 14 0v2m0-16a3 3 0 0 1 0 6m3 3a5 5 0 0 1 3 5v2"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/>',
    spark:'<path d="m12 2 2 7 7 3-7 2-2 8-2-8-7-2 7-3z"/>',
    file:'<path d="M6 3h8l4 4v14H6zm8 0v5h4M9 13h6m-6 4h6"/>',
    pin:'<path d="M12 22s-7-7-7-13a7 7 0 0 1 14 0c0 6-7 13-7 13z"/><circle cx="12" cy="9" r="2"/>'
  };
  const icon = name => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] || '') + '</svg>';
  window.ppaIcon = icon;
  document.querySelectorAll('[data-icon]').forEach(node => { node.innerHTML = icon(node.dataset.icon); });
  if (!document.body.classList.contains('ppa-home')) return;
  const update = user => {
    if (!user) return;
    const paid = !!(user.paid || user.owner);
    const plan = document.querySelector('[data-app-plan]'); plan.hidden = false; plan.textContent = user.owner ? 'Owner' : paid ? 'Pro plan' : 'Free plan';
    fetch('/.netlify/functions/watch?action=watching').then(r => r.ok ? r.json() : null).then(data => {
      if (!Array.isArray(data?.keys)) return;
      const count = data.keys.length;
      document.querySelector('[data-saved]').textContent = count === 1 ? '1 saved property' : count.toLocaleString() + ' saved properties';
    }).catch(() => {});
    if (paid) {
      document.querySelector('[data-map-label]').textContent = 'Map + AI';
      const ai = document.querySelector('[data-full-ai]'); ai.href = '/ai/'; ai.querySelector('[data-icon]').innerHTML = icon('spark');
      document.querySelector('[data-upgrade]').hidden = true;
    }
  };
  if (window.ppaAccount) window.ppaAccount.then(update); else window.addEventListener('ppa:account', e => update(e.detail), {once:true});
  const loc = window.ppaLocation;
  const areaLink = document.querySelector('[data-open-map]');
  const recentLink = document.querySelector('[data-recent-link]');
  const showArea = area => {
    areaLink.href = loc.mapPath(area);
    document.querySelector('[data-recent-label]').textContent = area?.parcel ? 'Recent parcel' : area ? 'Map area' : 'Explore the map';
    document.querySelector('[data-recent]').textContent = area ? area.label || 'Current map area' : 'Search parcels & counties';
    recentLink.href = areaLink.href;
  };
  loc.subscribe(showArea); loc.ready().then(showArea);
  const device = document.querySelector('[data-use-location]');
  const status = document.querySelector('[data-location-status]');
  device.addEventListener('click', async () => {
    device.disabled = true; status.textContent = 'Finding location…';
    try { await loc.useDevice(); status.textContent = ''; }
    catch(e) { status.textContent = 'Location unavailable'; }
    finally { device.disabled = false; }
  });
  try {
    if (!loc.get() && !loc.isCleared() && localStorage.getItem('ppa_auto_location') === '1' && !sessionStorage.getItem('ppa_auto_loc_tried')) {
      sessionStorage.setItem('ppa_auto_loc_tried', '1'); device.click();
    }
  } catch(e) { /* optional storage */ }
  const mapWorkspace = document.getElementById('map');
  const mapViews = [...mapWorkspace.querySelectorAll('[data-home-map-view]')];
  function showMapView(view) {
    for (const control of mapViews) {
      const selected = control.dataset.homeMapView === view;
      control.setAttribute('aria-pressed', String(selected));
      document.getElementById(control.getAttribute('aria-controls')).hidden = !selected;
    }
  }
  for (const control of mapViews) control.addEventListener('click', () => showMapView(control.dataset.homeMapView));
  const openRadarLink = event => {
    event.preventDefault();
    showMapView('radar');
    mapWorkspace.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
    mapViews[1].focus({preventScroll:true});
  };
  document.querySelector('[data-open-radar]').addEventListener('click', openRadarLink);
  document.getElementById('home-radar').addEventListener('click', event => {
    const link = event.target.closest('[data-radar-parcel-state]');
    const state = link && mapWorkspace.querySelector('iframe').contentDocument?.querySelector('select[aria-label="State"]');
    if (!state || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    showMapView('parcels');
    state.value = link.dataset.radarParcelState;
    state.dispatchEvent(new Event('change'));
    mapWorkspace.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
    mapViews[0].focus({preventScroll:true});
  });
  if (location.hash === '#map') showMapView('radar');
  window.addEventListener('hashchange', () => { if (location.hash === '#map') showMapView('radar'); });
  const header = document.querySelector('.dnav');
  let frame = 0;
  addEventListener('scroll', () => {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = 0; header.classList.toggle('app-scrolled', scrollY > 12); });
  }, {passive:true});
})();
