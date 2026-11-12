// "Upcoming Tax Sales" for Florida county pages and the Florida page: data from upcoming-sales.json (tools/taxsales/build.py).
// Sale types are kept apart and always labeled: Tax deed auction / County-held lien (OTC) / Lands Available for Taxes.
const UpcomingSales = (() => {
  const TYPES = {taxdeed: 'Tax deed auction', otc: 'County-held lien (OTC)', laft: 'Lands Available for Taxes'};
  const STATUS = {scheduled: 'Scheduled', available: 'Available', redeemed: 'Redeemed – removed from sale', canceled: 'Canceled', rescheduled: 'Rescheduled',
    withdrawn: 'Withdrawn – removed from sale', sold: 'Sold', gone: 'No longer listed · outcome unconfirmed'};
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const link = (txt, href) => { const a = mk('a', '', txt); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; };
  const money = n => '$' + Number(n).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  const day = d => { if (!d) return ''; const [y, m, dd] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd)).toLocaleDateString('en-US', {weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'}); };
  const time = (t, tz) => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return ((h % 12) || 12) + ':' + String(m).padStart(2, '0') + (h < 12 ? ' AM ' : ' PM ') + (tz || 'ET'); };
  let dataP = null;
  const load = () => dataP || (dataP = fetch('/liens/states/upcoming-sales.json').then(r => { if (!r.ok) throw new Error(); return r.json(); }));

  function card(l) {
    const d = mk('div', 'usitem us-' + l.type + ' st-' + l.status);
    const top = mk('div', 'ustop'); top.append(mk('span', 'ustype', TYPES[l.type]), mk('span', 'usstat', STATUS[l.status] || l.status)); d.appendChild(top);
    const h = mk('div', 'ushead'); h.append(mk('b', '', 'Parcel ' + l.parcel), mk('span', 'small muted', ' · ' + l.county + ' County' + (l.cert ? ' · certificate ' + l.cert : ''))); d.appendChild(h);
    if (l.type === 'taxdeed') d.appendChild(mk('div', 'small', 'Sale: ' + day(l.saleDate) + ', ' + time(l.saleTime, l.tz) + (l.status === 'rescheduled' && l.newDate ? ' → moved to ' + day(l.newDate) : '')));
    if (l.type === 'laft') d.appendChild(mk('div', 'small', 'Not an auction: offered at tax deed sale' + (l.offeredDate ? ' on ' + day(l.offeredDate) : '') + ' with no buyer; can be bought from the Clerk for the listed balance' + (l.deedNo ? ' \u00B7 tax deed #' + l.deedNo : '') + '.'));
    if (l.type === 'otc') d.appendChild(mk('div', 'small', 'Not an auction: the county holds this certificate and sells it over the counter.'));
    d.appendChild(mk('div', 'small', l.openingBid != null ? (l.type === 'otc' ? 'Listed amount: ' : l.type === 'laft' ? 'Balance to buy: ' : 'Opening bid: ') + money(l.openingBid) : 'Opening bid: not published in the official file we have'));
    if (l.openingBidNote && l.openingBid != null && l.type === 'taxdeed') d.appendChild(mk('div', 'small muted', l.openingBidNote));
    if (l.statusNote) d.appendChild(mk('div', 'small usnote', l.statusNote));
    if (l.owner || l.ownerAddress || l.situs) d.appendChild(mk('div', 'small', [l.owner ? 'Owner: ' + l.owner : '', l.ownerAddress ? 'Mailing: ' + l.ownerAddress : '', l.situs ? 'Property: ' + l.situs : ''].filter(Boolean).join(' · ')));
    if (l.legal) d.appendChild(mk('div', 'small muted', 'Legal: ' + l.legal));
    if (l.assessed != null) d.appendChild(mk('div', 'small muted', 'Assessed value (property appraiser): ' + money(l.assessed).replace('.00', '') + (l.homestead ? ' · homestead' : '')));
    if (l.alsoListed) d.appendChild(mk('div', 'small muted', 'Same parcel is also listed as: ' + l.alsoListed.map(t => TYPES[t]).join(', ')));
    const lk = mk('div', 'small uslinks');
    if (l.auctionUrl) lk.append(link('Official auction site', l.auctionUrl), ' · ');
    lk.append(link(l.type === 'otc' ? 'Official county list' : 'Official source', l.sourceUrl || l.officialPage));
    if (l.type === 'otc') lk.append(' · ', (() => { const a = mk('a', '', 'Parcel details'); a.href = '/liens/parcel/?k=' + encodeURIComponent(['FL', l.county, l.parcel, l.cert || ''].join('|')); return a; })());
    lk.append(' \u00B7 ', (() => { const a = mk('a', '', 'Ask the County'); a.href = '/account/ask-county/?' + new URLSearchParams({state: l.state || 'FL', county: l.county, parcel: l.parcel, kind: 'status'}); return a; })());
    d.appendChild(lk);
    d.appendChild(mk('div', 'small muted', 'Last checked ' + (l.checked || 'unknown') + (l.published ? ' (official list dated ' + l.published + ')' : '') + (l.liveCalendar ? '. ' + l.liveCalendar : '')));
    return d;
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
        (cb.checked || ['scheduled', 'available', 'rescheduled'].includes(l.status)));
      const hidden = all.filter(l => !['scheduled', 'available', 'rescheduled'].includes(l.status)).length;
      list.textContent = ''; rows.slice(0, shown).forEach(l => list.appendChild(card(l)));
      sum.textContent = rows.length + ' listing' + (rows.length === 1 ? '' : 's') + (cb.checked || !hidden ? '' : ' (' + hidden + ' redeemed, withdrawn or no longer listed are hidden)') + '.';
      more.hidden = rows.length <= shown;
    };
    [sc, st, sd, cb].filter(Boolean).forEach(x => x.addEventListener('change', () => { shown = 40; draw(); }));
    more.addEventListener('click', () => { shown += 40; draw(); });
    draw();
  }
  return {mount, load, TYPES, STATUS};
})();
