// "Upcoming Tax Sales" for Florida county pages and the Florida page: data from upcoming-sales.json (tools/taxsales/build.py).
// Sale types are kept apart and always labeled: Tax deed auction / County-held lien (OTC) / Lands Available for Taxes.
const UpcomingSales = (() => {
  const TYPES = {taxdeed: 'Tax deed auction', taxlien: 'Tax lien certificate sale', otc: 'County-held lien (OTC)', laft: 'Lands Available for Taxes'};
  const STATUS = {scheduled: 'Scheduled', available: 'Available', redeemed: 'Redeemed – removed from sale', canceled: 'Canceled', rescheduled: 'Rescheduled',
    withdrawn: 'Withdrawn – removed from sale', sold: 'Sold', postponed: 'Postponed', gone: 'No longer listed · outcome unconfirmed', unverified: 'Status unverified'};
  const SHOWN = ['scheduled', 'available', 'rescheduled', 'postponed', 'canceled'];   // everything else is tucked behind "Show redeemed, withdrawn and unlisted"
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const link = (txt, href) => { const a = mk('a', '', txt); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; };
  const money = n => '$' + Number(n).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  const day = d => { if (!d) return ''; const [y, m, dd] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd)).toLocaleDateString('en-US', {weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'}); };
  const time = (t, tz) => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return ((h % 12) || 12) + ':' + String(m).padStart(2, '0') + (h < 12 ? ' AM ' : ' PM ') + (tz || 'ET'); };
  let dataP = null, cur = null;
  const load = () => dataP || (dataP = fetch('/liens/states/upcoming-sales.json').then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(d => (cur = d)));
  const stamp = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('en-US', {month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'}); };
  const health = c => cur && cur.counties && cur.counties[c] && cur.counties[c].health || null;
  // What to show for a listing: its recorded status, or "Status unverified" when it vanished from the official list or the county's official page could not be checked.
  const effective = l => {
    if (l.status === 'gone') return {status: 'unverified', why: 'gone', last: l.lastSeen || l.checked || ''};
    const h = health(l.county);
    if (['scheduled', 'available'].includes(l.status) && h && h.ok === false) return {status: 'unverified', why: 'source', last: h.lastSuccess || ''};
    return {status: l.status};
  };
  const lastLine = (eff, county) => {
    if (eff.why === 'gone') return 'Status unverified. This item is no longer on the official list, and the list does not say why. Last seen listed: ' + (eff.last ? (/^\d{4}-\d{2}-\d{2}$/.test(eff.last) ? day(eff.last) : eff.last) : 'date unknown') + '. It may have been redeemed, withdrawn, sold or moved: confirm with the official source.';
    return 'Status unverified. The official page for ' + county + ' County could not be checked just now. Last successful check: ' + (eff.last ? stamp(eff.last) : 'none recorded') + '.';
  };
  // "Confirmed by <source>" plus, for a date change, the old and new dates.
  function changeBlock(l, wrap) {
    if (!['rescheduled', 'postponed', 'canceled'].includes(l.status)) return;
    const when = (d, t) => day(d) + (t ? ', ' + time(t, l.tz) : '');
    if (l.status === 'rescheduled') wrap.appendChild(mk('div', 'small usnote', 'Date changed: ' + when(l.oldDate || l.saleDate, l.saleTime) + ' \u2192 ' + when(l.newDate, l.newTime || l.saleTime)));
    else if (l.status === 'postponed') wrap.appendChild(mk('div', 'small usnote', 'Postponed' + (l.newDate ? ' to ' + when(l.newDate, l.newTime) : ': a new date has not been announced') + '. Original date: ' + when(l.saleDate, l.saleTime)));
    else wrap.appendChild(mk('div', 'small usnote', 'Canceled. Original date: ' + when(l.saleDate, l.saleTime)));
    if (l.confirmedBy) { const c = mk('div', 'small muted', 'Confirmed by ' + l.confirmedBy.name + ' on ' + l.confirmedBy.date + ' \u00B7 '); c.appendChild(link('official notice', l.confirmedBy.url)); wrap.appendChild(c); }
  }

  // Countdown + viewer's local time, computed in the browser (no outside time service).
  const ZONES = {ET: 'America/New_York', CT: 'America/Chicago', MT: 'America/Denver', PT: 'America/Los_Angeles'};
  const instant = (d, t, tz) => { // sale date/time in the county's zone -> Date
    if (!d || !t) return null; const zone = ZONES[tz || 'ET']; if (!zone) return null;
    const [y, mo, dd] = d.split('-').map(Number), [h, mi] = t.split(':').map(Number);
    let u = Date.UTC(y, mo - 1, dd, h, mi);
    for (let i = 0; i < 2; i++) { const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric'}).formatToParts(new Date(u)).map(x => [x.type, x.value]));
      u += Date.UTC(y, mo - 1, dd, h, mi) - Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute); }
    return new Date(u);
  };
  const countdown = at => { const ms = at - Date.now(); if (ms <= 0) return null; const m = Math.floor(ms / 60000), dd = Math.floor(m / 1440), hh = Math.floor(m % 1440 / 60), mm = m % 60;
    return 'Starts in ' + (dd ? dd + ' day' + (dd > 1 ? 's' : '') + ', ' : '') + hh + ' hr' + (dd ? '' : ', ' + mm + ' min'); };
  function whenLine(l) {
    const at = instant(l.saleDate, l.saleTime, l.tz); if (!at || !['scheduled'].includes(l.status)) return null;
    const cd = countdown(at); if (!cd) return null;
    const me = Intl.DateTimeFormat().resolvedOptions().timeZone, zone = ZONES[l.tz || 'ET'];
    const fmt = z => at.toLocaleString('en-US', {timeZone: z, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'});
    const local = me && fmt(me) !== fmt(zone) ? ' \u00B7 your time: ' + fmt(me) : '';
    const e = mk('div', 'small uscount', cd + local); e.dataset.at = at.getTime(); e.dataset.local = local; return e;
  }

  // Cape Coral city records (City of Cape Coral GIS Ownership layer, built by tools/capecoral/build.mjs). Shown only for Lee parcels the city layer matched by parcel ID.
  let capeData = null;
  const capeLoad = () => capeData || (capeData = fetch('/liens/states/capecoral-facts.json').then(r => r.ok ? r.json() : null).catch(() => null));
  function capeBlock(l) {
    const box = mk('div', 'small capebox'); box.hidden = true;
    capeLoad().then(d => {
      const f = d && d.facts && d.facts[String(l.parcel || '').replace(/[-.\s]/g, '').toUpperCase()]; if (!f) return;
      const rows = [];
      if (f.zoning || f.flu) rows.push(['Zoning / future land use', [f.zoning, f.flu].filter(Boolean).join(' / ')]);
      if (f.acres != null) rows.push(['Size', f.acres + ' acres']);
      if (f.water || f.sewer) rows.push(['City water / sewer available', 'Water: ' + (f.water || 'not stated') + ' \u00B7 Sewer: ' + (f.sewer || 'not stated')]);
      if (f.canal) rows.push(['Canal', f.canal]);
      if (f.owl || f.turtle) rows.push(['Wildlife zones on city map', [f.owl ? 'Owl zone' : '', f.turtle ? 'Turtle zone' : ''].filter(Boolean).join(', ')]);
      if (f.assessed != null) rows.push(['Assessed value', money(f.assessed).replace('.00', '') + (f.land != null || f.bldg != null ? ' (land ' + money(f.land || 0).replace('.00', '') + ', building ' + money(f.bldg || 0).replace('.00', '') + ')' : '')]);
      if (f.saleDate) rows.push(['Last recorded sale', new Date(f.saleDate + 'T12:00:00Z').toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'}) + (f.saleAmt ? ' for ' + money(f.saleAmt).replace('.00', '') : '')]);
      if (!rows.length) return;
      box.appendChild(mk('b', '', 'Cape Coral city records')); rows.forEach(r => { const row = mk('div'); row.append(mk('span', 'muted', r[0] + ': '), document.createTextNode(r[1])); box.appendChild(row); });
      const n = mk('div', 'small muted'); n.append('Source: ', link(d.source.name, d.source.url), ', checked ' + d.source.checked + '. City records can be out of date: verify water, sewer, zoning and any wildlife limits with the City of Cape Coral and the county before you bid.');
      if (f.leepa) { n.append(' \u00B7 '); n.append(link('Lee County Property Appraiser record', f.leepa)); }
      box.appendChild(n); box.hidden = false;
    });
    return box;
  }

  function card(l) {
    const d = mk('div', 'usitem us-' + l.type + ' st-' + l.status);
    const eff = effective(l);
    const top = mk('div', 'ustop'); top.append(mk('span', 'ustype', TYPES[l.type]), mk('span', 'usstat', STATUS[eff.status] || eff.status)); d.appendChild(top);
    if (eff.status === 'unverified') d.classList.add('st-unverified');
    const h = mk('div', 'ushead'); h.append(mk('b', '', 'Parcel ' + l.parcel), mk('span', 'small muted', ' · ' + l.county + ' County' + (l.cert ? ' · certificate ' + l.cert : ''))); d.appendChild(h);
    if (l.type === 'taxdeed') { d.appendChild(mk('div', 'small', (['rescheduled', 'postponed', 'canceled'].includes(l.status) ? 'Original sale: ' : 'Sale: ') + day(l.saleDate) + ', ' + time(l.saleTime, l.tz) + ' (county local time)')); changeBlock(l, d); }
    if (l.type === 'taxdeed' && eff.status !== 'unverified') { const w = whenLine(l); if (w) d.appendChild(w); }
    if (l.type === 'laft') d.appendChild(mk('div', 'small', 'Not an auction: offered at tax deed sale' + (l.offeredDate ? ' on ' + day(l.offeredDate) : '') + ' with no buyer; can be bought from the Clerk for the listed balance' + (l.deedNo ? ' \u00B7 tax deed #' + l.deedNo : '') + '.'));
    if (l.type === 'otc') d.appendChild(mk('div', 'small', 'Not an auction: the county holds this certificate and sells it over the counter.'));
    d.appendChild(mk('div', 'small', l.openingBid != null ? (l.type === 'otc' ? 'Listed amount: ' : l.type === 'laft' ? 'Balance to buy: ' : 'Opening bid: ') + money(l.openingBid) : 'Opening bid: not published in the official file we have'));
    if (l.openingBidNote && l.openingBid != null && l.type === 'taxdeed') d.appendChild(mk('div', 'small muted', l.openingBidNote));
    if (eff.status === 'unverified') d.appendChild(mk('div', 'small usnote', lastLine(eff, l.county)));
    else if (l.statusNote && !['rescheduled', 'postponed', 'canceled'].includes(l.status)) d.appendChild(mk('div', 'small usnote', l.statusNote));
    if (l.owner || l.ownerAddress || l.situs) d.appendChild(mk('div', 'small', [l.owner ? 'Owner: ' + l.owner : '', l.ownerAddress ? 'Mailing: ' + l.ownerAddress : '', l.situs ? 'Property: ' + l.situs : ''].filter(Boolean).join(' · ')));
    if (l.legal) d.appendChild(mk('div', 'small muted', 'Legal: ' + l.legal));
    if (l.assessed != null) d.appendChild(mk('div', 'small muted', 'Assessed value (property appraiser): ' + money(l.assessed).replace('.00', '') + (l.homestead ? ' · homestead' : '')));
    if (l.alsoListed) d.appendChild(mk('div', 'small muted', 'Same parcel is also listed as: ' + l.alsoListed.map(t => TYPES[t]).join(', ')));
    if (l.county === 'Lee' && (l.state || 'FL') === 'FL') d.appendChild(capeBlock(l));
    const lk = mk('div', 'small uslinks');
    if (l.auctionUrl) lk.append(link('Official auction site', l.auctionUrl), ' · ');
    lk.append(link(l.type === 'otc' ? 'Official county list' : 'Official source', l.sourceUrl || l.officialPage));
    if (l.type === 'otc') lk.append(' · ', (() => { const a = mk('a', '', 'Parcel details'); a.href = '/liens/parcel/?k=' + encodeURIComponent(['FL', l.county, l.parcel, l.cert || ''].join('|')); return a; })());
    lk.append(' \u00B7 ', (() => { const a = mk('a', '', 'Ask the County'); a.href = '/account/ask-county/?' + new URLSearchParams({state: l.state || 'FL', county: l.county, parcel: l.parcel, kind: 'status'}); return a; })());
    d.appendChild(lk);
    d.appendChild(mk('div', 'small muted', 'Last checked ' + (l.checked || 'unknown') + (l.published ? ' (official list dated ' + l.published + ')' : '') + (l.liveCalendar ? '. ' + l.liveCalendar : '')));
    return d;
  }

  // "Open official auction calendar" + an honest note on what we do and do not track for this county.
  function calendarNote(data, county) {
    const c = data.counties[county] || {}, w = mk('div', 'uscal'), integ = c.integrated || [], auction = integ.includes('taxdeed') || integ.includes('taxlien');
    if (!auction) w.appendChild(mk('p', 'small', 'No integrated auction feed for ' + county + ' County: tax deed and tax lien sale dates, date changes and cancellations are not tracked here. Check the official calendar before you plan around any sale.'));
    if (c.calendar && c.calendar.url) { const p = mk('p', 'small'); const a = link('Open official auction calendar', c.calendar.url); a.className = 'btn small'; p.append(a, ' ', mk('span', 'muted', '(' + c.calendar.name + ')')); w.appendChild(p); }
    const h = c.health;
    w.appendChild(mk('p', 'small muted', h ? (h.ok ? 'Official page checked ' + stamp(h.lastSuccess) + '.' : 'The official page could not be checked just now. Last successful check: ' + (h.lastSuccess ? stamp(h.lastSuccess) : 'none recorded') + '.') : (c.probed === false ? 'Automatic checking is not available for this county: its site refuses automated requests, so lists come from the county\u2019s published files.' : '')));
    return w;
  }
  async function mount(host, opt = {}) {
    host.textContent = '';
    const box = mk('section', 'usbox'); host.appendChild(box);
    box.appendChild(mk('h2', '', 'Upcoming Tax Sales'));
    box.appendChild(mk('p', 'small muted', 'From official county sale lists and notices. Tax deed auctions, county-held liens (OTC) and Lands Available for Taxes are different things and are labeled separately. Properties can be redeemed or pulled up to the start of a sale: check the official site the morning of the sale.'));
    let data; try { data = await load(); } catch (e) { box.appendChild(mk('p', 'notice', 'Upcoming sales are unavailable right now.')); return; }
    const all = data.listings.filter(l => !opt.county || l.county === opt.county);
    const counties = Object.keys(data.counties).filter(c => !opt.county || c === opt.county);
    if (!counties.length) { box.appendChild(mk('p', 'small muted', 'We do not track upcoming sales for this county yet.')); return; }
    if (opt.county) box.appendChild(calendarNote(data, opt.county));
    // filters
    const f = mk('div', 'usfilters');
    const sel = (label, opts) => { const l = mk('label', 'small'); l.append(label + ' '); const s = mk('select'); opts.forEach(([v, t]) => { const o = mk('option', '', t); o.value = v; s.appendChild(o); }); l.appendChild(s); f.appendChild(l); return s; };
    const sc = opt.county ? null : sel('County', [['', 'All counties']].concat(counties.map(c => [c, c])));
    const st = sel('Sale type', [['', 'All types'], ['taxdeed', TYPES.taxdeed], ['otc', TYPES.otc], ['laft', TYPES.laft]]);
    const dates = [...new Set(all.filter(l => l.saleDate).map(l => l.saleDate))].sort();
    const sd = sel('Date', [['', 'Any date'], ['upcoming', 'Upcoming sale dates']].concat(dates.map(d => [d, day(d)])));
    const sh = mk('label', 'small'); const cb = mk('input'); cb.type = 'checkbox'; sh.style.flexDirection = 'row'; sh.append(cb, ' Show redeemed, withdrawn and unlisted'); f.appendChild(sh);
    box.appendChild(f);
    const sum = mk('p', 'small ussum'); sum.setAttribute('role', 'status'); box.appendChild(sum);
    const list = mk('div', 'uslist'); box.appendChild(list);
    const more = mk('button', 'btn small ghost', 'Show more'); more.type = 'button'; box.appendChild(more);
    // official links per county + types with nothing loaded
    const links = mk('div', 'small uscounty'); counties.forEach(c => { const p = mk('p', ''); p.append(mk('b', '', c + ': ')); Object.entries(data.counties[c].links).forEach(([t, u], i) => { if (i) p.append(' · '); p.append(link(t, u)); });
      const missing = ['taxdeed', 'laft'].filter(t => !data.listings.some(l => l.county === c && l.type === t)).map(t => TYPES[t]);
      if (missing.length) p.append(mk('span', 'muted', ' — no verified ' + missing.join(' or ') + ' list loaded yet; use the official links.'));
      links.appendChild(p); }); box.appendChild(links);
    const today = new Date().toLocaleDateString('en-CA', {timeZone: 'America/New_York'});
    let shown = 40;
    const draw = () => {
      const rows = all.filter(l => (!sc || !sc.value || l.county === sc.value) && (!st.value || l.type === st.value) &&
        (!sd.value || (sd.value === 'upcoming' ? l.saleDate >= today : l.saleDate === sd.value)) &&
        (cb.checked || SHOWN.includes(l.status)));
      const hidden = all.filter(l => !SHOWN.includes(l.status)).length;
      list.textContent = ''; rows.slice(0, shown).forEach(l => list.appendChild(card(l)));
      sum.textContent = rows.length + ' listing' + (rows.length === 1 ? '' : 's') + (cb.checked || !hidden ? '' : ' (' + hidden + ' redeemed, withdrawn or no longer listed are hidden)') + '.';
      more.hidden = rows.length <= shown;
    };
    [sc, st, sd, cb].filter(Boolean).forEach(x => x.addEventListener('change', () => { shown = 40; draw(); }));
    more.addEventListener('click', () => { shown += 40; draw(); });
    draw();
    setInterval(() => list.querySelectorAll('.uscount').forEach(e => { const c = countdown(+e.dataset.at); if (c) e.textContent = c + e.dataset.local; else e.remove(); }), 60000);
  }
  return {mount, load, calendarNote, card, effective, changeBlock, lastLine, stamp, day, time, TYPES, STATUS, SHOWN, link, mk, data: () => cur};
})();
