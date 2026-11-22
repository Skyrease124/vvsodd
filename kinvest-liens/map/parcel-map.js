// Parcel Map: real boundaries, owner of record and tax sale records, from data the site already holds (see tools/map/build.mjs).
// Nothing here is invented: a boundary is drawn only when the build matched an exact parcel ID in a county or state GIS file;
// a record without one is listed but not drawn. Availability wording only repeats what the official list says, with its check date.
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const workspace = document.body.classList.contains('ppa-workspace');
  const embedded = params.get('embed') === '1' && window.parent !== window;
  const locationContext = embedded ? window.parent.ppaLocation : window.ppaLocation;
  const pickerMap = params.get('picker') === '1';
  const homeMap = embedded && params.get('home') === '1' && !pickerMap;
  const rememberArea = area => {
    if (pickerMap) { window.parent.dispatchEvent(new CustomEvent('ppa:workshop-area', { detail:area })); return; }
    locationContext?.browse(area);
  };
  if (embedded) {
    document.body.classList.add('ppa-map-embed'); if (pickerMap) document.body.classList.add('ppa-picker');
    if (homeMap) document.body.classList.add('ppa-map-home');
    const baseLink = document.createElement('base'); baseLink.target = '_top'; document.head.appendChild(baseLink);
  }
  function setMapUrl(county, parcel) {
    const url = new URL(location.href);
    for (const [key, value] of [['c', county], ['p', parcel]]) {
      if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
    }
    history.replaceState(null, '', url);
  }
  const $ = id => document.getElementById(id);
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const CATS = { tax_deed: { n: 'Tax deed', c: '#a855f7' }, tax_lien: { n: 'Tax lien', c: '#3b82f6' }, land_bank: { n: 'Land bank / state-held', c: '#22c55e' } };
  const VAC = '#eab308', MI = 1609.344, TODAY = new Date().toISOString().slice(0, 10);
  const money = n => n == null ? null : (n < 0 ? '-$' : '$') + Math.abs(Number(n)).toLocaleString('en-US', { maximumFractionDigits: Math.abs(n) >= 1000 ? 0 : 2 });
  const acres = r => r.ac != null ? (r.ac >= 0.1 ? r.ac.toFixed(2) : r.ac.toFixed(3)) + ' acres' : null;
  const sqft = r => r.sf ? r.sf.toLocaleString('en-US') + ' sq ft' : (r.ac != null ? Math.round(r.ac * 43560).toLocaleString('en-US') + ' sq ft' : null);
  const slugState = a => a;
  let IDX = null, map = null, mapReady = false, loaded = {}, sel = null, near = null, paid = false, signedIn = false, acctDone = false, base = 'satellite', sort = params.get('sort') === 'low' ? 'low' : 'sale', pageN = 40, curState = '', curCounty = '';
  const F = { cats: { tax_deed: true, tax_lien: true, land_bank: true }, vacantOnly: params.get('vacant') === '1', small: false, acMin: '', acMax: '', amtMin: '', amtMax: '', upcoming: false, otc: false, flood: 'any', wet: 'any', verified: false, inView: false };
  const api = (u, o) => fetch(u, o).then(r => r.ok ? r.json() : Promise.reject(r.status));
  const say = (t, keep) => { const m = $('pmMsg'); m.textContent = ''; if (t) { m.appendChild(mk('span', 'm', t)); if (!keep) setTimeout(() => { if (m.textContent === t) m.textContent = ''; }, 6500); } };

  // Keep all visible map instances current without restarting MapLibre or redeploying.
  // The Workshop map uses this same script; saved corrections refresh every 2 minutes.
  let overlayRefreshRunning=false,overlayRefreshCursor=0;
  async function refreshVerifiedOverlays(){
    if(document.hidden||overlayRefreshRunning||!window.PPABrainMap)return;
    overlayRefreshRunning=true;let visibleChanged=false;
    try{
      const counties=Object.values(loaded);
      // Rotate bounded batches so the ninth and later loaded counties are never starved.
      // Each failed county is isolated; the other maps still receive their updates.
      for(let i=0;i<Math.min(8,counties.length);i++){
        const ds=counties[(overlayRefreshCursor+i)%counties.length];
        try{
          const result=await window.PPABrainMap.apply(ds);
          // Cached offscreen counties still update, but do not trigger an
          // expensive MapLibre redraw or rebuild the mobile result list.
          if(result.changed&&(!active.size||active.has(ds.id)))visibleChanged=true;
        }catch(_){/* Keep existing polygons until the source recovers. */}
      }
      if(counties.length)overlayRefreshCursor=(overlayRefreshCursor+8)%counties.length;
      if(visibleChanged){refresh();if(sel&&loaded[sel._d]&&(!active.size||active.has(sel._d)))popup(sel);}
    }finally{overlayRefreshRunning=false;}
  }
  // ---------- data ----------
  function expand(ds) { const D = ds.dict; ds.recs.forEach(r => { for (const k in D) if (r[k] != null) r[k] = D[k][r[k]]; r._d = ds.id; r._n = ((r.a || '') + ' ' + (r.o || '') + ' ' + r.p).toLowerCase(); }); return ds; }
  function skeleton() { const R = $('pmResults'); R.textContent = ''; for (let i = 0; i < 6; i++) { const s = mk('div', 'pm-skel'); s.append(mk('i'), mk('i'), mk('i')); R.appendChild(s); } }
  async function load(id) {
    if (loaded[id]) return loaded[id]; const d = IDX.datasets.find(x => x.id === id); if (!d) return null;
    say('Loading ' + d.county + ', ' + d.state + '…', true); skeleton();
    try { const ds = expand(await api('/map/data/' + d.file)); if(window.PPABrainMap)await window.PPABrainMap.apply(ds).catch(()=>{}); ds.meta = d; loaded[id] = ds; say(''); return ds; } catch (e) { say('Could not load that county. Please try again.'); return null; }
  }
  const all = () => Object.values(loaded).flatMap(d => d.recs);
  // Only the county (or the counties in a "Search this area" view) you picked is drawn and listed; counties you opened earlier stay cached but are not mixed in.
  let active = new Set();
  const shown = () => Object.values(loaded).filter(d => !active.size || active.has(d.meta.id)).flatMap(d => d.recs);
  const byId = i => { for (const d of Object.values(loaded)) { const r = d.recs.find(x => x.i === i); if (r) return r; } return null; };
  const isUpcoming = r => (r.k === 'tax-lien' || r.k === 'deed-sale' || r.k === 'otc') && r.sd && /^\d{4}-\d{2}-\d{2}/.test(r.sd) && r.sd.slice(0, 10) >= TODAY;
  const isOtc = r => r.k === 'otc' || /over[- ]the[- ]counter|surplus|\botc\b/i.test((r.t || '') + ' ' + (r.st || ''));
  const sfha = r => r.fz && r.fz.sfha != null ? r.fz.sfha > 0 : null;
  function passes(r) {
    if (F.query && !F.query.every(term => r._n.includes(term))) return false;
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

  // New owner-approved research updates are fetched from the server-gated Pro/Free feed.
  // They never modify the existing static parcel datasets or introduce guessed coordinates.
  let researchUpdates = [], researchAccess = 'free', researchPins = [], researchOn = true, researchPopup = null;
  let researchMapped = {};
  // Preload only the counties referenced by approved records already released to this visitor.
  // This does not add county data to the ordinary results or expose restricted records.
  async function locateApprovedResearch() {
    if (!IDX || !researchUpdates.length || !window.PPAResearchMap) return;
    const countyKey = value => String(value || '').trim().toLowerCase().replace(/\s+county$/, '');
    const choices = new Map();
    for (const r of researchUpdates) {
      const ds = IDX.datasets.filter(d => d.state === r.state && countyKey(d.county) === countyKey(r.county));
      // Fail closed if county identity is ambiguous in the map catalog.
      if (ds.length === 1) choices.set(ds[0].id, ds[0]);
    }
    // Bounded requests avoid downloading the entire national map dataset on mobile.
    const entries = [...choices.values()].slice(0, 12);
    await Promise.all(entries.map(async d => {
      if (loaded[d.id] || researchMapped[d.id]) return;
      try {
        const raw = await api('/map/data/' + d.file);
        if (!raw || !Array.isArray(raw.recs) || !raw.dict || raw.id !== d.id) return;
        const expanded = expand(raw);
        expanded.meta = d;
        researchMapped[d.id] = expanded;
      } catch (_) { /* unmatched records remain without a pin */ }
    }));
    paintResearch();
  }

  function paintResearch() {
    if (!mapReady || !map.getSource('research-updates') || !window.PPAResearchMap) return;
    const byCounty = new Map([...Object.values(researchMapped), ...Object.values(loaded)].map(d => [d.meta.id, d]));
    const relevant = [...byCounty.values()].filter(d =>
      (!active.size || active.has(d.meta.id)) && (!curState || d.meta.state === curState));
    researchPins = window.PPAResearchMap.match(researchUpdates, relevant);
    const features = researchOn ? researchPins.map(item => ({
      type: 'Feature', geometry: {type:'Point', coordinates:item.coordinates},
      properties: {id:item.release.id, type:item.release.type}
    })) : [];
    map.getSource('research-updates').setData({type:'FeatureCollection', features});
    const count = $('pmResearchCount');
    if (count) count.textContent = researchPins.length ? ' · ' + researchPins.length + ' matched' : '';
  }
  async function loadResearch() {
    try {
      const response = await fetch('/.netlify/functions/research-updates', {
        credentials:'same-origin', cache:'no-store', headers:{Accept:'application/json'}
      });
      if (!response.ok) throw Error('Research updates unavailable');
      const data = await response.json();
      if (!data.ok || !Array.isArray(data.records)) throw Error('Invalid research response');
      researchAccess = data.access === 'pro' ? 'pro' : 'free';
      researchUpdates = data.records.filter(r => r &&
        (r.type === 'lien' || r.type === 'land') && r.researchOnly === true &&
        r.availableForPurchase === false && typeof r.id === 'string');
    } catch (error) { researchUpdates = []; researchAccess = 'free'; }
    paintResearch();
    await locateApprovedResearch();
  }
  function openResearchPin(event) {
    const feat = event.features && event.features[0];
    if (!feat) return;
    const item = researchPins.find(row => row.release.id === feat.properties.id);
    if (!item) return;
    const r = item.release, pane = mk('div');
    pane.style.cssText = 'color:#13263b;font:14px/1.5 system-ui;max-width:270px';
    pane.appendChild(mk('b', '', 'New approved ' + (r.type === 'lien' ? 'lien' : 'land') + ' research'));
    pane.appendChild(mk('div', '', r.title || 'Research update'));
    pane.appendChild(mk('div', '', (r.county || '') + ', ' + (r.state || '') + ' · Parcel ' + r.parcelId));
    if (r.description) pane.appendChild(mk('p', '', r.description));
    pane.appendChild(mk('div', '', 'Research only. Not verified for purchase.'));
    if (researchAccess === 'pro') pane.appendChild(mk('small', '', 'Pro early access · Free receives updates after 48 hours.'));
    try {
      const url = new URL(r.evidenceUrl || r.sourceUrl);
      if (url.protocol === 'https:') {
        const a = mk('a', '', 'Verify official research source');
        a.href = url.href; a.target = '_blank'; a.rel = 'noopener noreferrer';
        pane.appendChild(a);
      }
    } catch (_) {}
    if (researchPopup) researchPopup.remove();
    researchPopup = new maplibregl.Popup({offset:12,closeButton:true})
      .setLngLat(item.coordinates).setDOMContent(pane).addTo(map);
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
  function moveNativeMapControls(){
    const menu=window.__pmDock?.menu;
    if(!menu)return;
    const source=$('pmMap').querySelector(homeMap?'.maplibregl-ctrl-top-right':'.maplibregl-ctrl-bottom-right');
    if(!source)return;
    const holder=mk('div','pm-native-map-controls');
    [...source.children].filter(el=>el.classList.contains('maplibregl-ctrl-group')).forEach(el=>holder.append(el));
    if(holder.childElementCount)menu.append(holder);
  }
  function initMap() {
    map = window.__ppaMap = new maplibregl.Map({ container: 'pmMap', style: STYLE(), bounds: [[-126, 23.5], [-65.5, 50.5]], fitBoundsOptions: { padding: homeMap ? {top:16,bottom:22,left:12,right:12} : pickerMap ? {top:8,bottom:8,left:10,right:10} : embedded ? {top:90,bottom:46,left:10,right:10} : {top:150,bottom:150,left:12,right:12} }, maxZoom: 21, attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false, cooperativeGestures: false });
    if (embedded) map.scrollZoom.disable();
    const controlSide = homeMap ? 'top-right' : 'bottom-right';
    const locationControl = new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: false }, trackUserLocation: false });
    const navigationControl = new maplibregl.NavigationControl({ showCompass: false });
    if (homeMap) {
      map.addControl(navigationControl, controlSide);
      map.addControl(locationControl, controlSide);
      map.addControl(new maplibregl.ScaleControl({ maxWidth: 65, unit: 'imperial' }), 'bottom-left');
      // Keep MapLibre's original button handlers but place their controls inside the dock.
      moveNativeMapControls();
      const repaint = () => {
        if (!document.hidden) requestAnimationFrame(() => { map.resize(); map.triggerRepaint(); });
      };
      new ResizeObserver(repaint).observe($('pmMap'));
      document.addEventListener('visibilitychange', repaint);
      window.addEventListener('pageshow', e => { if (e.persisted) repaint(); });
    } else {
      map.addControl(locationControl, controlSide);
      map.addControl(navigationControl, controlSide);
    }
    if(!homeMap&&!pickerMap)moveNativeMapControls();
    map.touchZoomRotate.disableRotation();
    map.on('load', () => {
      mapReady = true; ['parcels', 'near', 'sel', 'sel-point', 'pts', 'dots'].forEach(s => map.addSource(s, { type: 'geojson', data: empty }));
      // At county zoom a lot is smaller than a pixel, so each drawn parcel also gets a dot that fades out as the real outline appears.
      map.addLayer({ id: 'p-dots', type: 'circle', source: 'dots', maxzoom: 16, paint: { 'circle-color': catColor, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 2.5, 10, 4.5, 14, 5.5], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1, 'circle-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.9, 14.5, 0.9, 16, 0], 'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 14.5, 0.9, 16, 0] } });
      map.addLayer({ id: 'p-fill', type: 'fill', source: 'parcels', paint: { 'fill-color': catColor, 'fill-opacity': ['case', ['==', ['get', 'v'], 1], 0.4, 0.2] } });
      map.addLayer({ id: 'p-line', type: 'line', source: 'parcels', filter: ['==', ['get', 'v'], 1], paint: { 'line-color': catColor, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 16, 1.4, 20, 2.6] } });
      map.addLayer({ id: 'p-line-hist', type: 'line', source: 'parcels', filter: ['!=', ['get', 'v'], 1], paint: { 'line-color': catColor, 'line-dasharray': [2, 1.5], 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 16, 1.4, 20, 2.4] } });
      map.addLayer({ id: 'p-vac', type: 'line', source: 'parcels', filter: ['==', ['get', 'va'], 1], paint: { 'line-color': VAC, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1, 18, 3], 'line-offset': 0 } });
      map.addLayer({ id: 'n-fill', type: 'fill', source: 'near', paint: { 'fill-color': '#22d3ee', 'fill-opacity': 0.3 } });
      map.addLayer({ id: 'n-line', type: 'line', source: 'near', paint: { 'line-color': '#22d3ee', 'line-width': 2.6 } });
      map.addLayer({ id: 's-fill', type: 'fill', source: 'sel', paint: { 'fill-color': homeMap ? '#ffd45a' : '#ffffff', 'fill-opacity': homeMap ? 0.35 : 0.18 } });
      map.addLayer({ id: 's-glow', type: 'line', source: 'sel', paint: { 'line-color': '#ffc95f', 'line-width': 11, 'line-opacity': .45, 'line-blur': 6 } });
      map.addLayer({ id: 's-line', type: 'line', source: 'sel', paint: { 'line-color': '#ffdf81', 'line-width': 3.4 } });
      if (homeMap) map.addLayer({ id:'s-dot', type:'circle', source:'sel-point', paint:{'circle-color':'#18af75','circle-radius':7,'circle-stroke-color':'#e8fff4','circle-stroke-width':2} });
      const ac = ['coalesce', ['get', 'ac'], 0.2];
      map.addLayer({ id: 'p-label', type: 'symbol', source: 'parcels', minzoom: 13.5, layout: { 'text-field': ['get', 'lbl'], 'text-font': ['Noto Sans Bold'], 'text-max-width': 7, 'text-line-height': 1.1, 'text-allow-overlap': false, 'text-padding': 3, 'symbol-sort-key': ['-', 0, ac],
        'text-size': ['interpolate', ['linear'], ['zoom'], 13.5, ['case', ['>=', ac, 12], 10, 0], 15.5, ['case', ['>=', ac, 3], 11, 0], 17, ['case', ['>=', ac, 0.4], 11, 0], 18, ['case', ['>=', ac, 0.12], 12, 0], 19, ['case', ['>=', ac, 0.03], 13, 0], 20, 14] },
        paint: { 'text-color': ['case', ['==', ['get', 'no'], 1], '#cbd5e1', '#ffffff'], 'text-halo-color': 'rgba(6,10,22,.92)', 'text-halo-width': 1.6, 'text-opacity': ['case', ['==', ['get', 'no'], 1], 0.8, 1] } });
      map.addLayer({ id: 'pts', type: 'circle', source: 'pts', paint: { 'circle-radius': 7, 'circle-color': catColor, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
      map.addSource('fl-gis-parcels',{type:'geojson',data:gisEmpty()});
      map.addLayer({id:'fl-gis-parcel-outline',type:'line',source:'fl-gis-parcels',paint:{'line-color':'#36d6e9','line-width':1.6,'line-opacity':0.85}});
      map.addSource('fl-gis-buildings',{type:'geojson',data:gisEmpty()});
      map.addLayer({id:'fl-gis-building-outline',type:'line',source:'fl-gis-buildings',paint:{'line-color':'#ffd36b','line-width':1.5,'line-opacity':0.85}});
      map.on('moveend',queueFloridaGIS);
      // Distinct research pins are restricted to server-visible releases with exact mapped parcel matches.
      map.addSource('research-updates', { type:'geojson', data: empty });
      map.addLayer({id:'research-pin', type:'circle', source:'research-updates',
        paint:{'circle-color':['match',['get','type'],'lien','#f59e0b','land','#10b981','#f59e0b'],
          'circle-radius':['interpolate',['linear'],['zoom'],6,7,13,10],
          'circle-stroke-color':'#ffffff','circle-stroke-width':2.4,'circle-opacity':0.96}});
      map.on('click','research-pin',openResearchPin);
      map.on('mouseenter','research-pin',()=>{map.getCanvas().style.cursor='pointer';});
      map.on('mouseleave','research-pin',()=>{map.getCanvas().style.cursor='';});
      paintResearch();
      ['p-fill', 'pts', 'p-dots'].forEach(l => { map.on('mouseenter', l, () => { map.getCanvas().style.cursor = 'pointer'; }); map.on('mouseleave', l, () => { map.getCanvas().style.cursor = ''; }); map.on('click', l, e => { const f = e.features && e.features[0]; if (f) { const r = byId(f.properties.i); if (r) select(r, { fly: false }); } }); });
      map.on('click', e => { if (!map.queryRenderedFeatures(e.point, { layers: ['p-fill', 'pts', 'p-dots'] }).length) closePop(); });
      setBase(base); addStates().then(() => { refresh(); start2(); }); map.on('zoom', natLegend); natLegend(); map.on('moveend', () => { const a = $('pmArea'); if (a) a.hidden = !(map.getZoom() >= 9 && !F.inView); });
    });
  }

  // Optional official GIS reference outlines; never alter tax lien data or vacancy.
  let flGisOn=false,flGisRequest=0,flGisDebounce=null,flGisLastStatus='';
  const gisEmpty=()=>({type:'FeatureCollection',features:[]});
  function gisStatus(message){
    if(flGisLastStatus===message)return;
    flGisLastStatus=message;
    const node=$('pmGisStatus');
    if(node){node.hidden=!flGisOn;node.textContent=message;}
  }
  function clearFloridaGIS(){
    if(!mapReady)return;
    for(const key of ['fl-gis-parcels','fl-gis-buildings'])map.getSource(key)?.setData(gisEmpty());
  }
  async function updateFloridaGIS(){
    if(!flGisOn||!mapReady)return;
    const sequence=++flGisRequest;
    if(map.getZoom()<16){clearFloridaGIS();gisStatus('FL GIS: zoom closer to street level (16+) to load outlines.');return;}
    const b=map.getBounds(),w=b.getWest(),e=b.getEast(),s=b.getSouth(),n=b.getNorth();
    if(e-w>0.018||n-s>0.018){clearFloridaGIS();gisStatus('FL GIS: zoom closer until the visible map area is smaller.');return;}
    const x=(w+e)/2,y=(s+n)/2;
    const county=x>-81.05&&x<-79.65&&y>26.25&&y<27.05?'palm':
      x>-82.35&&x<-81.45&&y>25.8&&y<26.95?'lee':null;
    if(!county){clearFloridaGIS();gisStatus('FL GIS: currently available only in Palm Beach and Lee County.');return;}
    const targets=county==='palm'?[['palm-parcels','fl-gis-parcels']]:
      [['lee-parcels','fl-gis-parcels'],['lee-buildings','fl-gis-buildings']];
    clearFloridaGIS();
    gisStatus('FL GIS: loading official '+(county==='palm'?'Palm Beach':'Lee County')+' outlines…');
    const bbox=[w,s,e,n].map(v=>v.toFixed(6)).join(',');
    const results=await Promise.all(targets.map(async ([source,target])=>{
      try{
        const response=await fetch('/.netlify/functions/florida-gis-overlay?'+new URLSearchParams({source,bbox}),{credentials:'same-origin'});
        const data=await response.json().catch(()=>({}));
        if(!response.ok)throw Error(data.error||'GIS service unavailable');
        if(data.type!=='FeatureCollection'||!Array.isArray(data.features))throw Error('Invalid GIS response');
        if(sequence===flGisRequest&&flGisOn)map.getSource(target)?.setData(data);
        return {ok:true,count:data.features.length,truncated:!!data.metadata?.truncated};
      }catch(e){return {ok:false,error:e.message};}
    }));
    if(sequence!==flGisRequest||!flGisOn)return;
    const good=results.filter(r=>r.ok),bad=results.filter(r=>!r.ok),count=good.reduce((n,r)=>n+r.count,0);
    if(bad.length)gisStatus('FL GIS: '+bad.length+' county GIS layer(s) unavailable. '+(count?count+' outlines loaded. ':'')+'Existing map unaffected.');
    else if(!count)gisStatus('FL GIS: official GIS returned no polygon outlines here. Move or zoom closer.');
    else gisStatus('FL GIS: '+count+' official outlines loaded'+(results.some(r=>r.truncated)?' (partial area; zoom closer)':'')+'. Visual references only.');
  }
  function queueFloridaGIS(){
    ++flGisRequest;clearTimeout(flGisDebounce);
    if(!flGisOn){clearFloridaGIS();return;}
    flGisDebounce=setTimeout(updateFloridaGIS,450);
  }
  // GIS data is state-specific. Never serve Florida geometry for another state's selection.
  function selectedGISCounty(){
    return IDX?.datasets.find(d=>d.id===curCounty&&d.state===curState)||null;
  }
  function verifiedGISLink(){
    const d=selectedGISCounty(), gis=d?.gis;
    if(!gis || !/^https:\/\//i.test(gis.url||''))return null;
    // A tax-department directory is not a parcel GIS viewer.
    if(!/gis|parcel map|parcel viewer|property appraiser|interactive map|arcgis|geographic information/i.test(gis.name||''))return null;
    return gis.url;
  }
  function syncGISButton(){
    const btn=$('pmGisButton');
    if(!btn)return;
    const code=curState&&/^[A-Z]{2}$/.test(curState)?curState:'';
    btn.textContent=code?code+' GIS':'GIS';
    btn.setAttribute('aria-label',code?'Official '+code+' parcel GIS':'Choose a state for parcel GIS');
    btn.title=code==='FL'?'Florida county GIS: Lee/Palm Beach overlays at street zoom':
      verifiedGISLink()?'Open the verified county GIS resource':
      (code?'GIS viewer not yet verified for this state or county':'Select a state to view GIS coverage');
    if(code!=='FL'&&flGisOn){flGisOn=false;++flGisRequest;clearTimeout(flGisDebounce);clearFloridaGIS();flGisLastStatus='';}
    btn.setAttribute('aria-pressed',String(code==='FL'&&flGisOn));
    const node=$('pmGisStatus');if(node&&code!=='FL')node.hidden=true;
  }
  function toggleFloridaGIS(button){
    syncGISButton();
    if(curState!=='FL'){
      const url=verifiedGISLink();
      if(url){window.open(url,'_blank','noopener,noreferrer');return;}
      const name=curState||'the selected state';
      say((curState?name+' GIS':'GIS')+': no verified parcel GIS viewer for this county. Select a mapped county to check available links.',true);
      return;
    }
    flGisOn=!flGisOn;button.setAttribute('aria-pressed',String(flGisOn));
    const node=$('pmGisStatus');if(node)node.hidden=!flGisOn;
    flGisLastStatus='';
    if(flGisOn)gisStatus('FL GIS enabled. Checking zoom and official sources…');
    else gisStatus('');
    queueFloridaGIS();
  }
  function natLegend() { const lg = $('pmLegend'); if (lg && mapReady) { const nat = map.getZoom() < 6.5; lg.classList.toggle('nat', nat); $('pmMap').classList.toggle('nat', map.getZoom() < 7); } }
  function feature(r) {
    const lbl = r.o ? String(r.o).toUpperCase().slice(0, 42) : 'OWNER NOT AVAILABLE';
    return { type: 'Feature', properties: { i: r.i, c: r.c, v: r.v ? 1 : 0, va: r.va ? 1 : 0, ac: r.ac == null ? null : r.ac, lbl, no: r.o ? 0 : 1 }, geometry: { type: 'Polygon', coordinates: r.g } };
  }
  function refresh() {
    const rs = shown().filter(passes); const polys = rs.filter(r => r.g), pts = rs.filter(r => !r.g && r.cx);
    if (mapReady) { map.getSource('parcels').setData({ type: 'FeatureCollection', features: polys.map(feature) }); map.getSource('dots').setData({ type: 'FeatureCollection', features: polys.filter(r => r.cx).map(r => ({ type: 'Feature', properties: { i: r.i, c: r.c }, geometry: { type: 'Point', coordinates: r.cx } })) }); map.getSource('pts').setData({ type: 'FeatureCollection', features: pts.map(r => ({ type: 'Feature', properties: { i: r.i, c: r.c }, geometry: { type: 'Point', coordinates: r.cx } })) }); }
    renderResults(rs); renderCounts(); paintResearch();
  }
  // Padding keeps the records clear of the search pill, the round buttons and the phone's bottom sheet, so a county lands centered in what you can actually see.
  const fitPad = () => homeMap ? {top:18,bottom:28,left:14,right:14} : embedded ? {top:pickerMap ? 8 : 100,bottom:pickerMap ? 8 : 58,left:10,right:38} : isMobile() ? { top: 140, bottom: snap === 'half' ? Math.round(innerHeight * 0.56) : snap === 'full' ? Math.round(innerHeight * 0.9) : 150, left: 24, right: 76 } : { top: 100, bottom: 40, left: 30, right: 80 };
  // The box to zoom to: the county's records, ignoring a few far-away strays (bad addresses) so the view lands on where the parcels really are.
  function fitBB(ds) {
    const d = ds.meta, pts = ds.recs.filter(r => r.cx).map(r => r.cx);
    if(!d.bb){const boxes=ds.recs.filter(r=>r.bb&&r.cx).map(r=>r.bb);return boxes.length?[Math.min(...boxes.map(b=>b[0])),Math.min(...boxes.map(b=>b[1])),Math.max(...boxes.map(b=>b[2])),Math.max(...boxes.map(b=>b[3]))]:null;}
    if (pts.length < 8) return d.bb;
    const xs = pts.map(p => p[0]).sort((a, b) => a - b), ys = pts.map(p => p[1]).sort((a, b) => a - b), q = (a, p) => a[Math.floor((a.length - 1) * p)];
    const core = [q(xs, .02), q(ys, .02), q(xs, .98), q(ys, .98)], full = Math.max(d.bb[2] - d.bb[0], d.bb[3] - d.bb[1]), cw = Math.max(core[2] - core[0], core[3] - core[1], 1e-4);
    if (full / cw < 2.5) return d.bb; const pad = cw * 0.06; return [core[0] - pad, core[1] - pad, core[2] + pad, core[3] + pad];
  }
  function fitTo(bb, pad) { if (!bb || !mapReady) return; map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: pad || fitPad(), maxZoom: 17.5, duration: REDUCED ? 0 : 240, easing: t => 1 - Math.pow(1 - t, 3) }); }

  // ---------- top bar and filters ----------
  const ICON = { haz: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 10v4"/><path d="M12 17.2v.1"/></svg>', layers: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5"/></svg>', filter: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>', spark: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M12 2.5c.5 4.6 2.9 7 7.5 7.5-4.6.5-7 2.9-7.5 7.5-.5-4.6-2.9-7-7.5-7.5 4.6-.5 7-2.9 7.5-7.5Z"/><path d="M19 15.5c.2 1.8 1.2 2.8 3 3-1.8.2-2.8 1.2-3 3-.2-1.8-1.2-2.8-3-3 1.8-.2 2.8-1.2 3-3Z" opacity=".8"/></svg>', cam: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8a2 2 0 0 1 2-2h2.5l1.5-2h6l1.5 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><circle cx="12" cy="12.5" r="3.5"/></svg>', pin: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' };
  function iconBtn(svg, label, fn, cls) { const b = mk('button', 'pm-ib ' + (cls || '')); b.type = 'button'; b.innerHTML = svg; b.setAttribute('aria-label', label); b.title = label; b.addEventListener('click', fn); return b; }
  let homeSearch, homeAiRequest;
  function buildTop() {
    const t = $('pmTop'); t.textContent = '';
    const stSel = mk('select'); stSel.setAttribute('aria-label', 'State'); const o0 = mk('option', '', 'Choose a state'); o0.value = ''; stSel.appendChild(o0);
    const have = {}; IDX.datasets.forEach(d => { have[d.state] = (have[d.state] || 0) + 1; });
    IDX.allStates.forEach(s => { const o = mk('option', '', s.n + (!homeMap && have[s.a] ? ' (' + have[s.a] + (have[s.a] === 1 ? ' county' : ' counties') + ' mapped)' : '')); o.value = s.a; stSel.appendChild(o); });
    const coSel = mk('select'); coSel.setAttribute('aria-label', 'County'); coSel.id = 'pmCounty'; coSel.disabled = true; const c0 = mk('option', '', 'County'); c0.value = ''; coSel.appendChild(c0);
    stSel.addEventListener('change', () => { if (!stSel.value) { curState = ''; curCounty = ''; fillCounties(coSel); syncGISButton(); aiRefresh(); return; } focusState(stSel.value); });
    coSel.addEventListener('change', () => { if (coSel.value) pickCounty(coSel.value); });
    const pill = mk('div', 'pm-pill'); const pi = mk('span', 'pi'); pi.innerHTML = ICON.pin; pill.append(pi, stSel, mk('i', 'sep'), coSel);
    const seg = mk('div', 'pm-seg'); seg.hidden = true; seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'Map type'); [['map', 'Map'], ['satellite', 'Satellite'], ['hybrid', 'Hybrid']].forEach(([k, n]) => { const b = mk('button', '', n); b.type = 'button'; b.dataset.base = k; b.setAttribute('aria-pressed', String(k === base)); b.addEventListener('click', () => { setBase(k); seg.hidden = true; }); seg.appendChild(b); });
    let asking = false, mapDraft = '', aiDraft = '';
    const lay = iconBtn(ICON.layers, 'Layers', () => { seg.hidden = !seg.hidden; }), fb = iconBtn(ICON.filter, 'Filters', () => { if (isMobile()) $('pmLeft').classList.add('open'); }, 'pm-fab'), aib = iconBtn(ICON.spark, 'Ask PricePocket AI', () => {
      if (homeMap && paid) setMode(!asking);
      else openAi();
    }, homeMap ? '' : 'pm-aib');
    function setMode(on) {
      if (asking === on) return;
      if (asking) aiDraft = input.value;
      else mapDraft = input.value;
      asking = on;
      aib.setAttribute('aria-checked', String(on));
      input.value = on ? aiDraft : mapDraft;
      input.placeholder = on ? 'Ask about this map area…' : 'Search state, county, parcel, owner…';
      input.enterKeyHint = on ? 'send' : 'search';
      input.setAttribute('aria-label', input.placeholder);
      go.setAttribute('aria-label', on ? 'Send question to Map Assistant' : 'Search');
      if (tab === 'ai') openRight(false);
      if (!on) {
        homeAiRequest?.abort();
        setStateHl([]);
        if (tab === 'ai' && mapReady) map.getSource('near').setData(empty);
      }
    }
    const gisHud=mk('div','pm-gis-status');gisHud.id='pmGisStatus';gisHud.hidden=true;gisHud.setAttribute('role','status');gisHud.setAttribute('aria-live','polite');
    const floridaBtn=mk('button','pm-gis-toggle','GIS');floridaBtn.type='button';floridaBtn.id='pmGisButton';
    floridaBtn.setAttribute('aria-label','Choose a state for parcel GIS');
    floridaBtn.setAttribute('aria-pressed','false');
    floridaBtn.title='Official GIS visual reference, not tax-sale availability';
    floridaBtn.addEventListener('click',()=>toggleFloridaGIS(floridaBtn));
    syncGISButton();
    const camb = iconBtn(ICON.cam, 'Live cameras', () => toggleCams()); camb.id = 'pmCamBtn'; const stack = mk('div', 'pm-stack'); const hzb = iconBtn(ICON.haz, 'Active hazards', () => toggleHaz()); hzb.id = 'pmHzBtn'; stack.append(lay, fb, floridaBtn, camb, hzb, aib, seg); t.append(gisHud);
    const area = mk('button', 'pm-area', 'Search this area'); area.type = 'button'; area.id = 'pmArea'; area.hidden = true; area.addEventListener('click', searchArea);
    aib.id = 'pmAsk';
    aib.title = 'Ask questions about the current county, parcel or map area.';
    const form = mk('form', 'pm-search');
    const input = mk('input'); input.type = 'search'; input.placeholder = 'Search state, county, parcel, owner…';
    input.setAttribute('aria-label', input.placeholder);
    const go = mk('button', '', 'Search'); go.type = 'submit'; form.append(input, go);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const entered = input.value.trim();
      if (asking) {
        if (entered.length < 3) { say('Enter a question for Map Assistant.'); return; }
        input.blur();
        openAi(entered, true);
        return;
      }
      const raw = entered.toLowerCase();
      const query = raw.replace(/ county\b/g, '').replace(/[,]+/g, ' ').replace(/\s+/g, ' ');
      F.query = null;
      const state = IDX.allStates.find(x => x.n.toLowerCase() === query || x.a.toLowerCase() === query);
      if (state) { focusState(state.a); return; }
      const counties = IDX.datasets.filter(x => {
        const county = x.county.toLowerCase().replace(/ county$/, '');
        return county === query || county + ' ' + x.state.toLowerCase() === query ||
          county + ' ' + IDX.allStates.find(s => s.a === x.state)?.n.toLowerCase() === query;
      });
      const county = counties.find(x => x.state === curState) || (counties.length === 1 ? counties[0] : null);
      if (county) { await pickCounty(county.id); return; }
      if (counties.length > 1) { say('Include the state to identify the county.'); return; }
      if (/\bcounty\b/.test(raw)) { say('No parcel dataset on this map matches that county.'); return; }
      if (raw && !active.size) { say('Choose a county before searching by parcel or owner.'); return; }
      F.query = raw ? raw.split(/\s+/) : null;
      refresh();
      if (raw) {
        const exact = shown().find(x => String(x.p).toLowerCase() === raw && passes(x));
        if (exact) select(exact, { fly: true });
        else { showTab('list', true); if (!shown().some(passes)) say('No matching parcels in the current county and filters.'); }
      }
    });
    input.addEventListener(homeMap ? 'input' : 'search', () => { if (!asking && !input.value && F.query) { F.query = null; refresh(); } });
    // Compact floating control dock; reuses the existing action handlers and map controls.
    const dock=mk('div','pm-tool-dock'), menu=mk('div','pm-tool-menu');
    menu.id='pmToolMenu';menu.setAttribute('aria-label','Map tools');menu.inert=true;
    const trigger=iconBtn(ICON.layers,'Open map tools',()=>setDock(!dock.classList.contains('open')),'pm-tool-trigger');
    trigger.id='pmToolTrigger';trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','pmToolMenu');
    const triggerLabel=mk('span','pm-tool-trigger-label','Tools');trigger.append(triggerLabel);
    function setDock(open){
      dock.classList.toggle('open',!!open);trigger.setAttribute('aria-expanded',String(!!open));
      trigger.setAttribute('aria-label',open?'Close map tools':'Open map tools');
      menu.inert=!open;
      if(!open)seg.hidden=true;
    }
    const tools=mk('div','pm-tools');tools.append(camb,hzb);
    for(const [button,label] of [[lay,'Layers'],[fb,'Filters'],[camb,'Cameras'],[hzb,'Hazards']]){
      button.appendChild(mk('span','pm-control-label',label));
    }
    menu.append(lay,fb,floridaBtn,tools);
    dock.append(trigger,menu);
    stack.replaceChildren(dock,aib);
    menu.addEventListener('click',e=>{
      const button=e.target.closest('button');
      if(!button)return;
      if(button===lay){return;} // Keep menu open while user chooses basemap.
      if(button.closest('.pm-seg'))return;
      setDock(false);
    });
    seg.addEventListener('click',e=>{if(e.target.closest('button'))setDock(false);});
    document.addEventListener('pointerdown',e=>{
      if(dock.classList.contains('open')&&!dock.contains(e.target))setDock(false);
    });
    window.addEventListener('keydown',e=>{if(e.key==='Escape')setDock(false);});
    window.__pmDock={menu,close:()=>setDock(false)};
    if (homeMap) {
      const searchBar = mk('div', 'pm-home-search');
      go.innerHTML = ICON.pin;
      go.setAttribute('aria-label', 'Search');
      form.prepend(go);
      input.type = 'text';
      input.setAttribute('role', 'searchbox');
      input.autocomplete = 'off';
      input.enterKeyHint = 'search';
      homeSearch = { i:input, go, setMode };
      searchBar.append(form, aib);
      const results = iconBtn('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 6h14M5 12h14M5 18h14"/></svg>', 'Properties', () => showTab('list', true), 'pm-home-results');
      results.append(mk('span', 'pm-control-label', 'Properties'));
      results.setAttribute('aria-controls','pmRight');
      menu.append(results);
      results.addEventListener('click',()=>setDock(false));
      buildHomeDrawer(results);
      const scope = mk('div','pm-home-scope');
      scope.append(pill,area);
      t.append(searchBar,scope);
      const layout = $('pm'), rail = mk('div','pm-home-rail'), content = mk('div','pm-home-content');
      rail.id = 'pmHomeRail'; rail.setAttribute('role','group'); rail.setAttribute('aria-label','Map controls');
      content.id = 'pmHomeContent';
      rail.append(stack);menu.append(seg);
      content.append($('pmLeft'), $('pmRight'), $('pmPop'), $('pmMsg'));
      $('pmMap').parentElement.before(t);
      layout.append(rail,content);
      const resizeFrame = () => {
        const height = Math.ceil(layout.getBoundingClientRect().height);
        if (height > 0 && window.frameElement) window.frameElement.style.height = height + 'px';
      };
      new ResizeObserver(resizeFrame).observe(layout);
      resizeFrame();
    } else { menu.append(seg); t.append(form,stack,pill,area); }
    $('pmCloseFilters').addEventListener('click', () => $('pmLeft').classList.remove('open'));
    document.addEventListener('click', e => { if (!seg.hidden && !e.target.closest('.pm-tool-dock')) seg.hidden = true; });
    window.__pm = { stSel, coSel };syncGISButton();
  }
  function buildHomeDrawer(trigger) {
    const panel = $('pmRight'), header = $('pmRH'), grip = $('pmGrip');
    const title = mk('h2', 'pm-home-title', 'Properties');
    title.id = 'pmHomeTitle';
    panel.setAttribute('aria-labelledby', title.id);
    panel.removeAttribute('aria-label');
    const sortControl = makeSort();
    sortControl.id = 'pmHomeSort'; sortControl.hidden = true;
    const expand = mk('button', 'pm-home-expand', '⌃');
    expand.type = 'button'; expand.id = 'pmHomeExpand';
    expand.setAttribute('aria-label', 'Expand properties');
    expand.addEventListener('click', () => setSnap(snap === 'full' ? 'half' : 'full'));
    const close = mk('button', 'pm-home-dismiss', '×');
    close.type = 'button'; close.setAttribute('aria-label', 'Close map panel');
    close.addEventListener('click', () => { setSnap('peek'); trigger.focus({preventScroll:true}); });
    const toolbar = mk('div','pm-home-toolbar');
    toolbar.append(title,sortControl,expand,close); header.append(toolbar);
    let start, pointerId;
    grip.addEventListener('pointerdown', e => {
      start = e.clientY; pointerId = e.pointerId; grip.setPointerCapture(e.pointerId);
    });
    grip.addEventListener('pointerup', e => {
      if (e.pointerId !== pointerId) return;
      const travel = e.clientY - start;
      pointerId = null;
      if (travel < -18) setSnap('full');
      if (travel > 18) setSnap(snap === 'full' ? 'half' : 'peek');
    });
    grip.addEventListener('pointercancel', () => { pointerId = null; });
  }
  function updateHomeDrawer(label, sortable = false) {
    if (!homeMap) return;
    const panel = $('pmRight');
    panel.dataset.listTitle = label;
    panel.dataset.sortable = String(sortable);
    const title = $('pmHomeTitle'), sortControl = $('pmHomeSort');
    if (panel.dataset.view !== 'ai') { title.textContent = label; sortControl.hidden = !sortable; }
  }
  function fillCounties(coSel) {
    coSel.textContent = ''; const c0 = mk('option', '', curState ? 'Choose a county' : 'County'); c0.value = ''; coSel.appendChild(c0);
    const list = IDX.datasets.filter(d => d.state === curState); list.forEach(d => { const o = mk('option', '', d.county + (homeMap ? '' : ' · ' + d.records.toLocaleString('en-US') + ' records')); o.value = d.id; coSel.appendChild(o); }); coSel.disabled = !list.length;
  }
  function stateNote() {
    const R = $('pmResults'); if (!curState) return; const has = IDX.datasets.some(d => d.state === curState), s = IDX.allStates.find(x => x.a === curState);
    if (!has) { R.textContent = ''; R.appendChild(mk('h3', '', s.n)); R.appendChild(mk('p', 'pm-empty', 'We do not have verified parcel records or boundaries for any ' + s.n + ' county yet, so nothing is drawn here. We never show shapes or listings we cannot verify.')); const a = mk('a', 'pm-btn', s.n + ' tax sale rules'); a.href = '/liens/states/state/?s=' + curState; a.style.display = 'inline-flex'; a.style.alignItems = 'center'; a.style.textDecoration = 'none'; R.appendChild(a); say(s.n + ' has no mapped counties yet.'); openRight(true); }
    else say('Choose a county to load its records.');
  }
  async function pickCounty(id, {announce = true, remember = true} = {}) {
    const ds = await load(id); if (!ds) return; curCounty = id; const d = ds.meta; if (window.__pm) { window.__pm.stSel.value = d.state; curState = d.state; fillCounties(window.__pm.coSel); window.__pm.coSel.value = id; }
    F.query = null; active = new Set([id]); F.inView = false; syncGISButton(); { const a = $('pmArea'); if (a) { a.textContent = 'Search this area'; a.classList.remove('on'); a.hidden = true; } }
    refresh(); closePop(); showTab('list', false); aiRefresh(); if (isMobile()) setSnap('peek'); // collapse the sheet so the county is in view; pull it up for the list
    const correctedBounds=fitBB(ds),mappedCount=ds.recs.filter(r=>r.g||r.cx).length;
    if (correctedBounds) fitTo(correctedBounds); else say(d.county + ': ' + d.records.toLocaleString('en-US') + ' records, but none has a verified boundary or map position yet. They are listed on the right.', true);
    if (announce && mappedCount && mappedCount < d.records) setTimeout(() => say(mappedCount.toLocaleString('en-US') + ' of ' + d.records.toLocaleString('en-US') + ' records have a verified boundary. The rest are listed, not drawn.'), 1500);
    setMapUrl(id);
    if (remember && locationContext) rememberArea(locationContext.countyArea(d));
  }
  async function searchArea() {
    const b = map.getBounds(), z = map.getZoom(); const hit = IDX.datasets.filter(d => d.bb && !(d.bb[2] < b.getWest() || d.bb[0] > b.getEast() || d.bb[3] < b.getSouth() || d.bb[1] > b.getNorth()));
    if (z < 9 && hit.length > 4) { say('Zoom in a little first: ' + hit.length + ' counties are in view.'); return; }
    await Promise.all(hit.filter(d => !loaded[d.id]).slice(0, 4).map(d => load(d.id))); active = new Set(hit.filter(d => loaded[d.id]).map(d => d.id)); F.inView = true; $('pmArea').textContent = 'Showing this area ✓'; $('pmArea').classList.add('on'); $('pmArea').hidden = false; refresh();
    sel = null; aiRefresh();
    if (locationContext) {
      const point = map.getCenter();
      const viewed = [...new Set(hit.filter(d => active.has(d.id)).map(d => d.state))];
      const state = viewed.length === 1 ? viewed[0] : '';
      rememberArea({ state, label: state ? 'Map area, ' + state : 'Current map area', lat:Math.round(point.lat * 100) / 100, lng:Math.round(point.lng * 100) / 100 });
    }
    if (!shown().some(passes)) say('No records with a verified position in this view.');
  }
  function clearArea() { F.inView = false; const a = $('pmArea'); if (a) { a.textContent = 'Search this area'; a.classList.remove('on'); } refresh(); }
  function buildFilters() {
    const f = $('pmFilters'); f.textContent = ''; const box = mk('div', 'pm-f'); f.appendChild(box); box.id = 'pmFbox';
    box.appendChild(mk('h3', '', 'Property type'));
    Object.entries(CATS).forEach(([k, v]) => { const l = mk('label'), cb = mk('input'); cb.type = 'checkbox'; cb.checked = F.cats[k]; cb.addEventListener('change', () => { F.cats[k] = cb.checked; refresh(); }); const sw = mk('span', 'sw'); sw.style.background = v.c; const n = mk('span', 'n'); n.dataset.cat = k; l.append(cb, sw, document.createTextNode(v.n), n); box.appendChild(l); });
    const lv = mk('label'), cv = mk('input'); cv.type = 'checkbox'; cv.addEventListener('change', () => { F.vacantOnly = cv.checked; refresh(); }); const sv = mk('span', 'sw'); sv.style.background = 'transparent'; sv.style.border = '2px solid ' + VAC; const nv = mk('span', 'n'); nv.dataset.cat = 'vac'; lv.append(cv, sv, document.createTextNode('Vacant land only'), nv); box.appendChild(lv);
    box.appendChild(mk('h3', '', 'Research updates'));
    const researchLabel = mk('label');
    const researchToggle = mk('input');
    researchToggle.type = 'checkbox'; researchToggle.checked = researchOn;
    researchToggle.addEventListener('change', () => { researchOn = researchToggle.checked; paintResearch(); });
    const researchCount = mk('span', 'n'); researchCount.id = 'pmResearchCount';
    researchLabel.append(researchToggle, document.createTextNode(' Approved updates (Pro first, Free after 48 hours)'), researchCount);
    box.appendChild(researchLabel);
    box.appendChild(mk('p','note','Pins only appear for server-approved updates that exactly match an existing mapped parcel.'));
    box.appendChild(mk('h3', '', 'Filters'));
    const chk = (label, key) => { const l = mk('label'), c = mk('input'); c.type = 'checkbox'; c.addEventListener('change', () => { F[key] = c.checked; refresh(); }); l.append(c, document.createTextNode(label)); box.appendChild(l); };
    chk('Small lots (1 acre or less)', 'small'); chk('Upcoming sales on the list', 'upcoming'); chk('Over-the-counter or surplus', 'otc'); chk('Verified on the official list we checked', 'verified');
    const rng = (label, a, b, step) => { const w = mk('label', 'col'); w.appendChild(mk('span', '', label)); const r2 = mk('div', 'row2'); [a, b].forEach((k, i) => { const inp = mk('input'); inp.type = 'number'; inp.min = '0'; inp.step = step; inp.inputMode = 'decimal'; inp.placeholder = i ? 'Max' : 'Min'; inp.setAttribute('aria-label', label + (i ? ' maximum' : ' minimum')); inp.addEventListener('input', () => { F[k] = inp.value; refresh(); }); r2.appendChild(inp); }); w.appendChild(r2); box.appendChild(w); };
    rng('Acreage', 'acMin', 'acMax', '0.1'); rng('Tax amount or minimum bid ($)', 'amtMin', 'amtMax', '100');
    const sel = (label, key, opts) => { const w = mk('label', 'col'); w.appendChild(mk('span', '', label)); const s = mk('select'); opts.forEach(([v, t]) => { const o = mk('option', '', t); o.value = v; s.appendChild(o); }); s.addEventListener('change', () => { F[key] = s.value; refresh(); }); w.appendChild(s); box.appendChild(w); };
    sel('Flood zone', 'flood', [['any', 'Any'], ['no', 'Not in a high-risk flood zone'], ['yes', 'In a high-risk flood zone']]); sel('Wetlands', 'wet', [['any', 'Any'], ['no', 'No mapped wetlands'], ['yes', 'Mapped wetlands present']]);
    const row = mk('div', 'pm-chips-row'); const rs = mk('button', 'pm-btn', 'Reset filters'); rs.type = 'button'; rs.addEventListener('click', () => { Object.assign(F, { cats: { tax_deed: true, tax_lien: true, land_bank: true }, vacantOnly: false, small: false, acMin: '', acMax: '', amtMin: '', amtMax: '', upcoming: false, otc: false, flood: 'any', wet: 'any', verified: false, inView: false }); buildFilters(); clearArea(); }); const ap = mk('button', 'pm-btn primary', 'Show results'); ap.type = 'button'; ap.addEventListener('click', () => { $('pmLeft').classList.remove('open'); if (homeMap) showTab('list', true); else openRight(true); }); row.append(ap, rs); box.appendChild(row);
    const nt = mk('p', 'pm-empty'); nt.style.fontSize = '.8rem'; nt.textContent = 'Solid outline: on the official list we checked. Dashed outline: historical or not confirmed. Yellow edge: vacant land. Colors show the kind of record, not that a property is available.'; box.appendChild(nt);
  }
  function renderCounts() {
    const rs = shown(); const c = { tax_deed: 0, tax_lien: 0, land_bank: 0, vac: 0 }; rs.forEach(r => { c[r.c]++; if (r.va) c.vac++; });
    document.querySelectorAll('#pmFbox [data-cat]').forEach(n => { n.textContent = rs.length ? c[n.dataset.cat].toLocaleString('en-US') : ''; });
    const lg = $('pmLegend'); lg.textContent = ''; Object.entries(CATS).forEach(([k, v]) => { const s = mk('span'); const i = mk('i'); i.style.background = v.c; s.append(i, document.createTextNode(v.n)); lg.appendChild(s); }); Object.entries(COL).forEach(([k, c]) => { const s = mk('span', 'lg-st'); const i = mk('i'); i.style.background = c; s.append(i, document.createTextNode(k)); lg.appendChild(s); }); lg.querySelectorAll(':scope > span:not(.lg-st)').forEach(x => x.classList.add('lg-pc')); const sv = mk('span', 'lg-pc'); const iv = mk('i'); iv.style.border = '2px solid ' + VAC; iv.style.background = 'transparent'; sv.append(iv, document.createTextNode('Vacant land')); lg.appendChild(sv);
  }

  // ---------- results ----------
  const sortFns = { sale: (a, b) => (isUpcoming(b) - isUpcoming(a)) || String(a.sd || '9').localeCompare(String(b.sd || '9')) || (a.amt || 1e12) - (b.amt || 1e12), low: (a, b) => (a.amt == null) - (b.amt == null) || a.amt - b.amt, big: (a, b) => (b.ac || 0) - (a.ac || 0) };
  function card(r, extra) {
    const b = mk('button', 'pm-card' + (sel && sel.i === r.i ? ' sel' : '')); b.type = 'button'; b.style.setProperty('--c', (CATS[r.c] || {}).c || '#94a3b8'); const inn = mk('div', 'b');
    inn.append(mk('b', '', r.a || 'Parcel ' + r.p));
    if (!homeMap) inn.append(mk('span', 's', r.o || 'Owner not available'));
    const meta = [CATS[r.c].n, acres(r), r.amt != null ? money(r.amt) : null].filter(Boolean).join(' · '); inn.appendChild(mk('span', 's', meta + (extra ? ' · ' + extra : '')));
    if (homeMap) b.setAttribute('aria-pressed', String(sel?.i === r.i));
    else {
      inn.appendChild(mk('span', 'pm-chip ' + (r.v ? 'ok' : 'warn'), r.v ? 'On the list we checked' : 'Not confirmed available'));
      if (!r.g) inn.appendChild(mk('span', 'pm-chip', 'Not drawn: no verified boundary'));
    }
    b.appendChild(mk('span', 'bar')); b.appendChild(inn); b.addEventListener('click', e => { select(r, { fly: true }); if (homeMap && !e.detail) $('pmPop').querySelector('a')?.focus({preventScroll:true}); });
    const w = mk('div', 'pm-cardw'); w.appendChild(b); const sp = mk('span'); sp.setAttribute('data-ppasel', JSON.stringify({ i: r.i, d: r._d, t: (r.a || 'Parcel ' + r.p) + ' \u00b7 ' + (IDX.datasets.find(x => x.id === r._d) || {}).county })); sp.style.cssText = 'display:block;padding:0 4px'; w.appendChild(sp); return w;
  }
  function makeSort() {
    const control = mk('select');
    control.setAttribute('aria-label', homeMap ? 'Sort properties' : 'Sort');
    for (const [value,label] of [['sale','Closest to sale'],['low','Lowest amount'],['big','Largest lot']]) {
      const option = mk('option', '', label);
      option.value = value; control.append(option);
    }
    control.value = sort;
    control.addEventListener('change', () => { sort = control.value; $('pmResults').scrollTop = 0; refresh(); });
    return control;
  }
  function renderResults(rs) {
    if (near) return renderNear();
    const R = $('pmResults'), scroll = R.scrollTop, loadedAny = Object.keys(loaded).length > 0;
    R.textContent = '';
    $('tabList').textContent = rs.length ? 'Properties · ' + rs.length.toLocaleString('en-US') : 'Properties';
    updateHomeDrawer(loadedAny ? rs.length.toLocaleString('en-US') + (rs.length === 1 ? ' property' : ' properties') : 'Properties', loadedAny && rs.length > 0);
    if (!Object.keys(loaded).length) { R.appendChild(mk('h3', '', 'Start here')); R.appendChild(mk('p', 'pm-empty', 'Choose a state and county above, or open one of these.')); const row = mk('div', 'pm-chips-row'); [...IDX.datasets].filter(d => d.mapped > 20).sort((a, b) => b.mapped - a.mapped).slice(0, 10).forEach(d => { const b = mk('button', '', d.county.replace(/^City of /, '') + ', ' + d.state); b.type = 'button'; b.addEventListener('click', () => pickCounty(d.id)); row.appendChild(b); }); R.appendChild(row); R.appendChild(mk('p', 'pm-empty', IDX.note)); return; }
    if (!homeMap) {
      R.append(mk('h3', '', 'Properties'), mk('p', 'cnt', rs.length.toLocaleString('en-US') + ' match your filters' + (F.inView ? ' in this view' : '') + '. Showing ' + Math.min(rs.length, pageN) + '.'));
      const control = makeSort(); control.style.cssText = 'width:100%;margin-bottom:6px'; R.append(control);
    }
    [...rs].sort(sortFns[sort]).slice(0, pageN).forEach(r => R.appendChild(card(r)));
    if (rs.length > pageN) { const m = mk('button', 'pm-btn', 'Show more'); m.type = 'button'; m.style.width = '100%'; m.addEventListener('click', () => { pageN += 40; refresh(); }); R.appendChild(m); }
    if (!rs.length) R.appendChild(mk('p', 'pm-empty', 'Nothing matches these filters. Try resetting them.'));
    if (homeMap) R.scrollTop = scroll;
  }
  const REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches), isMobile = () => homeMap || window.innerWidth < 980;
  // Bottom sheet with three resting heights (peek, half, full). Drag the handle or the tabs; it springs to the nearest one.
  const SNAPS = ['peek', 'half', 'full']; let snap = 'peek';
  function setSnap(s) {
    snap = s;
    const r = $('pmRight');
    r.dataset.snap = s; r.style.removeProperty('--sy'); r.classList.remove('dragging');
    if (homeMap) {
      r.inert = s === 'peek';
      document.querySelector('.pm-home-results').setAttribute('aria-expanded', String(s !== 'peek' && r.dataset.view === 'list'));
      const expand = $('pmHomeExpand');
      expand.textContent = s === 'full' ? '⌄' : '⌃';
      expand.setAttribute('aria-label', s === 'full' ? 'Collapse properties' : 'Expand properties');
    }
  }
  const openRight = on => { if (isMobile()) setSnap(on ? (snap === 'peek' ? 'half' : snap) : 'peek'); };
  function initSheet() {
    const r = $('pmRight'), h = $('pmRH'); setSnap('peek'); if (homeMap) return; let y0 = 0, base0 = 0, t0 = 0, drag = false, moved = false;
    const px = { peek: () => r.offsetHeight - 124, half: () => r.offsetHeight * 0.46, full: () => r.offsetHeight * 0.06 };
    h.addEventListener('pointerdown', e => { if (!isMobile()) return; drag = true; moved = false; y0 = e.clientY; t0 = e.timeStamp; base0 = px[snap](); });
    h.addEventListener('pointermove', e => { if (!drag) return; const dy = e.clientY - y0; if (!moved && Math.abs(dy) > 6) { moved = true; try { h.setPointerCapture(e.pointerId); } catch (x) {} } if (!moved) return; r.classList.add('dragging'); r.style.setProperty('--sy', Math.max(px.full(), Math.min(px.peek(), base0 + dy)) + 'px'); });
    const end = e => { if (!drag) return; drag = false; try { h.releasePointerCapture(e.pointerId); } catch (x) {} if (!moved) return; const dy = e.clientY - y0, v = dy / Math.max(1, e.timeStamp - t0), cur = base0 + dy + v * 120; const target = SNAPS.reduce((b, s) => Math.abs(px[s]() - cur) < Math.abs(px[b]() - cur) ? s : b, 'peek'); h.dataset.moved = '1'; setTimeout(() => { delete h.dataset.moved; }, 60); setSnap(target); };
    h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end);
    $('pmGrip').addEventListener('click', () => { if (h.dataset.moved) return; setSnap(snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'peek'); });
    h.addEventListener('click', e => { if (h.dataset.moved) { e.stopPropagation(); e.preventDefault(); } }, true);
  }

  // ---------- popup ----------
  function closePop() { $('pmPop').hidden = true; sel = null; near = null; if (mapReady) { map.getSource('sel').setData(empty); map.getSource('sel-point').setData(empty); map.getSource('near').setData(empty); } refresh(); setMapUrl(curCounty); }
  function row(dl, k, v) { if (v == null || v === '') return; const d = mk('div'); d.append(mk('dt', '', k), mk('dd', '', v)); dl.appendChild(d); }
  // Satellite picture of the parcel with its verified outline drawn on top (same projection as the picture, so they line up).
  const MERC = { R: 6378137, X: lng => lng * Math.PI / 180 * 6378137, Y: lat => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * 6378137 };
  function hero(r, d) {
    const w = mk('div', 'phero'); const cat = CATS[r.c];
    if (!r.bb || !r.g) { w.classList.add('nobound'); w.append(mk('b', '', 'No verified boundary'), mk('span', '', r.why || 'We list this parcel but cannot draw it. We never draw shapes we cannot verify.')); return w; }
    const W = 640, H = 360; let x0 = MERC.X(r.bb[0]), x1 = MERC.X(r.bb[2]), y0 = MERC.Y(r.bb[1]), y1 = MERC.Y(r.bb[3]); const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    let pw = Math.max((x1 - x0) * 1.7, 170), ph = Math.max((y1 - y0) * 1.7, 95); if (pw / ph > W / H) ph = pw * H / W; else pw = ph * W / H; x0 = cx - pw / 2; x1 = cx + pw / 2; y0 = cy - ph / 2; y1 = cy + ph / 2;
    const img = mk('img'); img.alt = 'Satellite view of parcel ' + r.p + ' with its boundary outlined'; img.width = W; img.height = H; img.loading = 'lazy'; img.decoding = 'async';
    img.src = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=' + [x0, y0, x1, y1].map(v => v.toFixed(1)).join(',') + '&bboxSR=3857&imageSR=3857&size=' + W + ',' + H + '&format=jpg&f=image'; img.onerror = () => { img.remove(); };
    const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(NS, 'path'); path.setAttribute('d', r.g.map(ring => 'M' + ring.map(p => ((MERC.X(p[0]) - x0) / pw * W).toFixed(1) + ',' + ((y1 - MERC.Y(p[1])) / ph * H).toFixed(1)).join('L') + 'Z').join(' '));
    path.setAttribute('fill', cat.c + '40'); path.setAttribute('stroke', '#fff'); path.setAttribute('stroke-width', '3'); path.setAttribute('vector-effect', 'non-scaling-stroke'); path.setAttribute('stroke-linejoin', 'round'); svg.appendChild(path);
    const tag = mk('span', 'ptag', cat.n); tag.style.background = cat.c; w.append(img, svg, tag); if (r.va) { const v = mk('span', 'ptag v', 'Vacant land'); w.appendChild(v); } return w;
  }
  const hoaText = v => !v ? 'Not on file' : v === 'unknown' ? 'Not confirmed' : v;
  const tile = (k, v, s) => { const t = mk('div', 't'); t.append(mk('span', 'k', k), mk('b', '', v == null || v === '' ? '—' : String(v))); if (s) t.appendChild(mk('span', 's', s)); return t; };
  // Turf is strictly opt-in browser-side property research; no county records are rewritten.
  function spatialPanel(r,d){
    const panel=mk('section','pm-spatial'),title=mk('h4','', 'Parcel measurements');
    const lib=window.PPAParcelSpatial, turfLib=window.turf;
    panel.appendChild(title);
    const ac=lib?.calculateAcreage(r,turfLib)||{status:'unavailable',reason:'Spatial analysis unavailable'};
    if(ac.status==='measured'){
      const amount=ac.acres>=0.1?ac.acres.toFixed(2):ac.acres.toFixed(4);
      panel.appendChild(mk('p','pm-spatial-value','Calculated acreage: '+amount+' acres'));
      panel.appendChild(mk('p','pm-spatial-note','Estimated from the mapped parcel polygon using Turf.js; may differ from county-reported acreage.'));
    }else panel.appendChild(mk('p','pm-spatial-note','Calculated acreage unavailable: '+ac.reason+'.'));
    const buildings=mk('p','pm-spatial-result');
    const box=lib?.buildingQueryBBox(r,d);
    if(!box){
      buildings.textContent=d?.state==='FL'&&/^Lee(?: County)?$/i.test(d?.county||'')
        ?'Building overlap: unavailable for this parcel boundary or query area.'
        :'Building overlap: not available for this county (Lee County coverage only).';
      panel.appendChild(buildings);
      return panel;
    }
    buildings.textContent='Building overlap: not checked';
    const check=mk('button','pm-spatial-check','Check mapped buildings');
    check.type='button';
    check.addEventListener('click',async()=>{
      if(!panel.isConnected)return;
      check.disabled=true;buildings.textContent='Checking Lee County mapped building footprints…';
      try{
        const url='/.netlify/functions/florida-gis-overlay?'+new URLSearchParams({source:'lee-buildings',bbox:box});
        const response=await fetch(url,{credentials:'same-origin'});
        if(!response.ok)throw Error('County GIS service unavailable');
        const data=await response.json();
        if(!panel.isConnected)return;
        const result=lib.buildingOverlap(r,data,turfLib);
        if(result.status==='overlap')buildings.textContent='Mapped building overlap detected ('+result.count+' footprint'+(result.count===1?'':'s')+').'+
          (result.partial?' Results may be incomplete.':'');
        else if(result.status==='no-overlap')buildings.textContent='No overlap in the returned building footprints. Not confirmation of vacant land.';
        else if(result.status==='incomplete')buildings.textContent='Building overlap inconclusive: returned data incomplete.';
        else buildings.textContent='Building overlap unavailable: '+result.reason+'.';
      }catch{
        if(panel.isConnected)buildings.textContent='Building overlap unavailable: county GIS could not be checked.';
      }finally{if(panel.isConnected){check.disabled=false;check.textContent='Check again';}}
    });
    panel.append(check,buildings,mk('p','pm-spatial-note','Footprints are a map-data research signal, not proof of current building condition or vacancy.'));
    return panel;
  }
  function group(title, open, fill) { const g = mk('details', 'grp'); if (open) g.open = true; const s = mk('summary'); s.append(mk('span', '', title), mk('i', 'chev')); g.appendChild(s); const dl = mk('dl'); fill(dl, g); g.appendChild(dl); return g; }
  // ---------- Explore (same tools as the parcel page: Photo, Street View, Cameras, Weather, Fires, Crime, Record, Neighborhood, Jobs, Road, Places, Energy, Parks) ----------
  // The tool code lives in /liens/states/lien-ui.js (shared with the parcel page). It loads only when someone opens "Explore", and the map calls below are no-ops
  // because that code was written for a Leaflet map; everything else (results, Pro lock, notes) is identical to the parcel page.
  let lienUi = null;
  const loadLienUi = () => lienUi || (lienUi = new Promise((ok, no) => { window.Map3D = window.Map3D || {}; const s = document.createElement('script'); s.src = '/liens/states/lien-ui.js'; s.onload = () => (typeof CameraData !== 'undefined' ? ok() : no()); s.onerror = no; document.head.appendChild(s); }));
  const nop = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : nop, apply: () => nop });
  function buildExplore(r, host) {
    const wrap = mk('div', 'pm-explore'), anchor = mk('div'); wrap.append(mk('h4', '', 'Explore this parcel'), anchor, mk('p', 'note', 'Loading tools…')); host.prepend(wrap);
    loadLienUi().then(() => {
      wrap.querySelector('.note').remove();
      const L = { layerGroup: () => nop, circleMarker: () => nop, marker: () => nop, polyline: () => nop, latLngBounds: () => nop }, M = { hasLayer: () => false, removeLayer() {}, fitBounds() {} };
      CameraData.mapAttach(L, M, anchor, () => ({ lat: r.cx[1], lng: r.cx[0] }), null);
      // when a tool opens its result under the grid, bring it into view inside the sheet (and again once it has loaded)
      const show = () => { const pn = [...wrap.querySelectorAll('.campanel,.firepanel,.enpanel,.wxpanel,.govpanel')].find(x => !x.hidden); if (pn) pn.scrollIntoView({ block: 'nearest', behavior: REDUCED ? 'auto' : 'smooth' }); };
      wrap.addEventListener('click', e => { if (e.target.closest('.tool')) { setTimeout(show, 300); setTimeout(show, 1600); } });
      // Cameras: use the map's own camera view (markers on the map) instead of a second copy inside the card
      setTimeout(() => { const old = wrap.querySelector('.cambar .tool[aria-label^="Nearby Cameras"]'); if (old) { const nb = old.cloneNode(true); old.replaceWith(nb); nb.addEventListener('click', () => { openCams({ lat: r.cx[1], lng: r.cx[0] }, 10, true); }); } }, 400);
    }).catch(() => { const n = wrap.querySelector('.note'); if (n) n.textContent = 'Tools could not load. Check your connection and try again.'; });
  }
  function addSavedElevation(host,r,d){
    if(!r?.i||!d?.id||!r.cx)return;
    const note=mk('p','note','Elevation: checking saved terrain data…');
    host.appendChild(note);
    const key=r.i;
    fetch('/.netlify/functions/map-elevation?'+new URLSearchParams({dataset:d.id,record:key}),{cache:'default'})
      .then(x=>x.ok?x.json():Promise.reject(Error('Unavailable')))
      .then(v=>{
        if(!note.isConnected)return;
        if(!v.found){note.textContent='Elevation: not yet researched';return;}
        note.textContent='Approximate ground elevation: '+v.feet.toLocaleString()+' ft ('+v.meters+' m) · '+v.dataset+' · checked '+v.checkedAt.slice(0,10)+'. Not a survey or flood assessment.';
      }).catch(()=>{if(note.isConnected)note.textContent='Elevation: temporarily unavailable';});
  }
  function homeParcelCard(card, r, d) {
    const info = mk('div', 'pm-home-parcel-info');
    const county = /\b(county|parish|borough|city)\b/i.test(d.county) ? d.county : d.county + ' County';
    info.append(mk('b', '', county + ', ' + d.state), mk('span', '', 'Parcel: ' + r.p));
    const facts = mk('div', 'pm-home-facts');
    for (const fact of [acres(r) || sqft(r), r.amt == null ? null : (r.al || 'Listed amount') + ': ' + money(r.amt), r.mv == null ? 'Market value unavailable' : 'Market value: ' + money(r.mv)]) {
      if (fact) facts.append(mk('span', '', fact));
    }
    info.append(facts);
    addSavedElevation(info,r,d);
    info.appendChild(spatialPanel(r,d));
    const close = mk('button', 'x', '×'); close.type = 'button'; close.setAttribute('aria-label', 'Close property'); close.addEventListener('click', closePop);
    const details = mk('a', 'pm-home-property', 'View property →');
    details.href = d.detail ? '/liens/parcel/?k=' + encodeURIComponent(r.i) : '/map/?' + new URLSearchParams({c:d.id,p:r.p});
    card.append(info, close, details);
    if (r.g && r.bb) {
      const thumbnail = hero(r, d);
      const image = thumbnail.querySelector('img');
      image.addEventListener('error', () => thumbnail.remove(), {once:true});
      card.prepend(thumbnail);
    }
    card.hidden = false;
  }
  function popup(r) {
    const ap = $('pmAi'); if (ap) ap.hidden = true; if (isMobile()) { const cp = $('pmCam'); if (cp) cp.hidden = true; } const p = $('pmPop'); p.textContent = ''; const cat = CATS[r.c], d = IDX.datasets.find(x => x.id === r._d), S = IDX.states[d.state] || (typeof STATES !== 'undefined' && STATES.find(x => x.a === d.state)) || null;
    if (homeMap) { homeParcelCard(p, r, d); return; }
    const hd = mk('div', 'hd'), ttl = mk('div', 't'); ttl.append(mk('b', r.a ? '' : 'idt', r.a || r.p), mk('span', '', (r.a ? '' : 'Parcel ID · ') + d.county + ', ' + d.state + (r.a ? ' · ' + r.p : ''))); const x = mk('button', 'x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.addEventListener('click', closePop); hd.append(ttl, x); p.appendChild(hd);
    const bd = mk('div', 'bd'); bd.appendChild(hero(r, d));
    // key facts
    const sale = r.sd ? [r.sl || 'Sale date', r.sd, null] : (r.av != null && !(r.amt == null && r.mv != null)) ? ['Assessed', money(r.av), null] : ['Status', r.t ? r.t.split(/[.(]/)[0].slice(0, 28) : null, null];
    const tiles = mk('div', 'tiles'); tiles.append(tile(r.amt != null ? (/min.*bid|starting bid/i.test(r.al || '') ? 'Min. bid' : /bid/i.test(r.al || '') ? 'Bid' : /price|face/i.test(r.al || '') ? 'Price' : 'Amount') : (r.mv != null ? 'County value' : 'Amount'), r.amt != null ? money(r.amt) : (r.mv != null ? money(r.mv) : null)), tile('Size', acres(r) || sqft(r)), tile(sale[0], sale[1])); bd.appendChild(tiles);
    bd.appendChild(spatialPanel(r,d));
    const st = mk('div', 'stat ' + (r.v ? 'ok' : 'warn')); st.append(mk('i', 'sdot'), mk('div', '', ''));
    const sb = st.lastChild; sb.append(mk('b', '', r.v ? 'On the official list we checked' + (r.ck ? ' · ' + r.ck : '') : 'Not confirmed as available'), mk('span', '', r.v ? 'Lists change. Confirm with the county before you rely on it.' : (r.t || 'Treat this as a historical or unverified record.') + (r.fr ? ' ' + r.fr + '.' : ''))); bd.appendChild(st);
    // owner
    bd.appendChild(group('Owner', true, dl => { const o = mk('div', 'own', r.o || 'Owner not available'); dl.appendChild(o); row(dl, 'Ownership type', r.ot); row(dl, 'Source', r.o ? r.os : null); row(dl, 'Last verified', r.o ? r.ck : null); if (!r.o) dl.appendChild(mk('p', 'note', 'No reliable public owner record is on file, so none is shown.')); if (r.oa) dl.appendChild(mk('p', 'note', 'The county sale list shows a different owner name: ' + r.oa + '. The parcel record is shown above.')); }));
    bd.appendChild(group('Sale and taxes', true, dl => {
      row(dl, 'Category', cat.n); row(dl, 'Record status', r.t); row(dl, 'Tax year', r.ty); if (r.amt != null) row(dl, r.al || 'Amount on the list', money(r.amt)); row(dl, 'Interest or penalty on the list', r.rt); row(dl, r.sl || 'Sale date', r.sd); if (S && S.red && (r.c === 'tax_lien' || r.c === 'tax_deed')) row(dl, 'Redemption (state rule)', S.red); if (r.ct) row(dl, 'Certificate', r.ct);
      if (S && S.sys) dl.appendChild(mk('p', 'note', d.state + ' rules (' + S.sys + ')' + (S.rate ? ': ' + S.rate + '. ' : '. ') + (S.verify ? 'Sources differ for this state: verify with the county. ' : '') + 'A lien and a deed are not the same thing.')); (r.w || []).forEach(w => { if (!/^We could not tell|^No official source/.test(w)) dl.appendChild(mk('p', 'note', w)); }); }));
    bd.appendChild(group('Property', false, dl => { row(dl, 'Parcel ID', r.p); row(dl, 'Address', r.a || 'No street address on the record'); row(dl, 'Acreage', acres(r) || 'Not on file'); row(dl, 'Square footage', sqft(r) || 'Not on file'); row(dl, 'Zoning', r.zn || 'Not on file'); row(dl, 'Land', r.va ? 'Vacant land' : (r.us || 'Not stated')); row(dl, 'Market value', r.mv == null ? 'Market value unavailable' : money(r.mv)); row(dl, 'Assessed value', r.av == null ? null : money(r.av)); row(dl, 'HOA status', hoaText(r.hoa));
      row(dl, 'Flood zone (FEMA)', r.fz ? r.fz.z + (r.fz.sfha != null ? (r.fz.sfha > 0 ? ' · ' + r.fz.sfha + '% in a high-risk zone' : ' · none in a high-risk zone') : '') : 'Not checked'); row(dl, 'Wetlands (NWI)', r.wt != null ? (r.wt > 0 ? r.wt + '% of the lot touches mapped wetlands' : 'None mapped') : 'Not checked'); row(dl, 'Elevation', 'Automatic terrain estimate shown below when available'); }));
    addSavedElevation(bd,r,d);
    if(r.__brainEvidence?.source){
      const source=mk('a','note','Official GIS boundary source');
      source.href=r.__brainEvidence.source;
      source.target='_blank';source.rel='noopener noreferrer';
      bd.appendChild(source);
    }
    bd.appendChild(group('Sources', false, dl => { const src = mk('p', 'note'); src.appendChild(document.createTextNode('Official list: ')); if (r.su) { const a = mk('a', '', 'county list'); a.href = r.su; a.target = '_blank'; a.rel = 'noopener noreferrer'; src.appendChild(a); src.appendChild(document.createTextNode(r.ck ? ' (checked ' + r.ck + ')' : '')); } else src.appendChild(document.createTextNode((r.src || 'see the county') + (r.ck ? ' (checked ' + r.ck + ')' : ''))); dl.appendChild(src); if (d.gis) { const g = mk('p', 'note'); g.appendChild(document.createTextNode('County map: ')); const a = mk('a', '', d.gis.name); a.href = d.gis.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; g.appendChild(a); dl.appendChild(g); } }));
    const brief = mk('div', 'pm-brief');
    brief.append(mk('span', '', d.county + ', ' + d.state + ' · Parcel ' + r.p));
    brief.append(mk('span', '', [acres(r), r.amt != null ? (r.al || 'Listed amount') + ' ' + money(r.amt) : null, r.mv != null ? 'Market value ' + money(r.mv) : 'Market value unavailable'].filter(Boolean).join(' · ')));
    p.appendChild(brief);
    if (embedded) { const details = mk('details', 'pm-extra'); details.append(mk('summary', '', 'Property details and more tools'), bd); p.append(details); }
    else p.appendChild(bd);
    // action bar: always visible
    const bar = mk('div', 'abar'), key = encodeURIComponent(r.i);
    const ab = (label, svg, fn) => { const b = mk('button', 'ab'); b.type = 'button'; b.innerHTML = svg; b.append(mk('span', '', label)); b.addEventListener('click', fn); return b; };
    const sp = mk('span', 'selslot'); sp.setAttribute('data-ppasel', JSON.stringify({ i: r.i, d: r._d, t: (r.a || 'Parcel ' + r.p) + ' · ' + d.county + ', ' + d.state })); // Pro: Select for download
    const det = mk('a', 'ab main'); det.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/></svg>'; det.append(mk('span', '', 'View property →')); det.href = d.detail ? '/liens/parcel/?k=' + key : '/liens/states/state/?s=' + d.state;
    const ai = ab('Map Assistant' + (paid ? '' : ' (Pro)'), ICON.spark, () => openAi('Research parcel ' + r.p + ' in ' + d.county + ', ' + d.state + ': risks and what to verify before bidding', true));
    const more = mk('div', 'more'); more.hidden = true;
    const li = (t, href, extra) => { const a = mk(href ? 'a' : 'button', 'mi', t); if (href) { a.href = href; if (extra) { a.target = '_blank'; a.rel = 'noopener noreferrer'; } } else a.type = 'button'; return a; };
    if (d.gis) more.appendChild(li('View official county GIS', d.gis.url, true));
    if (d.report) more.appendChild(li('Download parcel PDF' + (paid ? '' : ' (Pro)'), '/ai/report/?county=' + encodeURIComponent(d.county) + '&parcel=' + encodeURIComponent(r.p), true));
    more.appendChild(li('Add to my portfolio', '/portfolio/?add=1&state=' + d.state + '&county=' + encodeURIComponent(d.county.replace(/ County$/, '')) + '&parcel=' + encodeURIComponent(r.p) + (r.amt != null ? '&paid=' + r.amt : '')));
    const nb = li('View nearby properties'); nb.addEventListener('click', () => { showNear(r, 1); }); more.appendChild(nb);
    const mb = ab('More', '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/></svg>', () => { more.hidden = !more.hidden; mb.classList.toggle('on', !more.hidden); if (!more.hidden && r.cx && !more.querySelector('.pm-explore')) buildExplore(r, more); });
    bar.append(sp, ai, det, mb); p.append(more, bar); p.hidden = false;
    { const hdr = p.querySelector('.hd'); let y0 = null; hdr.addEventListener('pointerdown', e => { if (isMobile() && !e.target.closest('button')) { y0 = e.clientY; try { hdr.setPointerCapture(e.pointerId); } catch (x) {} p.style.transition = 'none'; } }); hdr.addEventListener('pointermove', e => { if (y0 != null) p.style.transform = 'translateY(' + Math.max(0, e.clientY - y0) + 'px)'; }); const up = e => { if (y0 == null) return; const dy = e.clientY - y0; y0 = null; p.style.transition = ''; p.style.transform = ''; if (dy > 90) closePop(); }; hdr.addEventListener('pointerup', up); hdr.addEventListener('pointercancel', up); }
  }
  function select(r, o) {
    sel = r; near = null; popup(r);
    const dataset = IDX.datasets.find(x => x.id === r._d);
    if (embedded&&pickerMap&&dataset){
      window.parent.dispatchEvent(new CustomEvent('ppa:workshop-parcel',{detail:{
       parcelId:r.p,county:dataset.county,state:dataset.state,acres:r.ac??r.__brainEvidence?.estimatedAcres??null,
       estimated:r.ac==null,source:r.__brainEvidence?.source??null
      }}));
    }
    if (dataset && locationContext && o?.remember !== false) rememberArea(locationContext.countyArea(dataset, r));
    if (mapReady) { map.getSource('near').setData(empty); map.getSource('sel').setData(r.g ? { type: 'FeatureCollection', features: [feature(r)] } : empty); if (homeMap) map.getSource('sel-point').setData(r.cx ? {type:'Feature',geometry:{type:'Point',coordinates:r.cx},properties:{}} : empty); }
    if (homeMap && o?.fly && r.bb && mapReady) {
      map.fitBounds([[r.bb[0], r.bb[1]], [r.bb[2], r.bb[3]]], {padding:{top:20,bottom:26,left:22,right:22},maxZoom:18.5,duration:REDUCED ? 0 : 240});
    } else if (o && o.fly && r.bb && mapReady) map.fitBounds([[r.bb[0], r.bb[1]], [r.bb[2], r.bb[3]]], { padding: { top: embedded ? 92 : 120, bottom: embedded ? Math.min(185, Math.floor(innerHeight * .36)) : window.innerWidth < 980 ? 330 : 120, left: 60, right: window.innerWidth > 979 ? 420 : 40 }, maxZoom: 18.5, duration: REDUCED ? 0 : 240, easing: t => 1 - Math.pow(1 - t, 3) });
    else if (r.cx && mapReady && o && o.fly) map.easeTo({ center: r.cx, zoom: Math.max(map.getZoom(), 16) });
    openRight(false); setMapUrl(r._d, r.p); refresh(); aiRefresh();
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
  const aiCtx = () => { if (sel) return { d: IDX.datasets.find(x => x.id === sel._d), r: sel }; if (F.inView) {
      const area = [...active].map(id => IDX.datasets.find(x => x.id === id)).filter(Boolean);
      if (area.length === 1) return {d:area[0]};
      if (area.length > 1) return {states:[...new Set(area.map(d => d.state))], sn:'the current map area'};
    }
    const d = curCounty && IDX.datasets.find(x => x.id === curCounty); if (d) return { d }; if (curState) { const s = IDX.allStates.find(x => x.a === curState); return { st: curState, sn: s ? s.n : curState }; } return null; };
  const ctxLabel = c => !c ? 'the whole country' : c.r ? 'parcel ' + c.r.p + ' · ' + c.d.county + ', ' + c.d.state : c.d ? c.d.county + ', ' + c.d.state : c.sn;
  function chips() {
    if (workspace) return [['↗','Compare states','Which states pay the highest interest?'],['◷','Fast turnarounds','Which states have the shortest redemption period?'],['⌕','Find opportunities','List the cheapest tax liens'],['☷','Build a list','Find tax liens with the lowest listed prices']];

    const c = aiCtx(); if (!c) return [['📈', 'Compare states', 'Which states pay the highest interest?'], ['⏱️', 'Fast turnarounds', 'Which states have the shortest redemption period?'], ['💰', 'Cheapest liens', 'List the cheapest liens'], ['📅', 'My deadlines', 'Which of my certificates have upcoming deadlines?']];
    if (c.r) return [['🔍', 'Research this parcel', 'Research parcel ' + c.r.p + ' in ' + c.d.county + ', ' + c.d.state + ': risks and what to verify before bidding'], ['⏱️', 'Redemption rules', 'What are the redemption rules in ' + c.d.state + '?'], ['⚖️', 'How the sale works', 'What does ' + c.d.state + ' law say about tax ' + (c.r.c === 'tax_deed' ? 'deed' : 'lien') + ' sales?'], ['📈', 'Compare states', 'Which states pay the highest interest?']];
    if (c.states) return [['💰', 'Cheapest in this area', 'List the cheapest liens here'], ['📈', 'Compare states', 'Which states pay the highest interest?']];
    const w = c.d ? c.d.county + ', ' + c.d.state : c.sn, s = c.d ? c.d.state : c.st; return [['💰', 'Cheapest here', 'List the cheapest liens in ' + w], ['⏱️', 'Redemption rules', 'What are the redemption rules in ' + s + '?'], ['📈', 'Best interest in ' + s, 'Which counties in ' + s + ' pay the highest interest?'], ['📅', 'My deadlines', 'Which of my certificates have upcoming deadlines?']];
  }
  function buildAi() {
    const h = $('pmAiBox'); h.textContent = '';
    const hero = mk('div', 'ai-hero'); hero.append(mk('span', 'ai-dot'), mk('b', '', workspace ? 'PricePocket AI' : 'Map Assistant'), mk('span', 'ai-sub', workspace ? 'Full Pro workspace' : 'Ask about the current map area')); if (!workspace && !homeMap) h.appendChild(hero);
    const ctx = mk('p', 'note ai-ctx'); h.appendChild(ctx);
    if (!signedIn || !paid) { const g = mk('p', 'pm-flag warn'); g.append(document.createTextNode('PricePocket AI is for Pro members. ')); const a = mk('a', '', 'See the Pro plan'); a.href = '/plans/?from=' + encodeURIComponent(location.pathname + location.search) + '&src=' + encodeURIComponent('PricePocket AI'); a.style.color = '#fde68a'; g.appendChild(a); h.appendChild(g); h.appendChild(mk('p', 'note', 'You can still use the whole map, boundaries and property lists for free.')); aiEls = null; return; }
    let i, go;
    if (homeMap) {
      ({ i, go } = homeSearch);
    } else {
      const f = mk('form', 'aif');
      i = mk('input'); i.type = 'text'; i.maxLength = 300; i.autocomplete = 'off';
      i.placeholder = 'Ask about a state, county or parcel…';
      i.setAttribute('aria-label', 'Ask PricePocket AI');
      go = mk('button', 'pm-btn primary', 'Ask'); go.type = 'submit';
      f.append(i, go); h.appendChild(f);
      f.addEventListener('submit', e => { e.preventDefault(); submitAi(i.value); });
    }
    const tryH = mk('h3', 'ai-try', 'Try asking'), grid = mk('div', 'ai-cards'); const out = mk('div', 'aiout'); out.setAttribute('aria-live', 'polite'); h.append(tryH, grid, out);
    aiEls = { ctx, i, go, grid, out, tryH };
  }
  async function submitAi(value) {
    const q = value.replace(/\s+/g, ' ').trim();
    if (q.length < 3 || aiBusy) return;
    aiBusy = true;
    const {go, tryH, grid, out} = aiEls;
    if (!homeMap) go.disabled = true;
    tryH.hidden = grid.hidden = true;
    out.replaceChildren(mk('p', 'note', 'Researching… this can take a few seconds.'));
    try { await runAi(q, out); }
    finally { aiBusy = false; go.disabled = false; }
  }
  function aiRefresh() {
    if (!aiEls) return; if (!workspace) aiEls.ctx.textContent = 'Looking at: ' + ctxLabel(aiCtx()) + (aiCtx() ? '' : ' — pick a state or tap the map and the AI follows you');
    aiEls.grid.textContent = ''; chips().forEach(([ic, t, q]) => { const b = mk('button', 'ai-card'); b.type = 'button'; b.append(mk('span', 'ic', ic), mk('b', '', t), mk('span', 'q', '“' + (q.length > 70 ? q.slice(0, 67) + '…' : q) + '”')); b.addEventListener('click', () => { aiEls.i.value = q; submitAi(q); }); aiEls.grid.appendChild(b); });
  }
  function showTab(t, open) {
    tab = t; $('pmAiBox').hidden = t !== 'ai'; $('pmResults').hidden = t !== 'list'; $('tabAi').setAttribute('aria-selected', String(t === 'ai')); $('tabList').setAttribute('aria-selected', String(t === 'list'));
    if (homeMap) {
      const panel = $('pmRight');
      panel.dataset.view = t;
      $('pmHomeTitle').textContent = t === 'ai' ? 'Map Assistant' : panel.dataset.listTitle || 'Properties';
      $('pmHomeSort').hidden = t === 'ai' || panel.dataset.sortable !== 'true';
      $('pmHomeExpand').hidden = t === 'ai';
      document.querySelector('.pm-home-results').setAttribute('aria-expanded', String(t === 'list' && snap !== 'peek'));
    }
    if (open) openRight(true); if (t === 'ai') { aiRefresh(); }
  }
  function openAi(q0, run) {
    if (acctDone && !paid && !workspace) {
      const url = '/plans/?src=Map%20Assistant'; if (embedded) window.top.location.href = url; else location.href = url; return;
    }
    showTab('ai', true); $('pmPop').hidden = true; if (isMobile()) { const cp = $('pmCam'); if (cp) cp.hidden = true; } if (!aiEls) { if (q0) say('Sign in with a Pro account to ask PricePocket AI.'); return; }
    if (q0) { aiEls.i.value = q0; if (run) submitAi(q0); }
    if (!homeMap) setTimeout(() => { try { aiEls.i.focus({ preventScroll: true }); } catch (e) {} }, 60);
  }
  function setStateHl(codes) { hlStates = codes; if (mapReady && map.getLayer('st-hl')) map.setFilter('st-hl', ['in', ['get', 'a'], ['literal', codes.length ? codes : ['__none__']]]); }
  function showLienSearch(out, d) {
    const s = d.search;
    if (!s) return;
    const labels = {
      minFace: 'Minimum tax owed', maxFace: 'Maximum tax owed', minValue: 'Minimum market value',
      maxValue: 'Maximum market value', minAcres: 'Minimum acres', maxAcres: 'Maximum acres',
      minCoverage: 'Minimum coverage', uses: 'Property types', excludeHomestead: 'Exclude homesteads',
      hideJunk: 'Exclude strips and slivers', hideLandlocked: 'Exclude mapped landlocked parcels',
      hideFlood: 'Exclude mapped flood zones', hideWetlands: 'Exclude mapped wetlands',
      hideEnvRestricted: 'Exclude mapped environmental restrictions', ownerLocation: 'Owner location',
      missingMarket: 'Missing market values only', defaultMinimumTaxOwed: 'Minimum known tax owed',
      defaultMinimumKnownMarketValue: 'Minimum known market value',
      excludeKnownMarketValueBelowDebt: 'Exclude known market values below tax owed',
      excludeCreditsAndZeroBalances: 'Exclude credits and reported zero balances',
      excludePublicLandAndUtilityStrips: 'Exclude public land and utility strips'
    };
    const field = { face: 'tax owed', value: 'market value', acres: 'acres', coverage: 'coverage', score: 'relevance score' };
    const details = mk('details', 'note');
    details.appendChild(mk('summary', '', 'Search details'));
    const states = s.states.length ? s.states.map(code => IDX.allStates.find(state => state.a === code)?.n || code).join(', ') : 'Nationwide';
    details.appendChild(mk('p', '', 'Selected state: ' + states + '. Selected county: ' + (s.requestedCounties.join(', ') || 'All available in scope') + '.'));
    const counties = s.counties.map(x => x.county + ' (' + x.state + ')');
    details.appendChild(mk('p', '', counties.length ? 'County lists searched: ' + counties.join(', ') : 'No county lists searched.'));
    details.appendChild(mk('p', '', 'Sorted by ' + (field[s.sorting.field] || s.sorting.field) + ', ' + (s.sorting.order === 'asc' ? 'lowest first' : 'highest first') + '.'));
    const filters = Object.entries(s.filters).filter(([k]) => labels[k]).map(([k, value]) => {
      if (value === true) return labels[k];
      const dollars = /Face|Value|TaxOwed/.test(k);
      return labels[k] + ' ' + (dollars ? money(value) : value) + (s.filters.exclusive?.includes(k) ? ' (exclusive)' : '');
    });
    details.appendChild(mk('p', '', 'Applied filters: ' + filters.join(' · ')));
    details.appendChild(mk('p', '', s.missingMarketValues.toLocaleString('en-US') + ' matching records with market value unavailable.'));
    out.appendChild(details);
  }

  async function runAi(q, out, offset = 0, states = (workspace ? window.ppaWorkshopScope?.().states : null) || aiCtx()?.states || (aiCtx()?.d ? [aiCtx().d.state] : curState ? [curState] : []), county = (workspace ? window.ppaWorkshopScope?.().county : null) || aiCtx()?.d?.county || null, parcel = aiCtx()?.r?.p || null) {
    const signal = homeMap ? (homeAiRequest = new AbortController()).signal : undefined;
    let r, d; try { r = await fetch('/.netlify/functions/ai', { method: 'POST', credentials: 'same-origin', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q.slice(0, 300), states, offset, mapCounty: county, mapParcel: parcel }) }); d = await r.json().catch(() => ({})); } catch (e) { if (signal?.aborted) return; out.textContent = ''; out.appendChild(mk('p', 'pm-flag warn', 'Could not reach PricePocket AI. Please try again.')); aiAgain(); return; }
    if (signal?.aborted) return;
    out.textContent = ''; if (!r.ok) { out.appendChild(mk('p', 'pm-flag warn', d.error || 'Something went wrong. Please try again.')); aiAgain(); return; }
    if (workspace && !offset) dispatchEvent(new CustomEvent('ppa:workshop-result',{detail:{question:q,data:d}}));
    const lines = String(d.answer || '').split(/\n+/).map(x => x.trim()).filter(Boolean), bullets = lines.filter(x => /^[-•*]\s+/.test(x)), verify = lines.filter(x => /^verify:/i.test(x)), rest = lines.filter(x => !bullets.includes(x) && !verify.includes(x));
    out.appendChild(mk('p', 'ai-q', q));
    if (rest.length) out.appendChild(mk('p', 'ans', rest.join(' '))); if (bullets.length) { const ul = mk('ul'); bullets.forEach(b => ul.appendChild(mk('li', '', b.replace(/^[-•*]\s+/, '')))); out.appendChild(ul); } if (verify.length) out.appendChild(mk('p', 'pm-flag warn', verify.join(' ')));
    if (d.pagination && Array.isArray(d.results) && d.results.length) {
      const p = d.pagination;
      const pager = mk('div', 'ppa-ai-pagination');
      const count = mk('span', 'ppa-ai-page-count', 'Results ' + (p.offset + 1).toLocaleString('en-US') + '–' + (p.offset + d.results.length).toLocaleString('en-US') + ' of ' + Number(d.total || d.results.length).toLocaleString('en-US'));
      const controls = mk('div', 'ppa-ai-page-actions');
      function pageButton(label, target) {
        const b = mk('button', 'pm-btn', label);
        b.type = 'button'; b.disabled = target == null;
        b.addEventListener('click', async () => {
          if (aiBusy || target == null) return;
          aiBusy = true; if (!homeMap) aiEls.go.disabled = true;
          controls.querySelectorAll('button').forEach(button => { button.disabled = true; });
          try { await runAi(q, out, target, states, county, parcel); }
          finally { aiBusy = false; if (aiEls.go) aiEls.go.disabled = false; }
        });
        controls.appendChild(b);
      }
      pageButton('Previous', p.offset > 0 ? Math.max(0, p.offset - p.limit) : null);
      pageButton('Next', p.nextOffset);
      pager.append(count, controls); out.appendChild(pager);
    }
    showLienSearch(out, d);
    // states in the answer: shown on the map and as a compact table (tap a state to go there)
    const rows = Array.isArray(d.states) ? d.states : (d.kind === 'states' && Array.isArray(d.results) ? d.results : []);
    if (rows.length) { setStateHl(rows.map(x => x.state).filter(Boolean)); const w = mk('div', 'ai-tbl'), t = mk('table'), hr = mk('tr'); ['State', 'Type', 'Interest / penalty', 'Redemption'].forEach(x => hr.appendChild(mk('th', '', x))); t.appendChild(hr); rows.slice(0, 20).forEach(x => { const tr = mk('tr'), td = mk('td'), b = mk('button', 'lnk', x.name); b.type = 'button'; b.addEventListener('click', () => { if (workspace) location.href = '/map/?s=' + encodeURIComponent(x.state); else focusState(x.state); }); td.appendChild(b); if (x.verify) td.appendChild(mk('span', 'note', ' (verify)')); tr.appendChild(td); [x.system, x.rate, x.redemption].forEach(v => tr.appendChild(mk('td', '', v || ''))); t.appendChild(tr); }); w.appendChild(t); out.appendChild(w); if (!workspace) out.appendChild(mk('p', 'note', 'These states are outlined on the map.')); }
    else setStateHl([]);
    if (d.table && Array.isArray(d.table.rows) && d.table.rows.length) { const w = mk('div', 'ai-tbl'), t = mk('table'), hr = mk('tr'); d.table.columns.forEach(x => hr.appendChild(mk('th', '', x))); t.appendChild(hr); d.table.rows.slice(0, 25).forEach(r => { const tr = mk('tr'); r.forEach(v => tr.appendChild(mk('td', '', v == null ? '' : String(v)))); t.appendChild(tr); }); w.appendChild(t); out.appendChild(w); }
    if (Array.isArray(d.uncertainty) && d.uncertainty.length) { const u = mk('div', 'note'); u.appendChild(mk('b', '', 'What I could not confirm')); const ul = mk('ul'); d.uncertainty.forEach(x => ul.appendChild(mk('li', '', x))); u.appendChild(ul); out.appendChild(u); }
    if (Array.isArray(d.sources) && d.sources.length) { const s = mk('p', 'note', 'Sources: '); d.sources.forEach((x, n) => { if (n) s.appendChild(document.createTextNode(' · ')); if (x.url && /^https?:/.test(x.url)) { const a = mk('a', '', x.name); a.href = x.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.style.color = '#93c5fd'; s.appendChild(a); } else s.appendChild(document.createTextNode(x.name)); }); out.appendChild(s); }
    // listed parcels we hold a verified boundary for light up on the map; the rest are named but not drawn
    const lr = (Array.isArray(d.results) && d.kind !== 'states' ? d.results : []).filter(x => x && x.parcel);
    const countyKey = name => String(name || '').toLowerCase().replace(/ county$/, '');
    const parcelKey = (state, county, parcel) => JSON.stringify([state, countyKey(county), String(parcel)]);
    const keys = new Set(lr.map(x => parcelKey(x.state, x.county, x.parcel)));
    const hits = new Map();
    const datasets = new Map(IDX.datasets.map(d => [d.id, d]));
    for (const x of keys.size ? all() : []) {
      const dataset = datasets.get(x._d);
      if (!dataset || !x.g) continue;
      const key = parcelKey(dataset.state, dataset.county, x.p);
      if (keys.has(key)) hits.set(key, x);
    }
    if (lr.length) {
      const section = mk('section', 'ppa-ai-results');
      section.appendChild(mk('h3', 'ppa-ai-results-title', 'Matching properties'));
      const grid = mk('div', 'ppa-ai-property-grid');
      const formatAmount = value => typeof value === 'number' && Number.isFinite(value) ? money(value) : 'Not available';
      lr.forEach((x, idx) => {
        const rec = hits.get(parcelKey(x.state, x.county, x.parcel));
        const card = mk('article', 'ppa-ai-property-card');
        const head = mk('div', 'ppa-ai-card-head');
        const title = mk('div');
        title.append(mk('span', 'ppa-ai-card-index', 'PROPERTY ' + String(idx + 1).padStart(2, '0')),
          mk('h4', '', [x.county, x.state].filter(Boolean).join(', ') || 'Property record'));
        head.append(title, mk('span', 'ppa-ai-record-status', rec ? 'Map available' : 'County record'));
        const id = mk('p', 'ppa-ai-parcel-id', 'Parcel ' + String(x.parcel));
        const values = mk('div', 'ppa-ai-card-values');
        const metric = (label, value) => { const el = mk('div', 'ppa-ai-metric'); el.append(mk('span', '', label), mk('strong', '', formatAmount(value))); return el; };
        values.append(metric('Tax owed / listed', x.face), metric('Market value', x.market));
        const actions = mk('div', 'ppa-ai-card-actions');
        if (rec) {
          const open = mk('button', 'ppa-ai-card-primary', 'View on map');
          open.type = 'button';
          open.addEventListener('click', () => select(rec, { fly: true }));
          actions.append(open);
        } else {
          actions.append(mk('span', 'ppa-ai-card-unavailable', 'Map location not verified'));
        }
        card.append(head, id, values, actions); grid.appendChild(card);
      });
      section.append(grid); out.appendChild(section);
    }
    if (mapReady) map.getSource('near').setData({ type: 'FeatureCollection', features: [...hits.values()].slice(0, 200).map(feature) });
    if (hits.size) out.appendChild(mk('p', 'note', hits.size + ' mentioned ' + (hits.size === 1 ? 'parcel is' : 'parcels are') + ' highlighted on the map.'));
    out.appendChild(mk('p', 'note', 'AI can be wrong. It answers from the county lists and state rules on this site. Verify with the county before you bid. Not legal or investment advice.'));
    aiAgain();
  }
  function aiAgain() { const b = mk('button', 'pm-btn', 'Ask something else'); b.type = 'button'; b.style.margin = '6px 0 12px'; b.addEventListener('click', () => { aiEls.out.textContent = ''; aiEls.tryH.hidden = false; aiEls.grid.hidden = false; aiEls.i.value = ''; setStateHl([]); if (mapReady) map.getSource('near').setData(empty); if (homeMap) { openRight(false); } else aiEls.i.focus(); }); aiEls.out.appendChild(b); }

    // ---------- Active hazards: open wildfire / flood / storm / volcano / landslide events from NASA EONET via /hazards. An information layer, not a parcel risk score. ----------
  const HZ = { wildfires: ['Wildfire', '#ef4444'], floods: ['Flood', '#3b82f6'], severeStorms: ['Storm', '#a855f7'], volcanoes: ['Volcano', '#f97316'], landslides: ['Landslide', '#a16207'] };
  let hzOn = false, hzData = null;
  function hzOff() { hzOn = false; const p = $('pmHz'); if (p) p.hidden = true; const b = $('pmHzBtn'); if (b) b.classList.remove('on'); if (mapReady && map.getLayer('hz-c')) map.setLayoutProperty('hz-c', 'visibility', 'none'); if (hzPop) { hzPop.remove(); hzPop = null; } }
  let hzPop = null;
  function toggleHaz() { if (hzOn) return hzOff(); openHaz(); }
  function hzEnsure() {
    if (map.getSource('hz')) return;
    map.addSource('hz', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    const col = ['match', ['get', 'cat']]; Object.keys(HZ).forEach(k => col.push(k, HZ[k][1])); col.push('#ef4444');
    map.addLayer({ id: 'hz-c', type: 'circle', source: 'hz', paint: { 'circle-color': col, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 6, 9, 9, 13, 11], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2, 'circle-opacity': 0.92 } });
    map.on('click', 'hz-c', e => { const f = e.features && e.features[0]; if (!f) return; const q = f.properties, h = mk('div'); h.style.cssText = 'color:#0b1220;font:14px/1.4 system-ui;max-width:220px';
      h.appendChild(mk('b', '', q.title)); h.appendChild(mk('div', '', (HZ[q.cat] ? HZ[q.cat][0] : 'Event') + (q.date ? ' · reported ' + String(q.date).slice(0, 10) : '')));
      h.appendChild(mk('div', '', 'Source: ' + q.source)); if (q.link && /^https:\/\//.test(q.link)) { const a = mk('a', '', 'Open source report'); a.href = q.link; a.target = '_blank'; a.rel = 'noopener'; h.appendChild(a); }
      h.appendChild(mk('div', '', 'Event location only. Not a risk score for any parcel.')).style.cssText = 'font-size:12px;color:#475569;margin-top:4px';
      if (hzPop) hzPop.remove(); hzPop = new maplibregl.Popup({ offset: 12, closeButton: true }).setLngLat(f.geometry.coordinates).setDOMContent(h).addTo(map); });
    map.on('mouseenter', 'hz-c', () => { map.getCanvas().style.cursor = 'pointer'; }); map.on('mouseleave', 'hz-c', () => { map.getCanvas().style.cursor = ''; });
  }
  async function openHaz() {
    let p = $('pmHz'); if (!p) { p = mk('section', 'pm-cam'); p.id = 'pmHz'; p.setAttribute('aria-label', 'Active hazards'); (homeMap ? $('pmHomeContent') : $('pmTop').parentNode).appendChild(p); }
    hzOn = true; $('pmHzBtn').classList.add('on'); p.hidden = false; const cp = $('pmCam'); if (cp) cp.hidden = true; if (typeof camOff === 'function' && camsOn) camOff(); $('pmPop').hidden = true; if (isMobile()) setSnap('peek');
    p.textContent = ''; const hd = mk('div', 'hd'), x = mk('button', 'x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close hazards'); x.addEventListener('click', hzOff); hd.append(mk('b', '', 'Active hazards'), x); p.appendChild(hd);
    if (!mapReady) { p.appendChild(mk('p', 'note', 'The map is still loading.')); return; }
    const st = mk('p', 'note', 'Checking current reports…'); p.appendChild(st);
    if (!hzData) { try { const r = await fetch('/.netlify/functions/hazards', { credentials: 'same-origin' }); hzData = await r.json(); } catch (e) { hzData = null; } }
    st.remove(); if (!hzOn) return;
    if (!hzData || hzData.ok !== true) { p.appendChild(mk('p', 'pm-flag warn', 'Hazard reports are unavailable right now. That does not mean there are none. Try again in a few minutes.')); const b = mk('button', 'pm-btn', 'Try again'); b.type = 'button'; b.addEventListener('click', () => { hzData = null; openHaz(); }); p.appendChild(b); return; }
    hzEnsure(); map.setLayoutProperty('hz-c', 'visibility', 'visible');
    map.getSource('hz').setData({ type: 'FeatureCollection', features: hzData.events.map(e => ({ type: 'Feature', properties: { title: e.title, cat: e.cat, date: e.date, link: e.link, source: e.source }, geometry: { type: 'Point', coordinates: [e.lng, e.lat] } })) });
    const lg = mk('div'); lg.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin:6px 0';
    Object.keys(HZ).forEach(k => { const n = hzData.counts[k] || 0, c = mk('span', '', ''); c.style.cssText = 'display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.08);font-size:.82rem'; const d = mk('i'); d.style.cssText = 'width:10px;height:10px;border-radius:50%;background:' + HZ[k][1]; c.append(d, document.createTextNode(HZ[k][0] + ' · ' + n)); lg.appendChild(c); }); p.appendChild(lg);
    if (!hzData.events.length) p.appendChild(mk('p', 'note', 'No open events in the U.S. in the latest report.'));
    p.appendChild(mk('p', 'note', 'Open events reported in the U.S. by public agencies, via NASA EONET. Tap a dot for the source. Dots show where an event was reported, not which parcels are affected. This is not a risk score. Check the county and the official agency before you bid.'));
    p.appendChild(mk('p', 'note', 'Updated ' + new Date(hzData.checked).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) + (hzData.stale ? ' (older report; the source is not answering)' : '')));
    if (hzData.events.length) { const xs = hzData.events.map(e => e.lng), ys = hzData.events.map(e => e.lat); map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: fitPad(), maxZoom: 8, duration: REDUCED ? 0 : 800 }); }
  }

    // ---------- Live cameras (Pro): official public camera feeds near the map or a parcel. Uses the site's existing /cameras service; nothing is guessed. ----------
  let camsOn = false, camMk = [], camTimer = null, camHls = null, camLast = null, camSel = null, camCtl = null, camMove = null;
  const CAM_HLS = 'https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.13/hls.min.js';
  const camHav = (a, b, c, d) => { const r = x => x * Math.PI / 180, h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2; return 3958.8 * 2 * Math.asin(Math.sqrt(h)); };
  function camPanel() { let p = $('pmCam'); if (!p) { p = mk('section', 'pm-cam'); p.id = 'pmCam'; p.setAttribute('aria-label', 'Live cameras'); (homeMap ? $('pmHomeContent') : $('pmTop').parentNode).appendChild(p); } return p; }
  function camStop() { if (camTimer) { clearInterval(camTimer); camTimer = null; } if (camHls) { try { camHls.destroy(); } catch (e) {} camHls = null; } const p = $('pmCam'); if (p) p.querySelectorAll('video').forEach(v => { try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {} }); }
  function camClear() { camMk.forEach(x => x.remove()); camMk = []; }
  function camOff() { camsOn = false; camStop(); camClear(); const p = $('pmCam'); if (p) p.hidden = true; const b = $('pmCamBtn'); if (b) b.classList.remove('on'); if (map && map.off) map.off('moveend', camMoved); }
  function toggleCams() { if (camsOn) return camOff(); openCams(null, null, false); }
  function camMoved() { if (!camsOn) return; clearTimeout(camMove); camMove = setTimeout(() => { if (!camLast || !mapReady) return; const c = map.getCenter(); if (camHav(c.lat, c.lng, camLast.lat, camLast.lng) > Math.max(2, camLast.radius / 3)) openCams(null, null, true); }, 900); }
  async function openCams(center, radius, keep) {
    if (hzOn) hzOff(); const p = camPanel(); camsOn = true; $('pmCamBtn').classList.add('on'); p.hidden = false; $('pmPop').hidden = true; const ai = $('pmAi'); if (ai) ai.hidden = true; if (isMobile()) setSnap('peek');
    p.textContent = ''; const hd = mk('div', 'hd'), x = mk('button', 'x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close cameras'); x.addEventListener('click', camOff); hd.append(mk('b', '', 'Live cameras'), x); p.appendChild(hd);
    if (!signedIn || !paid) { const g = mk('p', 'pm-flag warn'); g.append(document.createTextNode('Live cameras are for Pro members. ')); const a = mk('a', '', 'See the Pro plan'); a.href = '/plans/?from=' + encodeURIComponent(location.pathname + location.search) + '&src=' + encodeURIComponent('Live cameras'); a.style.color = '#fde68a'; g.appendChild(a); p.appendChild(g); return; }
    if (!mapReady) { p.appendChild(mk('p', 'note', 'The map is still loading.')); return; }
    if (!center && map.getZoom() < 8) { p.appendChild(mk('p', 'note', 'Zoom in a little (to about a county) and the public cameras in view will appear.')); camClear(); camLast = null; map.off('moveend', camMoved); map.on('moveend', camMoved); return; }
    let lat, lng, rad; if (center) { lat = center.lat; lng = center.lng; rad = radius || 10; map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 12), duration: REDUCED ? 0 : 900 }); } else { const c = map.getCenter(), b = map.getBounds(); lat = c.lat; lng = c.lng; rad = Math.max(3, Math.min(50, Math.round(camHav(b.getSouth(), b.getWest(), b.getNorth(), b.getEast()) / 2))); }
    p.appendChild(mk('p', 'note', 'Finding public cameras…')); let d; const ac = new AbortController(), to = setTimeout(() => ac.abort(), 25000);
    try { const r = await fetch('/.netlify/functions/cameras?' + new URLSearchParams({ lat: lat.toFixed(5), lng: lng.toFixed(5), radius: rad, limit: 20 }), { credentials: 'same-origin', signal: ac.signal }); d = await r.json(); if (!r.ok || !d || d.ok !== true) throw new Error(); } catch (e) { clearTimeout(to); p.lastChild.remove(); p.appendChild(mk('p', 'pm-flag warn', 'Cameras are temporarily unavailable. Please try again in a moment.')); return; } clearTimeout(to);
    camLast = { lat, lng, radius: rad }; camSel = null; camStop(); camClear(); p.querySelectorAll('.note').forEach(n => n.remove()); renderCams(p, d, { lat, lng });
    // Phone: the camera sheet covers the lower half, so frame the cameras in the part of the map that stays visible (never hidden behind the sheet).
    if (center && d.cameras.length) { const xs = d.cameras.map(c => c.lng).concat([lng]), ys = d.cameras.map(c => c.lat).concat([lat]); map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: homeMap ? fitPad() : isMobile() ? { top: 150, bottom: Math.max(150, Math.round(innerHeight - ($('pmCam').getBoundingClientRect().top || innerHeight * 0.4)) + 16), left: 40, right: 80 } : { top: 110, bottom: 60, left: 440, right: 80 }, maxZoom: 14, duration: REDUCED ? 0 : 700 }); }
    map.off('moveend', camMoved); map.on('moveend', camMoved);
  }
  function renderCams(p, d, ctr) {
    const okP = d.providers.filter(x => x.status === 'ok'), badP = d.providers.filter(x => x.status === 'unavailable'), viewP = d.providers.filter(x => x.status === 'viewer');
    const list = mk('div', 'camlist'), pv = mk('div', 'campv'); pv.setAttribute('aria-live', 'polite'); const items = [];
    const choose = c => { camSel = c; items.forEach(it => { it.b.classList.toggle('on', it.c === c); it.el.classList.toggle('on', it.c === c); }); camPreview(pv, c, ctr); };
    d.cameras.forEach((c, i) => { const el = mk('button', 'pm-cammk', String(i + 1)); el.type = 'button'; el.title = c.name; el.setAttribute('aria-label', 'Camera ' + (i + 1) + ': ' + c.name); el.addEventListener('click', e => { e.stopPropagation(); choose(c); }); camMk.push(new maplibregl.Marker({ element: el }).setLngLat([c.lng, c.lat]).addTo(map));
      const b = mk('button', 'camitem'); b.type = 'button'; b.append(mk('b', '', (i + 1) + '. ' + c.name), mk('span', '', (c.miles < 0.1 ? '<0.1' : c.miles.toFixed(1)) + ' mi · ' + c.type + ' · ' + (c.kind === 'video' ? 'Live video' : c.kind === 'snapshot' ? 'Updated snapshot' : 'Official page'))); b.addEventListener('click', () => { choose(c); map.easeTo({ center: [c.lng, c.lat], duration: REDUCED ? 0 : 700 }); }); list.appendChild(b); items.push({ c, b, el }); });
    if (d.cameras.length) { p.appendChild(mk('p', 'note', d.cameras.length + ' closest public camera' + (d.cameras.length === 1 ? '' : 's') + ' within ' + d.radius + ' miles (straight-line distance' + (d.totalInRadius > d.cameras.length ? '; ' + d.totalInRadius + ' in range, showing the closest' : '') + ').')); p.append(pv, list); }
    else if (okP.length) p.appendChild(mk('p', 'note', 'No public cameras found within ' + d.radius + ' miles of this view. Try zooming out or moving the map.'));
    else if (!badP.length) p.appendChild(mk('p', 'note', 'We do not have a live camera feed for this area yet. Live cameras are built in where an official state feed is available (today: Florida, California, Austin TX and the Fort Myers beaches).'));
    badP.forEach(x => { const q = mk('p', 'note'); q.append(x.name + ' cameras are temporarily unavailable. '); const a = mk('a', '', 'Open the official viewer'); a.href = x.viewer; a.target = '_blank'; a.rel = 'noopener noreferrer'; q.appendChild(a); p.appendChild(q); });
    viewP.forEach(x => { const q = mk('p', 'note'); q.append(x.state + ' cameras nearby: '); const a = mk('a', '', 'open the ' + x.name + ' official viewer'); a.href = x.viewer; a.target = '_blank'; a.rel = 'noopener noreferrer'; q.append(a, ' (not built into this map).'); p.appendChild(q); });
    p.appendChild(mk('p', 'note', 'Cameras show conditions where the camera is, not at any property. Feeds come from state transportation departments and tourism offices; availability and update times vary.'));
    if (d.cameras.length) choose(d.cameras[0]);
  }
  function camPreview(pv, c, ctr) {
    camStop(); pv.textContent = ''; pv.appendChild(mk('h4', '', c.name)); const meta = [c.road, c.direction].filter(Boolean).join(' · '); if (meta) pv.appendChild(mk('div', 'note', meta));
    const media = mk('div', 'cammedia'), upd = mk('div', 'note'); pv.append(media, upd);
    const bad = () => { media.textContent = ''; media.appendChild(mk('p', 'pm-flag warn', 'Camera unavailable right now.')); upd.textContent = ''; };
    const snap = () => { if (!c.image) return bad(); const img = mk('img'); img.alt = 'Latest snapshot from ' + c.name; img.decoding = 'async'; img.referrerPolicy = 'no-referrer'; const load = () => { img.src = c.image + (c.image.includes('?') ? '&' : '?') + 't=' + Math.floor(Date.now() / 60000); upd.textContent = 'Snapshot refreshes about every minute. Last loaded ' + new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + '.'; }; img.onerror = bad; media.appendChild(img); load(); camTimer = setInterval(() => { if (!document.hidden && img.isConnected) load(); }, 60000); };
    if (c.kind === 'viewer') { const a = mk('a', 'pm-btn', 'Open official camera'); a.href = c.viewer; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.style.cssText = 'display:inline-flex;align-items:center;text-decoration:none'; media.appendChild(a); upd.textContent = 'The live view opens on the operator’s official page.'; }
    else if (c.kind === 'video' && c.video) { const v = mk('video'); v.muted = true; v.defaultMuted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', ''); v.controls = true; v.autoplay = true; if (c.image) v.poster = c.image; v.setAttribute('aria-label', 'Live video from ' + c.name); media.appendChild(v);
      const tap = mk('button', 'pm-btn', '▶ Tap to play live'); tap.type = 'button'; tap.hidden = true; tap.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2'; media.style.position = 'relative'; media.appendChild(tap); const go = () => { const pr = v.play(); if (pr && pr.then) pr.then(() => { tap.hidden = true; }).catch(() => { tap.hidden = false; }); }; tap.addEventListener('click', () => { go(); }); ['loadedmetadata', 'canplay'].forEach(ev => v.addEventListener(ev, go)); v.addEventListener('playing', () => { tap.hidden = true; }); let stall = null; ['waiting', 'stalled'].forEach(ev => v.addEventListener(ev, () => { clearTimeout(stall); stall = setTimeout(() => { if (v.isConnected && v.readyState < 3) { if (camHls) { try { camHls.recoverMediaError(); camHls.startLoad(); } catch (e) {} } go(); } }, 8000); })); v.addEventListener('playing', () => clearTimeout(stall)); upd.textContent = 'Live video from the official stream.'; let failed = false; const fail = () => { if (failed || !v.isConnected) return; failed = true; camStop(); media.textContent = ''; snap(); upd.textContent = 'Live video did not play here; showing the latest snapshot instead.'; }; v.addEventListener('error', fail); setTimeout(() => { if (!failed && v.readyState < 2) fail(); }, 12000);
      if (v.canPlayType('application/vnd.apple.mpegurl')) { v.src = c.video; go(); } else new Promise((ok, no) => { if (window.Hls) return ok(); const s = document.createElement('script'); s.src = CAM_HLS; s.onload = ok; s.onerror = no; document.head.appendChild(s); }).then(() => { if (!window.Hls || !Hls.isSupported()) return fail(); const h = new Hls(); camHls = h; h.on(Hls.Events.ERROR, (e, x) => { if (x && x.fatal) fail(); }); h.loadSource(c.video); h.attachMedia(v); h.on(Hls.Events.MANIFEST_PARSED, go); }).catch(fail); }
    else snap();
    const src = mk('p', 'note'); src.append('Source: ' + c.operator + '. '); if (c.viewer) { const a = mk('a', '', 'Official viewer'); a.href = c.viewer; a.target = '_blank'; a.rel = 'noopener noreferrer'; src.appendChild(a); } if (c.sourceMeta) src.append(' · ' + c.sourceMeta + '.'); pv.appendChild(src);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) camStop(); else if (camsOn && camSel) { const pv = document.querySelector('#pmCam .campv'); if (pv) camPreview(pv, camSel); } });

  // ---------- states layer: the national view (tap a state to zoom in; the AI follows) ----------
  async function addStates() {
    let gj; try { gj = await api('/map/states.json'); } catch (e) { return; }
    const have = {}; IDX.datasets.forEach(d => { have[d.state] = (have[d.state] || 0) + 1; });
    gj.features.forEach(f => { const a = f.properties.a, s = (typeof STATES !== 'undefined' && STATES.find(x => x.a === a)) || IDX.states[a] || {}; f.properties.sys = s.sys || 'Sources differ'; f.properties.n = s.n || a; f.properties.has = have[a] ? 1 : 0; f.properties.col = COL[s.sys] || '#94a3b8'; });
    map.addSource('states', { type: 'geojson', data: gj });
    if(homeMap)drawRadarPins();
    const before = 'p-fill';
    map.addLayer({ id: 'st-fill', type: 'fill', source: 'states', maxzoom: 9, paint: { 'fill-color': ['get', 'col'], 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 3, ['case', ['==', ['get', 'has'], 1], homeMap ? 0.20 : 0.62, homeMap ? 0.10 : 0.42], 6.5, homeMap ? 0.07 : 0.4, 8.5, 0] } }, before);
    map.addLayer({ id: 'st-line', type: 'line', source: 'states', maxzoom: 9, layout: { visibility: 'none' }, paint: { 'line-color': '#ffffff', 'line-opacity': 0.55, 'line-width': 0.8 } }, before);
    map.addLayer({ id: 'st-hl', type: 'line', source: 'states', filter: ['in', ['get', 'a'], ['literal', ['__none__']]], paint: { 'line-color': '#22d3ee', 'line-width': 3.2 } }, before);
    map.addLayer({ id: 'st-sel', type: 'line', source: 'states', layout: { visibility: 'none' }, filter: ['==', ['get', 'a'], '__none__'], paint: { 'line-color': '#ffffff', 'line-width': 3 } }, before);
    map.on('mouseenter', 'st-fill', () => { map.getCanvas().style.cursor = 'pointer'; }); map.on('mouseleave', 'st-fill', () => { map.getCanvas().style.cursor = ''; });
    map.on('click', 'st-fill', e => { if (map.getZoom() > 7.5 || map.queryRenderedFeatures(e.point, { layers: ['p-fill', 'pts'] }).length) return; const f = e.features && e.features[0]; if (f) focusState(f.properties.a); });
    // small labels with how many counties have data
    const pts = { type: 'FeatureCollection', features: gj.features.filter(f => f.properties.has).map(f => { const xs = [], ys = []; (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).forEach(p => p[0].forEach(c => { xs.push(c[0]); ys.push(c[1]); })); return { type: 'Feature', properties: { a: f.properties.a, n: have[f.properties.a] }, geometry: { type: 'Point', coordinates: [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2] } }; }) };
    pts.features.forEach(f => { const el = mk('button', 'pm-badge', String(f.properties.n)); el.type = 'button'; el.title = (IDX.states[f.properties.a] || {}).n + ': ' + f.properties.n + (f.properties.n === 1 ? ' county' : ' counties') + ' mapped'; el.setAttribute('aria-label', el.title); el.addEventListener('click', e => { e.stopPropagation(); focusState(f.properties.a); }); new maplibregl.Marker({ element: el }).setLngLat(f.geometry.coordinates).addTo(map); });
  }
  function stateBB(a) { if (!mapReady || !map.getSource('states')) return null; const src = map.getSource('states')._data; const f = src && src.features.find(x => x.properties.a === a); if (!f) return null; const xs = [], ys = []; (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).forEach(p => p[0].forEach(c => { if (c[0] > -170) { xs.push(c[0]); ys.push(c[1]); } })); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }
  function focusState(a, {remember = true, panel = true, zoom = true} = {}) {
    if (!a) return; curState = a; curCounty = ''; sel = null; near = null; $('pmPop').hidden = true; if (window.__pm) { window.__pm.stSel.value = a; fillCounties(window.__pm.coSel); }
    active = new Set(['__none__']); F.inView = false; syncGISButton(); refresh(); { const ar = $('pmArea'); if (ar) ar.hidden = true; }
    const bb = stateBB(a); if (bb && zoom) fitTo(bb, fitPad()); if (mapReady) { map.setFilter('st-sel', ['==', ['get', 'a'], a]); map.getSource('sel').setData(empty); map.getSource('sel-point').setData(empty); }
    if (panel) { stateCard(a, !homeMap); if (homeMap) openRight(false); }
    aiRefresh();
    if (remember && locationContext) rememberArea({ state:a, label:IDX.allStates.find(s => s.a === a)?.n || a });
    const url = new URL(location.href); url.searchParams.set('s', a); url.searchParams.delete('c'); url.searchParams.delete('p'); if (remember) url.hash = ''; history.replaceState(null, '', url);
  }
  function stateCard(a, open = true) {
    const R = $('pmResults'), s = IDX.allStates.find(x => x.a === a), rule = (typeof STATES !== 'undefined' && STATES.find(x => x.a === a)) || IDX.states[a], ds = IDX.datasets.filter(d => d.state === a); R.textContent = '';
    updateHomeDrawer('Properties');
    R.appendChild(mk('h3', '', s ? s.n : a)); if (rule) { const dl = mk('dl', 'pm-rules'); [['Sale type', rule.sys], ['Interest or penalty', rule.rate], ['Redemption', rule.red], ['Bidding', rule.bid]].forEach(([k, v]) => { if (v) { const d = mk('div'); d.append(mk('dt', '', k), mk('dd', '', v)); dl.appendChild(d); } }); R.appendChild(dl); if (rule.verify) R.appendChild(mk('p', 'note', 'Sources differ for this state. Verify with the county.')); }
    if (typeof OFFICIALS !== 'undefined') { const g = OFFICIALS.gov[a], ms = OFFICIALS.mayors[a] || []; if (g || ms.length) { const dl = mk('dl', 'pm-rules'); if (g) { const d = mk('div'); d.append(mk('dt', '', g.title), mk('dd', '', g.name + ' (' + g.party + ')')); dl.appendChild(d); } ms.forEach(x => { const d = mk('div'); d.append(mk('dt', '', 'Mayor of ' + x.city), mk('dd', '', x.name + ' (' + x.party + ')')); dl.appendChild(d); }); R.appendChild(dl); R.appendChild(mk('p', 'note', 'As listed on Wikipedia, checked Nov 2026. Officials change: verify.')); } }
    // U.S. Congress members for this state (Library of Congress). Appears only when the server has the key and the source answers.
    const cg = mk('div'); R.appendChild(cg);
    fetch('/.netlify/functions/congress?state=' + encodeURIComponent(a)).then(r => r.json()).then(d => {
      if (!d || d.ok !== true || !d.members || !d.members.length) return;
      const dl = mk('dl', 'pm-rules'); d.members.forEach(x => { const row = mk('div'), dd = mk('dd'), l = mk('a', '', x.name); l.href = x.link; l.target = '_blank'; l.rel = 'noopener'; dd.append(l, document.createTextNode(' (' + x.party + ')')); row.append(mk('dt', '', x.chamber === 'Senate' ? 'U.S. Senator' : 'U.S. Representative' + (x.district ? ', District ' + x.district : '')), dd); dl.appendChild(row); });
      cg.appendChild(dl); cg.appendChild(mk('p', 'note', 'Current members of Congress, from the Library of Congress. Names link to the official biography. Verify before relying on it.'));
    }).catch(() => {});
    const lk = mk('a', 'pm-btn', 'Full ' + (s ? s.n : a) + ' rules'); lk.href = '/liens/states/state/?s=' + a; lk.style.cssText = 'display:inline-flex;align-items:center;text-decoration:none;margin:6px 0'; R.appendChild(lk);
    if (!ds.length) { R.appendChild(mk('p', 'pm-empty', 'No verified parcel records or boundaries for ' + (s ? s.n : a) + ' counties yet, so nothing is drawn. We never show shapes or listings we cannot verify.')); }
    else { R.appendChild(mk('h3', '', 'Counties on the map (' + ds.length + ')')); const row = mk('div', 'pm-chips-row'); ds.sort((x, y) => y.mapped - x.mapped).slice(0, 40).forEach(d => { const b = mk('button', '', d.county.replace(/^City of /, '') + ' · ' + d.records.toLocaleString('en-US')); b.type = 'button'; b.addEventListener('click', () => { pickCounty(d.id); showTab('list'); }); row.appendChild(b); }); R.appendChild(row); }
    showTab('list', open);
  }

  // Unified Radar overlays: state-level official county aggregates, not parcel pins.
  // The source provides state/county identifiers but not verified auction coordinates.
  let radarOverlay={tab:'opp',month:'',counties:[]},radarPins=[];
  const radarKind=(c,t)=>t==='opp'?Number(c.open)>0:
    t==='cal'?(c.sale?.kind==='scheduled'||c.sale?.kind==='tentative'):
    (c.sale?.kind==='past'||c.sale?.kind==='completed');
  function clearRadarPins(){radarPins.forEach(p=>p.remove());radarPins=[];}
  function drawRadarPins(){
    if(!homeMap||!mapReady||!map.getSource('states'))return;
    clearRadarPins();
    const src=map.getSource('states')._data;
    if(!src?.features)return;
    const grouped=new Map();
    for(const c of radarOverlay.counties){
      if(!/^[A-Z]{2}$/.test(c.state||'')||!radarKind(c,radarOverlay.tab))continue;
      if(radarOverlay.tab==='cal'&&radarOverlay.month&&
        !String(c.sale?.date||'').startsWith(radarOverlay.month))continue;
      const arr=grouped.get(c.state)||[];arr.push(c);grouped.set(c.state,arr);
    }
    const colors={opp:'#3be6a2',cal:'#f6ba49',hist:'#b49aff'};
    for(const feature of src.features){
      const state=feature.properties?.a,rows=grouped.get(state);
      if(!rows?.length)continue;
      const bb=stateBB(state);if(!bb||bb.some(v=>!Number.isFinite(v)))continue;
      const el=mk('button','ppa-radar-pin',String(rows.length));
      el.type='button';el.style.cssText='width:34px;height:34px;border-radius:50%;border:2px solid white;background:'+colors[radarOverlay.tab]+';color:#10222d;font:800 13px system-ui;box-shadow:0 5px 18px #0009;cursor:pointer;transform:translateZ(0);transition:transform .25s';
      el.title=rows.length+' county records in '+state+' ('+radarOverlay.tab+'); state-level aggregate, not parcel coordinates';
      el.setAttribute('aria-label',el.title);
      el.addEventListener('click',()=>{
        focusState(state,{remember:false,panel:false});
        window.parent.postMessage({type:'ppa:radar-overlay-select',state,tab:radarOverlay.tab},location.origin);
      });
      radarPins.push(new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([(bb[0]+bb[2])/2,(bb[1]+bb[3])/2]).addTo(map));
    }
  }
  if(homeMap)window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==window.parent)return;
    const d=event.data;
    if(d?.type!=='ppa:radar-overlay'||!['opp','cal','hist'].includes(d.tab)||!Array.isArray(d.counties)||d.counties.length>3000)return;
    radarOverlay={tab:d.tab,month:typeof d.month==='string'&&/^\\d{4}-\\d{2}$/.test(d.month)?d.month:'',
      counties:d.counties.filter(c=>c&&typeof c.state==='string'&&typeof c.county==='string').map(c=>({
        state:c.state,county:c.county,open:Number(c.open)||0,
        sale:{kind:String(c.sale?.kind||''),date:String(c.sale?.date||'')}
      }))};
    drawRadarPins();
    if(mapReady)map.easeTo({pitch:REDUCED?0:38,duration:REDUCED?0:650});
  });
  // Verified Radar parcel handoff. Exact state + county + parcel ID must match
  // an existing map dataset and a record with an official GIS geometry.
  if (homeMap) window.addEventListener('message', async event => {
    if (event.origin !== location.origin || event.source !== window.parent) return;
    const d=event.data;
    if (!d || d.type !== 'ppa:radar-parcel' || !/^[A-Z]{2}$/.test(d.state || '') ||
        typeof d.county !== 'string' || d.county.length > 100 ||
        typeof d.parcel !== 'string' || !d.parcel || d.parcel.length > 100) return;
    const norm=s=>String(s||'').toLowerCase().replace(/\\b(county|parish|borough)\\b/g,'').replace(/[^a-z0-9]/g,'');
    const datasets=IDX?.datasets.filter(x=>x.state===d.state && norm(x.county)===norm(d.county))||[];
    let matched=null;
    if(datasets.length===1){
      const ds=await load(datasets[0].id);
      const hits=ds?.recs.filter(r=>String(r.p).trim()===d.parcel.trim() && r.g)||[];
      if(hits.length===1) matched={record:hits[0],dataset:datasets[0]};
    }
    if(matched){
      await pickCounty(matched.dataset.id,{remember:false});
      select(matched.record,{fly:true,remember:false});
    }
    window.parent.postMessage({type:'ppa:radar-parcel-result',requestId:d.requestId,
      matched:!!matched,state:d.state,county:d.county,parcel:d.parcel},location.origin);
  });
  // ---------- start ----------
  async function showArea(area) {
    if (!area) return;
    if (area.county && IDX.datasets.some(d => d.id === area.county)) {
      await pickCounty(area.county, {announce:false, remember:false});
      if (area.parcel) {
        const record = loaded[area.county]?.recs.find(r => String(r.p) === area.parcel);
        if (record) select(record, {fly:true, remember:false});
      }
      return;
    }
    const pointed = locationContext.coordinates(area.lat, area.lng);
    if (area.state && IDX.allStates.some(s => s.a === area.state)) {
      focusState(area.state, {remember:false, panel:false, zoom:!pointed});
    }
    if (pointed && !area.state) {
      curState = ''; curCounty = ''; closePop();
      active = new Set(['__none__']); F.inView = false; window.__pm.stSel.value = ''; fillCounties(window.__pm.coSel); syncGISButton(); refresh(); aiRefresh();
    }
    if (pointed) map.easeTo({center:[area.lng,area.lat], zoom:9.5, duration:REDUCED ? 0 : 240});
  }
  async function start2() {
    const q = new URLSearchParams(location.search), county = q.get('c'), parcel = q.get('p'), state = q.get('s');
    const point = new URLSearchParams(location.hash.slice(1));
    const lat = Number(point.get('lat')), lng = Number(point.get('lng'));
    if (q.get('cams') && q.get('lat') && q.get('lng')) {
      const lat = Number(q.get('lat')), lng = Number(q.get('lng'));
      let tries = 0;
      const open = () => { if (!acctDone && tries++ < 80) { setTimeout(open, 250); return; } openCams({lat,lng}, Number(q.get('radius')) || 15, true); };
      open();
    }
    if (county && IDX.datasets.some(d => d.id === county)) {
      await pickCounty(county, {announce:!embedded, remember:!parcel && !embedded});
      const record = parcel && loaded[county]?.recs.find(r => String(r.p) === parcel);
      if (record) select(record, {fly:true,remember:!embedded});
    } else if (!embedded && locationContext?.coordinates(lat, lng)) {
      const knownState = IDX.allStates.some(s => s.a === state) ? state : '';
      await showArea({state:knownState,lat,lng});
    } else if (state && IDX.allStates.some(s => s.a === state)) {
      focusState(state, {remember:!embedded,panel:!embedded});
    } else if (embedded && !pickerMap && locationContext) {
      const initial = await locationContext.ready();
      if (!curState && !curCounty && !sel && !F.inView) await showArea(initial);
    }
    if (embedded && !pickerMap && locationContext) {
      locationContext.subscribe((area, source) => { if (source === 'chosen') showArea(area); });
    }
  }
  async function loadLib() {
    if(window.maplibregl?.Map)return;
    for(const url of ['https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.js','https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js']){
      try{await new Promise((resolve,reject)=>{
        const script=document.createElement('script');let timer;
        const done=error=>{clearTimeout(timer);script.onload=script.onerror=null;if(error){script.remove();reject(error);}else resolve();};
        script.src=url;script.crossOrigin='anonymous';script.onload=()=>done(window.maplibregl?.Map?null:Error('Map library did not initialize'));script.onerror=()=>done(Error('Map library download failed'));
        timer=setTimeout(()=>done(Error('Map library download timed out')),9000);document.head.appendChild(script);
      });return;}catch(error){console.warn('Parcel map library:',error.message);}
    }
    throw Error('Map library could not be downloaded');
  }
  function afterAccount() {
    buildAi();
    const ask = $('pmAsk');
    if (ask) {
      ask.replaceChildren(mk('span', '', paid ? 'Map Assistant' : '🔒 Map Assistant'), mk('b', '', 'Pro'));
      ask.setAttribute('aria-label', paid ? 'Map Assistant' : 'Map Assistant, Pro feature');
      ask.title = 'Ask questions about the current county, parcel or map area.';
      if (homeMap && paid) {
        ask.setAttribute('role', 'switch');
        ask.setAttribute('aria-checked', 'false');
        const track = mk('span', 'pm-ai-switch');
        track.setAttribute('aria-hidden', 'true');
        ask.append(track);
      }
    }
    if (workspace) {
      $('pmAiBox').hidden = false; aiRefresh();
      if (aiEls && params.get('q')) aiEls.i.value = params.get('q').slice(0,300);
      if (aiEls) dispatchEvent(new CustomEvent('ppa:workshop-ready',{detail:{
        index:IDX, setScope:label => {aiEls.ctx.textContent = 'Scope · ' + label;},
        draft:question => {aiEls.i.value = question; aiEls.i.focus(); aiEls.i.setSelectionRange(question.length,question.length);}
      }}));
      return;
    }
    const q = new URLSearchParams(location.search), q0 = q.get('q'), wantAi = q.get('ai') || q0;
    if (wantAi) {
      if (homeMap && paid) homeSearch.setMode(true);
      showTab('ai', true);
    } else showTab('list');
    aiRefresh();
    if (q0 && aiEls) aiEls.i.value = q0.slice(0, 300); // from an old AI link: filled in, you press Ask
  }
  async function boot() {
    try { IDX = await api('/map/index.json'); } catch (e) { ($('pmResults') || $('pmAiBox')).textContent = 'The map data could not be loaded. Please try again.'; return; }
    const account = (embedded ? window.parent.ppaAccount : window.ppaAccount) || fetch('/.netlify/functions/account', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d?.user || null);
    account.then(u => { signedIn = !!u; paid = !!(u && (u.owner || u.paid)); acctDone = true; if (sel) popup(sel); afterAccount(); loadResearch(); }).catch(() => { acctDone = true; afterAccount(); loadResearch(); });
    setInterval(refreshVerifiedOverlays,120000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshVerifiedOverlays();});
    if (workspace) return;
    buildTop(); buildFilters(); renderCounts(); initSheet(); $('tabAi').addEventListener('click', () => openAi()); $('tabList').addEventListener('click', () => showTab('list', true)); refresh0(); showTab('list');
    try { await loadLib(); initMap(); } catch (e) { console.error('Parcel map initialization failed:',e);mapReady=false;
      try{await start2();}catch(error){console.error('Parcel detail fallback failed:',error);}
      say(window.maplibregl?.Map?'The map could not start in this browser. Parcel details are still available.':'The map library could not be downloaded. Parcel details are still available.', true);
    }
  }
  function refresh0() { renderResults([]); }
  window.addEventListener('keydown', e => { if (e.key !== 'Escape' || workspace) return;
    if (homeMap && snap !== 'peek') { setSnap('peek'); document.querySelector('.pm-home-results').focus({preventScroll:true}); }
    else closePop(); });
  boot();
})();
