// NVIDIA consolidation of real helper-agent results, tested against a LOCAL MOCK of the NVIDIA chat API.
// No request leaves the machine, no real key is used, and the dummy key below must never appear in
// any receipt, answer or error text.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const DUMMY_KEY = 'test-dummy-key-not-a-credential-0000';
let mode = 'good';
const sent = [];
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', () => {
    if (req.method === 'GET' && req.url === '/v1/models') {
      res.writeHead(200, {'Content-Type': 'application/json'});
      return res.end(JSON.stringify({data: [{id: 'meta/llama-3.3-70b-instruct'}, {id: 'nvidia/llama-3.1-nemotron-70b-instruct'}]}));
    }
    const parsed = JSON.parse(body || '{}');
    sent.push({model: parsed.model, auth: req.headers.authorization, body});
    if (mode === '500') { res.writeHead(500); return res.end('upstream failure, echoed ' + DUMMY_KEY); }
    if (mode === '429') { res.writeHead(429); return res.end('rate limited'); }
    if (mode === 'retired' && parsed.model === 'nvidia/nemotron-3-ultra-550b-a55b') { res.writeHead(410); return res.end('{"error":"model gone"}'); }
    if (mode === 'empty') { res.writeHead(200, {'Content-Type': 'application/json'}); return res.end(JSON.stringify({choices: [{finish_reason: 'length', message: {content: null, reasoning_content: 'Thinking'}}]})); }
    if (mode === 'truncated') { res.writeHead(200, {'Content-Type': 'application/json'}); return res.end(JSON.stringify({choices: [{finish_reason: 'length', message: {content: '{"conflicts":[{"parcelId":"0100'}}]})); }
    const user = parsed.messages?.[1]?.content || '[]';
    const items = JSON.parse(user);
    const validator = items.find(i => i.source === 'validator');
    let answer;
    if (mode === 'text') answer = 'Here is my summary, not JSON.';
    else if (mode === 'fabricated') answer = JSON.stringify({conflicts: [], proposals: [{parcelId: validator.parcelId, refs: [validator.ref], summary: 'Sold for 98765 dollars on the official list.'}]});
    else if (mode === 'prose') answer = 'Here is the result: ' + JSON.stringify({conflicts: [], proposals: [{parcelId: validator.parcelId, refs: [validator.ref], summary: 'Official polygon matches.'}]}) + ' Done.';
    else if (mode === 'badref') answer = JSON.stringify({conflicts: [], proposals: [{parcelId: validator.parcelId, refs: ['H99'], summary: 'invented source'}]});
    else answer = '```json\n' + JSON.stringify({
      conflicts: [{parcelId: validator.parcelId, refs: [validator.ref], detail: 'Validator reports a pending match; confirm before publishing.'}],
      proposals: [{parcelId: validator.parcelId, refs: [validator.ref], summary: 'Official polygon matches the address; awaiting owner approval.'},
        {parcelId: validator.parcelId, refs: items.filter(i => i.source === 'photon').slice(0, 1).map(i => i.ref).concat(['H77']), summary: 'mixed citations'}],
    }) + '\n```';
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({model: parsed.model, choices: [{message: {content: '<think>ignored</think>' + answer}}]}));
  });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
process.env.NVIDIA_API_URL = `http://127.0.0.1:${server.address().port}/v1/chat/completions`;
process.env.NVIDIA_MODELS_URL = `http://127.0.0.1:${server.address().port}/v1/models`;
const lib = await import('../../netlify/lib/brain-nvidia.mjs');
const {tokenBudget} = lib;
const {collectItems, deterministicConflicts, validateConsolidation, runConsolidation, DAILY_LIMIT, RECEIPTS, USAGE} = lib;
const {LEDGER} = await import('../../netlify/lib/brain-approvals.mjs');

