// Camera previews come from the existing Pro-only camera API.
(function () {
  const host = document.getElementById('hcams');
  if (!host) return;
  const loc = window.ppaLocation;
  const mk = (tag, cls, text) => Object.assign(document.createElement(tag), {className:cls,textContent:text || ''});
  const places = [['Tampa, FL',27.9506,-82.4572],['Orlando, FL',28.5383,-81.3792],
    ['Miami, FL',25.7617,-80.1918],['Fort Myers Beach, FL',26.452,-81.9495],
    ['Los Angeles, CA',34.0522,-118.2437],['San Diego, CA',32.7157,-117.1611],['Austin, TX',30.2672,-97.7431]];
  const link = (text, href) => Object.assign(mk('a','',text),{href});
  const allLink = document.getElementById('hcAll');
  const grid = mk('div','hc-grid'), msg = mk('p','hc-msg'), options = mk('details','hc-options');
  options.append(mk('summary','','Browse other camera areas'));
  const chips = mk('div','hc-chips'); options.append(chips); host.append(grid,msg,options);
  let controller, refresh, started = false, currentKey;
  const plans = '/plans/?src=Live%20cameras';
  function locked() {
    options.hidden = true;
    allLink.href = plans;
    allLink.textContent = 'Compare plans →';
    const preview = link('', plans); preview.className = 'hc-locked-card';
    preview.append(mk('span','hc-locked-label','🔒 Live Cameras are a Pro feature'),
      mk('small','','Traffic and beach cameras · ' + (loc.get()?.label || 'Available regions')),mk('span','hc-locked-cta','Upgrade to Pro →'));
    grid.replaceChildren(preview); msg.textContent = '';
  }
  const path = (lat,lng,radius) => '/map/?' + new URLSearchParams({cams:'1',lat,lng,radius});
  async function load(area) {
    const key = [area?.lat,area?.lng,area?.label].join('|');
    if (key === currentKey) return;
    currentKey = key;
    clearInterval(refresh);
    controller?.abort();
    const job = new AbortController(); controller = job;
    grid.replaceChildren();
    allLink.href = '/cams/'; allLink.textContent = 'View all →';
    if (!loc.coordinates(area?.lat,area?.lng)) {
      msg.textContent = area?.label ? 'Choose a county or browse a camera area to see cameras in ' + area.label + '.' : 'Choose a map location or browse a camera area.';
      return;
    }
    const {lat,lng} = area, name = area.label || 'the map area', radius = 30;
    allLink.href = path(lat,lng,radius);
    msg.textContent = 'Finding cameras near ' + name + '…';
    try {
      const r = await fetch('/.netlify/functions/cameras?' + new URLSearchParams({lat,lng,radius,limit:4}), {signal:job.signal});
      if (job.signal.aborted) return;
      if (r.status === 401 || r.status === 402) { locked(); return; }
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error('unavailable');
      const cams = d.cameras.filter(c => c.image || c.video || c.viewer);
      msg.textContent = cams.length ? 'Near ' + name + ' · Swipe for more' : 'No cameras found near ' + name + '.';
      const update = cams.map(c => {
        const card = link('',path(c.lat,c.lng,15)); card.className = 'hc-card';
        const cap = mk('div','hc-cap'); cap.append(mk('b','',c.name),mk('span','',c.road || c.operator));
        grid.append(card);
        if (!c.image) {
          if (c.kind === 'viewer' && c.viewer?.startsWith('https://')) card.href = c.viewer;
          card.append(mk('span','hc-viewer',c.kind === 'viewer' ? 'Official camera ↗' : 'Open live camera →'),cap);
          return null;
        }
        const img = Object.assign(mk('img',''),{alt:'',loading:'lazy',decoding:'async',referrerPolicy:'no-referrer'});
        const set = () => { img.src = c.image + (c.image.includes('?') ? '&' : '?') + 't=' + Math.floor(Date.now()/60000); };
        img.onerror = () => card.classList.add('off');
        img.onload = () => card.classList.remove('off');
        card.append(img,cap); set(); return set;
      }).filter(Boolean);
      if (update.length) refresh = setInterval(() => { if (!document.hidden) update.forEach(set => set()); }, 60000);
    } catch(e) {
      if (!job.signal.aborted) { currentKey = null; msg.textContent = 'Cameras are temporarily unavailable.'; }
    }
  }
  places.forEach(([label,lat,lng]) => {
    const button = mk('button','hc-chip',label); button.type = 'button';
    button.addEventListener('click', () => { options.open = false; load({label,lat,lng}); });
    chips.append(button);
  });
  const go = async () => {
    if (started) return; started = true;
    const user = await window.ppaAccount;
    if (!user?.paid && !user?.owner) { locked(); loc.subscribe(locked); return; }
    loc.subscribe(load); load(await loc.ready());
  };
  const observer = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { observer.disconnect(); go(); } }, {rootMargin:'220px'});
  observer.observe(host);
})();
