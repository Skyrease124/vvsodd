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
      const url = cfg.query + '?where=' + encodeURIComponent(cfg.idField + "='" + cfg.fmt(l.parcel).replace(/'/g, '') + "'") + '&outFields=' + (cfg.facts ? 'ACRES' : cfg.idField) + '&outSR=4326&f=geojson';
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
    const g = typeof COUNTY_BUY !== 'undefined' && COUNTY_BUY[l.county]; if (!g) return null;
    const b = document.createElement('button'); b.type = 'button'; b.className = cls || 'btn small'; b.textContent = 'How to buy'; b.addEventListener('click', () => this.open(l)); return b;
  },
  open(l) {
    const g = COUNTY_BUY[l.county]; if (!g) return;
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
    host.appendChild(mk('p', 'muted small', county === 'Pinal' ? all.length + ' parcels from the Pinal County Treasurer\u2019s official Tax Lien Sale List (PDF dated 11/3/2026). Face is the total amount on the list, which is the price of the lien. County value, lot size and use come from the county\u2019s public GIS and can be low or out of date (a county value of $500 on a lot that once sold for much more is a reason to look closer). Owner names are left out. The interest rate and whether each lien is still available must be confirmed with the Treasurer; Arizona\u2019s cap is 16%. Confirm everything with the county.' : county === 'Larimer' ? all.length + ' parcels advertised for the November 19, 2026 tax lien sale, copied from the Larimer County Treasurer\u2019s official list (dated 11/3/2026). These are NOT sold yet: many owners pay before the sale, and the county updates the list nightly. Face is the delinquent tax balance; payoff adds interest and fees as of the file date; county value is the \u201cvaluation\u201d in that list. Owner names and addresses are left out. The interest rate is set by bidding at the sale, so use Calculate with the rate you expect. Confirm everything with the county.' : all.length + ' older liens (county-held certificates: not bought at the tax sale, so the county holds them). Copied from the county tax collector\u2019s official list. Face amount is the original tax debt (\u201cbelow face\u201d means the county values the lot at less than that debt, a warning sign); payoff is the total on the date of the file and keeps growing with interest. Confirm everything with the county before buying.'));
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
        cc.appendChild(cb); const bb = LienBuy.button(l, 'btn small'); if (bb) { bb.style.marginLeft = '6px'; cc.appendChild(bb); } const fv = LienSave.button(l, 'btn small ghost'); fv.style.marginLeft = '6px'; cc.appendChild(fv);
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