const now = Date.parse('2026-11-23T20:00:00.000Z');
const ago = m => new Date(now - m * 60e3).toISOString();
function fakeAuth(seed) {
  const store = new Map(Object.entries(structuredClone(seed)));
  const etags = new Map(); let n = 0;
  return {store,
    kvGet: async k => structuredClone(store.get(k) ?? null),
    kvGetVersioned: async k => store.has(k) ? {data: structuredClone(store.get(k)), etag: etags.get(k)} : null,
    kvPutVersioned: async (k, v, et) => {
      if (et === null ? store.has(k) : etags.get(k) !== et) return null;
      const next = 'e' + (++n); store.set(k, structuredClone(v)); etags.set(k, next); return next;
    }};
}
const seed = () => ({
  'owner-brain-wayne-worker-v1': {recent: [
    {parcelId: '01002754', status: 'needs_review', checkedAt: ago(30), reason: 'Multiple official parcel matches'},
    {parcelId: '01003357', status: 'published', checkedAt: ago(90)}]},
  [LEDGER]: {entries: [
    {dataset: 'MI-wayne', recordId: 'r1', parcelId: '01002754', decision: 'pending_owner_review', reviewedBy: 'preview-wayne-batch-validator',
      reviewedAt: ago(10), proposedPosition: {lat: 42.3005, lon: -83.0995}, evidenceUrl: 'https://services2.arcgis.com/x/FeatureServer/0', independentlyChecked: true, officialObjectId: 100}]},
  'owner-brain-photon-status-v1': {recent: [
    {parcelId: '01002754', status: 'address_candidates_unverified', checkedAt: ago(20), verified: false,
     candidates: [{lat: 42.3006, lon: -83.0994}, {lat: 33.7, lon: -90.7}]}]},
  'owner-brain-geoapify-status-v1': {recent: [
    {parcelId: '01002754', status: 'address_candidates_unverified', checkedAt: ago(15), candidates: [{lat: 42.5, lon: -83.1}]}]},
});
const cfg = {key: DUMMY_KEY, model: '', source: 'test'};

test('collectItems reads only stored helper output, keeps sources, and drops geocoder points outside Michigan', async () => {
  const items = await collectItems(fakeAuth(seed()));
  assert.ok(items.length >= 5);
  assert.deepEqual([...new Set(items.map(i => i.source))].sort(), ['geoapify', 'official-gis-worker', 'photon', 'validator']);
  assert.equal(items.every(i => /^H\d+$/.test(i.ref)), true);
  const photon = items.filter(i => i.source === 'photon');
  assert.equal(photon.some(i => i.lat === 33.7), false, 'a candidate outside Michigan is not sent as a location');
  assert.equal(photon.find(i => i.lat === 42.3006)?.unverified, true, 'geocoder candidates are labelled unverified');
});

test('deterministic conflicts flag a status split and a location split without asking the model', async () => {
  const items = await collectItems(fakeAuth(seed()));
  const kinds = deterministicConflicts(items).map(c => c.kind);
  assert.ok(kinds.includes('status_disagreement'), 'validator says verified, worker says needs review');
  assert.ok(kinds.includes('location_disagreement'), 'Geoapify point is more than about 200 m from the validator point');
});

test('model answers are accepted only when every citation traces to an input item', async () => {
  const items = await collectItems(fakeAuth(seed()));
  const v = items.find(i => i.source === 'validator');
  const good = validateConsolidation(JSON.stringify({conflicts: [{parcelId: v.parcelId, refs: [v.ref], detail: 'ok'}],
    proposals: [{parcelId: v.parcelId, refs: [v.ref], summary: 'backed by the validator'}]}), items);
  assert.equal(good.proposals.length, 1);
  assert.equal(good.proposals[0].requiresOwnerApproval, true);
  assert.equal(good.conflicts.length, 1);
  const invented = validateConsolidation(JSON.stringify({proposals: [{parcelId: v.parcelId, refs: ['H99'], summary: 'x'}]}), items);
  assert.equal(invented.proposals.length, 0);
  assert.match(invented.rejected.join(' '), /unknown refs/);
  const geocoderOnly = items.filter(i => i.source === 'photon').map(i => i.ref);
  const photonOnly = validateConsolidation(JSON.stringify({proposals: [{parcelId: '01002754', refs: geocoderOnly.slice(0, 1), summary: 'x'}]}), items);
  assert.equal(photonOnly.proposals.length, 0, 'a geocoder candidate alone never becomes a proposal');
  assert.equal(validateConsolidation('not json at all', items).proposals.length, 0);
});

