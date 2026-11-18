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
  function skeleton() { const R = $('pmResults'); R.textContent = ''; for (let i = 0; i < 6; i++) { const s = mk('div', 'pm-skel'); s.append(mk('i'), mk('i'), mk('i')); R.appendChild(s); } }
  async function load(id) {
    if (loaded[id]) return loaded[id]; const d = IDX.datasets.find(x => x.id === id); if (!d) return null;
    say('Loading ' + d.county + ', ' + d.state + '…', true); skeleton();
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
    layers: [{ id: 'osm', type: 'raster', source: 'osm', layout: { visibility: 'none' }, paint: { 'raster-saturation': -0.35, 'raster-brightness-max': 0.9, 'raster-fade-duration': 250 } }, { id: 'sat', type: 'raster', source: 'sat', paint: { 'raster-brightness-max': 0.86, 'raster-saturation': -0.08, 'raster-fade-duration': 250 } }, { id: 'ref', type: 'raster', source: 'ref', layout: { visibility: 'none' } }] });
  const catColor = ['match', ['get', 'c'], 'tax_deed', CATS.tax_deed.c, 'tax_lien', CATS.tax_lien.c, 'land_bank', CATS.land_bank.c, '#94a3b8'];
  const empty = { type: 'FeatureCollection', features: [] };
  function setBase(b) { base = b; if (!mapReady) return; map.setLayoutProperty('osm', 'visibility', b === 'map' ? 'visible' : 'none'); map.setLayoutProperty('sat', 'visibility', b === 'map' ? 'none' : 'visible'); map.setLayoutProperty('ref', 'visibility', b === 'hybrid' ? 'visible' : 'none'); document.querySelectorAll('[data-base]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.base === b))); }
  function initMap() {
    map = new maplibregl.Map({ container: 'pmMap', style: STYLE(), bounds: [[-126, 23.5], [-65.5, 50.5]], fitBoundsOptions: { padding: { top: 150, bottom: 150, left: 12, right: 12 } }, maxZoom: 21, attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false, cooperativeGestures: false });
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
      setBase(base); addStates().then(() => { refresh(); start2(); }); map.on('zoom', natLegend); natLegend(); map.on('moveend', () => { const a = $('pmArea'); if (a) a.hidden = !(map.getZoom() >= 9 && !F.inView); });
    });
  }
  function natLegend() { const lg = $('pmLegend'); if (lg && mapReady) { const nat = map.getZoom() < 6.5; lg.classList.toggle('nat', nat); $('pmMap').classList.toggle('nat', map.getZoom() < 7); } }
  function feature(r) {
    const lbl = r.o ? String(r.o).toUpperCase().slice(0, 42) : 'OWNER NOT AVAILABLE';
    return { type: 'Feature', properties: { i: r.i, c: r.c, v: r.v ? 1 : 0, va: r.va ? 1 : 0, ac: r.ac == null ? null : r.ac, lbl, no: r.o ? 0 : 1 }, geometry: { type: 'Polygon', coordinates: r.g } };
  }
  function refresh() {
    const rs = all().filter(passes); const polys = rs.filter(r => r.g), pts = rs.filter(r => !r.g && r.cx);
    if (mapReady) { map.getSource('parcels').setData({ type: 'FeatureCollection', features: polys.map(feature) }); map.getSource('pts').setData({ type: 'FeatureCollection', features: pts.map(r => ({ type: 'Feature', properties: { i: r.i, c: r.c }, geometry: { type: 'Point', coordinates: r.cx } })) }); }
    renderResults(rs); renderCounts();
  }
  function fitTo(bb, pad) { if (!bb || !mapReady) return; map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: pad || { top: 90, bottom: 60, left: 40, right: window.innerWidth > 979 ? 40 : 20 }, maxZoom: 17.5, duration: REDUCED ? 0 : 1100, easing: t => 1 - Math.pow(1 - t, 3) }); }

  // ---------- top bar and filters ----------
  const ICON = { layers: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5"/></svg>', filter: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>', spark: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M12 2.5c.5 4.6 2.9 7 7.5 7.5-4.6.5-7 2.9-7.5 7.5-.5-4.6-2.9-7-7.5-7.5 4.6-.5 7-2.9 7.5-7.5Z"/><path d="M19 15.5c.2 1.8 1.2 2.8 3 3-1.8.2-2.8 1.2-3 3-.2-1.8-1.2-2.8-3-3 1.8-.2 2.8-1.2 3-3Z" opacity=".8"/></svg>', pin: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' };
  function iconBtn(svg, label, fn, cls) { const b = mk('button', 'pm-ib ' + (cls || '')); b.type = 'button'; b.innerHTML = svg; b.setAttribute('aria-label', label); b.title = label; b.addEventListener('click', fn); return b; }
  function buildTop() {
    const t = $('pmTop'); t.textContent = '';
    const stSel = mk('select'); stSel.setAttribute('aria-label', 'State'); const o0 = mk('option', '', 'Choose a state'); o0.value = ''; stSel.appendChild(o0);
    const have = {}; IDX.datasets.forEach(d => { have[d.state] = (have[d.state] || 0) + 1; });
    IDX.allStates.forEach(s => { const o = mk('option', '', s.n + (have[s.a] ? ' (' + have[s.a] + (have[s.a] === 1 ? ' county' : ' counties') + ' mapped)' : '')); o.value = s.a; stSel.appendChild(o); });
    const coSel = mk('select'); coSel.setAttribute('aria-label', 'County'); coSel.id = 'pmCounty'; coSel.disabled = true; const c0 = mk('option', '', 'County'); c0.value = ''; coSel.appendChild(c0);
    stSel.addEventListener('change', () => { if (!stSel.value) { curState = ''; curCounty = ''; fillCounties(coSel); aiRefresh(); return; } focusState(stSel.value); });
    coSel.addEventListener('change', () => { if (coSel.value) pickCounty(coSel.value); });
    const pill = mk('div', 'pm-pill'); const pi = mk('span', 'pi'); pi.innerHTML = ICON.pin; pill.append(pi, stSel, mk('i', 'sep'), coSel);
    const seg = mk('div', 'pm-seg'); seg.hidden = true; seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'Map type'); [['map', 'Map'], ['satellite', 'Satellite'], ['hybrid', 'Hybrid']].forEach(([k, n]) => { const b = mk('button', '', n); b.type = 'button'; b.dataset.base = k; b.setAttribute('aria-pressed', String(k === base)); b.addEventListener('click', () => { setBase(k); seg.hidden = true; }); seg.appendChild(b); });
    const lay = iconBtn(ICON.layers, 'Map type', () => { seg.hidden = !seg.hidden; }), fb = iconBtn(ICON.filter, 'Filters', () => { if (isMobile()) $('pmLeft').classList.add('open'); }, 'pm-fab'), aib = iconBtn(ICON.spark, 'Ask PricePocket AI', () => openAi(), 'pm-aib');
    const stack = mk('div', 'pm-stack'); stack.append(lay, fb, aib, seg);
    const area = mk('button', 'pm-area', 'Search this area'); area.type = 'button'; area.id = 'pmArea'; area.hidden = true; area.addEventListener('click', searchArea);
    t.append(pill, stack, area); $('pmCloseFilters').addEventListener('click', () => $('pmLeft').classList.remove('open'));
    document.addEventListener('click', e => { if (!seg.hidden && !e.target.closest('.pm-stack')) seg.hidden = true; });
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
    refresh(); closePop(); showTab('list', false); aiRefresh();
    if (d.bb) fitTo(d.bb); else say(d.county + ': ' + d.records.toLocaleString('en-US') + ' records, but none has a verified boundary or map position yet. They are listed on the right.', true);
    if (d.mapped && d.mapped < d.records) setTimeout(() => say(d.mapped.toLocaleString('en-US') + ' of ' + d.records.toLocaleString('en-US') + ' records have a verified boundary. The rest are listed, not drawn.'), 1500);
    history.replaceState(null, '', '?c=' + id);
  }
  async function searchArea() {
    const b = map.getBounds(), z = map.getZoom(); const hit = IDX.datasets.filter(d => d.bb && !(d.bb[2] < b.getWest() || d.bb[0] > b.getEast() || d.bb[3] < b.getSouth() || d.bb[1] > b.getNorth()));
    if (z < 9 && hit.length > 4) { say('Zoom in a little first: ' + hit.length + ' counties are in view.'); return; }
    await Promise.all(hit.filter(d => !loaded[d.id]).slice(0, 4).map(d => load(d.id))); F.inView = true; $('pmArea').textContent = 'Showing this area ✓'; $('pmArea').classList.add('on'); $('pmArea').hidden = false; refresh();
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
    const lg = $('pmLegend'); lg.textContent = ''; Object.entries(CATS).forEach(([k, v]) => { const s = mk('span'); const i = mk('i'); i.style.background = v.c; s.append(i, document.createTextNode(v.n)); lg.appendChild(s); }); Object.entries(COL).forEach(([k, c]) => { const s = mk('span', 'lg-st'); const i = mk('i'); i.style.background = c; s.append(i, document.createTextNode(k)); lg.appendChild(s); }); lg.querySelectorAll(':scope > span:not(.lg-st)').forEach(x => x.classList.add('lg-pc')); const sv = mk('span', 'lg-pc'); const iv = mk('i'); iv.style.border = '2px solid ' + VAC; iv.style.background = 'transparent'; sv.append(iv, document.createTextNode('Vacant land')); lg.appendChild(sv);
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
    if (near) return renderNear(); const R = $('pmResults'); R.textContent = ''; $('tabList').textContent = rs.length ? 'Properties · ' + rs.length.toLocaleString('en-US') : 'Properties';
    if (!Object.keys(loaded).length) { R.appendChild(mk('h3', '', 'Start here')); R.appendChild(mk('p', 'pm-empty', 'Choose a state and county above, or open one of these.')); const row = mk('div', 'pm-chips-row'); [...IDX.datasets].filter(d => d.mapped > 20).sort((a, b) => b.mapped - a.mapped).slice(0, 10).forEach(d => { const b = mk('button', '', d.county.replace(/^City of /, '') + ', ' + d.state); b.type = 'button'; b.addEventListener('click', () => pickCounty(d.id)); row.appendChild(b); }); R.appendChild(row); R.appendChild(mk('p', 'pm-empty', IDX.note)); return; }
    const hd = mk('h3', '', 'Properties'); R.appendChild(hd); const cnt = mk('p', 'cnt', rs.length.toLocaleString('en-US') + ' match your filters' + (F.inView ? ' in this view' : '') + '. Showing ' + Math.min(rs.length, pageN) + '.'); R.appendChild(cnt);
    const ss = mk('select'); ss.setAttribute('aria-label', 'Sort'); [['sale', 'Closest to sale'], ['low', 'Lowest amount'], ['big', 'Largest lot']].forEach(([v, t]) => { const o = mk('option', '', t); o.value = v; if (v === sort) o.selected = true; ss.appendChild(o); }); ss.addEventListener('change', () => { sort = ss.value; refresh(); }); ss.style.width = '100%'; ss.style.marginBottom = '6px'; R.appendChild(ss);
    [...rs].sort(sortFns[sort]).slice(0, pageN).forEach(r => R.appendChild(card(r)));
    if (rs.length > pageN) { const m = mk('button', 'pm-btn', 'Show more'); m.type = 'button'; m.style.width = '100%'; m.addEventListener('click', () => { pageN += 40; refresh(); }); R.appendChild(m); }
    if (!rs.length) R.appendChild(mk('p', 'pm-empty', 'Nothing matches these filters. Try resetting them.'));
  }
  const REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches), isMobile = () => window.innerWidth < 980;
  // Bottom sheet with three resting heights (peek, half, full). Drag the handle or the tabs; it springs to the nearest one.
  const SNAPS = ['peek', 'half', 'full']; let snap = 'peek';
  function setSnap(s) { snap = s; const r = $('pmRight'); r.dataset.snap = s; r.style.removeProperty('--sy'); r.classList.remove('dragging'); }
  const openRight = on => { if (isMobile()) setSnap(on ? (snap === 'peek' ? 'half' : snap) : 'peek'); };
  function initSheet() {
    const r = $('pmRight'), h = $('pmRH'); setSnap('peek'); let y0 = 0, base0 = 0, t0 = 0, drag = false, moved = false;
    const px = { peek: () => r.offsetHeight - 124, half: () => r.offsetHeight * 0.46, full: () => r.offsetHeight * 0.06 };
    h.addEventListener('pointerdown', e => { if (!isMobile()) return; drag = true; moved = false; y0 = e.clientY; t0 = e.timeStamp; base0 = px[snap](); });
    h.addEventListener('pointermove', e => { if (!drag) return; const dy = e.clientY - y0; if (!moved && Math.abs(dy) > 6) { moved = true; try { h.setPointerCapture(e.pointerId); } catch (x) {} } if (!moved) return; r.classList.add('dragging'); r.style.setProperty('--sy', Math.max(px.full(), Math.min(px.peek(), base0 + dy)) + 'px'); });
    const end = e => { if (!drag) return; drag = false; try { h.releasePointerCapture(e.pointerId); } catch (x) {} if (!moved) return; const dy = e.clientY - y0, v = dy / Math.max(1, e.timeStamp - t0), cur = base0 + dy + v * 120; const target = SNAPS.reduce((b, s) => Math.abs(px[s]() - cur) < Math.abs(px[b]() - cur) ? s : b, 'peek'); h.dataset.moved = '1'; setTimeout(() => { delete h.dataset.moved; }, 60); setSnap(target); };
    h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end);
    $('pmGrip').addEventListener('click', () => { if (h.dataset.moved) return; setSnap(snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'peek'); });
    h.addEventListener('click', e => { if (h.dataset.moved) { e.stopPropagation(); e.preventDefault(); } }, true);
  }

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
    const ap = $('pmAi'); if (ap) ap.hidden = true; const p = $('pmPop'); p.textContent = ''; const cat = CATS[r.c], hd = mk('div', 'hd'); const t = mk('b', '', r.a || 'Parcel ' + r.p); const x = mk('button', 'x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.addEventListener('click', closePop); hd.append(t, x); p.appendChild(hd);
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
    const ai = mk('button', '', 'Ask AI about this parcel' + (paid ? '' : ' (Pro)')); ai.type = 'button'; ai.addEventListener('click', () => openAi('Research parcel ' + r.p + ' in ' + d.county + ', ' + d.state + ': risks and what to verify before bidding', true)); ac.appendChild(ai);
    const nb = mk('button', '', 'View nearby properties'); nb.type = 'button'; nb.addEventListener('click', () => { showNear(r, 1); }); ac.appendChild(nb);
    { const sp = mk('span'); sp.style.cssText = 'grid-column:1/-1'; sp.setAttribute('data-ppasel', JSON.stringify({ i: r.i, d: r._d, t: (r.a || 'Parcel ' + r.p) + ' \u00b7 ' + d.county + ', ' + d.state })); ac.insertBefore(sp, ac.children[1]); } // Pro: Select for download
    p.appendChild(ac); p.hidden = false;
    { const hdr = p.querySelector('.hd'); let y0 = null; hdr.addEventListener('pointerdown', e => { if (isMobile()) { y0 = e.clientY; try { hdr.setPointerCapture(e.pointerId); } catch (x) {} p.style.transition = 'none'; } }); hdr.addEventListener('pointermove', e => { if (y0 != null) p.style.transform = 'translateY(' + Math.max(0, e.clientY - y0) + 'px)'; }); const up = e => { if (y0 == null) return; const dy = e.clientY - y0; y0 = null; p.style.transition = ''; p.style.transform = ''; if (dy > 90) closePop(); }; hdr.addEventListener('pointerup', up); hdr.addEventListener('pointercancel', up); }
  }
  function select(r, o) {
    sel = r; near = null; popup(r); if (mapReady) { map.getSource('near').setData(empty); map.getSource('sel').setData(r.g ? { type: 'FeatureCollection', features: [feature(r)] } : empty); }
    if (o && o.fly && r.bb && mapReady) map.fitBounds([[r.bb[0], r.bb[1]], [r.bb[2], r.bb[3]]], { padding: { top: 120, bottom: window.innerWidth < 980 ? 330 : 120, left: 60, right: window.innerWidth > 979 ? 420 : 40 }, maxZoom: 18.5, duration: REDUCED ? 0 : 1000, easing: t => 1 - Math.pow(1 - t, 3) });
    else if (r.cx && mapReady && o && o.fly) map.easeTo({ center: r.cx, zoom: Math.max(map.getZoom(), 16) });
    openRight(false); history.replaceState(null, '', '?c=' + r._d + '&p=' + encodeURIComponent(r.p)); refresh(); aiRefresh();
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
    const R = $('pmResults'); R.textContent = ''; const { of, miles, list } = near; $('tabList').textContent = 'Nearby · ' + list.length;
    const back = mk('button', 'pm-btn', '← All results'); back.type = 'button'; back.addEventListener('click', () => { near = null; if (mapReady) map.getSource('near').setData(empty); refresh(); }); R.appendChild(back);
    R.appendChild(mk('h3', '', 'Near ' + (of.a || 'parcel ' + of.p)));
    const tabs = mk('div', 'pm-tabs'); [1, 5, 10].forEach(m => { const b = mk('button', '', m + (m === 1 ? ' mile' : ' miles')); b.type = 'button'; b.setAttribute('aria-pressed', String(m === miles)); b.addEventListener('click', () => showNear(of, m)); tabs.appendChild(b); }); R.appendChild(tabs);
    R.appendChild(mk('p', 'cnt', list.length ? list.length.toLocaleString('en-US') + ' properties on this map within ' + miles + (miles === 1 ? ' mile' : ' miles') + ' that match your filters. Only counties we have records for are searched.' : 'Nothing on this map within ' + miles + (miles === 1 ? ' mile' : ' miles') + ' that matches your filters. Try a wider radius.'));
    list.slice(0, 50).forEach(x => R.appendChild(card(x.r, x.d.toFixed(x.d < 10 ? 2 : 1) + ' mi')));
  }


  // ---------- PricePocket AI, built into the map (Pro). It knows the state, county and parcel in view. Nothing is sent until you press Ask (or tap a suggestion). ----------
  const COL = { 'Tax lien certificate': '#22c55e', 'Tax deed': '#3b82f6', 'Redeemable deed': '#f59e0b', 'Hybrid': '#a855f7', 'Municipal lien': '#06b6d4', 'Sources differ': '#94a3b8' };
  let aiBusy = false, tab = 'ai', aiEls = null, hlStates = [];
  const aiCtx = () => { if (sel) return { d: IDX.datasets.find(x => x.id === sel._d), r: sel }; const d = curCounty && IDX.datasets.find(x => x.id === curCounty); if (d) return { d }; if (curState) { const s = IDX.allStates.find(x => x.a === curState); return { st: curState, sn: s ? s.n : curState }; } return null; };
  const ctxLabel = c => !c ? 'the whole country' : c.r ? 'parcel ' + c.r.p + ' · ' + c.d.county + ', ' + c.d.state : c.d ? c.d.county + ', ' + c.d.state : c.sn;
  function chips() {
    const c = aiCtx(); if (!c) return [['📈', 'Compare states', 'Which states pay the highest interest?'], ['⏱️', 'Fast turnarounds', 'Which states have the shortest redemption period?'], ['💰', 'Cheapest liens', 'List the cheapest liens'], ['📅', 'My deadlines', 'Which of my certificates have upcoming deadlines?']];
    if (c.r) return [['🔍', 'Research this parcel', 'Research parcel ' + c.r.p + ' in ' + c.d.county + ', ' + c.d.state + ': risks and what to verify before bidding'], ['⏱️', 'Redemption rules', 'What are the redemption rules in ' + c.d.state + '?'], ['⚖️', 'How the sale works', 'What does ' + c.d.state + ' law say about tax ' + (c.r.c === 'tax_deed' ? 'deed' : 'lien') + ' sales?'], ['📈', 'Compare states', 'Which states pay the highest interest?']];
    const w = c.d ? c.d.county + ', ' + c.d.state : c.sn, s = c.d ? c.d.state : c.st; return [['💰', 'Cheapest here', 'List the cheapest liens in ' + w], ['⏱️', 'Redemption rules', 'What are the redemption rules in ' + s + '?'], ['📈', 'Best interest in ' + s, 'Which counties in ' + s + ' pay the highest interest?'], ['📅', 'My deadlines', 'Which of my certificates have upcoming deadlines?']];
  }
  function buildAi() {
    const h = $('pmAiBox'); h.textContent = '';
    const hero = mk('div', 'ai-hero'); hero.append(mk('span', 'ai-dot'), mk('b', '', 'PricePocket AI'), mk('span', 'ai-sub', 'built into the map')); h.appendChild(hero);
    const ctx = mk('p', 'note ai-ctx'); h.appendChild(ctx);
    if (!signedIn || !paid) { const g = mk('p', 'pm-flag warn'); g.append(document.createTextNode(signedIn ? 'PricePocket AI is for Pro members. ' : 'Sign in to use PricePocket AI. ')); const a = mk('a', '', signedIn ? 'See the Pro plan' : 'Sign in'); a.href = signedIn ? '/account/' : '/login/?next=/map/'; a.style.color = '#fde68a'; g.appendChild(a); h.appendChild(g); h.appendChild(mk('p', 'note', 'You can still use the whole map, boundaries and property lists for free.')); aiEls = null; return; }
    const f = mk('form', 'aif'), i = mk('input'); i.type = 'text'; i.maxLength = 300; i.autocomplete = 'off'; i.placeholder = 'Ask about a state, county or parcel…'; i.setAttribute('aria-label', 'Ask PricePocket AI'); const go = mk('button', 'pm-btn primary', 'Ask'); go.type = 'submit'; f.append(i, go); h.appendChild(f);
    const tryH = mk('h3', 'ai-try', 'Try asking'), grid = mk('div', 'ai-cards'); const out = mk('div', 'aiout'); out.setAttribute('aria-live', 'polite'); h.append(tryH, grid, out);
    f.addEventListener('submit', async e => { e.preventDefault(); const q = i.value.replace(/\s+/g, ' ').trim(); if (q.length < 3 || aiBusy) return; aiBusy = true; go.disabled = true; tryH.hidden = true; grid.hidden = true; out.textContent = ''; out.appendChild(mk('p', 'note', 'Researching… this can take a few seconds.')); await runAi(q, out); aiBusy = false; go.disabled = false; });
    aiEls = { ctx, i, f, go, grid, out, tryH };
  }
  function aiRefresh() {
    if (!aiEls) return; aiEls.ctx.textContent = 'Looking at: ' + ctxLabel(aiCtx()) + (aiCtx() ? '' : ' — pick a state or tap the map and the AI follows you');
    aiEls.grid.textContent = ''; chips().forEach(([ic, t, q]) => { const b = mk('button', 'ai-card'); b.type = 'button'; b.append(mk('span', 'ic', ic), mk('b', '', t), mk('span', 'q', '“' + (q.length > 70 ? q.slice(0, 67) + '…' : q) + '”')); b.addEventListener('click', () => { aiEls.i.value = q; aiEls.f.requestSubmit(); }); aiEls.grid.appendChild(b); });
  }
  function showTab(t, open) {
    tab = t; $('pmAiBox').hidden = t !== 'ai'; $('pmResults').hidden = t !== 'list'; $('tabAi').setAttribute('aria-selected', String(t === 'ai')); $('tabList').setAttribute('aria-selected', String(t === 'list'));
    if (open) openRight(true); if (t === 'ai') { aiRefresh(); }
  }
  function openAi(q0, run) {
    showTab('ai', true); $('pmPop').hidden = true; if (!aiEls) { if (q0) say('Sign in with a Pro account to ask PricePocket AI.'); return; }
    if (q0) { aiEls.i.value = q0; if (run) aiEls.f.requestSubmit(); } setTimeout(() => { try { aiEls.i.focus({ preventScroll: true }); } catch (e) {} }, 60);
  }
  function setStateHl(codes) { hlStates = codes; if (mapReady && map.getLayer('st-hl')) map.setFilter('st-hl', ['in', ['get', 'a'], ['literal', codes.length ? codes : ['__none__']]]); }
  async function runAi(q, out) {
    let r, d; try { r = await fetch('/.netlify/functions/ai', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q.slice(0, 300), states: curState ? [curState] : [] }) }); d = await r.json().catch(() => ({})); } catch (e) { out.textContent = ''; out.appendChild(mk('p', 'pm-flag warn', 'Could not reach PricePocket AI. Please try again.')); aiAgain(); return; }
    out.textContent = ''; if (!r.ok) { out.appendChild(mk('p', 'pm-flag warn', d.error || 'Something went wrong. Please try again.')); aiAgain(); return; }
    const lines = String(d.answer || '').split(/\n+/).map(x => x.trim()).filter(Boolean), bullets = lines.filter(x => /^[-•*]\s+/.test(x)), verify = lines.filter(x => /^verify:/i.test(x)), rest = lines.filter(x => !bullets.includes(x) && !verify.includes(x));
    out.appendChild(mk('p', 'ai-q', q));
    if (rest.length) out.appendChild(mk('p', 'ans', rest.join(' '))); if (bullets.length) { const ul = mk('ul'); bullets.forEach(b => ul.appendChild(mk('li', '', b.replace(/^[-•*]\s+/, '')))); out.appendChild(ul); } if (verify.length) out.appendChild(mk('p', 'pm-flag warn', verify.join(' ')));
    // states in the answer: shown on the map and as a compact table (tap a state to go there)
    const rows = Array.isArray(d.states) ? d.states : (d.kind === 'states' && Array.isArray(d.results) ? d.results : []);
    if (rows.length) { setStateHl(rows.map(x => x.state).filter(Boolean)); const w = mk('div', 'ai-tbl'), t = mk('table'), hr = mk('tr'); ['State', 'Type', 'Interest / penalty', 'Redemption'].forEach(x => hr.appendChild(mk('th', '', x))); t.appendChild(hr); rows.slice(0, 20).forEach(x => { const tr = mk('tr'), td = mk('td'), b = mk('button', 'lnk', x.name); b.type = 'button'; b.addEventListener('click', () => focusState(x.state)); td.appendChild(b); if (x.verify) td.appendChild(mk('span', 'note', ' (verify)')); tr.appendChild(td); [x.system, x.rate, x.redemption].forEach(v => tr.appendChild(mk('td', '', v || ''))); t.appendChild(tr); }); w.appendChild(t); out.appendChild(w); out.appendChild(mk('p', 'note', 'These states are outlined on the map.')); }
    else setStateHl([]);
    if (d.table && Array.isArray(d.table.rows) && d.table.rows.length) { const w = mk('div', 'ai-tbl'), t = mk('table'), hr = mk('tr'); d.table.columns.forEach(x => hr.appendChild(mk('th', '', x))); t.appendChild(hr); d.table.rows.slice(0, 25).forEach(r => { const tr = mk('tr'); r.forEach(v => tr.appendChild(mk('td', '', v == null ? '' : String(v)))); t.appendChild(tr); }); w.appendChild(t); out.appendChild(w); }
    if (Array.isArray(d.uncertainty) && d.uncertainty.length) { const u = mk('div', 'note'); u.appendChild(mk('b', '', 'What I could not confirm')); const ul = mk('ul'); d.uncertainty.forEach(x => ul.appendChild(mk('li', '', x))); u.appendChild(ul); out.appendChild(u); }
    if (Array.isArray(d.sources) && d.sources.length) { const s = mk('p', 'note', 'Sources: '); d.sources.forEach((x, n) => { if (n) s.appendChild(document.createTextNode(' · ')); if (x.url && /^https?:/.test(x.url)) { const a = mk('a', '', x.name); a.href = x.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.style.color = '#93c5fd'; s.appendChild(a); } else s.appendChild(document.createTextNode(x.name)); }); out.appendChild(s); }
    // listed parcels we hold a verified boundary for light up on the map; the rest are named but not drawn
    const lr = (Array.isArray(d.results) && d.kind !== 'states' ? d.results : []).filter(x => x && x.parcel), ids = new Set(lr.map(x => x.parcel)), hits = all().filter(x => x.g && ids.has(x.p));
    if (lr.length) { const w = mk('div'); lr.slice(0, 8).forEach(x => { const rec = all().find(z => z.p === x.parcel && z.g), b = mk('button', 'lnk', (x.county ? x.county + ' · ' : '') + x.parcel + (rec ? ' (on the map)' : '')); b.type = 'button'; if (rec) b.addEventListener('click', () => { select(rec, { fly: true }); }); else b.disabled = true; w.append(b, document.createElement('br')); }); out.appendChild(w); }
    if (hits.length && mapReady) { map.getSource('near').setData({ type: 'FeatureCollection', features: hits.slice(0, 200).map(feature) }); out.appendChild(mk('p', 'note', hits.length + ' mentioned ' + (hits.length === 1 ? 'parcel is' : 'parcels are') + ' highlighted on the map.')); }
    out.appendChild(mk('p', 'note', 'AI can be wrong. It answers from the county lists and state rules on this site. Verify with the county before you bid. Not legal or investment advice.'));
    aiAgain();
  }
  function aiAgain() { const b = mk('button', 'pm-btn', 'Ask something else'); b.type = 'button'; b.style.margin = '6px 0 12px'; b.addEventListener('click', () => { aiEls.out.textContent = ''; aiEls.tryH.hidden = false; aiEls.grid.hidden = false; aiEls.i.value = ''; setStateHl([]); if (mapReady) map.getSource('near').setData(empty); aiEls.i.focus(); }); aiEls.out.appendChild(b); }

  // ---------- states layer: the national view (tap a state to zoom in; the AI follows) ----------
  async function addStates() {
    let gj; try { gj = await api('/map/states.json'); } catch (e) { return; }
    const have = {}; IDX.datasets.forEach(d => { have[d.state] = (have[d.state] || 0) + 1; });
    gj.features.forEach(f => { const a = f.properties.a, s = (typeof STATES !== 'undefined' && STATES.find(x => x.a === a)) || IDX.states[a] || {}; f.properties.sys = s.sys || 'Sources differ'; f.properties.n = s.n || a; f.properties.has = have[a] ? 1 : 0; f.properties.col = COL[s.sys] || '#94a3b8'; });
    map.addSource('states', { type: 'geojson', data: gj });
    const before = 'p-fill';
    map.addLayer({ id: 'st-fill', type: 'fill', source: 'states', maxzoom: 9, paint: { 'fill-color': ['get', 'col'], 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 3, ['case', ['==', ['get', 'has'], 1], 0.62, 0.42], 6.5, 0.4, 8.5, 0] } }, before);
    map.addLayer({ id: 'st-line', type: 'line', source: 'states', maxzoom: 9, paint: { 'line-color': '#ffffff', 'line-opacity': 0.55, 'line-width': 0.8 } }, before);
    map.addLayer({ id: 'st-hl', type: 'line', source: 'states', filter: ['in', ['get', 'a'], ['literal', ['__none__']]], paint: { 'line-color': '#22d3ee', 'line-width': 3.2 } }, before);
    map.addLayer({ id: 'st-sel', type: 'line', source: 'states', filter: ['==', ['get', 'a'], '__none__'], paint: { 'line-color': '#ffffff', 'line-width': 3 } }, before);
    map.on('mouseenter', 'st-fill', () => { map.getCanvas().style.cursor = 'pointer'; }); map.on('mouseleave', 'st-fill', () => { map.getCanvas().style.cursor = ''; });
    map.on('click', 'st-fill', e => { if (map.getZoom() > 7.5 || map.queryRenderedFeatures(e.point, { layers: ['p-fill', 'pts'] }).length) return; const f = e.features && e.features[0]; if (f) focusState(f.properties.a); });
    // small labels with how many counties have data
    const pts = { type: 'FeatureCollection', features: gj.features.filter(f => f.properties.has).map(f => { const xs = [], ys = []; (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).forEach(p => p[0].forEach(c => { xs.push(c[0]); ys.push(c[1]); })); return { type: 'Feature', properties: { a: f.properties.a, n: have[f.properties.a] }, geometry: { type: 'Point', coordinates: [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2] } }; }) };
    pts.features.forEach(f => { const el = mk('button', 'pm-badge', String(f.properties.n)); el.type = 'button'; el.title = (IDX.states[f.properties.a] || {}).n + ': ' + f.properties.n + (f.properties.n === 1 ? ' county' : ' counties') + ' mapped'; el.setAttribute('aria-label', el.title); el.addEventListener('click', e => { e.stopPropagation(); focusState(f.properties.a); }); new maplibregl.Marker({ element: el }).setLngLat(f.geometry.coordinates).addTo(map); });
  }
  function stateBB(a) { if (!mapReady || !map.getSource('states')) return null; const src = map.getSource('states')._data; const f = src && src.features.find(x => x.properties.a === a); if (!f) return null; const xs = [], ys = []; (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).forEach(p => p[0].forEach(c => { if (c[0] > -170) { xs.push(c[0]); ys.push(c[1]); } })); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }
  function focusState(a) {
    if (!a) return; curState = a; curCounty = ''; sel = null; near = null; $('pmPop').hidden = true; if (window.__pm) { window.__pm.stSel.value = a; fillCounties(window.__pm.coSel); }
    const bb = stateBB(a); if (bb) fitTo(bb, { top: 150, bottom: 80, left: 30, right: 30 }); if (mapReady) map.setFilter('st-sel', ['==', ['get', 'a'], a]);
    stateCard(a); aiRefresh(); history.replaceState(null, '', '?s=' + a);
  }
  function stateCard(a) {
    const R = $('pmResults'), s = IDX.allStates.find(x => x.a === a), rule = (typeof STATES !== 'undefined' && STATES.find(x => x.a === a)) || IDX.states[a], ds = IDX.datasets.filter(d => d.state === a); R.textContent = '';
    R.appendChild(mk('h3', '', s ? s.n : a)); if (rule) { const dl = mk('dl', 'pm-rules'); [['Sale type', rule.sys], ['Interest or penalty', rule.rate], ['Redemption', rule.red], ['Bidding', rule.bid]].forEach(([k, v]) => { if (v) { const d = mk('div'); d.append(mk('dt', '', k), mk('dd', '', v)); dl.appendChild(d); } }); R.appendChild(dl); if (rule.verify) R.appendChild(mk('p', 'note', 'Sources differ for this state. Verify with the county.')); }
    const lk = mk('a', 'pm-btn', 'Full ' + (s ? s.n : a) + ' rules'); lk.href = '/liens/states/state/?s=' + a; lk.style.cssText = 'display:inline-flex;align-items:center;text-decoration:none;margin:6px 0'; R.appendChild(lk);
    if (!ds.length) { R.appendChild(mk('p', 'pm-empty', 'No verified parcel records or boundaries for ' + (s ? s.n : a) + ' counties yet, so nothing is drawn. We never show shapes or listings we cannot verify.')); }
    else { R.appendChild(mk('h3', '', 'Counties on the map (' + ds.length + ')')); const row = mk('div', 'pm-chips-row'); ds.sort((x, y) => y.mapped - x.mapped).slice(0, 40).forEach(d => { const b = mk('button', '', d.county.replace(/^City of /, '') + ' · ' + d.records.toLocaleString('en-US')); b.type = 'button'; b.addEventListener('click', () => { pickCounty(d.id); showTab('list'); }); row.appendChild(b); }); R.appendChild(row); }
    showTab('list', true);
  }

  // ---------- start ----------
  async function start2() {
    const q = new URLSearchParams(location.search), c = q.get('c'), p = q.get('p'); if (q.get('s') && IDX.allStates.some(x => x.a === q.get('s'))) focusState(q.get('s')); if (!c || !IDX.datasets.some(d => d.id === c)) return;
    await pickCounty(c); if (p) { const r = all().find(x => x.p === p); if (r) select(r, { fly: true }); }
  }
  function loadLib() { return new Promise((res, rej) => { if (window.maplibregl) return res(); const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.js'; s.crossOrigin = 'anonymous'; s.onload = res; s.onerror = () => rej(new Error('map library')); document.head.appendChild(s); }); }
  function afterAccount() {
    buildAi(); const q = new URLSearchParams(location.search), q0 = q.get('q'), wantAi = q.get('ai') || q0;
    if (paid || wantAi) { showTab('ai', !!wantAi); } else showTab('list'); aiRefresh();
    if (q0 && aiEls) aiEls.i.value = q0.slice(0, 300); // from an old AI link: filled in, you press Ask
  }
  async function boot() {
    try { IDX = await api('/map/index.json'); } catch (e) { $('pmResults').textContent = 'The map data could not be loaded. Please try again.'; return; }
    fetch('/.netlify/functions/account', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => { const u = d && d.user; signedIn = !!u; paid = !!(u && (u.owner || u.paid || (u.paidThrough && u.paidThrough >= TODAY))); if (sel) popup(sel); afterAccount(); }).catch(() => afterAccount());
    buildTop(); buildFilters(); renderCounts(); initSheet(); $('tabAi').addEventListener('click', () => showTab('ai', true)); $('tabList').addEventListener('click', () => showTab('list', true)); refresh0(); showTab('list');
    try { await loadLib(); initMap(); } catch (e) { say('The map library could not load. The list on the right still works.', true); }
  }
  function refresh0() { renderResults([]); }
  window.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); });
  boot();
})();
