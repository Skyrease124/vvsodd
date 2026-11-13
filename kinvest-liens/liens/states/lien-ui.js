// Shared renderers for the Florida sale box and the lien table.
// HOA status (tools/fl-parcels/hoa_backfill.py): confirmed only from a reviewed recorded declaration; one JSON file per county.
const HoaData = {
  base: '/liens/states/hoa/', cache: {}, decls: null,
  slug: c => String(c).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  LABEL: {confirmed: 'HOA confirmed', possible: 'Possible HOA', unknown: 'HOA status unknown'},
  WHY: {
    confirmed: 'A recorded declaration or amendment covers this specific parcel.',
    possible: 'An association is linked to the subdivision, but coverage for this lot or phase is unverified.',
    unknown: 'The records checked did not establish whether an HOA applies.'
  },
  load(county) { if (!this.cache[county]) this.cache[county] = fetch(this.base + this.slug(county) + '.json').then(r => r.ok ? r.json() : null).catch(() => null); return this.cache[county]; },
  loadDecls() { if (!this.decls) this.decls = fetch(this.base + 'declarations.json').then(r => r.ok ? r.json() : null).catch(() => null); return this.decls; },
  isFl: l => (l.state || 'FL') === 'FL',
  async rec(l) { if (!this.isFl(l)) return null; const f = await this.load(l.county); return f && f.p && f.p[l.parcel] || null; },
  // synchronous status once the county file has been loaded (used by the filter)
  statusNow(l) { const f = this.loaded && this.loaded[l.county]; const r = f && f.p && f.p[l.parcel]; return r ? r.st : 'unknown'; },
  async preload(list) { this.loaded = this.loaded || {}; const cs = Array.from(new Set(list.filter(this.isFl).map(l => l.county))); await Promise.all(cs.map(async c => { this.loaded[c] = await this.load(c); })); },
  badge(l) {
    if (!this.isFl(l)) return null;
    const b = document.createElement('span'); b.className = 'lchip hoa na'; b.textContent = 'HOA …';
    this.rec(l).then(r => { const st = r ? r.st : 'unknown'; b.className = 'lchip hoa ' + st; b.textContent = this.LABEL[st]; b.title = this.WHY[st]; b.dataset.hoa = st; });
    return b;
  },
  recordsLink(l) {
    const a = document.createElement('a'); a.target = '_blank'; a.rel = 'noopener noreferrer'; a.className = 'hoalink';
    const pa = typeof FL_PA !== 'undefined' && FL_PA[l.county];
    a.href = pa || 'https://www.flclerks.com/'; a.textContent = 'Check official records' + (pa ? ' (property appraiser, then the clerk’s official records)' : ' (find your county clerk)'); return a;
  },
  async panel(l) {
    const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
    const box = mk('div', 'precord hoabox'); box.appendChild(mk('h4', '', 'HOA'));
    const r = await this.rec(l), st = r ? r.st : 'unknown';
    const top = mk('p', 'hoatop'); top.append(mk('span', 'lchip hoa ' + st, this.LABEL[st]), ' ', this.WHY[st]); box.appendChild(top);
    if (r && r.note) box.appendChild(mk('p', 'small', r.note));
    if (r && r.why && st !== 'confirmed') box.appendChild(mk('p', 'small', r.why));
    const legal = [r && r.sub ? 'Subdivision: ' + r.sub : '', r && r.phase ? 'Phase: ' + r.phase : '', r && r.block ? 'Block: ' + r.block : '', r && r.lot ? 'Lot: ' + r.lot : ''].filter(Boolean);
    if (legal.length) box.appendChild(mk('p', 'small', 'From the official legal description: ' + legal.join(' · ') + '.'));
    const link = (o, text) => { const a = mk('a', '', text || o.name || o.url); a.href = o.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; };
    if (st === 'confirmed' || (r && r.decl)) {
      const D = await this.loadDecls(), e = D && D.decls && D.decls[r.decl];
      if (e) {
        const dl = mk('dl', 'pfacts'), row = (k, v) => { if (v) { const d = mk('div'); d.append(mk('dt', '', k)); const dd = mk('dd'); if (v instanceof Node) dd.appendChild(v); else dd.textContent = v; d.appendChild(dd); dl.appendChild(d); } };
        row('Association', e.name);
        row('Membership', e.membership === 'mandatory' ? 'Mandatory' : e.membership === 'voluntary' ? 'Voluntary' : 'Not verified');
        const du = e.dues;
        row('Regular dues', du && du.amount ? '$' + Number(du.amount).toLocaleString('en-US') + ' ' + du.frequency + ' (as of ' + du.asOf + ')' : 'Dues unverified');
        if (du && du.source && du.source.url) { const p = mk('div'); p.append(link(du.source, 'Dues source: ' + (du.source.name || 'association'))); row('Dues source', p); }
        box.appendChild(dl);
        const as = (e.assessments || []);
        box.appendChild(mk('p', 'small', as.length ? 'Verified special assessments:' : 'No special assessments have been verified.'));
        if (as.length) { const ul = mk('ul', 'small'); as.forEach(a => { const li = mk('li', '', '$' + Number(a.amount).toLocaleString('en-US') + (a.description ? ' for ' + a.description : '') + ' (as of ' + a.asOf + ') '); li.appendChild(link(a.source, 'source')); ul.appendChild(li); }); box.appendChild(ul); }
        const rs = e.restrictions || [];
        box.appendChild(mk('h4', '', 'Restrictions that matter for vacant land'));
        if (rs.length) { const ul = mk('ul', 'small'); rs.forEach(x => ul.appendChild(mk('li', '', (x.topic ? x.topic + ': ' : '') + x.text + (x.section ? ' (' + x.section + ')' : '')))); box.appendChild(ul); } else box.appendChild(mk('p', 'small', 'No restrictions have been reviewed yet. Read the declaration before you bid.'));
        box.appendChild(mk('h4', '', 'Recorded documents'));
        const ul = mk('ul', 'small'); (e.documents || []).forEach(d => { const li = mk('li', '', (d.type === 'amendment' ? 'Amendment' + (d.effect ? ' (' + d.effect + ')' : '') : 'Declaration') + (d.recording ? ' · recording ' + d.recording : '') + (d.recorded ? ' · recorded ' + d.recorded : '') + ' '); if (d.url) li.appendChild(link({url: d.url}, 'source')); ul.appendChild(li); }); box.appendChild(ul);
        box.appendChild(mk('p', 'small psrc', 'Verified ' + (e.verified && e.verified.date) + ' against the recorded documents. Confirm dues and rules with the association before bidding.'));
      }
    }
    if (st === 'possible' && r && r.ev && r.ev.length) {
      box.appendChild(mk('p', 'small', 'Lead from the county roll: ' + r.ev.map(x => x.assoc + (x.common ? ' (owns a common-area parcel)' : '') + (x.roll ? ' · roll ' + x.roll : '')).join('; ') + '. A name on the roll is a lead, not proof that this lot is covered.'));
    }
    if (st !== 'confirmed') { box.appendChild(mk('p', 'small', 'Dues unverified. Restrictions unverified.')); const p = mk('p', 'small'); p.appendChild(this.recordsLink(l)); box.appendChild(p); }
    return box;
  }
};
// County aerial imagery (ArcGIS ImageServer). Palm Beach is on; Miami-Dade stays OFF until its layer passes the checks noted below.
// Imagery is always drawn live from the county's own server and never stored by us: the county's published terms do not clearly allow copies.
const CountyAerial = {
  CFG: {
    'Palm Beach': {on: true, name: 'Palm Beach County', credit: 'Palm Beach County GIS', sources: [
      {year: 2026, url: 'https://gis.pbcgov.org/image/rest/services/Aerialphotgraphy_2026_WebMercator/ImageServer'},
      {year: 2025, url: 'https://gis.pbcgov.org/image/rest/services/Aerialphotography_2025_Webmercator/ImageServer'}]},
    // Miami-Dade MDCImagery: images load and line up with parcel outlines, but the service's own text says 2026, 2025 and 2024 in different places,
    // its image tiles are mostly 2024 (a few 2026), and one request in 36 took 19 s. Satellite stays the default there until the county fixes the year labeling.
    'Miami-Dade': {on: false, name: 'Miami-Dade County', sources: []}
  },
  enabled: c => !!(CountyAerial.CFG[c] && CountyAerial.CFG[c].on),
  wm: (lng, lat) => [lng * 20037508.34 / 180, Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180) * 20037508.34 / 180],
  timeout(url, ms) { const c = new AbortController(), t = setTimeout(() => c.abort(), ms); return fetch(url, {signal: c.signal}).finally(() => clearTimeout(t)); },
  // Which source covers this point? Newest first. why: 'ok' | 'nocov' (every source answered "no imagery here") | 'error' (a service could not be reached)
  async pick(county, lng, lat, hint) {
    const cfg = this.CFG[county]; if (!cfg || !cfg.on) return {src: null, why: 'off'};
    const [x, y] = this.wm(lng, lat); let err = false;
    for (const src of cfg.sources) {
      if (hint && hint !== src.year && !(hint === 0)) { /* the stored hint is only a starting point: we still verify live */ }
      try {
        const r = await this.timeout(src.url + '/identify?geometry=' + x + ',' + y + '&geometryType=esriGeometryPoint&returnGeometry=false&returnCatalogItems=false&f=json', 9000);
        if (!r.ok) throw new Error('http'); const d = await r.json(); if (d.error) throw new Error('svc');
        if (d.value && d.value !== 'NoData') return {src, why: 'ok'};
      } catch (e) { err = true; }
    }
    return {src: null, why: err ? 'error' : 'nocov'};
  },
  exportUrl(src, b, w, h) { return src.url + '/exportImage?bbox=' + b.map(v => v.toFixed(2)).join(',') + '&bboxSR=3857&imageSR=3857&size=' + w + ',' + h + '&format=jpgpng&f=image'; },
  label(county, src) { const c = this.CFG[county]; return 'County Aerial: ' + c.name + ' ' + src.year + ' (capture year ' + src.year + ', per the county layer)'; },
  // Leaflet layer that asks the ImageServer for each 256px tile in web-mercator, so images line up with the parcel outline.
  layer(L, src, county) {
    this._county = county;
    const Cls = L.TileLayer.extend({getTileUrl(co) { const n = Math.pow(2, co.z), size = 40075016.68 / n, x0 = -20037508.34 + co.x * size, y1 = 20037508.34 - co.y * size; return CountyAerial.exportUrl(src, [x0, y1 - size, x0 + size, y1], 256, 256); }});
    return new Cls('', {maxZoom: 20, maxNativeZoom: 20, tileSize: 256, attribution: 'Imagery &copy; ' + (this.CFG[this._county] ? this.CFG[this._county].credit : 'county GIS')});
  },
  // Small label on the map saying which imagery is on screen.
  labelControl(L, m) {
    const C = L.Control.extend({options: {position: 'bottomleft'}, onAdd() { const d = L.DomUtil.create('div', 'caer-label'); d.setAttribute('role', 'status'); this.el = d; return d; }});
    const c = new C(); c.addTo(m); return {set(t) { c.el.textContent = t; }};
  },
  // Wire the County Aerial option into an open parcel map. Satellite is already showing; we switch only when the county layer is proven to cover and load.
  async attach(L, m, box, l, r, layers, ctrl) {
    const cfg = this.CFG[l.county]; const lab = this.labelControl(L, m); box._aerialLabel = lab;
    const sat = layers.sat, street = layers.street, esri = 'Satellite: Esri World Imagery (capture dates vary)';
    lab.set(cfg && cfg.on ? 'Checking county aerial imagery…' : esri);
    const bounds = () => { const g = box._outline; return g && g.getBounds(); };
    const keepInView = () => { const b = bounds(); if (b && !m.getBounds().pad(-0.02).contains(b)) m.fitBounds(b, {maxZoom: 19, padding: [30, 30]}); };
    const toSat = why => { if (box._county && m.hasLayer(box._county)) m.removeLayer(box._county); if (!m.hasLayer(sat) && !m.hasLayer(street)) sat.addTo(m); lab.set((why ? why + ' ' : '') + (m.hasLayer(street) ? 'Street map: OpenStreetMap' : 'Showing Satellite. ' + esri)); keepInView(); };
    if (!cfg || !cfg.on) return;
    const bb = r && r.bb; if (!bb) { lab.set(esri); return; }
    const lng = (bb[0] + bb[2]) / 2, lat = (bb[1] + bb[3]) / 2;
    let chosen = await this.pick(l.county, lng, lat, r.aer && r.aer.y);
    if (!box.isConnected && !m._loaded) return;
    if (!chosen.src) { toSat(chosen.why === 'nocov' ? 'The county aerial does not cover this parcel.' : 'The county aerial service could not be reached.'); return; }
    const tried = new Set();
    const make = src => {
      tried.add(src.year); const lay = this.layer(L, src, l.county); let ok = 0, bad = 0, done = false;
      lay.on('tileload', () => { ok++; }); lay.on('tileerror', () => { bad++; if (!ok && bad >= 3 && !done) { done = true; next(src); } });
      setTimeout(() => { if (!ok && !done && m.hasLayer(lay)) { done = true; next(src); } }, 12000);
      lay._src = src; return lay;
    };
    const show = lay => { if (box._county) { try { ctrl.removeLayer(box._county); } catch (e) {} if (m.hasLayer(box._county)) m.removeLayer(box._county); } box._county = lay; ctrl.addBaseLayer(lay, 'County Aerial'); };
    const next = async failed => {
      // that source failed to load: try the older county layer if it covers the parcel, else Satellite
      const older = cfg.sources.filter(s => !tried.has(s.year));
      for (const src of older) { const p = await this.pick(l.county, lng, lat); if (p.src && !tried.has(p.src.year)) { const lay = make(p.src); show(lay); lay.addTo(m); sat && m.hasLayer(sat) && m.removeLayer(sat); lab.set(this.label(l.county, p.src) + ' (' + failed.year + ' did not load.)'); return; } break; }
      if (box._county) { try { ctrl.removeLayer(box._county); } catch (e) {} if (m.hasLayer(box._county)) m.removeLayer(box._county); }
      toSat('County aerial (' + Array.from(tried).sort().reverse().join(' and ') + ') failed to load.');
    };
    const lay = make(chosen.src); show(lay); lay.addTo(m); if (m.hasLayer(sat)) m.removeLayer(sat); lab.set(this.label(l.county, chosen.src));
    m.on('baselayerchange', e => { lab.set(e.layer === box._county ? this.label(l.county, box._county._src) : e.layer === street ? 'Street map: © OpenStreetMap contributors' : esri); setTimeout(keepInView, 60); });
  },
  // Card preview drawn from the same county source and the same lot outline as the interactive map.
  thumbEl(l, r, src) {
    const W = 480, H = 320, mk = (t, c) => { const e = document.createElement(t); if (c) e.className = c; return e; };
    const pts = r.g[0].map(([lng, lat]) => this.wm(lng, lat)), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const bw = Math.max((Math.max(...xs) - Math.min(...xs)) * 1.5, (Math.max(...ys) - Math.min(...ys)) * 1.5 * (W / H), 50), bh = bw * H / W;
    const b = [cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2];
    const wrap = mk('div', 'caer-prev'), im = mk('img'); im.loading = 'lazy'; im.decoding = 'async'; im.width = W; im.height = H; im.alt = 'Aerial photo of parcel ' + l.parcel + ' with its boundary outlined'; im.src = this.exportUrl(src, b, W, H);
    const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('aria-hidden', 'true');
    const P = ([x, y]) => ((x - b[0]) / bw * W).toFixed(1) + ',' + ((b[3] - y) / bh * H).toFixed(1);
    const path = document.createElementNS(NS, 'path'); path.setAttribute('d', r.g.map(ring => 'M' + ring.map(q => P(this.wm(q[0], q[1]))).join('L') + 'Z').join(' ')); path.setAttribute('class', 'caer-poly'); svg.appendChild(path);
    wrap.append(im, svg); return {wrap, im};
  }
};
// Nearby Traffic (tools/fl-parcels/traffic.py): FDOT measured road segments (AADT = estimated vehicles per day) matched to the lot outline.
// One stored segment per parcel feeds the card, the filter and the map highlight, so they can never disagree.
const TrafficData = {
  THRESH: 10000, NEAR_FT: 500, loaded: {},
  seg(r) { return r && r.tr && !r.tr.none && r.tr.aadt ? r.tr : null; },
  isVacant(l, r) { return /vacant/i.test((r && r.use) || l.use || ''); },
  async preload(list) { const cs = Array.from(new Set(list.filter(l => (l.state || 'FL') === 'FL').map(l => l.county))); await Promise.all(cs.map(async c => { this.loaded[c] = await ParcelData.load(c); })); },
  syncRec(l) { const f = this.loaded[l.county]; return f && f.p && f.p[l.parcel] || null; },
  passes(l) { const r = this.syncRec(l), t = this.seg(r); return !!(t && this.isVacant(l, r) && t.ft <= this.NEAR_FT && t.aadt >= this.THRESH); },
  fmt: n => Number(n).toLocaleString('en-US'),
  road(t) { return 'FDOT roadway ' + t.road + (t.from || t.to ? ' (' + [t.from, t.to].filter(x => x && x !== 'N/A').map(x => x.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase())).join(' to ') + ')' : ''); },
  text(r) {
    const t = this.seg(r);
    if (!t) return 'Traffic data unavailable';
    return this.fmt(t.aadt) + ' vehicles per day (AADT, count year ' + t.yr + ') · ' + (t.ft === 0 ? 'touches the lot' : this.fmt(t.ft) + ' ft from the lot') + (t.ft > this.NEAR_FT ? ' (farther than ' + this.NEAR_FT + ' ft)' : '') + ' · ' + this.road(t);
  },
  // card block: Nearby Traffic and, separately, legal road access (a traffic count says nothing about legal access)
  el(l) {
    const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
    const box = mk('div', 'ltraf'); const a = mk('p', 'small'); a.append(mk('b', '', 'Nearby Traffic: '), mk('span', '', 'checking…')); box.appendChild(a);
    const acc = mk('p', 'small muted'); acc.append(mk('b', '', 'Legal road access: '), 'Not verified. A traffic count does not show that this lot has legal access; check the deed, plat or county.'); box.appendChild(acc);
    ParcelData.rec(l).then(({r}) => {
      const t = this.seg(r), sp = a.lastChild; sp.textContent = this.text(r); if (!t) sp.className = 'tr-na'; else if (t.ft <= this.NEAR_FT && t.aadt >= this.THRESH) a.classList.add('tr-hi');
      box.dataset.seg = t ? t.id : ''; if (t) box.title = 'Source: FDOT Annual Average Daily Traffic. AADT is an estimate.';
    });
    return box;
  }
};
// Nearby Cleanup Sites: Florida DEP cleanup sites (open, active and on-hold) within 1/2 mile of the lot boundary, via /.netlify/functions/cleanup.
// "On parcel" only when the site's mapped point is inside the lot outline. Distances are approximate (mapped point to lot boundary).
const CleanupData = {
  MILE_FT: 2640, cache: {},
  STATUS: {ACTIVE: 'Active cleanup', OPEN: 'Open', ONHOLD: 'On hold'},
  CAT: {PETRO: 'Petroleum', BROWN: 'Brownfield', FED: 'Federal', PFAS: 'PFAS', SUPER: 'Superfund', OTHCU: 'Other cleanup'},
  PROX: {EXACT: 'exact', APPRX: 'approximate', CENTR: 'center of the site', ENTRA: 'entrance', OFFST: 'offset from the site', PROMF: 'from a property map', VICIN: 'vicinity only', ADMIN: 'administrative'},
  fmt: n => Number(n).toLocaleString('en-US'),
  // distance in feet from point to the lot (0 and inside=true when the point is inside any ring, even-odd)
  measure(r, sites) {
    const rings = r.g, xs = rings.flat().map(q => q[0]), ys = rings.flat().map(q => q[1]), lng0 = (Math.min(...xs) + Math.max(...xs)) / 2, lat0 = (Math.min(...ys) + Math.max(...ys)) / 2, k = Math.cos(lat0 * Math.PI / 180);
    const P = (x, y) => [(x - lng0) * k * 111320, (y - lat0) * 110574], R = rings.map(ring => ring.map(q => P(q[0], q[1])));
    const segd = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0; return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
    const inside = p => { let c = false; R.forEach(ring => { for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[i], b = ring[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } }); return c; };
    return sites.map(st => { const p = P(st.x, st.y), on = inside(p); let d = 1e18; R.forEach(ring => { for (let i = 0; i < ring.length - 1; i++) d = Math.min(d, segd(p, ring[i], ring[i + 1])); }); return Object.assign({}, st, {ft: on ? 0 : d * 3.28084, on}); })
      .filter(st => st.ft <= this.MILE_FT).sort((a, b) => a.ft - b.ft);
  },
  // resolves to {state: 'ok', sites, queried} | {state: 'failed'} | {state: 'nooutline'}
  get(l, r) {
    const key = l.county + '|' + l.parcel; if (this.cache[key]) return this.cache[key];
    return this.cache[key] = (async () => {
      if (!r || !r.g || !r.bb) return {state: 'nooutline'};
      const [x0, y0, x1, y1] = r.bb, lat = (y0 + y1) / 2, dlat = 804.67 / 110574, dlng = 804.67 / (111320 * Math.cos(lat * Math.PI / 180));
      try {
        const u = '/.netlify/functions/cleanup?xmin=' + (x0 - dlng).toFixed(6) + '&ymin=' + (y0 - dlat).toFixed(6) + '&xmax=' + (x1 + dlng).toFixed(6) + '&ymax=' + (y1 + dlat).toFixed(6);
        const resp = await fetch(u); if (!resp.ok) throw new Error('http'); const d = await resp.json(); if (!d.ok) throw new Error('dep');
        return {state: 'ok', sites: this.measure(r, d.sites), queried: d.queried};
      } catch (e) { delete this.cache[key]; return {state: 'failed'}; }
    })();
  },
  distText: st => st.on ? 'On parcel' : 'about ' + CleanupData.fmt(Math.round(st.ft / 10) * 10 || 10) + ' ft (approximate)',
  siteEl(st) {
    const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
    const li = mk('li', 'clsite' + (st.on ? ' clon' : '')); const top = mk('div', 'cltop'); top.append(mk('b', '', st.name || 'Unnamed site')); if (st.on) top.appendChild(mk('span', 'rbadge clbadge', 'On parcel')); li.appendChild(top);
    li.appendChild(mk('p', 'small', 'Distance: ' + this.distText(st) + (st.on ? ' (the mapped location is inside the lot boundary)' : ' from the lot boundary')));
    li.appendChild(mk('p', 'small', 'Cleanup status: ' + (this.STATUS[st.status] || st.status || 'not given') + (st.cat ? ' · ' + (this.CAT[st.cat] || st.cat) : '')));
    const idp = mk('p', 'small'); idp.append('DEP facility ID: ', mk('b', '', st.id || 'not given'), st.db ? ' (' + st.db + ')' : ''); if (st.docs) { idp.append(' · '); const a = mk('a', '', 'Look up the official case'); a.href = st.docs; a.target = '_blank'; a.rel = 'noopener noreferrer'; idp.appendChild(a); } li.appendChild(idp);
    if (st.addr) li.appendChild(mk('p', 'small muted', st.addr + ' · mapped location: ' + (this.PROX[st.prox] || st.prox || 'precision not given')));
    return li;
  },
  fill(box, res) {
    const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
    box.querySelectorAll('.clbody').forEach(x => x.remove()); const body = mk('div', 'clbody'); box.appendChild(body);
    if (res.state === 'failed') { body.appendChild(mk('p', 'notice', 'Cleanup data unavailable.')); const b = mk('button', 'btn small ghost', 'Try again'); b.type = 'button'; b.addEventListener('click', () => box._retry && box._retry()); body.appendChild(b); return; }
    if (res.state === 'nooutline') { body.appendChild(mk('p', 'notice', 'Cleanup data unavailable.')); body.appendChild(mk('p', 'small muted', 'This lot’s outline is not matched to the state parcel map, so distances cannot be measured.')); return; }
    if (!res.sites.length) body.appendChild(mk('p', 'small', 'No mapped cleanup sites within ½ mile.'));
    else { const n = res.sites.filter(x => x.on).length; body.appendChild(mk('p', 'small', res.sites.length + ' mapped site' + (res.sites.length === 1 ? '' : 's') + ' within ½ mile' + (n ? ' (' + n + ' on the parcel)' : '') + ', nearest first.')); const ul = mk('ul', 'cllist'); res.sites.slice(0, 8).forEach(st => ul.appendChild(this.siteEl(st))); body.appendChild(ul); if (res.sites.length > 8) { const m = mk('button', 'rlink', 'Show all ' + res.sites.length); m.type = 'button'; m.addEventListener('click', () => { ul.textContent = ''; res.sites.forEach(st => ul.appendChild(this.siteEl(st))); m.remove(); }); body.appendChild(m); } }
    body.appendChild(mk('p', 'small muted', 'Source: Florida DEP Cleanup Sites (open, active and on-hold sites; closed sites are not in this layer), queried ' + (res.queried || '') + '. Distances are approximate: they run from each site’s mapped point, whose precision varies, to the lot boundary. A site is marked “On parcel” only when its mapped point falls inside the lot boundary. Use the DEP facility ID to look up the official case.'));
  },
  section(l, r) {
    const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
    const box = mk('div', 'precord clbox'); box.appendChild(mk('h4', '', 'Nearby Cleanup Sites'));
    const run = () => { box.querySelectorAll('.clbody').forEach(x => x.remove()); box.appendChild(mk('p', 'small muted clbody', 'Checking Florida DEP…')); this.get(l, r).then(res => this.fill(box, res)); };
    box._retry = run; run(); return box;
  },
  // map toggle: shows the same sites on the map (purple dots; gold ring = on parcel)
  mapAttach(L, m, box, l, r) {
    const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
    const dlg = box.closest('dialog') || box.parentNode; let old = dlg.querySelector('.clbar'); if (old) old.remove();
    const bar = mk('p', 'clbar small'), b = mk('button', 'btn small ghost', 'Show cleanup sites'); b.type = 'button'; b.setAttribute('aria-pressed', 'false'); const st = mk('span', 'small muted', ''); st.setAttribute('role', 'status'); bar.append(b, ' ', st); box.after(bar);
    let layer = null;
    b.addEventListener('click', async () => {
      if (layer && m.hasLayer(layer)) { m.removeLayer(layer); b.setAttribute('aria-pressed', 'false'); b.textContent = 'Show cleanup sites'; st.textContent = ''; return; }
      b.disabled = true; st.textContent = 'Checking Florida DEP…'; const res = await this.get(l, r); b.disabled = false;
      if (res.state !== 'ok') { st.textContent = 'Cleanup data unavailable.'; return; }
      if (!res.sites.length) { st.textContent = 'No mapped cleanup sites within ½ mile.'; return; }
      layer = L.layerGroup(res.sites.map(x => { const c = L.circleMarker([x.y, x.x], {radius: x.on ? 10 : 7, color: x.on ? '#ffd166' : '#fff', weight: x.on ? 4 : 2, fillColor: '#a855f7', fillOpacity: 0.95}); c.bindPopup('<b>' + (x.name || 'Cleanup site').replace(/</g, '&lt;') + '</b><br>' + this.distText(x) + '<br>Status: ' + (this.STATUS[x.status] || x.status || 'n/a') + '<br>DEP facility ID: ' + (x.id || 'n/a')); c.bindTooltip(x.on ? 'On parcel' : this.distText(x), {sticky: true}); return c; })).addTo(m);
      b.setAttribute('aria-pressed', 'true'); b.textContent = 'Hide cleanup sites'; st.textContent = res.sites.length + ' site' + (res.sites.length === 1 ? '' : 's') + ' within ½ mile (purple dots; gold ring = on parcel). Distances are approximate.';
      const bb = L.latLngBounds(box._outline.getBounds().getSouthWest(), box._outline.getBounds().getNorthEast()); res.sites.forEach(x => bb.extend([x.y, x.x])); m.fitBounds(bb, {maxZoom: 19, padding: [30, 30]});
    });
  }
};
// Mapped Wetlands: U.S. Fish & Wildlife Service National Wetlands Inventory polygons intersected with the FULL verified lot outline (server side,
// /.netlify/functions/wetlands). A map-based screening estimate, not a wetland delineation. "No mapped overlap" appears only when the NWI covers the lot
// and the check came back empty; missing coverage or a failed lookup is "Wetlands data unavailable".
const WetlandsData = {
  SRC: 'https://www.fws.gov/program/national-wetlands-inventory/web-mapping-services', MAPPER: 'https://fwsprimary.wim.usgs.gov/wetlands/apps/wetlands-mapper/', mem: {},
  async get(l, r) {
    if (!r || r.st !== 'matched' || !r.g || !r.g.length) return {state: 'unavailable', why: 'nooutline'};
    const key = JSON.stringify(r.g); if (this.mem[key]) return this.mem[key];
    let out; try {
      const c = new AbortController(), t = setTimeout(() => c.abort(), 30000);
      const res = await fetch('/.netlify/functions/wetlands', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({rings: r.g}), signal: c.signal}).finally(() => clearTimeout(t));
      const d = await res.json();
      if (d && d.ok === true && d.covered === true && isFinite(d.overlapAcres) && isFinite(d.parcelAcres) && isFinite(d.pct) && Array.isArray(d.geom)) out = Object.assign({state: d.none || d.overlapAcres <= 0 ? 'none' : 'overlap'}, d);
      else out = {state: 'unavailable', why: d && d.reason === 'coverage' ? 'coverage' : 'lookup'};
    } catch (e) { out = {state: 'unavailable', why: 'lookup'}; }
    if (out.why !== 'lookup') this.mem[key] = out; return out;
  },
  acres: a => a < 0.01 ? '<0.01' : a.toLocaleString('en-US', {minimumFractionDigits: a < 10 ? 2 : 1, maximumFractionDigits: a < 10 ? 2 : 1}),
  pctText: p => p > 0 && p < 0.1 ? '<0.1%' : p.toLocaleString('en-US', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + '%',
  headline(res) { return res.state === 'overlap' ? this.acres(res.overlapAcres) + ' acres (' + this.pctText(res.pct) + ' of the lot) overlap mapped wetlands' : res.state === 'none' ? 'No mapped overlap' : 'Wetlands data unavailable'; },
  fill(box, res) {
    const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
    box.querySelectorAll('.wlbody').forEach(x => x.remove()); const body = mk('div', 'wlbody'); box.appendChild(body);
    const link = (txt, href) => { const a = mk('a', '', txt); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; };
    if (res.state === 'unavailable') {
      body.appendChild(mk('p', 'notice', 'Wetlands data unavailable'));
      body.appendChild(mk('p', 'small muted', res.why === 'nooutline' ? 'This lot has no verified boundary on the state parcel map, so it cannot be checked against the wetlands map.' : res.why === 'coverage' ? 'The National Wetlands Inventory does not show digital mapping for this whole lot.' : 'The wetlands service did not answer.'));
      if (res.why === 'lookup') { const b = mk('button', 'btn small ghost', 'Try again'); b.type = 'button'; b.addEventListener('click', () => box._retry && box._retry()); body.appendChild(b); }
    } else {
      body.appendChild(mk('p', 'wlval', this.headline(res)));
      if (res.state === 'overlap') {
        body.appendChild(mk('p', 'small', 'Lot about ' + this.acres(res.parcelAcres) + ' acres. Overlap is the area of the lot outline that falls inside mapped wetland polygons.'));
        if (res.types && res.types.length) { const ul = mk('ul', 'wltypes small'); res.types.forEach(t => ul.appendChild(mk('li', '', t.type + ': ' + this.acres(t.acres) + ' acres'))); body.appendChild(ul); }
      } else body.appendChild(mk('p', 'small', 'The National Wetlands Inventory is digitally mapped for this lot and none of its mapped wetland polygons touch the lot outline.'));
    }
    body.appendChild(mk('p', 'small muted', 'Map-based screening estimate only. NWI is built from aerial imagery of varying age, is not a wetland delineation, and does not decide what may be built or whether a permit is needed. Check with the local government and the water management district before you bid.'));
    const src = mk('p', 'small muted'); src.append('Source: U.S. Fish & Wildlife Service, ', link('National Wetlands Inventory web mapping services', this.SRC), ' (', link('open the Wetlands Mapper', this.MAPPER), ').' + (res.queried ? ' Checked ' + res.queried + '.' : '')); body.appendChild(src);
  },
  section(l, r) {
    const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
    const box = mk('div', 'precord wlbox'); box.appendChild(mk('h4', '', 'Mapped Wetlands'));
    const run = () => { box.querySelectorAll('.wlbody').forEach(x => x.remove()); box.appendChild(mk('p', 'small muted wlbody', 'Checking the National Wetlands Inventory…')); this.get(l, r).then(res => this.fill(box, res)); };
    box._retry = run; run(); return box;
  },
  mapAttach(L, m, box, l, r) {
    const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
    const dlg = box.closest('dialog') || box.parentNode; let old = dlg.querySelector('.wlbar'); if (old) old.remove();
    const bar = mk('p', 'clbar wlbar small'), b = mk('button', 'btn small ghost', 'Show wetlands overlap'); b.type = 'button'; b.setAttribute('aria-pressed', 'false'); const st = mk('span', 'small muted', ''); st.setAttribute('role', 'status'); bar.append(b, ' ', st);
    box.after(bar); let layer = null;
    b.addEventListener('click', async () => {
      if (layer && m.hasLayer(layer)) { m.removeLayer(layer); b.setAttribute('aria-pressed', 'false'); b.textContent = 'Show wetlands overlap'; st.textContent = ''; return; }
      b.disabled = true; st.textContent = 'Checking the National Wetlands Inventory…'; const res = await this.get(l, r); b.disabled = false;
      if (res.state === 'unavailable') { st.textContent = 'Wetlands data unavailable'; return; }
      if (res.state === 'none') { st.textContent = 'No mapped overlap'; return; }
      layer = L.geoJSON({type: 'Feature', properties: {}, geometry: {type: 'MultiPolygon', coordinates: res.geom}}, {style: {color: '#1d4ed8', weight: 1, fillColor: '#3b82f6', fillOpacity: 0.55}, interactive: false}).addTo(m);
      if (box._outline && box._outline.bringToFront) box._outline.bringToFront();
      b.setAttribute('aria-pressed', 'true'); b.textContent = 'Hide wetlands overlap'; st.textContent = 'Blue = part of the lot inside mapped wetlands: ' + this.acres(res.overlapAcres) + ' acres, ' + this.pctText(res.pct) + ' of the lot (screening estimate).';
    });
  }
};
// Flood Zone: FEMA National Flood Hazard Layer zones intersected with the FULL verified lot outline (server side, /.netlify/functions/flood).
// A map-based screening estimate, not a flood determination. Missing FEMA coverage, a lookup failure or no verified boundary is "Flood zone unavailable".
const FloodData = {
  SRC: 'https://www.fema.gov/flood-maps/national-flood-hazard-layer', MSC: 'https://msc.fema.gov/portal/home', mem: {},
  COLOR: {high: '#ef4444', moderate: '#f59e0b'},
  async get(l, r) {
    if (!r || r.st !== 'matched' || !r.g || !r.g.length) return {state: 'unavailable', why: 'nooutline'};
    const key = JSON.stringify(r.g); if (this.mem[key]) return this.mem[key];
    let out; try {
      const c = new AbortController(), t = setTimeout(() => c.abort(), 30000);
      const res = await fetch('/.netlify/functions/flood', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({rings: r.g}), signal: c.signal}).finally(() => clearTimeout(t));
      const d = await res.json();
      if (d && d.ok === true && Array.isArray(d.zones) && d.zones.length && Array.isArray(d.geom) && isFinite(d.sfhaPct)) out = Object.assign({state: 'ok'}, d);
      else out = {state: 'unavailable', why: d && d.reason === 'coverage' ? 'coverage' : 'lookup'};
    } catch (e) { out = {state: 'unavailable', why: 'lookup'}; }
    if (out.why !== 'lookup') this.mem[key] = out; return out;
  },
  pctText: p => p > 0 && p < 0.1 ? '<0.1%' : p.toLocaleString('en-US', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + '%',
  acres: a => a < 0.01 ? '<0.01' : a.toLocaleString('en-US', {minimumFractionDigits: a < 10 ? 2 : 1, maximumFractionDigits: a < 10 ? 2 : 1}),
  RISK: {high: 'high risk (Special Flood Hazard Area)', moderate: 'moderate risk', minimal: 'minimal hazard', undetermined: 'flood hazard not determined', water: 'open water'},
  zoneName(z) { return 'Zone ' + z.zone + (z.subty ? ' (' + z.subty.toLowerCase() + ')' : '') + ' – ' + (this.RISK[z.risk] || ''); },
  headline(res) {
    if (res.sfhaPct > 0) return 'Part of this lot is in a FEMA high-risk flood zone (Special Flood Hazard Area): ' + this.pctText(res.sfhaPct) + ' of the lot';
    if (res.modPct > 0) return 'No high-risk flood zone mapped. ' + this.pctText(res.modPct) + ' of the lot is in a moderate-risk zone';
    const z = res.zones[0]; return 'Mapped as Zone ' + z.zone + (z.risk === 'minimal' ? ' (minimal flood hazard)' : '') + ': ' + this.RISK[z.risk];
  },
  fill(box, res) {
    const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
    box.querySelectorAll('.fzbody').forEach(x => x.remove()); const body = mk('div', 'fzbody'); box.appendChild(body);
    const link = (txt, href) => { const a = mk('a', '', txt); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; };
    if (res.state !== 'ok') {
      body.appendChild(mk('p', 'notice', 'Flood zone unavailable'));
      body.appendChild(mk('p', 'small muted', res.why === 'nooutline' ? 'This lot has no verified boundary on the state parcel map, so it cannot be checked against the flood map.' : res.why === 'coverage' ? 'FEMA’s digital flood map does not cover this whole lot.' : 'The FEMA flood map service did not answer.'));
      if (res.why === 'lookup') { const b = mk('button', 'btn small ghost', 'Try again'); b.type = 'button'; b.addEventListener('click', () => box._retry && box._retry()); body.appendChild(b); }
    } else {
      body.appendChild(mk('p', 'fzval' + (res.sfhaPct > 0 ? ' fzhigh' : ''), this.headline(res)));
      const ul = mk('ul', 'fztypes small'); res.zones.forEach(z => ul.appendChild(mk('li', '', this.zoneName(z) + ': ' + this.pctText(z.pct) + ' of the lot (' + this.acres(z.acres) + ' acres)' + (z.bfe != null ? '; base flood elevation ' + z.bfe + ' ft' : '') + (z.depth != null && z.depth > 0 ? '; depth ' + z.depth + ' ft' : '')))); body.appendChild(ul);
      body.appendChild(mk('p', 'small', 'Zones A, AE, AH, AO, V and VE are FEMA’s 1%-annual-chance (“100-year”) floodplain, where flood insurance is normally required with a federally backed mortgage. Shaded Zone X is the 0.2% (“500-year”) floodplain or an area protected by a levee. Other Zone X is outside both.'));
    }
    body.appendChild(mk('p', 'small muted', 'Map-based screening estimate only, not a flood determination or elevation certificate. Flood maps can be out of date or changed by a LOMA or LOMR, and this is not insurance or lending advice. Check the official FEMA map and ask an insurance agent and the local floodplain office before you bid.'));
    const src = mk('p', 'small muted'); src.append('Source: FEMA, ', link('National Flood Hazard Layer', this.SRC), ' (', link('open the FEMA Flood Map Service Center', this.MSC), ').' + (res.state === 'ok' ? (res.panelEff ? ' Flood map panel effective ' + res.panelEff + '.' : '') + ' Checked ' + res.queried + '.' : '')); body.appendChild(src);
  },
  section(l, r) {
    const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
    const box = mk('div', 'precord fzbox'); box.appendChild(mk('h4', '', 'Flood Zone'));
    const run = () => { box.querySelectorAll('.fzbody').forEach(x => x.remove()); box.appendChild(mk('p', 'small muted fzbody', 'Checking the FEMA flood map…')); this.get(l, r).then(res => this.fill(box, res)); };
    box._retry = run; run(); return box;
  },
  mapAttach(L, m, box, l, r) {
    const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
    const dlg = box.closest('dialog') || box.parentNode; let old = dlg.querySelector('.fzbar'); if (old) old.remove();
    const bar = mk('p', 'clbar fzbar small'), b = mk('button', 'btn small ghost', 'Show flood zones'); b.type = 'button'; b.setAttribute('aria-pressed', 'false'); const st = mk('span', 'small muted', ''); st.setAttribute('role', 'status'); bar.append(b, ' ', st);
    box.after(bar); let layer = null;
    b.addEventListener('click', async () => {
      if (layer && m.hasLayer(layer)) { m.removeLayer(layer); b.setAttribute('aria-pressed', 'false'); b.textContent = 'Show flood zones'; st.textContent = ''; return; }
      b.disabled = true; st.textContent = 'Checking the FEMA flood map…'; const res = await this.get(l, r); b.disabled = false;
      if (res.state !== 'ok') { st.textContent = 'Flood zone unavailable'; return; }
      if (!res.geom.length) { st.textContent = 'Whole lot is mapped as ' + this.RISK[res.zones[0].risk] + ' (Zone ' + res.zones[0].zone + '); nothing to shade.'; return; }
      layer = L.layerGroup(res.geom.map(g => L.geoJSON({type: 'Feature', properties: {}, geometry: {type: 'MultiPolygon', coordinates: g.geom}}, {style: {color: this.COLOR[g.risk], weight: 1, fillColor: this.COLOR[g.risk], fillOpacity: 0.45}}).bindPopup('<b>Zone ' + g.zone + '</b>' + (g.subty ? '<br>' + g.subty.toLowerCase() : '') + '<br>' + (this.RISK[g.risk] || '')))).addTo(m);
      if (box._outline && box._outline.bringToFront) box._outline.bringToFront();
      b.setAttribute('aria-pressed', 'true'); b.textContent = 'Hide flood zones'; st.textContent = 'Red = high-risk zone (SFHA), amber = moderate-risk zone; unshaded = minimal hazard (screening estimate).';
    });
  }
};
// Active Weather Alerts: current National Weather Service alerts at ONE point inside the verified lot outline (same point as the elevation sample), via
// /.netlify/functions/weather (the backend calls api.weather.gov with an identifying User-Agent and caches briefly). Temporary information, kept apart from
// the permanent flood-zone section. "No active alerts" only after a successful lookup with zero results; any failure is "Weather alerts unavailable".
const WeatherData = {
  DOCS: 'https://www.weather.gov/documentation/services-web-api', mem: {},
  async get(l, r) {
    if (!r || r.st !== 'matched' || !r.g || !r.bb) return {state: 'unavailable', why: 'nooutline'};
    const pt = ElevationData.point(r); if (!pt) return {state: 'unavailable', why: 'nooutline'};
    const key = pt.lat + ',' + pt.lng, hit = this.mem[key]; if (hit && Date.now() - hit.t < 60000) return hit.v;
    let out; try {
      const c = new AbortController(), t = setTimeout(() => c.abort(), 15000);
      const res = await fetch('/.netlify/functions/weather?lat=' + pt.lat + '&lng=' + pt.lng, {signal: c.signal}).finally(() => clearTimeout(t));
      const d = await res.json();
      out = d && d.ok === true && Array.isArray(d.alerts) ? {state: 'ok', pt, alerts: d.alerts, pageLink: d.pageLink, queried: d.queried} : {state: 'unavailable', why: 'lookup'};
    } catch (e) { out = {state: 'unavailable', why: 'lookup'}; }
    if (out.state === 'ok') this.mem[key] = {t: Date.now(), v: out}; return out;
  },
  when(iso) { const d = new Date(iso); return isFinite(d) ? d.toLocaleString('en-US', {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'}) : ''; },
  fill(box, res) {
    const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
    box.querySelectorAll('.wxbody').forEach(x => x.remove()); const body = mk('div', 'wxbody'); box.appendChild(body);
    const link = (txt, href) => { const a = mk('a', '', txt); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; };
    if (res.state !== 'ok') {
      body.appendChild(mk('p', 'notice', 'Weather alerts unavailable'));
      body.appendChild(mk('p', 'small muted', res.why === 'nooutline' ? 'This lot has no verified boundary on the state parcel map, so there is no point inside it to look up.' : 'The National Weather Service did not answer.'));
      if (res.why === 'lookup') { const b = mk('button', 'btn small ghost', 'Try again'); b.type = 'button'; b.addEventListener('click', () => box._retry && box._retry()); body.appendChild(b); }
    } else if (!res.alerts.length) {
      body.appendChild(mk('p', 'wxnone', 'No active alerts'));
      body.appendChild(mk('p', 'small muted', 'The National Weather Service reports no active watches, warnings or advisories at the marked point.'));
    } else {
      const ul = mk('ul', 'wxlist');
      res.alerts.forEach(a => { const li = mk('li', 'wxalert wx-' + String(a.severity || 'none').toLowerCase()); li.appendChild(mk('b', '', a.event));
        li.appendChild(mk('span', 'small', (a.expires ? ' – expires ' + this.when(a.expires) : '') + (a.severity ? ' · ' + a.severity : ''))); if (a.headline) li.appendChild(mk('div', 'small muted', a.headline));
        const d = mk('div', 'small'); d.appendChild(link('Official NWS alert', a.link)); li.appendChild(d); ul.appendChild(li); });
      body.appendChild(ul);
    }
    const note = mk('p', 'small muted'); note.append('Temporary alerts for the marked point only; they change by the hour and are not part of the lot’s permanent flood-zone data. Source: National Weather Service, ', link('weather.gov', res.pageLink || 'https://www.weather.gov/'), ' (', link('API documentation', this.DOCS), ').' + (res.queried ? ' Checked ' + this.when(res.queried) + '.' : '')); body.appendChild(note);
    if (res.state === 'ok') { const b = mk('button', 'btn small ghost', 'Refresh'); b.type = 'button'; b.addEventListener('click', () => { delete this.mem[res.pt.lat + ',' + res.pt.lng]; box._retry && box._retry(); }); body.appendChild(b); }
  },
  section(l, r) {
    const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
    const box = mk('div', 'precord wxbox'); box.appendChild(mk('h4', '', 'Active Weather Alerts')); box.appendChild(mk('p', 'small muted', 'Temporary. Separate from the flood-zone information above.'));
    const run = () => { box.querySelectorAll('.wxbody').forEach(x => x.remove()); box.appendChild(mk('p', 'small muted wxbody', 'Checking the National Weather Service…')); this.get(l, r).then(res => this.fill(box, res)); };
    box._retry = run; run(); return box;
  },
  // one status line under the lot map
  mapAttach(L, m, box, l, r) {
    const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
    const dlg = box.closest('dialog') || box.parentNode; let old = dlg.querySelector('.wxbar'); if (old) old.remove();
    const bar = mk('p', 'clbar wxbar small'); bar.setAttribute('role', 'status'); bar.textContent = 'Weather alerts: checking…'; box.after(bar);
    this.get(l, r).then(res => {
      if (res.state !== 'ok') { bar.textContent = 'Weather alerts unavailable'; return; }
      if (!res.alerts.length) { bar.textContent = 'Weather alerts at the marked point: No active alerts'; return; }
      bar.textContent = 'Active weather alerts at the marked point: '; res.alerts.forEach((a, i) => { if (i) bar.append('; '); const x = document.createElement('a'); x.textContent = a.event; x.href = a.link; x.target = '_blank'; x.rel = 'noopener noreferrer'; bar.append(x, a.expires ? ' (expires ' + this.when(a.expires) + ')' : ''); });
    });
  }
};
// Soil Type: USDA NRCS SSURGO soil map units intersected with the FULL verified lot outline (server side, /.netlify/functions/soil, USDA Soil Data Access).
// A map-based screening summary, not a soil test. No verified boundary, no survey coverage or a failed lookup is "Soil data unavailable".
const SoilData = {
  WSS: 'https://websoilsurvey.nrcs.usda.gov/app/', SDA: 'https://sdmdataaccess.sc.egov.usda.gov/', mem: {},
  async get(l, r) {
    if (!r || r.st !== 'matched' || !r.g || !r.g.length) return {state: 'unavailable', why: 'nooutline'};
    const key = JSON.stringify(r.g); if (this.mem[key]) return this.mem[key];
    let out; try {
      const c = new AbortController(), t = setTimeout(() => c.abort(), 25000);
      const res = await fetch('/.netlify/functions/soil', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({rings: r.g}), signal: c.signal}).finally(() => clearTimeout(t));
      const d = await res.json();
      if (d && d.ok === true && Array.isArray(d.units) && d.units.length) out = Object.assign({state: 'ok'}, d);
      else out = {state: 'unavailable', why: d && d.reason === 'coverage' ? 'coverage' : 'lookup'};
    } catch (e) { out = {state: 'unavailable', why: 'lookup'}; }
    if (out.why !== 'lookup') this.mem[key] = out; return out;
  },
  pctText: p => p > 0 && p < 0.1 ? '<0.1%' : p.toLocaleString('en-US', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + '%',
  acres: a => a < 0.01 ? '<0.01' : a.toLocaleString('en-US', {minimumFractionDigits: a < 10 ? 2 : 1, maximumFractionDigits: a < 10 ? 2 : 1}),
  facts(u) {
    const f = [];
    if (u.drainage) f.push('Drainage: ' + u.drainage);
    if (u.hydgrp) f.push('Hydrologic group ' + u.hydgrp);
    if (u.hydricPct != null) f.push('Hydric (wetland-type) soil: about ' + u.hydricPct + '% of the map unit');
    if (u.flood) f.push('Flooding: ' + u.flood.toLowerCase());
    if (u.pond != null && u.pond > 0) f.push('Ponding: ' + u.pond + '% of the map unit');
    if (u.wtFt != null) f.push('Shallowest yearly water table: about ' + u.wtFt + ' ft down');
    if (u.bedrockFt != null) f.push('Bedrock: about ' + u.bedrockFt + ' ft down');
    if (u.septic) f.push('Septic tank fields: ' + u.septic.toLowerCase());
    if (u.dwellings) f.push('Houses without basements: ' + u.dwellings.toLowerCase());
    return f;
  },
  fill(box, res) {
    const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
    box.querySelectorAll('.sobody').forEach(x => x.remove()); const body = mk('div', 'sobody'); box.appendChild(body);
    const link = (txt, href) => { const a = mk('a', '', txt); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; };
    if (res.state !== 'ok') {
      body.appendChild(mk('p', 'notice', 'Soil data unavailable'));
      body.appendChild(mk('p', 'small muted', res.why === 'nooutline' ? 'This lot has no verified boundary on the state parcel map, so it cannot be matched to the soil map.' : res.why === 'coverage' ? 'The USDA soil survey has no mapped soil for this lot.' : 'The USDA soil service did not answer.'));
      if (res.why === 'lookup') { const b = mk('button', 'btn small ghost', 'Try again'); b.type = 'button'; b.addEventListener('click', () => box._retry && box._retry()); body.appendChild(b); }
    } else {
      const top = res.units[0];
      if (res.units.length > 1) body.appendChild(mk('p', 'soval', 'Mostly ' + top.name + ' (' + this.pctText(top.pct) + ' of the lot)')), body.appendChild(mk('p', 'small', 'This lot touches ' + res.units.length + ' mapped soil units. Shares below are the part of the lot outline inside each one.'));
      res.units.forEach(u => { const d = mk('div', 'sounit'); d.appendChild(mk('b', '', u.name)); d.appendChild(mk('div', 'small', this.pctText(u.pct) + ' of the lot (' + this.acres(u.acres) + ' acres)' + (u.musym ? ' · map symbol ' + u.musym : '')));
        const f = this.facts(u); if (f.length) { const ul = mk('ul', 'sofacts small'); f.forEach(x => ul.appendChild(mk('li', '', x))); d.appendChild(ul); } body.appendChild(d); });
      if (res.coveredPct < 98) body.appendChild(mk('p', 'small muted', 'The soil survey covers about ' + this.pctText(res.coveredPct) + ' of this lot; the rest is not mapped.'));
    }
    body.appendChild(mk('p', 'small muted', 'Map-based screening summary only. Soil map units are drawn at county scale and can contain other soils, and “Urban land” units are partly paved or built over. It is not a soil test, a percolation test or an engineering report. For septic, wells or a foundation, ask the county health department or a soil scientist.'));
    const src = mk('p', 'small muted'); src.append('Source: USDA Natural Resources Conservation Service, SSURGO soil survey via ', link('Soil Data Access', this.SDA), ' (', link('open Web Soil Survey', this.WSS), ').' + (res.queried ? ' Checked ' + res.queried + '.' : '')); body.appendChild(src);
  },
  section(l, r) {
    const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
    const box = mk('div', 'precord sobox'); box.appendChild(mk('h4', '', 'Soil Type'));
    const run = () => { box.querySelectorAll('.sobody').forEach(x => x.remove()); box.appendChild(mk('p', 'small muted sobody', 'Checking the USDA soil survey…')); this.get(l, r).then(res => this.fill(box, res)); };
    box._retry = run; run(); return box;
  }
};
// Estimated Ground Elevation: ONE point inside the verified lot outline (the point farthest from the edges), looked up in feet from the free USGS
// Elevation Point Query Service (longitude = x, latitude = y). A single-point estimate, cached by sampled coordinates.
const ElevationData = {
  URL: 'https://epqs.nationalmap.gov/v1/json', DOCS: 'https://epqs.nationalmap.gov/v1/docs', TTL: 90 * 864e5, mem: {}, pending: {},
  // pole of inaccessibility (Mapbox "polylabel" method) in local metres; guaranteed inside even for L-shaped lots and lots with holes
  point(r) {
    const rings = r.g, xs = rings.flat().map(q => q[0]), ys = rings.flat().map(q => q[1]), lng0 = (Math.min(...xs) + Math.max(...xs)) / 2, lat0 = (Math.min(...ys) + Math.max(...ys)) / 2, k = Math.cos(lat0 * Math.PI / 180);
    const R = rings.map(ring => ring.map(q => [(q[0] - lng0) * k * 111320, (q[1] - lat0) * 110574]));
    const sd = (x, y) => { let inside = false, d = Infinity; R.forEach(ring => { for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[i], b = ring[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside; const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L)) : 0; d = Math.min(d, Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy)); } }); return inside ? d : -d; };
    const px = R.flat().map(q => q[0]), py = R.flat().map(q => q[1]), minX = Math.min(...px), maxX = Math.max(...px), minY = Math.min(...py), maxY = Math.max(...py), w = maxX - minX, h = maxY - minY, size = Math.min(w, h) || Math.max(w, h) || 1;
    const cell = (x, y, hh) => { const d = sd(x, y); return {x, y, h: hh, d, max: d + hh * Math.SQRT2}; };
    let q = [], hh = size / 2; for (let x = minX; x < maxX; x += size) for (let y = minY; y < maxY; y += size) q.push(cell(x + hh, y + hh, hh));
    let best = cell((minX + maxX) / 2, (minY + maxY) / 2, 0); q.forEach(c => { if (c.d > best.d) best = c; });
    let guard = 0; while (q.length && guard++ < 6000) { q.sort((a, b) => b.max - a.max); const c = q.shift(); if (c.d > best.d) best = c; if (c.max - best.d <= 0.25) continue; const h2 = c.h / 2; [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([dx, dy]) => q.push(cell(c.x + dx * h2, c.y + dy * h2, h2))); }
    if (!(best.d > 0)) return null;   // no point verified to be inside the outline
    return {lng: Number((lng0 + best.x / (k * 111320)).toFixed(6)), lat: Number((lat0 + best.y / 110574).toFixed(6)), edgeFt: best.d * 3.28084};
  },
  keyOf: pt => pt.lng.toFixed(6) + ',' + pt.lat.toFixed(6),
  apiUrl: pt => ElevationData.URL + '?x=' + pt.lng + '&y=' + pt.lat + '&wkid=4326&units=Feet&includeDate=false',
  readCache(k) { if (this.mem[k]) return this.mem[k]; try { const v = JSON.parse(localStorage.getItem('ppa_epqs:' + k) || 'null'); if (v && Date.now() - v.t < this.TTL) return (this.mem[k] = v.d); } catch (e) {} return null; },
  writeCache(k, d) { this.mem[k] = d; try { localStorage.setItem('ppa_epqs:' + k, JSON.stringify({t: Date.now(), d})); } catch (e) {} },
  async query(pt) {
    const k = this.keyOf(pt), hit = this.readCache(k); if (hit) return Object.assign({cached: true}, hit);
    if (this.pending[k]) return this.pending[k];
    return this.pending[k] = (async () => {
      try {
        for (let a = 0; a < 2; a++) {
          const c = new AbortController(), t = setTimeout(() => c.abort(), 12000);
          try { const r = await fetch(this.apiUrl(pt), {signal: c.signal}); if (!r.ok) throw new Error('http'); const d = await r.json(), v = Number(d.value);
            if (!isFinite(v) || v <= -1000 || d.value === '' || d.value == null) return null;   // USGS answers with a no-data code outside its coverage
            const out = {ft: v, res: d.resolution || null, raster: d.rasterId || null}; this.writeCache(k, out); return out; }
          catch (e) { if (a) throw e; } finally { clearTimeout(t); }
        }
      } catch (e) { return null; } finally { delete this.pending[k]; }
    })();
  },
  // resolves {state:'ok', pt, ft, res, cached} | {state:'failed', pt} | {state:'nooutline'}
  async get(l, r) {
    if (!r || r.st !== 'matched' || !r.g || !r.bb) return {state: 'nooutline'};
    const pt = this.point(r); if (!pt) return {state: 'nooutline'};
    const d = await this.query(pt); return d ? Object.assign({state: 'ok', pt}, d) : {state: 'failed', pt};
  },
  fill(box, res) {
    const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
    box.querySelectorAll('.elbody').forEach(x => x.remove()); const body = mk('div', 'elbody'); box.appendChild(body);
    if (res.state !== 'ok') { body.appendChild(mk('p', 'notice', 'Elevation unavailable')); body.appendChild(mk('p', 'small muted', res.state === 'nooutline' ? 'This lot has no verified boundary on the state parcel map, so no sample point can be chosen inside it.' : 'The USGS elevation service did not answer.')); if (res.state === 'failed') { const b = mk('button', 'btn small ghost', 'Try again'); b.type = 'button'; b.addEventListener('click', () => box._retry && box._retry()); body.appendChild(b); } return; }
    const big = mk('p', 'elval'); big.append(mk('b', '', (Math.round(res.ft * 10) / 10).toLocaleString('en-US', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + ' ft'), mk('span', 'small', ' estimated ground elevation')); body.appendChild(big);
    body.appendChild(mk('p', 'small', 'Single-point estimate: one sample at the marked point inside the lot (' + res.pt.lat.toFixed(5) + ', ' + res.pt.lng.toFixed(5) + '), about ' + Math.round(res.pt.edgeFt).toLocaleString('en-US') + ' ft from the nearest edge. It is not an average of the lot, a survey or a flood elevation. Ground can rise or fall across a lot, and fill or recent work may not be in the data.'));
    const src = mk('p', 'small muted'); src.append('Source: '); const a = mk('a', '', 'USGS Elevation Point Query Service'); a.href = this.apiUrl(res.pt); a.target = '_blank'; a.rel = 'noopener noreferrer'; src.append(a, ' (', (() => { const d = mk('a', '', 'API docs'); d.href = this.DOCS; d.target = '_blank'; d.rel = 'noopener noreferrer'; return d; })(), ')' + (res.res ? '; source grid cell about ' + Math.round(res.res * 111320 * 3.28084) + ' ft' : '') + (res.cached ? '; saved from an earlier lookup of these coordinates' : '') + '.'); body.appendChild(src);
  },
  section(l, r) {
    const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
    const box = mk('div', 'precord elbox'); box.appendChild(mk('h4', '', 'Estimated Ground Elevation'));
    const run = () => { box.querySelectorAll('.elbody').forEach(x => x.remove()); box.appendChild(mk('p', 'small muted elbody', 'Checking USGS…')); this.get(l, r).then(res => this.fill(box, res)); };
    box._retry = run; run(); return box;
  },
  // marker for the sampled point on the lot map
  mapAttach(L, m, box, l, r) {
    this.get(l, r).then(res => {
      if (res.state !== 'ok' || !m._container || !m._container.isConnected) return;
      const mk = L.circleMarker([res.pt.lat, res.pt.lng], {radius: 7, color: '#fff', weight: 3, fillColor: '#06b6d4', fillOpacity: 1}).addTo(m);
      mk.bindTooltip('Elevation sample: ' + (Math.round(res.ft * 10) / 10) + ' ft (single point)', {permanent: false, sticky: true}); mk.bindPopup('<b>Estimated ground elevation: ' + (Math.round(res.ft * 10) / 10) + ' ft</b><br>Single-point estimate at this spot, from the USGS Elevation Point Query Service.');
      box._elevMarker = mk;
    });
  }
};
// Florida property records from the parcel backfill (tools/fl-parcels/backfill.py): one JSON file per county.
const ParcelData = {
  base: '/liens/states/parcels/',
  cache: {},
  slug: c => String(c).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  load(county) {
    if (!this.cache[county]) this.cache[county] = fetch(this.base + this.slug(county) + '.json').then(r => r.ok ? r.json() : null).catch(() => null);
    return this.cache[county];
  },
  async rec(l) { if ((l.state || 'FL') !== 'FL') return {file: null, r: null}; const f = await this.load(l.county); return {file: f, r: f && f.p && f.p[l.parcel] || null}; },
  sizeText(r) { if (!r || !r.sqft) return ''; return (r.ac >= 0.1 ? r.ac.toFixed(2) : r.ac.toFixed(3)) + ' acres (' + r.sqft.toLocaleString('en-US') + ' sq ft)' + (r.aEst ? ', estimated from the mapped boundary' : ''); },
  geojson(r) { return {type: 'Feature', properties: {}, geometry: {type: 'Polygon', coordinates: r.g}}; },
  // SVG outline of the stored boundary, used when no aerial is available.
  svg(r) {
    const NS = 'http://www.w3.org/2000/svg', [x0, y0, x1, y1] = r.bb, k = Math.cos((y0 + y1) / 2 * Math.PI / 180);
    const w = (x1 - x0) * k, h = (y1 - y0), s = Math.max(w * 1.5, h) * 1.25 || 1, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const P = ([x, y]) => (((x - cx) * k / s) * 300 + 150).toFixed(1) + ',' + ((-(y - cy) / s) * 300 + 100).toFixed(1);
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 300 200'); svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(NS, 'path'); path.setAttribute('d', r.g.map(ring => 'M' + ring.map(P).join('L') + 'Z').join(' ')); path.setAttribute('class', 'mpoly'); svg.appendChild(path); return svg;
  },
  thumb(l, host) {
    host.textContent = ''; host.className = 'lthumb loading';
    this.rec(l).then(({file, r}) => {
      host.classList.remove('loading'); const cap = document.createElement('p'); cap.className = 'lcap small';
      const ca = r && r.st === 'matched' && r.g && CountyAerial.enabled(l.county) && r.aer && r.aer.y ? CountyAerial.CFG[l.county].sources.find(x => x.year === r.aer.y) : null;
      if (ca) {
        const t = CountyAerial.thumbEl(l, r, ca); host.appendChild(t.wrap); const size = this.sizeText(r) ? 'Lot: ' + this.sizeText(r) + ' \u00b7 ' : '';
        cap.textContent = size + 'Aerial: ' + CountyAerial.CFG[l.county].name + ' ' + ca.year + ' (county layer) \u00b7 outline: Florida Statewide Parcels 2026';
        t.im.onerror = () => { t.wrap.remove(); if (r.img && r.img.s === 'aerial') { const im = document.createElement('img'); im.width = 480; im.height = 320; im.alt = 'Aerial photo of parcel ' + l.parcel + ' with its boundary outlined'; im.src = this.base + 'img/' + r.img.f; host.prepend(im); cap.textContent = size + 'County aerial did not load; showing USGS NAIP, ' + r.img.d.slice(0, 7); } else { host.prepend(this.mapBox(r)); cap.textContent = size + 'County aerial did not load'; } };
      } else if (r && r.st === 'matched' && r.img && r.img.s === 'aerial') {
        const im = document.createElement('img'); im.loading = 'lazy'; im.decoding = 'async'; im.width = 480; im.height = 320; im.alt = 'Aerial photo of parcel ' + l.parcel + ' with its boundary outlined';
        im.src = this.base + 'img/' + r.img.f; im.onerror = () => { im.remove(); host.prepend(this.mapBox(r)); cap.textContent = (this.sizeText(r) ? 'Lot: ' + this.sizeText(r) + ' · ' : '') + 'Aerial could not load'; };
        host.appendChild(im); cap.textContent = (this.sizeText(r) ? 'Lot: ' + this.sizeText(r) + ' · ' : '') + 'Aerial: USGS NAIP, ' + r.img.d.slice(0, 7);
      } else if (r && r.st === 'matched' && r.g) {
        host.appendChild(this.mapBox(r)); cap.textContent = (this.sizeText(r) ? 'Lot: ' + this.sizeText(r) + ' · ' : '') + 'No usable aerial for this lot';
      } else {
        const u = document.createElement('div'); u.className = 'lnoimg'; u.textContent = 'Image unavailable'; host.appendChild(u);
        cap.textContent = r ? (r.kind === 'mineral' ? 'Mineral or subsurface rights only: there is no surface lot to picture.' : r.kind === 'condo' ? 'Condo unit: units are not mapped separately, so the location is not verified.' : r.st === 'ambiguous' ? 'Parcel ID needs review, so the location is not verified.' : r.st === 'unmatched' ? 'Parcel ID not found in the statewide roll. Flagged for review.' : 'Not checked yet.') : (file ? 'Not checked yet.' : 'Property records not loaded for this county yet.');
      }
      host.appendChild(cap);
    });
  },
  mapBox(r) { const d = document.createElement('div'); d.className = 'lmapprev'; d.appendChild(this.svg(r)); const b = document.createElement('span'); b.className = 'lbadge'; b.textContent = 'Map preview'; d.appendChild(b); return d; },
  // The public-record panel shown with "Show on map".
  panel(l, file, r) {
    const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
    const box = mk('div', 'precord');
    if (!r || r.st !== 'matched') { box.appendChild(mk('p', 'small muted', r ? (r.note || 'This parcel ID could not be matched to the statewide roll.') + ' Flagged for review.' : 'No property record loaded for this parcel yet.')); return box; }
    const S = file.sources, money = n => n == null ? '' : '$' + Math.round(n).toLocaleString('en-US');
    const link = (o, extra) => { const p = mk('p', 'small psrc'); p.append('Source: '); const a = mk('a', '', o.name); a.href = o.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; p.appendChild(a); if (extra) p.append(' · ' + extra); return p; };
    box.appendChild(mk('h4', '', 'Public record'));
    const dl = mk('dl', 'pfacts'), row = (k, v) => { if (v === '' || v == null) return; const d = mk('div'); d.append(mk('dt', '', k), mk('dd', '', v)); dl.appendChild(d); };
    row('Official parcel ID', r.pid + (r.pid !== l.parcel ? ' (list shows ' + l.parcel + ')' : ''));
    row('Current owner of record', r.own || 'Not published by the source');
    row('Property address', r.addr || 'No street address assigned');
    row('Lot size', this.sizeText(r) + (r.aEst ? '' : ' (reported by the county)'));
    row('Land use', (r.use || 'Not given') + (r.uc ? ' (DOR code ' + r.uc + ')' : ''));
    row('Just (market) value', money(r.jv)); row('Assessed value', money(r.av)); row('Tax roll year', r.yr);
    row('Short legal description (state roll)', r.legal);
    box.appendChild(dl);
    box.appendChild(link(S.parcels, 'statewide roll updated ' + (S.parcels.date || 'date not given') + '; checked ' + r.ck + '. Owner shown is the current owner on that roll, not necessarily the owner when the certificate was sold.'));
    box.appendChild(mk('h4', '', 'Land checks (whole lot boundary)'));
    const ul = mk('ul', 'pchecks'), li = (t, cls) => { ul.appendChild(mk('li', cls || '', t)); };
    const z = r.zn || {}; li(z.s === 'ok' ? 'Zoning: ' + z.v : 'Zoning: data unavailable' + (z.why ? ' (' + z.why + ')' : '') + '. Check with the county or city.', z.s === 'ok' ? '' : 'na');
    const f = r.fl || {}; li(f.s === 'ok' ? 'Flood: ' + f.z.map(q => 'Zone ' + q[0] + ' ' + q[1] + '%').join(', ') + (f.sfha > 0 ? ' · ' + f.sfha + '% of the lot is in a high-risk area' : ' · no high-risk overlap mapped') : 'Flood: data unavailable' + (f.why ? ' (' + f.why + ')' : ''), f.s !== 'ok' ? 'na' : f.sfha > 0 ? 'warn' : 'ok');
    const w = r.wt || {}; li(w.s === 'ok' ? 'Wetlands: ' + w.pct + '% of the lot (' + w.t.join(', ') + ')' : w.s === 'none' ? 'Wetlands: no mapped overlap' : 'Wetlands: data unavailable', w.s === 'ok' ? 'warn' : w.s === 'none' ? 'ok' : 'na');
    const d = r.rd || {}; li(d.s === 'ok' ? 'Road frontage (mapped): about ' + d.ft.toLocaleString('en-US') + ' ft' + (d.n && d.n.length ? ' along ' + d.n.join(', ') : '') + '. Legal access: unverified.' : d.s === 'none' ? 'Road frontage: no mapped road within about 65 ft. Legal access: unverified.' : 'Road frontage: data unavailable. Legal access: unverified.', d.s === 'ok' && d.ft > 0 ? '' : 'warn');
    { const tt = TrafficData.seg(r); li('Nearby Traffic: ' + TrafficData.text(r) + (tt ? ' (orange line on the map)' : ''), tt ? '' : 'na'); li('Legal road access: not verified. A traffic count does not show legal access.', 'na'); }
    box.appendChild(ul);
    const srcs = mk('p', 'small psrc'); srcs.append('Sources, checked ' + r.ck + ': ');
    ['flood', 'wetlands', 'roads', 'traffic', 'zoning'].forEach((k, i) => { const o = S[k]; if (!o) return; const a = mk('a', '', o.name); a.href = o.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; if (i) srcs.append(' · '); srcs.appendChild(a); });
    box.appendChild(srcs);
    if (r.img && r.img.s === 'aerial') { const p = mk('p', 'small psrc'); const a = mk('a', '', S.imagery.name); a.href = S.imagery.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; p.append('Aerial: ', a, ', captured ' + r.img.d + '.'); box.appendChild(p); }
    return box;
  }
};
const LienMap = {
  loaded: null,
  load() {
    if (this.loaded) return this.loaded;
    this.loaded = new Promise((res, rej) => {
      const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css'; document.head.appendChild(css);
      const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js'; s.onload = () => res(window.L); s.onerror = () => { this.loaded = null; rej(new Error('map library')); };
      document.head.appendChild(s);
    });
    return this.loaded;
  },
  async open(l) {
    const cfg = PARCEL_MAPS[l.county];
    let dlg = document.getElementById('lotdlg');
    if (!dlg) {
      dlg = document.createElement('dialog'); dlg.id = 'lotdlg'; dlg.className = 'lotdlg';
      dlg.innerHTML = '<div class="lothead"><b></b><button type="button" class="btn small" aria-label="Close map">Close</button></div><p class="lotmsg muted small" role="status"></p><div class="lotmap"></div><p class="lotfoot small"></p>';
      dlg.querySelector('button').addEventListener('click', () => dlg.close());
      dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
      document.body.appendChild(dlg);
    }
    const msg = dlg.querySelector('.lotmsg'), foot = dlg.querySelector('.lotfoot'), box = dlg.querySelector('.lotmap');
    dlg.querySelector('b').textContent = 'Parcel ' + l.parcel;
    msg.textContent = 'Loading the lot outline\u2026'; foot.textContent = '';
    { const hd = dlg.querySelector('.lothead'); let pl = hd.querySelector('.pfhead'); if (pl) pl.remove(); if (typeof PF !== 'undefined' && l.parcel) { pl = document.createElement('span'); pl.className = 'pfhead'; hd.insertBefore(pl, hd.lastElementChild); PF.cardButtons(l, pl, 'btn small ghost'); } }
    let fx = dlg.querySelector('.lotfacts'); if (!fx) { fx = document.createElement('p'); fx.className = 'lotfacts small'; msg.after(fx); } fx.textContent = '';
    if (cfg) { const pa = document.createElement('a'); pa.href = cfg.page(l.parcel); pa.target = '_blank'; pa.rel = 'noopener noreferrer'; pa.textContent = 'Look up the owner and tax history on the ' + cfg.pageName + ' site';
    foot.append(pa, ' \u00b7 '); }
    foot.append('Map data: county GIS, OpenStreetMap, Esri. Educational only; the outline is approximate and not a survey. Verify with the county.');
    if (!dlg.open) dlg.showModal();
    const pd = await ParcelData.rec(l);
    let pr = dlg.querySelector('.precord'); if (pr) pr.remove();
    if ((l.state || 'FL') === 'FL') { pr = ParcelData.panel(l, pd.file, pd.r); foot.before(pr); let hb = dlg.querySelector('.hoabox'); if (hb) hb.remove(); hb = await HoaData.panel(l); pr.after(hb); if (pd.r && pd.r.st === 'matched') { const cs = CleanupData.section(l, pd.r); hb.after(cs); const es = ElevationData.section(l, pd.r); cs.after(es); const ws = WetlandsData.section(l, pd.r); es.after(ws); const fs2 = FloodData.section(l, pd.r); ws.after(fs2); const ws2 = WeatherData.section(l, pd.r); fs2.after(ws2); ws2.after(SoilData.section(l, pd.r)); } }
    if (pd.r && pd.r.st === 'matched' && pd.r.g) {
      try {
        const L = await this.load();
        if (box._map) { box._map.remove(); box._map = null; }
        const m = L.map(box); box._map = m;
        const street = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'});
        const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {maxZoom: 19, attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics'});
        sat.addTo(m); const layersCtl = L.control.layers({'Satellite': sat, 'Street': street}).addTo(m);
        if (!CountyAerial.enabled(l.county)) { const lc = CountyAerial.labelControl(L, m); lc.set('Satellite: Esri World Imagery (capture dates vary)'); m.on('baselayerchange', e => lc.set(e.layer === street ? 'Street map: \u00a9 OpenStreetMap contributors' : 'Satellite: Esri World Imagery (capture dates vary)')); }
        const g = box._outline = L.geoJSON(ParcelData.geojson(pd.r), {style: {color: '#ffd166', weight: 3, fillColor: '#ffd166', fillOpacity: 0.18}}).addTo(m);
        { const tt = TrafficData.seg(pd.r); if (tt) { const road = L.layerGroup(tt.geo.map(pa => L.polyline(pa.map(q => [q[1], q[0]]), {color: '#ff7a00', weight: 7, opacity: 0.9, lineCap: 'round'}))).addTo(m); box._traffic = road;
            road.eachLayer(x => x.bindTooltip(TrafficData.fmt(tt.aadt) + ' vehicles/day (' + tt.yr + ') \u00b7 ' + TrafficData.fmt(tt.ft) + ' ft away', {sticky: true}));
            // the lot stays fully in view; when the road is within 500 ft the view widens to show both, otherwise a button does
            const both = () => { const bb = L.latLngBounds(box._outline.getBounds().getSouthWest(), box._outline.getBounds().getNorthEast()); road.eachLayer(x => bb.extend(x.getBounds())); m.fitBounds(bb, {maxZoom: 19, padding: [30, 30]}); }, lotOnly = () => m.fitBounds(box._outline.getBounds(), {maxZoom: 19, padding: [30, 30]});
            let bar = dlg.querySelector('.trbar'); if (bar) bar.remove(); bar = document.createElement('p'); bar.className = 'trbar small';
            const b1 = document.createElement('button'); b1.type = 'button'; b1.className = 'btn small ghost'; b1.textContent = 'Zoom to the lot'; b1.addEventListener('click', lotOnly);
            const b2 = document.createElement('button'); b2.type = 'button'; b2.className = 'btn small'; b2.textContent = 'Show the traffic road (orange)'; b2.addEventListener('click', both); bar.append(b2, ' ', b1); box.after(bar);
            if (tt.ft <= TrafficData.NEAR_FT) setTimeout(both, 80); } }
        if (CountyAerial.enabled(l.county)) CountyAerial.attach(L, m, box, l, pd.r, {sat, street}, layersCtl);
        CleanupData.mapAttach(L, m, box, l, pd.r);
        ElevationData.mapAttach(L, m, box, l, pd.r);
        WetlandsData.mapAttach(L, m, box, l, pd.r);
        FloodData.mapAttach(L, m, box, l, pd.r);
        WeatherData.mapAttach(L, m, box, l, pd.r);
        m.fitBounds(g.getBounds(), {maxZoom: 19, padding: [30, 30]});
        setTimeout(() => m.invalidateSize(), 50);
        box.dataset.pid = pd.r.pid;
        msg.textContent = 'Lot size: ' + ParcelData.sizeText(pd.r) + '. Outline from the Florida statewide parcel map; not a survey.';
        return;
      } catch (e) { /* fall through to the live county lookup */ }
    }
    if (!cfg && l.lat != null && typeof PF !== 'undefined') { try { await PF.pointMap(box, msg, l); return; } catch (e) { /* fall through */ } }
    if (!cfg) { msg.textContent = 'No map is available for this county yet.'; return; }
    try {
      const url = cfg.query + '?where=' + encodeURIComponent(cfg.idField + "='" + cfg.fmt(l.parcel).replace(/'/g, '') + "'") + '&outFields=' + (cfg.facts ? 'ACRES' : cfg.idField.split(' ').pop()) + '&outSR=4326&f=geojson';
      const furl = cfg.facts ? cfg.facts + '?where=' + encodeURIComponent("PARCEL_NUMBER='" + cfg.fmt(l.parcel).replace(/'/g, '') + "'") + '&outFields=PROPERTY_USE,MUNICIPALITY,TOTAL_MARKET,HMSTD_FLG,CONFID_FLG&f=json' : null;
      const [L, r, fr] = await Promise.all([this.load(), fetch(url).then(x => { if (!x.ok) throw new Error('lookup'); return x.json(); }), furl ? fetch(furl).then(x => x.json()).catch(() => null) : null]);
      const fa = fr && fr.features && fr.features[0] && fr.features[0].attributes;
      if (fa && fa.CONFID_FLG !== 'Y') {
        const bits = [];
        if (fa.PROPERTY_USE) bits.push('Use: ' + fa.PROPERTY_USE);
        if (fa.MUNICIPALITY) bits.push('Area: ' + fa.MUNICIPALITY);
        if (fa.TOTAL_MARKET != null) bits.push('County market value: $' + Number(fa.TOTAL_MARKET).toLocaleString());
        bits.push('Homestead: ' + (fa.HMSTD_FLG === 'Y' ? 'Yes' : 'No'));
        fx.textContent = bits.join(' \u00b7 ');
      }
      if (!r.features || !r.features.length) { msg.textContent = 'The county map has no outline for this parcel number. Use the property appraiser link below.'; return; }
      if (box._map) { box._map.remove(); box._map = null; }
      const m = L.map(box); box._map = m;
      const street = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'});
      const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {maxZoom: 19, attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics'});
      sat.addTo(m); L.control.layers({'Satellite': sat, 'Street': street}).addTo(m);
      const g = L.geoJSON(r, {style: {color: '#ff3b30', weight: 3, fillColor: '#ff3b30', fillOpacity: 0.25}}).addTo(m);
      m.fitBounds(g.getBounds(), {maxZoom: 19, padding: [30, 30]});
      setTimeout(() => m.invalidateSize(), 50);
      const ac = r.features[0].properties && r.features[0].properties.ACRES;
      msg.textContent = ac ? 'Lot size: about ' + Number(ac).toFixed(3) + ' acres (' + Math.round(ac * 43560).toLocaleString() + ' sq ft).' : '';
    } catch (e) {
      msg.textContent = 'Could not load the map right now. Use the property appraiser link below.';
    }
  }
};
// Favorites: a star next to the other lien buttons. Signed-in members keep favorites on their account.
const LienSave = {
  user: undefined, set: new Set(), ready: null,
  key: l => (l.county || '') + '|' + l.parcel,
  load() {
    if (!this.ready) this.ready = fetch('/.netlify/functions/account').then(r => r.json()).then(d => { this.user = d.user || null; ((d.user && d.user.saved) || []).forEach(x => this.set.add(this.key(x))); }).catch(() => { this.user = null; });
    return this.ready;
  },
  button(l, cls) {
    const b = document.createElement('button'); b.type = 'button'; b.className = cls || 'btn small ghost';
    const paint = () => { const on = this.set.has(this.key(l)); b.textContent = on ? '\u2605 Favorite' : '\u2606 Favorite'; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('faved', on); };
    paint(); this.load().then(paint);
    b.addEventListener('click', async () => {
      await this.load();
      if (!this.user) { location.href = '/login/?next=' + encodeURIComponent(location.pathname + location.search); return; }
      const on = this.set.has(this.key(l)); b.disabled = true;
      try {
        const body = on ? {action: 'unsave', parcel: l.parcel, county: l.county} : {action: 'save', parcel: l.parcel, county: l.county, use: l.use, face: l.amount != null ? l.amount : l.face, market: l.market, acres: l.acres, certList: l.certList || (l.cert ? [l.cert] : []), saleDate: l.saleDate};
        const r = await fetch('/.netlify/functions/account', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
        if (r.ok) { if (on) this.set.delete(this.key(l)); else this.set.add(this.key(l)); } else { const d = await r.json().catch(() => ({})); alert(d.error || 'Could not save. Please try again.'); }
      } catch (e) { alert('Could not save. Please try again.'); }
      b.disabled = false; paint();
    });
    return b;
  }
};
// Land Information: flood zone, wetlands, zoning, road access, size, utilities, easements.
// Read from official map services by /.netlify/functions/land. Anything not confirmed shows "Not Verified".
const LienLand = {
  LABELS: [['flood', 'FEMA flood zone and flood risk'], ['wetlands', 'Wetlands and environmental limits'], ['zoning', 'Zoning'], ['buildable', 'Buildability'], ['road', 'Road access (landlocked?)'], ['size', 'Acreage and dimensions'], ['water', 'Water'], ['sewer', 'Sewer'], ['power', 'Electricity'], ['easements', 'Easements and restrictions']],
  section(l) {
    const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
    const box = mk('div', 'landinfo'); box.appendChild(mk('h4', '', 'Land Information'));
    const st = mk('p', 'small muted', 'Checking official maps (FEMA, wetlands, county GIS)\u2026'); box.appendChild(st);
    const list = mk('dl', 'landlist'); box.appendChild(list);
    fetch('/.netlify/functions/land?county=' + encodeURIComponent(l.county || '') + '&parcel=' + encodeURIComponent(l.parcel)).then(r => r.json()).then(d => {
      if (d.error) { st.textContent = d.error; return; }
      st.textContent = d.matched === false ? 'This parcel was not found on the county map, so nothing could be checked automatically.' : 'See these before you fall in love with a cheap lot. Map data is a starting point, not a survey.';
      this.LABELS.forEach(([k, label]) => {
        const f = d.fields && d.fields[k]; if (!f) return;
        const row = mk('div', 'landrow' + (f.verified ? '' : ' nv'));
        row.appendChild(mk('dt', '', label));
        const dd = mk('dd'); dd.appendChild(mk('b', '', f.value));
        if (f.note) dd.appendChild(mk('span', 'small muted', ' ' + f.note));
        const src = mk('span', 'landsrc small muted');
        src.append('Source: ');
        if (f.url) { const a = mk('a', '', f.source || 'official record'); a.href = f.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; src.appendChild(a); } else src.append(f.source || 'none found');
        src.append(' \u00b7 Last checked ' + (f.checked || d.checked));
        dd.appendChild(src); row.appendChild(dd); list.appendChild(row);
      });
    }).catch(() => { st.textContent = 'Could not reach the official map services right now. Every item is Not Verified. Try again later.'; });
    return box;
  }
};
const LienBuy = {
  button(l, cls) {
    const g = typeof COUNTY_BUY !== 'undefined' && COUNTY_BUY[l.buyKey || l.county]; if (!g) return null;
    const b = document.createElement('button'); b.type = 'button'; b.className = cls || 'btn small'; b.textContent = 'How to buy'; b.addEventListener('click', () => this.open(l)); return b;
  },
  open(l) {
    const g = COUNTY_BUY[l.buyKey || l.county]; if (!g) return;
    let dlg = document.getElementById('buydlg');
    if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'buydlg'; dlg.className = 'lotdlg'; dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); }); document.body.appendChild(dlg); }
    dlg.textContent = '';
    const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
    const head = mk('div', 'lothead'); head.appendChild(mk('b', '', 'How to buy: ' + l.county + ' County parcel ' + l.parcel));
    const close = mk('button', 'btn small', 'Close'); close.type = 'button'; close.addEventListener('click', () => dlg.close()); head.appendChild(close); dlg.appendChild(head);
    dlg.appendChild(mk('p', 'notice small', g.status(l)));
    // things to have ready, each with a copy button
    const ready = mk('div', 'buyready'); dlg.appendChild(mk('h4', '', 'Have this ready when you contact the ' + (g.contactWho || 'county')));
    const items = [['Parcel number', l.parcel]];
    const certs = l.certList && l.certList.length ? l.certList : (l.cert ? [l.cert] : []);
    if (certs.length) items.push([certs.length > 1 ? 'Certificate numbers' : 'Certificate number', certs.join(', ')]);
    if (l.amount != null || l.face != null) items.push([g.amountLabel || 'Tax owed (face)', '$' + Number(l.amount != null ? l.amount : l.face).toFixed(2)]);
    items.forEach(([k, v]) => { const r = mk('div', 'buyrow'); r.append(mk('span', 'k', k), mk('b', '', v)); const c = mk('button', 'btn small ghost', 'Copy'); c.type = 'button'; c.addEventListener('click', async () => { try { await navigator.clipboard.writeText(v); c.textContent = 'Copied'; } catch (e) { c.textContent = 'Press and hold to copy'; } }); r.appendChild(c); ready.appendChild(r); });
    dlg.appendChild(ready);
    dlg.appendChild(LienLand.section(l));
    dlg.appendChild(mk('h4', '', 'Steps'));
    const ol = mk('ol', 'salesteps'); g.steps.forEach(t => ol.appendChild(mk('li', '', t))); dlg.appendChild(ol);
    const acts = mk('div', 'sact');
    if (g.record) { const a = mk('a', 'btn', g.record.label); a.href = g.record.url(l.parcel); a.target = '_blank'; a.rel = 'noopener noreferrer'; acts.appendChild(a); }
    g.links.forEach((k, i) => { const a = mk('a', 'btn ghost', k[0]); a.href = k[1]; a.target = '_blank'; a.rel = 'noopener noreferrer'; acts.appendChild(a); });
    if (g.phone) { const a = mk('a', 'btn ghost', 'Call ' + g.office + ' ' + g.phone); a.href = 'tel:' + g.phone.replace(/[^0-9]/g, ''); acts.appendChild(a); }
    acts.appendChild(LienSave.button(l, 'btn ghost'));
    dlg.appendChild(acts);
    dlg.appendChild(mk('p', 'small muted', 'We can\u2019t buy for you and can\u2019t see whether a lien is still available. The county is the only place to check and to buy. Educational only; not legal, tax or investment advice. Verify everything with the county first.'));
    if (!dlg.open) dlg.showModal();
  }
};
// Same leftover rule as the screener: mineral/subsurface rights, easements, strips and slivers.
const JUNK_RE = /\bSTRIP\b|EASEMENT|R\/W\b|RIGHT[- ]OF[- ]WAY|\b[NSEW]\s?\d+(\.\d+)?\s?(FT|FEET)\b(?! OF LOTS?)|\b\d+(\.\d+)?\s?FT\s+(STRIP|WIDE)\b/i;
// Pre-checked land facts (LAND_FLAGS from land-flags.js): [road, high flood, wetlands], 1 = yes, 0 = no, null = not checked.
const landFlags = l => (typeof LAND_FLAGS !== 'undefined' && LAND_FLAGS[l.county + '|' + l.parcel]) || null;
const landBadge = l => { const f = landFlags(l); if (!f) return 'Not checked'; const b = []; if (f[0] === 0) b.push('\uD83D\uDEAB No mapped road'); else if (f[0] === 1) b.push('\u2714 Road'); if (f[1] === 1) b.push('\uD83C\uDF0A Flood zone'); if (f[2] === 1) b.push('\uD83C\uDF3F Wetlands'); return b.join(' \u00b7 ') || 'Not checked'; };
const isJunk = l => !!(l.mineral || /EASEMENT/i.test(l.desc || '') || (JUNK_RE.test(l.desc || '') && !(l.acres >= 0.25)) || (l.acres != null && l.acres > 0 && l.acres < 0.05));
const STRIPS = new Set(['R/W - BUFFER', 'RIVER/LAKES', 'UTILITY', 'RESIDENTIAL COMMON AREA/ELEMENT']);
const LienUI = {
  saleBox(host, county) {
    const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x) e.textContent = x; return e; };
    const box = mk('div', 'salebox');
    box.appendChild(mk('h3', '', 'Tax certificate sale' + (county ? ' (' + county + ' County)' : ' (Florida)')));
    const dl = mk('dl', 'stfacts');
    [['Next sale', FL_SALE.nextSale], ['Lists posted', FL_SALE.listsPosted]].forEach(([k, v]) => { const d = mk('div'); d.append(mk('dt', '', k), mk('dd', '', v)); dl.appendChild(d); });
    box.appendChild(dl);
    const ol = mk('ol', 'salesteps'); FL_SALE.steps.forEach(s => ol.appendChild(mk('li', '', s))); box.appendChild(ol);
    const links = mk('p', 'small');
    const a = (t, u) => { const e = mk('a', '', t); e.href = u; e.target = '_blank'; e.rel = 'noopener noreferrer'; return e; };
    links.appendChild(a(FL_SALE.statute[0], FL_SALE.statute[1]));
    if (county) {
      if (FL_SALE.lists[county]) { links.append(' · '); links.appendChild(a('Official delinquent list page', FL_SALE.lists[county])); }
      if (FL_SALE.reports[county]) { links.append(' \u00b7 '); links.appendChild(a('County report downloads (open in a browser)', FL_SALE.reports[county])); }
      if (FL_SALE.portalCounties.indexOf(county) >= 0) { links.append(' · '); links.appendChild(a(FL_SALE.portal[0] + ' (this county sells here)', FL_SALE.portal[1])); }
    }
    box.appendChild(links);
    host.appendChild(box);
  },
  table(host, county, state) {
    const all = LIENS.filter(l => (!county || l.county === county) && (!state || (l.state || 'FL') === state));
    const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x) e.textContent = x; return e; };
    host.appendChild(mk('h3', '', 'Liens' + (county ? ' in ' + county + ' County' : '')));
    if (!all.length) {
      host.appendChild(mk('p', 'muted', 'No liens are listed for this county yet. We only list liens copied from an official county list, with the source and date checked. New sale lists are expected in April and May 2027.'));
      return;
    }
    host.appendChild(mk('p', 'muted small', county === 'Pinal' ? all.length + ' parcels from the Pinal County Treasurer\u2019s official Tax Lien Sale List (PDF dated 11/3/2026). Face is the total amount on the list, which is the price of the lien. County value, lot size and use come from the county\u2019s public GIS and can be low or out of date (a county value of $500 on a lot that once sold for much more is a reason to look closer). Owner names are left out. The interest rate and whether each lien is still available must be confirmed with the Treasurer; Arizona\u2019s cap is 16%. Confirm everything with the county.' : county === 'Larimer' ? all.length + ' parcels advertised for the November 19, 2026 tax lien sale, copied from the Larimer County Treasurer\u2019s official list (dated 11/3/2026). These are NOT sold yet: many owners pay before the sale, and the county updates the list nightly. Face is the delinquent tax balance; payoff adds interest and fees as of the file date; county value is the \u201cvaluation\u201d in that list. Owner names and addresses are left out. Colorado sets the interest rate by law each year (bidders pay a premium above face that earns no interest). Confirm everything with the county.' : county === 'Saguache' ? all.length + ' liens on Saguache County\u2019s 2026 tax lien sale list (from the county\u2019s online auction export). Face is the unpaid tax. Live bids are not shown here because they change by the minute; bids above face are a premium that earns no interest. Owner names and addresses are left out. Confirm everything with the county.' : county === 'Coconino' ? all.length + ' parcels on the Coconino County Treasurer\u2019s 2026 delinquent account list. These owe back taxes; whether a lien on each is for sale now must be confirmed with the Treasurer. Owner names are left out.' : all.length + ' older liens (county-held certificates: not bought at the tax sale, so the county holds them). Copied from the county tax collector\u2019s official list. Face amount is the original tax debt (\u201cbelow face\u201d means the county values the lot at less than that debt, a warning sign); payoff is the total on the date of the file and keeps growing with interest. Confirm everything with the county before buying.'));
    if (all.some(l => (l.state || 'FL') === 'FL')) host.appendChild(mk('p', 'muted small', 'Florida parcels: the picture, lot size and public record (current owner of record, address, land use, values, flood, wetlands and mapped road frontage) come from the Florida statewide parcel map and federal map layers, matched by county and parcel ID. Tap Show on map for the full record and sources.'));
    const tools = mk('div', 'lientools');
    const q = mk('input'); q.type = 'search'; q.placeholder = 'Search parcel or description'; q.setAttribute('aria-label', 'Search liens');
    const yr = mk('select'); yr.setAttribute('aria-label', 'Tax year');
    const ys = Array.from(new Set(all.map(l => l.taxYear).filter(Boolean))).sort((a, b) => b - a);
    yr.appendChild(new Option('All tax years', '')); ys.forEach(y => yr.appendChild(new Option(String(y), String(y))));
    const sort = mk('select'); sort.setAttribute('aria-label', 'Sort');
    [['new', 'Newest sale first'], ['low', 'Smallest face amount'], ['high', 'Largest face amount']].forEach(o => sort.appendChild(new Option(o[1], o[0])));
    const useSel = mk('select'); useSel.setAttribute('aria-label', 'Property use');
    const uses = Array.from(new Set(all.map(l => l.use).filter(Boolean))).sort();
    useSel.appendChild(new Option('All property uses', '')); uses.forEach(x => useSel.appendChild(new Option(x, x)));
    const hideBox = mk('label', 'chk'); const hide = mk('input'); hide.type = 'checkbox'; hideBox.append(hide, ' Hide road, utility and water strips');
    const hasFacts = all.some(l => l.use);
    const junkN = all.filter(isJunk).length;
    const junkBox = mk('label', 'chk'); const junkC = mk('input'); junkC.type = 'checkbox'; junkC.checked = true; junkBox.append(junkC, ' Hide mineral rights, strips, easements and tiny slivers (' + junkN + ')');
    const noRoadN = all.filter(l => { const f = landFlags(l); return f && f[0] === 0; }).length;
    const mkChk = (txt, on) => { const lb = mk('label', 'chk'), c = mk('input'); c.type = 'checkbox'; c.checked = on; lb.append(c, ' ' + txt); return [lb, c]; };
    const [roadBox, roadC] = mkChk('Hide lots with no mapped road (' + noRoadN + ')', true);
    const [floodBox, floodC] = mkChk('Hide FEMA high-risk flood zones', false);
    const [wetBox, wetC] = mkChk('Hide mapped wetlands', false);
    const hasFlags = all.some(l => landFlags(l));
    const trafBox = mk('label', 'chk'); const trafC = mk('input'); trafC.type = 'checkbox'; const trafCount = mk('span', 'small muted', ''); trafBox.append(trafC, ' Vacant lots within 500 ft of a road with 10,000+ vehicles a day ', trafCount);
    const hasFlTraf = all.some(l => (l.state || 'FL') === 'FL');
    TrafficData.preload(all).then(() => { trafCount.textContent = '(' + all.filter(l => TrafficData.passes(l)).length + ')'; if (trafC.checked) apply(); });
    const hoaSel = mk('select'); hoaSel.setAttribute('aria-label', 'HOA status');
    [['', 'All HOA statuses'], ['confirmed', 'HOA confirmed'], ['possible', 'Possible HOA'], ['unknown', 'HOA status unknown']].forEach(o => hoaSel.appendChild(new Option(o[1], o[0])));
    const hasFl = all.some(HoaData.isFl);
    HoaData.preload(all).then(() => { if (hoaSel.value) apply(); });
    tools.append(q, yr); if (hasFl) tools.append(hoaSel); if (hasFlTraf) tools.append(trafBox); if (hasFacts) tools.append(useSel, hideBox); if (junkN) tools.append(junkBox); if (hasFlags) tools.append(roadBox, floodBox, wetBox); tools.append(sort);
    // Sticky bar: Filters button, view switch and the live count stay pinned while you scroll.
    const bar = mk('div', 'lienbar'), fb = mk('button', 'btn small', 'Filters'); fb.type = 'button'; fb.setAttribute('aria-expanded', 'false');
    const vb = mk('button', 'btn small ghost', 'Table view'); vb.type = 'button';
    const cnt = mk('p', 'lcount small'); cnt.setAttribute('role', 'status');
    // County picker: right beside Filters, so you can jump to one county without scrolling (shown when the list spans several counties).
    const cty = mk('select', 'ctysel'); cty.setAttribute('aria-label', 'County');
    const ccount = {}; all.forEach(l => { ccount[l.county] = (ccount[l.county] || 0) + 1; });
    const cnames = Object.keys(ccount).sort();
    cty.appendChild(new Option('All counties (' + cnames.length + ')', '')); cnames.forEach(c => cty.appendChild(new Option(c + ' (' + ccount[c].toLocaleString('en-US') + ')', c)));
    const top = mk('div', 'lienbar-row'); top.append(fb, vb); if (cnames.length > 1) top.append(cty); else top.append(cnt);
    bar.append(top); if (cnames.length > 1) { cnt.classList.add('lcount-row'); bar.append(cnt); } bar.append(tools); host.appendChild(bar);
    fb.addEventListener('click', () => { const o = bar.classList.toggle('open'); fb.setAttribute('aria-expanded', String(o)); });
    let view = 'cards';
    vb.addEventListener('click', () => { view = view === 'cards' ? 'table' : 'cards'; vb.textContent = view === 'cards' ? 'Table view' : 'Card view'; draw(); });
    const wrap = mk('div', 'tablewrap'); host.appendChild(wrap);
    const more = mk('button', 'btn ghost', 'Show more'); host.appendChild(more);
    const money = n => n == null ? 'Not listed' : '$' + Number(n).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    let shown = 50, list = [];
    const chip = (cls, txt) => mk('span', 'lchip ' + cls, txt);
    function drawCards() {
      const g = mk('div', 'lcards');
      list.slice(0, shown).forEach(l => {
        const c = mk('article', 'lcardx'), f = landFlags(l);
        if ((l.state || 'FL') === 'FL') { const th = mk('div', 'lthumb'); c.appendChild(th); ParcelData.thumb(l, th); }
        const h = mk('div', 'lch'); h.append(mk('b', '', l.parcel), mk('span', 'small', (l.county ? l.county + ' · ' : '') + (l.taxYear ? 'tax yr ' + l.taxYear : ''))); c.appendChild(h);
        const amt = mk('div', 'lamt'); amt.append(mk('span', 'small', l.priceLabel || 'Face (price of the lien)'), mk('b', '', money(l.amount))); c.appendChild(amt);
        const meta = mk('div', 'lmeta'); [l.rate ? 'Rate ' + l.rate : '', l.payoff ? 'Payoff* ' + money(l.payoff) : '', l.saleDate ? 'Sale ' + l.saleDate : '', l.status || ''].filter(Boolean).forEach(t => meta.appendChild(mk('span', '', t))); c.appendChild(meta);
        const ch = mk('div', 'lchips');
        { const hb = HoaData.badge(l); if (hb) ch.appendChild(hb); }
        if (!f) ch.appendChild(chip('na', 'Land: not checked'));
        else {
          ch.appendChild(f[0] === 1 ? chip('ok', '✔ Road within ~200 ft') : f[0] === 0 ? chip('bad', 'No mapped road') : chip('na', 'Road: ?'));
          ch.appendChild(f[1] === 1 ? chip('warn', 'High-risk flood') : f[1] === 0 ? chip('ok', 'Not high-risk flood') : chip('na', 'Flood: ?'));
          ch.appendChild(f[2] === 1 ? chip('warn', 'Wetlands') : f[2] === 0 ? chip('ok', 'No wetlands') : chip('na', 'Wetlands: ?'));
        }
        c.appendChild(ch);
        const facts = [l.use, l.market != null ? 'County value ' + money(l.market).replace('.00', '') + (l.market < l.amount ? ' (below face)' : '') : '', l.desc].filter(Boolean);
        if (facts.length) c.appendChild(mk('p', 'small lfacts', facts.join(' · ')));
        if ((l.state || 'FL') === 'FL') c.appendChild(TrafficData.el(l));
        if (l.owner || l.address) c.appendChild(mk('p', 'small lfacts', [l.owner ? 'Owner: ' + l.owner : '', l.address ? 'Property: ' + l.address : '', l.mailing ? 'Mailing: ' + l.mailing : ''].filter(Boolean).join(' · ')));
        const act = mk('div', 'lact');
        if (PARCEL_MAPS[l.county] || (l.state || 'FL') === 'FL') { const b = mk('button', 'btn small', 'Show on map'); b.type = 'button'; b.addEventListener('click', () => LienMap.open(l)); act.appendChild(b); }
        if (l.amount != null && !l.priceLabel) { const cb = mk('a', 'btn small ghost', 'Calculate'); cb.href = '../../?' + new URLSearchParams({amount: l.amount, rate: String(l.rate || '').replace('%', ''), months: 24, fees: 0, from: l.county + ' parcel ' + l.parcel + ' (face $' + l.amount + (l.market != null && l.market < l.amount ? '; the county values the lot below the lien, so check why' : '') + ')'}).toString() + '#calculator'; act.appendChild(cb); }
        const rb = mk('button', 'btn small', 'Research'); rb.type = 'button'; rb.addEventListener('click', () => LienResearch.open(l)); act.appendChild(rb);
        const bb = LienBuy.button(l, 'btn small'); if (bb) act.appendChild(bb); act.appendChild(LienSave.button(l, 'btn small ghost')); if (typeof PF !== 'undefined') PF.cardButtons(l, act, 'btn small ghost');
        c.appendChild(act);
        const src = mk('p', 'small lsrc'); const a = mk('a', '', 'Source'); a.href = l.source; a.target = '_blank'; a.rel = 'noopener noreferrer'; src.append(a, ' ' + (l.checked || '')); c.appendChild(src);
        g.appendChild(c);
      });
      wrap.appendChild(g);
    }
    function draw() {
      wrap.innerHTML = '';
      if (view === 'cards') { drawCards(); cnt.textContent = 'Showing ' + Math.min(shown, list.length).toLocaleString() + ' of ' + list.length.toLocaleString() + ' (* payoff as of the source file date)'; more.hidden = shown >= list.length; return; }
      const t = mk('table', 'liens'), hr = t.createTHead().insertRow();
      ['County', 'Parcel (PIN)', 'Tax yr', 'Face', 'Rate', 'Payoff*', 'Sale date', 'Status', 'Land check', 'Use', 'County value', 'Homestead', 'Description', 'Source / checked', 'Map', 'Calc', 'HOA'].forEach(x => hr.appendChild(mk('th', '', x)));
      const tb = t.createTBody();
      list.slice(0, shown).forEach(l => {
        const r = tb.insertRow();
        [l.county, l.parcel, l.taxYear || '', money(l.amount), l.rate || '', l.payoff ? money(l.payoff) : '', l.saleDate, l.status, landBadge(l), l.use || '', l.market != null ? money(l.market).replace('.00', '') + (l.market < l.amount ? ' (below face)' : '') : '', l.use ? (l.homestead ? 'Yes' : 'No') : '', l.desc || ''].forEach((x, k) => { const c = r.insertCell(); c.textContent = x; if (k === 11) c.className = 'desc'; });
        const c = r.insertCell(), a = mk('a', '', 'Source'); a.href = l.source; a.target = '_blank'; a.rel = 'noopener noreferrer'; c.append(a, ' ' + l.checked);
        const mc = r.insertCell();
        const cc = r.insertCell(), cb = mk('a', 'btn small ghost', 'Calculate');
        cb.href = '../../?' + new URLSearchParams({amount: l.amount, rate: String(l.rate || '').replace('%', ''), months: 24, fees: 0, from: l.county + ' parcel ' + l.parcel + ' (face $' + l.amount + (l.market != null && l.market < l.amount ? '; the county values the lot below the lien, so check why' : '') + ')'}).toString() + '#calculator';
        const hc = r.insertCell(); { const hb = HoaData.badge(l); if (hb) hc.appendChild(hb); }
        if (l.amount != null && !l.priceLabel) cc.appendChild(cb); const bb = LienBuy.button(l, 'btn small'); if (bb) { bb.style.marginLeft = '6px'; cc.appendChild(bb); } const fv = LienSave.button(l, 'btn small ghost'); fv.style.marginLeft = '6px'; cc.appendChild(fv);
        if (PARCEL_MAPS[l.county]) { const b = mk('button', 'btn small', 'Show on map'); b.type = 'button'; b.addEventListener('click', () => LienMap.open(l)); mc.appendChild(b); }
      });
      wrap.appendChild(t);
      cnt.textContent = 'Showing ' + Math.min(shown, list.length) + ' of ' + list.length + ' (* payoff as of the source file date)';
      more.hidden = shown >= list.length;
    }
    function apply() {
      const s = q.value.trim().toLowerCase();
      list = all.filter(l => (!cty.value || l.county === cty.value) && (!yr.value || String(l.taxYear) === yr.value) && (!useSel.value || l.use === useSel.value) && (!hide.checked || !STRIPS.has(l.use)) && (!junkN || !junkC.checked || !isJunk(l)) && (() => { const f = landFlags(l); if (!f) return true; if (roadC.checked && f[0] === 0) return false; if (floodC.checked && f[1] === 1) return false; if (wetC.checked && f[2] === 1) return false; return true; })() && (!hoaSel.value || HoaData.statusNow(l) === hoaSel.value) && (!trafC.checked || TrafficData.passes(l)) && (!s || (l.parcel + ' ' + (l.desc || '')).toLowerCase().indexOf(s) >= 0));
      list.sort((a, b) => sort.value === 'low' ? (a.amount || 0) - (b.amount || 0) : sort.value === 'high' ? (b.amount || 0) - (a.amount || 0) : (b.saleDate > a.saleDate ? 1 : -1));
      shown = 50; draw();
    }
    [q, yr, sort, useSel, hide, junkC, roadC, floodC, wetC, hoaSel, trafC, cty].forEach(e => e.addEventListener('input', apply));
    more.addEventListener('click', () => { shown += 100; draw(); });
    apply();
  }
};

