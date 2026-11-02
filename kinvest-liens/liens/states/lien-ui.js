// Shared renderers for the Florida sale box and the lien table.
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
    const pa = document.createElement('a'); pa.href = cfg.page(l.parcel); pa.target = '_blank'; pa.rel = 'noopener noreferrer'; pa.textContent = 'Look up the owner and tax history on the ' + cfg.pageName + ' site';
    foot.append(pa, ' \u00b7 Map data: county GIS, OpenStreetMap, Esri. Educational only; the outline is approximate and not a survey. Verify with the county.');
    if (!dlg.open) dlg.showModal();
    try {
      const url = cfg.query + '?where=' + encodeURIComponent(cfg.idField + "='" + cfg.fmt(l.parcel).replace(/'/g, '') + "'") + '&outFields=ACRES&outSR=4326&f=geojson';
      const furl = cfg.facts + '?where=' + encodeURIComponent("PARCEL_NUMBER='" + cfg.fmt(l.parcel).replace(/'/g, '') + "'") + '&outFields=PROPERTY_USE,MUNICIPALITY,TOTAL_MARKET,HMSTD_FLG,CONFID_FLG&f=json';
      const [L, r, fr] = await Promise.all([this.load(), fetch(url).then(x => { if (!x.ok) throw new Error('lookup'); return x.json(); }), fetch(furl).then(x => x.json()).catch(() => null)]);
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
  table(host, county) {
    const all = LIENS.filter(l => !county || l.county === county);
    const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x) e.textContent = x; return e; };
    host.appendChild(mk('h3', '', 'Liens' + (county ? ' in ' + county + ' County' : '')));
    if (!all.length) {
      host.appendChild(mk('p', 'muted', 'No liens are listed for this county yet. We only list liens copied from an official county list, with the source and date checked. New sale lists are expected in April and May 2027.'));
      return;
    }
    host.appendChild(mk('p', 'muted small', all.length + ' older liens (county-held certificates: not bought at the tax sale, so the county holds them). Copied from the county tax collector\u2019s official list. Face amount is the original tax debt (\u201cbelow face\u201d means the county values the lot at less than that debt, a warning sign); payoff is the total on the date of the file and keeps growing with interest. Confirm everything with the county before buying.'));
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
    tools.append(q, yr); if (hasFacts) tools.append(useSel, hideBox); tools.append(sort); host.appendChild(tools);
    const cnt = mk('p', 'muted small'); cnt.setAttribute('role', 'status'); host.appendChild(cnt);
    const wrap = mk('div', 'tablewrap'); host.appendChild(wrap);
    const more = mk('button', 'btn ghost', 'Show more'); host.appendChild(more);
    const money = n => '$' + Number(n).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    let shown = 50, list = [];
    function draw() {
      wrap.innerHTML = '';
      const t = mk('table', 'liens'), hr = t.createTHead().insertRow();
      ['County', 'Parcel (PIN)', 'Tax yr', 'Face', 'Rate', 'Payoff*', 'Sale date', 'Status', 'Use', 'County value', 'Homestead', 'Description', 'Source / checked', 'Map', 'Calc'].forEach(x => hr.appendChild(mk('th', '', x)));
      const tb = t.createTBody();
      list.slice(0, shown).forEach(l => {
        const r = tb.insertRow();
        [l.county, l.parcel, l.taxYear || '', money(l.amount), l.rate || '', l.payoff ? money(l.payoff) : '', l.saleDate, l.status, l.use || '', l.market != null ? money(l.market).replace('.00', '') + (l.market < l.amount ? ' (below face)' : '') : '', l.use ? (l.homestead ? 'Yes' : 'No') : '', l.desc || ''].forEach((x, k) => { const c = r.insertCell(); c.textContent = x; if (k === 11) c.className = 'desc'; });
        const c = r.insertCell(), a = mk('a', '', 'Source'); a.href = l.source; a.target = '_blank'; a.rel = 'noopener noreferrer'; c.append(a, ' ' + l.checked);
        const mc = r.insertCell();
        const cc = r.insertCell(), cb = mk('a', 'btn small ghost', 'Calculate');
        cb.href = '../../?' + new URLSearchParams({amount: l.amount, rate: String(l.rate || '').replace('%', ''), months: 24, fees: 0, from: l.county + ' parcel ' + l.parcel + ' (face $' + l.amount + (l.market != null && l.market < l.amount ? '; the county values the lot below the lien, so check why' : '') + ')'}).toString() + '#calculator';
        cc.appendChild(cb);
        if (PARCEL_MAPS[l.county]) { const b = mk('button', 'btn small', 'Show on map'); b.type = 'button'; b.addEventListener('click', () => LienMap.open(l)); mc.appendChild(b); }
      });
      wrap.appendChild(t);
      cnt.textContent = 'Showing ' + Math.min(shown, list.length) + ' of ' + list.length + ' (* payoff as of the source file date)';
      more.hidden = shown >= list.length;
    }
    function apply() {
      const s = q.value.trim().toLowerCase();
      list = all.filter(l => (!yr.value || String(l.taxYear) === yr.value) && (!useSel.value || l.use === useSel.value) && (!hide.checked || !STRIPS.has(l.use)) && (!s || (l.parcel + ' ' + (l.desc || '')).toLowerCase().indexOf(s) >= 0));
      list.sort((a, b) => sort.value === 'low' ? a.amount - b.amount : sort.value === 'high' ? b.amount - a.amount : (b.saleDate > a.saleDate ? 1 : -1));
      shown = 50; draw();
    }
    [q, yr, sort, useSel, hide].forEach(e => e.addEventListener('input', apply));
    more.addEventListener('click', () => { shown += 100; draw(); });
    apply();
  }
};
