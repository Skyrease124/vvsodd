// Parcel Map: real boundaries, owner of record and tax sale records, from data the site already holds (see tools/map/build.mjs).
// Nothing here is invented: a boundary is drawn only when the build matched an exact parcel ID in a county or state GIS file;
// a record without one is listed but not drawn. Availability wording only repeats what the official list says, with its check date.
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const CATS = { tax_deed: { n: 'Tax deed', c: '#a855f7' }, tax_lien: { n: 'Tax lien', c: '#3b82f6' }, land_bank: { n: 'Land bank / state-held', c: '#22c55e' } };
  const VAC = '#eab308', MI = 1609.344, TODAY = new Date().toISOString().slice(0, 10);
  const money = n => n == null ? null : (n < 0 ? '-$' : '$') + Math.abs(Number(n)).toLocaleString('en-US', { maximumFractionDigits: Math.abs(n) >= 1000 ? 0 : 2 });
  const acres = r => r.ac != null ? (r.ac >= 0.1 ? r.ac.toFixed(2) : r.ac.toFixed(3)) + ' acres' : null;
  const sqft = r => r.sf ? r.sf.toLocaleString('en-US') + ' sq ft' : (r.ac != null ? Math.round(r.ac * 43560).toLocaleString('en-US') + ' sq ft' : null);
  const slugState = a => a;
  let IDX = null, map = null, mapReady = false, loaded = {}, sel = null, near = null, paid = false, signedIn = false, base = 'satellite', sort = 'sale', pageN = 40, curState = '', curCounty = '';
  const F = { cats: { tax_deed: true, tax_lien: true, land_bank: true }, vacantOnly: false, small: false, acMin: '', acMax: '', amtMin: '', amtMax: '', upcoming: false, otc: false, flood: 'any', wet: 'any', verified: false, inView: false };
  const api = (u, o) => fetch(u, o).then(r => r.ok ? r.json() : Promise.reject(r.status));
  const say = (t, keep) => { const m = $('pmMsg'); m.textContent = ''; if (t) { m.appendChild(mk('span', 'm', t)); if (!keep) setTimeout(() => { if (m.textContent === t) m.textContent = ''; }, 6500); } };

  // ---------- data ----------
  function expand(ds) { const D = ds.dict; ds.recs.forEach(r => { for (const k in D) if (r[k] != null) r[k] = D[k][r[k]]; r._d = ds.id; r._n = ((r.a || '') + ' ' + (r.o || '') + ' ' + r.p).toLowerCase(); }); return ds; }
  async function load(id) {
    if (loaded[id]) return loaded[id]; const d = IDX.datasets.find(x => x.id === id); if (!d) return null;
    say('Loading ' + d.county + ', ' + d.state + '…', true);
    try { const ds = expand(await api('/map/data/' + d.file)); ds.meta = d; loaded[id] = ds; say(''); return ds; } catch (e) { say('Could not load that county. Please try again.'); return null; }
  }
  const all = () => Object.values(loaded).flatMap(d => d.recs);
  const byId = i => { for (const d of Object.values(loaded)) { const r = d.recs.find(x => x.i === i); if (r) return r; } return null; };
  const isUpcoming = r => (r.k === 'tax-lien' || r.k === 'deed-sale' || r.k === 'otc') && r.sd && /^\d{4}-\d{2}-\d{2}/.test(r.sd) && r.sd.slice(0, 10) >= TODAY;
  const isOtc = r => r.k === 'otc' || /over[- ]the[- ]counter|surplus|\botc\b/i.test((r.t || '') + ' ' + (r.st || ''));
  const sfha = r => r.fz && r.fz.sfha != null ? r.fz.sfha > 0 : null;
  function passes(r) {
    if (F.vacantOnly && !r.va) return false; if (!F.cats[r.c] && !(F.vacantOnly && r.va)) return false;
    if (F.small && !(r.ac != null && r.ac <= 1)) return false;
    if (F.acMin !== '' && !(r.ac != null && r.ac >= +F.acMin)) return false; if (F.acMax !== '' && !(r.ac != null && r.ac <= +F.acMax)) return false;
    if (F.amtMin !== '' && !(r.amt != null && r.amt >= +F.amtMin)) return false; if (F.amtMax !== '' && !(r.amt != null && r.amt <= +F.amtMax)) return false;
    if (F.upcoming && !isUpcoming(r)) return false; if (F.otc && !isOtc(r)) return false; if (F.verified && !r.v) return false;
    if (F.flood === 'no' && sfha(r) !== false) return false; if (F.flood === 'yes' && sfha(r) !== true) return false;
    if (F.wet === 'no' && !(r.wt != null && r.wt === 0)) return false; if (F.wet === 'yes' && !(r.wt > 0)) return false;
    if (F.inView && map) { const b = map.getBounds(); const c = r.cx; if (!c || c[0] < b.getWest() || c[0] > b.getEast() || c[1] < b.getSouth() || c[1] > b.getNorth()) return false; }
    return true;
  }

  // ---------- map ----------
  const STYLE = () => ({ version: 8, glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' },
      sat: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 19, attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics' },
      ref: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 19 } },
    layers: [{ id: 'osm', type: 'raster', source: 'osm', layout: { visibility: 'none' } }, { id: 'sat', type: 'raster', source: 'sat' }, { id: 'ref', type: 'raster', source: 'ref', layout: { visibility: 'none' } }] });
  const catColor = ['match', ['get', 'c'], 'tax_deed', CATS.tax_deed.c, 'tax_lien', CATS.tax_lien.c, 'land_bank', CATS.land_bank.c, '#94a3b8'];
  const empty = { type: 'FeatureCollection', features: [] };
  function setBase(b) { base = b; if (!mapReady) return; map.setLayoutProperty('osm', 'visibility', b === 'map' ? 'visible' : 'none'); map.setLayoutProperty('sat', 'visibility', b === 'map' ? 'none' : 'visible'); map.setLayoutProperty('ref', 'visibility', b === 'hybrid' ? 'visible' : 'none'); document.querySelectorAll('[data-base]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.base === b))); }
  function initMap() {
    map = new maplibregl.Map({ container: 'pmMap', style: STYLE(), center: [-96, 38.5], zoom: 3.4, maxZoom: 21, attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false, cooperativeGestures: false });
    map.touchZoomRotate.disableRotation(); map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.on('load', () => {
      mapReady = true; ['parcels', 'near', 'sel', 'pts'].forEach(s => map.addSource(s, { type: 'geojson', data: empty }));
      map.addLayer({ id: 'p-fill', type: 'fill', source: 'parcels', paint: { 'fill-color': catColor, 'fill-opacity': ['case', ['==', ['get', 'v'], 1], 0.4, 0.2] } });
      map.addLayer({ id: 'p-line', type: 'line', source: 'parcels', filter: ['==', ['get', 'v'], 1], paint: { 'line-color': catColor, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 16, 1.4, 20, 2.6] } });
      map.addLayer({ id: 'p-line-hist', type: 'line', source: 'parcels', filter: ['!=', ['get', 'v'], 1], paint: { 'line-color': catColor, 'line-dasharray': [2, 1.5], 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 16, 1.4, 20, 2.4] } });
      map.addLayer({ id: 'p-vac', type: 'line', source: 'parcels', filter: ['==', ['get', 'va'], 1], paint: { 'line-color': VAC, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1, 18, 3], 'line-offset': 0 } });
      map.addLayer({ id: 'n-fill', type: 'fill', source: 'near', paint: { 'fill-color': '#22d3ee', 'fill-opacity': 0.3 } });
      map.addLayer({ id: 'n-line', type: 'line', source: 'near', paint: { 'line-color': '#22d3ee', 'line-width': 2.6 } });
      map.addLayer({ id: 's-fill', type: 'fill', source: 'sel', paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.18 } });
      map.addLayer({ id: 's-line', type: 'line', source: 'sel', paint: { 'line-color': '#ffffff', 'line-width': 3.4 } });
      const ac = ['coalesce', ['get', 'ac'], 0.2];
      map.addLayer({ id: 'p-label', type: 'symbol', source: 'parcels', minzoom: 13.5, layout: { 'text-field': ['get', 'lbl'], 'text-font': ['Noto Sans Bold'], 'text-max-width': 7, 'text-line-height': 1.1, 'text-allow-overlap': false, 'text-padding': 3, 'symbol-sort-key': ['-', 0, ac],
        'text-size': ['interpolate', ['linear'], ['zoom'], 13.5, ['case', ['>=', ac, 12], 10, 0], 15.5, ['case', ['>=', ac, 3], 11, 0], 17, ['case', ['>=', ac, 0.4], 11, 0], 18, ['case', ['>=', ac, 0.12], 12, 0], 19, ['case', ['>=', ac, 0.03], 13, 0], 20, 14] },
        paint: { 'text-color': ['case', ['==', ['get', 'no'], 1], '#cbd5e1', '#ffffff'], 'text-halo-color': 'rgba(6,10,22,.92)', 'text-halo-width': 1.6, 'text-opacity': ['case', ['==', ['get', 'no'], 1], 0.8, 1] } });
      map.addLayer({ id: 'pts', type: 'circle', source: 'pts', paint: { 'circle-radius': 7, 'circle-color': catColor, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
      ['p-fill', 'pts'].forEach(l => { map.on('mouseenter', l, () => { map.getCanvas().style.cursor = 'pointer'; }); map.on('mouseleave', l, () => { map.getCanvas().style.cursor = ''; }); map.on('click', l, e => { const f = e.features && e.features[0]; if (f) { const r = byId(f.properties.i); if (r) select(r, { fly: false }); } }); });
      map.on('click', e => { if (!map.queryRenderedFeatures(e.point, { layers: ['p-fill', 'pts'] }).length) closePop(); });
      setBase(base); refresh(); start2();
    });
  }
  function feature(r) {
    const lbl = r.o ? String(r.o).toUpperCase().slice(0, 42) : 'OWNER NOT AVAILABLE';
    return { type: 'Feature', properties: { i: r.i, c: r.c, v: r.v ? 1 : 0, va: r.va ? 1 : 0, ac: r.ac == null ? null : r.ac, lbl, no: r.o ? 0 : 1 }, geometry: { type: 'Polygon', coordinates: r.g } };
  }
  function refresh() {
    const rs = all().filter(passes); const polys = rs.filter(r => r.g), pts = rs.filter(r => !r.g && r.cx);
    if (mapReady) { map.getSource('parcels').setData({ type: 'FeatureCollection', features: polys.map(feature) }); map.getSource('pts').setData({ type: 'FeatureCollection', features: pts.map(r => ({ type: 'Feature', properties: { i: r.i, c: r.c }, geometry: { type: 'Point', coordinates: r.cx } })) }); }
    renderResults(rs); renderCounts();
  }
  function fitTo(bb, pad) { if (!bb || !mapReady) return; map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: pad || { top: 90, bottom: 60, left: 40, right: window.innerWidth > 979 ? 40 : 20 }, maxZoom: 17.5, duration: 900 }); }

  // ---------- top bar and filters ----------
  function buildTop() {
    const t = $('pmTop'); t.textContent = '';
    const stSel = mk('select'); stSel.setAttribute('aria-label', 'State'); const o0 = mk('option', '', 'Choose a state'); o0.value = ''; stSel.appendChild(o0);
    const have = {}; IDX.datasets.forEach(d => { have[d.state] = (have[d.state] || 0) + 1; });
    IDX.allStates.forEach(s => { const o = mk('option', '', s.n + (have[s.a] ? ' (' + have[s.a] + (have[s.a] === 1 ? ' county' : ' counties') + ' mapped)' : '')); o.value = s.a; stSel.appendChild(o); });
    const coSel = mk('select'); coSel.setAttribute('aria-label', 'County'); coSel.id = 'pmCounty'; coSel.disabled = true; const c0 = mk('option', '', 'County'); c0.value = ''; coSel.appendChild(c0);
    stSel.addEventListener('change', () => { curState = stSel.value; curCounty = ''; fillCounties(coSel); stateNote(); });
    coSel.addEventListener('change', () => { if (coSel.value) pickCounty(coSel.value); });
    const seg = mk('div', 'pm-seg'); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'Map type'); [['map', 'Map'], ['satellite', 'Satellite'], ['hybrid', 'Hybrid']].forEach(([k, n]) => { const b = mk('button', '', n); b.type = 'button'; b.dataset.base = k; b.setAttribute('aria-pressed', String(k === base)); b.addEventListener('click', () => setBase(k)); seg.appendChild(b); });
    const area = mk('button', 'pm-btn', 'Search this area'); area.type = 'button'; area.id = 'pmArea'; area.addEventListener('click', searchArea);
    const fb = mk('button', 'pm-btn pm-fab', 'Filters'); fb.type = 'button'; fb.addEventListener('click', () => $('pmLeft').classList.add('open'));
    const aib = mk('button', 'pm-btn pm-aib', '\u2728 Ask AI'); aib.type = 'button'; aib.addEventListener('click', () => openAi());
    t.append(stSel, coSel, seg, area, fb, aib); $('pmCloseFilters').addEventListener('click', () => $('pmLeft').classList.remove('open'));
    window.__pm = { stSel, coSel };
  }
  function fillCounties(coSel) {
    coSel.textContent = ''; const c0 = mk('option', '', curState ? 'Choose a county' : 'County'); c0.value = ''; coSel.appendChild(c0);
    const list = IDX.datasets.filter(d => d.state === curState); list.forEach(d => { const o = mk('option', '', d.county + ' · ' + d.records.toLocaleString('en-US') + ' records'); o.value = d.id; coSel.appendChild(o); }); coSel.disabled = !list.length;
  }
  function stateNote() {
    const R = $('pmResults'); if (!curState) return; const has = IDX.datasets.some(d => d.state === curState), s = IDX.allStates.find(x => x.a === curState);
    if (!has) { R.textContent = ''; R.appendChild(mk('h3', '', s.n)); R.appendChild(mk('p', 'pm-empty', 'We do not have verified parcel records or boundaries for any ' + s.n + ' county yet, so nothing is drawn here. We never show shapes or listings we cannot verify.')); const a = mk('a', 'pm-btn', s.n + ' tax sale rules'); a.href = '/liens/states/state/?s=' + curState; a.style.display = 'inline-flex'; a.style.alignItems = 'center'; a.style.textDecoration = 'none'; R.appendChild(a); say(s.n + ' has no mapped counties yet.'); openRight(true); }
    else say('Choose a county to load its records.');
  }
  async function pickCounty(id) {
    const ds = await load(id); if (!ds) return; curCounty = id; const d = ds.meta; if (window.__pm) { window.__pm.stSel.value = d.state; curState = d.state; fillCounties(window.__pm.coSel); window.__pm.coSel.value = id; }
    refresh(); closePop();
    if (d.bb) fitTo(d.bb); else say(d.county + ': ' + d.records.toLocaleString('en-US') + ' records, but none has a verified boundary or map position yet. They are listed on the right.', true);
    if (d.mapped && d.mapped < d.records) setTimeout(() => say(d.mapped.toLocaleString('en-US') + ' of ' + d.records.toLocaleString('en-US') + ' records have a verified boundary. The rest are listed, not drawn.'), 1500);
    history.replaceState(null, '', '?c=' + id);
  }
  async function searchArea() {
    const b = map.getBounds(), z = map.getZoom(); const hit = IDX.datasets.filter(d => d.bb && !(d.bb[2] < b.getWest() || d.bb[0] > b.getEast() || d.bb[3] < b.getSouth() || d.bb[1] > b.getNorth()));
    if (z < 9 && hit.length > 4) { say('Zoom in a little first: ' + hit.length + ' counties are in view.'); return; }
    await Promise.all(hit.filter(d => !loaded[d.id]).slice(0, 4).map(d => load(d.id))); F.inView = true; $('pmArea').textContent = 'Showing this area ✓'; $('pmArea').classList.add('on'); refresh();
    if (!all().some(passes)) say('No records with a verified position in this view.');
  }
  function clearArea() { F.inView = false; const a = $('pmArea'); if (a) { a.textContent = 'Search this area'; a.classList.remove('on'); } refresh(); }
  function buildFilters() {
    const f = $('pmFilters'); f.textContent = ''; const box = mk('div', 'pm-f'); f.appendChild(box); box.id = 'pmFbox';
    box.appendChild(mk('h3', '', 'Property type'));
    Object.entries(CATS).forEach(([k, v]) => { const l = mk('label'), cb = mk('input'); cb.type = 'checkbox'; cb.checked = F.cats[k]; cb.addEventListener('change', () => { F.cats[k] = cb.checked; refresh(); }); const sw = mk('span', 'sw'); sw.style.background = v.c; const n = mk('span', 'n'); n.dataset.cat = k; l.append(cb, sw, document.createTextNode(v.n), n); box.appendChild(l); });
    const lv = mk('label'), cv = mk('input'); cv.type = 'checkbox'; cv.addEventListener('change', () => { F.vacantOnly = cv.checked; refresh(); }); const sv = mk('span', 'sw'); sv.style.background = 'transparent'; sv.style.border = '2px solid ' + VAC; const nv = mk('span', 'n'); nv.dataset.cat = 'vac'; lv.append(cv, sv, document.createTextNode('Vacant land only'), nv); box.appendChild(lv);
    box.appendChild(mk('h3', '', 'Filters'));
    const chk = (label, key) => { const l = mk('label'), c = mk('input'); c.type = 'checkbox'; c.addEventListener('change', () => { F[key] = c.checked; refresh(); }); l.append(c, document.createTextNode(label)); box.appendChild(l); };
    chk('Small lots (1 acre or less)', 'small'); chk('Upcoming sales on the list', 'upcoming'); chk('Over-the-counter or surplus', 'otc'); chk('Verified on the official list we checked', 'verified');
    const rng = (label, a, b, step) => { const w = mk('label', 'col'); w.appendChild(mk('span', '', label)); const r2 = mk('div', 'row2'); [a, b].forEach((k, i) => { const inp = mk('input'); inp.type = 'number'; inp.min = '0'; inp.step = step; inp.inputMode = 'decimal'; inp.placeholder = i ? 'Max' : 'Min'; inp.setAttribute('aria-label', label + (i ? ' maximum' : ' minimum')); inp.addEventListener('input', () => { F[k] = inp.value; refresh(); }); r2.appendChild(inp); }); w.appendChild(r2); box.appendChild(w); };
    rng('Acreage', 'acMin', 'acMax', '0.1'); rng('Tax amount or minimum bid ($)', 'amtMin', 'amtMax', '100');
    const sel = (label, key, opts) => { const w = mk('label', 'col'); w.appendChild(mk('span', '', label)); const s = mk('select'); opts.forEach(([v, t]) => { const o = mk('option', '', t); o.value = v; s.appendChild(o); }); s.addEventListener('change', () => { F[key] = s.value; refresh(); }); w.appendChild(s); box.appendChild(w); };
    sel('Flood zone', 'flood', [['any', 'Any'], ['no', 'Not in a high-risk flood zone'], ['yes', 'In a high-risk flood zone']]); sel('Wetlands', 'wet', [['any', 'Any'], ['no', 'No mapped wetlands'], ['yes', 'Mapped wetlands present']]);
    const row = mk('div', 'pm-chips-row'); const rs = mk('button', 'pm-btn', 'Reset filters'); rs.type = 'button'; rs.addEventListener('click', () => { Object.assign(F, { cats: { tax_deed: true, tax_lien: true, land_bank: true }, vacantOnly: false, small: false, acMin: '', acMax: '', amtMin: '', amtMax: '', upcoming: false, otc: false, flood: 'any', wet: 'any', verified: false, inView: false }); buildFilters(); clearArea(); }); const ap = mk('button', 'pm-btn primary', 'Show results'); ap.type = 'button'; ap.addEventListener('click', () => { $('pmLeft').classList.remove('open'); openRight(true); }); row.append(ap, rs); box.appendChild(row);
    const nt = mk('p', 'pm-empty'); nt.style.fontSize = '.8rem'; nt.textContent = 'Solid outline: on the official list we checked. Dashed outline: historical or not confirmed. Yellow edge: vacant land. Colors show the kind of record, not that a property is available.'; box.appendChild(nt);
  }
  function renderCounts() {
    const rs = all(); const c = { tax_deed: 0, tax_lien: 0, land_bank: 0, vac: 0 }; rs.forEach(r => { c[r.c]++; if (r.va) c.vac++; });
    document.querySelectorAll('#pmFbox [data-cat]').forEach(n => { n.textContent = rs.length ? c[n.dataset.cat].toLocaleString('en-US') : ''; });
    const lg = $('pmLegend'); lg.textContent = ''; Object.entries(CATS).forEach(([k, v]) => { const s = mk('span'); const i = mk('i'); i.style.background = v.c; s.append(i, document.createTextNode(v.n)); lg.appendChild(s); }); const sv = mk('span'); const iv = mk('i'); iv.style.border = '2px solid ' + VAC; iv.style.background = 'transparent'; sv.append(iv, document.createTextNode('Vacant land')); lg.appendChild(sv);
  }

  // ---------- results ----------
  const sortFns = { sale: (a, b) => (isUpcoming(b) - isUpcoming(a)) || String(a.sd || '9').localeCompare(String(b.sd || '9')) || (a.amt || 1e12) - (b.amt || 1e12), low: (a, b) => (a.amt == null) - (b.amt == null) || a.amt - b.amt, big: (a, b) => (b.ac || 0) - (a.ac || 0) };
  function card(r, extra) {
    const b = mk('button', 'pm-card' + (sel && sel.i === r.i ? ' sel' : '')); b.type = 'button'; b.style.setProperty('--c', (CATS[r.c] || {}).c || '#94a3b8'); const inn = mk('div', 'b');
    inn.append(mk('b', '', r.a || 'Parcel ' + r.p), mk('span', 's', r.o || 'Owner not available'));
    const meta = [CATS[r.c].n, acres(r), r.amt != null ? money(r.amt) : null].filter(Boolean).join(' · '); inn.appendChild(mk('span', 's', meta + (extra ? ' · ' + extra : '')));
    inn.appendChild(mk('span', 'pm-chip ' + (r.v ? 'ok' : 'warn'), r.v ? 'On the list we checked' : 'Not confirmed available')); if (!r.g) inn.appendChild(mk('span', 'pm-chip', 'Not drawn: no verified boundary'));
    b.appendChild(mk('span', 'bar')); b.appendChild(inn); b.addEventListener('click', () => select(r, { fly: true }));
    const w = mk('div', 'pm-cardw'); w.appendChild(b); const sp = mk('span'); sp.setAttribute('data-ppasel', JSON.stringify({ i: r.i, d: r._d, t: (r.a || 'Parcel ' + r.p) + ' \u00b7 ' + (IDX.datasets.find(x => x.id === r._d) || {}).county })); sp.style.cssText = 'display:block;padding:0 4px'; w.appendChild(sp); return w;
  }
  function renderResults(rs) {
    if (near) return renderNear(); const R = $('pmResults'); R.textContent = ''; $('pmGrip').textContent = ''; const gl = mk('span', '', rs.length ? rs.length.toLocaleString('en-US') + ' properties' : 'Results'); $('pmGrip').appendChild(gl);
    if (!Object.keys(loaded).length) { R.appendChild(mk('h3', '', 'Start here')); R.appendChild(mk('p', 'pm-empty', 'Choose a state and county above, or open one of these.')); const row = mk('div', 'pm-chips-row'); [...IDX.datasets].filter(d => d.mapped > 20).sort((a, b) => b.mapped - a.mapped).slice(0, 10).forEach(d => { const b = mk('button', '', d.county.replace(/^City of /, '') + ', ' + d.state); b.type = 'button'; b.addEventListener('click', () => pickCounty(d.id)); row.appendChild(b); }); R.appendChild(row); R.appendChild(mk('p', 'pm-empty', IDX.note)); return; }
    const hd = mk('h3', '', 'Properties'); R.appendChild(hd); const cnt = mk('p', 'cnt', rs.length.toLocaleString('en-US') + ' match your filters' + (F.inView ? ' in this view' : '') + '. Showing ' + Math.min(rs.length, pageN) + '.'); R.appendChild(cnt);
    const ss = mk('select'); ss.setAttribute('aria-label', 'Sort'); [['sale', 'Closest to sale'], ['low', 'Lowest amount'], ['big', 'Largest lot']].forEach(([v, t]) => { const o = mk('option', '', t); o.value = v; if (v === sort) o.selected = true; ss.appendChild(o); }); ss.addEventListener('change', () => { sort = ss.value; refresh(); }); ss.style.width = '100%'; ss.style.marginBottom = '6px'; R.appendChild(ss);
    [...rs].sort(sortFns[sort]).slice(0, pageN).forEach(r => R.appendChild(card(r)));
    if (rs.length > pageN) { const m = mk('button', 'pm-btn', 'Show more'); m.type = 'button'; m.style.width = '100%'; m.addEventListener('click', () => { pageN += 40; refresh(); }); R.appendChild(m); }
    if (!rs.length) R.appendChild(mk('p', 'pm-empty', 'Nothing matches these filters. Try resetting them.'));
  }
  const openRight = on => { if (window.innerWidth < 980) $('pmRight').classList.toggle('open', on); };

  // ---------- popup ----------
  function closePop() { $('pmPop').hidden = true; sel = null; near = null; if (mapReady) { map.getSource('sel').setData(empty); map.getSource('near').setData(empty); } refresh(); history.replaceState(null, '', curCounty ? '?c=' + curCounty : location.pathname); }
  function row(dl, k, v) { if (v == null || v === '') return; const d = mk('div'); d.append(mk('dt', '', k), mk('dd', '', v)); dl.appendChild(d); }
  function thumb(r) {
    const w = mk('div'); if (!r.bb) return w; const [x0, y0, x1, y1] = r.bb, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, k = Math.cos(cy * Math.PI / 180); let hw = Math.max((x1 - x0), (y1 - y0) / k * 0.5 * 2 / 2) * 0.9 + 0.00008; let hh = hw * 0.5 * k * 2 / 2; hw = Math.max(hw, (y1 - y0) / (k * 0.5) * 0.55); const W = hw, H = hw * k * 0.5;
    const bb = [cx - W, cy - H, cx + W, cy + H]; const img = mk('img', 'thumb'); img.alt = 'Satellite view of parcel ' + r.p; img.loading = 'lazy'; img.width = 380; img.height = 190;
    img.src = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=' + bb.join(',') + '&bboxSR=4326&imageSR=3857&size=380,190&format=jpg&f=image'; img.onerror = () => img.remove(); w.appendChild(img); return w;
  }
  const hoaText = v => !v ? 'Not on file' : v === 'unknown' ? 'Not confirmed' : v;
  function popup(r) {
    const p = $('pmPop'); p.textContent = ''; const cat = CATS[r.c], hd = mk('div', 'hd'); const t = mk('b', '', r.a || 'Parcel ' + r.p); const x = mk('button', 'x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.addEventListener('click', closePop); hd.append(t, x); p.appendChild(hd);
    const top = mk('section'); top.style.borderTop = '0'; const chip = mk('span', 'pm-chip', cat.n); chip.style.background = cat.c + '33'; chip.style.color = '#fff'; top.appendChild(chip); if (r.va) { const v = mk('span', 'pm-chip', 'Vacant land'); v.style.background = VAC + '33'; top.appendChild(v); } top.appendChild(mk('span', 'pm-chip ' + (r.v ? 'ok' : 'warn'), r.v ? 'On the official list we checked' : 'Not confirmed available')); p.appendChild(top);
    // owner
    const os = mk('section'); os.appendChild(mk('h4', '', 'Owner information')); os.appendChild(mk('div', 'own', r.o || 'Owner not available'));
    const od = mk('dl'); row(od, 'Ownership type', r.ot); row(od, 'Source', r.o ? r.os : null); row(od, 'Last verified', r.o ? r.ck : null); os.appendChild(od);
    if (!r.o) os.appendChild(mk('p', 'note', 'No reliable public owner record is on file for this parcel, so none is shown.')); if (r.oa) os.appendChild(mk('p', 'note', 'The county sale list shows a different owner name: ' + r.oa + '. The parcel record is shown above.')); p.appendChild(os);
    // property
    const ps = mk('section'); ps.appendChild(mk('h4', '', 'Property information')); ps.appendChild(thumb(r)); const pd = mk('dl'); const d = IDX.datasets.find(x => x.id === r._d);
    row(pd, 'Parcel ID', r.p); row(pd, 'Address or location', r.a || 'No street address on the record'); row(pd, 'State and county', (d.county) + ', ' + d.state); row(pd, 'Acreage', acres(r) || 'Not on file'); row(pd, 'Square footage', sqft(r) || 'Not on file'); row(pd, 'Zoning', r.zn || 'Not on file'); row(pd, 'Land', r.va ? 'Vacant land' : (r.us || 'Not stated')); row(pd, 'Assessed or county value', r.av != null ? money(r.av) : 'Not on file'); row(pd, 'HOA status', hoaText(r.hoa));
    row(pd, 'Flood zone (FEMA)', r.fz ? r.fz.z + (r.fz.sfha != null ? (r.fz.sfha > 0 ? ' · ' + r.fz.sfha + '% in a high-risk zone' : ' · none in a high-risk zone') : '') : 'Not checked'); row(pd, 'Wetlands (NWI)', r.wt != null ? (r.wt > 0 ? r.wt + '% of the lot touches mapped wetlands' : 'None mapped') : 'Not checked'); row(pd, 'Elevation', 'Not on file'); ps.appendChild(pd);
    if (!r.g) ps.appendChild(mk('p', 'note', r.why || 'No verified boundary for this parcel, so no shape is drawn.')); p.appendChild(ps);
    // tax
    const ts = mk('section'); ts.appendChild(mk('h4', '', cat.n + ' information')); const td = mk('dl'); const S = IDX.states[r.c && d.state] || IDX.states[d.state];
    row(td, 'Category', cat.n); row(td, 'Record status', r.t); row(td, 'Tax year', r.ty); row(td, r.al || 'Amount on the list', r.amt != null ? money(r.amt) : 'Not on the list'); row(td, 'Interest or penalty on the list', r.rt); row(td, r.sl || 'Sale date', r.sd); if (r.c === 'tax_lien' && S) row(td, 'Redemption (state rule)', S.red); if (r.c === 'tax_deed' && S) row(td, 'Redemption (state rule)', S.red); if (r.ct) row(td, 'Certificate', r.ct); ts.appendChild(td);
    ts.appendChild(mk('span', 'pm-flag ' + (r.v ? 'ok' : 'warn'), r.v ? 'This record is on the official list we checked on ' + (r.ck || 'a recent date') + '. Lists change: confirm with the county before you rely on it.' : 'Not confirmed as available. ' + (r.t || '') + (r.fr ? ' ' + r.fr + '.' : '') + ' Treat this as a historical or unverified record.'));
    if (S) ts.appendChild(mk('p', 'note', d.state + ' rules (' + S.sys + '): ' + S.rate + '. ' + (S.verify ? 'Sources differ for this state: verify with the county. ' : '') + 'States differ: a lien and a deed are not the same.'));
    (r.w || []).forEach(w => { if (!/^We could not tell|^No official source/.test(w)) ts.appendChild(mk('p', 'note', w)); });
    const src = mk('p', 'note'); src.appendChild(document.createTextNode('Official source: ')); if (r.su) { const a = mk('a', '', 'county list'); a.href = r.su; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.style.color = '#93c5fd'; src.appendChild(a); src.appendChild(document.createTextNode(r.ck ? ' (checked ' + r.ck + ')' : '')); } else src.appendChild(document.createTextNode((r.src || 'see the county') + (r.ck ? ' (checked ' + r.ck + ')' : ''))); ts.appendChild(src); p.appendChild(ts);
    // actions
    const ac = mk('div', 'acts'); const key = encodeURIComponent(r.i);
    const full = mk('a', 'main', 'View full property details'); full.href = d.detail ? '/liens/parcel/?k=' + key : '/liens/states/state/?s=' + d.state; ac.appendChild(full);
    const gis = mk('a', '', 'View official county GIS'); if (d.gis) { gis.href = d.gis.url; gis.target = '_blank'; gis.rel = 'noopener noreferrer'; gis.title = d.gis.name; } else gis.setAttribute('aria-disabled', 'true'); ac.appendChild(gis);
    const pdf = mk('a', '', 'Download parcel PDF' + (paid ? '' : ' (Pro)')); if (d.report) { pdf.href = '/ai/report/?county=' + encodeURIComponent(d.county) + '&parcel=' + encodeURIComponent(r.p); pdf.target = '_blank'; pdf.rel = 'noopener'; } else { pdf.setAttribute('aria-disabled', 'true'); pdf.title = 'A research report is not available for this county yet.'; } ac.appendChild(pdf);
    const pf = mk('a', '', 'Add to my portfolio'); pf.href = '/portfolio/?add=1&state=' + d.state + '&county=' + encodeURIComponent(d.county.replace(/ County$/, '')) + '&parcel=' + encodeURIComponent(r.p) + (r.amt != null ? '&paid=' + r.amt : ''); ac.appendChild(pf);
    const ai = mk('button', '', 'Ask AI about this parcel' + (paid ? '' : ' (Pro)')); ai.type = 'button'; ai.addEventListener('click', () => openAi('Research parcel ' + r.p + ' in ' + d.county + ', ' + d.state + ': risks and what to verify before bidding')); ac.appendChild(ai);
    const nb = mk('button', '', 'View nearby properties'); nb.type = 'button'; nb.addEventListener('click', () => { showNear(r, 1); }); ac.appendChild(nb);
    { const sp = mk('span'); sp.style.cssText = 'grid-column:1/-1'; sp.setAttribute('data-ppasel', JSON.stringify({ i: r.i, d: r._d, t: (r.a || 'Parcel ' + r.p) + ' \u00b7 ' + d.county + ', ' + d.state })); ac.insertBefore(sp, ac.children[1]); } // Pro: Select for download
    p.appendChild(ac); p.hidden = false;
  }
  function select(r, o) {
    sel = r; near = null; popup(r); if (mapReady) { map.getSource('near').setData(empty); map.getSource('sel').setData(r.g ? { type: 'FeatureCollection', features: [feature(r)] } : empty); }
    if (o && o.fly && r.bb && mapReady) map.fitBounds([[r.bb[0], r.bb[1]], [r.bb[2], r.bb[3]]], { padding: { top: 120, bottom: window.innerWidth < 980 ? 330 : 120, left: 60, right: window.innerWidth > 979 ? 420 : 40 }, maxZoom: 18.5, duration: 800 });
    else if (r.cx && mapReady && o && o.fly) map.easeTo({ center: r.cx, zoom: Math.max(map.getZoom(), 16) });
    openRight(false); history.replaceState(null, '', '?c=' + r._d + '&p=' + encodeURIComponent(r.p)); refresh();
  }

  // ---------- nearby ----------
  const hav = (a, b) => { const R = 3958.8, rad = x => x * Math.PI / 180, dLat = rad(b[1] - a[1]), dLon = rad(b[0] - a[0]), h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
  async function showNear(r, miles) {
    if (!r.cx) { say('This parcel has no verified map position, so a nearby search is not possible.'); return; }
    const dLat = miles / 69, dLon = miles / (69 * Math.cos(r.cx[1] * Math.PI / 180)); const hit = IDX.datasets.filter(d => d.bb && !(d.bb[2] < r.cx[0] - dLon || d.bb[0] > r.cx[0] + dLon || d.bb[3] < r.cx[1] - dLat || d.bb[1] > r.cx[1] + dLat));
    await Promise.all(hit.filter(d => !loaded[d.id]).slice(0, 3).map(d => load(d.id)));
    const list = all().filter(x => x.i !== r.i && x.cx && passesNoView(x)).map(x => ({ r: x, d: hav(r.cx, x.cx) })).filter(x => x.d <= miles).sort((a, b) => a.d - b.d);
    near = { of: r, miles, list }; if (mapReady) map.getSource('near').setData({ type: 'FeatureCollection', features: list.filter(x => x.r.g).map(x => feature(x.r)) });
    if (mapReady && list.length) { const ll = [r.cx, ...list.slice(0, 60).map(x => x.r.cx)]; const b = ll.reduce((a, c) => [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[2], c[0]), Math.max(a[3], c[1])], [r.cx[0], r.cx[1], r.cx[0], r.cx[1]]); fitTo(b, { top: 110, bottom: window.innerWidth < 980 ? 340 : 100, left: 60, right: window.innerWidth > 979 ? 420 : 40 }); }
    renderNear(); openRight(true);
  }
  const passesNoView = x => { const v = F.inView; F.inView = false; const o = passes(x); F.inView = v; return o; };
  function renderNear() {
    const R = $('pmResults'); R.textContent = ''; const { of, miles, list } = near; $('pmGrip').textContent = ''; $('pmGrip').appendChild(mk('span', '', 'Nearby: ' + list.length));
    const back = mk('button', 'pm-btn', '← All results'); back.type = 'button'; back.addEventListener('click', () => { near = null; if (mapReady) map.getSource('near').setData(empty); refresh(); }); R.appendChild(back);
    R.appendChild(mk('h3', '', 'Near ' + (of.a || 'parcel ' + of.p)));
    const tabs = mk('div', 'pm-tabs'); [1, 5, 10].forEach(m => { const b = mk('button', '', m + (m === 1 ? ' mile' : ' miles')); b.type = 'button'; b.setAttribute('aria-pressed', String(m === miles)); b.addEventListener('click', () => showNear(of, m)); tabs.appendChild(b); }); R.appendChild(tabs);
    R.appendChild(mk('p', 'cnt', list.length ? list.length.toLocaleString('en-US') + ' properties on this map within ' + miles + (miles === 1 ? ' mile' : ' miles') + ' that match your filters. Only counties we have records for are searched.' : 'Nothing on this map within ' + miles + (miles === 1 ? ' mile' : ' miles') + ' that matches your filters. Try a wider radius.'));
    list.slice(0, 50).forEach(x => R.appendChild(card(x.r, x.d.toFixed(x.d < 10 ? 2 : 1) + ' mi')));
  }


  // ---------- PricePocket AI on the map (Pro). The question carries the county and parcel you are looking at; nothing is sent until you press Ask. ----------
  let aiBusy = false;
  const aiCtx = () => { const d = curCounty && IDX.datasets.find(x => x.id === curCounty); return sel ? { d: IDX.datasets.find(x => x.id === sel._d), r: sel } : d ? { d } : null; };
  function aiChips() { const c = aiCtx(); if (!c) return ['Which states pay the highest interest?', 'Which states have the shortest redemption period?']; const w = c.d.county + ', ' + c.d.state; return c.r ? ['Research parcel ' + c.r.p + ' in ' + w + ': risks and what to verify before bidding', 'What are the redemption rules in ' + c.d.state + '?', 'What does ' + c.d.state + ' law say about tax ' + (c.r.c === 'tax_deed' ? 'deed' : 'lien') + ' sales?'] : ['Cheapest liens in ' + w, 'What are the redemption rules in ' + c.d.state + '?', 'Which counties in ' + c.d.state + ' pay the highest interest?']; }
  function openAi(q0) {
    let p = $('pmAi'); if (!p) { p = mk('section', 'pm-ai'); p.id = 'pmAi'; p.setAttribute('aria-label', 'Ask PricePocket AI'); $('pmTop').parentNode.appendChild(p); }
    p.hidden = false; p.textContent = ''; const hd = mk('div', 'hd'), x = mk('button', 'x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.addEventListener('click', () => { p.hidden = true; }); hd.append(mk('b', '', 'Ask PricePocket AI'), x); p.appendChild(hd);
    const c = aiCtx(); p.appendChild(mk('p', 'note', c ? 'Looking at: ' + (c.r ? 'parcel ' + c.r.p + ' · ' : '') + c.d.county + ', ' + c.d.state : 'Tip: open a county or tap a parcel and the AI will know what you are looking at.'));
    if (!signedIn || !paid) { const g = mk('p', 'pm-flag warn'); g.append(document.createTextNode(signedIn ? 'PricePocket AI is for Pro members. ' : 'Sign in to use PricePocket AI. ')); const a = mk('a', '', signedIn ? 'See the Pro plan' : 'Sign in'); a.href = signedIn ? '/account/' : '/login/?next=/map/'; a.style.color = '#fde68a'; g.appendChild(a); p.appendChild(g); return; }
    const f = mk('form', 'aif'), i = mk('input'); i.type = 'text'; i.maxLength = 300; i.placeholder = 'Ask about this county or parcel…'; i.setAttribute('aria-label', 'Your question'); const go = mk('button', 'pm-btn primary', 'Ask'); go.type = 'submit'; f.append(i, go); p.appendChild(f);
    const chips = mk('div', 'pm-chips-row'); aiChips().forEach(t => { const b = mk('button', '', t.length > 60 ? t.slice(0, 57) + '…' : t); b.type = 'button'; b.title = t; b.addEventListener('click', () => { i.value = t; f.requestSubmit(); }); chips.appendChild(b); }); p.appendChild(chips);
    const out = mk('div', 'aiout'); out.setAttribute('aria-live', 'polite'); p.appendChild(out);
    f.addEventListener('submit', async e => { e.preventDefault(); const q = i.value.replace(/\s+/g, ' ').trim(); if (q.length < 3 || aiBusy) return; aiBusy = true; go.disabled = true; out.textContent = ''; out.appendChild(mk('p', 'note', 'Researching… this can take a few seconds.')); await runAi(q, out); aiBusy = false; go.disabled = false; });
    if (q0) { i.value = q0; } setTimeout(() => { try { i.focus({ preventScroll: true }); } catch (e) {} }, 50);
  }
  async function runAi(q, out) {
    let r, d; try { r = await fetch('/.netlify/functions/ai', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q.slice(0, 300), states: curState ? [curState] : [] }) }); d = await r.json().catch(() => ({})); } catch (e) { out.textContent = ''; out.appendChild(mk('p', 'pm-flag warn', 'Could not reach PricePocket AI. Please try again.')); return; }
    out.textContent = ''; if (!r.ok) { out.appendChild(mk('p', 'pm-flag warn', d.error || 'Something went wrong. Please try again.')); return; }
    const lines = String(d.answer || '').split(/\n+/).map(x => x.trim()).filter(Boolean), bullets = lines.filter(x => /^[-•*]\s+/.test(x)), verify = lines.filter(x => /^verify:/i.test(x)), rest = lines.filter(x => !bullets.includes(x) && !verify.includes(x));
    if (rest.length) out.appendChild(mk('p', 'ans', rest.join(' '))); if (bullets.length) { const ul = mk('ul'); bullets.forEach(b => ul.appendChild(mk('li', '', b.replace(/^[-•*]\s+/, '')))); out.appendChild(ul); } if (verify.length) out.appendChild(mk('p', 'pm-flag warn', verify.join(' ')));
    if (Array.isArray(d.uncertainty) && d.uncertainty.length) { const u = mk('div', 'note'); u.appendChild(mk('b', '', 'What I could not confirm')); const ul = mk('ul'); d.uncertainty.forEach(x => ul.appendChild(mk('li', '', x))); u.appendChild(ul); out.appendChild(u); }
    if (Array.isArray(d.sources) && d.sources.length) { const s = mk('p', 'note', 'Sources: '); d.sources.forEach((x, n) => { if (n) s.appendChild(document.createTextNode(' · ')); if (x.url && /^https?:/.test(x.url)) { const a = mk('a', '', x.name); a.href = x.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.style.color = '#93c5fd'; s.appendChild(a); } else s.appendChild(document.createTextNode(x.name)); }); out.appendChild(s); }
    // parcels the answer lists: show the ones we hold a verified boundary for on the map
    const ids = new Set((Array.isArray(d.results) ? d.results : []).map(x => x && x.parcel).filter(Boolean)); const hits = all().filter(x => x.g && ids.has(x.p));
    if (hits.length && mapReady) { near = null; map.getSource('near').setData({ type: 'FeatureCollection', features: hits.slice(0, 200).map(feature) }); out.appendChild(mk('p', 'note', hits.length + ' of the parcels mentioned are highlighted in blue-green on the map.')); }
    out.appendChild(mk('p', 'note', 'AI can be wrong. It answers from the county lists and state rules on this site. Verify with the county before you bid. Not legal or investment advice.'));
  }

  // ---------- start ----------
  async function start2() {
    const q = new URLSearchParams(location.search), c = q.get('c'), p = q.get('p'); if (q.get('ai')) openAi(q.get('ai')); if (!c || !IDX.datasets.some(d => d.id === c)) return;
    await pickCounty(c); if (p) { const r = all().find(x => x.p === p); if (r) select(r, { fly: true }); }
  }
  function loadLib() { return new Promise((res, rej) => { if (window.maplibregl) return res(); const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.js'; s.crossOrigin = 'anonymous'; s.onload = res; s.onerror = () => rej(new Error('map library')); document.head.appendChild(s); }); }
  async function boot() {
    try { IDX = await api('/map/index.json'); } catch (e) { $('pmResults').textContent = 'The map data could not be loaded. Please try again.'; return; }
    fetch('/.netlify/functions/account', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => { const u = d && d.user; signedIn = !!u; paid = !!(u && (u.owner || u.paid || (u.paidThrough && u.paidThrough >= TODAY))); if (sel) popup(sel); }).catch(() => {});
    buildTop(); buildFilters(); renderCounts(); $('pmGrip').addEventListener('click', () => $('pmRight').classList.toggle('open')); refresh0();
    try { await loadLib(); initMap(); } catch (e) { say('The map library could not load. The list on the right still works.', true); }
  }
  function refresh0() { renderResults([]); }
  window.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); });
  boot();
})();
