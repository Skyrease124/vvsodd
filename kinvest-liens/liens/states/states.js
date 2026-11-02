// rate = max annual rate for sorting only (0 = unknown or none); redeem m = months for sorting (0 = unknown or none after sale).
// v:1 = sources disagree or only one source; shown as a verify flag. Compared: TaxLien.io, LienSuite, United Tax Liens (checked Nov 2026).
const STATES = [
  {n:'Alabama', a:'AL', sys:'Hybrid', rate:'Up to 12%', r:12, red:'3 years', m:36, bid:'Other', v:0, note:'Each county picks: lien auctions or redeemable-deed sales. Sources label it differently.'},
  {n:'Alaska', a:'AK', sys:'Tax deed', rate:'None paid to investors', r:0, red:'Before the sale only (about 1 year before foreclosure judgment)', m:0, bid:'Not applicable', v:0, note:'No lien sale. Local governments foreclose and auction the property.'},
  {n:'Arizona', a:'AZ', sys:'Tax lien certificate', rate:'Up to 16%', r:16, red:'3 years', m:36, bid:'Bid-down rate', v:0, note:'Bidding starts at the cap and goes down. No foreclosure for 3 years.'},
  {n:'Arkansas', a:'AR', sys:'Sources differ', rate:'None paid to investors', r:0, red:'Verify: recent law says none after the sale; an older source says 2 years', m:0, bid:'Other', v:1, note:'State sells the land. Sources disagree on whether the owner can still redeem after the sale.'},
  {n:'California', a:'CA', sys:'Tax deed', rate:'None paid to investors', r:0, red:'Before the sale only (about 5 years in default)', m:0, bid:'Not applicable', v:0, note:'No lien sale. The county auctions the property itself.'},
  {n:'Colorado', a:'CO', sys:'Tax lien certificate', rate:'Federal discount rate + 9 points (about 13% in 2026)', r:13, red:'3 years', m:36, bid:'Premium bidding', v:0, note:'You bid a premium above the tax owed; the rate is set by formula.'},
  {n:'Connecticut', a:'CT', sys:'Sources differ', rate:'18% a year', r:18, red:'6 months', m:6, bid:'Other', v:0, note:'Town-run sale. One source calls it a lien, another a redeemable deed.'},
  {n:'Delaware', a:'DE', sys:'Redeemable deed', rate:'Verify (one source: flat 15% on the price, not yearly)', r:0, red:'60 days', m:2, bid:'Other', v:1, note:'Sheriff sale of the property. Short owner buy-back window.'},
  {n:'District of Columbia', a:'DC', sys:'Tax lien certificate', rate:'Verify (one source: 18% a year, none on the overbid)', r:0, red:'Verify (one source: 6+ months, until a court forecloses)', m:0, bid:'Premium bidding', v:1, note:'Only one source checked for DC. Confirm with the DC Office of Tax and Revenue.'},
  {n:'Florida', a:'FL', sys:'Tax lien certificate', rate:'Up to 18%', r:18, red:'2 years before the holder can apply for a tax deed', m:24, bid:'Bid-down rate', v:0, note:'Bidding starts at the maximum and goes down, so winning rates are often much lower.'},
  {n:'Georgia', a:'GA', sys:'Redeemable deed', rate:'20% penalty in year one (more in later years)', r:20, red:'12 months, then until a notice is served', m:12, bid:'Other', v:0, note:'You get the deed; the owner can buy it back by paying a premium.'},
  {n:'Hawaii', a:'HI', sys:'Redeemable deed', rate:'Verify (one source: 12% a year on the price)', r:0, red:'1 year', m:12, bid:'Other', v:1, note:'County-run sale of the property. Rate seen in only one source.'},
  {n:'Idaho', a:'ID', sys:'Tax deed', rate:'None paid to investors', r:0, red:'Before the sale only (about 14 months)', m:0, bid:'Not applicable', v:0, note:'Cash auction of the property; redemption ends before the sale.'},
  {n:'Illinois', a:'IL', sys:'Tax lien certificate', rate:'Verify: sources differ (9% vs 18% per 6 months)', r:0, red:'About 2 to 3 years (verify)', m:30, bid:'Bid-down rate', v:1, note:'Penalty-based and bid down. Rate cap changed recently; sources disagree.'},
  {n:'Indiana', a:'IN', sys:'Tax lien certificate', rate:'10% or 15% of the tax owed, by how soon the owner redeems', r:15, red:'1 year', m:12, bid:'Premium bidding', v:0, note:'Overbid (premium) earns little. County-held certificates have shorter windows.'},
  {n:'Iowa', a:'IA', sys:'Tax lien certificate', rate:'24% a year (2% a month)', r:24, red:'1 year 9 months', m:21, bid:'Other', v:0, note:'Fixed rate, not bid down. Bidders compete on a share of the parcel.'},
  {n:'Kansas', a:'KS', sys:'Tax deed', rate:'None paid to investors', r:0, red:'Before the sale only (1 to 3 years after the county bids it in)', m:0, bid:'Not applicable', v:0, note:'County forecloses in court; sheriff auctions for cash.'},
  {n:'Kentucky', a:'KY', sys:'Tax lien certificate', rate:'12% a year', r:12, red:'1 year', m:12, bid:'Other', v:0, note:'Certificates may be allotted by draw rather than bid. Suit allowed after 1 year.'},
  {n:'Louisiana', a:'LA', sys:'Tax lien certificate', rate:'Up to 12% plus a 5% penalty', r:12, red:'3 years', m:36, bid:'Bid-down rate', v:0, note:'Rules were overhauled in 2026. Parishes run the auctions.'},
  {n:'Maine', a:'ME', sys:'Municipal lien', rate:'None paid to investors', r:0, red:'18 months', m:18, bid:'Not applicable', v:0, note:'The town lien forecloses automatically. No investor lien sale.'},
  {n:'Maryland', a:'MD', sys:'Tax lien certificate', rate:'Varies by county', r:0, red:'6 months to 2 years, varies by county', m:24, bid:'Premium bidding', v:1, note:'Rates and rules differ a lot by county. Check yours.'},
  {n:'Massachusetts', a:'MA', sys:'Municipal lien', rate:'Verify: sources differ (8% vs 16%)', r:0, red:'Verify (6 to 12+ months)', m:0, bid:'Not applicable', v:1, note:'Towns hold tax-title liens. Rate depends on when the taking happened.'},
  {n:'Michigan', a:'MI', sys:'Tax deed', rate:'None paid to investors', r:0, red:'None after the auction (ends before the sale)', m:0, bid:'Not applicable', v:0, note:'County forecloses, then auctions the property.'},
  {n:'Minnesota', a:'MN', sys:'Tax deed', rate:'None paid to investors', r:0, red:'Before forfeiture only (3 to 5 years)', m:0, bid:'Not applicable', v:0, note:'State forfeiture, then a public auction.'},
  {n:'Mississippi', a:'MS', sys:'Sources differ', rate:'1.5% a month (18% a year)', r:18, red:'2 years', m:24, bid:'Other', v:0, note:'Land is sold; bid is on price. One source calls it a lien, another a redeemable deed.'},
  {n:'Missouri', a:'MO', sys:'Tax lien certificate', rate:'Up to 10%', r:10, red:'1 year', m:12, bid:'Premium bidding', v:0, note:'Some counties sell certificates, others go to deed sales. Check yours.'},
  {n:'Montana', a:'MT', sys:'Tax lien certificate', rate:'10% a year (one source also lists a 2% penalty)', r:10, red:'3 years', m:36, bid:'Other', v:0, note:'Investors buy the county lien by assignment rather than bidding.'},
  {n:'Nebraska', a:'NE', sys:'Tax lien certificate', rate:'14% a year', r:14, red:'3 years', m:36, bid:'Other', v:0, note:'Fixed rate, no rate bidding. Deed can be applied for after year 3.'},
  {n:'Nevada', a:'NV', sys:'Tax deed', rate:'None paid to investors', r:0, red:'Before the sale only (about 2 years)', m:0, bid:'Not applicable', v:0, note:'Treasurer holds the property, then sells it at auction.'},
  {n:'New Hampshire', a:'NH', sys:'Municipal lien', rate:'Verify (one source: 14% a year)', r:0, red:'2 years', m:24, bid:'Not applicable', v:1, note:'Towns take the lien. Investors only buy where a town chooses to sell.'},
  {n:'New Jersey', a:'NJ', sys:'Tax lien certificate', rate:'Up to 18%', r:18, red:'2 years', m:24, bid:'Bid-down rate', v:0, note:'Rate is bid down from 18%; at 0%, bidders offer premiums instead.'},
  {n:'New Mexico', a:'NM', sys:'Tax deed', rate:'None paid to investors', r:0, red:'None after the sale', m:0, bid:'Not applicable', v:0, note:'State-run cash auction of the property.'},
  {n:'New York', a:'NY', sys:'Sources differ', rate:'Verify: sources differ', r:0, red:'About 2 years (longer in some places)', m:24, bid:'Other', v:1, note:'Most counties foreclose and auction property. A few still sell liens.'},
  {n:'North Carolina', a:'NC', sys:'Tax deed', rate:'None paid to investors', r:0, red:'None after the sale (10-day upset-bid window)', m:0, bid:'Not applicable', v:0, note:'Foreclosure sale of the property.'},
  {n:'North Dakota', a:'ND', sys:'Sources differ', rate:'Verify: sources differ', r:0, red:'Verify (one source: none after the sale; others: 3 years)', m:0, bid:'Other', v:1, note:'Sources disagree on whether lien certificates are still sold.'},
  {n:'Ohio', a:'OH', sys:'Hybrid', rate:'Up to 18%', r:18, red:'1 year or more', m:12, bid:'Other', v:0, note:'Only some counties sell certificates. Bid down or negotiated.'},
  {n:'Oklahoma', a:'OK', sys:'Sources differ', rate:'Verify: sources differ', r:0, red:'Verify (2 vs 3+ years)', m:0, bid:'Other', v:1, note:'Sources disagree on whether certificates are still sold.'},
  {n:'Oregon', a:'OR', sys:'Tax deed', rate:'None paid to investors', r:0, red:'Before foreclosure only (timing differs by source)', m:0, bid:'Not applicable', v:0, note:'County forecloses and resells the property.'},
  {n:'Pennsylvania', a:'PA', sys:'Tax deed', rate:'None paid to investors', r:0, red:'None after the sale (Philadelphia has a short window)', m:0, bid:'Not applicable', v:0, note:'Upset and judicial sales of the property.'},
  {n:'Rhode Island', a:'RI', sys:'Redeemable deed', rate:'10% penalty, then more over time', r:10, red:'1 year', m:12, bid:'Other', v:0, note:'Town sells a deed; owner can redeem with a penalty.'},
  {n:'South Carolina', a:'SC', sys:'Sources differ', rate:'3% to 12% of the bid, by how soon the owner redeems', r:12, red:'1 year', m:12, bid:'Other', v:0, note:'Sources label it a lien or a redeemable deed. Counties set details.'},
  {n:'South Dakota', a:'SD', sys:'Tax lien certificate', rate:'Up to 10%', r:10, red:'3 years', m:36, bid:'Bid-down rate', v:0, note:'Counties choose whether to sell certificates.'},
  {n:'Tennessee', a:'TN', sys:'Redeemable deed', rate:'Verify (one source: 12% a year on the price)', r:0, red:'1 year (shorter in some cases)', m:12, bid:'Other', v:1, note:'Court sells the property; the owner can redeem.'},
  {n:'Texas', a:'TX', sys:'Redeemable deed', rate:'25% penalty', r:25, red:'180 days, or 2 years for homestead/farm land', m:24, bid:'Not applicable', v:0, note:'You buy the deed; the owner may buy it back with a penalty.'},
  {n:'Utah', a:'UT', sys:'Tax deed', rate:'None paid to investors', r:0, red:'Before the sale only (about 4 to 5 years delinquent)', m:0, bid:'Not applicable', v:0, note:'County cash auction of the property.'},
  {n:'Vermont', a:'VT', sys:'Sources differ', rate:'12% a year (1% a month)', r:12, red:'1 year', m:12, bid:'Other', v:0, note:'Town sale. One source calls it a lien, another a redeemable deed.'},
  {n:'Virginia', a:'VA', sys:'Tax deed', rate:'None paid to investors', r:0, red:'Verify: none after the sale vs up to 2 years (sources differ)', m:0, bid:'Not applicable', v:1, note:'Court-supervised sale of the property.'},
  {n:'Washington', a:'WA', sys:'Tax deed', rate:'None paid to investors', r:0, red:'None after the sale', m:0, bid:'Not applicable', v:0, note:'County forecloses after 3 years and auctions the property.'},
  {n:'West Virginia', a:'WV', sys:'Tax lien certificate', rate:'Verify: sources differ (0% vs 12%)', r:0, red:'Verify (45 days vs 18 months)', m:0, bid:'Other', v:1, note:'State Auditor sells the lien. Rate rules changed in 2022.'},
  {n:'Wisconsin', a:'WI', sys:'Sources differ', rate:'None paid to investors', r:0, red:'Owner: about 2 years from the certificate (1 in Milwaukee)', m:0, bid:'Not applicable', v:1, note:'Counties take the land and sell it. Sources disagree on investor certificates.'},
  {n:'Wyoming', a:'WY', sys:'Tax lien certificate', rate:'About 15% a year plus a penalty (sources describe it differently)', r:15, red:'4 years', m:48, bid:'Other', v:1, note:'Sources disagree on how buyers are chosen. Long window ties up capital.'},
];
const $ = id => document.getElementById(id);
const esc = s => s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function render() {
  const q = $('q').value.trim().toLowerCase(), bid = $('bid').value, sys = $('sys').value, sort = $('sort').value;
  let list = STATES.filter(s => (!q || s.n.toLowerCase().includes(q) || s.a.toLowerCase() === q) && (!bid || s.bid === bid) && (!sys || s.sys === sys));
  list.sort((a, b) => sort === 'rate' ? b.r - a.r : sort === 'redeem' ? b.m - a.m : a.n.localeCompare(b.n));
  $('count').textContent = list.length + (list.length === 1 ? ' state' : ' states');
  $('cards').innerHTML = list.length ? list.map(s => `
    <article class="card state">
      <div class="state-top"><h3>${esc(s.n)}</h3><span class="abbr">${esc(s.a)}</span></div>
      <p class="sys">${esc(s.sys)} &middot; ${esc(s.bid)}${s.v ? ' <span class="vflag">Verify</span>' : ''}</p>
      <dl>
        <div><dt>Interest</dt><dd>${esc(s.rate)}</dd></div>
        <div><dt>Redemption</dt><dd>${esc(s.red)}</dd></div>
      </dl>
      <p class="muted small">${esc(s.note)}</p>
    </article>`).join('') : '<p class="muted">No states match. Try clearing the search or filter.</p>';
}
['q', 'bid', 'sys', 'sort'].forEach(id => $(id).addEventListener('input', render));
render();
$('yr').textContent = new Date().getFullYear();
