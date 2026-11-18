(function () {
  const app = document.getElementById('app'), API = '/.netlify/functions/delinquent';
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const $ = n => '$' + Math.round(n).toLocaleString('en-US'), $c = n => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  let me = { paid: false, signedIn: false }, S = null, off = 0, last = null;
  const get = async qs => { const r = await fetch(API + qs, { credentials: 'same-origin' }); let d = {}; try { d = await r.json(); } catch (e) { /* empty */ } return { ok: r.ok, status: r.status, d }; };
  function tiles(s) {
    const g = mk('div', 'dqtiles');
    [[s.parcels.toLocaleString('en-US'), 'parcels with overdue tax'], [$(s.owed), 'owed in total'], [$(s.medianOwed), 'typical (median) parcel owes'], [s.oldestYear, 'oldest tax year still owed']].forEach(([b, l]) => { const t = mk('div', 'dqtile'); t.append(mk('b', '', b), mk('span', '', l)); g.appendChild(t); });
    return g;
  }
  function bars(title, rows, valKey) {
    const box = mk('section', 'dqbars'); box.appendChild(mk('h2', '', title)); const max = Math.max(...rows.map(r => r.parcels), 1);
    rows.forEach(r => { const row = mk('div', 'dqbar'); const l = mk('span', 'l', r.label), b = mk('span', 'b'), i = mk('i'); i.style.width = Math.max(2, Math.round(100 * r.parcels / max)) + '%'; b.appendChild(i); const n = mk('span', 'n', r.parcels.toLocaleString('en-US') + (valKey ? ' · ' + $(r[valKey]) : '')); row.append(l, b, n); box.appendChild(row); });
    return box;
  }
  function sourceNote(s) { const p = mk('p', 'small muted dqsrc'); p.appendChild(document.createTextNode('Source: City of Virginia Beach GIS public data, ' + (s.asOf ? 'last edited by the city ' + s.asOf : 'edit date not stated') + '. ')); if (s.sourceUrl) { const a = mk('a', '', 'Open the city table'); a.href = s.sourceUrl; a.target = '_blank'; a.rel = 'noopener noreferrer'; p.appendChild(a); } return p; }
  function facts(s) {
    const box = mk('section'); box.appendChild(mk('h2', '', 'What is in the numbers'));
    const dl = mk('dl', 'dqfacts'); [['Tax', $(s.tax)], ['Penalties', $(s.penalty)], ['Interest', $(s.interest)], ['Fees', $(s.fees)], ['Parcels with no street address', s.noStreetAddress.parcels.toLocaleString('en-US') + ' (median ' + $(s.noStreetAddress.medianOwed) + ')'], ['Parcels behind since 2020 or earlier', s.oldParcels.since2020.toLocaleString('en-US')]].forEach(([a, b]) => { const d = mk('div'); d.append(mk('dt', '', a), mk('dd', '', b)); dl.appendChild(d); }); box.appendChild(dl);
    box.appendChild(mk('h3', '', 'About this data')); const ul = mk('ul', 'dqul'); [s.source, s.received ? 'Received ' + s.received + '.' : '', s.asOfNote || ('As of ' + s.asOf + '.')].concat(s.quality, s.notes).filter(Boolean).forEach(x => ul.appendChild(mk('li', '', x))); box.appendChild(ul); return box;
  }
  function outline(rings) {
    const pts = rings.flat(); if (!pts.length) return null; const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const k = Math.cos(((y0 + y1) / 2) * Math.PI / 180), w = (x1 - x0) * k || 1e-9, h = (y1 - y0) || 1e-9, S = 88, sc = Math.min(S / w, S / h), ox = (S - w * sc) / 2 + 4, oy = (S - h * sc) / 2 + 4;
    const d = rings.map(r => r.map((q, i) => (i ? 'L' : 'M') + (((q[0] - x0) * k) * sc + ox).toFixed(1) + ' ' + ((y1 - q[1]) * sc + oy).toFixed(1)).join('') + 'Z').join('');
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 96 96'); svg.setAttribute('class', 'dqmap'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Parcel outline, north up, not to scale');
    const path = document.createElementNS(ns, 'path'); path.setAttribute('d', d); path.setAttribute('fill-rule', 'evenodd'); svg.appendChild(path); return svg;
  }
  function card(p) {
    const c = mk('article', 'dqcard'); const top = mk('div', 'dqtop'); const t = mk('div'); t.append(mk('b', '', p.address || 'No street address on the list'), mk('span', 'small muted', p.description));
    const o = mk('div', 'dqowed'); o.append(mk('b', '', $c(p.owed)), mk('span', 'small muted', 'owed (city’s total)')); top.append(t, o); c.appendChild(top);
    const chips = mk('div', 'dqchips'); chips.append(mk('span', '', 'Parcel ' + p.gpin), mk('span', '', 'District ' + p.district), mk('span', '', p.taxYears.length + (p.taxYears.length === 1 ? ' tax year' : ' tax years') + ': ' + (p.taxYears.length > 4 ? p.oldest + ' to ' + p.newest : p.taxYears.join(', '))));
    c.appendChild(chips);
    if (p.outline) { const row = mk('div', 'dqgeo'); const svg = outline(p.outline); if (svg) row.appendChild(svg); const f = p.facts || {}, t = mk('div'); [['Land use', f.landUse], ['Zoning', f.zoning], ['FEMA flood zone (city field)', f.floodZone], ['Area', f.acres ? f.acres + ' acres (city tax area)' : null], ['Subdivision', f.subdivision]].filter(x => x[1]).forEach(([a, b]) => { const l = mk('div', 'dqfact'); l.append(mk('span', 'k', a), mk('span', 'v', b)); t.appendChild(l); }); row.appendChild(t); c.appendChild(row); }
    else c.appendChild(mk('p', 'small muted', 'No outline on the city\u2019s parcel layer (common for condo units).'));
    c.appendChild(mk('p', 'small muted', 'Tax ' + $c(p.tax) + ' · penalty ' + $c(p.penalty) + ' · interest ' + $c(p.interest) + ' · fees ' + $c(p.fees)));
    if (p.totalsDiffer) c.appendChild(mk('p', 'small dqwarn', 'The city’s total differs from these parts (for example a partial payment). The city’s total is shown.'));
    c.appendChild(mk('p', 'small muted', 'Overdue tax only. Not a listing. Confirm with the Treasurer.')); return c;
  }
  function search() {
    const box = mk('section', 'dqsearch'); box.appendChild(mk('h2', '', 'Search parcels'));
    if (!me.paid) { box.appendChild(mk('p', '', 'Searching parcels by address, parcel id, amount and years behind is for Pro members.')); const a = mk('a', 'btn', me.signedIn ? 'See Pro' : 'Sign in'); a.href = me.signedIn ? '/plans/' : '/login/?next=' + encodeURIComponent(location.pathname); box.appendChild(a); return box; }
    const f = mk('form', 'dqform'); f.setAttribute('role', 'search'); const fld = (l, el) => { const lab = mk('label', '', l); lab.appendChild(el); return lab; };
    const q = mk('input'); q.type = 'search'; q.placeholder = 'Street, subdivision or parcel id'; q.autocomplete = 'off';
    const sel = (opts) => { const s = mk('select'); opts.forEach(([v, t]) => { const o = mk('option', '', t); o.value = v; s.appendChild(o); }); return s; };
    const min = sel([['', 'Any amount'], ['500', '$500 or more'], ['1000', '$1,000 or more'], ['2500', '$2,500 or more'], ['5000', '$5,000 or more'], ['10000', '$10,000 or more']]), yrs = sel([['', 'Any'], ['2', '2 or more years'], ['3', '3 or more years'], ['5', '5 or more years']]), srt = sel([['owedDesc', 'Most owed'], ['owedAsc', 'Least owed'], ['oldest', 'Oldest tax year'], ['years', 'Most years behind']]);
    const na = mk('input'); na.type = 'checkbox'; const nl = mk('label', 'dqcheck'); nl.append(na, mk('span', '', 'Only parcels with no street address (often land or strips)'));
    const go = mk('button', 'btn', 'Search'); go.type = 'submit';
    f.append(fld('Search', q), fld('Amount owed', min), fld('Years behind', yrs), fld('Sort by', srt), nl, go); box.appendChild(f);
    const meta = mk('p', 'small muted'); meta.setAttribute('role', 'status'); const out = mk('div'), more = mk('button', 'btn ghost', 'Show more'); more.type = 'button'; more.hidden = true; box.append(meta, out, more);
    const params = () => 'q=' + encodeURIComponent(q.value) + '&minOwed=' + min.value + '&minYears=' + yrs.value + '&sort=' + srt.value + (na.checked ? '&noAddress=1' : '');
    async function run(append) {
      if (!append) { off = 0; out.textContent = ''; } meta.textContent = 'Searching…'; const r = await get('?' + params() + '&limit=20&offset=' + off); if (!r.ok) { meta.textContent = r.d.error || 'Could not search.'; return; }
      r.d.rows.forEach(p => out.appendChild(card(p))); off += r.d.rows.length; meta.textContent = r.d.total.toLocaleString('en-US') + ' parcel' + (r.d.total === 1 ? '' : 's') + ' match' + (r.d.total ? ' (showing ' + off + ')' : '. Try fewer filters.'); more.hidden = off >= r.d.total;
    }
    f.addEventListener('submit', e => { e.preventDefault(); run(false); }); more.addEventListener('click', () => run(true)); run(false); return box;
  }
  (async () => {
    const [sm, who] = await Promise.all([get('?summary=1'), fetch('/.netlify/functions/account', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).catch(() => null)]);
    if (!sm.ok) { app.textContent = 'This data is not available right now.'; return; } S = sm.d.summary; const u = who && who.user; me = { signedIn: !!u, paid: !!(u && (u.owner || u.paid || (u.paidThrough && u.paidThrough >= new Date().toISOString().slice(0, 10)))) };
    app.textContent = ''; app.append(tiles(S), sourceNote(S), bars('How much parcels owe', S.ownedBuckets, 'owed'), bars('How many years behind', S.yearsBehind), search(), facts(S));
  })();
})();
