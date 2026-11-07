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
    if (m) {
      li.className = 'cty';
      const pa = FL_PA[m[1]];
      if (pa) { const y = document.createElement('a'); y.href = pa; y.target = '_blank'; y.rel = 'noopener noreferrer'; y.className = 'small'; y.textContent = 'Parcel search'; li.append(x, document.createTextNode(' \u00b7 '), y); $('clist').appendChild(li); return; }
    }
    if (!m) { x.target = '_blank'; x.rel = 'noopener noreferrer'; } li.appendChild(x); $('clist').appendChild(li);
  });
  if (s.a !== 'FL') { const box = document.createElement('div'); $('clist').before(box); StateExtra.render(box, s.a); }
  if (s.a === 'FL') { const box = document.createElement('div'); $('clist').before(box); LienUI.saleBox(box); LienUI.table(box, undefined, 'FL'); }
  if (s.a === 'NY') { const box = document.createElement('div'); $('clist').before(box); const s1 = document.createElement('script'); s1.src = '../nyc-history.js'; s1.onload = () => { const s2 = document.createElement('script'); s2.src = '../nyc-ui.js'; s2.onload = () => NycUI.render(box); document.head.appendChild(s2); }; document.head.appendChild(s1); }
  if (s.a === 'NY') { const box2 = document.createElement('div'); $('clist').before(box2); const m1 = document.createElement('script'); m1.src = '../middletown-ny.js'; m1.onload = () => { const m2 = document.createElement('script'); m2.src = '../middletown-ui.js'; m2.onload = () => MiddletownUI.render(box2); document.head.appendChild(m2); }; document.head.appendChild(m1); }
  const LF = {CO: ['liens-larimer.js', 'Larimer'], AZ: ['liens-pinal.js', 'Pinal']}[s.a];
  if (LF) { const box = document.createElement('div'); $('clist').before(box); const sh = document.createElement('div'); box.appendChild(sh); const sc = document.createElement('script'); sc.src = '../' + LF[0]; sc.onload = () => { Screener.mount(sh, LF[1]); LienUI.table(box, LF[1], s.a); }; document.head.appendChild(sc); }
  (function parcelBox() {
    const host = $('parcelbox'); if (!host) return;
    const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x) e.textContent = x; return e; };
    const box = mk('div', 'askbox'); box.appendChild(mk('h2', '', 'Find a parcel and see where it is'));
    box.appendChild(mk('p', 'small muted', 'A parcel number (also called a PIN or folio) points to one lot. County property sites usually show the lot on a map, the size, the county\u2019s value and the tax history. We link to the official sites; we do not host their data. Some sites ask you to confirm you are a person first.'));
    const ul = mk('ul', 'countylist');
    (typeof PARCEL_LOOKUP !== 'undefined' && PARCEL_LOOKUP[s.a] || []).forEach(l => { const li = mk('li'), a = mk('a', '', l[0]); a.href = l[1]; a.target = '_blank'; a.rel = 'noopener noreferrer'; li.appendChild(a); ul.appendChild(li); });
    if (s.a === 'FL') ul.appendChild(mk('li', '', 'Every Florida county has its own parcel search. Use the \u201cParcel search\u201d link next to the county below.'));
    if (ul.children.length) box.appendChild(ul);
    const f = mk('form', 'askform'), inp = mk('input'); inp.type = 'text'; inp.maxLength = 60; inp.placeholder = 'Type a county name (e.g. Essex)'; inp.setAttribute('aria-label', 'County name');
    const b = mk('button', 'btn', 'Find its parcel search'); b.type = 'submit';
    f.append(inp, b); box.appendChild(f);
    f.addEventListener('submit', e => { e.preventDefault(); const c = inp.value.trim().replace(/\s+county$/i, '').slice(0, 60); if (!c) return; window.open('https://www.google.com/search?q=' + encodeURIComponent(c + ' County ' + s.n + ' property search parcel map'), '_blank', 'noopener'); });
    host.appendChild(box);
  })();
  const q = encodeURIComponent(s.n + ' county treasurer tax sale');
  $('smore').innerHTML = '<a class="btn" target="_blank" rel="noopener noreferrer" href="https://www.google.com/search?q=' + q + '">Search for your county’s tax sale page</a>';
}
