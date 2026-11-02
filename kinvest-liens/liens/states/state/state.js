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
  const cls = p => /^Republican/.test(p) ? 'r' : /^Democratic/.test(p) ? 'd' : 'i';
  const add = (role, o) => { const li = document.createElement('li'), n = document.createElement('b'), pt = document.createElement('span'), sm = document.createElement('small');
    n.textContent = o.name; pt.className = 'party ' + cls(o.party); pt.textContent = o.party; sm.textContent = role; li.append(n, pt, sm); $('offl').appendChild(li); };
  const g = OFFICIALS.gov[s.a]; if (g) add(g.title + ' of ' + s.n, g);
  (OFFICIALS.mayors[s.a] || []).forEach(m => add('Mayor of ' + m.city + ' (#' + m.rank + ' largest US city)', m));
  if (!(OFFICIALS.mayors[s.a] || []).length) { const li = document.createElement('li'); li.textContent = 'No city in this state is among the 50 largest, so no mayor is listed.'; $('offl').appendChild(li); }
  s.links.forEach(l => {
    const li = document.createElement('li'), x = document.createElement('a');
    const m = s.a === 'FL' && l[0].match(/^(.+) County Tax Collector \(certificate sales\)$/);
    x.href = m ? '../county/?c=' + encodeURIComponent(m[1]) : l[1]; x.textContent = m ? m[1] + ' County: sale dates & lists' : l[0];
    if (m) li.className = 'cty';
    if (!m) { x.target = '_blank'; x.rel = 'noopener noreferrer'; } li.appendChild(x); $('clist').appendChild(li);
  });
  if (s.a !== 'FL') { const box = document.createElement('div'); $('clist').before(box); StateExtra.render(box, s.a); }
  if (s.a === 'FL') { const box = document.createElement('div'); $('clist').before(box); LienUI.saleBox(box); LienUI.table(box); }
  const q = encodeURIComponent(s.n + ' county treasurer tax sale');
  $('smore').innerHTML = '<a class="btn" target="_blank" rel="noopener noreferrer" href="https://www.google.com/search?q=' + q + '">Search for your county’s tax sale page</a>';
}
