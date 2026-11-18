import { ID, call } from './harness.mjs';
const rows = []; const want = { anon: 'deny', free: 'deny', expired: 'deny', revoked: 'deny', canceledActive: 'allow', pro: 'allow', other: 'allow', owner: 'allow' };
const PRO = [
  ['ai', 'POST', '', { question: 'which states pay the highest interest?' }], ['ask', 'POST', '', { state: 'FL', question: 'what is the rate?' }], ['screen', 'POST', '', { q: 'cheap liens' }],
  ['askcounty', 'POST', '', { act: 'draft', state: 'FL', county: 'Palm Beach', topic: 'redemption' }],
  ['bls', 'GET', 'lat=32.8&lng=-83.6'], ['census', 'GET', 'lat=32.8&lng=-83.6'], ['gmaps', 'GET', 'road=1&lat=32.8&lng=-83.6'], ['gmaps', 'GET', 'nearby=1&lat=32.8&lng=-83.6'], ['gmaps', 'GET', 'sv=1&lat=32.8&lng=-83.6'],
  ['fires', 'GET', 'lat=33&lng=-84'], ['energy', 'GET', 'lat=33&lng=-84'], ['wxnow', 'GET', 'lat=33&lng=-84'], ['govdata', 'GET', 'crime=1&lat=33&lng=-84'], ['envctl', 'POST', '', { lat: 33, lng: -84 }], ['cameras', 'GET', 'lat=33&lng=-84'],
  ['rentcast', 'GET', 'lat=28.18&lng=-81.21'], ['countynews', 'GET', 'state=FL&county=Palm%20Beach']
];
for (const [fn, method, q, body] of PRO) for (const id of Object.keys(ID)) {
  const r = await call(fn, { method, q, body, cookie: ID[id] });
  const denied = [401, 402, 403].includes(r.status);
  const exp = want[id]; const ok = exp === 'deny' ? denied : !denied;
  rows.push({ fn: fn + (q ? '?' + q.split('&')[0] : ''), id, status: r.status, ok });
}
const bad = rows.filter(r => !r.ok);
console.log('PRO endpoints x accounts:', rows.length, 'checks,', bad.length, 'unexpected');
bad.forEach(b => console.log('  UNEXPECTED', b.fn, b.id, b.status));
