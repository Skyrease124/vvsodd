// Builds the Virginia Beach "delinquent real estate taxes" dataset from a CSV export.
//   node tools/delinquent/build.mjs <file.csv> [--asof YYYY-MM-DD] [--received YYYY-MM-DD]
// PRIVACY: owner names and mailing addresses are NEVER read into the output. Only parcel id, street address of the property,
// legal description, district and money/years are kept. The CSV itself is not stored in the repository.
// Output: netlify/private/delinquent/virginia-beach.json (parcel rows, served to members only by netlify/functions/delinquent.mjs)
//         kinvest-liens/liens/delinquent/virginia-beach-summary.json (aggregates only, public)
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';

export function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false; text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cur); cur = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = []; } else cur += c; }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); } return rows;
}
const num = v => { const n = Number(String(v || '').replace(/[$,\s]/g, '')); return Number.isFinite(n) ? n : 0; };
const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
const r2 = n => Math.round(n * 100) / 100;
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };

export function build(csvText, meta = {}) {
  const [head, ...rows] = parseCsv(csvText); const ix = Object.fromEntries(head.map((h, i) => [h.trim(), i]));
  for (const k of ['GPIN', 'Tax_Year', 'Total_Delinquent_Amount_Due', 'Tax_Due']) if (!(k in ix)) throw new Error('missing column ' + k);
  const P = new Map(); let spaced = 0, mismatch = 0;
  for (const r of rows) {
    if (r.length < head.length - 1) continue;
    const raw = r[ix.GPIN] || '', g = raw.replace(/\s+/g, ''); if (!g) continue; if (raw !== raw.trim() || /\s/.test(raw.trim())) spaced++;
    let p = P.get(g); if (!p) P.set(g, p = { g, a: '', d: '', z: '', t: 0, x: 0, p: 0, i: 0, f: 0, ys: new Set(), n: 0, m: 0 });
    const tax = num(r[ix.Tax_Due]), pen = num(r[ix.Penalty_Due]), int = num(r[ix.Interest_Due]), fee = num(r[ix.Fee_Due]), tot = num(r[ix.Total_Delinquent_Amount_Due]);
    p.t += tot; p.x += tax; p.p += pen; p.i += int; p.f += fee; p.n++; p.ys.add(clean(r[ix.Tax_Year]));
    if (Math.abs(tax + pen + int + fee - tot) > 0.02) { p.m++; mismatch++; }
    if (!p.a && ix.Situs_Address != null) p.a = clean(r[ix.Situs_Address]); if (!p.d && ix.Property_Description != null) p.d = clean(r[ix.Property_Description]); if (!p.z && ix.District != null) p.z = clean(r[ix.District]);
  }
  const parcels = [...P.values()].map(p => { const ys = [...p.ys].filter(Boolean).sort(); return { g: p.g, a: p.a, d: p.d, z: p.z, t: r2(p.t), x: r2(p.x), p: r2(p.p), i: r2(p.i), f: r2(p.f), ys, n: p.n, m: p.m }; }).sort((a, b) => b.t - a.t);
  const sum = k => r2(parcels.reduce((s, p) => s + p[k], 0)), tot = parcels.map(p => p.t);
  const bucket = (defs, val) => defs.map(([label, lo, hi]) => { const m = parcels.filter(p => { const v = val(p); return v >= lo && v < hi; }); return { label, parcels: m.length, owed: r2(m.reduce((s, p) => s + p.t, 0)) }; });
  const byYear = {}; parcels.forEach(p => p.ys.forEach(y => { byYear[y] = (byYear[y] || 0) + 1; }));
  const noAddr = parcels.filter(p => !p.a);
  const summary = {
    dataset: 'Virginia Beach, VA: delinquent real estate taxes', kind: 'delinquent-tax-records', notASaleList: true,
    source: meta.source || 'City of Virginia Beach delinquent real estate tax export, provided to PricePocketAsset by its owner. The official city page was not confirmed from our server.',
    received: meta.received || null, asOf: meta.asOf || null, asOfNote: meta.asOf ? null : 'The file does not say what date it was exported. Tax years run through ' + (Object.keys(byYear).sort().pop() || '?') + '.',
    parcels: parcels.length, rowsRead: rows.length, owed: sum('t'), tax: sum('x'), penalty: sum('p'), interest: sum('i'), fees: sum('f'), medianOwed: r2(median(tot)), maxOwed: Math.max(0, ...tot),
    ownedBuckets: bucket([['Under $500', 0, 500], ['$500 to $999', 500, 1000], ['$1,000 to $2,499', 1000, 2500], ['$2,500 to $4,999', 2500, 5000], ['$5,000 to $9,999', 5000, 10000], ['$10,000 to $24,999', 10000, 25000], ['$25,000 and up', 25000, 1e12]], p => p.t),
    yearsBehind: bucket([['1 year', 1, 2], ['2 years', 2, 3], ['3 years', 3, 4], ['4 to 5 years', 4, 6], ['6 or more years', 6, 99]], p => p.ys.length),
    byTaxYear: Object.fromEntries(Object.entries(byYear).sort()), oldestYear: Object.keys(byYear).sort()[0] || null,
    noStreetAddress: { parcels: noAddr.length, medianOwed: r2(median(noAddr.map(p => p.t))) },
    oldParcels: { since2020: parcels.filter(p => p.ys[0] <= '2020').length },
    quality: [rows.length + ' rows are single bill installments; each parcel total is the sum of its rows.', mismatch + ' rows have tax + penalty + interest + fees different from the city’s stated total (for example after a partial payment). The stated total is used.', spaced + ' parcel ids had stray spaces and were cleaned.', 'Owner names and mailing addresses in the file are not used or stored.'],
    notes: ['This is a list of overdue tax, not a list of properties for sale. Nothing here says a parcel is available, will be sold, or can be bought.', 'Balances grow with penalty and interest and change when owners pay. Confirm any figure with the Virginia Beach Treasurer.', 'Educational only. Not legal, tax or investment advice.']
  };
  return { parcels, summary };
}
if (import.meta.url === 'file://' + process.argv[1]) {
  const f = process.argv[2]; if (!f) { console.error('usage: node tools/delinquent/build.mjs <file.csv> [--asof D] [--received D]'); process.exit(1); }
  const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
  const { parcels, summary } = build(fs.readFileSync(f, 'utf8'), { asOf: arg('--asof'), received: arg('--received') });
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
  fs.writeFileSync(path.join(root, 'netlify/private/delinquent/virginia-beach.json'), JSON.stringify({ dataset: summary.dataset, built: new Date().toISOString().slice(0, 10), p: parcels }));
  fs.writeFileSync(path.join(root, 'kinvest-liens/liens/delinquent/virginia-beach-summary.json'), JSON.stringify(summary, null, 1));
  console.log('parcels', parcels.length, 'owed', summary.owed, 'sha256', crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16));
}