test('a completed run stores a receipt with sourced proposals, and the key appears nowhere stored', async () => {
  mode = 'good'; sent.length = 0;
  const auth = fakeAuth(seed());
  const receipt = await runConsolidation({auth, now, config: cfg});
  assert.equal(receipt.outcome, 'completed');
  assert.equal(receipt.model, 'nvidia/nemotron-3-ultra-550b-a55b', 'the confirmed default model');
  assert.ok(receipt.proposals.length >= 1);
  assert.ok(receipt.rejected.length >= 1, 'the mixed-citation proposal with an invented ref was rejected');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].auth, 'Bearer ' + DUMMY_KEY, 'the key is sent only to the provider, in the header');
  assert.equal(sent[0].body.includes(DUMMY_KEY), false, 'the key is not in the request body');
  const stored = JSON.stringify(auth.store.get(RECEIPTS));
  assert.equal(stored.includes(DUMMY_KEY), false, 'the key is never stored');
  assert.equal(auth.store.get(USAGE).count, 1);
});

test('the daily allowance stops the fourth run before anything is sent', async () => {
  mode = 'good'; sent.length = 0;
  const auth = fakeAuth(seed());
  for (let i = 0; i < DAILY_LIMIT; i++) await runConsolidation({auth, now, config: cfg});
  assert.equal(sent.length, DAILY_LIMIT);
  await assert.rejects(() => runConsolidation({auth, now, config: cfg}), e => e.code === 'QUOTA');
  assert.equal(sent.length, DAILY_LIMIT, 'no fourth request was sent');
});

test('without a configured key nothing is sent and no allowance is used', async () => {
  sent.length = 0;
  const auth = fakeAuth(seed());
  const receipt = await runConsolidation({auth, now, config: null});
  assert.equal(receipt.outcome, 'not_configured');
  assert.equal(sent.length, 0);
  assert.equal(auth.store.get(USAGE), undefined);
});

test('no helper results means no request at all', async () => {
  sent.length = 0;
  const receipt = await runConsolidation({auth: fakeAuth({}), now, config: cfg});
  assert.equal(receipt.outcome, 'no_helper_results');
  assert.equal(sent.length, 0);
});

test('provider failures are recorded honestly and never echo the key', async () => {
  mode = '500';
  const auth500 = fakeAuth(seed());
  const failed = await runConsolidation({auth: auth500, now, config: cfg});
  assert.equal(failed.outcome, 'failed');
  assert.equal(JSON.stringify(failed).includes(DUMMY_KEY), false, 'the echoed key is redacted from the receipt');
  mode = '429';
  const limited = await runConsolidation({auth: fakeAuth(seed()), now, config: cfg});
  assert.equal(limited.outcome, 'quota_limited');
  mode = 'text';
  const text = await runConsolidation({auth: fakeAuth(seed()), now, config: cfg});
  assert.equal(text.outcome, 'completed');
  assert.equal(text.proposals.length, 0, 'an unparseable answer creates no proposals');
  mode = 'good';
});

test('a model refused at run time falls back to a working one; the retired Llama model is never requested', async () => {
  mode = 'retired'; sent.length = 0;
  const receipt = await runConsolidation({auth: fakeAuth(seed()), now, config: cfg});
  assert.equal(receipt.outcome, 'completed');
  assert.equal(receipt.model, 'nvidia/llama-3.1-nemotron-70b-instruct');
  assert.deepEqual(receipt.fallbackFrom, {model: 'nvidia/nemotron-3-ultra-550b-a55b', status: 410});
  assert.equal(sent.some(x => x.model === 'meta/llama-3.3-70b-instruct'), false, 'the retired model is not in the fallback sequence');
  mode = 'good';
});

