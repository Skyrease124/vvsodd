// Repo test for the NVIDIA client (netlify/lib/llm.mjs) and the live-check description, against a local mock server.
// Reproduces the preview failure of 2026-11-24 00:56 UTC: the configured model is refused (404), a fallback reasoning
// model answers HTTP 200 with no visible text, and our backend labelled it 502. No real NVIDIA request is made.
// Run from the repo root: node kinvest-liens/tests/nvidia-client-errors.test.mjs
import http from 'node:http';
import test from 'node:test';
import assert from 'node:assert/strict';

const KEY = 'test-dummy-key-not-a-credential-0000';
let scenario = 'reasoning-only';
const seen = [];
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', () => {
    const send = (status, obj) => { res.writeHead(status, {'Content-Type': 'application/json'}); res.end(JSON.stringify(obj)); };
    if (req.url.endsWith('/models')) return send(200, {data: [{id: 'nvidia/nemotron-3-ultra-550b-a55b'}]});
    const p = JSON.parse(body); seen.push(p);
    if (scenario === 'throttled') return send(429, {error: 'Too many requests'});
    if (p.model === 'retired/model') return send(404, {error: 'model not found'});
    if (scenario === 'reasoning-only') return send(200, {choices: [{finish_reason: 'length', message: {content: null, reasoning_content: 'The user wants'}}]});
    return send(200, {choices: [{finish_reason: 'stop', message: {content: '<think>short</think>OK'}}]});
  });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
process.env.NVIDIA_API_URL = 'http://127.0.0.1:' + server.address().port + '/v1/chat/completions';
const {complete} = await import('../../netlify/lib/llm.mjs');
const {describeNvidia} = await import('../../netlify/lib/live-checks.mjs');
test.after(() => server.close());

test('the preview failure: NVIDIA answered HTTP 200 with reasoning only; our backend produced the 502', async () => {
  scenario = 'reasoning-only'; seen.length = 0;
  const error = await complete({key: KEY, model: 'retired/model'}, 'sys', 'Ping.', {maxTokens: 8}).then(() => null, e => e);
  assert.equal(error.code, 'EMPTY_ANSWER');
  assert.equal(error.status, 502, 'the 502 is our own label');
  assert.equal(error.upstreamStatus, 200, 'NVIDIA itself answered 200');
  assert.equal(error.model, 'nvidia/nemotron-3-ultra-550b-a55b');
  assert.deepEqual(error.fallbackFrom, {model: 'retired/model', status: 404});
  assert.match(error.detail, /finish: length, reasoning only/);
  const d = describeNvidia(null, error);
  assert.equal(d.outcome, 'failed');
  assert.match(d.detail, /NVIDIA responded \(HTTP 200\) but returned no visible text/);
  assert.match(d.detail, /retired\/model was refused by NVIDIA with HTTP 404/);
  assert.equal(d.detail.includes(KEY), false);
});

test('a visible answer succeeds and reports the fallback that was used', async () => {
  scenario = 'answer'; seen.length = 0;
  const out = await complete({key: KEY, model: 'retired/model'}, 'detailed thinking off. Reply with the single word OK.', 'Ping.', {maxTokens: 256});
  assert.equal(out.text, 'OK');
  assert.deepEqual(out.fallbackFrom, {model: 'retired/model', status: 404});
  assert.equal(seen.at(-1).max_tokens, 256);
  const d = describeNvidia(out, null);
  assert.equal(d.outcome, 'ok');
  assert.match(d.detail, /answered with model nvidia\/nemotron-3-ultra-550b-a55b/);
});

test('a real upstream error keeps NVIDIA\'s own status, separate from our label', async () => {
  scenario = 'throttled';
  const error = await complete({key: KEY, model: 'nvidia/nemotron-3-ultra-550b-a55b'}, 's', 'u').then(() => null, e => e);
  assert.equal(error.code, 'UPSTREAM');
  assert.equal(error.upstreamStatus, 429);
  assert.equal(describeNvidia(null, error).detail, 'NVIDIA returned HTTP 429.');
});

test('a timeout and a backend failure are described as such, never as an NVIDIA response', () => {
  assert.match(describeNvidia(null, Object.assign(new Error('x'), {name: 'AbortError'})).detail, /did not answer before the time limit/);
  assert.match(describeNvidia(null, new TypeError('cfg is null')).detail, /did not reach NVIDIA or failed in our backend/);
});

test('requests never carry the key in the body', () => {
  assert.equal(JSON.stringify(seen).includes(KEY), false);
});
