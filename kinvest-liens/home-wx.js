// Home page weather widget for signed-in members. Location: a guess from the connection (no popup), or "Use my exact location".
// Nothing about the location is stored. Refreshes every 3 hours while the page is open.
(function () {
  const host = document.getElementById('homewx'); if (!host) return;
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  let exact = null;
  const skel = () => { host.hidden = false; host.textContent = ''; const k = mk('div', 'wxhome wxskel'); k.append(mk('i', 'sk1'), mk('i', 'sk2'), mk('i', 'sk3')); host.appendChild(k); };
  const mood = t => /thunder/i.test(t) ? 'storm' : /rain|drizzle|shower/i.test(t) ? 'rain' : /snow|sleet|ice/i.test(t) ? 'snow' : /cloud|overcast|fog|mist/i.test(t) ? 'cloud' : 'sun';
  async function load(first) {
    if (first) skel();
    const q = new URLSearchParams({mode: 'me'}); if (exact) { q.set('lat', exact[0].toFixed(3)); q.set('lng', exact[1].toFixed(3)); }
    let d = null; try { const r = await fetch('/.netlify/functions/wxnow?' + q, {credentials: 'same-origin'}); if (r.status === 401) { host.hidden = true; return; } d = await r.json(); } catch (e) { d = null; }
    host.hidden = false; host.textContent = '';
    if (!d || !d.ok) { if (d && d.reason === 'nokey') { host.hidden = true; return; } host.appendChild(mk('p', 'small muted', d && d.reason === 'nolocation' ? 'Weather: we couldn\u2019t tell your area from your connection.' : 'Weather temporarily unavailable.')); host.appendChild(btn()); return; }
    const p = mk('div', 'wxhome wxin m-' + mood(d.now.text)); host.appendChild(p);
    WxCard.render(p, d, d.place.name + (d.approx ? ' area' : ''));
    const row = mk('div', 'wxfoot'); row.appendChild(btn()); const i = mk('span', '', 'Location not saved'); row.appendChild(i); p.appendChild(row);
  }
  function btn() { const b = mk('button', 'wxloc', exact ? 'Use approximate location' : '\u25ce Use exact location'); b.type = 'button';
    b.onclick = () => { if (exact) { exact = null; load(); return; } if (!navigator.geolocation) return; b.disabled = true; navigator.geolocation.getCurrentPosition(p => { exact = [p.coords.latitude, p.coords.longitude]; load(); }, () => { b.disabled = false; b.textContent = 'Location not allowed'; }, {timeout: 10000}); };
    return b; }
  // Minimal copy of the lot-map card renderer (lien-ui.js is not loaded on the home page).
  const WxCard = {render(panel, d, title) {
    (d.alerts || []).forEach(a => { const p = mk('p', 'wxalert'); const l = mk('a', '', '\u26a0\ufe0f ' + a.event); l.href = a.link; l.target = '_blank'; l.rel = 'noopener noreferrer'; p.appendChild(l); panel.appendChild(p); });
    const top = mk('div', 'wxh'), im = mk('img', 'wxico'); im.src = d.now.icon; im.alt = ''; im.width = 56; im.height = 56;
    const t = mk('div', 'wxht'); t.append(mk('div', 'wxplace', '\ud83d\udccd ' + title), mk('div', 'wxbig', d.now.f + '\u00b0'), mk('div', 'wxcond', d.now.text + ' \u00b7 feels ' + d.now.feels + '\u00b0'));
    const right = mk('div', 'wxhl'); right.append(mk('span', '', 'H ' + d.days[0].hi + '\u00b0'), mk('span', '', 'L ' + d.days[0].lo + '\u00b0')); if (d.air) right.appendChild(mk('span', 'wxaq aq' + d.air.index, 'Air ' + d.air.label.replace('Unhealthy for sensitive groups', 'Sensitive')));
    top.append(im, t, right); panel.appendChild(top);
    const row = mk('div', 'wxstrip'); d.days.forEach((x, i) => { const c = mk('div', 'wxs'); const di = mk('img'); di.src = x.icon; di.alt = x.text; di.width = 28; di.height = 28;
      c.append(mk('b', '', i === 0 ? 'Today' : new Date(x.date + 'T12:00').toLocaleDateString('en-US', {weekday: 'short'})), di, mk('span', '', x.hi + '\u00b0 / ' + x.lo + '\u00b0'), mk('span', 'rn', '\ud83d\udca7' + x.rain + '%')); row.appendChild(c); }); panel.appendChild(row);
  }};
  load(true); setInterval(() => { if (!document.hidden) load(); }, 3 * 3600e3);
})();
