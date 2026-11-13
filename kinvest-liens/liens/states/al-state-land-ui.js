// Map + satellite preview: lot outline from the county's own GIS (parcels/al-<code>.json, exact parcel-ID matches only), imagery drawn live from Esri.
const AlMap = {
  files: {}, L: null,
  outline(co) { return this.files[co] || (this.files[co] = fetch('/liens/states/parcels/al-' + co + '.json').then(r => r.ok ? r.json() : null).catch(() => null)); },
  lib() { return this.L || (this.L = new Promise((res, rej) => { if (window.L) return res(window.L); const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css'; document.head.appendChild(css); const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js'; s.onload = () => res(window.L); s.onerror = () => { this.L = null; rej(new Error('map')); }; document.head.appendChild(s); })); },
  // static satellite thumbnail (Esri World Imagery export, drawn live) with the county outline on top, same projection (Web Mercator)
  thumb(c, r, host) {
    const NS = 'http://www.w3.org/2000/svg';
    this.outline(c.co).then(f => {
      host.classList.remove('loading'); const m = f && f.p[r[4]];
      const cap = document.createElement('p'); cap.className = 'lcap small';
      if (!m) { const u = document.createElement('div'); u.className = 'lnoimg'; u.textContent = 'Image unavailable'; host.appendChild(u); cap.textContent = 'Not found on the county map, so the location is not verified.'; host.appendChild(cap); return; }
      const R = 6378137, X = lng => lng * Math.PI / 180 * R, Y = lat => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * R;
      let [x0, y0, x1, y1] = [X(m.bb[0]), Y(m.bb[1]), X(m.bb[2]), Y(m.bb[3])];
      let w = Math.max(x1 - x0, 25), h = Math.max(y1 - y0, 25); const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      w *= 1.6; h *= 1.6; if (w / h > 1.5) h = w / 1.5; else w = h * 1.5; if (w < 180) { w = 180; h = 120; }   // the imagery service refuses views sharper than ~0.35 m per pixel
      x0 = cx - w / 2; x1 = cx + w / 2; y0 = cy - h / 2; y1 = cy + h / 2;
      const wrap = document.createElement('div'); wrap.className = 'althumb';
      const im = document.createElement('img'); im.loading = 'lazy'; im.decoding = 'async'; im.width = 480; im.height = 320; im.alt = 'Satellite view of parcel ' + r[4] + ' with its boundary outlined';
      im.src = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=' + [x0, y0, x1, y1].map(v => v.toFixed(1)).join(',') + '&bboxSR=3857&imageSR=3857&size=480,320&format=jpg&f=image';
      const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 480 320'); svg.setAttribute('preserveAspectRatio', 'none');
      const path = document.createElementNS(NS, 'path'); path.setAttribute('d', m.g.map(ring => 'M' + ring.map(p => ((X(p[0]) - x0) / w * 480).toFixed(1) + ',' + ((y1 - Y(p[1])) / h * 320).toFixed(1)).join('L') + 'Z').join(' '));
      path.setAttribute('fill', 'rgba(255,209,102,.15)'); path.setAttribute('stroke', '#ffd166'); path.setAttribute('stroke-width', '3'); path.setAttribute('vector-effect', 'non-scaling-stroke'); svg.appendChild(path);
      im.onerror = () => { im.remove(); cap.textContent = 'Satellite image could not load · outline: ' + c.county + ' GIS'; };
      wrap.append(im, svg); host.appendChild(wrap); cap.textContent = 'Satellite: Esri World Imagery (dates vary) · outline: ' + c.county + ' GIS'; host.appendChild(cap);
    });
  },
  async open(c, r) {
    const mk = (t, cl, x) => { const e = document.createElement(t); if (cl) e.className = cl; if (x != null) e.textContent = x; return e; };
    let dlg = document.getElementById('aldlg'); if (dlg) dlg.remove();
    dlg = mk('dialog', 'lotdlg'); dlg.id = 'aldlg'; document.body.appendChild(dlg);
    const head = mk('div', 'ustop'); head.append(mk('b', '', 'Parcel ' + r[4])); const x = mk('button', 'btn small', 'Close'); x.type = 'button'; x.onclick = () => dlg.close(); head.append(x); dlg.appendChild(head);
    dlg.appendChild(mk('p', 'small', r[5]));
    const box = mk('div', 'lotmap'); box.style.height = '340px'; dlg.appendChild(box);
    const note = mk('p', 'small muted', 'Loading…'); dlg.appendChild(note);
    dlg.addEventListener('close', () => dlg.remove()); dlg.showModal();
    const f = await this.outline(c.co), m = f && f.p[r[4]];
    if (!m) { box.remove(); note.textContent = 'Location not found on the county map: this parcel ID is not in ' + c.county + '’s current parcel layer (it may have been split, merged or renumbered). No preview shown.'; return; }
    let L; try { L = await this.lib(); } catch (e) { note.textContent = 'The map could not load.'; return; }
    const map = L.map(box, {zoomControl: true, attributionControl: true});
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {maxZoom: 20, maxNativeZoom: 19, attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics'}).addTo(map);
    const g = L.geoJSON({type: 'Feature', properties: {}, geometry: {type: 'Polygon', coordinates: m.g}}, {style: {color: '#ffd166', weight: 3, fillColor: '#ffd166', fillOpacity: 0.15}}).addTo(map);
    map.fitBounds(g.getBounds(), {maxZoom: 19, padding: [30, 30]});
    note.textContent = 'Outline from ' + c.county + ' GIS (parcel ' + m.cid + '), matched by parcel ID; not a survey. Satellite imagery from Esri World Imagery, capture dates vary. Do not visit or enter the property.';
  }
};
// Alabama state-held tax delinquent land (ADOR transcripts): county filter, search, sort, show more.
const AlStateLandUI = {
  render(host) {
    const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
    const money = n => '$' + Number(n).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    const all = []; AL_STATE_LAND.forEach(c => c.rows.forEach(r => all.push({c, r})));
    const box = mk('div', 'salebox'); host.appendChild(box);
    box.appendChild(mk('h3', '', 'State-held tax delinquent land (Alabama Department of Revenue)'));
    box.appendChild(mk('p', 'small', all.length.toLocaleString('en-US') + ' parcels in ' + AL_STATE_LAND.length + ' county lists that the State of Alabama bought in at past tax sales and now offers for sale. The amount shown is what was bid at the original tax sale, not today’s price: taxes, interest and fees have been added since. Ask the Department of Revenue for the current price before you apply.'));
    const src = mk('p', 'small'); AL_STATE_LAND.forEach((c, i) => { if (i) src.append(' · '); const a = mk('a', '', c.county + ' transcript (' + c.date + ')'); a.href = c.source; a.target = '_blank'; a.rel = 'noopener noreferrer'; src.append(a); });
    src.append(' · '); const h = mk('a', '', 'How to buy (ADOR)'); h.href = 'https://www.revenue.alabama.gov/property-tax/tax-delinquent-property-and-land-sales/'; h.target = '_blank'; h.rel = 'noopener noreferrer'; src.append(h, ' · Owner shown is the owner of record on the transcript.'); box.appendChild(src);
    const tools = mk('div', 'lientools');
    const cs = mk('select'); cs.setAttribute('aria-label', 'County'); cs.appendChild(new Option('All counties', '')); AL_STATE_LAND.forEach(c => cs.appendChild(new Option(c.county + ' (' + c.rows.length + ')', c.co)));
    const q = mk('input'); q.type = 'search'; q.placeholder = 'Search owner, parcel or description'; q.setAttribute('aria-label', 'Search');
    const so = mk('select'); so.setAttribute('aria-label', 'Sort'); [['lo', 'Lowest amount'], ['hi', 'Highest amount'], ['new', 'Most recent tax sale'], ['old', 'Oldest tax sale']].forEach(o => so.appendChild(new Option(o[1], o[0])));
    tools.append(cs, q, so); box.appendChild(tools);
    const cnt = mk('p', 'muted small'); cnt.setAttribute('role', 'status'); box.appendChild(cnt);
    const wrap = mk('div', 'tablewrap'); box.appendChild(wrap);
    const more = mk('button', 'btn ghost', 'Show more'); more.type = 'button'; box.appendChild(more);
    let list = [], shown = 24;
    let view = 'cards';
    const vb = mk('button', 'btn small ghost', 'Table view'); vb.type = 'button'; tools.appendChild(vb);
    vb.addEventListener('click', () => { view = view === 'cards' ? 'table' : 'cards'; vb.textContent = view === 'cards' ? 'Table view' : 'Card view'; draw(); });
    const drawCards = () => {
      wrap.textContent = ''; const g = mk('div', 'lcards');
      list.slice(0, shown).forEach(({c, r}) => {
        const card = mk('article', 'lcardx'); const th = mk('div', 'lthumb loading'); card.appendChild(th); AlMap.thumb(c, r, th);
        const h = mk('div', 'lch'); h.append(mk('b', '', r[4] || 'No parcel ID'), mk('span', 'small', c.county.replace(' County', '') + ' \u00B7 tax sale ' + r[1])); card.appendChild(h);
        const amt = mk('div', 'lamt'); amt.append(mk('span', 'small', 'Bid at the tax sale (not today\u2019s price)'), mk('b', '', r[6] == null ? 'Not shown' : money(r[6]))); card.appendChild(amt);
        card.appendChild(mk('div', 'small', r[5]));
        card.appendChild(mk('div', 'small muted', 'Owner of record: ' + r[0] + ' \u00B7 cert ' + r[2]));
        const act = mk('div', 'lact'); const b = mk('button', 'btn small', 'Show on map'); b.type = 'button'; b.onclick = () => AlMap.open(c, r); act.appendChild(b); const hb = typeof LienBuy !== 'undefined' && LienBuy.button({state: 'AL', county: c.county.replace(' County', ''), parcel: r[4], cert: r[2], amount: r[6], buyKey: 'AL-ADOR', alCounty: c.county, alDate: c.date, desc: r[5]}, 'btn small ghost'); if (hb) { hb.style.marginLeft = '6px'; act.appendChild(hb); } card.appendChild(act);
        g.appendChild(card);
      });
      wrap.appendChild(g); cnt.textContent = 'Showing ' + Math.min(shown, list.length).toLocaleString('en-US') + ' of ' + list.length.toLocaleString('en-US'); more.hidden = shown >= list.length;
    };
    const draw = () => { if (view === 'cards') return drawCards();
      wrap.textContent = ''; const t = mk('table', 'liens'), hr = t.createTHead().insertRow();
      ['County', 'Parcel', 'Owner of record', 'Description', 'Tax sale year', 'Cert #', 'Bid at tax sale', ''].forEach(x => hr.appendChild(mk('th', '', x)));
      const tb = t.createTBody();
      list.slice(0, shown).forEach(({c, r}) => { const row = tb.insertRow(); [c.county.replace(' County', ''), r[4], r[0], r[5], r[1], r[2], r[6] == null ? 'Not shown' : money(r[6])].forEach(v => row.insertCell().textContent = v); const b = mk('button', 'btn small ghost', 'Map'); b.type = 'button'; b.onclick = () => AlMap.open(c, r); row.insertCell().appendChild(b); });
      wrap.appendChild(t); cnt.textContent = 'Showing ' + Math.min(shown, list.length).toLocaleString('en-US') + ' of ' + list.length.toLocaleString('en-US'); more.hidden = shown >= list.length;
    };
    const apply = () => {
      const s = q.value.trim().toLowerCase();
      list = all.filter(({c, r}) => (!cs.value || c.co === cs.value) && (!s || (r[0] + ' ' + r[4] + ' ' + r[5]).toLowerCase().includes(s)));
      list.sort((a, b) => so.value === 'lo' ? (a.r[6] ?? 1e12) - (b.r[6] ?? 1e12) : so.value === 'hi' ? (b.r[6] ?? -1) - (a.r[6] ?? -1) : so.value === 'new' ? b.r[1].localeCompare(a.r[1]) : a.r[1].localeCompare(b.r[1]));
      shown = 24; draw();
    };
    [cs, so].forEach(x => x.addEventListener('change', apply)); q.addEventListener('input', apply); more.addEventListener('click', () => { shown += 24; draw(); });
    apply();
  }
};
