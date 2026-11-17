// Builds kinvest-liens/liens/states/env-flags.js: listed Florida parcels whose verified outline overlaps a
// Florida DEP Institutional Controls Registry (ICR) mapped area. Used by PricePocket AI (netlify/functions/screen.mjs).
// Run: NODE_USE_ENV_PROXY=1 node tools/envctl/build.mjs
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { ICR, analyze, analyzeState } from '../../netlify/functions/envctl.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), DIR = path.join(ROOT, 'kinvest-liens/liens/states/parcels');
const bb = pts => [Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))];
const icr = [];
for (let off = 0; ; off += 1000) {
  const r = await fetch(ICR, { method: 'POST', body: new URLSearchParams({ f: 'json', where: '1=1', outFields: 'OBJECTID', returnGeometry: 'true', outSR: '4326', geometryPrecision: '6', resultOffset: off, resultRecordCount: 1000 }) });
  const d = await r.json(); if (!Array.isArray(d.features)) throw new Error('ICR download failed');
  d.features.forEach(f => f.geometry && icr.push(bb(f.geometry.rings.flat()))); if (d.features.length < 1000) break;
}
if (icr.length < 1000) throw new Error('ICR looks incomplete: ' + icr.length);
const name = f => ({ 'miami-dade': 'Miami-Dade', 'palm-beach': 'Palm Beach', 'santa-rosa': 'Santa Rosa' })[f.replace('.json', '')] || f.replace('.json', '').replace(/^./, c => c.toUpperCase());
const out = {}; let checked = 0;
for (const f of fs.readdirSync(DIR).sort()) {
  if (!f.endsWith('.json') || /^(al|az|co)-|^ar\.json$/.test(f)) continue;
  const p = JSON.parse(fs.readFileSync(path.join(DIR, f))).p || {};
  for (const [k, v] of Object.entries(p)) {
    if (v.st !== 'matched' || !v.g) continue; checked++;
    const b = bb(v.g.flat()); if (!icr.some(q => b[0] < q[2] && b[2] > q[0] && b[1] < q[3] && b[3] > q[1])) continue;
    const r = await analyze(v.g);
    if (r.matches.length) out[name(f) + '|' + k] = r.matches.map(m => ({ site: m.siteName, id: m.siteId, pct: m.pct, r: m.restrictions.map(x => x.code) }));
  }
}
// Other states PricePocket AI covers (county lists with verified outlines): official state maps + EPA.
const OTHER = { 'co-larimer.json': ['CO', 'Larimer'], 'co-boulder.json': ['CO', 'Boulder'], 'co-elpaso.json': ['CO', 'El Paso'], 'co-saguache.json': ['CO', 'Saguache'], 'az-pinal.json': ['AZ', 'Pinal'], 'az-coconino.json': ['AZ', 'Coconino'] };
for (const [f, [st, county]] of Object.entries(OTHER)) {
  if (!fs.existsSync(path.join(DIR, f))) continue; const p = JSON.parse(fs.readFileSync(path.join(DIR, f))).p || {};
  for (const [k, v] of Object.entries(p)) { if (v.st !== 'matched' || !v.g) continue; let r; try { r = await analyzeState(st, v.g); } catch (e) { if (e.message === 'bad parcel') continue; throw e; } checked++; if (r.matches.length) out[county + '|' + k] = r.matches.map(m => ({ site: m.siteName, id: m.siteId, pct: m.pct, r: m.restrictions.map(x => x.code), agency: m.agency })); }
}
const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(ROOT, 'kinvest-liens/liens/states/env-flags.js'),
  '// Listed Florida parcels whose verified outline overlaps an official environmental restriction map: Florida DEP Institutional Controls Registry; Colorado CDPHE institutional controls (2023 snapshot) and EPA Superfund controls; Arizona: EPA only (checked ' + today + ', ' + checked + ' outlines, ' + icr.length + ' registry areas).\n' +
  '// pct = share of the lot inside the area; r = restriction types as published by DEP. Built by tools/envctl/build.mjs. Parcels not listed had no overlap.\n' +
  'const ENV_FLAGS = ' + JSON.stringify(out) + ';\nconst ENV_FLAGS_CHECKED = ' + JSON.stringify(today) + ';\n');
console.log('checked', checked, 'overlaps', Object.keys(out).length, Object.keys(out));
