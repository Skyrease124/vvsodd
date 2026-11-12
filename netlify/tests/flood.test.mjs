// Run: node netlify/tests/flood.test.mjs   (mocked FEMA NFHL service)
import assert from 'node:assert/strict';
const { default: api, riskOf } = await import('../functions/flood.mjs');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok -', m); };
const lot = (dx = 0) => [[[-82.4 + dx, 29.7], [-82.399 + dx, 29.7], [-82.399 + dx, 29.701], [-82.4 + dx, 29.701], [-82.4 + dx, 29.7]]];
const box = (x0, x1, dx = 0) => [[[x0 + dx, 29.69], [x0 + dx, 29.71], [x1 + dx, 29.71], [x1 + dx, 29.69], [x0 + dx, 29.69]]];
const AE = dx => ({ attributes: { FLD_ZONE: 'AE', ZONE_SUBTY: 'FLOODWAY', SFHA_TF: 'T', STATIC_BFE: 8, DEPTH: -9999 }, geometry: { rings: box(-82.41, -82.3995, dx) } });
const X = dx => ({ attributes: { FLD_ZONE: 'X', ZONE_SUBTY: 'AREA OF MINIMAL FLOOD HAZARD', SFHA_TF: 'F', STATIC_BFE: -9999, DEPTH: -9999 }, geometry: { rings: box(-82.3995, -82.39, dx) } });
let mode = 'ok', dx0 = 0; globalThis.fetch = async u => { u = String(u); if (mode === 'down') throw new Error('net'); if (mode === 'http') return { ok: false, status: 500 };
  if (/MapServer\/3\//.test(u)) return { ok: true, json: async () => ({ features: [{ attributes: { EFF_DATE: Date.UTC(2018, 10, 2), FIRM_PAN: '1' } }] }) };
  if (mode === 'trunc') return { ok: true, json: async () => ({ features: [AE(dx0)], exceededTransferLimit: true }) };
  const f = mode === 'ok' ? [AE(dx0), X(dx0)] : mode === 'gap' ? [AE(dx0)] : mode === 'none' ? [] : [{ ...X(dx0), geometry: { rings: box(-82.41, -82.39, dx0) } }];   // x: one X polygon over the whole lot. gap: only the west part of the lot is mapped
  return { ok: true, json: async () => ({ features: f }) }; };
let n = 0; const call = async (dx = 0, ip) => { dx0 = dx; const r = await api(new Request('http://x/f', { method: 'POST', body: JSON.stringify({ rings: lot(dx) }), headers: { 'x-nf-client-connection-ip': ip || '1.1.1.1' } }), {}); return { s: r.status, j: await r.json() }; };
let r = await call(0); const ae = r.j.zones.find(z => z.zone === 'AE'), x = r.j.zones.find(z => z.zone === 'X');
ok(r.j.ok && ae && x && Math.abs(ae.pct - 50) < 1.5 && Math.abs(x.pct - 50) < 1.5 && ae.sfha && ae.bfe === 8 && x.bfe === null && Math.abs(r.j.sfhaPct - ae.pct) < 0.01, 'lot split between Zone AE (high risk, BFE 8) and Zone X reports about 50/50 (' + ae.pct + '/' + x.pct + ')');
ok(r.j.panelEff === '2018-11-02' && r.j.geom.length === 1 && r.j.geom[0].risk === 'high', 'panel effective date returned; only the high-risk part is drawn on the map');
mode = 'x'; r = await call(0.01); ok(r.j.ok && r.j.zones.length === 1 && r.j.zones[0].risk === 'minimal' && r.j.sfhaPct === 0 && r.j.geom.length === 0 && r.j.zones[0].pct > 99, 'lot entirely in minimal-hazard Zone X: no SFHA, nothing to shade');
mode = 'gap'; r = await call(0.02); ok(r.j.ok === false && r.j.reason === 'coverage', 'FEMA zones covering only part of the lot is "unavailable" (coverage), not a guess');
mode = 'none'; r = await call(0.03); ok(r.j.ok === false && r.j.reason === 'coverage', 'no FEMA polygons at all is "unavailable" (coverage)');
for (const [i, m] of ['down', 'http', 'trunc'].entries()) { mode = m; r = await call(0.04 + i * 0.005); ok(r.j.ok === false && r.j.reason === 'lookup', 'failed lookup (' + m + ') is ok:false/lookup'); }
ok(riskOf({ FLD_ZONE: 'VE', SFHA_TF: 'T' }) === 'high' && riskOf({ FLD_ZONE: 'X', ZONE_SUBTY: '0.2 PCT ANNUAL CHANCE FLOOD HAZARD' }) === 'moderate' && riskOf({ FLD_ZONE: 'D' }) === 'undetermined' && riskOf({ FLD_ZONE: 'X', ZONE_SUBTY: 'AREA OF MINIMAL FLOOD HAZARD' }) === 'minimal', 'zone risk classes');
mode = 'ok'; ok((await call(0.0, '3.3.3.3')).j.ok && (await api(new Request('http://x/f'), {})).status === 405, 'GET refused, POST works');
console.log('\n' + pass + ' checks passed');
