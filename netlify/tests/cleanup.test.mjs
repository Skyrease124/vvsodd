// Run: node netlify/tests/cleanup.test.mjs   (mocked DEP service)
import assert from 'node:assert/strict';
const { default: api } = await import('../functions/cleanup.mjs');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok -', m); };
const url = (b = [-82.4, 27.95, -82.39, 27.96]) => 'http://x/f?xmin=' + b[0] + '&ymin=' + b[1] + '&xmax=' + b[2] + '&ymax=' + b[3];
const feat = (x, y, name = 'TEST SITE') => ({ attributes: { DEP_CLEANUP_SITE_KEY: 1, SOURCE_DATABASE_ID: '123', SOURCE_DATABASE_NAME: 'STCM', BUSINESS_NAME: name, RSC2_REMEDIATION_STATUS_KEY: 'ACTIVE', CLCC_CLEANUP_CATEGORY_KEY: 'PETRO', PC2_PROXIMITY_ID: 'EXACT', DOCUMENTS: 'https://prodenv.dep.state.fl.us/DepNexus/public/electronic-documents/123/facility!search' }, geometry: { x, y } });
let mode = 'ok', n = 0; globalThis.fetch = async () => { n++; if (mode === 'down') throw new Error('network'); if (mode === 'http') return { ok: false, status: 500 }; return { ok: true, json: async () => mode === 'err' ? { error: { code: 500 } } : mode === 'many' ? { features: [], exceededTransferLimit: true } : { features: mode === 'empty' ? [] : [feat(-82.395, 27.955)] } }; };
const call = async (b, ip) => { const r = await api(new Request(url(b), { headers: { 'x-nf-client-connection-ip': ip || '1.1.1.1' } }), {}); return { s: r.status, j: await r.json() }; };
mode = 'ok'; let r = await call([-82.4, 27.95, -82.39, 27.96]); ok(r.j.ok && r.j.sites.length === 1 && r.j.sites[0].id === '123' && r.j.sites[0].status === 'ACTIVE' && /DepNexus/.test(r.j.sites[0].docs), 'a successful query returns the site with its DEP facility ID, status and official lookup link');
mode = 'empty'; r = await call([-82.41, 27.95, -82.4, 27.96]); ok(r.j.ok === true && r.j.sites.length === 0, 'a successful query with no sites is ok:true and an empty list (client says "No mapped cleanup sites within ½ mile.")');
for (const m of ['down', 'http', 'err', 'many']) { mode = m; r = await call([-82.42 - n / 1e4, 27.95, -82.41 - n / 1e4, 27.96]); ok(r.j.ok === false && !r.j.sites, 'a failed lookup (' + m + ') is ok:false, never an empty list'); }
mode = 'ok'; ok((await call([-90, 27, -89.95, 27.05])).s === 400, 'areas outside Florida are refused');
ok((await call([-82.4, 27.9, -82.2, 28.2])).s === 400, 'an oversized window is refused');
mode = 'ok'; const before = n; await call([-82.5, 27.95, -82.49, 27.96], '2.2.2.2'); await call([-82.5, 27.95, -82.49, 27.96], '2.2.2.2'); ok(n === before + 1, 'repeat requests for the same area are cached');
console.log('\n' + pass + ' checks passed');
