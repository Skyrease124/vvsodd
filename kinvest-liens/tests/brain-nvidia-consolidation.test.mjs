// NVIDIA consolidation of real helper-agent results, tested against a LOCAL MOCK of the NVIDIA chat API.
// No request leaves the machine, no real key is used, and the dummy key below must never appear in
// any receipt, answer or error text.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';

const DUMMY_KEY = 'test-dummy-key-not-a-credential-0000';
let mode = 'good', listLightning = false;
const sent = [];
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', () => {
    if (req.method === 'GET' && req.url === '/v1/models') {
      res.writeHead(200, {'Content-Type': 'application/json'});
      return res.end(JSON.stringify({data: [{id: 'meta/llama-3.3-70b-instruct'}, {id: 'nvidia/llama-3.1-nemotron-70b-instruct'}, ...(listLightning ? [{id: 'nvidia/nemotron-3.5-lightning-30b-a3b'}] : [])]}));
    }
    const parsed = JSON.parse(body || '{}');
    sent.push({model: parsed.model, auth: req.headers.authorization, body});
    if (mode === 'fast-hang' && /lightning/.test(parsed.model || '')) { setTimeout(() => res.destroy(), 1500); return; }
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
const {deterministicConflicts, validateConsolidation, DAILY_LIMIT, RECEIPTS, USAGE} = lib;
// Hermetic by default: no registered parcel-match audit and no county worker is read unless a test supplies one.
const NONE = {matches: {}, countyIds: []};
const collectItems = (auth, options = NONE) => lib.collectItems(auth, options);
const runConsolidation = args => lib.runConsolidation({sources: NONE, ...args});
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

