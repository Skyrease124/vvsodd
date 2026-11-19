// Pro Download Center: weekly allowance, current selection, saved lists, download history. The server owns every number shown here.
(function () {
  'use strict';
  const $ = id => document.getElementById(id), mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const nice = d => d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '';
  let S = null; const fmtN = n => Number(n).toLocaleString('en-US');
  const link = (t, h, cls) => { const a = mk('a', cls || '', t); a.href = h; return a; };
  const btn = (t, cls, fn) => { const b = mk('button', 'ppab ' + (cls || ''), t); b.type = 'button'; b.addEventListener('click', fn); return b; };
  function meter() {
    const h = $('dlMeter'); h.textContent = ''; h.appendChild(mk('h2', '', 'Pro Property Downloads'));
    if (S.unlimited) { h.append(mk('p', '', 'Owner access: no weekly limit.')); return; }
    const m = mk('div', 'meter'); m.append(mk('b', '', S.used + ' / ' + S.limit), mk('span', '', 'used this week')); const pr = mk('div', 'ppa-prog'); pr.setAttribute('role', 'progressbar'); pr.setAttribute('aria-valuemin', '0'); pr.setAttribute('aria-valuemax', String(S.limit)); pr.setAttribute('aria-valuenow', String(S.used)); pr.setAttribute('aria-label', 'Weekly property exports used'); const i = mk('i'); i.style.width = '0%'; pr.appendChild(i); requestAnimationFrame(() => requestAnimationFrame(() => { i.style.width = Math.min(100, S.used / S.limit * 100) + '%'; }));
    const g = mk('div', 'grid3'); [[S.used, 'Exported'], [S.remaining, 'Remaining'], [nice(S.resets), 'Next reset']].forEach(([v, k]) => { const d = mk('div'); d.append(mk('b', '', String(v)), mk('span', '', k)); g.appendChild(d); });
    h.append(m, pr, g, mk('p', 'mute', 'Your allowance renews with your subscription week. Unused downloads do not roll over. Re-downloading a property you already exported this week costs nothing.'));
  }
  function selection() {
    const h = $('dlSel'); h.textContent = ''; const it = window.PPASel ? PPASel.items() : [];
    if (!it.length) { h.append(mk('p', 'empty', 'No properties selected. Tick the Select box on any property card, parcel map popup or property page.'), link('Open the Parcel Map', '/map/', 'ppab go')); h.lastChild.style.cssText = 'display:inline-flex;align-items:center;text-decoration:none;color:#fff'; return; }
    h.append(mk('p', 'mute', it.length + (it.length === 1 ? ' property' : ' properties') + ' selected.'));
    const row = mk('div'); row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin:8px 0'; row.append(btn('Download Selected', 'go', () => PPASel.openDownload()), btn('Compare', '', () => PPASel.openCompare(it)), btn('Save Selection', '', () => PPASel.openSave(it)), btn('Clear', 'quiet', () => PPASel.clear())); h.appendChild(row);
    it.slice(0, 50).forEach(x => { const r = mk('div', 'row'), g = mk('div', 'g', x.t || x.i); r.append(g, btn('Remove', 'quiet', () => PPASel.remove(x.i))); h.appendChild(r); }); if (it.length > 50) h.append(mk('p', 'mute', '+ ' + (it.length - 50) + ' more'));
  }
  async function reload() { const s = await PPASel.refresh(); if (!s || !s.paid) return gate(s); S = s; $('dlGate').hidden = true; $('dlApp').hidden = false; meter(); selection(); lists(); history(); }
  function gate(s) {
    $('dlApp').hidden = true; const g = $('dlGate'); g.hidden = false; g.textContent = '';
    if (!s) g.append(link('Sign in', '/login/?next=/downloads/'), document.createTextNode(' to see your Download Center.'));
    else g.append(document.createTextNode('Property downloads are a Pro feature. '), link('See the Pro plan', '/plans/?from=' + encodeURIComponent(location.pathname + location.search) + '&src=' + encodeURIComponent('Property downloads')), document.createTextNode(' · '), link('Compare Free vs Pro', '/plans/'));
  }
  function lists() {
    const h = $('dlLists'); h.textContent = ''; const L = S.lists || [];
    const add = btn('+ New list', '', async () => { const n = prompt('Name your list (for example: Virginia Vacant Land)'); if (!n) return; const r = await PPASel.post({ action: 'colCreate', name: n }); if (!r.ok) return PPASel.toast(r.d.error || 'Could not create the list.', true); reload(); }); h.appendChild(add);
    if (!L.length) { h.append(mk('p', 'empty', 'No lists yet. Make lists like “Upcoming Auctions” or “Properties to Research”. Saving to a list is free.')); return; }
    L.forEach(l => {
      const d = mk('details'), s = mk('summary', '', l.name + ' (' + l.items.length + ')'); d.appendChild(s);
      const row = mk('div'); row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin:6px 0'; row.append(btn('Select all', '', () => { l.items.forEach(x => PPASel.toggle(x, true)); selection(); PPASel.toast('Added to your selection'); }), btn('Compare', '', () => PPASel.openCompare(l.items)), btn('Rename', 'quiet', async () => { const n = prompt('New name', l.name); if (!n) return; const r = await PPASel.post({ action: 'colRename', id: l.id, name: n }); if (r.ok) reload(); else PPASel.toast(r.d.error || 'Could not rename.', true); }), btn('Delete list', 'quiet', async () => { if (!confirm('Delete the list “' + l.name + '”? The properties themselves are not deleted anywhere else.')) return; const r = await PPASel.post({ action: 'colDelete', id: l.id }); if (r.ok) reload(); })); d.appendChild(row);
      if (!l.items.length) d.append(mk('p', 'empty', 'This list is empty.'));
      l.items.slice(0, 100).forEach(x => { const r = mk('div', 'row'), g = mk('div', 'g', x.t || x.i); const sel = mk('select'); sel.setAttribute('aria-label', 'Move to another list'); const o0 = mk('option', '', 'Move to…'); o0.value = ''; sel.appendChild(o0); L.filter(z => z.id !== l.id).forEach(z => { const o = mk('option', '', z.name); o.value = z.id; sel.appendChild(o); }); sel.addEventListener('change', async () => { if (!sel.value) return; const rr = await PPASel.post({ action: 'colMove', from: l.id, to: sel.value, items: [x] }); if (rr.ok) reload(); else PPASel.toast(rr.d.error || 'Could not move.', true); }); r.append(g); if (L.length > 1) r.append(sel); r.append(btn('Select', '', () => { PPASel.toggle(x, true); selection(); }), btn('Remove', 'quiet', async () => { const rr = await PPASel.post({ action: 'colRemove', id: l.id, items: [x] }); if (rr.ok) reload(); })); d.appendChild(r); });
      if (l.items.length > 100) d.append(mk('p', 'mute', '+ ' + (l.items.length - 100) + ' more in this list'));
      h.appendChild(d);
    });
  }
  function history() {
    const h = $('dlHist'); h.textContent = ''; const H = S.history || [];
    if (!H.length) { h.append(mk('p', 'empty', 'Nothing exported yet. When you download properties, your files and history show up here for 30 days.')); return; }
    H.slice(0, 50).forEach(x => { const r = mk('div', 'row'), g = mk('div', 'g'); g.append(document.createTextNode(x.name), mk('small', '', x.n + (x.n === 1 ? ' property' : ' properties') + ' · ' + x.fmt.toUpperCase() + ' · ' + (x.credits ? x.credits + ' used' : 'no allowance used') + ' · ' + new Date(x.at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }))); r.appendChild(g); if (x.fileAvailable) { const a = mk('a', 'ppab', 'Download again'); a.href = '/.netlify/functions/export?file=' + x.job; a.style.cssText = 'display:inline-flex;align-items:center;text-decoration:none;color:#fff'; r.appendChild(a); } else r.appendChild(mk('small', '', 'File expired')); h.appendChild(r); });
    h.append(mk('p', 'mute', 'Downloading a stored file again never uses your allowance.'));
  }
  function start() { if (!window.PPASel) return setTimeout(start, 50); PPASel.ready().then(reload); document.addEventListener('ppasel', () => { if (S) selection(); }); document.addEventListener('ppausage', reload); document.addEventListener('ppalists', reload); }
  start();
})();
