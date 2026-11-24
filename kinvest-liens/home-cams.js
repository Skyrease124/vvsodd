// Camera previews come from the existing Pro-only camera API.
(function () {
  const host = document.getElementById('hcams');
  if (!host) return;
  const loc = window.ppaLocation;
  const mk = (tag, cls, text) => Object.assign(document.createElement(tag), {className:cls,textContent:text || ''});
  const losAngeles = ['Los Angeles, CA',34.0522,-118.2437];
  const places = [losAngeles,['Tampa, FL',27.9506,-82.4572],['Orlando, FL',28.5383,-81.3792],
    ['Miami, FL',25.7617,-80.1918],['Fort Myers Beach, FL',26.452,-81.9495],
    ['San Diego, CA',32.7157,-117.1611],['Austin, TX',30.2672,-97.7431],['Milwaukee, WI',43.0389,-87.9065]];
  const link = (text, href) => Object.assign(mk('a','',text),{href});
  const allLink = document.getElementById('hcAll');
  const grid = mk('div','hc-grid'), msg = mk('p','hc-msg'), options = mk('details','hc-options');
  options.append(mk('summary','','Browse other camera areas'));
  const chips = mk('div','hc-chips'); options.append(chips); host.append(grid,msg,options);
  let controller, refresh, started = false, currentKey, stopVideos = [], hlsLibrary;
  // Homepage: only live feeds are shown (no snapshot-only cameras), and each visit picks a different state from the list.
  const liveOnly = true, reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const plans = '/plans/?src=Live%20cameras';
  function watchVideo(camera, media, badge, signal) {
    const video = mk('video','hc-video');
    video.controls = video.muted = video.defaultMuted = video.playsInline = true;
    video.preload = 'none';
    video.setAttribute('aria-label', 'Live camera: ' + camera.name);
    media.append(video);
    let player, timeout;
    const stop = () => {
      clearTimeout(timeout); observer.disconnect();
      if (!video.isConnected) return;
      video.pause(); video.remove(); player?.destroy(); badge.textContent = 'Snapshot'; badge.classList.remove('is-live');
    };
    const play = () => video.play().catch(() => {});
    video.addEventListener('canplay', () => video.classList.add('is-ready'));
    video.addEventListener('playing', () => { clearTimeout(timeout); badge.textContent = 'Live'; badge.classList.add('is-live'); });
    video.addEventListener('error', stop, {once:true});
    const observer = new IntersectionObserver(async entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      timeout = setTimeout(stop, 15000);
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = camera.video;
        play();
        return;
      }
      try {
        hlsLibrary ||= window.Hls ? Promise.resolve() : new Promise((resolve, reject) => {
          const script = mk('script'); script.src = 'https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.13/hls.min.js';
          script.onload = resolve; script.onerror = reject; document.head.append(script);
        });
        await hlsLibrary;
        if (signal.aborted || !video.isConnected) return;
        if (!window.Hls?.isSupported()) { stop(); return; }
        player = new window.Hls({maxBufferLength:10,maxMaxBufferLength:20});
        player.on(window.Hls.Events.ERROR, (_event, data) => { if (data.fatal) stop(); });
        player.on(window.Hls.Events.MANIFEST_PARSED, play);
        player.loadSource(camera.video);
        player.attachMedia(video);
      } catch (e) { hlsLibrary = null; stop(); }
    }, {threshold:0.2});
    observer.observe(media);
    return stop;
  }
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
    clearInterval(refresh); stopVideos.forEach(stop => stop?.()); stopVideos = [];
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
      const r = await fetch('/.netlify/functions/cameras?' + new URLSearchParams({lat,lng,radius,limit:liveOnly ? 8 : 4,preview:1,video:1}), {signal:job.signal});
      if (job.signal.aborted) return;
      if (r.status === 401 || r.status === 402) { locked(); return; }
      const d = await r.json();
      if (job.signal.aborted) return;
      if (!r.ok || !d.ok) throw new Error('unavailable');
      const cams = liveOnly ? d.cameras.filter(c => c.video && c.image).slice(0, 4) : d.cameras.filter(c => c.image || c.video || c.viewer);
      const featured = reduced ? null : cams.find(c => c.video && c.image);
      msg.textContent = cams.length ? 'Live near ' + name + ' · Swipe for more' : (liveOnly ? 'No live cameras found near ' : 'No cameras found near ') + name + '.';
      // The live hero sits in the middle of the row, as in the reference layout.
      if (featured && cams.length > 2) { cams.splice(cams.indexOf(featured), 1); cams.splice(Math.floor(cams.length / 2), 0, featured); }
      const update = cams.map(c => {
        const structured = c === featured || liveOnly;
        const card = structured ? mk('article','hc-card') : link('',path(c.lat,c.lng,15)); card.className = 'hc-card' + (c === featured ? ' hc-hero' : '');
        if (c.kind === 'viewer' && c.viewer?.startsWith('https://')) card.href = c.viewer;
        const media = mk('div','hc-media');
        const fallback = mk('span','hc-viewer',c.kind === 'viewer' ? 'Open official camera ↗' : 'Open camera →');
        const cap = mk('div','hc-cap'); cap.append(mk('b','',c.name),mk('span','',c.road || c.operator));
        if (structured) {
          const details = link('',path(c.lat,c.lng,15)); details.className = 'hc-cap-link'; details.append(cap);
          card.append(media,details);
        } else card.append(media,cap);
        media.append(fallback);
        grid.append(card);
        if (!c.image) return null;
        const img = Object.assign(mk('img',''),{alt:'',loading:'lazy',decoding:'async',referrerPolicy:'no-referrer'});
        const badge = mk('span','hc-snapshot','Snapshot');
        badge.hidden = true;
        const set = () => { img.src = c.image + (c.image.includes('?') ? '&' : '?') + 't=' + Math.floor(Date.now()/60000); };
        img.onerror = () => { media.classList.remove('has-snapshot'); badge.hidden = true; fallback.hidden = false; };
        img.onload = () => { media.classList.add('has-snapshot'); badge.hidden = false; fallback.hidden = true; };
        media.append(img,badge); set();
        if (c === featured || (liveOnly && !reduced)) stopVideos.push(watchVideo(c, media, badge, job.signal));
        return set;
      }).filter(Boolean);
      const hero = grid.querySelector('.hc-hero');
      if (hero) requestAnimationFrame(() => { const g = grid.getBoundingClientRect(), h = hero.getBoundingClientRect(); grid.scrollLeft += (h.left + h.width / 2) - (g.left + g.width / 2); });
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
    const nearby = mk('button','hc-chip','Near current map'); nearby.type = 'button';
    nearby.addEventListener('click', async () => { options.open = false; load(await loc.ready()); });
    chips.prepend(nearby);
    const [label,lat,lng] = liveOnly ? places[Math.floor(Math.random() * places.length)] : losAngeles;
    load({label,lat,lng});
  };
  const observer = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { observer.disconnect(); go(); } }, {rootMargin:'220px'});
  observer.observe(host);
})();