test('a configured retired model is skipped without a request', async () => {
  mode = 'good'; sent.length = 0;
  const receipt = await runConsolidation({auth: fakeAuth(seed()), now, config: {...cfg, model: 'meta/llama-3.3-70b-instruct'}});
  assert.equal(receipt.outcome, 'completed');
  assert.equal(sent.length, 1);
  assert.notEqual(sent[0].model, 'meta/llama-3.3-70b-instruct');
});

test('consolidation turns reasoning off and uses a bounded token budget', async () => {
  mode = 'good'; sent.length = 0;
  const receipt = await runConsolidation({auth: fakeAuth(seed()), now, config: cfg});
  const body = JSON.parse(sent[0].body);
  assert.match(body.messages[0].content, /^detailed thinking off\. /);
  assert.equal(body.max_tokens, receipt.maxTokens);
  assert.ok(body.max_tokens >= 600 && body.max_tokens <= 2048);
  assert.equal(tokenBudget(0), 600); assert.equal(tokenBudget(1000), 2048);
});

test('an empty reasoning-only answer is a failed, incomplete run with no proposals and an honest message', async () => {
  mode = 'empty';
  const receipt = await runConsolidation({auth: fakeAuth(seed()), now, config: cfg});
  assert.equal(receipt.outcome, 'failed');
  assert.equal(receipt.incomplete, true);
  assert.equal(receipt.proposals.length, 0);
  assert.match(receipt.error, /NVIDIA responded \(HTTP 200\) but returned no visible text/);
  mode = 'good';
});

test('an answer cut off at the token limit is incomplete and proposes nothing', async () => {
  mode = 'truncated';
  const receipt = await runConsolidation({auth: fakeAuth(seed()), now, config: cfg});
  assert.equal(receipt.outcome, 'failed');
  assert.equal(receipt.incomplete, true);
  assert.equal(receipt.proposals.length, 0);
  assert.match(receipt.error, /stopped at the \d+-token limit/);
  mode = 'good';
});

test('a proposal that states a value its sources do not contain is rejected', async () => {
  mode = 'fabricated';
  const receipt = await runConsolidation({auth: fakeAuth(seed()), now, config: cfg});
  assert.equal(receipt.outcome, 'completed');
  assert.equal(receipt.proposals.length, 0);
  assert.match(receipt.rejected.join(' '), /value its sources do not contain \(98765\)/);
  mode = 'good';
});

test('JSON inside a sentence is accepted; proposals carry structured facts and sources from the inputs', async () => {
  mode = 'prose';
  const receipt = await runConsolidation({auth: fakeAuth(seed()), now, config: cfg});
  assert.equal(receipt.proposals.length, 1);
  const p = receipt.proposals[0];
  assert.equal(p.requiresOwnerApproval, true);
  assert.ok(p.sources.length >= 1 && p.sources.every(x => x.ref && x.source));
  assert.equal(p.facts.parcelId, p.parcelId);
  assert.ok(p.sources.every(x => x.source === 'validator' || x.source === 'official-gis-worker'), 'cited sources only');
  mode = 'good';
});

test('receipts are bounded and carry source references, not raw provider text', async () => {
  mode = 'good';
  const receipt = await runConsolidation({auth: fakeAuth(seed()), now, config: cfg});
  assert.ok(Array.isArray(receipt.inputs.refs) && receipt.inputs.refs.length <= 30);
  assert.equal(receipt.inputs.sources.validator, 1);
  assert.equal(receipt.inputs.sources.photon, 1);
  assert.ok(receipt.bytesSent > 0);
});

test.after(() => server.close());
