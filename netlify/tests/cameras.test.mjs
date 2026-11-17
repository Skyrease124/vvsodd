// Run: node netlify/tests/cameras.test.mjs   (mocked providers; TEST FIXTURE data)
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
process.env.USERS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-'));
const __auth = await import('../lib/auth.mjs'); await __auth.createUser('free@example.com', 'password123', false); { const u = await __auth.createUser('pro@example.com', 'password123', false); u.paidThrough = '2099-01-01'; await __auth.saveUser(u); }
const PRO = (await __auth.sessionCookie('pro@example.com')).split(';')[0], FREE = (await __auth.sessionCookie('free@example.com')).split(';')[0];
const mod = await import('../functions/cameras.mjs'); const { default: api, nearby, imageMeta, _reset, miles, _verified } = mod;
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok -', m); };
const fl = (id, lat, lng, img = 'https://images-dis.divas.cloud/DGI/x' + id + '.jpg') => ({ attributes: { ID: id, DESCRIPT: 'TEST FIXTURE cam ' + id, HIGHWAY: 'I-95', DIRECTION: 'N', LATITUDE: lat, LONGITUDE: lng, TIMESTAMP: '07/20/2026 8:09:58 PM', IMAGE: img } });
let flFeats = [], flDown = false, caDown = false, heads = 0;
globalThis.fetch = async (u, o) => { u = String(u);
  if (o && o.method === 'HEAD') { heads++; return { ok: true, headers: { get: k => k === 'last-modified' ? 'Tue, 17 Nov 2026 03:31:47 GMT' : null } }; }
  if (u.includes('FL511')) { if (flDown) throw new Error('net'); return { ok: true, json: async () => ({ features: flFeats }) }; }
  if (u.includes('cwwp2.dot.ca.gov')) { if (caDown) return { ok: false, status: 500 }; return { ok: true, json: async () => ({ data: [] }) }; }
  if (u.includes('az511.com/api/v2/get/cameras') || u.includes('511ga.org/api/v2/get/cameras')) { azCalls++; return { ok: true, json: async () => [{ Id: 2056, Roadway: 'I-10', Direction: 'Unknown', Latitude: 32.88, Longitude: -111.75, Location: 'TEST FIXTURE I-10 @ MP 200', Views: [{ Id: 960, Url: 'https://az511.com/map/Cctv/960', Status: 'Enabled', Description: 'TEST FIXTURE I-10 EB 200' }, { Id: 961, Url: 'https://az511.com/map/Cctv/961', Status: 'Disabled', Description: 'off' }] }, { Id: 9, Latitude: 0, Longitude: 0, Views: [{ Id: 1, Url: 'https://az511.com/map/Cctv/1', Status: 'Enabled' }] }] }; }
  throw new Error('unexpected ' + u); };
