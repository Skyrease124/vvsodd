// Sell my land: sign in -> member -> ID check (Stripe Identity) -> post listings with a map pin and photos.
(function () {
  const API = '/.netlify/functions/listings';
  const $ = id => document.getElementById(id);
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const money = n => '$' + Number(n).toLocaleString('en-US');
  let photos = [], pin = null, editing = null, map = null, marker = null, mine = [];
  STATES.forEach(s => { const o = mk('option', '', s.n); o.value = s.a; $('state').appendChild(o); });
  async function post(o) { try { const r = await fetch(API, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(o)}); return {ok: r.ok, d: await r.json()}; } catch (e) { return {ok: false, d: {error: 'Could not reach the server.'}}; } }

  function step(title, text, btn) { const b = mk('div', 'salebox'); b.append(mk('h3', '', title), mk('p', '', text)); if (btn) b.appendChild(btn); $('steps').appendChild(b); return b; }
  async function start() {
    $('steps').textContent = ''; $('mine').textContent = '';
    const q = new URLSearchParams(location.search);
    if (q.get('id_return')) { step('Checking your ID…', 'One moment.'); const r = await post({action: 'idCheck'}); history.replaceState(null, '', location.pathname); $('steps').textContent = ''; if (r.ok && !r.d.idVerified) step('ID check: ' + (r.d.status === 'processing' ? 'still processing' : 'not finished'), r.d.status === 'processing' ? 'Stripe is still checking your ID. This usually takes a minute or two. Refresh this page soon.' : 'Your ID check was not completed' + (r.d.error ? ' (' + r.d.error.replace(/_/g, ' ') + ')' : '') + '. You can try again below.'); }
    let d; const r = await fetch(API + '?mine=1'); d = await r.json();
    if (r.status === 401) { const a = mk('a', 'btn', 'Sign in'); a.href = '/login/?next=/land/sell/'; step('Sign in first', 'You need an account to sell land.', a); return; }
    if (!d.paid) { const a = mk('a', 'btn', 'Become a member ($5.50 a week)'); a.href = '/account/'; step('Members only', 'Posting land is for members. Membership also unlocks the AI and the screener.', a); return; }
    if (!d.idVerified && !d.owner) {
      const b = mk('button', 'btn', 'Verify my ID'); b.type = 'button';
      const box = step('Verify your ID (one time)', 'To keep scammers out, every seller verifies a photo ID with a quick selfie. It is done by Stripe, our payment company. We only keep the result (verified or not), never your ID photos.', b);
      const m = mk('p', 'small'); box.appendChild(m);
      b.addEventListener('click', async () => { b.disabled = true; m.textContent = 'Opening the ID check…'; const x = await post({action: 'idStart'}); if (x.ok && x.d.url) location.href = x.d.url; else if (x.ok && x.d.idVerified) start(); else { m.textContent = x.d.error || 'Could not start the ID check.'; b.disabled = false; } });
      return;
    }
    mine = d.listings || [];
    const top = mk('p', 'sact'); const add = mk('button', 'btn', 'Add a listing'); add.type = 'button'; add.addEventListener('click', () => edit(null)); const view = mk('a', 'btn ghost', 'See all land for sale'); view.href = '/land/'; top.append(add, view); $('mine').appendChild(top);
    $('mine').appendChild(mk('h2', '', 'My listings'));
    if (!mine.length) $('mine').appendChild(mk('p', 'muted', 'You have not listed any land yet.'));
    mine.forEach(l => {
      const c = mk('div', 'scard'); c.appendChild(mk('b', '', money(l.price) + ' · ' + l.title)); c.appendChild(mk('p', 'small muted', l.county + ' County, ' + l.state + ' · ' + (l.status === 'active' ? 'Showing' : 'Hidden')));
      const a = mk('p', 'sact');
      const v = mk('a', 'btn small ghost', 'View'); v.href = '/land/?id=' + l.id;
      const e = mk('button', 'btn small ghost', 'Edit'); e.type = 'button'; e.addEventListener('click', () => edit(l.id));
      const h = mk('button', 'btn small ghost', l.status === 'active' ? 'Hide (sold or paused)' : 'Show again'); h.type = 'button'; h.addEventListener('click', async () => { const x = await post({action: 'status', id: l.id, status: l.status === 'active' ? 'hidden' : 'active'}); if (x.ok) start(); else alert(x.d.error); });
      const del = mk('button', 'btn small ghost', 'Delete'); del.type = 'button'; del.addEventListener('click', async () => { if (!confirm('Delete this listing for good?')) return; const x = await post({action: 'status', id: l.id, status: 'removed'}); if (x.ok) start(); else alert(x.d.error); });
      a.append(v, e, h, del); c.appendChild(a); $('mine').appendChild(c);
    });
  }

  async function edit(id) {
    editing = id; photos = []; pin = null; $('fmsg').textContent = '';
    ['title', 'county', 'city', 'parcel', 'price', 'acres', 'desc', 'links'].forEach(k => { $(k).value = ''; });
    $('ftitle').textContent = id ? 'Edit listing' : 'New listing'; $('save').textContent = id ? 'Save changes' : 'Post listing';
    if (id) {
      const d = await (await fetch(API + '?id=' + encodeURIComponent(id))).json(); const l = d.listing; if (!l) return;
      ['title', 'county', 'city', 'parcel', 'price', 'desc'].forEach(k => { $(k).value = l[k] == null ? '' : l[k]; });
      $('acres').value = l.acres == null ? '' : l.acres; $('state').value = l.state; $('links').value = (l.links || []).join('\n');
      photos = l.photos.slice(); pin = {lat: l.lat, lng: l.lng};
    }
    $('form').hidden = false; $('mine').hidden = true; thumbs();
    const L = await LienMap.load();
    if (!map) { map = L.map($('pmap')).setView([39, -96], 4); L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {maxZoom: 19, attribution: 'Imagery &copy; Esri'}).addTo(map); L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {maxZoom: 19}).addTo(map); map.on('click', e => setPin(e.latlng.lat, e.latlng.lng)); }
    setTimeout(() => map.invalidateSize(), 50);
    if (pin) { setPin(pin.lat, pin.lng); map.setView([pin.lat, pin.lng], 16); } else { if (marker) { marker.remove(); marker = null; } $('pin').textContent = 'No pin yet.'; map.setView([39, -96], 4); }
    $('form').scrollIntoView({behavior: 'smooth'});
  }
  function setPin(lat, lng) {
    pin = {lat, lng}; const L = window.L;
    if (marker) marker.setLatLng([lat, lng]); else marker = L.marker([lat, lng]).addTo(map);
    $('pin').textContent = 'Pin dropped at ' + lat.toFixed(5) + ', ' + lng.toFixed(5) + '. Tap again to move it.';
  }
  $('here').addEventListener('click', () => navigator.geolocation && navigator.geolocation.getCurrentPosition(p => { setPin(p.coords.latitude, p.coords.longitude); map.setView([p.coords.latitude, p.coords.longitude], 17); }, () => alert('Location was not shared. Tap the map instead.')));

  function thumbs() {
    const t = $('thumbs'); t.textContent = '';
    photos.forEach((p, i) => { const w = mk('div', 'lthumb'); const im = mk('img'); im.src = API + '?photo=' + p; im.alt = ''; const x = mk('button', 'btn small ghost', 'Remove'); x.type = 'button'; x.addEventListener('click', () => { photos.splice(i, 1); thumbs(); }); w.append(im, x); t.appendChild(w); });
  }
  // Shrink each photo on the phone before upload (max 1600px, JPEG). This also strips the photo's hidden GPS data.
  function shrink(file) {
    return new Promise((res, rej) => {
      const img = new Image(); const url = URL.createObjectURL(file);
      img.onload = () => { const s = Math.min(1, 1600 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); let q = 0.82, d = c.toDataURL('image/jpeg', q); while (d.length > 650000 && q > 0.4) { q -= 0.12; d = c.toDataURL('image/jpeg', q); } res(d); };
      img.onerror = () => rej(new Error('bad image')); img.src = url;
    });
  }
  $('files').addEventListener('change', async e => {
    const files = [...e.target.files].slice(0, 6 - photos.length); e.target.value = '';
    for (const f of files) {
      $('fmsg').textContent = 'Uploading photo…';
      try { const data = await shrink(f); const r = await post({action: 'photo', data}); if (r.ok) { photos.push(r.d.id); thumbs(); } else { $('fmsg').textContent = r.d.error; return; } } catch (x) { $('fmsg').textContent = 'That photo could not be read. Try a different one.'; return; }
    }
    $('fmsg').textContent = photos.length >= 6 ? 'That is the 6-photo limit.' : '';
  });
  $('cancel').addEventListener('click', () => { $('form').hidden = true; $('mine').hidden = false; });
  $('form').addEventListener('submit', async e => {
    e.preventDefault(); if (!pin) { $('fmsg').textContent = 'Tap the map to drop a pin on your land.'; return; }
    $('save').disabled = true; $('fmsg').textContent = 'Saving…';
    const r = await post({action: 'save', id: editing || undefined, title: $('title').value, state: $('state').value, county: $('county').value, city: $('city').value, parcel: $('parcel').value, price: $('price').value.replace(/[$,\s]/g, ''), acres: $('acres').value, desc: $('desc').value, links: $('links').value.split(/\n+/).map(x => x.trim()).filter(Boolean), lat: pin.lat, lng: pin.lng, photos});
    $('save').disabled = false;
    if (r.ok) { $('form').hidden = true; $('mine').hidden = false; start(); } else $('fmsg').textContent = r.d.error || 'Could not save.';
  });
  start();
})();
