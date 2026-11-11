(async function () {
  const $ = id => document.getElementById(id), mk = PF.mk;
  const r = await PF.api('me');
  if (r.status !== 200) { $('wl-out').hidden = false; return; }
  $('wl').hidden = false;
  let D = r.d;
  const href = k => '/liens/parcel/?k=' + encodeURIComponent(k);
  function feed() {
    const box = $('wl-feed'); box.textContent = ''; const n = D.notifications.filter(x => D.prefs.inApp);
    const ub = $('wl-unread'); ub.hidden = !D.unread; ub.textContent = D.unread + ' new';
    if (!n.length) { box.appendChild(mk('p', 'muted', D.watch.length ? 'No changes detected yet on the parcels you watch. We compare each new official county file with the last one.' : 'Watch a parcel from its card or detail page to see updates here.')); return; }
    if (D.unread) { const b = mk('button', 'btn small ghost', 'Mark all as read'); b.type = 'button'; b.addEventListener('click', async () => { await PF.api('seen', {}); n.forEach(x => x.read = true); D.unread = 0; feed(); }); box.appendChild(b); }
    const ul = mk('ul', 'pffeed');
    n.slice(0, 60).forEach(x => {
      const li = mk('li', x.read ? '' : 'unread'); const a = mk('a', '', x.county + ' · ' + x.parcel + (x.cert ? ' (cert ' + x.cert + ')' : '')); a.href = href(x.key);
      li.appendChild(a); li.appendChild(mk('p', '', x.text));
      if (x.old != null || x.new != null) li.appendChild(mk('p', 'small', 'Previous: ' + (x.old == null ? 'not listed' : (typeof x.old === 'number' ? PF.money(x.old) : x.old)) + ' · New: ' + (x.new == null ? 'not listed' : (typeof x.new === 'number' ? PF.money(x.new) : x.new))));
      const m = mk('p', 'small muted', 'Detected ' + x.detectedAt + (x.publishedAt ? ' · published ' + x.publishedAt : ' · published date not stated') + ' · '); if (x.source && x.source.url) { const s = mk('a', '', 'Source: ' + (x.source.name || 'official record')); s.href = x.source.url; s.target = '_blank'; s.rel = 'noopener noreferrer'; m.appendChild(s); }
      li.appendChild(m); ul.appendChild(li);
    });
    box.appendChild(ul);
  }
  function list() {
    const box = $('wl-list'); box.textContent = '';
    if (!D.watch.length) { box.appendChild(mk('p', 'muted', 'You are not watching any parcels yet.')); return; }
    D.watch.forEach(w => {
      const c = mk('div', 'pfcard'); const h = mk('div', 'pfcard-top'); const a = mk('a', '', w.county + ' · ' + w.parcel + (w.cert ? ' (cert ' + w.cert + ')' : '')); a.href = href(w.key); h.appendChild(mk('b', '')); h.firstChild.appendChild(a); c.appendChild(h);
      c.appendChild(mk('p', w.noLongerListed ? 'notice small' : 'small', w.noLongerListed ? 'No longer listed. Outcome unconfirmed.' : (w.latest ? w.latest.text : 'No changes detected since you started watching.')));
      if (w.latest) c.appendChild(mk('p', 'small muted', 'Latest update detected ' + w.latest.detectedAt + (w.latest.publishedAt ? ' · published ' + w.latest.publishedAt : '')));
      c.appendChild(mk('p', 'small muted', w.lastVerified ? 'Last verified import: ' + w.lastVerified.at : 'Updates for this county are not tracked yet.'));
      const row = mk('div', 'lact'); const d = mk('a', 'btn small ghost', 'Details & timeline'); d.href = href(w.key); const ws = mk('a', 'btn small ghost', 'Worksheet'); ws.href = href(w.key) + '#ws';
      const u = mk('button', 'btn small ghost', 'Unwatch'); u.type = 'button'; u.addEventListener('click', async () => { u.disabled = true; const x = await PF.api('unwatch', {key: w.key}); if (x.d.ok) { D.watch = D.watch.filter(y => y.key !== w.key); D.notifications = D.notifications.filter(y => y.key !== w.key); D.unread = D.notifications.filter(y => !y.read).length; feed(); list(); } else u.disabled = false; });
      row.append(d, ws, u); c.appendChild(row); box.appendChild(c);
    });
  }
  async function sheets() {
    const box = $('wl-ws'); box.textContent = ''; const s = await PF.api('wsList');
    if (!s.d.sheets || !s.d.sheets.length) { box.appendChild(mk('p', 'muted', 'No worksheets yet. Open a parcel and use “Bid or Pass worksheet”.')); return; }
    const ul = mk('ul', 'pffeed'); s.d.sheets.forEach(x => { const li = mk('li'); const p = PF.parseKey(x.key); const a = mk('a', '', p.county + ' · ' + p.parcel); a.href = href(x.key) + '#ws'; li.append(a, mk('span', 'small muted', ' — ' + (x.decision || 'no decision yet') + (x.maxBid != null ? ' · my max bid ' + PF.money(x.maxBid) : ''))); ul.appendChild(li); }); box.appendChild(ul);
  }
  function prefs() {
    const f = $('wl-prefs'); f.textContent = '';
    const L = {amount: 'Amount or payoff changes', schedule: 'Auction rescheduled, canceled or date changed', result: 'Results posted', outcome: 'Redemption or withdrawal confirmed by an official record', availability: 'Listed, no longer listed, or listed again'};
    const cb = (label, checked, on, dis) => { const lb = mk('label', 'chk'), i = mk('input'); i.type = 'checkbox'; i.checked = checked; i.disabled = !!dis; i.addEventListener('change', () => on(i.checked)); lb.append(i, ' ' + label); f.appendChild(lb); return i; };
    const save = async b => { const r = await PF.api('prefs', b); if (r.d.ok) { D.prefs = r.d.prefs; const m = await PF.api('me'); if (m.status === 200) { D = m.d; feed(); } } };
    cb('Show updates here (in-app)', D.prefs.inApp, v => { save({inApp: v}); });
    Object.keys(L).forEach(k => cb(L[k], D.prefs.types[k], v => save({types: {[k]: v}})));
    cb('Also email me these updates (once a day, only new ones)', D.prefs.email, v => save({email: v}), !D.mailReady);
    if (!D.mailReady) f.appendChild(mk('p', 'small muted', 'Email alerts are not set up on this site yet, so they are unavailable. In-app alerts work now.'));
  }
  feed(); list(); prefs(); sheets();
  $('wl-counties').textContent = 'Updates are tracked for: ' + (D.counties || []).map(c => c.county + ', ' + c.state).join(' · ') + '. We add counties as their official data is ready.';
})();
