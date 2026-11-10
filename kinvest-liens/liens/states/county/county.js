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
  const a = document.createElement('a'); a.className = 'btn'; a.href = link[1]; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = 'Open the county tax collector site';
  $('clink').appendChild(a);
  if (FL_PA[name]) { const b = document.createElement('a'); b.className = 'btn ghost'; b.style.marginLeft = '8px'; b.href = FL_PA[name]; b.target = '_blank'; b.rel = 'noopener noreferrer'; b.textContent = 'Find a parcel (property appraiser)'; $('clink').appendChild(b); }
  LienUI.saleBox($('sale'), name);
  if (name === 'Palm Beach' || name === 'Leon' || name === 'Manatee' || name === 'Alachua' || name === 'Bay' || name === 'Miami-Dade' || name === 'Walton' || name === 'Santa Rosa' || name === 'Volusia' || name === 'Pasco' || name === 'Osceola' || name === 'Sarasota' || name === 'Duval') Screener.mount($('screenhost'), name);
  LienUI.table($('lienbox'), name, 'FL');
  DUE_DILIGENCE.forEach(t => { const li = document.createElement('li'); li.textContent = t; $('dd').appendChild(li); });
}