test('collectItems reads only stored helper output, keeps sources, and drops geocoder points outside the United States', async () => {
  const items = await collectItems(fakeAuth(seed()));
  assert.ok(items.length >= 5);
  assert.deepEqual([...new Set(items.map(i => i.source))].sort(), ['geoapify', 'official-gis-worker', 'photon', 'validator']);
  assert.equal(items.every(i => /^H\d+$/.test(i.ref)), true);
  const photon = items.filter(i => i.source === 'photon');
  const abroad = seed();
  abroad['owner-brain-photon-status-v1'].recent[0].candidates = [{lat: 48.85, lon: 2.35}];
  const outside = (await collectItems(fakeAuth(abroad))).filter(i => i.source === 'photon');
  assert.equal(outside.every(i => i.lat === null && i.lon === null), true, 'a point outside the United States is not sent as a location');
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
  assert.equal(sent.length, DAILY_LIMIT, 'no request beyond the daily limit was sent');
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
  assert.equal(tokenBudget(0), 600); assert.equal(tokenBudget(1000), 1200);
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

// ---- Nationwide: no state or county is named by the consolidation ----
const nationwide = () => ({
  'owner-brain-wayne-worker-v1': {recent: []},
  [LEDGER]: {entries: [
    {dataset: 'IA-scott', recordId: 's1', parcelId: 'C0050-21', decision: 'pending_owner_review', reviewedAt: ago(10), proposedPosition: {lat: 41.5521, lon: -90.6012}, evidenceUrl: 'https://services.arcgis.com/x/FeatureServer/3'},
    {dataset: 'NY-city-of-rochester', recordId: 'r1', parcelId: '120.74-2-13', decision: 'pending_owner_review', reviewedAt: ago(12), proposedPosition: {lat: 43.1566, lon: -77.6088}, evidenceUrl: 'https://maps.example.test/layer'},
    {dataset: 'IA-scott', recordId: 's2', parcelId: 'C0050-22', decision: 'rejected', reviewedAt: ago(14)}]},
  'owner-brain-photon-status-v1': {recent: [{dataset: 'IA-scott', parcelId: 'C0050-21', status: 'address_candidates_unverified', checkedAt: ago(8), candidates: [{lat: 41.5522, lon: -90.6011}]}]},
  'owner-brain-geoapify-status-v1': {recent: [{dataset: 'NY-city-of-rochester', parcelId: '120.74-2-13', status: 'address_candidates_unverified', checkedAt: ago(9), candidates: [{lat: 43.1567, lon: -77.6087}]}]},
});

test('Scott and Rochester helper results are collected with their dataset and keep their positions', async () => {
  const items = await collectItems(fakeAuth(nationwide()));
  assert.deepEqual([...new Set(items.map(i => i.dataset))].sort(), ['IA-scott', 'NY-city-of-rochester']);
  assert.equal(items.filter(i => i.source === 'validator').length, 2, 'validator entries of every dataset are read; rejected ones are not');
  const scott = items.find(i => i.source === 'photon');
  assert.equal(scott.lat, 41.5522, 'an Iowa candidate keeps its position');
  assert.equal(items.find(i => i.source === 'geoapify').lat, 43.1567, 'a New York candidate keeps its position');
});

test('the same parcel number in two datasets is two parcels: no conflict between them', async () => {
  const items = [
    {ref: 'H1', source: 'validator', dataset: 'IA-scott', parcelId: '1001', status: 'pending_owner_review', lat: 41.5, lon: -90.6},
    {ref: 'H2', source: 'official-gis-worker', dataset: 'MI-wayne', parcelId: '1001', status: 'needs_review', lat: 42.3, lon: -83.1}];
  assert.deepEqual(deterministicConflicts(items), []);
  const same = [{...items[0]}, {ref: 'H3', source: 'official-gis-worker', dataset: 'IA-scott', parcelId: '1001', status: 'needs_review'}];
  const found = deterministicConflicts(same);
  assert.equal(found.length, 1);
  assert.equal(found[0].dataset, 'IA-scott', 'a real conflict names its dataset');
});

test('a model answer must cite one dataset: mixed datasets are rejected, and a proposal carries its dataset', () => {
  const items = [
    {ref: 'H1', source: 'validator', dataset: 'IA-scott', parcelId: '1001', status: 'pending_owner_review'},
    {ref: 'H2', source: 'validator', dataset: 'NY-city-of-rochester', parcelId: '1001', status: 'pending_owner_review'}];
  const mixed = validateConsolidation(JSON.stringify({conflicts: [], proposals: [{parcelId: '1001', refs: ['H1', 'H2'], summary: 'Both match.'}]}), items);
  assert.equal(mixed.proposals.length, 0);
  assert.ok(mixed.rejected.some(r => /another parcel|do not cover/.test(r)));
  const one = validateConsolidation(JSON.stringify({conflicts: [], proposals: [{parcelId: '1001', refs: ['H1'], summary: 'Official polygon matches.'}]}), items);
  assert.equal(one.proposals.length, 1);
  assert.equal(one.proposals[0].dataset, 'IA-scott');
  assert.equal(one.proposals[0].facts.dataset, 'IA-scott');
  assert.equal(one.proposals[0].sources[0].dataset, 'IA-scott');
});

test('a run over Scott and Rochester results stores the datasets it covered in the receipt', async () => {
  mode = 'good';
  const auth = fakeAuth(nationwide());
  const receipt = await runConsolidation({auth, now, config: cfg});
  assert.equal(receipt.outcome, 'completed');
  assert.deepEqual(receipt.inputs.datasets, ['IA-scott', 'NY-city-of-rochester']);
  assert.ok(receipt.inputs.refs.every(r => r.dataset));
  assert.ok(receipt.proposals.every(p => ['IA-scott', 'NY-city-of-rochester'].includes(p.dataset)));
  assert.equal(sent.at(-1).body.includes('IA-scott'), true, 'the dataset is part of what NVIDIA is shown');
});

test('the consolidation names no state or county', async () => {
  const fs = await import('node:fs');
  const text = fs.readFileSync('netlify/lib/brain-nvidia.mjs', 'utf8');
  assert.equal(/MI_BOX|Michigan|inBox/.test(text), false);
  assert.equal((text.match(/MI-wayne/g) || []).length, 1, 'only the Wayne worker store names its own dataset');
});

// ---- Step 3: county worker results and parcel-match audits as stored inputs ----
const REGISTRY = (await import('../../netlify/lib/parcel-matches-registry.mjs')).MATCHES;

test('county worker evidence is an official item and skipped parcels are context only; the polygon is never an input', async () => {
  const store = {'brain-gis-operations-v1-CO-larimer': {
    evidence: {0: {parcelId: 'R0001', checkedAt: ago(30), geometry: [[1, 2], [3, 4]], objectId: 7, officialAddress: '1 Main St'}},
    review: {1: {parcelId: 'R0002', status: 'skipped', reason: 'Situs address mismatch', checkedAt: ago(20)}, 2: {parcelId: 'R0003', status: 'skipped', checkedAt: ago(10), resolvedAt: ago(5)}}}};
  const items = (await lib.collectItems(fakeAuth(store), {matches: {}, countyIds: ['CO-larimer']})).filter(i => i.source === 'county-worker');
  assert.equal(items.length, 2, 'a resolved skip is not reported again');
  const ev = items.find(i => i.status === 'official_evidence');
  assert.equal(ev.official, true); assert.equal(ev.dataset, 'CO-larimer'); assert.equal(ev.parcelId, 'R0001');
  assert.equal(JSON.stringify(items).includes('geometry'), false, 'no polygon is collected');
  assert.equal(JSON.stringify(items).includes('1 Main St'), false, 'no address text is collected');
  const skipped = items.find(i => i.parcelId === 'R0002');
  assert.notEqual(skipped.official, true);
  assert.equal(skipped.reason, 'Situs address mismatch');
});

test('parcel-match audits supply official matched records, those another helper also reported come first, at most eight', async () => {
  const seedScott = {'owner-brain-photon-status-v1': {recent: [{dataset: 'IA-scott', parcelId: 'J0029-04', status: 'address_candidates_unverified', checkedAt: ago(5), candidates: [{lat: 41.5169, lon: -90.6223}]}]}};
  const items = await lib.collectItems(fakeAuth(seedScott), {matches: REGISTRY, countyIds: []});
  const pm = items.filter(i => i.source === 'parcel-match');
  assert.ok(pm.length > 0 && pm.length <= 8);
  assert.ok(pm.every(i => i.official === true && i.status === 'matched' && /^https:\/\//.test(i.evidenceUrl)));
  assert.ok(pm.some(i => i.dataset === 'IA-scott' && i.parcelId === 'J0029-04'), 'the matched record that Photon also checked is included');
  assert.ok(pm.every(i => i.lat !== null), 'positions are kept server side for conflict checks');
  const conflicts = deterministicConflicts(items).filter(c => c.parcelId === 'J0029-04');
  assert.equal(conflicts.length, 0, 'Photon is about 20 m from the official point: no location conflict');
});

test('parcel-match positions are withheld from what NVIDIA is shown, and a number the model was not shown is rejected', () => {
  const items = [{ref: 'H1', source: 'parcel-match', dataset: 'IA-scott', parcelId: 'J0029-04', status: 'matched', official: true, lat: 41.1234567, lon: -90.7654321, checkedAt: ago(1)}];
  const shown = JSON.parse(lib.buildPrompt(items).user)[0];
  assert.equal(shown.lat, null); assert.equal(shown.lon, null);
  assert.equal(lib.buildPrompt(items).user.includes('41.1234'), false);
  const out = validateConsolidation(JSON.stringify({conflicts: [], proposals: [{parcelId: 'J0029-04', refs: ['H1'], summary: 'Official match at 41.1234567.'}]}), items);
  assert.equal(out.proposals.length, 0);
  assert.ok(out.rejected.some(r => /do not contain/.test(r)));
  const ok = validateConsolidation(JSON.stringify({conflicts: [], proposals: [{parcelId: 'J0029-04', refs: ['H1'], summary: 'Official parcel record agrees.'}]}), items);
  assert.equal(ok.proposals.length, 1, 'a parcel-match record alone is an official source');
  assert.equal(ok.proposals[0].facts.location.lat, 41.1234567, 'the stored official position comes from the record, not the model');
});

test('a proposal needs an official source: skipped county worker parcels and geocoder candidates are not enough', () => {
  const items = [
    {ref: 'H1', source: 'county-worker', dataset: 'CO-larimer', parcelId: 'R0002', status: 'skipped', reason: 'Situs address mismatch'},
    {ref: 'H2', source: 'photon', dataset: 'CO-larimer', parcelId: 'R0002', status: 'address_candidates_unverified', unverified: true},
    {ref: 'H3', source: 'county-worker', dataset: 'CO-larimer', parcelId: 'R0001', status: 'official_evidence', official: true}];
  const weak = validateConsolidation(JSON.stringify({conflicts: [], proposals: [{parcelId: 'R0002', refs: ['H1', 'H2'], summary: 'Looks fine.'}]}), items);
  assert.equal(weak.proposals.length, 0);
  assert.ok(weak.rejected.includes('proposal has no official or validator source'));
  const strong = validateConsolidation(JSON.stringify({conflicts: [], proposals: [{parcelId: 'R0001', refs: ['H3'], summary: 'Official evidence saved.'}]}), items);
  assert.equal(strong.proposals.length, 1);
});

test('an official match and an official worker that disagree on the same parcel are flagged without the model', () => {
  const items = [
    {ref: 'H1', source: 'parcel-match', dataset: 'MI-wayne', parcelId: '01002754', status: 'matched', official: true, lat: 42.3, lon: -83.1},
    {ref: 'H2', source: 'official-gis-worker', dataset: 'MI-wayne', parcelId: '01002754', status: 'needs_review'}];
  const found = deterministicConflicts(items);
  assert.equal(found.length, 1); assert.equal(found[0].kind, 'status_disagreement'); assert.equal(found[0].dataset, 'MI-wayne');
});

test('a run includes the new sources in the receipt, and the matched position never leaves the server', async () => {
  mode = 'good';
  const auth = fakeAuth({...seed(), 'brain-gis-operations-v1-CO-larimer': {evidence: {0: {parcelId: 'R0001', checkedAt: ago(3)}}}});
  const receipt = await lib.runConsolidation({auth, now, config: cfg, sources: {matches: REGISTRY, countyIds: ['CO-larimer']}});
  assert.equal(receipt.outcome, 'completed');
  assert.ok(receipt.inputs.sources['parcel-match'] > 0 && receipt.inputs.sources['county-worker'] === 1);
  const body = sent.at(-1).body;
  const matched = REGISTRY['IA-scott'].records.filter(r => r.status === 'matched');
  assert.ok(matched.length > 0);
  for (const r of matched) assert.equal(body.includes(String(r.point[1])), false, 'no official matched latitude is in the request');
  assert.ok(receipt.inputs.datasets.includes('IA-scott') && receipt.inputs.datasets.includes('CO-larimer'));
});

// ---- Step 4: Groq triage as context only ----
const triageQueue = () => ({'owner-brain-scanner-v1': {status: 'idle', queue: [
  {dataset: 'IA-scott', recordId: 'q1', parcelId: 'C0050-21', triage: {status: 'complete', summary: 'Check the situs address on the county page; reference 99887.', checks: ['a'], priority: 'high', createdAt: ago(7)}},
  {dataset: 'NY-city-of-rochester', recordId: 'q2', parcelId: '120.74-2-13', triage: {status: 'complete', summary: 'Possible duplicate.', createdAt: ago(9)}},
  {dataset: 'IA-scott', recordId: 'q3', parcelId: 'C0050-22', triage: {status: 'pending'}},
  {dataset: 'IA-scott', recordId: 'q4', parcelId: 'C0050-23'}]}});

test('Groq triage is collected as an unverified, non-official item without its checklist', async () => {
  const items = (await collectItems(fakeAuth(triageQueue()))).filter(i => i.source === 'groq');
  assert.equal(items.length, 2, 'only completed triage is read');
  assert.ok(items.every(i => i.unverified === true && i.official !== true && i.status === 'triaged_unverified' && i.dataset && i.parcelId));
  assert.equal(JSON.stringify(items).includes('checks'), false, 'the checklist is not collected');
  assert.equal(items.some(i => i.lat != null), false, 'no position');
});

test('Groq alone can never back a proposal, even with an official item about another parcel', () => {
  const items = [
    {ref: 'H1', source: 'groq', dataset: 'IA-scott', parcelId: 'C0050-21', status: 'triaged_unverified', reason: 'Check the situs address.', unverified: true},
    {ref: 'H2', source: 'validator', dataset: 'IA-scott', parcelId: 'C0050-99', status: 'pending_owner_review'}];
  const alone = validateConsolidation(JSON.stringify({conflicts: [], proposals: [{parcelId: 'C0050-21', refs: ['H1'], summary: 'Groq says it is fine.'}]}), items);
  assert.equal(alone.proposals.length, 0);
  assert.ok(alone.rejected.includes('proposal has no official or validator source'));
  const wrong = validateConsolidation(JSON.stringify({conflicts: [], proposals: [{parcelId: 'C0050-21', refs: ['H1', 'H2'], summary: 'Mixed.'}]}), items);
  assert.equal(wrong.proposals.length, 0, 'a different parcel cannot lend its official status');
});

test('Groq text is not a source of numbers, and the prompt says it is context only', () => {
  const items = [
    {ref: 'H1', source: 'groq', dataset: 'IA-scott', parcelId: 'C0050-21', status: 'triaged_unverified', reason: 'Reference 99887 on the county page.', unverified: true},
    {ref: 'H2', source: 'validator', dataset: 'IA-scott', parcelId: 'C0050-21', status: 'pending_owner_review'}];
  const out = validateConsolidation(JSON.stringify({conflicts: [], proposals: [{parcelId: 'C0050-21', refs: ['H1', 'H2'], summary: 'Official match; reference 99887.'}]}), items);
  assert.equal(out.proposals.length, 0);
  assert.ok(out.rejected.some(r => /do not contain/.test(r)));
  assert.match(lib.buildPrompt(items).system, /Groq items are unverified AI triage notes: context only, never evidence/);
  const ok = validateConsolidation(JSON.stringify({conflicts: [], proposals: [{parcelId: 'C0050-21', refs: ['H1', 'H2'], summary: 'Official match supports an update.'}]}), items);
  assert.equal(ok.proposals.length, 1, 'with an official item for the same parcel the proposal stands');
  assert.deepEqual(ok.proposals[0].sources.map(x => x.source), ['groq', 'validator'], 'Groq is listed as a source with its own label');
});

test('a run reads Groq triage as context and records it in the receipt', async () => {
  mode = 'good';
  const receipt = await runConsolidation({auth: fakeAuth({...seed(), ...triageQueue()}), now, config: cfg});
  assert.equal(receipt.outcome, 'completed');
  assert.equal(receipt.inputs.sources.groq, 2);
  assert.match(sent.at(-1).body, /triaged_unverified/);
  assert.equal(sent.at(-1).body.includes('"checks"'), false);
});

// ---- Step 6: Gemini document readings, owner verified, context only ----
const gem = (over = {}) => ({id: 'g1', verified: true, decision: 'verified', reviewedAt: ago(5), dataset: 'IA-scott', sourceUrl: 'https://example.gov/county/list.pdf',
  facts: [{field: 'parcelId', value: 'C0050-21', quote: 'Parcel C0050-21'}, {field: 'amount', value: '$1,234.56', quote: 'Amount $1,234.56'}, {field: 'documentTitle', value: 'Tax list', quote: 'Tax list'}], ...over});
const gemStore = (...r) => ({'brain-helper-results-v1-gemini': {version: 1, results: r}});
const gemItems = async (...r) => (await collectItems(fakeAuth(gemStore(...r)))).filter(i => i.source === 'gemini-document');

test('a verified Gemini reading becomes one non-official item with its source link and exact values', async () => {
  const [it] = await gemItems(gem());
  assert.equal(it.dataset, 'IA-scott'); assert.equal(it.parcelId, 'C0050-21');
  assert.equal(it.evidenceUrl, 'https://example.gov/county/list.pdf');
  assert.deepEqual(it.facts, {amount: '$1,234.56'}, 'the title is not sent and quotes are not collected');
  assert.equal(it.official, false); assert.match(it.ref, /^H\d+$/);
});
test('unverified, rejected, link-less, dataset-less, tampered or multi-parcel readings are never collected', async () => {
  assert.equal((await gemItems(gem({verified: false, decision: null}), gem({decision: 'rejected', verified: false}))).length, 0);
  assert.equal((await gemItems(gem({sourceUrl: 'http://example.gov/x'}), gem({sourceUrl: ''}), gem({dataset: 'Scott'}), gem({dataset: undefined}))).length, 0);
  assert.equal((await gemItems(gem({facts: [{field: 'parcelId', value: 'C0050-21', quote: 'Parcel C0050-99'}]}))).length, 0, 'value not inside its quote');
  assert.equal((await gemItems(gem({facts: [{field: 'amount', value: '$1.00', quote: '$1.00'}]}))).length, 0, 'no parcel');
  assert.equal((await gemItems(gem({facts: [{field: 'parcelId', value: 'C0050-21', quote: 'C0050-21'}, {field: 'parcelId', value: 'C0050-22', quote: 'C0050-22'}]}))).length, 0, 'two parcels cannot be tied to one record');
  assert.equal((await gemItems(gem({facts: [{field: 'parcelId', value: 'C0050-21', quote: 'C0050-21'}, {field: 'amount', value: 'lots', quote: 'lots'}]})))[0].facts.amount, undefined, 'a bad format is dropped');
});
test('Gemini readings are capped and can never back a proposal alone', async () => {
  const many = Array.from({length: 7}, (_, i) => gem({id: 'g' + i, reviewedAt: ago(i + 1), facts: [{field: 'parcelId', value: 'C1-' + i, quote: 'C1-' + i}]}));
  assert.equal((await gemItems(...many)).length, 4);
  const items = [{ref: 'H1', source: 'gemini-document', dataset: 'IA-scott', parcelId: 'C0050-21', status: 'owner_verified_reading', facts: {amount: '$1,234.56'}, official: false, unverified: false}];
  const out = validateConsolidation(JSON.stringify({conflicts: [], proposals: [{parcelId: 'C0050-21', refs: ['H1'], summary: 'Amount is $1,234.56.'}]}), items);
  assert.equal(out.proposals.length, 0); assert.ok(out.rejected.includes('proposal has no official or validator source'));
  assert.match(lib.buildPrompt(items).system, /gemini-document items are readings .* never official/);
});
test('a run reads the verified reading and records it in the receipt', async () => {
  mode = 'good';
  const receipt = await runConsolidation({auth: fakeAuth({...seed(), ...gemStore(gem())}), now, config: cfg});
  assert.equal(receipt.outcome, 'completed'); assert.equal(receipt.inputs.sources['gemini-document'], 1);
  assert.match(sent.at(-1).body, /owner_verified_reading/);
  assert.equal(sent.at(-1).body.includes('Parcel C0050-21'), false, 'quotes are not sent');
});

// ---- A smaller request: at most 24 helper results, official first ----
test('a run sends at most 24 helper results and keeps official ones ahead of context and candidates', async () => {
  const ledger = Array.from({length: 30}, (_, i) => ({caseKey: 'k' + i, dataset: 'MI-wayne', recordId: 'R' + i, parcelId: '0100' + (3000 + i), decision: 'pending_owner_review', reviewedBy: 'v', reviewedAt: ago(100 + i), proposedPosition: {lat: 42.3, lon: -83.1}}));
  const photon = {results: undefined};
  const queue = Array.from({length: 6}, (_, i) => ({dataset: 'IA-scott', recordId: 'q' + i, parcelId: 'C' + i, triage: {status: 'complete', summary: 's' + i, createdAt: ago(1 + i)}}));
  const items = await collectItems(fakeAuth({...seed(), [LEDGER]: {entries: ledger}, 'owner-brain-scanner-v1': {queue}}));
  assert.equal(items.length, 24, 'capped at 24 (more were available)');
  assert.deepEqual(items.map(i => i.ref), items.map((_, i) => 'H' + (i + 1)));
  const flags = items.map(i => (i.source === 'validator' || i.source === 'official-gis-worker' || i.official === true));
  assert.equal(flags.join(',').includes('false,true'), false, 'no context item sits ahead of an official one');
});
test('a timed out request is reported with the model, the number of results and no invented answer', () => {
  const s = fs.readFileSync(new URL('../../netlify/lib/brain-nvidia.mjs', import.meta.url), 'utf8');
  assert.match(s, /NVIDIA did not answer in time \(/);
  const l = fs.readFileSync(new URL('../../netlify/lib/llm.mjs', import.meta.url), 'utf8');
  assert.match(l, /e\.model = model/);
  assert.equal(lib.DAILY_LIMIT, 10);
});

test('the prompt asks for a short answer: at most 5 conflicts and 5 proposals of 20 words, compact JSON', () => {
  const {system} = lib.buildPrompt([{ref: 'H1', source: 'validator', dataset: 'IA-scott', parcelId: 'P1', status: 'pending_owner_review'}]);
  assert.match(system, /at most 5 conflicts and at most 5 proposals/); assert.match(system, /at most 20 words/); assert.match(system, /compact JSON/);
  assert.equal(lib.tokenBudget(24), 1200, 'the output cap stays inside the function time limit');
});

// ---- Fast model first, then the default if time remains ----
const FAST = 'nvidia/nemotron-3.5-lightning-30b-a3b';
async function withFast(timing, fn) {
  const old = {...lib.TIMING}; process.env.NVIDIA_FAST_MODEL = FAST; Object.assign(lib.TIMING, timing);
  try { await fn(); } finally { delete process.env.NVIDIA_FAST_MODEL; Object.assign(lib.TIMING, old); }
}
test('a fast model goes first and the receipt names the models tried', async () => {
  await withFast({}, async () => {
    mode = 'good'; sent.length = 0;
    const receipt = await runConsolidation({auth: fakeAuth(seed()), now, config: cfg});
    assert.equal(receipt.outcome, 'completed'); assert.equal(receipt.model, FAST); assert.deepEqual(receipt.tried, [FAST]);
    assert.equal(sent[0].model, FAST);
  });
});
test('if the fast model does not answer in time the default is tried with the time left, in the same run', async () => {
  await withFast({budgetMs: 4000, fastMs: 300, minRetryMs: 500}, async () => {
    mode = 'fast-hang'; sent.length = 0;
    const auth = fakeAuth(seed()), before = (await auth.kvGet(USAGE))?.count || 0;
    const receipt = await runConsolidation({auth, now, config: cfg});
    assert.equal(receipt.outcome, 'completed'); assert.notEqual(receipt.model, FAST); assert.deepEqual(receipt.tried, [FAST, receipt.model]);
    assert.equal(receipt.attempts[0].ok, false); assert.match(receipt.attempts[0].reason, /no answer in/); assert.equal(receipt.attempts[1].ok, true);
    assert.equal(((await auth.kvGet(USAGE))?.count || 0) - before, 1, 'one run is counted, not one per model');
  });
});
test('with too little time left there is no second attempt, and the failure names the model that was tried', async () => {
  await withFast({budgetMs: 400, fastMs: 300, minRetryMs: 200}, async () => {
    mode = 'fast-hang'; sent.length = 0;
    const receipt = await runConsolidation({auth: fakeAuth(seed()), now, config: cfg});
    assert.equal(receipt.outcome, 'failed'); assert.deepEqual(receipt.tried, [FAST]); assert.equal(receipt.attempts.length, 1); assert.match(receipt.error, /did not answer in time \(nvidia\/nemotron-3\.5-lightning/);
    assert.equal(sent.length, 1);
  });
});
test('a model the owner saved always wins over the fast model', async () => {
  await withFast({}, async () => {
    mode = 'good'; sent.length = 0;
    const OWN = 'nvidia/llama-3.1-nemotron-70b-instruct';
    const receipt = await runConsolidation({auth: fakeAuth(seed()), now, config: {...cfg, model: OWN}});
    assert.equal(receipt.model, OWN); assert.equal(sent[0].model, OWN); assert.equal(sent.some(x => x.model === FAST), false);
  });
});
test('the fast model is found from the free models listing, and is null when none is listed', async () => {
  delete process.env.NVIDIA_FAST_MODEL;
  listLightning = true; const found = await (await import('../../netlify/lib/llm.mjs?found')).fastModel(DUMMY_KEY);
  listLightning = false; const none = await (await import('../../netlify/lib/llm.mjs?none')).fastModel(DUMMY_KEY);
  assert.equal(found, FAST); assert.equal(none, null);
});

test('the cap keeps the parcels several sources reported on together, so a disagreement between them survives', async () => {
  const others = n => Array.from({length: n}, (_, i) => '0200' + (1000 + i));
  const row = (parcelId, minutes, extra = {}) => ({parcelId, status: 'published', checkedAt: ago(minutes), ...extra});
  const store = {
    'owner-brain-wayne-worker-v1': {recent: [...others(14).map((p, i) => row(p, 1 + i % 4)), row('01002754', 30, {status: 'needs_review'})]},
    [LEDGER]: {entries: [{dataset: 'MI-wayne', recordId: 'old', parcelId: '01002754', decision: 'pending_owner_review', reviewedBy: 'v', reviewedAt: ago(500), proposedPosition: {lat: 42.3005, lon: -83.0995}},
      ...others(14).map((p, i) => ({dataset: 'MI-wayne', recordId: 'n' + i, parcelId: p, decision: 'pending_owner_review', reviewedBy: 'v', reviewedAt: ago(1 + i % 4), proposedPosition: {lat: 42.3, lon: -83.1}}))]},
    'owner-brain-photon-status-v1': {recent: [...others(9).map((p, i) => row(p, 2 + i, {status: 'address_candidates_unverified', candidates: [{lat: 42.4, lon: -83.2}]})), row('01002754', 20, {status: 'address_candidates_unverified', candidates: [{lat: 42.3006, lon: -83.0994}]})]},
    'owner-brain-geoapify-status-v1': {recent: [...others(9).map((p, i) => row(p, 2 + i, {status: 'address_candidates_unverified', candidates: [{lat: 42.4, lon: -83.2}]})), row('01002754', 15, {status: 'address_candidates_unverified', candidates: [{lat: 42.5, lon: -83.1}]})]}};
  const items = await collectItems(fakeAuth(store));
  assert.equal(items.length, 24, 'more than 24 were available');
  const pair = items.filter(i => i.parcelId === '01002754');
  assert.ok(new Set(pair.map(i => i.source)).size >= 3, 'the parcel several sources reported on is kept together even though its newest result is old');
  assert.ok(deterministicConflicts(items).some(c => c.parcelId === '01002754'), 'and its disagreement is still found');
});
