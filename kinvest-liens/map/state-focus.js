// Selected state or county visual treatment for the Price Pocket map. Automatic: it follows the existing state and county
// selection (event "ppa:map-focus" from parcel-map.js) and has no toggle, button or banner of its own.
//   * the selected shape is raised from the map (real terrain built from the shape's actual geometry, with the satellite
//     imagery, county lines and parcel markers draped on top of it), with an emerald rim and glow
//   * everything around it is blurred and darkened
//   * the camera is kept inside the selection, and eases back if a drag ends outside it
//   * selecting, changing and clearing animate smoothly (instant when the device asks for reduced motion)
// It never changes parcel data, filters, permissions or any other layer. If anything here fails, the map simply stays as it was.
(function () {
  'use strict';
  const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PITCH = 42, GLOW = '#10b981', RIM = '#8ff0c4', COUNTY_URL = 'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Counties_Generalized_Boundaries/FeatureServer/0/query';
  const MAX_ELEV = 30000;
  let map = null, seq = 0, ver = 0, target = null, raf = 0, exag = 0, anim = 0, lockTimer = 0, protocolOn = false, ready = false;
  const countyCache = new Map();
  // Weak devices keep the tilt, rim and dimming but skip the terrain lift, which is the one costly part. It is decided from the
  // device (very little memory or few cores) and from how smoothly the first transition actually ran.
  const adaptive = () => window.__ppaFocusAdaptive !== false;
  let lowPower = false; try { lowPower = sessionStorage.getItem('ppaFocusLow') === '1'; } catch (_) { /* storage may be blocked */ }
  if (adaptive() && ((navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2))) lowPower = true;
  function watchSmoothness() {
    if (!adaptive() || lowPower || REDUCED || !map) return;
    let n = 0, t0 = 0; const on = () => { if (!t0) t0 = performance.now(); n++; };
    map.on('render', on);
    setTimeout(() => {
      map.off('render', on); const ms = performance.now() - t0;
      if (t0 && ms > 600 && n / (ms / 1000) < 12) { lowPower = true; try { sessionStorage.setItem('ppaFocusLow', '1'); } catch (_) { /* ignore */ } cancelAnimationFrame(anim); exag = 0; try { map.setTerrain(null); } catch (_) { /* ignore */ } schedule(); }
    }, 2600);
  }
  const norm = s => String(s || '').toLowerCase().replace(/\b(county|parish|borough|municipio|city and borough|census area)\b/g, '').replace(/^city of /, '').replace(/\bsaint\b/g, 'st').replace(/[^a-z]/g, '');
  const ease = t => 1 - Math.pow(1 - t, 3), easeIO = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const dur = ms => (REDUCED ? 0 : ms);

  // ---------- geometry helpers ----------
  const polys = g => (!g ? [] : g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []);
  function bboxOf(geoms) {
    let w = 180, s = 90, e = -180, n = -90;
    geoms.forEach(g => polys(g).forEach(p => p[0].forEach(([x, y]) => { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; })));
    return [w, s, e, n];
  }
  function inRing(p, ring) { let ins = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[i], b = ring[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) ins = !ins; } return ins; }
  const inside = (p, outers) => outers.some(r => inRing(p, r));
  function nearest(p, outers) {
    let best = null, bd = Infinity; const k = Math.cos(p[1] * Math.PI / 180);
    outers.forEach(r => { for (let i = 0; i < r.length - 1; i++) {
      const a = r[i], b = r[i + 1], dx = (b[0] - a[0]) * k, dy = b[1] - a[1], l = dx * dx + dy * dy; let t = l ? (((p[0] - a[0]) * k) * dx + (p[1] - a[1]) * dy) / l : 0; t = Math.max(0, Math.min(1, t));
      const q = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], d = Math.hypot((q[0] - p[0]) * k, q[1] - p[1]); if (d < bd) { bd = d; best = q; } } });
    return best;
  }
  // Keeps the outline light: a few hundred points are plenty for the veil, the rim and the lift.
  function simplify(ring, tol) {
    if (ring.length < 40) return ring;
    const out = [ring[0]]; let last = ring[0];
    for (let i = 1; i < ring.length - 1; i++) { if (Math.hypot(ring[i][0] - last[0], ring[i][1] - last[1]) >= tol) { out.push(ring[i]); last = ring[i]; } }
    out.push(ring[ring.length - 1]); return out.length >= 4 ? out : ring;
  }
  // Rounds the corners of the outline a little so the raised wall has no jagged teeth.
  function chaikin(ring, n) { let r = ring; for (let k = 0; k < n; k++) { const o = []; for (let i = 0; i < r.length - 1; i++) { const a = r[i], b = r[i + 1]; o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } o.push(o[0]); r = o; } return r; }
  const kmDiag = bb => { const R = 6371, rad = Math.PI / 180, dLat = (bb[3] - bb[1]) * rad, dLon = (bb[2] - bb[0]) * rad * Math.cos(((bb[1] + bb[3]) / 2) * rad); return R * Math.hypot(dLat, dLon); };

  // ---------- elevation tiles: the selected shape is raised by its own outline (nothing is downloaded) ----------
  function ensureProtocol() {
    if (protocolOn || !window.maplibregl || !maplibregl.addProtocol) return protocolOn;
    maplibregl.addProtocol('ppaelev', async (params) => {
      const m = /^ppaelev:\/\/(\d+)\/(\d+)\/(\d+)\/(\d+)/.exec(params.url || ''); const T = target;
      const z = +m[2], x = +m[3], y = +m[4], n = Math.pow(2, z), S = 256;
      const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(S, S) : Object.assign(document.createElement('canvas'), { width: S, height: S });
      const g = c.getContext('2d'); g.fillStyle = 'rgb(128,0,0)'; g.fillRect(0, 0, S, S);
      if (T) {
        const v = Math.round(T.elev + 32768), R = Math.floor(v / 256), G = v % 256; g.fillStyle = 'rgb(' + R + ',' + G + ',0)';
        const px = ([lng, lat]) => [((lng + 180) / 360 * n - x) * S, ((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n - y) * S];
        T.outers.forEach(r => { g.beginPath(); r.forEach((p, i) => { const q = px(p); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); g.closePath(); g.fill(); });
      }
      const blob = c.convertToBlob ? await c.convertToBlob({ type: 'image/png' }) : await new Promise(ok => c.toBlob(ok, 'image/png'));
      return { data: await blob.arrayBuffer() };
    });
    return (protocolOn = true);
  }

  // ---------- layers ----------
  function addLayers() {
    if (map.getSource('ppa-focus')) return;
    const before = map.getLayer('p-fill') ? 'p-fill' : undefined;
    map.addSource('ppa-focus', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addSource('ppa-counties', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addSource('ppa-dem', { type: 'raster-dem', tiles: ['ppaelev://0/{z}/{x}/{y}'], tileSize: 256, maxzoom: 12, encoding: 'terrarium' });
    map.addSource('ppa-dem-shade', { type: 'raster-dem', tiles: ['ppaelev://0/{z}/{x}/{y}'], tileSize: 256, maxzoom: 12, encoding: 'terrarium' }); // a second source for the shading, as MapLibre advises
    map.addLayer({ id: 'ppa-wall', type: 'hillshade', source: 'ppa-dem-shade', paint: { 'hillshade-exaggeration': 0.95, 'hillshade-shadow-color': '#021a12', 'hillshade-highlight-color': '#a7f3d0', 'hillshade-accent-color': '#059669', 'hillshade-illumination-direction': 320, 'hillshade-illumination-anchor': 'viewport' } }, before);
    map.addLayer({ id: 'ppa-county-lines', type: 'line', source: 'ppa-counties', paint: { 'line-color': '#ffffff', 'line-opacity': 0.55, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.4, 8, 0.9, 12, 1.4] } }, before);
  }

  // ---------- overlay: blurs and darkens everything outside the raised shape, and draws the emerald rim ----------
  // One small canvas above the map, drawn in the same frame as the map from a downscaled copy of it, so it can never lag or
  // fall out of step with the camera, and it behaves the same in every browser.
  let fx = null, fxc = null, small = null, smallc = null, veilT = 0, veilAnim = 0;
  function ensureFx() {
    if (fx) return fx;
    fx = document.createElement('canvas'); fx.className = 'ppa-fx'; fx.setAttribute('aria-hidden', 'true');
    fx.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;z-index:1;pointer-events:none;display:none';
    fxc = fx.getContext('2d'); small = document.createElement('canvas'); smallc = small.getContext('2d');
    map.getCanvasContainer().appendChild(fx);
    const css = document.createElement('style'); css.textContent = '.maplibregl-popup{z-index:3}'; document.head.appendChild(css); // a parcel popup stays above the dimming
    return fx;
  }
  // The outline of the raised shape on screen: tops where the shape faces up the screen, bases where it faces the viewer, so
  // the wall stays sharp too. A margin keeps the glow clear of the blur.
  function projectRing(outer, elev) {
    const tr = map.transform;
    return outer.map(p => { try { const q = tr.coordinatePoint(tr.locationCoordinate({ lng: p[0], lat: p[1] }), elev, tr.pixelMatrix3D); return [q.x, q.y]; } catch (_) { const q = map.project(p); return [q.x, q.y]; } });
  }
  function silhouette(outer) {
    const top = projectRing(outer, target.elev * exag), base = projectRing(outer, 0), pts = [];
    const n = top.length - 1; let area = 0; for (let i = 0; i < n; i++) area += top[i][0] * top[i + 1][1] - top[i + 1][0] * top[i][1];
    const sgn = area >= 0 ? 1 : -1; // positive: the ring runs clockwise on screen
    // Outward normal of each edge, averaged over a window so a jagged border (a river, a coast) does not flip the result.
    const nx = [], ny = [];
    for (let i = 0; i < n; i++) { const dx = top[(i + 1) % n][0] - top[i][0], dy = top[(i + 1) % n][1] - top[i][1], l = Math.hypot(dx, dy) || 1; nx.push(sgn * dy / l); ny.push(sgn * -dx / l); }
    const w = Math.max(2, Math.round(n * 0.03));
    for (let i = 0; i < n; i++) {
      let sx = 0, sy = 0; for (let k = -w; k <= w; k++) { const j = (i + k + n) % n; sx += nx[j]; sy += ny[j]; }
      const l = Math.hypot(sx, sy) || 1, down = sy / l, f = Math.max(0, Math.min(1, (down + 0.1) / 0.6)); // facing the viewer: use the base
      pts.push([top[i][0] + (base[i][0] - top[i][0]) * f, top[i][1] + (base[i][1] - top[i][1]) * f]);
    }
    const m = 14, cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    return pts.map(p => { const dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1; return [p[0] + dx / l * m, p[1] + dy / l * m]; });
  }
  function drawFx() {
    if (!fx || !map) return;
    if (!target || (veilT <= 0.003 && !rimOn)) { fx.style.display = 'none'; return; }
    const src = map.getCanvas(), W = src.width, H = src.height; if (!W || !H) return;
    const k = W / (map.getContainer().clientWidth || W);
    if (fx.width !== W || fx.height !== H) { fx.width = W; fx.height = H; }
    fx.style.display = 'block'; fxc.clearRect(0, 0, W, H);
    // surroundings: a small copy of the map stretched back up (soft), darkened, with the raised shape cut out
    const sw = Math.max(8, Math.round(W / 8)), sh = Math.max(8, Math.round(H / 8));
    if (small.width !== sw || small.height !== sh) { small.width = sw; small.height = sh; }
    smallc.imageSmoothingEnabled = true; smallc.drawImage(src, 0, 0, sw, sh);
    fxc.save(); fxc.beginPath(); fxc.rect(0, 0, W, H);
    target.veilRings.forEach(r => { const s2 = silhouette(r); s2.forEach((p, i) => { if (i) fxc.lineTo(p[0] * k, p[1] * k); else fxc.moveTo(p[0] * k, p[1] * k); }); fxc.closePath(); });
    fxc.clip('evenodd'); fxc.globalAlpha = veilT; fxc.imageSmoothingEnabled = true; fxc.imageSmoothingQuality = 'high';
    fxc.drawImage(small, 0, 0, W, H); fxc.fillStyle = 'rgba(2,10,8,0.46)'; fxc.fillRect(0, 0, W, H); fxc.restore();
    // a thin emerald rim along the true border at the top of the raised shape (kept subtle so it never looks busy)
    if (rimOn) {
      fxc.save(); fxc.lineJoin = 'round'; fxc.lineCap = 'round';
      const rings = target.rimRings.map(r => projectRing(r, target.elev * exag));
      [[7, 0.16, GLOW], [1.6, 0.9, RIM]].forEach(([wd, o, col]) => {
        fxc.beginPath(); rings.forEach(t => t.forEach((p, i) => { if (i) fxc.lineTo(p[0] * k, p[1] * k); else fxc.moveTo(p[0] * k, p[1] * k); }));
        fxc.strokeStyle = col; fxc.globalAlpha = o * rimT; fxc.lineWidth = wd * k; fxc.stroke();
      });
      fxc.restore();
    }
  }
  // Drawn only inside the map's own render event (when its picture is still available); this just asks for another frame.
  const schedule = () => { if (map && target) map.triggerRepaint(); };
  let rimOn = false, rimT = 0;
  function fade(to, ms) {
    cancelAnimationFrame(veilAnim); const v0 = veilT, r0 = rimT, t0 = performance.now(); rimOn = true;
    const set = (v, r) => { veilT = v; rimT = r; if (to === 0 && v <= 0.003) rimOn = false; schedule(); };
    if (!dur(ms)) { set(to, to); return; }
    const step = now => { const t = Math.min(1, (now - t0) / ms), e = ease(t); set(v0 + (to - v0) * e, r0 + (to - r0) * e); if (t < 1) veilAnim = requestAnimationFrame(step); };
    veilAnim = requestAnimationFrame(step);
  }

  // ---------- terrain lift ----------
  function lift(to, ms, done) {
    cancelAnimationFrame(anim); const from = exag, t0 = performance.now();
    // Creating the terrain is the costly step, so it is done once; after that only its exaggeration changes.
    const set = v => {
      exag = v;
      try {
        if (v <= 0.002) { if (map.getTerrain()) map.setTerrain(null); }
        else if (!map.getTerrain()) map.setTerrain({ source: 'ppa-dem', exaggeration: v });
        else if (map.terrain && typeof map.terrain.exaggeration === 'number') { map.terrain.exaggeration = v; map.triggerRepaint(); }
        else map.setTerrain({ source: 'ppa-dem', exaggeration: v });
      } catch (_) { /* keep going */ }
      schedule();
    };
    if (!dur(ms)) { set(to); done && done(); return; }
    const step = now => { const t = Math.min(1, (now - t0) / ms); set(from + (to - from) * easeIO(t)); if (t < 1) anim = requestAnimationFrame(step); else done && done(); };
    anim = requestAnimationFrame(step);
  }
  const demRefresh = () => { ver += 1; ['ppa-dem', 'ppa-dem-shade'].forEach(id => { const s = map.getSource(id); if (s && s.setTiles) s.setTiles(['ppaelev://' + ver + '/{z}/{x}/{y}']); }); };

  // ---------- camera ----------
  // The camera may roam the shape plus a margin, and always the framed view itself, so a long or narrow state is never cropped
  // by the lock. Staying within the shape itself is handled by easing the centre back (see onMoveEnd).
  function paddedBounds(bb) {
    const px = (bb[2] - bb[0]) * 0.08, py = (bb[3] - bb[1]) * 0.08; let w = bb[0] - px, s = bb[1] - py, e = bb[2] + px, n = bb[3] + py;
    try { const v = map.getBounds(); w = Math.min(w, v.getWest()); s = Math.min(s, v.getSouth()); e = Math.max(e, v.getEast()); n = Math.max(n, v.getNorth()); } catch (_) { /* keep the padded shape */ }
    return [[Math.max(-179.9, w), Math.max(-85, s)], [Math.min(179.9, e), Math.min(85, n)]];
  }
  function settled(cb) { if (map.isMoving()) map.once('moveend', () => setTimeout(cb, 0)); else cb(); }
  // After the tilt, zoom and centre so the whole raised shape sits inside the map with a little air around it.
  function frame() {
    const c = map.getContainer(), W = c.clientWidth, H = c.clientHeight; if (!W || !H || !target) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    target.veilRings.forEach(r => projectRing(r, target.elev * exag).concat(projectRing(r, 0)).forEach(p => { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }));
    // Room above the shape for the search bar and menus that sit on the map, so the shape is not hidden behind them.
    let over = 0; try { const t = document.getElementById('pmTop'), cr = c.getBoundingClientRect(); if (t) { const tr = t.getBoundingClientRect(); if (tr.bottom > cr.top && tr.top < cr.bottom) over = Math.max(0, Math.min(H * 0.5, tr.bottom - cr.top + 8)); } } catch (_) { /* no overlay */ }
    const padX = W * 0.06, padT = Math.max(H * 0.1, over), padB = H * 0.08, bw = x1 - x0, bh = y1 - y0; if (!(bw > 0 && bh > 0)) return null;
    const sc = Math.min((W - 2 * padX) / bw, (H - padT - padB) / bh), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const to = map.unproject([cx + 0, cy - (padT - padB) / 2]); // keeps the room for the controls above the shape
    // Zoom out if the shape does not fit; zoom in (up to the map's own limit) if it is small in the view, as a county is.
    const dz = sc < 1 ? Math.log2(sc) : sc > 1.15 ? Math.log2(sc) - 0.05 : 0;
    return { center: [to.lng, to.lat], zoom: Math.min(16, map.getZoom() + dz) };
  }
  function lockCamera(mySeq) {
    settled(() => {
      if (mySeq !== seq || !target) return;
      const finish = () => {
        if (mySeq !== seq || !target) return;
        const f = frame(), done = () => { if (mySeq !== seq || !target) return; try { map.setMaxBounds(paddedBounds(target.bb)); } catch (_) { /* ignore */ } };
        if (f && Math.abs(f.zoom - map.getZoom()) > 0.04) { map.easeTo({ center: f.center, zoom: f.zoom, duration: dur(500), easing: ease }); map.once('moveend', () => setTimeout(done, 0)); } else done();
      };
      try { map.easeTo({ pitch: PITCH, duration: dur(900), easing: ease }); } catch (_) { /* ignore */ }
      if (REDUCED || !dur(900)) setTimeout(finish, 60); else map.once('moveend', () => setTimeout(finish, 0));
    });
  }
  function onMoveEnd(e) {
    if (!target || !e || !e.originalEvent) return; // only after a person moved the map
    const c = map.getCenter(), p = [c.lng, c.lat]; if (inside(p, target.outers)) return;
    const q = nearest(p, target.outers); if (q) map.easeTo({ center: q, duration: dur(450), easing: ease });
  }

  // ---------- counties ----------
  async function counties(state) {
    if (countyCache.has(state)) return countyCache.get(state);
    const p = (async () => {
      const u = COUNTY_URL + '?' + new URLSearchParams({ where: "STATE_ABBR='" + state + "'", outFields: 'NAME', returnGeometry: 'true', outSR: '4326', maxAllowableOffset: '0.004', geometryPrecision: '3', f: 'geojson' });
      const r = await fetch(u, { cache: 'force-cache' }); if (!r.ok) throw Error('counties'); const gj = await r.json();
      if (!gj || !Array.isArray(gj.features) || !gj.features.length) throw Error('counties'); return gj;
    })();
    countyCache.set(state, p); p.catch(() => countyCache.delete(state)); return p;
  }

  // ---------- selecting, changing, clearing ----------
  function stateFeature(a) { const src = map.getSource('states'); const gj = src && src._data; return gj && gj.features ? gj.features.find(f => f.properties && f.properties.a === a) : null; }
  function build(geoms) {
    const outers = [], veilRings = []; const bb = bboxOf(geoms), tol = Math.max(bb[2] - bb[0], bb[3] - bb[1]) / 260;
    const rimRings = [];
    geoms.forEach(g => polys(g).forEach(pl => {
      const big = kmDiag(bboxOf([{ type: 'Polygon', coordinates: [pl[0]] }])) > kmDiag(bb) * 0.02; // islands too small to read are left flat
      if (!big) return;
      rimRings.push(pl[0]); veilRings.push(simplify(pl[0], tol)); outers.push(chaikin(simplify(pl[0], tol / 2), 2));
    }));
    const elev = Math.min(MAX_ELEV, Math.max(1200, kmDiag(bb) * 70));
    return { outers, veilRings, rimRings, bb, elev, geoms, key: '' };
  }
  async function apply(detail) {
    if (!map || !ready) return;
    const state = detail && detail.state, countyName = detail && detail.county;
    if (target && target.key === state + '|' + (countyName || '') && state) { const same = ++seq; settled(() => { if (same === seq) lockCamera(same); }); return; } // the same selection again: only re-frame
    const my = ++seq; clearTimeout(lockTimer);
    if (!state) { clear(my); return; }
    const sf = stateFeature(state); if (!sf) { clear(my); return; }
    let geoms = [sf.geometry], list = null;
    if (countyName) { try { const gj = await counties(state); list = gj; const k = norm(countyName); const hit = gj.features.find(f => norm(f.properties && f.properties.NAME) === k); if (hit && my === seq) geoms = [hit.geometry]; } catch (_) { /* keep the state */ } }
    else { counties(state).then(gj => { list = gj; if (my === seq && map.getSource('ppa-counties')) map.getSource('ppa-counties').setData(gj); }).catch(() => {}); }
    if (my !== seq) return;
    const changing = !!target; if (changing && exag > 0.02) { await new Promise(ok => lift(0, 260, ok)); if (my !== seq) return; }
    target = build(geoms); target.key = state + '|' + (countyName || ''); window.PPAFocus.active = true;
    addLayers(); ensureFx(); demRefresh();
    map.getSource('ppa-focus').setData({ type: 'FeatureCollection', features: geoms.map(g => ({ type: 'Feature', properties: {}, geometry: g })) });
    if (list && map.getSource('ppa-counties')) map.getSource('ppa-counties').setData(list);
    fade(1, 650); schedule();
    // The existing fit-to-selection runs first; the lift and tilt follow it.
    settled(() => { if (my !== seq) return; if (!lowPower) lift(1, 900); lockCamera(my); watchSmoothness(); });
  }
  function clear(my) {
    window.PPAFocus.active = false; clearTimeout(lockTimer);
    try { map.setMaxBounds(null); } catch (_) { /* ignore */ }
    fade(0, 500);
    const done = () => { if (my !== seq) return; target = null; try { if (map.getSource('ppa-counties')) map.getSource('ppa-counties').setData({ type: 'FeatureCollection', features: [] }); } catch (_) { /* ignore */ } };
    lift(0, 600, done);
    if (map.getPitch() > 0.5) map.easeTo({ pitch: 0, duration: dur(700), easing: ease });
  }

  window.PPAFocus = { active: false, pitch: () => (target ? PITCH : 0), apply };
  window.addEventListener('ppa:map-focus', e => { try { apply(e.detail); } catch (_) { /* the map keeps working */ } });
  (function boot() {
    const t = setInterval(() => {
      const m = window.__ppaMap; if (!m || !m.isStyleLoaded || !m.getSource || !m.getSource('states')) return;
      clearInterval(t); map = m; ready = ensureProtocol(); map.on('render', drawFx); map.on('moveend', onMoveEnd);
      if (window.__ppaFocusPending) { const d = window.__ppaFocusPending; window.__ppaFocusPending = null; apply(d); }
    }, 150);
  })();
  // Remember the latest request if it arrives before the map is ready.
  window.addEventListener('ppa:map-focus', e => { if (!ready) window.__ppaFocusPending = e.detail; });
})();
