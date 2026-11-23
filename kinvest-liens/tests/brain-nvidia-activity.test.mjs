// The REAL owner activity function, fed stored NVIDIA receipts and agent state in an isolated store.
// Checks that NVIDIA events exist only for requests that were actually sent, and that every agent
// reports an explicit state.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {PUTNAM, putnamActivity} from '../../netlify/lib/brain-gis-putnam.mjs';

const source = fs.readFileSync('netlify/functions/owner-brain-activity.mjs', 'utf8');
const NOW = Date.parse('2026-11-23T20:00:00.000Z');
const ago = m => new Date(NOW - m * 60e3).toISOString();

async function run(store, {quota = {active: false, count: 0}} = {}) {
  const context = vm.createContext({Response, Request, URL, Date: class extends Date { constructor(...a) { if (a.length) super(...a); else super(NOW); } static now() { return NOW; } }, console, JSON, Math, Object, Array, String, Number, Set, Map, Promise, Error, RegExp, Buffer, Symbol, AbortSignal});
  const auth = new vm.SyntheticModule(['userFromCookie', 'kvGet', 'withBrainStore', 'isBrainPreview', 'readWayneGisQuota'], function () {
    this.setExport('userFromCookie', async () => ({owner: true}));
    this.setExport('kvGet', async k => structuredClone(store.get(k) ?? null));
    this.setExport('withBrainStore', fn => fn);
    this.setExport('isBrainPreview', () => true);
    this.setExport('readWayneGisQuota', async () => quota);
  }, {context});
  const ops = new vm.SyntheticModule(['countyOperation', 'operationCountyIds'], function () {
    this.setExport('countyOperation', () => ({mode: 'research-only'}));
    this.setExport('operationCountyIds', () => []);
  }, {context});
  const putnam = new vm.SyntheticModule(['putnamActivity'], function () { this.setExport('putnamActivity', putnamActivity); }, {context});
  const cp = new vm.SyntheticModule(['countyCheckpointKey'], function () { this.setExport('countyCheckpointKey', id => 'x-' + id); }, {context});
  const mod = new vm.SourceTextModule(source, {context});
  await mod.link(s => s.includes('brain-auth') ? auth : s.includes('brain-gis-putnam') ? putnam : s.includes('brain-gis-universal') ? ops : cp);
  await mod.evaluate();
  const res = await mod.namespace.default(new Request('https://preview.test/.netlify/functions/owner-brain-activity'));
  return {status: res.status, body: await res.json()};
}
const receipt = (id, outcome, extra = {}) => ({id, at: ago(id === 'a' ? 5 : 50), outcome, model: 'meta/llama-3.3-70b-instruct', durationMs: 1200,
  inputs: {count: 6, sources: {validator: 2, 'official-gis-worker': 3, photon: 1}, refs: []}, conflicts: [], proposals: [], rejected: [], ...extra});

test('a completed NVIDIA run shows a real transfer into NVIDIA and a result for owner review', async () => {
  const store = new Map([['brain-nvidia-consolidation-v1', {receipts: [receipt('a', 'completed',
    {conflicts: [{parcelId: '01002754', refs: ['H1'], kind: 'status_disagreement'}], proposals: [{parcelId: '01002754', refs: ['H1'], summary: 's'}]})]}]]);
  const {status, body} = await run(store);
  assert.equal(status, 200);
  const transfer = body.events.find(e => e.type === 'nvidia_transfer');
  assert.ok(transfer, 'a transfer event exists for a request that was sent');
  assert.equal(transfer.from, 'Helper agents'); assert.equal(transfer.to, 'NVIDIA'); assert.equal(transfer.count, 6);
  assert.match(transfer.message, /6 items/);
  const result = body.events.find(e => e.type === 'nvidia_result');
  assert.equal(result.status, 'warning', 'conflicts flagged');
  assert.match(result.message, /1 proposal\(s\) await owner approval/);
  assert.equal(body.agents.NVIDIA.state, 'completed');
});

test('a run that never sent a request produces no NVIDIA transfer', async () => {
  for (const outcome of ['not_configured', 'no_helper_results']) {
    const store = new Map([['brain-nvidia-consolidation-v1', {receipts: [receipt('a', outcome)]}]]);
    const {body} = await run(store);
    assert.equal(body.events.filter(e => e.type === 'nvidia_transfer').length, 0, outcome + ' has no transfer');
  }
});

test('a failed or quota-limited request is shown as an error, not as a completed transfer', async () => {
  const failed = await run(new Map([['brain-nvidia-consolidation-v1', {receipts: [receipt('a', 'failed', {error: 'NVIDIA said 500'})]}]]));
  const f = failed.body.events.find(e => e.type === 'nvidia_transfer');
  assert.equal(f.status, 'error'); assert.match(f.message, /failed/);
  assert.equal(failed.body.agents.NVIDIA.state, 'failed');
  const limited = await run(new Map([['brain-nvidia-consolidation-v1', {receipts: [receipt('a', 'quota_limited')]}]]));
  assert.equal(limited.body.agents.NVIDIA.state, 'quota_limited');
  assert.equal(limited.body.events.find(e => e.type === 'nvidia_transfer').status, 'error');
});

test('every agent reports an explicit state; Gemini, OpenAI and Groq are not part of the pipeline', async () => {
  const {body} = await run(new Map(), {quota: {active: true, count: 30}});
  const allowed = ['active', 'idle', 'completed', 'failed', 'quota_limited', 'not_connected'];
  for (const name of ['Official GIS', 'Photon', 'Geoapify', 'Mapping', 'NVIDIA', 'Gemini', 'OpenAI', 'Groq']) {
    assert.ok(allowed.includes(body.agents[name].state), name + ' has a valid state');
  }
  assert.equal(body.agents['Official GIS'].state, 'quota_limited', 'the shared GIS allowance is used up');
  assert.equal(body.agents.NVIDIA.state, 'idle', 'no consolidation run yet');
  assert.equal(body.agents.Gemini.state, 'not_connected');
});

test('an active Wayne batch is reported as active, and a finished one as completed', async () => {
  const active = await run(new Map([['owner-brain-wayne-worker-v1', {state: 'running', lockedUntil: new Date(NOW + 60e3).toISOString(), lastStarted: ago(1), recent: []}]]));
  assert.equal(active.body.agents['Official GIS'].state, 'active');
  const done = await run(new Map([['owner-brain-wayne-worker-v1', {state: 'idle', lastCompleted: ago(10), recent: []}]]));
  assert.equal(done.body.agents['Official GIS'].state, 'completed');
});
