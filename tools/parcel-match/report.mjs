// Summary of parcel matching across the map datasets. Pure: the caller supplies the datasets, the audits on disk and
// sourcesFor, so the report makes no requests and writes nothing. Used by run.mjs --report.
//
//   buildReport({datasets: [{id, state, county, records}], audits: Map(id -> audit), sourcesFor}) -> rows
//   reportText(rows) -> a plain-text table
export function buildReport({datasets, audits, sourcesFor}) {
  const key = d => d.state + '|' + d.county + '|' + d.id;
  return datasets.slice().sort((a, b) => key(a).localeCompare(key(b))).map(d => {
    const sources = sourcesFor(d.state, d.county).map(s => s.id);
    const audit = audits.get(d.id) || null;
    const status = !sources.length ? 'no source configured' : audit ? 'audited' : 'not run';
    return {
      id: d.id, state: d.state, county: d.county, records: d.records, sources, status,
      matched: audit ? audit.summary.matched : null,
      matchedWithBoundary: audit ? audit.summary.matchedWithBoundary : null,
      pending: audit ? audit.summary.pending : null,
      reasons: audit ? audit.summary.byReason : null,
    };
  });
}

export function reportText(rows) {
  const lines = ['dataset | state | county | records | source | status | matched | with boundary | pending'];
  for (const r of rows) {
    lines.push([r.id, r.state, r.county, r.records, r.sources.join(' + ') || 'none', r.status,
      r.matched ?? '-', r.matchedWithBoundary ?? '-', r.pending ?? '-'].join(' | '));
  }
  const audited = rows.filter(r => r.status === 'audited');
  lines.push('');
  lines.push(rows.length + ' datasets; ' + rows.filter(r => r.sources.length).length + ' with an official source; ' +
    audited.length + ' audited (' + audited.reduce((n, r) => n + r.matched, 0) + ' records matched, ' +
    audited.reduce((n, r) => n + r.pending, 0) + ' pending).');
  return lines.join('\n');
}