let azCalls = 0;
// Jacksonville-ish parcel near the GA line
flFeats = [fl('1', 30.70, -81.60), fl('2', 30.75, -81.60), fl('1', 30.70, -81.60), fl('3', 30.70, -81.50), fl('4', 0, 0), fl('5', 30.71, -81.60, ''), fl('6', 31.5, -81.6)];
let r = await nearby(30.69, -81.60, 10, 5);
ok(r.ok && r.cameras.map(c => c.id).join() === '1,2,3', 'sorted by straight-line distance; invalid coordinates, missing image, out-of-radius and duplicate IDs removed');
ok(r.cameras.every((c, i, a) => !i || a[i - 1].miles <= c.miles) && Math.abs(r.cameras[0].miles - miles(30.69, -81.6, 30.7, -81.6)) < 0.01, 'distance in miles (haversine)');
ok(r.providers.find(p => p.id === 'ga').status === 'viewer' && r.providers.find(p => p.id === 'fl').status === 'ok', 'border parcel: Georgia official viewer offered across the state line (no key = not integrated)');
ok(r.cameras[0].kind === 'snapshot' && r.cameras[0].viewer === 'https://www.fl511.com/cctv' && /Directory record/.test(r.cameras[0].sourceMeta), 'shared record: source, ID, name, coords, view type, official viewer URL; directory timestamp kept as metadata only');
r = await nearby(30.69, -81.60, 10, 2); ok(r.cameras.length === 2 && r.totalInRadius === 3, 'limit is configurable');
// no nearby cameras
r = await nearby(25.95, -81.05, 10, 5); ok(r.ok && r.cameras.length === 0 && r.providers.find(p => p.id === 'fl').status === 'ok', 'remote parcel: working feed, zero matches ("No public cameras found")');
// provider outage isolation: FL down, beach cams still answer
_reset(); flDown = true;
r = await nearby(26.452, -81.95, 10, 5);
ok(r.providers.find(p => p.id === 'fl').status === 'unavailable' && r.providers.find(p => p.id === 'fmy').status === 'ok' && r.cameras[0].src === 'fmy' && r.cameras[0].kind === 'viewer', 'FL511 outage does not hide the Fort Myers beach cams');
ok(r.cameras[0].type === 'Beach cam' && /visitfortmyers\.com\/webcams#/.test(r.cameras[0].viewer), 'beach cam: labeled, opens the official page');
r = await nearby(30.69, -81.60, 10, 5); ok(r.cameras.length === 0 && r.providers.find(p => p.id === 'fl').status === 'unavailable', 'directory down: provider reported unavailable, not "no cameras"');
flDown = false; _reset();
caDown = true; r = await nearby(37.84, -121.28, 10, 5); ok(r.providers.find(p => p.id === 'ca').status === 'unavailable', 'all Caltrans districts down: California unavailable');
caDown = false;
// image update time from Last-Modified, only for cameras in our own cache (no open proxy)
r = await nearby(30.69, -81.60, 10, 5); const m1 = await imageMeta('fl', '1'); ok(m1.ok && m1.lastModified === '2026-11-17T03:31:47.000Z', 'image update time read from the image server Last-Modified header');
ok((await imageMeta('fl', 'nope')).ok === false, 'unknown camera ID: no lookup');
const call = async q => { const x = await api(new Request('http://x/c?' + q, { headers: { cookie: PRO } }), {}); return { s: x.status, j: await x.json() }; };
ok((await call('lat=abc&lng=1')).s === 400 && (await call('meta=1&src=evil&id=1')).s === 400, 'bad input refused');
ok((await call('lat=30.69&lng=-81.6&radius=999&limit=999')).j.radius === 50, 'radius capped at 50 miles, limit at 20');
// AZ511 / 511GA gating: off without key; off with key until verified; then parsed
_reset(); delete process.env.AZ511_KEY; r = await nearby(32.88, -111.75, 10, 5);
ok(r.providers.find(p => p.id === 'az').status === 'viewer' && azCalls === 0 && r.providers.find(p => p.id === 'az').viewer === 'https://az511.com/cctv', 'AZ511 without a key: official viewer link only, API never called');
process.env.AZ511_KEY = 'TEST'; r = await nearby(32.88, -111.75, 10, 5);
ok(r.providers.find(p => p.id === 'az').status === 'viewer' && azCalls === 0, 'AZ511 with a key but not verified: still viewer link only');
_verified.az = true; r = await nearby(32.88, -111.75, 10, 5);
ok(r.providers.find(p => p.id === 'az').status === 'ok' && r.cameras.length === 1 && r.cameras[0].id === '2056-960' && r.cameras[0].direction === '' && r.cameras[0].image === 'https://az511.com/map/Cctv/960' && r.cameras[0].kind === 'snapshot', 'AZ511 verified: real-format record parsed (disabled views and bad coordinates dropped)');
await nearby(32.88, -111.75, 10, 5); ok(azCalls === 1, 'AZ511 list cached (provider allows 10 calls/minute)');
process.env.GA511_KEY = 'TEST'; r = await nearby(30.69, -81.60, 10, 5); ok(r.providers.find(p => p.id === 'ga').status === 'viewer', 'Georgia stays disabled even with GA511_KEY until a real preview is verified');
_verified.az = false; delete process.env.AZ511_KEY; delete process.env.GA511_KEY;
const anon = await api(new Request('http://x/c?lat=30.69&lng=-81.6'), {}), free = await api(new Request('http://x/c?lat=30.69&lng=-81.6', { headers: { cookie: FREE } }), {}), pro = await api(new Request('http://x/c?lat=30.69&lng=-81.6', { headers: { cookie: PRO } }), {});
ok(anon.status === 402 && free.status === 402 && (await free.json()).needPaid === true && pro.status === 200, 'cameras are for paid members: signed-out and free accounts get 402, a paid account gets the data');
console.log('\n' + pass + ' checks passed');
