import { ID, call } from './harness.mjs';
const OWNER = [
  ['envctl', 'POST', '', { lat: 33, lng: -84 }, 'pro'],
  ['ownerkeys', 'GET', ''], ['ownerkeys', 'POST', '', { name: 'GA511_KEY', value: 'x' }], ['ownerkeys', 'POST', '', { test: 'ga' }], ['ocr', 'POST', '', { pdf: 'AAAA', from: 1 }],
  ['account', 'GET', 'stripe=1'], ['account', 'GET', 'mail=1'], ['account', 'GET', 'alerts=1'], ['account', 'GET', 'google=1'], ['account', 'GET', 'members=1'], ['account', 'GET', 'codes=1'], ['account', 'GET', 'resets=1'], ['account', 'GET', 'usage=1'],
  ['account', 'POST', '', { action: 'setLimit', limit: 5 }], ['account', 'POST', '', { action: 'ownerMember', email: 'free@test.invalid', paidThrough: '2099-01-01' }], ['account', 'POST', '', { action: 'makeCode' }], ['account', 'POST', '', { action: 'deleteCode', code: 'X' }],
  ['account', 'POST', '', { action: 'saveMail', apiKey: 'k', from: 'a@b.co' }], ['account', 'POST', '', { action: 'saveStripe', secretKey: 'sk_test_x' }], ['account', 'POST', '', { action: 'removeStripe' }], ['account', 'POST', '', { action: 'ensurePlan' }], ['account', 'POST', '', { action: 'createWebhook' }],
  ['account', 'POST', '', { action: 'saveGoogle', clientId: 'a', clientSecret: 'b' }], ['account', 'POST', '', { action: 'saveAlerts', webhook: 'https://x.invalid' }], ['account', 'POST', '', { action: 'ownerSetPassword', email: 'free@test.invalid' }],
  ['watch', 'POST', '', { action: 'admin' }], ['watch', 'POST', '', { action: 'review', id: 'abc', decision: 'approve' }], ['watch', 'POST', '', { action: 'digest' }],
  ['report', 'POST', '', { action: 'estateSet', county: 'Palm Beach', parcel: '74-43-44-04-24-000-0243', caseNumber: '1', documentTitle: 't', sourceUrl: 'https://x.gov' }], ['report', 'POST', '', { action: 'estateRemove', county: 'Palm Beach', parcel: '74-43-44-04-24-000-0243' }]
];
let bad = 0, n = 0;
for (const [fn, method, q, body, who] of OWNER) for (const id of Object.keys(ID)) {
  const r = await call(fn, { method, q, body, cookie: ID[id] }); n++;
  const allowed = who === 'pro' ? ['pro', 'other', 'canceledActive', 'owner'].includes(id) : id === 'owner';
  const denied = [401, 402, 403].includes(r.status);
  if (allowed ? denied : !denied) { bad++; console.log('UNEXPECTED', fn, method, q || (body && body.action) || '', id, r.status, (r.text || '').slice(0, 80)); }
}
console.log('owner-only endpoints x accounts:', n, 'checks,', bad, 'unexpected');
// every owner POST action in account.mjs must be listed above: scan the source for actions guarded by owner
