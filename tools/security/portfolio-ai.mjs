// The AI answers portfolio questions from the caller's own portfolio only; Free/anon are refused; no model call is made.
import http from 'node:http'; let calls = 0;
const mock = http.createServer((q, r) => { calls++; r.setHeader('content-type', 'application/json'); r.end(JSON.stringify({ choices: [{ message: { content: '{}' } }] })); });
await new Promise(r => mock.listen(0, r));
process.env.NVIDIA_API_URL = 'http://127.0.0.1:' + mock.address().port + '/v1/chat/completions'; process.env.NVIDIA_API_KEY = 'k-test-0123456789abcdefghij';
const { ID, call, auth } = await import('./harness.mjs');
const setPf = async (email, pf) => { const u = await auth.getUser(email); u.portfolio = pf; await auth.saveUser(u); };
await setPf('pro@test.invalid', [{ id: 'mine0001', state: 'FL', county: 'Leon', parcel: 'MINE-1', paid: 1000, rate: 18, bought: '2026-06-01', months: 24, status: 'open', countyDeadline: '2026-12-20' }]);
await setPf('other@test.invalid', [{ id: 'theirs01', state: 'FL', county: 'Collier', parcel: 'SECRET-OTHER', paid: 99999, rate: 18, bought: '2026-06-01', months: 24, status: 'open' }]);
const ask = async (cookie, q) => { const r = await call('ai', { method: 'POST', body: { question: q }, cookie }); return { s: r.status, j: JSON.parse(r.text) }; };
let bad = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) bad++; };
let r = await ask(ID.pro, 'Which of my certificates have upcoming deadlines?'); ok(r.s === 200 && r.j.kind === 'portfolio' && /MINE-1/.test(r.j.answer), 'pro sees own deadlines');
r = await ask(ID.pro, 'How much have I invested across Florida?'); ok(!/SECRET-OTHER|99,999|Collier/.test(JSON.stringify(r.j)) && /\$1,000/.test(r.j.answer), 'pro never sees another member portfolio');
r = await ask(ID.other, 'How much have I invested across Florida?'); ok(/\$99,999/.test(r.j.answer) && !/MINE-1/.test(JSON.stringify(r.j)), 'other sees only theirs');
r = await ask(ID.free, 'Which of my certificates have upcoming deadlines?'); ok(r.s === 402, 'free refused');
r = await ask(ID.anon, 'Which of my certificates have upcoming deadlines?'); ok(r.s === 401, 'anon refused');
r = await ask(ID.expired, 'my portfolio'); ok(r.s === 402, 'expired refused');
ok(calls === 0, 'no model calls made (' + calls + ')');
console.log(bad ? 'FAILED ' + bad : 'ALL PASS'); process.exit(bad ? 1 : 0);
