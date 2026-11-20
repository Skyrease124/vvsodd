// Run: node netlify/tests/cameras.test.mjs   (mocked providers; TEST FIXTURE data)
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
process.env.USERS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-'));
const __auth = await import('../lib/auth.mjs'); await __auth.createUser('free@example.com', 'password123', false); { const u = await __auth.createUser('pro@example.com', 'password123', false); u.paidThrough = '2099-01-01'; await __auth.saveUser(u); }
const PRO = (await __auth.sessionCookie('pro@example.com')).split(';')[0], FREE = (await __auth.sessionCookie('free@example.com')).split(';')[0];
const mod = await import('../functions/cameras.mjs'); const { default: api, nearby, imageMeta, _reset, miles, _verified } = mod;
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok -', m); };
const fl = (id, lat, lng, img = 'https://images-dis.divas.cloud/DGI/x' + id + '.jpg') => ({ attributes: { ID: id, DESCRIPT: 'TEST FIXTURE cam ' + id, HIGHWAY: 'I-95', DIRECTION: 'N', LATITUDE: lat, LONGITUDE: lng, TIMESTAMP: '07/20/2026 8:09:58 PM', IMAGE: img } });
let flFeats = [], flDown = false, caDown = false, caRecords = [], heads = 0;
const wisconsinTestKey = 'fixture-wisconsin-key-1234';
let wisconsinCalls = 0;
globalThis.fetch = async (u, o) => { u = String(u);
  if (o && o.method === 'HEAD') { heads++; return { ok: true, headers: { get: k => k === 'last-modified' ? 'Tue, 17 Nov 2026 03:31:47 GMT' : null } }; }
  if (u.includes('FL511')) { if (flDown) throw new Error('net'); return { ok: true, json: async () => ({ features: flFeats }) }; }
  if (u.includes('cwwp2.dot.ca.gov')) { if (caDown) return { ok: false, status: 500 }; return { ok: true, json: async () => ({ data: u.includes('cctvStatusD07') ? caRecords : [] }) }; }
  if (u.includes('az511.com/api/v2/get/cameras') || u.includes('511ga.org/api/v2/get/cameras')) { azCalls++; return { ok: true, json: async () => [{ Id: 2056, Roadway: 'I-10', Direction: 'Unknown', Latitude: 32.88, Longitude: -111.75, Location: 'TEST FIXTURE I-10 @ MP 200', Views: [{ Id: 960, Url: 'https://az511.com/map/Cctv/960', Status: 'Enabled', Description: 'TEST FIXTURE I-10 EB 200' }, { Id: 961, Url: 'https://az511.com/map/Cctv/961', Status: 'Disabled', Description: 'off' }] }, { Id: 9, Latitude: 0, Longitude: 0, Views: [{ Id: 1, Url: 'https://az511.com/map/Cctv/1', Status: 'Enabled' }] }] }; }
  if (u.startsWith('https://511wi.gov/api/v2/get/cameras?')) {
    wisconsinCalls++;
    const query = new URL(u).searchParams;
    if (query.get('key') !== wisconsinTestKey) return new Response(null,{status:400});
    assert.equal(query.get('format'),'json');
    return Response.json([{Id:3,Roadway:'I-41',Direction:'Unknown',Latitude:44.299419,Longitude:-88.446465,Location:'I-41 at County A',Views:[
      {Id:1450,Url:'https://511wi.gov/map/Cctv/1450',Status:'Enabled',Description:''},
      {Id:1451,Url:'https://511wi.gov/map/Cctv/1451',Status:'Disabled',Description:''}
    ]}]);
  }
  if (u === 'https://511wi.gov/map/Cctv/1450') return new Response(new Uint8Array(2500), {headers:{'Content-Type':'image/jpeg'}});
  if (u.includes('data.austintexas.gov')) { atxCalls++; if (atxDown) return { ok: false, status: 500 }; return { ok: true, json: async () => [
    { camera_id: '1', location_name: '  TEST FIXTURE  830 BLK W RUNDBERG LN ', primary_st: ' RUNDBERG LN', location: { type: 'Point', coordinates: [-97.698158, 30.363686] }, screenshot_address: 'https://cctv.austinmobility.io/image/1.jpg', modified_date: '2023-07-18T20:45:00.000Z' },
    { camera_id: '2', location_name: 'TEST FIXTURE no image', location: { type: 'Point', coordinates: [-97.70, 30.36] }, screenshot_address: '' },
    { camera_id: '3', location_name: 'TEST FIXTURE bad coords', location: { type: 'Point', coordinates: [0, 0] }, screenshot_address: 'https://cctv.austinmobility.io/image/3.jpg' },
    { camera_id: '4', location_name: 'TEST FIXTURE http only', location: { type: 'Point', coordinates: [-97.71, 30.37] }, screenshot_address: 'http://cctv.austinmobility.io/image/4.jpg' },
    { camera_id: '5', location_name: 'TEST FIXTURE far', location: { type: 'Point', coordinates: [-97.35, 30.75] }, screenshot_address: 'https://cctv.austinmobility.io/image/5.jpg' }] }; }
  throw new Error('unexpected ' + u); };
