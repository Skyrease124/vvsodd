// Property & Neighborhood Report (Miami-Dade and Palm Beach to start). Data comes from /.netlify/functions/report, which queries
// official services by county + folio/PCN. Every block says where it came from and when; "unavailable" is never shown as zero.
PF.REPORT_COUNTIES = ['Miami-Dade', 'Palm Beach', 'Alachua', 'Bay', 'Duval', 'Escambia', 'Hernando', 'Hillsborough', 'Leon', 'Manatee', 'Nassau', 'Osceola', 'Pasco', 'Santa Rosa', 'Sarasota', 'Volusia', 'Walton'];
PF.copy = async (text, el, msg) => {
  try { await navigator.clipboard.writeText(text); } catch (e) { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (x) {} t.remove(); }
  if (el) { const old = el.textContent; el.textContent = msg || 'Copied'; setTimeout(() => { el.textContent = old; }, 1600); }
};
PF.srcLink = (s, label) => { const a = PF.mk('a', 'small', label || ('Source: ' + s.name)); a.href = s.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; };

// The four buttons. They open the official search in a new tab and copy the parcel ID so it can be pasted there.
PF.reportButtons = function (host, l, getRep) {
  const mk = PF.mk, id = () => (getRep() && getRep().copy) || l.parcel;
  const defs = [['View deed records', r => r && r.links.deeds, 'rep-own'], ['Search probate', r => r && r.links.probate, 'rep-own'], ['Check permits and violations', r => r && r.links.permits, 'rep-permits'], ['View crime data', r => r && r.links.crime, 'rep-crime']];
  defs.forEach(([label, pick, sec]) => {
    const b = mk('a', 'btn small ghost', label); b.href = '#' + sec; b.setAttribute('role', 'button');
    b.addEventListener('click', e => {
      const lk = pick(getRep());
      if (lk && lk.url) { e.preventDefault(); PF.copy(id()); window.open(lk.url, '_blank', 'noopener'); const t = document.getElementById('rep-toast'); if (t) { t.textContent = 'Parcel ID ' + id() + ' copied. Paste it into the search that just opened.'; } }
    });
    host.appendChild(b);
  });
};