// Research checklist on live listings. Same checklist as the practice case; members' marks and notes are saved privately to their account.
const LienResearch = {
  LAND_CHECKED: '2026-11-10', // keep in step with the date at the top of land-flags.js
  user: undefined,
  async me() { if (this.user !== undefined) return this.user; try { const r = await fetch('/.netlify/functions/account'); const d = await r.json(); this.user = d.user || null; } catch (e) { this.user = null; } return this.user; },
  key(l) { return [l.state || 'FL', l.county, l.parcel].join('|').replace(/[^A-Za-z0-9 |._\/-]/g, '_').slice(0, 120); },
  items(l) {
    const f = landFlags(l), LES = {href: '/learn/?l=diligence', label: 'Master Class lesson 7: Due diligence (members)'};
    const src = (name, url) => ({name, url});
    const yes = (v, a, b) => v === 1 ? a : v === 0 ? b : '';
    return [
      {key: 'zoning', title: 'Zoning', why: 'Zoning decides what can be built, and a minimum lot size can make a small lot unbuildable.', finding: '', source: src('County zoning map', ''), checked: '', lookup: {text: 'Look up zoning with Land Information', href: '/land/'}, lesson: LES},
      {key: 'flood', title: 'Flood zone', why: 'A high-risk flood zone can mean required insurance and building limits.', finding: f ? yes(f[1], 'The lot touches a FEMA Special Flood Hazard Area (high risk).', 'The lot is not in a mapped FEMA high-risk flood zone.') : '', source: src('FEMA National Flood Hazard Layer', 'https://msc.fema.gov/portal'), checked: f ? this.LAND_CHECKED : '', lesson: LES},
      {key: 'wetlands', title: 'Wetlands', why: 'Mapped wetlands can block or limit building.', finding: f ? yes(f[2], 'Mapped wetlands touch the lot.', 'No mapped wetlands touch the lot.') : '', source: src('US Fish and Wildlife National Wetlands Inventory', 'https://www.fws.gov/program/national-wetlands-inventory'), checked: f ? this.LAND_CHECKED : '', lesson: LES},
      {key: 'road', title: 'Road access', why: 'A lot with no road may be landlocked. A mapped road is not proof of legal access.', finding: f ? yes(f[0], 'A mapped road was found within about 200 ft of the lot.', 'No mapped road within about 200 ft. The lot may be landlocked, or its road may be private or new.') : '', source: src('US Census TIGER road map', 'https://tigerweb.geo.census.gov/'), checked: f ? this.LAND_CHECKED : '', lesson: LES}
    ];
  },
  async open(l) {
    if (typeof Research === 'undefined') return;
    const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
    let dlg = document.getElementById('resdlg');
    if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'resdlg'; dlg.className = 'lotdlg resdlg'; dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); }); document.body.appendChild(dlg); }
    dlg.textContent = ''; const body = mk('div', 'resbody'); dlg.appendChild(body);
    body.append(mk('h3', '', 'Research: ' + l.parcel), mk('p', 'small muted', (l.county || '') + ' County' + (l.amount != null ? ' · ' + (l.priceLabel ? 'sold for' : 'face') + ' $' + Number(l.amount).toLocaleString() : '')));
    const me = await this.me(), key = this.key(l); let saved = null;
    if (me) { try { const r = await fetch('/.netlify/functions/account', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'resGet'})}); const d = await r.json(); saved = d.research && d.research[key] || null; } catch (e) {} }
    const marks = Object.assign({}, saved && saved.marks);
    body.appendChild(Research.build(this.items(l), marks, null, {showAll: true}));
    const notes = mk('textarea'); notes.rows = 4; notes.maxLength = 1500; notes.placeholder = 'Your private notes on this certificate'; notes.setAttribute('aria-label', 'Private notes'); notes.value = saved ? saved.notes : '';
    const msg = mk('p', 'small'); msg.setAttribute('role', 'status');
    if (me) {
      const sv = mk('button', 'btn', 'Save my research'); sv.type = 'button';
      sv.addEventListener('click', async () => { sv.disabled = true; msg.textContent = 'Saving…'; try { const r = await fetch('/.netlify/functions/account', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'resSave', key, label: l.county + ' ' + l.parcel, marks, notes: notes.value})}); const d = await r.json(); msg.textContent = r.ok ? 'Saved to your account. Only you can see it.' : (d.error || 'Could not save.'); } catch (e) { msg.textContent = 'Could not reach the server.'; } sv.disabled = false; });
      body.append(notes, sv, msg); if (saved) msg.textContent = 'Last saved ' + String(saved.updated).slice(0, 10) + '.';
    } else { const p = mk('p', 'small'); const a = mk('a', '', 'Sign in'); a.href = '/login/?next=' + encodeURIComponent(location.pathname + location.search); p.append(a, ' to save your research and notes to your account. Without signing in, your marks are not kept.'); body.appendChild(p); }
    const x = mk('button', 'btn ghost small', 'Close'); x.type = 'button'; x.addEventListener('click', () => dlg.close()); body.appendChild(x);
    body.appendChild(mk('p', 'small muted', 'Pre-checked items come from public map services and can be wrong or out of date. Confirm with the county. Educational only, not advice.'));
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }
};
