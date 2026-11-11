// Watch This Parcel, Parcel Timeline, Nearby Tax Sale Results and the Bid or Pass worksheet.
// Official events live in /liens/states/timeline/*.json (written by tools/imports from official county files).
// Everything shown here is either copied from an official record (with source and date) or labelled as the member's own estimate.
const PF = {
  base: '/liens/states/timeline/',
  mk(t, c, x) { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; },
  money: n => n == null || n === '' || !isFinite(n) ? '' : '$' + Number(n).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}),
  key: l => [l.state || 'FL', l.county, l.parcel, l.cert || ''].join('|'),
  parseKey(k) { const p = String(k).split('|'); return {state: p[0], county: p[1], parcel: p[2], cert: p[3] || ''}; },
  href: l => '/liens/parcel/?k=' + encodeURIComponent(PF.key(l)),
  json(url) { PF._c = PF._c || {}; return PF._c[url] || (PF._c[url] = fetch(url).then(r => r.ok ? r.json() : null).catch(() => null)); },
  index() { return PF.json(PF.base + 'index.json').then(d => (d && d.counties || []).filter(c => c.enabled)); },
  async cfg(l) { return (await PF.index()).find(c => c.state === (l.state || 'FL') && c.county === l.county) || null; },
  async tl(l) { const c = await PF.cfg(l); return c ? PF.json(PF.base + c.slug + '.json') : null; },
  api(action, body) {
    return fetch('/.netlify/functions/watch' + (body ? '' : '?action=' + action), body ? {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(Object.assign({action}, body))} : {})
      .then(async r => ({status: r.status, d: await r.json().catch(() => ({}))})).catch(() => ({status: 0, d: {}}));
  },
  // ---- signed-in state and the set of watched parcel keys
  ready: null, user: null, watched: new Set(),
  load() {
    if (!PF.ready) PF.ready = PF.api('watching').then(r => { PF.user = r.status === 200; if (r.d.keys) r.d.keys.forEach(k => PF.watched.add(k)); });
    return PF.ready;
  },
  toLogin() { location.href = '/login/?next=' + encodeURIComponent(location.pathname + location.search); },
  decisions() { return PF.json('/.netlify/functions/watch?action=reviewed').then(d => (d && d.decided) || {}); },
  visible: (e, dec) => !e.review || (e.reviewId && dec[e.reviewId] === 'approve'),

  // ---- 1. WATCH BUTTON
  watchButton(l, cls) {
    const b = PF.mk('button', cls || 'btn small ghost'); b.type = 'button'; const k = PF.key(l);
    const paint = () => { const on = PF.watched.has(k); b.textContent = on ? '👁 Watching' : '👁 Watch'; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('faved', on); b.title = on ? 'Tap to stop watching' : 'Get an alert when the county changes this parcel'; };
    paint(); PF.load().then(paint);
    b.addEventListener('click', async () => {
      await PF.load(); if (!PF.user) { PF.toLogin(); return; }
      const on = PF.watched.has(k); b.disabled = true;
      const r = await PF.api(on ? 'unwatch' : 'watch', {key: k, label: [l.county, l.parcel].join(' '), amount: l.amount, payoff: l.payoff, saleDate: l.saleDate, status: l.status});
      if (r.d.ok) { if (on) PF.watched.delete(k); else PF.watched.add(k); } else alert(r.d.error || 'Could not update your watchlist. Please try again.');
      b.disabled = false; paint();
    });
    return b;
  },
  // Cards and map dialog: shown only where we track official updates for the county.
  async cardButtons(l, host, cls) {
    const c = await PF.cfg(l); const a = PF.mk('a', cls || 'btn small ghost', 'Details & timeline'); a.href = PF.href(l); host.appendChild(a);
    if (c) host.appendChild(PF.watchButton(l, cls));
  },

  // ---- 2. PARCEL TIMELINE
  TYPE: {added_to_list: 'Added to the list', no_longer_listed: 'No longer listed', relisted: 'Listed again', amount_changed: 'Amount changed', payoff_changed: 'Payoff changed', saleDate_changed: 'Sale date changed', status_changed: 'Status changed',
    result_posted: 'Result published', redemption_confirmed: 'Redemption confirmed', withdrawn_confirmed: 'Withdrawn (official record)', auction_canceled: 'Auction canceled', auction_rescheduled: 'Auction rescheduled', notice: 'On the county list'},
  CONFIRMS: {
    notice: 'The parcel was on the county’s published list on this date. It does not show a sale, a redemption or that it is still available.',
    added_to_list: 'The parcel appeared on a newer official list. It does not show why.',
    no_longer_listed: 'The parcel was missing from a newer, complete official list. We cannot say whether it was paid, redeemed, sold or withdrawn until an official record says so.',
    relisted: 'The parcel is on the official list again.',
    amount_changed: 'Both figures come from official lists (the earlier one and the newer one).', payoff_changed: 'Both figures come from official lists.', saleDate_changed: 'Both dates come from official lists.', status_changed: 'Both statuses come from official lists.',
    result_posted: 'An official results list published this actual sale price. It is not an estimate or a minimum bid.', redemption_confirmed: 'An official record confirms the owner redeemed.', withdrawn_confirmed: 'An official record confirms it was withdrawn from the sale.',
    auction_canceled: 'An official record confirms the auction was canceled.', auction_rescheduled: 'An official record confirms the auction was rescheduled.'},
  amountLabel: l => l.priceLabel === 'Sold for' ? 'Actual sale price' : (l.state === 'CO' || l.kind === 'lien' || l.rate || l.cert) ? 'Amount owed (advertised)' : 'Amount owed (as listed)',
  fmtVal(f, v) { return v == null ? 'not listed' : (f === 'amount' || f === 'payoff' || f === 'salePrice') ? PF.money(v) : String(v); },
  async timelineData(l) {
    const key = PF.key(l), tl = await PF.tl(l), dec = await PF.decisions(), imps = await PF.json(PF.base + 'imports.json');
    const events = tl ? tl.events.filter(e => e.key === key && PF.visible(e, dec)) : [];
    const first = imps && imps.imports.filter(i => i.county === l.county && i.state === (l.state || 'FL') && i.status === 'ok' && i.kind === 'list').sort((a, b) => a.at.localeCompare(b.at))[0];
    return {key, tl, events, first, gone: tl && tl.gone && tl.gone[key]};
  },
  async timeline(host, l) {
    host.textContent = ''; host.appendChild(PF.mk('h2', '', 'Parcel timeline'));
    host.appendChild(PF.mk('p', 'small muted', 'Official events for this parcel, newest first. “Published” is the date on the county’s record; “Detected” is when we first saw it. Amounts are labeled by what they are.'));
    const D = await PF.timelineData(l), items = [];
    const nl = D.events.some(e => e.type === 'no_longer_listed') && !D.events.some(e => ['relisted', 'result_posted', 'redemption_confirmed', 'withdrawn_confirmed', 'auction_canceled'].includes(e.type) && e.detectedAt > D.events.filter(x => x.type === 'no_longer_listed').pop().detectedAt);
    if (nl && !D.events.some(e => ['result_posted', 'redemption_confirmed', 'withdrawn_confirmed'].includes(e.type))) { const n = PF.mk('p', 'notice', 'No longer listed. Outcome unconfirmed.'); n.setAttribute('role', 'status'); host.appendChild(n); }
    const rec = Object.assign({}, l, D.gone || {});
    // the notice shows what the FIRST list said: undo later changes using the earliest recorded 'old' value of each field
    ['amount', 'payoff', 'saleDate', 'status'].forEach(f => { const first = D.events.filter(e => e.type === f + '_changed').sort((x, y) => x.detectedAt.localeCompare(y.detectedAt))[0]; if (first && first.old != null) rec[f] = first.old; });
    // the original notice, built from the listing we hold for this parcel
    const lines = [];
    if (rec.amount != null && rec.priceLabel !== 'Sold for') lines.push([PF.amountLabel(rec), PF.money(rec.amount)]);
    if (rec.payoff != null) lines.push(['Payoff (total due on the list date)', PF.money(rec.payoff)]);
    if (rec.priceLabel === 'Sold for') lines.push(['Minimum bid', 'not listed']);
    if (rec.saleDate) lines.push(['Sale', rec.saleDate]);
    items.push({sort: (D.first && D.first.published) || rec.checked || '', pub: (D.first && D.first.published) || '', det: (D.first && D.first.at) || rec.checked || '', type: 'notice', text: rec.status || 'On the county list.', lines, source: {name: (D.first && D.first.sourceName) || 'County list', url: (D.first && D.first.sourceUrl) || rec.source}, official: true});
    D.events.forEach(e => {
      const lns = [];
      if (e.type === 'result_posted') lns.push(['Actual sale price', PF.money(e.new)]);
      else if (e.type === 'amount_changed') lns.push([PF.amountLabel(rec), PF.money(e.old) + ' → ' + PF.money(e.new)]);
      else if (e.type === 'payoff_changed') lns.push(['Payoff (total due)', PF.money(e.old) + ' → ' + PF.money(e.new)]);
      else if (e.type === 'saleDate_changed') lns.push(['Sale date', PF.fmtVal('saleDate', e.old) + ' → ' + PF.fmtVal('saleDate', e.new)]);
      items.push({sort: e.detectedAt, pub: e.publishedAt, det: e.detectedAt, type: e.type, text: e.text, lines: lns, source: e.source, official: e.official, id: e.id});
    });
    items.sort((a, b) => (b.det || '').localeCompare(a.det || '') || (b.type === 'notice' ? -1 : 1));
    const ol = PF.mk('ol', 'pftl');
    items.forEach(it => {
      const li = PF.mk('li', 'pftl-item pftl-' + it.type);
      const top = PF.mk('div', 'pftl-top'); top.append(PF.mk('b', '', PF.TYPE[it.type] || it.type), PF.mk('span', 'small muted', it.pub ? 'Published ' + it.pub : 'Published: date not stated'), PF.mk('span', 'small muted', 'Detected ' + (it.det || 'n/a')));
      li.appendChild(top); li.appendChild(PF.mk('p', '', it.text));
      if (it.lines.length) { const dl = PF.mk('dl', 'pftl-amts'); it.lines.forEach(x => { dl.append(PF.mk('dt', '', x[0]), PF.mk('dd', '', x[1])); }); li.appendChild(dl); }
      li.appendChild(PF.mk('p', 'small muted', 'What this confirms: ' + (PF.CONFIRMS[it.type] || '')));
      if (it.source && it.source.url) { const a = PF.mk('a', 'small', 'Source: ' + (it.source.name || 'official record')); a.href = it.source.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; li.appendChild(a); }
      ol.appendChild(li);
    });
    host.appendChild(ol);
    if (D.tl && D.tl.lastVerified) host.appendChild(PF.mk('p', 'small muted', 'Last successful import: ' + D.tl.lastVerified.at + (D.tl.lastVerified.published ? ' (county file dated ' + D.tl.lastVerified.published + ')' : '') + '. If an import fails or looks incomplete, we keep the last verified status and send no alerts.'));
    else host.appendChild(PF.mk('p', 'small muted', 'We do not track updates for this county yet. The notice above is the listing we copied from the county, with its source and date. We add counties as their official data is ready.'));
    // other certificates / records for the same parcel are separate timelines, never merged
    const sibs = (typeof LIENS !== 'undefined' ? LIENS : []).filter(x => x.county === l.county && x.parcel === l.parcel && (x.state || 'FL') === (l.state || 'FL') && (x.cert || '') !== (l.cert || ''));
    if (sibs.length) {
      const p = PF.mk('p', 'small', 'Other certificates on this parcel (each has its own timeline): ');
      sibs.forEach((s, i) => { const a = PF.mk('a', '', s.cert || 'no number'); a.href = PF.href(s); p.append(i ? ', ' : '', a); });
      host.appendChild(p);
    }
  },

  // ---- 3. NEARBY TAX SALE RESULTS
  km: (a, b) => { const R = 3958.8, r = x => x * Math.PI / 180, dl = r(b[0] - a[0]), dn = r(b[1] - a[1]); const h = Math.sin(dl / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); },
  async nearby(host, l) {
    const c = await PF.cfg(l); if (!c || !c.results) { host.hidden = true; return; }
    host.textContent = ''; host.hidden = false; host.appendChild(PF.mk('h2', '', 'Nearby Tax Sale Results'));
    host.appendChild(PF.mk('p', 'small muted', 'These are actual auction prices: what buyers really paid at completed tax sales, from the county’s published results. They are not minimum bids or advertised amounts. Parcels that did not sell, notices and results without a verified sale price are left out. Distances use each address’s approximate location. Educational only: auction prices are not a valuation.'));
    const [res, geoF, tl, dec] = await Promise.all([PF.json(PF.base + 'results-' + c.slug + '.json'), PF.json(PF.base + 'geo-' + c.slug + '.json'), PF.tl(l), PF.decisions()]);
    if (!res || !geoF) { host.appendChild(PF.mk('p', 'muted', 'Results for this county are not loaded yet.')); return; }
    const hidden = new Set((tl ? tl.events : []).filter(e => e.type === 'result_posted' && !PF.visible(e, dec)).map(e => e.parcel));
    const geo = geoF.geo, me = geo[l.parcel];
    if (!me) { host.appendChild(PF.mk('p', 'muted', 'We could not place this parcel’s address on the map, so we cannot measure distances to other sales.')); return; }
    const pool = res.results.filter(r => r.price > 0 && geo[r.parcel] && r.parcel !== l.parcel && !hidden.has(r.parcel)).map(r => Object.assign({}, r, {d: PF.km(me, geo[r.parcel])}));
    const ctl = PF.mk('div', 'pfnear-ctl'), dist = PF.mk('select'), when = PF.mk('select'), out = PF.mk('div');
    dist.setAttribute('aria-label', 'Distance'); when.setAttribute('aria-label', 'Sale date range');
    [[0.5, 'Within 0.5 mile'], [1, 'Within 1 mile'], [2, 'Within 2 miles'], [5, 'Within 5 miles'], [10, 'Within 10 miles']].forEach(o => dist.appendChild(new Option(o[1], o[0]))); dist.value = '1';
    [[3, 'Last 3 months'], [6, 'Last 6 months'], [12, 'Last 12 months'], [36, 'Last 3 years'], [0, 'Any date']].forEach(o => when.appendChild(new Option(o[1], o[0]))); when.value = '12';
    ctl.append(dist, when); host.append(ctl, out);
    const draw = () => {
      out.textContent = ''; const mi = Number(dist.value), mo = Number(when.value), cut = mo ? new Date(Date.now() - mo * 30.4 * 864e5).toISOString().slice(0, 10) : '';
      const list = pool.filter(r => r.d <= mi && (!cut || r.date >= cut)).sort((a, b) => a.d - b.d);
      const same = (l.use || '').toLowerCase();
      if (list.length < 3) {
        out.appendChild(PF.mk('p', 'notice', list.length ? 'Only ' + list.length + ' completed sale' + (list.length === 1 ? '' : 's') + ' with a verified price in this range: too few to compare. Try a wider distance or date range.' : 'No completed sales with a verified price in this range. Try a wider distance or date range.'));
        const w = PF.mk('button', 'btn small', 'Broaden the search'); w.type = 'button'; w.addEventListener('click', () => { const di = Array.from(dist.options).findIndex(o => o.value === dist.value); if (di < dist.options.length - 1) dist.selectedIndex = di + 1; when.value = '0'; draw(); }); out.appendChild(w);
      }
      if (!list.length) return;
      const note = PF.mk('p', 'small muted', 'The county’s results list does not say whether a parcel was a vacant lot or had a building' + (same ? ' (this parcel: ' + l.use + ')' : '') + ', so results are sorted by distance only. ' + list.length + ' result' + (list.length === 1 ? '' : 's') + '.');
      out.appendChild(note);
      const ul = PF.mk('ul', 'pfnear');
      list.slice(0, 25).forEach(r => {
        const li = PF.mk('li'), t = PF.mk('div', 'pfnear-top'); t.append(PF.mk('b', '', PF.money(r.price)), PF.mk('span', 'small muted', 'actual sale price'));
        li.appendChild(t); li.appendChild(PF.mk('div', '', (r.address || 'Address not listed') + (r.city ? '' : '')));
        li.appendChild(PF.mk('div', 'small muted', r.d.toFixed(2) + ' mi away · sold ' + r.date + ' · acres: ' + (r.acres != null ? r.acres : 'not listed')));
        const row = PF.mk('div', 'pfnear-act'); const mb = PF.mk('button', 'btn small ghost', 'Open on map'); mb.type = 'button';
        const sub = (typeof LIENS !== 'undefined' ? LIENS : []).find(x => x.county === l.county && x.parcel === r.parcel) || {state: l.state, county: l.county, parcel: r.parcel};
        mb.addEventListener('click', () => LienMap.open(Object.assign({}, sub, {lat: geo[r.parcel][0], lng: geo[r.parcel][1], geoQuality: geo[r.parcel][2]})));
        const dt = PF.mk('a', 'btn small ghost', 'Details'); dt.href = PF.href(sub); const src = PF.mk('a', 'small', 'Source: ' + (res.source && res.source.name || 'county results')); src.href = res.source && res.source.url || '#'; src.target = '_blank'; src.rel = 'noopener noreferrer';
        row.append(mb, dt, src); li.appendChild(row); ul.appendChild(li);
      });
      out.appendChild(ul);
      if (list.length > 25) out.appendChild(PF.mk('p', 'small muted', 'Showing the 25 closest.'));
    };
    dist.addEventListener('change', draw); when.addEventListener('change', draw); draw();
  },
  // Used by LienMap.open when a parcel has no outline but we have its geocoded address.
  async pointMap(box, msg, l) {
    const L = await LienMap.load(); if (box._map) { box._map.remove(); box._map = null; }
    const m = L.map(box), pt = [l.lat, l.lng]; box._map = m;
    const street = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'});
    const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {maxZoom: 19, attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics'});
    street.addTo(m); L.control.layers({'Street': street, 'Satellite': sat}).addTo(m); L.circleMarker(pt, {radius: 10, color: '#ffd166', weight: 3, fillOpacity: .5}).addTo(m);
    m.setView(pt, 17); setTimeout(() => m.invalidateSize(), 50);
    msg.textContent = 'Approximate location from the address (' + (l.geoQuality === 'x' ? 'exact address match' : 'street match, position estimated') + '), not a lot outline.';
  }
};
