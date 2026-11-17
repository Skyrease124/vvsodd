// Run: node netlify/tests/envctl.test.mjs   (mocked Florida DEP Institutional Controls Registry; TEST FIXTURE data)
import assert from 'node:assert/strict';
const { default: api, RESTRICTIONS } = await import('../functions/envctl.mjs');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok -', m); };
const sq = (x0, x1, y0 = 29.7, y1 = 29.701) => [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]];
const lot = dx => sq(-82.4 + dx, -82.399 + dx);
const site = (rings, restr) => ({ attributes: { PRIMARY_SITE_NAME: 'TEST FIXTURE SITE', PRIMARY_SITE_ID: 'ERIC_1', PRIMARY_SITE_DOCUMENTS: 'https://prodenv.dep.state.fl.us/DepNexus/public/electronic-documents/ERIC_1/gis-facility!search',
  BOUNDARY_RESTRICTIONS: restr, BOUNDARY_MECHANISM_TYPES: 'Declaration of Restrictive Covenant', BOUNDARY_CONTAMINATED_MEDIA: 'Groundwater', BOUNDARY_ENGINEERING_CONTROLS: 'None', BOUNDARY_MECHANISM_EFF_DATES: '14-APR-00' }, geometry: { rings } });
let mode = 'ok', feats = [], lastBody = '';
globalThis.fetch = async (u, o) => { lastBody = String(o && o.body); if (mode === 'down') throw new Error('net'); if (mode === 'http') return { ok: false, status: 500 }; if (mode === 'err') return { ok: true, json: async () => ({ error: { code: 400 } }) }; return { ok: true, json: async () => ({ features: feats }) }; };
const call = async (body, ip = '1.1.1.1') => { const r = await api(new Request('http://x/e', { method: 'POST', body: JSON.stringify(body), headers: { 'x-nf-client-connection-ip': ip } }), {}); return { s: r.status, j: await r.json() }; };

// 1. known overlap: half the lot inside a registry area
feats = [site(sq(-82.41, -82.3995, 29.69, 29.71), 'Groundwater Use, Digging, LSSI')];
let r = await call({ rings: lot(0) }), m = r.j.matches && r.j.matches[0];
ok(r.j.ok && r.j.mode === 'boundary' && m && Math.abs(m.pct - 50) < 1.5 && m.siteName === 'TEST FIXTURE SITE' && m.docs.startsWith('https://prodenv.dep.state.fl.us/'), 'overlap: site name, % of lot and official DEP records link');
ok(m.restrictions.find(x => x.code === 'Groundwater Use').label === RESTRICTIONS['Groundwater Use'] && m.restrictions.find(x => x.code === 'LSSI').label === null, 'verified restriction gets a meaning; unverified code (LSSI) has none, so the page says "See DEP records for details"');
ok(/esriGeometryPolygon/.test(lastBody) && /rings/.test(decodeURIComponent(lastBody)), 'full parcel boundary sent to the registry');
// 2. no overlap: registry returns a polygon that only touches / sits beside the lot
feats = [site(sq(-82.398, -82.39, 29.69, 29.71), 'Land Use')];
r = await call({ rings: lot(0.001) }); ok(r.j.ok && r.j.mode === 'boundary' && r.j.matches.length === 0, 'no overlap: ok with zero matches ("No mapped DEP registry overlap found")');
feats = []; r = await call({ rings: lot(0.002) }); ok(r.j.ok && r.j.matches.length === 0, 'empty registry answer: zero matches');
// 3. coordinates only
feats = [site(sq(-82.41, -82.39, 29.69, 29.71), 'Land Use')];
r = await call({ point: [-82.4, 29.7005] }); ok(r.j.ok && r.j.mode === 'point' && r.j.matches.length === 1 && r.j.matches[0].pct === null && /esriGeometryPoint/.test(lastBody), 'pin only: point mode (page labels it "Map pin check only")');
ok((await call({ point: [10, 10] })).s === 400, 'pin outside Florida refused');
// 4. API failure
for (const [i, md] of ['down', 'http', 'err'].entries()) { mode = md; r = await call({ rings: lot(0.01 + i * 0.001) }); ok(r.j.ok === false && r.j.reason === 'lookup', 'registry failure (' + md + ') -> ok:false/lookup ("Registry check unavailable")'); }
mode = 'ok'; feats = [site(sq(-82.41, -82.39, 29.69, 29.71), 'Land Use')];
feats[0].attributes.PRIMARY_SITE_DOCUMENTS = 'https://evil.example/x'; r = await call({ rings: lot(-0.005) }); ok(r.j.matches[0].docs === '', 'non-DEP document links are dropped');
ok((await api(new Request('http://x/e'), {})).status === 405, 'GET refused');
console.log('\n' + pass + ' checks passed');
