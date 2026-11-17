// Home page weather widget for signed-in members. Location: a guess from the connection (no popup), or "Use my exact location".
// Nothing about the location is stored. Refreshes every 3 hours while the page is open.
(function () {
  const host = document.getElementById('homewx'); if (!host) return;
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  let exact = null;
  async function load() {
    const q = new URLSearchParams({mode: 'me'}); if (exact) { q.set('lat', exact[0].toFixed(3)); q.set('lng', exact[1].toFixed(3)); }
    let d = null; try { const r = await fetch('/.netlify/functions/wxnow?' + q, {credentials: 'same-origin'}); if (r.status === 401) { host.hidden = true; return; } d = await r.json(); } catch (e) { d = null; }
    host.hidden = false; host.textContent = '';
    if (!d || !d.ok) { if (d && d.reason === 'nokey') { host.hidden = true; return; } host.appendChild(mk('p', 'small muted', d && d.reason === 'nolocation' ? 'Weather: we couldn\u2019t tell your area from your connection.' : 'Weather temporarily unavailable.')); host.appendChild(btn()); return; }
    const p = mk('div', 'wxpanel wxhome'); host.appendChild(p);
    WxCard.render(p, d, d.place.name + ', ' + d.place.region + (d.approx ? ' (approximate)' : ''));
    const row = mk('p', 'small'); row.appendChild(btn()); row.append(' ', mk('span', 'muted', 'Your location is used for this lookup only and never saved.')); p.appendChild(row);
  }
  function btn() { const b = mk('button', 'rlink', exact ? 'Use approximate location' : 'Use my exact location'); b.type = 'button';
    b.onclick = () => { if (exact) { exact = null; load(); return; } if (!navigator.geolocation) return; b.disabled = true; navigator.geolocation.getCurrentPosition(p => { exact = [p.coords.latitude, p.coords.longitude]; load(); }, () => { b.disabled = false; b.textContent = 'Location not allowed'; }, {timeout: 10000}); };
    return b; }
  // Minimal copy of the lot-map card renderer (lien-ui.js is not loaded on the home page).
  const WxCard = {render(panel, d, title) {
    (d.alerts || []).forEach(a => { const p = mk('p', 'wxalert'); const l = mk('a', '', '\u26a0\ufe0f ' + a.event); l.href = a.link; l.target = '_blank'; l.rel = 'noopener noreferrer'; p.appendChild(l); panel.appendChild(p); });
    const top = mk('div', 'wxnow'), im = mk('img'); im.src = d.now.icon; im.alt = ''; im.width = 48; im.height = 48;
    const t = mk('div'); t.append(mk('b', 'wxtemp', d.now.f + '\u00b0F'), mk('span', 'small', ' ' + d.now.text)); t.appendChild(mk('div', 'small muted', title + ' \u00b7 feels ' + d.now.feels + '\u00b0'));
    top.append(im, t); panel.appendChild(top);
    const row = mk('div', 'wxdays'); d.days.forEach((x, i) => { const c = mk('div', 'wxday'); const di = mk('img'); di.src = x.icon; di.alt = x.text; di.width = 32; di.height = 32;
      c.append(mk('b', '', i === 0 ? 'Today' : new Date(x.date + 'T12:00').toLocaleDateString('en-US', {weekday: 'short'})), di, mk('span', '', x.hi + '\u00b0 / ' + x.lo + '\u00b0'), mk('span', 'small muted', x.rain + '% rain')); row.appendChild(c); }); panel.appendChild(row);
    if (d.air) panel.appendChild(mk('p', 'wxair aq' + d.air.index, 'Air quality: ' + d.air.label));
  }};
  load(); setInterval(() => { if (!document.hidden) load(); }, 3 * 3600e3);
})();
