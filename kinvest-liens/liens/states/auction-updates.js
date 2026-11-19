// Auction Updates (parcel pages), sale-event notices and County news (the county "Local News & Notices" tab), and portfolio badges.
// Official sources only for auctions (upcoming-sales.json, built by tools/taxsales/build.py). County news is kept apart and is never shown as a parcel update.
// Needs upcoming-sales.js (UpcomingSales) loaded first.
// Pages without lien-ui.js (the watchlist) get the same paid-member gate here.
if (typeof PaidGate === 'undefined') window.PaidGate = {
  me: null,
  user() { return this.me || (this.me = fetch('/.netlify/functions/account', {credentials: 'same-origin'}).then(r => r.ok ? r.json() : null).then(d => (d && d.user) || null).catch(() => null)); },
  async paid() { const u = await this.user(); return !!(u && u.paid); },
  lock(name) { const d = document.createElement('div'); d.className = 'pglock'; d.setAttribute('role', 'note'); const t = document.createElement('span'); t.className = 'pgtag'; t.textContent = 'Pro'; const b = document.createElement('b'); b.textContent = name + ' is for PricePocketPro members.'; const a = document.createElement('a'); a.className = 'btn small'; a.href = '/plans/?from=' + encodeURIComponent(location.pathname + location.search) + '&src=' + encodeURIComponent(name); a.textContent = 'See the Pro plan'; const p = document.createElement('p'); p.className = 'small'; p.appendChild(a); d.append(t, ' ', b, p); return d; }
};
const AuctionUpdates = (() => {
  const U = UpcomingSales, mk = U.mk, link = U.link;
  const norm = s => String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const CHANGED = ['rescheduled', 'postponed', 'canceled'];        // changes an official source confirmed
  const REMOVED = ['redeemed', 'withdrawn', 'sold'];

  // A listing belongs to a parcel when the county matches and the parcel ID matches, or (for auction/LAFT listings only) the auction case ID already linked to the parcel matches.
  function match(data, l) {
    const st = (l.state || 'FL').toUpperCase(), p = norm(l.parcel), c = norm(l.cert), out = [], seen = new Set();
    for (const x of data.listings) {
      if (x.county !== l.county || (x.state || 'FL') !== st) continue;
      let by = null;
      if (p && norm(x.parcel) === p) by = 'parcel';
      else if (c.length >= 4 && x.type !== 'otc' && norm(x.cert || x.deedNo) === c) by = 'case';
      if (by && !seen.has(x.key)) { seen.add(x.key); out.push({l: x, by}); }
    }
    const order = {taxdeed: 0, taxlien: 1, laft: 2, otc: 3};
    out.sort((a, b) => order[a.l.type] - order[b.l.type]);
    return out;
  }
  const eventsFor = (data, county, st) => (data.events || []).filter(e => e.county === county && (e.state || 'FL') === (st || 'FL'));

  function eventCard(e, scope) {
    const d = mk('div', 'usitem us-event st-' + e.status), eff = U.effective({county: e.county, status: e.status === 'scheduled' ? 'scheduled' : e.status});
    const top = mk('div', 'ustop'); top.append(mk('span', 'ustype', U.TYPES[e.type] + ' · sale event'), mk('span', 'usstat', eff.status === 'unverified' ? U.STATUS.unverified : (U.STATUS[e.status] || e.status)));
    d.appendChild(top);
    const h = mk('div', 'ushead'); h.append(mk('b', '', scope || 'Sale event'), mk('span', 'small muted', ' · ' + e.county + ' County · ' + e.items + ' parcels on the official list')); d.appendChild(h);
    d.appendChild(mk('div', 'small', (e.status === 'scheduled' ? 'Sale: ' : 'Original sale: ') + U.day(e.saleDate) + ', ' + U.time(e.saleTime, e.tz) + ' (county local time)'));
    U.changeBlock({status: e.status, saleDate: e.saleDate, saleTime: e.saleTime, tz: e.tz, oldDate: e.saleDate, newDate: e.newDate, newTime: e.newTime, confirmedBy: e.confirmedBy}, d);
    if (e.note) d.appendChild(mk('div', 'small', e.note));
    if (eff.status === 'unverified') d.appendChild(mk('div', 'small usnote', U.lastLine(eff, e.county)));
    const lk = mk('div', 'small uslinks'); if (e.auctionUrl) lk.append(link('Official auction listing', e.auctionUrl), ' · '); lk.append(link('Official source', e.sourceUrl || e.officialPage)); d.appendChild(lk);
    d.appendChild(mk('div', 'small muted', 'Last checked ' + (e.checked || 'unknown') + (e.published ? ' (official list dated ' + e.published + ')' : '')));
    return d;
  }

  // ---- parcel page ----
  function fill(box, data, l) {
    const body = box.querySelector('.aubody'); body.textContent = '';
    const st = (l.state || 'FL').toUpperCase(), m = match(data, l), county = l.county;
    if (m.length) {
      m.forEach(({l: x, by}) => { const w = mk('div', 'auitem'); w.appendChild(U.card(x)); w.appendChild(mk('div', 'small muted', by === 'parcel' ? 'Matched by county and parcel ID.' : 'Matched by the auction case ID linked to this parcel (' + (x.cert || x.deedNo) + '); the listing’s parcel ID is ' + x.parcel + '.')); body.appendChild(w); });
      const ids = new Set(m.map(x => x.l.saleId).filter(Boolean));
      eventsFor(data, county, st).filter(e => ids.has(e.saleId) && (e.status !== 'scheduled' || U.effective({county, status: 'scheduled'}).status === 'unverified')).forEach(e => { body.appendChild(mk('p', 'small muted', 'This sale event was updated:')); body.appendChild(eventCard(e, 'Sale event for this parcel’s listing')); });
    } else {
      body.appendChild(mk('p', 'small', 'No auction listing for this parcel in the official sale lists we load for ' + county + ' County. That does not mean there is no sale: check the official calendar.'));
      const ev = eventsFor(data, county, st);
      if (ev.length) { body.appendChild(mk('p', 'small muted', 'County-level notices (about the sale event, not about this parcel):')); ev.forEach(e => body.appendChild(eventCard(e, 'County sale event'))); }
    }
    body.appendChild(U.calendarNote(data, county));
    const n = mk('p', 'small muted'); n.append('Local news about ' + county + ' County is kept separate, under ', link('Local News & Notices', '/liens/states/county/?c=' + encodeURIComponent(county) + '#news'), '. News is never shown here as an update about this parcel.'); body.appendChild(n);
    body.appendChild(mk('p', 'small muted', 'Only changes an official source confirmed are shown as rescheduled, postponed or canceled. Properties can be redeemed or pulled up to the start of a sale: check the official site the morning of the sale.'));
  }
  function section(l) {
    const box = mk('div', 'precord aubox'); box.appendChild(mk('h4', '', 'Auction Updates'));
    const body = mk('div', 'aubody'); body.appendChild(mk('p', 'small muted', 'Checking the official sale lists…')); box.appendChild(body);
    PaidGate.paid().then(p => { if (!p) { body.textContent = ''; body.appendChild(PaidGate.lock('Auction Updates')); return; } return U.load().then(d => fill(box, d, l)); }).catch(() => { body.textContent = ''; body.appendChild(mk('p', 'notice', 'Auction updates are unavailable right now.')); body.appendChild(mk('p', 'small muted', 'Check the county’s official auction calendar.')); });
    return box;
  }

  // ---- county tab: official notices, then (separately) county news ----
  const TOPIC = {zoning: 'Zoning', roads: 'Roads & construction', flood: 'Flooding & storms', infra: 'Infrastructure', development: 'Development'};
  function newsBlock(county, state) {
    const box = mk('div', 'cnews'), list = mk('div'); box.appendChild(list);
    const ask = async () => { const r = await fetch('/.netlify/functions/countynews?' + new URLSearchParams({state, county})); return r.json(); };
    const run = async () => {
      list.textContent = ''; list.appendChild(mk('p', 'small muted', 'Looking for recent stories about ' + county + ' County…'));
      let d; try {
        d = await ask();
        // the first search for a county runs in the background (the news index can take a minute): check back every few seconds
        for (let n = 0; d && d.ok === true && d.pending && n < 14; n++) { list.firstChild.textContent = 'Searching for recent stories about ' + county + ' County. The first search for a county can take up to a minute…'; await new Promise(r => setTimeout(r, 6000)); if (!box.isConnected) return; d = await ask(); }
        if (!d || d.ok !== true || d.pending || !Array.isArray(d.articles)) throw new Error('bad');
      } catch (e) {
        list.textContent = ''; list.appendChild(mk('p', 'notice', 'County news temporarily unavailable'));
        const b = mk('button', 'btn small ghost', 'Try again'); b.type = 'button'; b.addEventListener('click', run); list.appendChild(b); return; }
      list.textContent = '';
      if (d.stale) list.appendChild(mk('p', 'small usnote', 'The news service did not answer, so these are saved results from ' + U.stamp(d.fetchedAt) + '.'));
      if (!d.articles.length) list.appendChild(mk('p', 'camnone', 'No recent stories found for ' + county + ' County.' + (d.found ? ' (' + d.found + ' search hits were set aside: their headlines did not name the county or one of the topics.)' : '')));
      else { const ul = mk('ul', 'newslist'); d.articles.forEach(a => {
        const li = mk('li'), t = mk('div', 'small'); t.append(mk('span', 'newstag', 'County news')); (a.topics || []).forEach(k => t.append(' ', mk('span', 'newstopic', TOPIC[k] || k))); li.appendChild(t);
        const h = link(a.title, a.url); h.className = 'newshead'; li.appendChild(h);
        li.appendChild(mk('div', 'small muted', [a.domain, a.date ? U.day(a.date) : 'date not available'].filter(Boolean).join(' · '))); ul.appendChild(li); }); list.appendChild(ul); }
      const src = mk('p', 'small muted'); src.append('Headlines are found through the ', link('GDELT Project', 'https://www.gdeltproject.org/'), ' news index (checked ' + U.stamp(d.fetchedAt) + '). Topics searched: rezoning, road construction, flooding, infrastructure and development. These are not official notices and are not about a specific parcel.'); list.appendChild(src);
    };
    run(); return box;
  }
  async function tab(host, county, state) {
    host.textContent = '';
    if (!(await PaidGate.paid())) { host.appendChild(mk('h2', '', 'Local News & Notices')); host.appendChild(PaidGate.lock('Official auction notices and county news')); return false; }
    host.appendChild(mk('h2', '', 'Official auction notices'));
    host.appendChild(mk('p', 'small muted', 'From official county clerk and tax collector sources. Only changes an official source confirmed are shown as rescheduled, postponed or canceled.'));
    const notices = mk('div'); host.appendChild(notices); notices.appendChild(mk('p', 'small muted', 'Checking the official sale lists…'));
    host.appendChild(mk('h2', '', 'County news'));
    host.appendChild(mk('p', 'small muted', 'Separate from official notices. Stories are matched to the county and state, not to your parcel.'));
    host.appendChild(newsBlock(county, state));
    try {
      const data = await U.load(); notices.textContent = '';
      const ev = eventsFor(data, county, state);
      if (ev.length) ev.forEach(e => notices.appendChild(eventCard(e))); else notices.appendChild(mk('p', 'small', 'No sale events are loaded for ' + county + ' County.'));
      notices.appendChild(U.calendarNote(data, county));
      return ev.some(e => e.status !== 'scheduled');
    } catch (e) { notices.textContent = ''; notices.appendChild(mk('p', 'notice', 'Auction notices are unavailable right now.')); return false; }
  }

  // ---- portfolio (favorites and watchlist): confirmed changes on saved parcels ----
  async function badge(host, s) {
    if (!(await PaidGate.paid())) return;
    let data; try { data = await U.load(); } catch (e) { return; }
    const m = match(data, {county: s.county, parcel: s.parcel, cert: s.cert || (s.certList && s.certList[0]) || '', state: s.state || 'FL'});
    const lines = [];
    m.forEach(({l: x}) => {
      const eff = U.effective(x);
      if (CHANGED.includes(x.status) || REMOVED.includes(x.status)) { const w = mk('div', 'ausaved'); w.appendChild(mk('b', '', 'Auction update: ' + (U.STATUS[x.status] || x.status) + ' · ' + U.TYPES[x.type])); if (x.type === 'taxdeed') U.changeBlock(x, w); else if (x.statusNote) w.appendChild(mk('div', 'small', x.statusNote)); lines.push(w); }
      else if (eff.status === 'unverified') { const w = mk('div', 'ausaved'); w.appendChild(mk('b', '', 'Auction status unverified')); w.appendChild(mk('div', 'small', U.lastLine(eff, x.county))); lines.push(w); }
    });
    eventsFor(data, s.county, s.state || 'FL').filter(e => e.status !== 'scheduled' && m.some(x => x.l.saleId === e.saleId)).forEach(e => { const w = mk('div', 'ausaved'); w.appendChild(mk('b', '', 'Sale update: ' + (U.STATUS[e.status] || e.status) + ' · ' + U.TYPES[e.type])); U.changeBlock({status: e.status, saleDate: e.saleDate, saleTime: e.saleTime, tz: e.tz, oldDate: e.saleDate, newDate: e.newDate, newTime: e.newTime, confirmedBy: e.confirmedBy}, w); lines.push(w); });
    lines.forEach(w => host.appendChild(w));
  }
  return {match, eventsFor, eventCard, section, tab, badge, newsBlock, norm};
})();
