// Run: node netlify/tests/envctl.test.mjs   (mocked Florida DEP Institutional Controls Registry; TEST FIXTURE data)
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
process.env.USERS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-'));
const __auth = await import('../lib/auth.mjs'); await __auth.createUser('free@example.com', 'password123', false); { const u = await __auth.createUser('pro@example.com', 'password123', false); u.paidThrough = '2099-01-01'; await __auth.saveUser(u); }
const PRO = (await __auth.sessionCookie('pro@example.com')).split(';')[0], FREE = (await __auth.sessionCookie('free@example.com')).split(';')[0];
const { default: api, RESTRICTIONS } = await import('../functions/envctl.mjs');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok -', m); };
const sq = (x0, x1, y0 = 29.7, y1 = 29.701) => [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]];
const lot = dx => sq(-82.4 + dx, -82.399 + dx);
const site = (rings, restr) => ({ attributes: { PRIMARY_SITE_NAME: 'TEST FIXTURE SITE', PRIMARY_SITE_ID: 'ERIC_1', PRIMARY_SITE_DOCUMENTS: 'https://prodenv.dep.state.fl.us/DepNexus/public/electronic-documents/ERIC_1/gis-facility!search',
  BOUNDARY_RESTRICTIONS: restr, BOUNDARY_MECHANISM_TYPES: 'Declaration of Restrictive Covenant', BOUNDARY_CONTAMINATED_MEDIA: 'Groundwater', BOUNDARY_ENGINEERING_CONTROLS: 'None', BOUNDARY_MECHANISM_EFF_DATES: '14-APR-00' }, geometry: { rings } });
let mode = 'ok', feats = [], lastBody = '';
globalThis.fetch = async (u, o) => { lastBody = String(o && o.body); if (mode === 'down') throw new Error('net'); if (mode === 'http') return { ok: false, status: 500 }; if (mode === 'err') return { ok: true, json: async () => ({ error: { code: 400 } }) }; return { ok: true, json: async () => ({ features: feats }) }; };
const call = async (body, ip = '1.1.1.1') => { const r = await api(new Request('http://x/e', { method: 'POST', body: JSON.stringify(body), headers: { 'x-nf-client-connection-ip': ip, cookie: PRO } }), {}); return { s: r.status, j: await r.json() }; };

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

// ---- other states (TEST FIXTURE data) ----
const coLot = dx => sq(-105.1 + dx, -105.099 + dx, 40.5, 40.501);
const cdphe = (rings) => ({ attributes: { Site: 'TEST FIXTURE CO SITE', PGM_SYS_ID: 'RSNOT1', Feature_ID: 'Restrictive Notice Area', Document: 'https://oitco.hylandcloud.com/CDPHERMPop/docpop/docpop.aspx?docid=1', Summary: '' }, geometry: { rings } });
let byUrl = {}, failUrl = null, urls = [];
globalThis.fetch = async (u, o) => { u = String(u); urls.push(u); lastBody = String(o && o.body); if (failUrl && u.includes(failUrl)) throw new Error('net'); const k = Object.keys(byUrl).find(x => u.includes(x)); return { ok: true, json: async () => ({ features: k ? byUrl[k] : [] }) }; };
byUrl = { cohealthmaps: [cdphe(sq(-105.11, -105.0995, 40.49, 40.51))] };
r = await call({ state: 'CO', rings: coLot(0) }); m = r.j.matches && r.j.matches[0];
ok(r.j.ok && r.j.usState === 'CO' && m && m.agency === 'CDPHE' && Math.abs(m.pct - 50) < 1.5 && m.docs.startsWith('https://oitco.hylandcloud.com/') && urls.some(u => /cohealthmaps/.test(u)) && urls.some(u => /Superfund/.test(u)), 'CO overlap: CDPHE + EPA both checked; site, % of lot and official record link');
ok(r.j.sources.length === 2 && !r.j.gap, 'CO lists both official sources and no coverage gap');
byUrl = {}; r = await call({ state: 'CO', rings: coLot(0.002) }); ok(r.j.ok && r.j.matches.length === 0, 'CO no overlap: zero matches ("No mapped restriction overlap found")');
byUrl = { cohealthmaps: [cdphe(sq(-105.11, -105.09, 40.49, 40.51))] }; r = await call({ state: 'CO', point: [-105.1, 40.5005] }); ok(r.j.ok && r.j.mode === 'point' && r.j.matches.length === 1 && r.j.matches[0].pct === null, 'CO pin only: point mode');
failUrl = 'Superfund'; r = await call({ state: 'CO', rings: coLot(0.004) }); ok(r.j.ok === false && r.j.reason === 'lookup', 'CO: if any one source fails, the whole check is "Registry check unavailable" (never a partial "no overlap")');
failUrl = null; byUrl = {}; r = await call({ state: 'AL', rings: sq(-86.3, -86.299, 32.3, 32.301) }); ok(r.j.ok && r.j.matches.length === 0 && /ADEM/.test(r.j.gap) && r.j.sources.length === 1, 'AL: EPA only, with an honest note that the state registry is not mapped');
ok((await call({ state: 'TX', rings: lot(0) })).s === 400, 'unsupported state refused');
const pw = (c) => api(new Request('http://x/e', { method: 'POST', body: JSON.stringify({ rings: lot(0) }), headers: c ? { cookie: c } : {} }), {});
ok((await pw()).status === 402 && (await pw(FREE)).status === 402 && (await pw(PRO)).status === 200, 'environmental restrictions are for paid members: signed-out and free accounts get 402');
console.log('\n' + pass + ' checks passed');
