// New Mexico delinquent property tax auctions (state Property Tax Division notices).
const NmAuctionsUI = {
  render(host) {
    const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
    const money = n => '$' + Number(n).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    const day = d => { const [y, m, dd] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd)).toLocaleDateString('en-US', {weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC'}); };
    NM_AUCTIONS.forEach(s => {
      const box = mk('div', 'salebox'); host.appendChild(box);
      const live = s.items.filter(i => !i.removed);
      box.appendChild(mk('h3', '', 'Upcoming tax auction: ' + s.county + ' County'));
      box.appendChild(mk('p', '', day(s.date) + ', ' + s.time + ' · ' + s.place));
      box.appendChild(mk('p', 'small', live.length + ' properties offered (' + (s.items.length - live.length) + ' more are marked REMOVED in the notice). In person, run by the NM Property Tax Division; register with the auctioneer before the start and pay in full before the auction ends. Deeds carry no title warranty, may be subject to a 120-day IRS redemption, and the former owner can challenge the sale in court for 2 years.'));
      const p = mk('p', 'small'); const a = mk('a', '', 'Official auction notice (PDF)'); a.href = s.source; a.target = '_blank'; a.rel = 'noopener noreferrer'; p.append(a, ' · last checked ' + s.checked + '. Properties can be withdrawn before the sale: check with the Property Tax Division, (505) 827-0883.'); box.appendChild(p);
      const tools = mk('div', 'lientools'); const q = mk('input'); q.type = 'search'; q.placeholder = 'Search owner, place or account'; q.setAttribute('aria-label', 'Search');
      const so = mk('select'); so.setAttribute('aria-label', 'Sort'); [['item', 'Auction order'], ['lo', 'Lowest minimum bid'], ['hi', 'Highest minimum bid']].forEach(o => so.appendChild(new Option(o[1], o[0])));
      const rl = mk('label', 'chk'); const rc = mk('input'); rc.type = 'checkbox'; rl.append(rc, ' Show removed'); tools.append(q, so, rl); tools.appendChild(PaidDownload.button('Download list', 'new-mexico-' + s.county.toLowerCase().replace(/\W+/g, '-') + '-auction.csv', ['Item', 'Case', 'Removed', 'UPC', 'Account', 'Delinquent owner', 'Location', 'Minimum bid', 'Description'], () => s.items.map(i => [i.item, i.case, i.removed ? 'yes' : '', i.upc, i.account, i.owner, i.where, i.minBid, i.desc]))); box.appendChild(tools);
      const cnt = mk('p', 'muted small'); cnt.setAttribute('role', 'status'); box.appendChild(cnt);
      const list = mk('div', 'uslist'); box.appendChild(list);
      const draw = () => {
        const s2 = q.value.trim().toLowerCase();
        const rows = s.items.filter(i => (rc.checked || !i.removed) && (!s2 || (i.owner + ' ' + i.where + ' ' + i.account + ' ' + i.upc + ' ' + i.desc).toLowerCase().includes(s2)))
          .sort((x, y) => so.value === 'lo' ? x.minBid - y.minBid : so.value === 'hi' ? y.minBid - x.minBid : x.item - y.item);
        list.textContent = '';
        rows.forEach(i => { const d = mk('div', 'usitem' + (i.removed ? ' st-withdrawn' : ''));
          const top = mk('div', 'ustop'); top.append(mk('span', 'ustype', 'Tax auction · item #' + i.item), mk('span', 'usstat', i.removed ? 'Removed from sale' : 'Scheduled')); d.appendChild(top);
          d.appendChild(mk('b', '', i.where || 'Property'));
          d.appendChild(mk('div', 'small', 'Minimum bid: ' + money(i.minBid)));
          d.appendChild(mk('div', 'small', 'Delinquent owner: ' + i.owner));
          d.appendChild(mk('div', 'small muted', 'Account ' + i.account + ' · UPC ' + i.upc + ' · case ' + i.case));
          if (i.desc) d.appendChild(mk('div', 'small muted', i.desc));
          list.appendChild(d); });
        cnt.textContent = rows.length + ' shown';
      };
      [so, rc].forEach(x => x.addEventListener('change', draw)); q.addEventListener('input', draw); draw();
    });
  }
};
