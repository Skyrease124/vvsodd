// Run: node netlify/tests/wetlands.test.mjs   (mocked National Wetlands Inventory service)
import assert from 'node:assert/strict';
const { default: api } = await import('../functions/wetlands.mjs');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok -', m); };
// lot = 0.001 x 0.001 degrees near Gainesville; wetland covers its west half (esri ring, clockwise)
const lot = [[[-82.4, 29.7], [-82.399, 29.7], [-82.399, 29.701], [-82.4, 29.701], [-82.4, 29.7]]];
const west = { attributes: { WETLAND_TYPE: 'Freshwater Pond' }, geometry: { rings: [[[-82.41, 29.69], [-82.41, 29.71], [-82.3995, 29.71], [-82.3995, 29.69], [-82.41, 29.69]]] } };
let mode = 'ok', calls = []; globalThis.fetch = async u => { u = String(u); calls.push(u); if (mode === 'down') throw new Error('net');
  const layer = /Wetlands_Status/.test(u) ? 'status' : 'wet';
  if (mode === 'http') return { ok: false, status: 500 };
  if (layer === 'status') return { ok: true, json: async () => ({ features: mode === 'nocov' ? [] : [{ attributes: { STATUS: 'Digital' } }] }) };
  if (mode === 'trunc') return { ok: true, json: async () => ({ features: [west], exceededTransferLimit: true }) };
  return { ok: true, json: async () => ({ features: mode === 'none' ? [] : mode === 'far' ? [{ attributes: { WETLAND_TYPE: 'X' }, geometry: { rings: [[[-82.5, 29.5], [-82.5, 29.51], [-82.49, 29.51], [-82.49, 29.5], [-82.5, 29.5]]] } }] : [west] }) }; };
let n = 0; const call = async (rings = lot, ip) => { const r = await api(new Request('http://x/f', { method: 'POST', body: JSON.stringify({ rings: rings.map(r => r.map(p => [p[0] - (n++ ? 0 : 0), p[1]])) }), headers: { 'x-nf-client-connection-ip': ip || '1.1.1.1' } }), {}); return { s: r.status, j: await r.json() }; };
let r = await call(); ok(r.j.ok && r.j.covered && Math.abs(r.j.pct - 50) < 1.5 && r.j.overlapAcres > 0 && r.j.types[0].type === 'Freshwater Pond' && r.j.geom.length === 1, 'half-covered lot reports about 50% overlap, its wetland type and a map geometry (' + r.j.pct + '%, ' + r.j.overlapAcres + ' ac of ' + r.j.parcelAcres + ')');
ok(Math.abs(r.j.parcelAcres - 0.001 * 0.001 * 111320 * Math.cos(29.7 * Math.PI / 180) * 110574 / 4046.86) < 0.001, 'lot acreage matches an independent calculation');
const lot2 = lot.map(x => x.map(p => [p[0] - 0.01, p[1]])); mode = 'none'; r = await call(lot2); ok(r.j.ok && r.j.overlapAcres === 0 && r.j.none === true && r.j.geom.length === 0, 'covered lot with no wetland polygons: overlap 0 / none:true ("No mapped overlap")');
const lot3 = lot.map(x => x.map(p => [p[0] - 0.02, p[1]])); mode = 'far'; r = await call(lot3); ok(r.j.ok && r.j.none === true, 'a wetland polygon in the search window that does not touch the lot is no overlap');
const lot4 = lot.map(x => x.map(p => [p[0] - 0.03, p[1]])); mode = 'nocov'; r = await call(lot4); ok(r.j.ok === false && r.j.reason === 'coverage', 'no digital coverage is ok:false/coverage, never "no overlap"');
for (const [i, m] of ['down', 'http', 'trunc'].entries()) { mode = m; r = await call(lot.map(x => x.map(p => [p[0] - 0.04 - i * 0.005, p[1]]))); ok(r.j.ok === false && r.j.reason === 'lookup', 'failed lookup (' + m + ') is ok:false/lookup, never "no overlap"'); }
mode = 'ok'; ok((await call([[[-90, 29], [-89.9, 29], [-89.9, 29.1], [-90, 29]]])).s === 400, 'outlines outside Florida are refused');
ok((await call([[[-82.4, 29.7], [-82.0, 29.7], [-82.0, 30], [-82.4, 29.7]]])).s === 400, 'an oversized outline is refused');
const rq = await api(new Request('http://x/f'), {}); ok(rq.status === 405, 'GET is refused');
// multi-part parcel (separate rings) is the union of the parts, not "outer minus holes"
const parts = [[[-82.3, 29.7], [-82.299, 29.7], [-82.299, 29.701], [-82.3, 29.701], [-82.3, 29.7]], [[-82.298, 29.7], [-82.297, 29.7], [-82.297, 29.701], [-82.298, 29.701], [-82.298, 29.7]]]; mode = 'none'; r = await call(parts); ok(r.j.ok && r.j.parcelAcres > 0.4, 'a parcel drawn as separate parts keeps the area of every part (' + r.j.parcelAcres + ' ac)');
mode = 'ok'; const before = calls.length; await call(lot, '2.2.2.2'); await call(lot, '2.2.2.2'); ok(calls.length === before, 'repeat checks of the same outline are cached');
console.log('\n' + pass + ' checks passed');
