/* Shows each record's status, data freshness, official source and warnings (rules live in data-status.js). */
const DataStatusUI = {
  _reg: null,
  registry() { if (!this._reg) this._reg = fetch('/liens/states/data-registry.json').then(r => r.ok ? r.json() : null).catch(() => null); return this._reg; },
  mk(t, c, x) { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; },
  // Two small chips for a listing card: what the record is, and how fresh the check is.
  chips(l) {
    const d = DataStatus.describe(l), row = this.mk('div', 'dsrow');
    const a = this.mk('span', 'dschip tone-' + d.status.tone, d.status.label); a.title = d.status.meaning;
    const b = this.mk('span', 'dschip tone-' + d.freshness.tone, d.freshness.label);
    row.append(a, b);
    if (d.warnings.length) { const w = this.mk('p', 'dswarn small', d.warnings[0]); row.appendChild(w); }
    return row;
  },
  // Full panel for the parcel page.
  panel(l) {
    const d = DataStatus.describe(l), box = this.mk('section', 'dspanel'); box.setAttribute('aria-label', 'Data status and sources');
    box.appendChild(this.mk('h2', '', 'Data status and sources'));
    const grid = this.mk('div', 'dsgrid'), cell = (k, v, tone) => { const c = this.mk('div', 'dscell'); c.append(this.mk('span', 'dsk', k)); const b = this.mk('b', tone ? 'tone-' + tone : '', v); c.appendChild(b); grid.appendChild(c); return c; };
    cell('Status', d.status.label, d.status.tone).appendChild(this.mk('span', 'dssub', d.status.meaning));
    cell('Last checked', d.freshness.label, d.freshness.tone);
    box.appendChild(grid);
    const how = this.mk('ul', 'dsways');
    how.appendChild(this.mk('li', '', l.source ? 'Imported from the official source below. We copy the list as published and do not invent missing details.' : 'No official source link is attached to this record.'));
    const second = this.mk('li', 'warn', 'Checking for a second official source\u2026'); how.appendChild(second);
    const done = (txt, cls) => { second.className = cls; second.textContent = txt; };
    if ((l.state || 'FL') === 'FL' && typeof ParcelData !== 'undefined') ParcelData.rec(l).then(({file, r}) => {
      if (r && r.st === 'matched') done('The parcel ID was found in the official Florida statewide parcel layer' + (file && file.sources && file.sources.parcels && file.sources.parcels.date ? ' (' + file.sources.parcels.date + ')' : '') + (r.own ? ' and the Florida Department of Revenue tax roll' : '') + '.', 'ok');
      else done('Not matched to the statewide parcel layer. Details are as the county list printed them.', 'warn');
    }).catch(() => done('The second-source check is unavailable right now.', 'warn'));
    else done('No second-source check is built for this county yet, so details such as acreage and owner are as the list printed them.', 'warn');
    box.appendChild(how);
    if (d.warnings.length) { const w = this.mk('div', 'dswarnbox'); w.appendChild(this.mk('b', '', 'Check before relying on this')); const ul = this.mk('ul'); d.warnings.forEach(x => ul.appendChild(this.mk('li', '', x))); w.appendChild(ul); box.appendChild(w); }
    const src = this.mk('p', 'small');
    if (l.source) { const a = this.mk('a', '', 'Open the official source'); a.href = l.source; a.target = '_blank'; a.rel = 'noopener noreferrer'; src.append(a, ' (' + (l.source.replace(/^https?:\/\//, '').split('/')[0]) + ')'); box.appendChild(src); }
    const reg = this.mk('p', 'small muted dsreg'); box.appendChild(reg);
    this.registry().then(r => { const c = r && (r.counties || []).find(x => x.county === l.county && x.state === (l.state || 'FL')); if (!c) return;
      reg.textContent = l.county + ' County list: ' + c.updateMode + '. ' + c.records.toLocaleString('en-US') + ' records loaded; the county list was last checked ' + (c.lastChecked || 'on an unknown date') + '.' + (c.probe ? ' The county’s official page ' + (c.probe.ok ? 'answered our connection check on ' + c.probe.checked + '.' : 'did not answer our connection check on ' + c.probe.checked + (c.probe.note ? ' (' + c.probe.note + ')' : '') + '.') : ''); });
    box.appendChild(this.mk('p', 'small muted', 'A record that disappears from a newer list is shown as “No longer listed. Outcome unconfirmed.” We never turn that into sold, redeemed or canceled without an official record that says so.'));
    return box;
  }
};
