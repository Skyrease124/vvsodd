const $ = id => document.getElementById(id);
$('yr').textContent = new Date().getFullYear();
const q = new URLSearchParams(location.search), name = q.get('c') || '';
const fl = STATES.find(s => s.a === 'FL');
const link = fl.links.find(l => l[0] === name + ' County Tax Collector (certificate sales)');
if (!link) {
  $('cname').textContent = 'County not found';
  $('clink').innerHTML = 'Pick a county from <a href="../state/?s=FL">the Florida page</a>.';
} else {
  document.title = name + ' County tax sales | PricePocketAsset';
  $('cname').textContent = name + ' County, Florida';
  { const ac = document.createElement('a'); ac.className = 'btn ghost'; ac.textContent = 'Ask the County (Pro)'; ac.href = '/account/ask-county/?' + new URLSearchParams({state: 'FL', county: name}); ac.style.marginLeft = '8px'; $('clink').after(ac); }
  if (typeof UpcomingSales !== 'undefined') UpcomingSales.mount($('upsales'), {county: name});
  const a = document.createElement('a'); a.className = 'btn'; a.href = link[1]; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = 'Open the county tax collector site';
  $('clink').appendChild(a);
  if (FL_PA[name]) { const b = document.createElement('a'); b.className = 'btn ghost'; b.style.marginLeft = '8px'; b.href = FL_PA[name]; b.target = '_blank'; b.rel = 'noopener noreferrer'; b.textContent = 'Find a parcel (property appraiser)'; $('clink').appendChild(b); }
  // Free practice case button (shown for counties that have a case, even when there are no current listings).
  if (name === 'Lee') {
    const pb = document.createElement('a'); pb.className = 'btn prbtn'; pb.href = '/practice/?case=lee-demo'; pb.textContent = 'Practice a Lee County case'; $('clink').after(pb);
    fetch('/.netlify/functions/practice').then(r => r.json()).then(d => { const c = (d.cases || []).find(x => x.county === 'Lee'); if (!c) { pb.remove(); return; } pb.href = '/practice/?case=' + encodeURIComponent(c.id); pb.textContent = c.demo ? 'Practice With a Sample Certificate (demo)' : 'Practice With a Real Certificate'; }).catch(() => {});
    const np = document.createElement('p'); np.className = 'small muted'; np.textContent = 'Free, no sign-in. Check zoning, flood, wetlands and road access, make your call, then see what happened.'; pb.after(np);
  }
  LienUI.saleBox($('sale'), name);
  if (name === 'Palm Beach' || name === 'Leon' || name === 'Manatee' || name === 'Alachua' || name === 'Bay' || name === 'Miami-Dade' || name === 'Walton' || name === 'Santa Rosa' || name === 'Volusia' || name === 'Pasco' || name === 'Osceola' || name === 'Sarasota' || name === 'Duval' || name === 'Escambia' || name === 'Hillsborough' || name === 'Hernando' || name === 'Nassau') Screener.mount($('screenhost'), name);
  LienUI.table($('lienbox'), name, 'FL');
  DUE_DILIGENCE.forEach(t => { const li = document.createElement('li'); li.textContent = t; $('dd').appendChild(li); });
}
