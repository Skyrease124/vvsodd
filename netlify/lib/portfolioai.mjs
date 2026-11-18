// Portfolio questions for the AI: answered by code from the signed-in member's OWN portfolio only (passed in by the caller).
// No model writes numbers here. Every figure comes from what the member entered; estimates are labeled as estimates.
const DAY = 864e5;
const money = n => '$' + Math.round(n).toLocaleString('en-US');
const iso = ms => new Date(ms).toISOString().slice(0, 10);
const parse = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null; };
const addMonths = (ms, n) => { const d = new Date(ms); d.setUTCMonth(d.getUTCMonth() + Math.round(n)); return d.getTime(); };
const open = h => (h.status || 'open') === 'open';
const label = h => (h.county ? h.county + ', ' : '') + h.state + (h.parcel ? ' ' + h.parcel : '');

export function wantsPortfolio(q) {
  const t = String(q || '').toLowerCase();
  return /\b(my|mine|i have|have i|i own|i hold|i invested|i've|ive)\b/.test(t) && /(portfolio|certificates?|liens?|propert|invest|holdings?|deadlines?|return|research)/.test(t);
}
const STATE = { FL: 'florida', AZ: 'arizona', CO: 'colorado', IA: 'iowa', TX: 'texas', MI: 'michigan', NJ: 'new jersey', IL: 'illinois', AL: 'alabama', GA: 'georgia', CA: 'california', NY: 'new york', OH: 'ohio' };
const stateIn = q => { const t = q.toLowerCase(); for (const [a, n] of Object.entries(STATE)) if (t.includes(n) || new RegExp('\\b' + a.toLowerCase() + '\\b').test(t) && a.length === 2 && !['IN','OR','ME','OK','HI'].includes(a)) return a; return null; };

export function answer(q, portfolio, todayIso) {
  const items = Array.isArray(portfolio) ? portfolio : [];
  const today = parse(todayIso || iso(Date.now()));
  const t = String(q).toLowerCase(), st = stateIn(t);
  const src = 'Your own portfolio entries (you typed them); nothing here was checked against a county record.';
  if (!items.length) return { text: 'Your portfolio is empty. Add a lien on the Portfolio page and I can answer questions about it.', rows: [], source: src };
  const scope = st ? items.filter(h => h.state === st) : items;
  if (/deadline|redemption|expire|upcoming|due|soon|approach/.test(t)) {
    const rows = scope.filter(open).map(h => {
      const cd = parse(h.countyDeadline), est = parse(h.bought) != null && h.months > 0 ? addMonths(parse(h.bought), h.months) : null;
      const when = cd != null ? cd : est; if (when == null) return null;
      return { id: h.id, item: label(h), date: iso(when), days: Math.round((when - today) / DAY), basis: cd != null ? 'deadline you entered' : 'estimate: purchase date plus your redemption months' };
    }).filter(Boolean).sort((a, b) => a.days - b.days);
    const soon = rows.filter(r => r.days <= 180);
    const noDate = scope.filter(open).length - rows.length;
    const lines = soon.slice(0, 10).map(r => `- ${r.item}: ${r.date} (${r.days < 0 ? Math.abs(r.days) + ' days past' : r.days + ' days'}; ${r.basis})`);
    return { text: (soon.length ? `${soon.length} open item(s) have a date within 6 months or already past:\n` + lines.join('\n') : 'None of your open items has a date within the next 6 months.') + (noDate ? `\n${noDate} open item(s) have no deadline or redemption months entered, so they are not counted.` : '') + '\nVerify: confirm every deadline with the county; dates here are only what you entered.', rows: soon, source: src };
  }
  if (/how much|invested|total|spent|paid|capital/.test(t)) {
    const by = {}; for (const h of scope) { const k = h.state + (/county|each|by/.test(t) && h.county ? ' / ' + h.county : ''); by[k] = by[k] || { n: 0, paid: 0, extra: 0 }; by[k].n++; by[k].paid += h.paid || 0; by[k].extra += h.extra || 0; }
    const rows = Object.entries(by).map(([k, v]) => ({ group: k, count: v.n, paid: v.paid, extra: v.extra, total: v.paid + v.extra })).sort((a, b) => b.total - a.total);
    const tot = rows.reduce((s, r) => s + r.total, 0);
    return { text: `${st ? 'In ' + st : 'Across your portfolio'} you entered ${money(tot)} (purchase prices plus later taxes and fees you listed) over ${scope.length} item(s).\n` + rows.slice(0, 10).map(r => `- ${r.group}: ${money(r.total)} (${r.count} item${r.count > 1 ? 's' : ''})`).join('\n') + '\nVerify: totals are only as accurate as your entries.', rows, source: src };
  }
  if (/return|interest|earn|profit|yield/.test(t)) {
    const g = {}; for (const h of scope.filter(open)) { if (!(h.rate >= 0) || !(h.months > 0)) continue; const k = (h.county || h.state) + ' ' + h.state; g[k] = g[k] || { paid: 0, est: 0, n: 0 }; g[k].paid += h.paid; g[k].est += h.paid * h.rate / 100 * h.months / 12; g[k].n++; }
    const rows = Object.entries(g).map(([k, v]) => ({ group: k.trim(), count: v.n, paid: v.paid, estInterest: v.est })).sort((a, b) => b.estInterest - a.estInterest);
    return { text: rows.length ? 'Estimated interest if each open item were redeemed after the full months you entered (simple interest on your rate; excludes fees, penalties and the county’s own rounding rules):\n' + rows.slice(0, 10).map(r => `- ${r.group}: about ${money(r.estInterest)} on ${money(r.paid)} (${r.count})`).join('\n') + '\nThis is an estimate, not a prediction. Many liens are redeemed sooner and some never are. Verify with the county.' : 'No open item has both a rate and redemption months, so I cannot estimate interest.', rows, source: src };
  }
  if (/research|missing|incomplete|need|todo|to do/.test(t)) {
    const rows = scope.filter(open).map(h => { const miss = []; if (!h.parcel) miss.push('parcel number'); if (!h.county) miss.push('county'); if (!(h.rate >= 0)) miss.push('rate'); if (!(h.months > 0)) miss.push('redemption months'); if (!h.countyDeadline) miss.push('county deadline'); if (!h.notes) miss.push('notes'); return { id: h.id, item: label(h), missing: miss }; }).filter(r => r.missing.length);
    return { text: rows.length ? `${rows.length} open item(s) are missing details:\n` + rows.slice(0, 10).map(r => `- ${r.item}: ${r.missing.join(', ')}`).join('\n') : 'Every open item has the main details filled in.', rows, source: src };
  }
  const o = scope.filter(open), n = scope.length;
  return { text: `You have ${n} item(s)${st ? ' in ' + st : ''}, ${o.length} open. Ask about deadlines, how much you invested, estimated interest by county, or which items need more research.`, rows: [], source: src };
}
