(function () {
  const app = document.getElementById('app'), Q = new URLSearchParams(location.search), name = Q.get('c');
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const link = (t, u) => { const a = mk('a', '', t); a.href = u; if (/^https?:/.test(u)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; } return a; };
  const fetchJ = u => fetch(u).then(r => r.ok ? r.json() : Promise.reject(r.status));
  function index() {
    fetchJ('/.netlify/functions/learnhub?counties=1').then(d => { app.textContent = ''; app.appendChild(mk('h2', '', 'Choose a county')); const ul = mk('div'); d.counties.forEach(c => { const a = mk('a', 'rowlink', c + ' County'); a.href = '?c=' + encodeURIComponent(c); ul.appendChild(a); }); app.appendChild(ul); app.appendChild(mk('p', 'small muted', 'We only list counties where we have checked the office and the buying steps ourselves. More are added as we check them.')); }).catch(() => { app.textContent = 'Could not load the county list.'; });
  }
  function page(c) {
    document.title = c.name + ' County guide | PricePocketAsset'; app.textContent = '';
    app.appendChild(mk('h2', '', c.name + ' County' + (c.stateName ? ', ' + c.stateName : '')));
    const dl = mk('dl', 'drfacts'); const row = (a, b) => { if (!b) return; const d = mk('div'); d.append(mk('dt', '', a), mk('dd', '', b)); dl.appendChild(d); };
    row('Office', c.office); row('Phone', c.phone); if (c.system) { row('System', c.system.sys); row('Interest or penalty', c.system.rate); row('Redemption', c.system.redemption); row('Bidding', c.system.bidding); } if (c.lists.length) row('Lien list on our site', c.lists[0].count.toLocaleString('en-US') + ' records');
    app.appendChild(dl); if (c.system && c.system.verify) app.appendChild(mk('p', 'notice small', 'Sources differ on this state’s rules, so treat the figures as unconfirmed and check the county.'));
    app.appendChild(mk('h3', '', 'How to buy here, step by step')); const ol = mk('ol', 'steps'); c.steps.forEach(s => ol.appendChild(mk('li', '', s))); app.appendChild(ol);
    app.appendChild(mk('h3', '', 'Official links')); const ul = mk('div'); c.links.concat(c.officialSites, c.calendar ? [{ name: c.calendar.name + ' (sale calendar)', url: c.calendar.url }] : []).forEach(l => { const a = link(l.name, l.url); a.className = 'rowlink'; ul.appendChild(a); }); app.appendChild(ul);
    app.appendChild(mk('h3', '', 'Upcoming sales on an official page')); if (c.upcoming.length) { const u2 = mk('ul', 'cty'); c.upcoming.forEach(e => { const li = mk('li'); li.appendChild(document.createTextNode(e.date + (e.time ? ' ' + e.time + ' ' + (e.tz || '') : '') + ' · ' + e.type + ' · ' + e.status + ' ')); if (e.page) li.appendChild(link('official page', e.page)); u2.appendChild(li); }); app.appendChild(u2); } else app.appendChild(mk('p', 'muted', 'No dated sale for this county is on our calendar right now. Check the official pages above.'));
    const more = mk('p', 'drbtns'); if (c.state) { const a = mk('a', 'btn small', c.stateName + ' state class'); a.href = '/liens/states/state/?s=' + c.state; more.appendChild(a); } if (c.course) { const a = mk('a', 'btn small', 'Full ' + c.stateName + ' course'); a.href = '/learn/course/?c=' + c.course.id; more.appendChild(a); const p = mk('a', 'btn small ghost', 'Learning paths'); p.href = '/learn/paths/?c=' + c.course.id; more.appendChild(p); } app.appendChild(more);
    const idx = mk('a', 'chlink', '← All counties'); idx.href = '?'; app.appendChild(idx); c.notes.forEach(n => app.appendChild(mk('p', 'small muted', n)));
  }
  if (!name) index(); else fetchJ('/.netlify/functions/learnhub?county=' + encodeURIComponent(name)).then(d => page(d.county)).catch(() => { app.textContent = 'We do not have a guide for that county yet.'; });
})();
