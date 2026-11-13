// Lot outline + live satellite preview for state land lists (AL, AR). Outlines: parcels/<file>, exact parcel-ID matches only.
const LandMap = {
  files: {}, L: null,
  outline(file) { return this.files[file] || (this.files[file] = fetch('/liens/states/parcels/' + file).then(r => r.ok ? r.json() : null).catch(() => null)); },
  lib() { return this.L || (this.L = new Promise((res, rej) => { if (window.L) return res(window.L); const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css'; document.head.appendChild(css); const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js'; s.onload = () => res(window.L); s.onerror = () => { this.L = null; rej(new Error('map')); }; document.head.appendChild(s); })); },
  // static satellite thumbnail (Esri World Imagery export, drawn live) with the county outline on top, same projection (Web Mercator)
  thumb(sp, host) {
    const NS = 'http://www.w3.org/2000/svg';
    this.outline(sp.file).then(f => {
      host.classList.remove('loading'); const m = f && f.p[sp.key];
      const cap = document.createElement('p'); cap.className = 'lcap small';
      if (!m) { const u = document.createElement('div'); u.className = 'lnoimg'; u.textContent = 'Image unavailable'; host.appendChild(u); cap.textContent = 'Not found on the county map, so the location is not verified.'; host.appendChild(cap); return; }
      const R = 6378137, X = lng => lng * Math.PI / 180 * R, Y = lat => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * R;
      let [x0, y0, x1, y1] = [X(m.bb[0]), Y(m.bb[1]), X(m.bb[2]), Y(m.bb[3])];
      let w = Math.max(x1 - x0, 25), h = Math.max(y1 - y0, 25); const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      w *= 1.6; h *= 1.6; if (w / h > 1.5) h = w / 1.5; else w = h * 1.5; if (w < 180) { w = 180; h = 120; }   // the imagery service refuses views sharper than ~0.35 m per pixel
      x0 = cx - w / 2; x1 = cx + w / 2; y0 = cy - h / 2; y1 = cy + h / 2;
      const wrap = document.createElement('div'); wrap.className = 'althumb';
      const im = document.createElement('img'); im.loading = 'lazy'; im.decoding = 'async'; im.width = 480; im.height = 320; im.alt = 'Satellite view of parcel ' + sp.parcel + ' with its boundary outlined';
      im.src = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=' + [x0, y0, x1, y1].map(v => v.toFixed(1)).join(',') + '&bboxSR=3857&imageSR=3857&size=480,320&format=jpg&f=image';
      const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 480 320'); svg.setAttribute('preserveAspectRatio', 'none');
      const path = document.createElementNS(NS, 'path'); path.setAttribute('d', m.g.map(ring => 'M' + ring.map(p => ((X(p[0]) - x0) / w * 480).toFixed(1) + ',' + ((y1 - Y(p[1])) / h * 320).toFixed(1)).join('L') + 'Z').join(' '));
      path.setAttribute('fill', 'rgba(255,209,102,.15)'); path.setAttribute('stroke', '#ffd166'); path.setAttribute('stroke-width', '3'); path.setAttribute('vector-effect', 'non-scaling-stroke'); svg.appendChild(path);
      im.onerror = () => { im.remove(); cap.textContent = 'Satellite image could not load · outline: ' + sp.srcName; };
      wrap.append(im, svg); host.appendChild(wrap); cap.textContent = 'Satellite: Esri World Imagery (dates vary) · outline: ' + sp.srcName; host.appendChild(cap);
    });
  },
  async open(sp) {
    const mk = (t, cl, x) => { const e = document.createElement(t); if (cl) e.className = cl; if (x != null) e.textContent = x; return e; };
    let dlg = document.getElementById('aldlg'); if (dlg) dlg.remove();
    dlg = mk('dialog', 'lotdlg'); dlg.id = 'aldlg'; document.body.appendChild(dlg);
    const head = mk('div', 'ustop'); head.append(mk('b', '', 'Parcel ' + sp.parcel)); const x = mk('button', 'btn small', 'Close'); x.type = 'button'; x.onclick = () => dlg.close(); head.append(x); dlg.appendChild(head);
    dlg.appendChild(mk('p', 'small', sp.desc || ''));
    const box = mk('div', 'lotmap'); box.style.height = '340px'; dlg.appendChild(box);
    const note = mk('p', 'small muted', 'Loading…'); dlg.appendChild(note);
    dlg.addEventListener('close', () => dlg.remove()); dlg.showModal();
    const f = await this.outline(sp.file), m = f && f.p[sp.key];
    if (!m) { box.remove(); note.textContent = 'Location not found on the map: this parcel ID is not in the ' + sp.srcName + ' parcel layer (it may have been split, merged or renumbered). No preview shown.'; return; }
    let L; try { L = await this.lib(); } catch (e) { note.textContent = 'The map could not load.'; return; }
    const map = L.map(box, {zoomControl: true, attributionControl: true});
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {maxZoom: 20, maxNativeZoom: 19, attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics'}).addTo(map);
    const g = L.geoJSON({type: 'Feature', properties: {}, geometry: {type: 'Polygon', coordinates: m.g}}, {style: {color: '#ffd166', weight: 3, fillColor: '#ffd166', fillOpacity: 0.15}}).addTo(map);
    map.fitBounds(g.getBounds(), {maxZoom: 19, padding: [30, 30]});
    note.textContent = 'Outline from ' + sp.srcName + ' (parcel ' + m.cid + '), matched by parcel ID; not a survey. Satellite imagery from Esri World Imagery, capture dates vary. Do not visit or enter the property.';
  }
};
// Alabama state-held tax delinquent land (ADOR transcripts): county filter, search, sort, show more.
const AlMap = LandMap;
// Pro-only "Download list" button: builds a CSV of the rows currently shown (after filters) in the browser.
const PaidDownload = {
  me: null,
  status() { return this.me || (this.me = fetch('/.netlify/functions/account', {credentials: 'same-origin'}).then(r => r.ok ? r.json() : null).then(d => d && d.user).catch(() => null)); },
  csv(head, rows) { const q = v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }; return [head].concat(rows).map(r => r.map(q).join(',')).join('\r\n'); },
  button(label, fileName, head, getRows) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn small ghost'; b.textContent = '⬇ ' + label + ' (Pro)';
    const msg = document.createElement('span'); msg.className = 'small muted'; msg.setAttribute('role', 'status');
    b.addEventListener('click', async () => {
      const u = await this.status();
      if (!u) { msg.innerHTML = ' <a href="/login/?next=' + encodeURIComponent(location.pathname + location.search) + '">Sign in</a> to download. Downloads are for Pro members.'; return; }
      if (!u.paid) { msg.innerHTML = ' Downloads are for Pro members. <a href="/account/">See the Pro plan</a>'; return; }
      const blob = new Blob(['﻿' + this.csv(head, getRows())], {type: 'text/csv;charset=utf-8'});
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileName; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      msg.textContent = ' Downloaded.';
    });
    const w = document.createElement('span'); w.className = 'pdl'; w.append(b, msg); return w;
  }
};