let atxCalls = 0, atxDown = false;
let azCalls = 0;
// ---- Texas viewer-only providers: official links, no invented feed ----
{ _reset(); const h = await nearby(29.7604, -95.3698, 10, 5), pr = id => h.providers.find(p => p.id === id);
  ok(h.cameras.length === 0 && pr('hou') && pr('hou').status === 'viewer' && /houstontranstar\.org/.test(pr('hou').viewer) && pr('tx') && pr('tx').status === 'viewer' && /drivetexas\.org/.test(pr('tx').viewer), 'Houston: official TranStar and DriveTexas viewers offered; no cameras are made up'); }
// ---- Austin (City open data) ----
{ _reset(); let a = await nearby(30.3637, -97.698, 10, 5);
  ok(a.cameras.length === 1 && a.cameras[0].id === '1' && a.cameras[0].src === 'atx' && a.cameras[0].name === 'TEST FIXTURE 830 BLK W RUNDBERG LN' && a.cameras[0].kind === 'snapshot' && a.cameras[0].image === 'https://cctv.austinmobility.io/image/1.jpg', 'Austin: only the valid camera in range (far one excluded), names cleaned, snapshot with the city image link');
  ok(!a.cameras.some(c => c.id === '2' || c.id === '3' || c.id === '4'), 'Austin: records without an https image or with bad coordinates are dropped');
  ok(/City of Austin/.test(a.cameras[0].operator) && /Directory record 2023-07-18/.test(a.cameras[0].sourceMeta) && /data\.austintexas\.gov/.test(a.cameras[0].viewer) && a.providers.find(p => p.id === 'atx').status === 'ok', 'Austin: source credited, record date shown, provider live');
  _reset(); atxDown = true; a = await nearby(30.3637, -97.698, 10, 5); ok(a.cameras.length === 0 && a.providers.find(p => p.id === 'atx').status === 'unavailable', 'Austin outage: reported as unavailable, never as "no cameras"'); atxDown = false; _reset(); }
