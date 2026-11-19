// Home page "Live cameras": official public camera snapshots near a few places, Pro members only (the /cameras service enforces that on the server).
// Honest coverage: only places where an official state feed is built in. Each card links to the same camera panel on the Parcel Map.
(function () {
  'use strict';
  const host = document.getElementById('hcams'); if (!host) return;
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const PLACES = [['Tampa, FL', 27.9506, -82.4572], ['Orlando, FL', 28.5383, -81.3792], ['Miami, FL', 25.7617, -80.1918], ['Fort Myers Beach, FL', 26.452, -81.9495], ['Los Angeles, CA', 34.0522, -118.2437], ['San Diego, CA', 32.7157, -117.1611], ['Austin, TX', 30.2672, -97.7431]];
  let started = false, timer = null, cur = 0;
  const grid = mk('div', 'hc-grid'), msg = mk('p', 'hc-msg'), chips = mk('div', 'hc-chips'); chips.setAttribute('role', 'group'); chips.setAttribute('aria-label', 'Place');
  const mapA = document.getElementById('hcAll');
  host.append(chips, grid, msg);
  PLACES.forEach(([n], i) => { const b = mk('button', 'hc-chip', n); b.type = 'button'; b.setAttribute('aria-pressed', String(i === 0)); b.addEventListener('click', () => { cur = i; chips.querySelectorAll('button').forEach((x, j) => x.setAttribute('aria-pressed', String(j === i))); load(); }); chips.appendChild(b); });
  async function load() {
    clearInterval(timer); grid.textContent = ''; msg.textContent = 'Finding cameras…'; const [name, lat, lng] = PLACES[cur]; mapA.href = '/map/?cams=1&lat=' + lat + '&lng=' + lng;
    let r, d; try { r = await fetch('/.netlify/functions/cameras?' + new URLSearchParams({ lat, lng, radius: 15, limit: 6 }), { credentials: 'same-origin' }); d = await r.json(); } catch (e) { msg.textContent = 'Cameras are temporarily unavailable. Please try again soon.'; return; }
    if (r.status === 402 || r.status === 401) { msg.textContent = ''; const g = mk('p', 'hc-lock'); g.append(document.createTextNode('Live cameras are for Pro members. ')); const a = mk('a', '', 'See the Pro plan'); a.href = '/plans/?from=' + encodeURIComponent(location.pathname + location.search) + '&src=' + encodeURIComponent('Live cameras'); g.appendChild(a); msg.appendChild(g); return; }
    if (!r.ok || !d.ok) { msg.textContent = 'Cameras are temporarily unavailable. Please try again soon.'; return; }
    const cams = d.cameras.filter(c => c.image); if (!cams.length) { msg.textContent = 'No public cameras with a live picture were found near ' + name + ' right now.'; return; }
    msg.textContent = 'Near ' + name.split(',')[0] + ' \u00b7 pictures refresh about every minute \u00b7 swipe for more';
    const imgs = []; cams.forEach(c => { const card = mk('a', 'hc-card'); card.href = '/map/?cams=1&lat=' + c.lat + '&lng=' + c.lng; card.setAttribute('aria-label', c.name + ': open on the Parcel Map'); const img = mk('img'); img.alt = 'Latest picture from ' + c.name; img.loading = 'lazy'; img.decoding = 'async'; img.referrerPolicy = 'no-referrer'; const set = () => { img.src = c.image + (c.image.includes('?') ? '&' : '?') + 't=' + Math.floor(Date.now() / 60000); }; set(); img.onerror = () => { card.classList.add('off'); }; imgs.push(set);
      const cap = mk('div', 'hc-cap'); cap.append(mk('b', '', c.name), mk('span', '', [c.road, (c.miles < 0.1 ? '<0.1' : c.miles.toFixed(1)) + ' mi from ' + name.split(',')[0], c.operator].filter(Boolean).join(' · '))); card.append(img, cap); grid.appendChild(card); });
    timer = setInterval(() => { if (!document.hidden && grid.isConnected) imgs.forEach(f => f()); }, 60000);
  }
  const go = () => { if (started) return; started = true; load(); };
  if ('IntersectionObserver' in window) { const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); go(); } }, { rootMargin: '200px' }); io.observe(host); } else go();
})();
