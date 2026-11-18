// Before/after: the same questions through the classic one-shot path and the AI 2.0 agent. The model endpoint is switched OFF
// here, so everything shown comes from our records and plain code (this is what the evidence looks like before any model phrasing).
import http from 'node:http';
const mock = http.createServer((q, r) => { r.statusCode = 500; r.end('{}'); }); await new Promise(r => mock.listen(0, r));
process.env.NVIDIA_API_URL = 'http://127.0.0.1:' + mock.address().port + '/v1/chat/completions'; process.env.NVIDIA_API_KEY = 'k-test-0123456789abcdefghij'; process.env.ASK_DAILY_LIMIT = '999'; process.env.AI_PER_USER_DAILY = '999';
const { ID, call } = await import('../security/harness.mjs');
const Q = process.argv.slice(2).length ? process.argv.slice(2) : ['Compare tax lien opportunities in Florida, Arizona and Colorado', 'Research the risks of buying tax liens in Texas', 'Investigate parcel 99-99-99-99-99-999-9999'];
for (const q of Q) {
  console.log('\n=== ' + q);
  for (const classic of [true, false]) {
    const r = await call('ai', { method: 'POST', body: { question: q, classic }, cookie: ID.pro }); const j = JSON.parse(r.text);
    console.log('\n--- ' + (classic ? 'BEFORE (classic)' : 'AFTER (agent)') + ' status ' + r.status + (j.kind ? ' kind ' + j.kind : ''));
    if (j.trace) console.log('steps: ' + j.trace.map(t => t.step + (t.detail ? ' [' + t.detail + ']' : '')).join(' > '));
    console.log((j.answer || j.error || '').slice(0, 900));
    if (j.uncertainty && j.uncertainty.length) console.log('uncertainty: ' + j.uncertainty.slice(0, 3).join(' | '));
    if (j.sources) console.log('sources: ' + j.sources.length + (j.sources[0] ? ' e.g. ' + j.sources[0].name : ''));
  }
}
process.exit(0);
