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
  // Hero: the state's own shape in its system color and texture, with the key numbers beside it.
  (function hero() {
    const NS = 'http://www.w3.org/2000/svg', COL = {'Tax lien certificate': '#22c55e', 'Tax deed': '#3b82f6', 'Redeemable deed': '#f59e0b', 'Hybrid': '#a855f7', 'Municipal lien': '#06b6d4', 'Sources differ': '#94a3b8'};
    const col = COL[s.sys] || '#94a3b8', h = document.createElement('div'); h.className = 'shero';
    const fig = document.createElement('div'); fig.className = 'sfig';
    if (typeof MAP_PATHS !== 'undefined' && MAP_PATHS[s.a]) {
      const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('aria-hidden', 'true');
      const defs = document.createElementNS(NS, 'defs'); defs.innerHTML = '<pattern id="hp" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="' + col + '"/>' + ({'Tax lien certificate': '<path d="M-1 9L9-1M-1 1L1-1M7 9L9 7" stroke="rgba(0,0,0,.3)" stroke-width="1.7"/>', 'Redeemable deed': '<circle cx="2" cy="2" r="1.3" fill="rgba(255,255,255,.45)"/><circle cx="6" cy="6" r="1.3" fill="rgba(255,255,255,.45)"/>', 'Hybrid': '<path d="M-1 9L9-1M-1 -1L9 9" stroke="rgba(0,0,0,.25)" stroke-width="1.2"/>', 'Municipal lien': '<path d="M0 2.5H8M0 6.5H8" stroke="rgba(0,0,0,.28)" stroke-width="1.3"/>'}[s.sys] || '') + '</pattern>';
      svg.appendChild(defs);
      const p = document.createElementNS(NS, 'path'); p.setAttribute('d', MAP_PATHS[s.a]); p.setAttribute('fill', 'url(#hp)'); p.setAttribute('class', 'sshape'); p.style.filter = 'drop-shadow(0 0 14px ' + col + '99)'; svg.appendChild(p);
      fig.appendChild(svg); document.body.appendChild(svg); const bb = p.getBBox(); svg.setAttribute('viewBox', [bb.x - 6, bb.y - 6, bb.width + 12, bb.height + 12].join(' ')); fig.appendChild(svg);
    }
    const tx = document.createElement('div'); tx.className = 'stx';
    const k = document.createElement('p'); k.className = 'hgreet'; k.textContent = s.sys; tx.appendChild(k);
    tx.appendChild($('sname')); tx.appendChild($('ssys'));
    const cta = document.createElement('a'); cta.className = 'btn small'; cta.href = '/learn/state/?s=' + s.a; cta.textContent = 'Take the ' + s.n + ' class'; tx.appendChild(cta);
    h.append(fig, tx); $('sfacts').before(h);
    // timing tile from the researched sale notes (first sentence only)
    const sd = typeof STATE_DATA !== 'undefined' && STATE_DATA[s.a] && STATE_DATA[s.a].sale, w = sd && sd.when ? String(sd.when).split(/(?<=\.)\s/)[0] : (s.a === 'FL' && typeof FL_SALE !== 'undefined' ? FL_SALE.nextSale : '');
    if (w) { const d = document.createElement('div'), t = document.createElement('dt'), e = document.createElement('dd'); t.textContent = 'Sale timing'; e.textContent = w; d.append(t, e); d.className = 'wide'; $('sfacts').appendChild(d); }
    if (s.v) { const b = document.createElement('span'); b.className = 'vbadge'; b.textContent = 'Verify: sources differ'; tx.insertBefore(b, cta); }
  })();
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
      const nn = typeof LIEN_SUMMARY !== 'undefined' ? LIEN_SUMMARY.filter(z => z.state === 'FL' && z.county === m[1]).reduce((t, z) => t + z.count, 0) : 0;
      const cc = document.createElement('span'); cc.className = 'ccount' + (nn ? ' live' : ''); cc.textContent = nn ? '\u25CF ' + nn.toLocaleString() + ' real listings' : 'Sale info and links'; li.appendChild(cc);
      const pa = FL_PA[m[1]];
      if (pa) { const y = document.createElement('a'); y.href = pa; y.target = '_blank'; y.rel = 'noopener noreferrer'; y.className = 'small'; y.textContent = 'Parcel search'; li.append(x, document.createTextNode(' \u00b7 '), y); $('clist').appendChild(li); return; }
    }
    if (!m) { x.target = '_blank'; x.rel = 'noopener noreferrer'; } li.appendChild(x); $('clist').appendChild(li);
  });
  if (s.a !== 'FL') { const box = document.createElement('div'); $('clist').before(box); StateExtra.render(box, s.a); }
  if (s.a === 'FL') { const box = document.createElement('div'); $('clist').before(box); LienUI.saleBox(box); LienUI.table(box, undefined, 'FL'); }
  if (s.a === 'NY') { const box = document.createElement('div'); $('clist').before(box); const s1 = document.createElement('script'); s1.src = '../nyc-history.js'; s1.onload = () => { const s2 = document.createElement('script'); s2.src = '../nyc-ui.js'; s2.onload = () => NycUI.render(box); document.head.appendChild(s2); }; document.head.appendChild(s1); }
  if (s.a === 'NY') { const box2 = document.createElement('div'); $('clist').before(box2); const m1 = document.createElement('script'); m1.src = '../middletown-ny.js'; m1.onload = () => { const m2 = document.createElement('script'); m2.src = '../middletown-ui.js'; m2.onload = () => MiddletownUI.render(box2); document.head.appendChild(m2); }; document.head.appendChild(m1); }
  if (s.a === 'MS') { const box = document.createElement('div'); $('clist').before(box); const a1 = document.createElement('script'); a1.src = '../ms-forfeited-data.js'; a1.onload = () => { const a2 = document.createElement('script'); a2.src = '../ms-forfeited-ui.js'; a2.onload = () => MsForfeitedUI.render(box); document.head.appendChild(a2); }; document.head.appendChild(a1); }
  const LFS = {CO: [['liens-larimer.js', 'Larimer'], ['liens-saguache.js', 'Saguache'], ['liens-elpaso.js', 'El Paso'], ['liens-boulder.js', 'Boulder']], IA: [['liens-scott.js', 'Scott']], TN: [['liens-davidson.js', 'Davidson']], MI: [['liens-wayne.js', 'Wayne']], AZ: [['liens-pinal.js', 'Pinal'], ['liens-coconino.js', 'Coconino']]}[s.a] || [];
  LFS.forEach(LF => { const box = document.createElement('div'); $('clist').before(box); const sh = document.createElement('div'); box.appendChild(sh); const sc = document.createElement('script'); sc.src = '../' + LF[0]; sc.onload = () => { Screener.mount(sh, LF[1]); LienUI.table(box, LF[1], s.a); }; document.head.appendChild(sc); box.dataset.county = LF[1]; });
  if (LFS.length > 1) { // jump straight to a county instead of scrolling past the others
    const jb = document.createElement('div'); jb.className = 'askbox'; const js = document.createElement('select'); js.setAttribute('aria-label', 'Jump to a county'); js.style.cssText = 'width:100%;max-width:420px';
    js.appendChild(new Option('Jump to a county (' + LFS.length + ' with lists)', '')); LFS.forEach(LF => js.appendChild(new Option(LF[1], LF[1])));
    js.addEventListener('change', () => { const t = document.querySelector('[data-county="' + js.value + '"]'); if (t) t.scrollIntoView({block: 'start'}); });
    jb.appendChild(js); $('clist').before(jb); const first = document.querySelector('[data-county]'); if (first) first.before(jb);
  }
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
// Upcoming Tax Sales (Florida only)
if (a === 'FL' && typeof UpcomingSales !== 'undefined' && document.getElementById('upsales')) UpcomingSales.mount(document.getElementById('upsales'));
