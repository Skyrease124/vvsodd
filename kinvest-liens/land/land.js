// Land for sale by owner: browse, map, details, contact the seller.
(function () {
  const API = '/.netlify/functions/listings';
  const $ = id => document.getElementById(id);
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const money = n => '$' + Number(n).toLocaleString('en-US');
  const photo = id => API + '?photo=' + encodeURIComponent(id);
  let all = [], me = {signedIn: false, paid: false, owner: false}, here = null, map = null, layer = null;

  STATES.forEach(s => { const o = mk('option', '', s.n); o.value = s.a; $('st').appendChild(o); });
  const miles = (a, b) => { const R = 3959, r = x => x * Math.PI / 180, dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng); const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };

  function rows() {
    const st = $('st').value, so = $('sort').value;
    let r = all.filter(l => !st || l.state === st);
    if (here) r.forEach(l => { l.dist = miles(here, l); });
    if (so === 'low') r.sort((a, b) => a.price - b.price);
    else if (so === 'high') r.sort((a, b) => b.price - a.price);
    else if (so === 'near' && here) r.sort((a, b) => a.dist - b.dist);
    else r.sort((a, b) => (b.created > a.created ? 1 : -1));
    return r;
  }
  // Empty state: when no owner-listed land matches, point to official land opportunities already on the site, by sale type.
  let RADAR = null;
  async function alt(n) {
    const box = $('alt'); if (!box) return; if (n) { box.hidden = true; return; }
    box.hidden = false; box.textContent = '';
    box.appendChild(mk('h2', '', 'Other land you can research now'));
    box.appendChild(mk('p', 'small', 'No owner-listed land matches yet. These come from official government lists on PricePocketAsset. Each sale type works differently, so read the county rules before you bid.'));
    try { RADAR = RADAR || await (await fetch('/liens/states/radar.json')).json(); } catch (e) { box.appendChild(mk('p', 'small', 'Lists are unavailable right now.')); return; }
    const st = $('st') && $('st').value, G = [['state-held', 'State-held land', 'Land the state already owns after unpaid taxes. Usually bought from the state at any time, not at an auction.'],
      ['deed', 'Tax deed sales', 'Auctions where the winning bidder gets a deed to the property (rules vary by state).'],
      ['county-held', 'County-held tax liens', 'Liens the county kept after its sale. You buy the lien (the debt), not the land, unless the owner never pays.'],
      ['lien-sale', 'Advertised tax lien sales', 'Lists published before a tax lien sale. You buy the lien, not the land.']];
    G.forEach(([g, title, why]) => {
      const cs = RADAR.counties.filter(c => c.group === g && (!st || c.state === st)).sort((a, b) => b.count - a.count); if (!cs.length) return;
      const sec = mk('section', 'altsec'); sec.append(mk('h3', '', title), mk('p', 'small', why));
      const ul = mk('ul', 'altlist'); cs.slice(0, 6).forEach(c => { const li = mk('li'), a = mk('a', '', (/County|City/.test(c.county) ? c.county : c.county + ' County') + ', ' + c.state); a.href = '/liens/states/state/?s=' + c.state + '#' + encodeURIComponent(c.county); li.append(a, ' \u00b7 ' + c.count.toLocaleString('en-US') + ' listed'); ul.appendChild(li); });
      sec.appendChild(ul); if (cs.length > 6) sec.appendChild(mk('p', 'small', '+ ' + (cs.length - 6) + ' more on the map.')); box.appendChild(sec);
    });
    const end = mk('p', 'sact'); const a1 = mk('a', 'btn', 'Sell my land'); a1.href = '/land/sell/'; const a2 = mk('a', 'btn ghost', 'Open the Tax Sale map'); a2.href = '/#map'; end.append(a1, ' ', a2); box.appendChild(end);
  }
  function render() {
    const r = rows(), box = $('list'); box.textContent = '';
    $('msg').textContent = r.length ? r.length + (r.length === 1 ? ' listing' : ' listings') + (here ? ' (distance from you shown)' : '') : 'No land listed by owners here yet. Own land? Tap “Sell my land”. Official land lists you can research now are below.';
    alt(r.length);
    r.forEach(l => {
      const c = mk('button', 'lcard'); c.type = 'button'; c.addEventListener('click', () => open(l.id));
      if (l.photo) { const im = mk('img'); im.src = photo(l.photo); im.alt = ''; im.loading = 'lazy'; c.appendChild(im); } else c.appendChild(mk('div', 'lnophoto', 'No photo'));
      const t = mk('div', 'lcardt'); t.append(mk('b', '', money(l.price)), mk('span', '', l.title), mk('span', 'small muted', (l.city ? l.city + ', ' : '') + l.county + ' County, ' + l.state + (l.acres ? ' · ' + l.acres + ' ac' : '') + (here && l.dist != null ? ' · ' + Math.round(l.dist) + ' mi away' : '')));
      c.appendChild(t); box.appendChild(c);
    });
    drawMap(r);
  }
  async function drawMap(r) {
    let L; try { L = await LienMap.load(); } catch (e) { return; }
    if (!map) { map = L.map($('lmap'), {scrollWheelZoom: false}).setView([39, -96], 4); const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'}).addTo(map); const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {maxZoom: 19, attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics'}); if (typeof OFM !== 'undefined') OFM.add(map, L.control.layers({'Street': osm, 'Satellite': sat}).addTo(map), false); }
    if (layer) layer.remove(); layer = L.layerGroup().addTo(map);
    const pts = [];
    r.forEach(l => { const m = L.circleMarker([l.lat, l.lng], {radius: 9, color: '#0b6e4f', fillColor: '#22c55e', fillOpacity: 0.9, weight: 2}).addTo(layer); m.bindTooltip(money(l.price) + ' · ' + l.title); m.on('click', () => open(l.id)); pts.push([l.lat, l.lng]); });
    if (here) { L.circleMarker([here.lat, here.lng], {radius: 7, color: '#1d4ed8', fillColor: '#3b82f6', fillOpacity: 1}).addTo(layer).bindTooltip('You'); pts.push([here.lat, here.lng]); }
    if (pts.length) map.fitBounds(pts, {maxZoom: 11, padding: [30, 30]});
  }

  async function open(id) {
    let d; try { d = await (await fetch(API + '?id=' + encodeURIComponent(id))).json(); } catch (e) { return; }
    if (!d.listing) { alert(d.error || 'This listing is not available.'); return; }
    const l = d.listing;
    let dlg = $('landdlg'); if (!dlg) { dlg = mk('dialog', 'lotdlg'); dlg.id = 'landdlg'; dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); }); document.body.appendChild(dlg); }
    dlg.textContent = '';
    const head = mk('div', 'lothead'); head.appendChild(mk('b', '', l.title)); const x = mk('button', 'btn small', 'Close'); x.type = 'button'; x.addEventListener('click', () => dlg.close()); head.appendChild(x); dlg.appendChild(head);
    dlg.appendChild(mk('p', '', money(l.price) + (l.acres ? ' · ' + l.acres + ' acres' : '') + ' · ' + (l.city ? l.city + ', ' : '') + l.county + ' County, ' + l.state));
    dlg.appendChild(mk('p', 'small', '✔ Seller passed an ID check. Still confirm they own it on the county property records before you pay anything.'));
    if (l.photos.length) { const g = mk('div', 'lgallery'); l.photos.forEach(p => { const a = mk('a'); a.href = photo(p); a.target = '_blank'; a.rel = 'noopener'; const im = mk('img'); im.src = photo(p); im.alt = 'Photo of the land'; a.appendChild(im); g.appendChild(a); }); dlg.appendChild(g); }
    if (l.desc) dlg.appendChild(mk('p', 'ldesc', l.desc));
    if (l.parcel) dlg.appendChild(mk('p', 'small', 'Parcel number: ' + l.parcel));
    if (l.links.length) { const p = mk('p', 'small'); p.append('Links from the seller: '); l.links.forEach((u, i) => { const a = mk('a', '', new URL(u).hostname); a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer nofollow'; if (i) p.append(' · '); p.appendChild(a); }); dlg.appendChild(p); }
    if (l.parcel && typeof LienLand !== 'undefined') dlg.appendChild(LienLand.section({county: l.county, parcel: l.parcel}));
    // contact
    const cb = mk('div', 'landinfo'); cb.appendChild(mk('h4', '', 'Contact the seller'));
    if (l.mine) cb.appendChild(mk('p', 'small', 'This is your listing. Manage it on Sell my land.'));
    else if (!me.signedIn) { const a = mk('a', 'btn', 'Sign in to contact the seller'); a.href = '/login/?next=' + encodeURIComponent('/land/?id=' + l.id); cb.appendChild(a); }
    else if (!me.paid) { cb.appendChild(mk('p', 'small', 'Contacting sellers is for members ($5.50 a week).')); const a = mk('a', 'btn', 'See the Pro plan'); a.href = '/plans/?from=' + encodeURIComponent(location.pathname + location.search) + '&src=' + encodeURIComponent('Contacting sellers'); cb.appendChild(a); }
    else {
      const ta = mk('textarea'); ta.rows = 4; ta.maxLength = 1500; ta.placeholder = 'Hi, I am interested in your land. Is it still available?'; ta.setAttribute('aria-label', 'Message');
      const send = mk('button', 'btn', 'Send message'); send.type = 'button'; const st = mk('p', 'small'); st.setAttribute('role', 'status');
      send.addEventListener('click', async () => { send.disabled = true; st.textContent = 'Sending…'; const r = await post({action: 'contact', id: l.id, message: ta.value}); st.textContent = r.ok ? 'Sent. The seller gets your message and your email, and can reply to you directly.' : (r.d.error || 'Could not send.'); send.disabled = r.ok; });
      cb.append(mk('p', 'small muted', 'The seller gets your message and your email address. Their email stays private until they reply.'), ta, send, st);
    }
    dlg.appendChild(cb);
    const foot = mk('p', 'small muted'); foot.append('We are not a broker and are not part of any deal. Never wire money or pay a deposit before you have checked the owner and the title. ');
    if (me.signedIn && !l.mine) { const rp = mk('button', 'btn small ghost', 'Report this listing'); rp.type = 'button'; rp.addEventListener('click', async () => { const why = prompt('What is wrong with this listing?'); if (why === null) return; const r = await post({action: 'report', id: l.id, why}); alert(r.ok ? 'Thanks. The site owner will look at it.' : (r.d.error || 'Could not send.')); }); foot.appendChild(rp); }
    if (me.owner && !l.mine) { const rm = mk('button', 'btn small ghost', 'Owner: take down'); rm.type = 'button'; rm.addEventListener('click', async () => { if (!confirm('Take this listing down?')) return; const r = await post({action: 'status', id: l.id, status: 'removed'}); if (r.ok) { dlg.close(); load(); } else alert(r.d.error || 'Could not.'); }); foot.append(' ', rm); if (l.reports) foot.append(' (' + l.reports + ' reports)'); }
    dlg.appendChild(foot);
    if (!dlg.open) dlg.showModal();
  }
  async function post(o) { try { const r = await fetch(API, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(o)}); return {ok: r.ok, d: await r.json()}; } catch (e) { return {ok: false, d: {error: 'Could not reach the server.'}}; } }
  async function load() {
    try { const d = await (await fetch(API)).json(); all = d.listings || []; me = {signedIn: d.signedIn, paid: d.paid, owner: d.owner}; } catch (e) { $('msg').textContent = 'Could not load listings. Try again.'; return; }
    render();
    const id = new URLSearchParams(location.search).get('id'); if (id) open(id);
  }
  $('st').addEventListener('change', render); $('sort').addEventListener('change', () => { if ($('sort').value === 'near' && !here) $('near').click(); else render(); });
  $('near').addEventListener('click', () => {
    if (!navigator.geolocation) { $('msg').textContent = 'Your browser cannot share location.'; return; }
    $('msg').textContent = 'Finding you… (your location stays on your phone)';
    navigator.geolocation.getCurrentPosition(p => { here = {lat: p.coords.latitude, lng: p.coords.longitude}; $('sort').value = 'near'; render(); }, () => { $('msg').textContent = 'Location was not shared. Pick a state instead.'; }, {timeout: 10000});
  });
  load();
})();
