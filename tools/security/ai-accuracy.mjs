// Accuracy check: every lien the AI returns must exist in the county list with the same parcel and tax amount. No invented rows.
import http from 'node:http';
const mock = http.createServer((q, r) => { let b = ''; q.on('data', d => b += d); q.on('end', () => { r.setHeader('content-type', 'application/json'); r.end(JSON.stringify({ choices: [{ message: { content: b.includes('JSON search') ? '{}' : 'Answer. Verify: county.' } }] })); }); });
await new Promise(r => mock.listen(0, r));
process.env.NVIDIA_API_URL = 'http://127.0.0.1:' + mock.address().port + '/v1/chat/completions'; process.env.NVIDIA_API_KEY = 'k-test-0123456789abcdefghij'; process.env.ASK_DAILY_LIMIT = '500'; process.env.AI_PER_USER_DAILY = '500';
const { ID, call } = await import('./harness.mjs'); const { loadLiens } = await import('../../netlify/functions/screen.mjs');
const { FILES } = await import('../../netlify/functions/screen.mjs'); const rows = Object.keys(FILES).flatMap(c => { try { return loadLiens(c); } catch (e) { return []; } });
console.log('source rows loaded:', rows.length);
let bad = 0, checked = 0;
for (const q of ['Show the cheapest liens in Florida', 'Show the cheapest liens in Colorado', 'Show the cheapest liens in Arizona', 'Show the most valuable lots in Florida']) {
  const r = await call('ai', { method: 'POST', body: { question: q }, cookie: ID.pro }); const j = JSON.parse(r.text);
  for (const x of (j.results || [])) { checked++; const hit = rows.find(s => String(s.parcel) === String(x.parcel) && s.county === x.county && (x.face == null || s.face == null || Math.round(s.face) === Math.round(x.face))); if (!hit) { bad++; console.log('NOT FOUND', q, x.county, x.parcel); } }
  console.log(q, '->', r.status, (j.results || []).length, 'rows,', (j.sources || []).map(s => s.id).join('+'));
}
console.log('checked', checked, 'rows;', bad, 'not found in source'); process.exit(bad ? 1 : 0);
