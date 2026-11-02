const $ = id => document.getElementById(id);
const a = (new URLSearchParams(location.search).get('s') || '').toUpperCase();
const s = STATES.find(x => x.a === a);
$('yr').textContent = new Date().getFullYear();
if (!s) {
  $('sname').textContent = 'State not found';
  $('snote').innerHTML = 'Pick a state from <a href="../">the state guide</a> or <a href="../../../#map">the map</a>.';
} else {
  document.title = s.n + ' tax sales | PricePocketAsset';
  $('sname').textContent = s.n;
  $('ssys').textContent = s.sys + ' · ' + s.bid + (s.v ? ' · verify' : '');
  [['Interest / penalty', s.rate], ['Redemption', s.red], ['Bidding method', s.bid]].forEach(([k, v]) => {
    const d = document.createElement('div'), t = document.createElement('dt'), e = document.createElement('dd');
    t.textContent = k; e.textContent = v; d.append(t, e); $('sfacts').appendChild(d);
  });
  $('snote').textContent = s.note;
  s.links.forEach(l => {
    const li = document.createElement('li'), x = document.createElement('a');
    x.href = l[1]; x.textContent = l[0]; x.target = '_blank'; x.rel = 'noopener noreferrer'; li.appendChild(x); $('clist').appendChild(li);
  });
  const q = encodeURIComponent(s.n + ' county treasurer tax sale');
  $('smore').innerHTML = '<a class="btn" target="_blank" rel="noopener noreferrer" href="https://www.google.com/search?q=' + q + '">Search for your county’s tax sale page</a>';
}
