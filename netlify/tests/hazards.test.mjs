// Run: node netlify/tests/hazards.test.mjs   (mocked EONET; TEST FIXTURE data)
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
process.env.USERS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'hz-'));
const { default: api, parse, load, _reset } = await import('../functions/hazards.mjs');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok -', m); };
const ev = (id, cat, geo, extra = {}) => Object.assign({ id, title: 'TEST FIXTURE ' + id, closed: null, categories: [{ id: cat, title: cat }], sources: [{ id: 'NIFC', url: 'https://example.gov/' + id }], geometry: geo }, extra);
const pt = (lng, lat, date = '2026-11-18T00:00:00Z') => ({ type: 'Point', date, coordinates: [lng, lat] });
const data = { events: [
  ev('A', 'wildfires', [pt(-120, 38, 'old'), pt(-121, 39)]),
  ev('B', 'floods', [{ type: 'Polygon', date: 'd', coordinates: [[[-90, 30], [-92, 30], [-92, 32], [-90, 32], [-90, 30]]] }]),
  ev('C', 'severeStorms', [pt(80, 10)]),            // Indian Ocean: outside US
  ev('D', 'wildfires', [pt(-100, 35)], { closed: '2026-11-01' }),
  ev('E', 'drought', [pt(-100, 35)]),
  ev('F', 'wildfires', [pt(-100, 35)], { sources: [{ id: 'X', url: 'javascript:alert(1)' }], link: 'http://x' }),
  ev('G', 'volcanoes', []),
] };
const r = parse(data);
ok(r.map(x => x.id).join() === 'A,B,F', 'keeps open US events in supported categories only (non-US, closed, other categories, no-geometry dropped)');
ok(r[0].lat === 39 && r[0].lng === -121, 'uses the latest reported location');
ok(Math.abs(r[1].lat - 31) < 1 && Math.abs(r[1].lng + 91) < 1, 'polygon event drawn at its centroid');
ok(r[2].link === '', 'non-https links are dropped');
let calls = 0, down = false;
globalThis.fetch = async u => { calls++; if (down) throw new Error('net'); return { ok: true, json: async () => data }; };
_reset(); let v = await load(); await load();
ok(v.ok && v.counts.wildfires === 2 && calls === 1, 'counts by category; second call served from the 15-minute cache');
_reset(); down = true; v = await load(); ok(v.ok === false && v.reason === 'lookup', 'outage reported as unavailable, never as "no hazards"');
down = false; _reset(); await load(); down = true; ok((await load()).ok, 'cached data still served while cache is fresh');
down = false; _reset();
const res = await api(new Request('http://x/h'), {}); const j = await res.json(); ok(res.status === 200 && j.ok && j.events.length === 3 && /EONET/.test(j.source), 'endpoint answers with source label');
ok((await api(new Request('http://x/h', { method: 'POST' }), {})).status === 405, 'GET only');
console.log(pass + ' passed');
