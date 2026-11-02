// rate = max annual-equivalent rate used only for sorting; redeem = months, for sorting.
const STATES = [
  {n:'Florida', a:'FL', sys:'Tax lien certificate', rate:'Up to 18%', r:18, red:'2 years before the holder can apply for a tax deed', m:24, bid:'Bid-down rate', note:'Bidding starts at the maximum and goes down, so winning rates are often much lower.'},
  {n:'New Jersey', a:'NJ', sys:'Tax lien certificate', rate:'Up to 18% (+ possible redemption penalty up to 6%)', r:18, red:'2 years', m:24, bid:'Premium bidding', note:'High-rate bids can switch to premiums paid above the tax owed.'},
  {n:'Arizona', a:'AZ', sys:'Tax lien certificate', rate:'Up to 16%', r:16, red:'3 years (some sources: until court judgment)', m:36, bid:'Bid-down rate', note:'Sources differ on the redemption window; confirm with the county.'},
  {n:'Illinois', a:'IL', sys:'Tax lien certificate', rate:'Up to 18% per 6 months (penalty)', r:36, red:'2 to 3 years', m:30, bid:'Bid-down rate', note:'A penalty-based system: the owner pays a penalty per redemption period.'},
  {n:'Indiana', a:'IN', sys:'Tax lien certificate', rate:'10% to 25% (sources differ)', r:25, red:'1 year', m:12, bid:'Premium bidding', note:'Sources disagree on the rate; check the county before bidding.'},
  {n:'Iowa', a:'IA', sys:'Tax lien certificate', rate:'24% flat', r:24, red:'1 year 9 months', m:21, bid:'Rotational', note:'No bidding. Assigned in rotation at a fixed rate.'},
  {n:'Maryland', a:'MD', sys:'Tax lien certificate', rate:'Varies by county', r:0, red:'6 months to 2 years', m:24, bid:'Premium bidding', note:'Rates and rules vary a lot by jurisdiction.'},
  {n:'Wyoming', a:'WY', sys:'Tax lien certificate', rate:'Up to 15% first year, 18% after', r:18, red:'4 years', m:48, bid:'Bid-down rate', note:'Long redemption window means capital can be tied up.'},
  {n:'Texas', a:'TX', sys:'Redeemable deed', rate:'25% penalty (varies)', r:25, red:'6 months to 2 years, depending on property type', m:24, bid:'Not applicable', note:'You buy the deed, and the owner may buy it back with a penalty.'}
];
const $ = id => document.getElementById(id);
const esc = s => s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function render() {
  const q = $('q').value.trim().toLowerCase(), bid = $('bid').value, sort = $('sort').value;
  let list = STATES.filter(s => (!q || s.n.toLowerCase().includes(q) || s.a.toLowerCase() === q) && (!bid || s.bid === bid));
  list.sort((a, b) => sort === 'rate' ? b.r - a.r : sort === 'redeem' ? b.m - a.m : a.n.localeCompare(b.n));
  $('count').textContent = list.length + (list.length === 1 ? ' state' : ' states');
  $('cards').innerHTML = list.length ? list.map(s => `
    <article class="card state">
      <div class="state-top"><h3>${esc(s.n)}</h3><span class="abbr">${esc(s.a)}</span></div>
      <p class="sys">${esc(s.sys)} &middot; ${esc(s.bid)}</p>
      <dl>
        <div><dt>Interest</dt><dd>${esc(s.rate)}</dd></div>
        <div><dt>Redemption</dt><dd>${esc(s.red)}</dd></div>
      </dl>
      <p class="muted small">${esc(s.note)}</p>
    </article>`).join('') : '<p class="muted">No states match. Try clearing the search or filter.</p>';
}
['q', 'bid', 'sort'].forEach(id => $(id).addEventListener('input', render));
render();
$('yr').textContent = new Date().getFullYear();
