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
      <p class="small"><a href="state/?s=${esc(s.a)}"><b>Open ${esc(s.n)} page &rarr;</b></a></p>
      <details class="links"><summary>County &amp; official pages${s.links.length ? ' (' + s.links.length + ')' : ''}</summary>
        <ul>${s.links.map(l => `<li><a href="${esc(l[1])}" target="_blank" rel="noopener noreferrer">${esc(l[0])}</a></li>`).join('')}
        <li><a href="https://www.google.com/search?q=${encodeURIComponent(s.n + ' county treasurer tax sale')}" target="_blank" rel="noopener noreferrer">Search for your county's tax sale page</a></li></ul>
      </details>
    </article>`).join('') : '<p class="muted">No states match. Try clearing the search or filter.</p>';
}
['q', 'bid', 'sys', 'sort'].forEach(id => $(id).addEventListener('input', render));
render();
$('yr').textContent = new Date().getFullYear();
