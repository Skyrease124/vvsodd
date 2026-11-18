// Property selection for Pro members: checkboxes on property cards, a sticky toolbar, compare, save to lists, and a confirmed, counted download.
// Browsing, comparing, selecting and saving are free and unlimited; only exporting files uses the 100-per-week allowance, enforced on the server.
// Pages add a placeholder:  <span data-ppasel='{"i":"FL|Leon|123|","t":"Short label"}'></span>  and this script turns it into a checkbox for Pro members.
(function () {
  'use strict';
  if (window.PPASel) return;
  const API = '/.netlify/functions/export', LS = 'ppa_sel_v1';
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const sel = new Map(); let status = null, enabled = false, bar = null, saveT = null, ready = null;
  const post = (body) => fetch(API, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(async r => { let d = null; try { d = await r.json(); } catch (e) {} return { ok: r.ok, status: r.status, d: d || {} }; }).catch(() => ({ ok: false, status: 0, d: { error: 'We could not reach the server. Check your connection and try again.' } }));
  const lsGet = () => { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch (e) { return []; } };
  const lsPut = () => { try { localStorage.setItem(LS, JSON.stringify([...sel.values()])); } catch (e) {} };
  const items = () => [...sel.values()];
  const wire = i => i.map(x => ({ i: x.i, t: x.t }));
  function toast(msg, err) { const t = mk('div', 'ppa-toast' + (err ? ' err' : ''), msg); t.setAttribute('role', 'status'); document.body.appendChild(t); requestAnimationFrame(() => t.classList.add('show')); setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3800); }
  function dialog(title, wide) { const d = mk('dialog', 'ppad' + (wide ? ' wide' : '')), hd = mk('div', 'hd'), x = mk('button', 'x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.addEventListener('click', () => d.close()); hd.append(mk('h2', '', title), x); const bd = mk('div', 'bd'), ft = mk('div', 'ft'); d.append(hd, bd, ft); d.addEventListener('close', () => d.remove()); document.body.appendChild(d); d.showModal(); return { d, bd, ft }; }
  const btn = (label, cls, fn) => { const b = mk('button', 'ppab ' + (cls || ''), label); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; };

  // ---------- status ----------
  async function refreshStatus() { try { const r = await fetch(API, { credentials: 'same-origin' }); if (!r.ok) { status = null; return null; } status = await r.json(); } catch (e) { status = null; } return status; }
  const remainingText = () => !status ? '' : status.unlimited ? 'Owner access: no weekly limit' : 'Weekly allowance remaining: ' + status.remaining;
  const nice = d => d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' }) : '';

  // ---------- selection ----------
  function emit() { document.querySelectorAll('.ppasel').forEach(l => { const on = sel.has(l.dataset.k); l.classList.toggle('on', on); l.firstChild.checked = on; }); drawBar(); document.dispatchEvent(new CustomEvent('ppasel', { detail: { count: sel.size } })); }
  function saveSoon() { lsPut(); clearTimeout(saveT); saveT = setTimeout(() => { if (enabled) post({ action: 'selSave', items: wire(items()) }); }, 900); }
  function toggle(item, on) { const has = sel.has(item.i); if (on === undefined) on = !has; if (on && !has) { if (sel.size >= 500) { toast('You can keep up to 500 properties selected.', true); return; } sel.set(item.i, { i: item.i, t: item.t || item.i.split('|')[2] }); } else if (!on) sel.delete(item.i); saveSoon(); emit(); }
  function remove(i) { sel.delete(i); saveSoon(); emit(); }
  function clear() { sel.clear(); saveSoon(); emit(); }
  function control(item) {
    const l = mk('label', 'ppasel'), c = mk('input'); c.type = 'checkbox'; c.setAttribute('aria-label', 'Select this property for download'); l.dataset.k = item.i; l.append(c, document.createTextNode('Select'));
    c.checked = sel.has(item.i); l.classList.toggle('on', c.checked); c.addEventListener('change', () => toggle(item, c.checked)); l.addEventListener('click', e => e.stopPropagation()); return l;
  }
  function decorate(root) { if (!enabled) return; (root || document).querySelectorAll('[data-ppasel]:not([data-done])').forEach(ph => { let it; try { it = JSON.parse(ph.getAttribute('data-ppasel')); } catch (e) { return; } if (!it || !it.i) return; ph.dataset.done = '1'; ph.classList.add('ppasel-ph'); ph.appendChild(control(it)); }); }

  // ---------- toolbar ----------
  function drawBar() {
    if (!enabled) return; if (!bar) { bar = mk('div'); bar.id = 'ppaBar'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Selected properties'); document.body.appendChild(bar); }
    const n = sel.size; bar.classList.toggle('show', n > 0); document.body.classList.toggle('ppa-has-bar', n > 0); if (!n) { document.documentElement.style.setProperty('--ppabh', '0px'); return; } bar.textContent = '';
    const inn = mk('div', 'in'), info = mk('div', 'info'); const b = mk('b', '', 'Selected: ' + n + (n === 1 ? ' property' : ' properties')); info.append(b, mk('span', '', remainingText() + (status && !status.unlimited ? ' · resets ' + nice(status.resets) : '')));
    const btns = mk('div', 'btns'); btns.append(btn('Download Selected', 'go', () => openDownload()), btn('View Selection', '', () => openView()), btn('Compare Properties', '', () => openCompare(items())), btn('Save Selection', '', () => openSave(items())), btn('Clear Selection', 'quiet', clear)); inn.append(info, btns); bar.appendChild(inn); document.documentElement.style.setProperty('--ppabh', (document.body.classList.contains('dlpage') ? 0 : bar.offsetHeight) + 'px');
  }

  // ---------- dialogs ----------
  function openView() { const { d, bd, ft } = dialog('Your selection'); const ul = mk('ul', 'items'); const draw = () => { ul.textContent = ''; if (!sel.size) { d.close(); return; } items().forEach(x => { const li = mk('li'); li.append(mk('span', '', x.t || x.i), btn('Remove', 'quiet', () => { remove(x.i); draw(); })); ul.appendChild(li); }); }; draw(); bd.append(mk('p', 'note', 'Selecting and saving never uses your download allowance. Only downloading files does.'), ul); ft.append(btn('Close', '', () => d.close()), btn('Download Selected', 'go', () => { d.close(); openDownload(); })); }
  const CMP = ['Owner name', 'Property address', 'County', 'State', 'Acreage', 'Property classification', 'Record category', 'Amount on the list', 'What the amount is', 'Auction or sale date', 'Sale status', 'Zoning', 'Flood zone (FEMA)', 'Wetlands (NWI)', 'Last verified'];
  async function openCompare(list) {
    const { d, bd, ft } = dialog('Compare properties', true); ft.append(btn('Close', '', () => d.close()));
    if (list.length < 2) { bd.append(mk('p', '', 'Select at least two properties to compare them. Comparing is free.')); return; }
    const use = list.slice(0, 12); bd.append(mk('p', 'note', 'Comparing ' + use.length + ' properties. This does not use your download allowance.' + (list.length > 12 ? ' Showing the first 12.' : '')), mk('p', 'note', 'Loading…'));
    const r = await post({ action: 'info', items: wire(use) }); bd.lastChild.remove(); if (!r.ok) { bd.append(mk('p', 'warn', r.d.error || 'Could not load the properties.')); return; }
    const w = mk('div', 'ppa-cmp'), t = mk('table'), hr = mk('tr'); hr.append(mk('th', '', ''));
    r.d.rows.forEach(x => hr.append(mk('th', '', x['Property address'] || 'Parcel ' + x['Parcel ID']))); t.appendChild(hr);
    const row = (label, f) => { const tr = mk('tr'); tr.append(mk('td', '', label)); r.d.rows.forEach(x => tr.append(mk('td', '', f(x)))); t.appendChild(tr); };
    row('Parcel ID', x => x['Parcel ID']); CMP.forEach(k => row(k, x => x[k] === '' || x[k] == null ? 'Not on file' : (k === 'Amount on the list' ? '$' + Number(x[k]).toLocaleString('en-US') : String(x[k]))));
    w.appendChild(t); bd.appendChild(w); if (r.d.missing && r.d.missing.length) bd.append(mk('p', 'note', r.d.missing.length + ' selected ' + (r.d.missing.length === 1 ? 'property is' : 'properties are') + ' not in our records yet.'));
  }
  async function openSave(list) {
    const { d, bd, ft } = dialog('Save to a list'); if (!list.length) { bd.append(mk('p', '', 'Select some properties first.')); ft.append(btn('Close', '', () => d.close())); return; }
    bd.append(mk('p', 'note', 'Saving ' + list.length + (list.length === 1 ? ' property' : ' properties') + '. Saving is free and does not use your downloads.'));
    const s = await refreshStatus(); const lists = (s && s.lists) || [], pick = mk('select'); pick.setAttribute('aria-label', 'Choose a list'); lists.forEach(l => { const o = mk('option', '', l.name + ' (' + l.items.length + ')'); o.value = l.id; pick.appendChild(o); }); const o2 = mk('option', '', '+ New list…'); o2.value = '_new'; pick.appendChild(o2);
    const name = mk('input'); name.type = 'text'; name.placeholder = 'List name, e.g. Virginia Vacant Land'; name.maxLength = 60; name.setAttribute('aria-label', 'New list name'); const msg = mk('p', 'warn'); msg.hidden = true;
    const showName = () => { name.hidden = pick.value !== '_new'; }; pick.addEventListener('change', showName); if (!lists.length) pick.value = '_new'; showName(); bd.append(pick, name, msg);
    const go = btn('Save', 'go', async () => { go.disabled = true; const r = pick.value === '_new' ? await post({ action: 'colCreate', name: name.value, items: wire(list) }) : await post({ action: 'colAdd', id: pick.value, items: wire(list) }); if (r.ok) { d.close(); toast('Saved to your list.'); document.dispatchEvent(new CustomEvent('ppalists')); } else { go.disabled = false; msg.hidden = false; msg.textContent = r.d.error || 'Could not save.'; } });
    ft.append(btn('Cancel', '', () => d.close()), go);
  }
  // Download: choose format -> confirm with exact numbers -> progress -> success. Failed exports use nothing.
  const FMT = [['csv', 'CSV', 'spreadsheet data'], ['xlsx', 'Excel', '.xlsx'], ['pdf', 'PDF', 'info sheets'], ['zip', 'ZIP', 'PDFs + CSV']];
  async function openDownload(listArg, fmtArg) {
    const list = listArg || items(); const { d, bd, ft } = dialog('Download properties');
    if (!list.length) { bd.append(mk('p', '', 'Select some properties first. Browsing and saving are free.')); ft.append(btn('Close', '', () => d.close())); return; }
    if (list.length > 100) { bd.append(mk('p', 'warn', 'You can download up to 100 properties at a time. You have ' + list.length + ' selected. Remove some, or download in two steps.')); ft.append(btn('Close', '', () => d.close())); return; }
    let fmt = fmtArg || 'csv'; const fm = mk('div', 'fmts'); const fbtn = FMT.map(([k, n, s]) => { const b = mk('button'); b.type = 'button'; b.append(document.createTextNode(n), mk('small', '', s)); b.setAttribute('aria-pressed', String(k === fmt)); b.addEventListener('click', () => { fmt = k; fbtn.forEach((x, i) => x.setAttribute('aria-pressed', String(FMT[i][0] === k))); }); fm.appendChild(b); return b; });
    const info = mk('div'); const go = btn('Confirm Download', 'go'); go.disabled = true; bd.append(mk('p', 'note', 'Choose a format. The format does not change how many downloads are used.'), fm, info);
    ft.append(btn('Cancel', '', () => d.close()), go); info.append(mk('p', 'note', 'Checking your allowance…'));
    const pv = await post({ action: 'preview', items: wire(list) }); info.textContent = '';
    if (!pv.ok) { info.append(mk('p', 'warn', pv.d.error || 'Could not check your allowance.')); return; }
    const p = pv.d, found = p.total; const lines = [];
    if (p.missing && p.missing.length) { info.append(mk('p', 'warn', p.missing.length + ' selected ' + (p.missing.length === 1 ? 'property is' : 'properties are') + ' not in our records yet. Remove ' + (p.missing.length === 1 ? 'it' : 'them') + ' from your selection to continue. Nothing has been used.')); return; }
    info.append(mk('p', 'big', 'You are about to download ' + found + (found === 1 ? ' property.' : ' properties.')));
    if (p.unlimited) info.append(mk('p', '', 'Owner access: this does not use any weekly exports.'));
    else {
      info.append(mk('p', '', 'This will use ' + p.fresh + ' of your ' + p.limit + ' weekly property exports.'));
      if (p.already) info.append(mk('p', 'note', p.already + ' of these you already exported this week, so they cost nothing again.'));
      if (p.fits) info.append(mk('p', '', 'You will have ' + p.after + ' remaining. Your allowance resets on ' + p.resetsText + '.'));
      else { info.append(mk('p', 'warn', 'This would go over your weekly allowance. You have ' + p.remaining + ' left and this needs ' + p.fresh + '. Your allowance resets on ' + p.resetsText + '. You can remove some properties, or keep browsing and saving as much as you like.')); return; }
    }
    go.disabled = false;
    go.addEventListener('click', async () => {
      go.disabled = true; bd.textContent = ''; ft.textContent = ''; const prog = mk('div', 'ppa-prog busy'), bar2 = mk('i'); prog.appendChild(bar2); bd.append(mk('p', 'big', 'Preparing your ' + (FMT.find(f => f[0] === fmt)[1]) + ' file…'), prog, mk('p', 'note', 'You can close this and keep browsing; the file will be saved to your Download Center.'));
      const r = await post({ action: 'export', items: wire(list), format: fmt, confirm: true });
      bd.textContent = ''; ft.textContent = '';
      if (!r.ok) { bd.append(mk('p', 'warn', r.d.error || 'The download did not work. Nothing was used from your allowance.')); ft.append(btn('Close', '', () => d.close())); await refreshStatus(); drawBar(); return; }
      status && (status.used = r.d.used, status.remaining = r.d.remaining); drawBar(); document.dispatchEvent(new CustomEvent('ppausage'));
      bd.append(mk('p', 'good', 'Done. ' + r.d.count + (r.d.count === 1 ? ' property' : ' properties') + ' exported (' + r.d.credits + ' used).'), mk('p', '', r.d.remaining == null ? 'Owner access: no weekly limit.' : 'You have ' + r.d.remaining + ' weekly exports remaining. Resets on ' + r.d.resetsText + '.'), mk('p', 'note', 'Your file is also saved in your Download Center for 30 days.'));
      const a = mk('a', 'ppab go', 'Download file'); a.href = r.d.url; a.setAttribute('download', r.d.name); a.style.display = 'inline-flex'; a.style.alignItems = 'center'; a.style.textDecoration = 'none'; const c = mk('a', 'ppab', 'Open Download Center'); c.href = '/downloads/'; c.style.cssText = a.style.cssText; ft.append(c, a); toast('Export ready');
      setTimeout(() => { try { a.click(); } catch (e) {} }, 300);
    });
  }

  // ---------- start ----------
  async function init() {
    lsGet().forEach(x => x && x.i && sel.set(x.i, x));
    const s = await refreshStatus(); if (!s || !s.paid) { enabled = false; return; } enabled = true;
    (s.sel || []).forEach(x => { if (!sel.has(x.i)) sel.set(x.i, x); }); if (sel.size) saveSoon();
    decorate(); emit(); new MutationObserver(() => decorate()).observe(document.body, { childList: true, subtree: true });
  }
  if (!document.getElementById('ppa-dl-css')) { const l = mk('link'); l.id = 'ppa-dl-css'; l.rel = 'stylesheet'; l.href = '/dl/dl.css'; document.head.appendChild(l); }
  ready = (document.readyState === 'loading' ? new Promise(r => document.addEventListener('DOMContentLoaded', r)) : Promise.resolve()).then(init);
  window.PPASel = { items, has: i => sel.has(i), toggle, remove, clear, control, decorate, openDownload, openCompare, openSave, openView, post, status: () => status, refresh: refreshStatus, ready: () => ready, enabled: () => enabled, toast };
})();
