// AI 2.0 agent: access control, cache, spend cap, no cross-member leakage.
import http from 'node:http'; let calls = 0;
const mock = http.createServer((q, r) => { calls++; let b = ''; q.on('data', d => b += d); q.on('end', () => { r.setHeader('content-type', 'application/json'); r.end(JSON.stringify({ choices: [{ message: { content: 'Summary line.\n- fact one\nUncertain: some gaps.' } }] })); }); });
await new Promise(r => mock.listen(0, r));
process.env.NVIDIA_API_URL = 'http://127.0.0.1:' + mock.address().port + '/v1/chat/completions'; process.env.NVIDIA_API_KEY = 'k-test-0123456789abcdefghij'; process.env.ASK_DAILY_LIMIT = '500'; process.env.AI_PER_USER_DAILY = '500';
const { ID, call, auth } = await import('./harness.mjs');
let bad = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) bad++; };
const ask = async (cookie, q) => { const r = await call('ai', { method: 'POST', body: { question: q }, cookie }); return { s: r.status, j: JSON.parse(r.text) }; };
const u = await auth.getUser('other@test.invalid'); u.portfolio = [{ id: 'zz000001', state: 'FL', county: 'Collier', parcel: 'SECRET-PF-1', paid: 77777, rate: 18, bought: '2026-01-01', months: 12, status: 'open' }]; await auth.saveUser(u);
const Q = 'Compare tax lien opportunities in Florida and Arizona';
let r = await ask(ID.anon, Q); ok(r.s === 401, 'anon refused');
r = await ask(ID.free, Q); ok(r.s === 402, 'free refused');
r = await ask(ID.expired, Q); ok(r.s === 402, 'expired refused');
r = await ask(ID.pro, Q); ok(r.s === 200 && r.j.kind === 'research' && r.j.trace.length >= 6 && r.j.usedModel === true, 'pro gets research with 6+ steps and model phrasing');
const first = r.j; ok(first.sources.length > 0 && /Verify:/.test(first.answer), 'sources and Verify line');
const before = calls; r = await ask(ID.pro, Q); ok(r.j.cached === true && calls === before, 'repeat question served from saved result, no model call');
r = await ask(ID.pro, 'Research my risks and compare FL and AZ'); ok(!/SECRET-PF-1|77,777|Collier/.test(JSON.stringify(r.j)), 'no portfolio data of any member in research output');
r = await ask(ID.owner, Q); ok(r.s === 200, 'owner allowed');
// spend cap: limit 3 per day globally, 40 parallel distinct research questions from one member
const usage = await import('../../netlify/lib/usage.mjs'); await usage.setLimit(3); const base = calls;
const res = await Promise.all(Array.from({ length: 40 }, (_, i) => ask(ID.other, 'Research the risks in state number ' + i + ' Texas Ohio')));
const acc = res.filter(x => x.s === 200).length; ok(acc <= 3, 'parallel burst: ' + acc + ' accepted (cap 3), ' + res.filter(x => x.s === 429).length + ' refused; provider calls ' + (calls - base));
console.log(bad ? 'FAILED ' + bad : 'ALL PASS'); process.exit(bad ? 1 : 0);