// Jacksonville-ish parcel near the GA line
flFeats = [fl('1', 30.70, -81.60), fl('2', 30.75, -81.60), fl('1', 30.70, -81.60), fl('3', 30.70, -81.50), fl('4', 0, 0), fl('5', 30.71, -81.60, ''), fl('6', 31.5, -81.6)];
let r = await nearby(30.69, -81.60, 10, 5);
ok(r.ok && r.cameras.map(c => c.id).join() === '1,2,3', 'sorted by straight-line distance; invalid coordinates, missing image, out-of-radius and duplicate IDs removed');
ok(r.cameras.every((c, i, a) => !i || a[i - 1].miles <= c.miles) && Math.abs(r.cameras[0].miles - miles(30.69, -81.6, 30.7, -81.6)) < 0.01, 'distance in miles (haversine)');
ok(r.providers.find(p => p.id === 'ga').status === 'viewer' && r.providers.find(p => p.id === 'fl').status === 'ok', 'border parcel: Georgia official viewer offered across the state line (no key = not integrated)');
ok(r.cameras[0].kind === 'snapshot' && r.cameras[0].viewer === 'https://www.fl511.com/cctv' && /Directory record/.test(r.cameras[0].sourceMeta), 'shared record: source, ID, name, coords, view type, official viewer URL; directory timestamp kept as metadata only');
r = await nearby(30.69, -81.60, 10, 2); ok(r.cameras.length === 2 && r.totalInRadius === 3, 'limit is configurable');
// Home can request snapshots first without changing the map's distance order.
{ _reset();
  flFeats = [fl('lee', 26.64, -81.91)];
  const nearest = await nearby(26.548365, -81.981341, 30, 4);
  const previews = await nearby(26.548365, -81.981341, 30, 4, true);
  ok(nearest.cameras[0].id === 'butterfly' && !nearest.cameras[0].image && previews.cameras.every(c => c.image), 'Home prioritizes snapshots while the map keeps the nearest official viewer');
  const beach = await nearby(26.452566, -81.956567, 8, 4, true);
  ok(beach.cameras[0].id === 'timessq' && beach.cameras[0].kind === 'viewer' && new URL(beach.cameras[0].image).searchParams.get('oid') === 'CID_IWIS00001740', 'Fort Myers Beach uses the official snapshot and retains the official live viewer');
  flFeats = [fl('1', 30.70, -81.60)]; _reset();
}
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
{ _reset();
  const ca = (index, lat, video = '') => ({cctv:{index, location:{latitude:lat,longitude:-118.2437,locationName:index}, imageData:{streamingVideoURL:video,static:{currentImageURL:'https://cwwp2.dot.ca.gov/test.jpg'}}}});
  caRecords = [ca('near snapshot',34.0522), ca('live video',34.0622,'https://wzmedia.dot.ca.gov/test.m3u8')];
  const query = 'lat=34.0522&lng=-118.2437&radius=10&limit=1';
  const standard = await call(query);
  const video = await call(query+'&preview=1&video=1');
  ok(standard.j.cameras[0].name === 'near snapshot' && video.j.cameras[0].name === 'live video' && video.j.cameras[0].kind === 'video', 'live video can be ranked first for the Pro camera browser without changing map ordering');
  caRecords = []; _reset();
}
// AZ511 / 511GA gating: off without key; off with key until verified; then parsed
_reset(); delete process.env.AZ511_KEY; r = await nearby(32.88, -111.75, 10, 5);
ok(r.providers.find(p => p.id === 'az').status === 'viewer' && azCalls === 0 && r.providers.find(p => p.id === 'az').viewer === 'https://az511.com/cctv', 'AZ511 without a key: official viewer link only, API never called');
process.env.AZ511_KEY = 'TEST'; r = await nearby(32.88, -111.75, 10, 5);
ok(r.providers.find(p => p.id === 'az').status === 'viewer' && azCalls === 0, 'AZ511 with a key but not verified: still viewer link only');
_verified.az = true; r = await nearby(32.88, -111.75, 10, 5);
ok(r.providers.find(p => p.id === 'az').status === 'ok' && r.cameras.length === 1 && r.cameras[0].id === '2056-960' && r.cameras[0].direction === '' && r.cameras[0].image === 'https://az511.com/map/Cctv/960' && r.cameras[0].kind === 'snapshot', 'AZ511 verified: real-format record parsed (disabled views and bad coordinates dropped)');
await nearby(32.88, -111.75, 10, 5); ok(azCalls === 1, 'AZ511 list cached (provider allows 10 calls/minute)');
process.env.GA511_KEY = 'TEST'; _verified.ga = false; r = await nearby(30.69, -81.60, 10, 5); ok(r.providers.find(p => p.id === 'ga').status === 'viewer', 'Georgia stays disabled with a key until a real preview is verified'); _verified.ga = true;
_verified.az = false; delete process.env.AZ511_KEY; delete process.env.GA511_KEY;
// 511WI can be tested by its owner before it is enabled on the public camera map.
{
  delete process.env.WI511_KEY;
  const ownerApi = (await import('../functions/ownerkeys.mjs')).default;
  await __auth.createUser('owner@example.test','password123',true);
  const owner = (await __auth.sessionCookie('owner@example.test')).split(';')[0];
  const request = (cookie, body) => ownerApi(new Request('http://x/ownerkeys',{
    method:body?'POST':'GET',headers:{cookie,'Content-Type':'application/json'},
    ...(body?{body:JSON.stringify(body)}:{})
  }));
  const testWi = {test:'wi'}, keyName = 'WI511_KEY';
  ok((await request(PRO,testWi)).status === 403 && (await request('',testWi)).status === 401, '511WI key testing is owner-only');
  const list = await (await request(owner)).json();
  ok(list.keys.some(k=>k.name===keyName && !k.set) && !(await (await request(owner,testWi)).json()).ok && wisconsinCalls === 0, '511WI appears before a key is saved and skips the source request');
  const saved = await (await request(owner,{name:keyName,value:wisconsinTestKey})).json();
  ok(saved.keys.find(k=>k.name===keyName).hint === '…1234' && !JSON.stringify(saved).includes(wisconsinTestKey), '511WI key save returns only the masked suffix');
  const result = await (await request(owner,testWi)).json();
  ok(result.ok && result.cameras === 1 && result.sample.name === 'I-41 at County A' && result.image.ok && wisconsinCalls === 1 && !JSON.stringify(result).includes(wisconsinTestKey), 'Test it checks an enabled Wisconsin camera and its picture');
  const wi = await nearby(44.30,-88.45,15,4);
  ok(wi.providers.find(p=>p.id==='wi').status === 'viewer' && wisconsinCalls === 1, 'Wisconsin retains its official viewer before the feed is verified');
  const removed = await (await request(owner,{name:keyName,remove:true})).json();
  ok(!removed.keys.find(k=>k.name===keyName).set, 'The owner can remove the Wisconsin key');
}
const anon = await api(new Request('http://x/c?lat=30.69&lng=-81.6'), {}), free = await api(new Request('http://x/c?lat=30.69&lng=-81.6', { headers: { cookie: FREE } }), {}), pro = await api(new Request('http://x/c?lat=30.69&lng=-81.6', { headers: { cookie: PRO } }), {});
ok(anon.status === 402 && free.status === 402 && (await free.json()).needPaid === true && pro.status === 200, 'cameras are for paid members: signed-out and free accounts get 402, a paid account gets the data');
console.log('\n' + pass + ' checks passed');
