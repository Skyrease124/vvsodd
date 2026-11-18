// Delinquent tax records (NOT a sale list). Parcel rows live in netlify/private/delinquent and are served to Pro members only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DATASETS = { 'virginia-beach': { name: 'Virginia Beach, VA', file: 'virginia-beach.json' } };
const cache = {};
function dir(sub) {
  const root = process.env.LAMBDA_TASK_ROOT || process.cwd();
  const c = sub === 'private' ? ['netlify/private/delinquent'] : ['kinvest-liens/liens/delinquent'];
  for (const d of [path.join(root, c[0]), path.join(HERE, '../../' + c[0]), path.join(process.cwd(), c[0])]) if (fs.existsSync(d)) return d;
  return null;
}
export function loadParcels(id) {
  const ds = DATASETS[id]; if (!ds) return null; if (cache[id]) return cache[id];
  const d = dir('private'); if (!d) return null; try { cache[id] = JSON.parse(fs.readFileSync(path.join(d, ds.file), 'utf8')); } catch (e) { return null; } return cache[id];
}
export function loadSummary(id) { const d = dir('public'); if (!d || !DATASETS[id]) return null; try { return JSON.parse(fs.readFileSync(path.join(d, id + '-summary.json'), 'utf8')); } catch (e) { return null; } }
const clamp = (v, lo, hi, dflt) => { if (v === null || v === undefined || v === '') return dflt; const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt; };
// opts: q, minOwed, maxOwed, minYears, oldest (earliest delinquent tax year at or before), noAddress, district, sort, limit, offset
export function search(parcels, o) {
  const q = String(o.q || '').toLowerCase().replace(/\s+/g, ' ').trim(), digits = q.replace(/\D/g, '');
  const minOwed = clamp(o.minOwed, 0, 1e9, 0), maxOwed = clamp(o.maxOwed, 0, 1e9, 1e9), minYears = clamp(o.minYears, 0, 99, 0), oldest = /^\d{4}$/.test(o.oldest || '') ? o.oldest : null;
  let rows = parcels.filter(p => p.t >= minOwed && p.t <= maxOwed && p.ys.length >= minYears && (!oldest || p.ys[0] <= oldest) && (!o.noAddress || !p.a) && (!o.district || p.z === o.district) &&
    (!q || p.a.toLowerCase().includes(q) || p.d.toLowerCase().includes(q) || (digits.length >= 4 && p.g.includes(digits))));
  const sorts = { owedDesc: (a, b) => b.t - a.t, owedAsc: (a, b) => a.t - b.t, oldest: (a, b) => a.ys[0].localeCompare(b.ys[0]) || b.t - a.t, years: (a, b) => b.ys.length - a.ys.length || b.t - a.t };
  rows.sort(sorts[o.sort] || sorts.owedDesc);
  const limit = clamp(o.limit, 1, 50, 25), offset = clamp(o.offset, 0, 1e6, 0);
  return { total: rows.length, rows: rows.slice(offset, offset + limit), districts: null };
}
export const publicRow = p => ({ gpin: p.g, address: p.a || null, description: p.d, district: p.z, owed: p.t, tax: p.x, penalty: p.p, interest: p.i, fees: p.f, taxYears: p.ys, oldest: p.ys[0], newest: p.ys[p.ys.length - 1], installments: p.n, totalsDiffer: p.m > 0 });
