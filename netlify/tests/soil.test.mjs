// Run: node netlify/tests/soil.test.mjs   (mocked USDA Soil Data Access)
import assert from 'node:assert/strict';
const { default: api } = await import('../functions/soil.mjs');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok -', m); };
const lot = dx => [[[-82.4 + dx, 29.7], [-82.399 + dx, 29.7], [-82.399 + dx, 29.701], [-82.4 + dx, 29.701], [-82.4 + dx, 29.7]]];
let mode = 'ok', queries = [];
globalThis.fetch = async (u, o) => { const q = JSON.parse(o.body).query; queries.push(q); if (mode === 'down') throw new Error('net'); if (mode === 'http') return { ok: false, status: 400 };
  if (/STIntersection/.test(q)) return { ok: true, json: async () => mode === 'empty' ? {} : { Table: [['mukey', 'a', 'aoi'], ['111', '7.5E-07', '1E-06'], ['222', '2.5E-07', '1E-06']] } };
  return { ok: true, json: async () => ({ Table: [['mukey', 'musym', 'muname', 'mukind', 'drclassdcd', 'hydgrpdcd', 'hydclprs', 'flodfreqdcd', 'pondfreqprs', 'wtdepannmin', 'brockdepmin', 'engstafdcd', 'engdwobdcd'],
    ['111', 'MA', 'Myakka fine sand', 'Consociation', 'Poorly drained', 'A/D', '5', 'None', '0', '30', null, 'Very limited', 'Very limited'], ['222', 'UL', 'Urban land', 'Consociation', null, null, '6', null, null, null, null, 'Not rated', null]] }) }; };
const call = async (dx, ip = '1.1.1.1') => { const r = await api(new Request('http://x/f', { method: 'POST', body: JSON.stringify({ rings: lot(dx) }), headers: { 'x-nf-client-connection-ip': ip } }), {}); return { s: r.status, j: await r.json() }; };
let r = await call(0); const u = r.j.units;
ok(r.j.ok && u.length === 2 && u[0].musym === 'MA' && u[0].pct === 75 && u[1].pct === 25 && r.j.coveredPct === 100, 'two map units: shares 75% / 25% of the lot, sorted largest first');
ok(u[0].drainage === 'Poorly drained' && u[0].hydgrp === 'A/D' && u[0].wtFt === 1 && u[0].septic === 'Very limited' && u[1].drainage === '' && u[1].wtFt === null, 'soil facts carried through (water table 30 cm = 1 ft); missing facts stay blank, never invented');
ok(Math.abs(u[0].acres + u[1].acres - r.j.parcelAcres) < 0.01 && /MULTIPOLYGON/.test(queries[0]) && /SDA_Get_Mupolygonkey_from_intersection_with_WktWgs84/.test(queries[0]), 'acres add up to the lot; query intersects the real outline');
mode = 'empty'; r = await call(0.01); ok(r.j.ok === false && r.j.reason === 'coverage', 'no mapped soil is "unavailable" (coverage), not a guess');
for (const [i, m] of ['down', 'http'].entries()) { mode = m; r = await call(0.02 + i * 0.005); ok(r.j.ok === false && r.j.reason === 'lookup', 'failed lookup (' + m + ') is ok:false/lookup'); }
mode = 'ok'; ok((await call(5)).s === 400, 'outlines outside Florida are refused');
const n = queries.length; await call(0); ok(queries.length === n, 'repeat checks are cached');
console.log('\n' + pass + ' checks passed');
