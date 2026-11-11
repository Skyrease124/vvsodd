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
      if (r && r.st === 'matched' && r.img && r.img.s === 'aerial') {
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
    box.appendChild(ul);
    const srcs = mk('p', 'small psrc'); srcs.append('Sources, checked ' + r.ck + ': ');
    ['flood', 'wetlands', 'roads', 'zoning'].forEach((k, i) => { const o = S[k]; if (!o) return; const a = mk('a', '', o.name); a.href = o.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; if (i) srcs.append(' · '); srcs.appendChild(a); });
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
    let fx = dlg.querySelector('.lotfacts'); if (!fx) { fx = document.createElement('p'); fx.className = 'lotfacts small'; msg.after(fx); } fx.textContent = '';
    if (cfg) { const pa = document.createElement('a'); pa.href = cfg.page(l.parcel); pa.target = '_blank'; pa.rel = 'noopener noreferrer'; pa.textContent = 'Look up the owner and tax history on the ' + cfg.pageName + ' site';
    foot.append(pa, ' \u00b7 '); }
    foot.append('Map data: county GIS, OpenStreetMap, Esri. Educational only; the outline is approximate and not a survey. Verify with the county.');
    if (!dlg.open) dlg.showModal();
    const pd = await ParcelData.rec(l);
    let pr = dlg.querySelector('.precord'); if (pr) pr.remove();
    if ((l.state || 'FL') === 'FL') { pr = ParcelData.panel(l, pd.file, pd.r); foot.before(pr); let hb = dlg.querySelector('.hoabox'); if (hb) hb.remove(); hb = await HoaData.panel(l); pr.after(hb); }
    if (pd.r && pd.r.st === 'matched' && pd.r.g) {
      try {
        const L = await this.load();
        if (box._map) { box._map.remove(); box._map = null; }
        const m = L.map(box); box._map = m;
        const street = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'});
        const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {maxZoom: 19, attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics'});
        sat.addTo(m); L.control.layers({'Satellite': sat, 'Street': street}).addTo(m);
        const g = L.geoJSON(ParcelData.geojson(pd.r), {style: {color: '#ffd166', weight: 3, fillColor: '#ffd166', fillOpacity: 0.18}}).addTo(m);
        m.fitBounds(g.getBounds(), {maxZoom: 19, padding: [30, 30]});
        setTimeout(() => m.invalidateSize(), 50);
        box.dataset.pid = pd.r.pid;
        msg.textContent = 'Lot size: ' + ParcelData.sizeText(pd.r) + '. Outline from the Florida statewide parcel map; not a survey.';
        return;
      } catch (e) { /* fall through to the live county lookup */ }
    }
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
    const ready = mk('div', 'buyready'); dlg.appendChild(mk('h4', '', 'Have this ready when you contact the county'));
    const items = [['Parcel number', l.parcel]];
    const certs = l.certList && l.certList.length ? l.certList : (l.cert ? [l.cert] : []);
    if (certs.length) items.push([certs.length > 1 ? 'Certificate numbers' : 'Certificate number', certs.join(', ')]);
    if (l.amount != null || l.face != null) items.push(['Tax owed (face)', '$' + Number(l.amount != null ? l.amount : l.face).toFixed(2)]);
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
    const hoaSel = mk('select'); hoaSel.setAttribute('aria-label', 'HOA status');
    [['', 'All HOA statuses'], ['confirmed', 'HOA confirmed'], ['possible', 'Possible HOA'], ['unknown', 'HOA status unknown']].forEach(o => hoaSel.appendChild(new Option(o[1], o[0])));
    const hasFl = all.some(HoaData.isFl);
    HoaData.preload(all).then(() => { if (hoaSel.value) apply(); });
    tools.append(q, yr); if (hasFl) tools.append(hoaSel); if (hasFacts) tools.append(useSel, hideBox); if (junkN) tools.append(junkBox); if (hasFlags) tools.append(roadBox, floodBox, wetBox); tools.append(sort);
    // Sticky bar: Filters button, view switch and the live count stay pinned while you scroll.
    const bar = mk('div', 'lienbar'), fb = mk('button', 'btn small', 'Filters'); fb.type = 'button'; fb.setAttribute('aria-expanded', 'false');
    const vb = mk('button', 'btn small ghost', 'Table view'); vb.type = 'button';
    const cnt = mk('p', 'lcount small'); cnt.setAttribute('role', 'status');
    const top = mk('div', 'lienbar-row'); top.append(fb, vb, cnt); bar.append(top, tools); host.appendChild(bar);
    fb.addEventListener('click', () => { const o = bar.classList.toggle('open'); fb.setAttribute('aria-expanded', String(o)); });
    let view = 'cards';
    vb.addEventListener('click', () => { view = view === 'cards' ? 'table' : 'cards'; vb.textContent = view === 'cards' ? 'Table view' : 'Card view'; draw(); });
    const wrap = mk('div', 'tablewrap'); host.appendChild(wrap);
    const more = mk('button', 'btn ghost', 'Show more'); host.appendChild(more);
    const money = n => '$' + Number(n).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    let shown = 50, list = [];
    const chip = (cls, txt) => mk('span', 'lchip ' + cls, txt);
    function drawCards() {
      const g = mk('div', 'lcards');
      list.slice(0, shown).forEach(l => {
        const c = mk('article', 'lcardx'), f = landFlags(l);
        if ((l.state || 'FL') === 'FL') { const th = mk('div', 'lthumb'); c.appendChild(th); ParcelData.thumb(l, th); }
        const h = mk('div', 'lch'); h.append(mk('b', '', l.parcel), mk('span', 'small', (l.county ? l.county + ' · ' : '') + (l.taxYear ? 'tax yr ' + l.taxYear : ''))); c.appendChild(h);
        const amt = mk('div', 'lamt'); amt.append(mk('span', 'small', 'Face (price of the lien)'), mk('b', '', money(l.amount))); c.appendChild(amt);
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
        if (l.owner || l.address) c.appendChild(mk('p', 'small lfacts', [l.owner ? 'Owner: ' + l.owner : '', l.address ? 'Property: ' + l.address : '', l.mailing ? 'Mailing: ' + l.mailing : ''].filter(Boolean).join(' · ')));
        const act = mk('div', 'lact');
        if (PARCEL_MAPS[l.county] || (l.state || 'FL') === 'FL') { const b = mk('button', 'btn small', 'Show on map'); b.type = 'button'; b.addEventListener('click', () => LienMap.open(l)); act.appendChild(b); }
        const cb = mk('a', 'btn small ghost', 'Calculate'); cb.href = '../../?' + new URLSearchParams({amount: l.amount, rate: String(l.rate || '').replace('%', ''), months: 24, fees: 0, from: l.county + ' parcel ' + l.parcel + ' (face $' + l.amount + (l.market != null && l.market < l.amount ? '; the county values the lot below the lien, so check why' : '') + ')'}).toString() + '#calculator'; act.appendChild(cb);
        const rb = mk('button', 'btn small', 'Research'); rb.type = 'button'; rb.addEventListener('click', () => LienResearch.open(l)); act.appendChild(rb);
        const bb = LienBuy.button(l, 'btn small'); if (bb) act.appendChild(bb); act.appendChild(LienSave.button(l, 'btn small ghost'));
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
        cc.appendChild(cb); const bb = LienBuy.button(l, 'btn small'); if (bb) { bb.style.marginLeft = '6px'; cc.appendChild(bb); } const fv = LienSave.button(l, 'btn small ghost'); fv.style.marginLeft = '6px'; cc.appendChild(fv);
        if (PARCEL_MAPS[l.county]) { const b = mk('button', 'btn small', 'Show on map'); b.type = 'button'; b.addEventListener('click', () => LienMap.open(l)); mc.appendChild(b); }
      });
      wrap.appendChild(t);
      cnt.textContent = 'Showing ' + Math.min(shown, list.length) + ' of ' + list.length + ' (* payoff as of the source file date)';
      more.hidden = shown >= list.length;
    }
    function apply() {
      const s = q.value.trim().toLowerCase();
      list = all.filter(l => (!yr.value || String(l.taxYear) === yr.value) && (!useSel.value || l.use === useSel.value) && (!hide.checked || !STRIPS.has(l.use)) && (!junkN || !junkC.checked || !isJunk(l)) && (() => { const f = landFlags(l); if (!f) return true; if (roadC.checked && f[0] === 0) return false; if (floodC.checked && f[1] === 1) return false; if (wetC.checked && f[2] === 1) return false; return true; })() && (!hoaSel.value || HoaData.statusNow(l) === hoaSel.value) && (!s || (l.parcel + ' ' + (l.desc || '')).toLowerCase().indexOf(s) >= 0));
      list.sort((a, b) => sort.value === 'low' ? a.amount - b.amount : sort.value === 'high' ? b.amount - a.amount : (b.saleDate > a.saleDate ? 1 : -1));
      shown = 50; draw();
    }
    [q, yr, sort, useSel, hide, junkC, roadC, floodC, wetC, hoaSel].forEach(e => e.addEventListener('input', apply));
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
    body.append(mk('h3', '', 'Research: ' + l.parcel), mk('p', 'small muted', (l.county || '') + ' County · face $' + Number(l.amount).toLocaleString()));
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