PF.report = async function (host, l) {
  const mk = PF.mk; host.textContent = '';
  host.appendChild(mk('h2', '', 'Property & Neighborhood Report'));
  host.appendChild(mk('p', 'small muted', 'Facts from official county and state records, each with its source and date. Where a record cannot be queried automatically we give a direct link and a copyable parcel ID instead. Educational only; verify with the county before you bid.'));
  const toast = mk('p', 'small', ''); toast.id = 'rep-toast'; toast.setAttribute('role', 'status'); host.appendChild(toast);
  const st = mk('p', 'muted', 'Checking official sources…'); host.appendChild(st);
  let rep = null;
  try { const r = await fetch('/.netlify/functions/report?county=' + encodeURIComponent(l.county) + '&parcel=' + encodeURIComponent(l.parcel)); rep = await r.json(); if (!r.ok || !rep.supported) rep = null; } catch (e) { rep = null; }
  PF._rep = rep; st.remove();
  if (!rep) { host.appendChild(mk('p', 'notice', 'The report could not be loaded just now. Use the four buttons above to open the official searches.')); return; }
  const chip = mk('p', 'small'); chip.append('Matched by county and ' + rep.idLabel + ': ', mk('b', '', rep.copy + ' ')); const cb = mk('button', 'btn small ghost', 'Copy ID'); cb.type = 'button'; cb.addEventListener('click', () => PF.copy(rep.copy, cb)); chip.appendChild(cb); host.appendChild(chip);
  host.appendChild(mk('p', 'small muted', rep.match.note + ' Report generated ' + rep.generatedAt.slice(0, 16).replace('T', ' ') + ' UTC.'));
  const sec = (id, title) => { const s = mk('div', 'rep-sec'); s.id = id; s.appendChild(mk('h3', '', title)); host.appendChild(s); return s; };
  const row = (dl, k, v) => { if (v == null || v === '') return; dl.append(mk('dt', '', k), mk('dd', '', v)); };
  const lookup = (box, lk, extra) => { if (!lk) return; const p = mk('p', 'small'); const a = mk('a', 'btn small ghost', lk.name || 'Open the official search'); a.href = lk.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.addEventListener('click', () => PF.copy(rep.copy)); p.appendChild(a); if (lk.how || extra) p.appendChild(mk('span', 'small muted', ' ' + (extra || lk.how))); if (lk.checked === false) p.appendChild(mk('span', 'small muted', ' (We could not test this link automatically.)')); box.appendChild(p); };

  // ---- 1. Ownership, deeds, estates
  const o = sec('rep-own', 'Ownership, deeds and estates'); const ow = rep.ownership;
  const badge = mk('p', ow.status === 'estate_linked' ? 'notice' : 'small'); badge.appendChild(mk('b', 'pfstatus pfstatus-' + ow.status, ow.label || 'Owner status unverified')); o.appendChild(badge);
  if (ow.why) o.appendChild(mk('p', 'small muted', ow.why));
  if (ow.estate) { const dl = mk('dl', 'pfws-facts'); row(dl, 'Case number', ow.estate.caseNumber); row(dl, 'Official document', ow.estate.documentTitle); row(dl, 'Confirmed by reviewer', ow.estate.confirmedAt); o.appendChild(dl); o.appendChild(PF.srcLink({name: ow.estate.documentTitle, url: ow.estate.sourceUrl}, 'Source: ' + ow.estate.documentTitle)); }
  if (ow.record) {
    const dl = mk('dl', 'pfws-facts'); row(dl, 'Owner of record', ow.owner); row(dl, 'Trustee / fiduciary', ow.fiduciary); row(dl, 'Owner mailing address', ow.mailing); row(dl, 'Property use (appraiser)', ow.use); o.appendChild(dl);
    o.appendChild(mk('p', 'small muted', 'Source: ' + ow.source.name + (ow.sourceDate ? ' (roll dated ' + ow.sourceDate + ')' : '') + '; queried ' + ow.queriedAt.slice(0, 10) + '.'));
    if (ow.lastSale) { const s = ow.lastSale, d2 = mk('dl', 'pfws-facts'); row(d2, 'Latest sale on the roll', s.date + (s.price ? ' for ' + PF.money(s.price) : '')); row(d2, 'Official Records book / page', s.book ? s.book + ' / ' + s.page : ''); row(d2, 'Clerk instrument number', s.instrument); o.appendChild(d2); o.appendChild(mk('p', 'small muted', s.note)); }
    else o.appendChild(mk('p', 'small muted', 'No sale is listed on the appraiser’s record for this parcel. Search the Clerk for deeds.'));
  } else o.appendChild(mk('p', 'small', rep.match.status === 'ambiguous' ? 'Ownership is held back until a reviewer checks the match.' : 'No owner record could be matched automatically. Use the Property Appraiser link and the copyable ID.'));
  lookup(o, rep.links.pa, 'Owner and tax record.'); lookup(o, rep.links.deeds); lookup(o, rep.links.probate);

  // ---- 2. Permits and code violations
  const pm = rep.permits, ps = sec('rep-permits', 'Permits and code violations');
  const dl = mk('dl', 'pfws-facts'); row(dl, 'Jurisdiction', pm.jurisdiction); row(dl, 'Postal city on the roll (not city limits)', pm.postalCity); row(dl, 'Office that covers it', pm.office && pm.office.office); ps.appendChild(dl);
  if (pm.jurisdictionSource) ps.appendChild(mk('p', 'small muted', 'Jurisdiction from: ' + pm.jurisdictionSource + '.'));
  ps.appendChild(mk('p', 'small muted', pm.note));
  const failed = pm.checked && Object.entries(pm.checked).filter(([k, v]) => v === false).map(([k]) => k);
  if (failed && failed.length) ps.appendChild(mk('p', 'notice small', 'Could not check just now: ' + failed.join(', ') + '. Not shown as “none”. Try again later or use the office link.'));
  const CL = {unsafe_structure: 'Unsafe structure case', demolition: 'Demolition', code_violation: 'Violation / case'};
  const showCases = pm.cases || [];
  if (showCases.length) {
    const t = mk('table', 'pfws-tbl'), hr = t.createTHead().insertRow(); ['Case', 'Type', 'Status', 'Date'].forEach(h => hr.appendChild(mk('th', '', h))); const tb = t.createTBody();
    showCases.forEach(c => { const r = tb.insertRow(); const type = (c.class !== 'code_violation' ? CL[c.class] + ': ' : '') + c.type; [c.number, type, c.status, (c.opened ? 'Opened ' + c.opened : '') + (c.closed ? ' · closed ' + c.closed : '')].forEach(v => r.insertCell().textContent = v); });
    const w = mk('div', 'pfws-calc'); w.appendChild(t); ps.appendChild(w); ps.appendChild(PF.srcLink(showCases[0].source));
  } else if (pm.checked && (pm.checked.violations || pm.checked.codeCompliance)) ps.appendChild(mk('p', 'small', pm.coverage === 'county' ? 'No building or code cases are listed for this folio in the county’s lists (a successful check of the county records).' : 'No cases found in the county lists. They may not cover this parcel: see the office above.'));
  const pr = pm.permits || [];
  if (pr.length) {
    ps.appendChild(mk('h4', '', 'Permits (previous 2 years)'));
    const ul = mk('ul', 'pffeed'); pr.forEach(p => { const li = mk('li'); li.appendChild(mk('b', '', (p.class === 'demolition' ? 'Demolition permit issued' : 'Permit') + ' ' + p.number)); li.appendChild(mk('p', 'small', [p.type, p.appType].filter(Boolean).join(' · ')));
      if (p.detail) li.appendChild(mk('p', 'small muted', p.detail)); li.appendChild(mk('p', 'small', 'Issued ' + (p.issued || 'date not listed') + ' · ' + p.status + (p.class === 'demolition' ? '. An issued demolition permit does not confirm the building was demolished.' : '')));
      ul.appendChild(li); }); ps.appendChild(ul); ps.appendChild(PF.srcLink(pr[0].source));
  } else if (pm.checked && pm.checked.permits) ps.appendChild(mk('p', 'small', 'No permits for this folio in the county’s last-2-years list. ' + pm.permitsCoverage));
  if (pm.office) { lookup(ps, pm.office, 'Search permits, code cases and unsafe-structure cases here. Paste the parcel ID; some offices search by address.'); if (pm.office.generic) ps.appendChild(mk('p', 'small muted', 'We do not have a direct link for this city’s office. Use the city’s website, or the county page for contacts.')); }
  else { ps.appendChild(mk('p', 'small', 'We could not tell which office covers this parcel. Open the Property Appraiser record (it lists the municipality).')); }

  // ---- 3. Reported crime nearby
  const cr = rep.crime, cs = sec('rep-crime', 'Reported crime nearby');
  if (cr.status === 'incidents' && cr.counts) {
    cs.appendChild(mk('p', 'small', 'Reported incidents within ' + cr.radius + ' mile, ' + cr.from + ' to ' + cr.to + ' (' + cr.agency + '; ' + cr.coverage + ').'));
    const sel = mk('select'); sel.setAttribute('aria-label', 'Crime category'); sel.appendChild(new Option('All categories (' + cr.counts.total + ')', 'all')); Object.keys(cr.counts.byCategory).forEach(k => sel.appendChild(new Option(k + ' (' + cr.counts.byCategory[k] + ')', k)));
    const out = mk('p', 'pfws-total', String(cr.counts.total)); sel.addEventListener('change', () => { out.textContent = String(sel.value === 'all' ? cr.counts.total : cr.counts.byCategory[sel.value]); }); cs.append(sel, out);
  } else {
    cs.appendChild(mk('p', 'notice', cr.label || 'Local data unavailable'));
    cs.appendChild(mk('p', 'small', cr.coverage)); cs.appendChild(mk('p', 'small muted', cr.reason));
  }
  if (cr.link) { const p = mk('p', 'small'); const a = mk('a', 'btn small ghost', cr.link.name); a.href = cr.link.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; p.appendChild(a); if (cr.link.checked === false) p.appendChild(mk('span', 'small muted', ' Opens the agency’s own site; we could not test this link automatically.')); cs.appendChild(p); }
  if (cr.source) cs.appendChild(PF.srcLink(cr.source, 'Coverage source: ' + cr.source.name));
  if (location.hash && /^#rep-/.test(location.hash)) { const t = document.querySelector(location.hash); if (t) t.scrollIntoView(); }
};
