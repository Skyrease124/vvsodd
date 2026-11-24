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

test('Gemini and OpenAI report a key check only; Groq reports its standalone triage honestly', async () => {
  const idle = (await run(new Map())).body.agents;
  assert.equal(idle.Gemini.state, 'not_connected'); assert.match(idle.Gemini.detail, /Key check only/);
  assert.equal(idle.OpenAI.state, 'not_connected'); assert.match(idle.OpenAI.detail, /no results reach NVIDIA/);
  assert.equal(idle.Groq.state, 'idle'); assert.match(idle.Groq.detail, /Not sent to NVIDIA/i);
  const queue = [{triage: {status: 'complete', createdAt: ago(40)}}, {triage: {status: 'complete', createdAt: ago(10)}}, {triage: {status: 'pending'}}, {}];
  const done = (await run(new Map([['owner-brain-scanner-v1', {queue}]]))).body.agents;
  assert.equal(done.Groq.state, 'completed');
  assert.match(done.Groq.detail, /2 unverified triage result\(s\) stored/);
  assert.match(done.Groq.detail, /not sent to NVIDIA/i);
  assert.equal(done.Groq.lastAt, ago(10));
  assert.equal(done.Gemini.state, 'not_connected', 'stored Groq results do not connect the other helpers');
});

test('only a real NVIDIA request is shown as going to NVIDIA; other events say where the result was stored', async () => {
  const store = new Map([
    ['owner-brain-wayne-worker-v1', {recent: [{parcelId: '01002754', status: 'needs_review', checkedAt: ago(30)}], lastPilot: {at: ago(25), state: 'complete', cursor: 5}}],
    ['owner-brain-photon-status-v1', {lastCompleted: ago(20), state: 'completed', checked: 5}],
    ['owner-brain-geoapify-status-v1', {lastCompleted: ago(19), state: 'completed', checked: 4}],
    ['owner-brain-approvals-v1', {entries: [{caseKey: 'k1', decision: 'approved_for_staging', reviewedAt: ago(15), dataset: 'IA-scott', parcelId: 'C0050-21'}]}],
    ['brain-nvidia-consolidation-v1', {receipts: [receipt('a', 'completed')]}]]);
  const {body} = await run(store);
  const toNvidia = body.events.filter(e => e.to === 'NVIDIA');
  assert.deepEqual([...new Set(toNvidia.map(e => e.type))], ['nvidia_transfer'], 'nothing but a sent request is labelled as going to NVIDIA');
  for (const type of ['verification_result', 'run_complete', 'owner_review']) {
    const e = body.events.find(x => x.type === type);
    assert.ok(e, type + ' is still in the feed');
    assert.notEqual(e.to, 'NVIDIA', type);
  }
  assert.equal(body.events.find(x => x.type === 'owner_review').to, 'Approval ledger');
  assert.equal(body.events.find(x => x.type === 'verification_result').to, 'Stored result');
});

test('NVIDIA events name the datasets the receipt covered, not a fixed county', async () => {
  const county = async inputs => (await run(new Map([['brain-nvidia-consolidation-v1', {receipts: [receipt('a', 'completed', {inputs: {count: 3, sources: {validator: 3}, refs: [], ...inputs}})]}]]))).body.events.find(e => e.type === 'nvidia_transfer').county;
  assert.equal(await county({datasets: ['IA-scott']}), 'IA-scott');
  assert.equal(await county({datasets: ['IA-scott', 'NY-city-of-rochester']}), 'Multiple counties');
  assert.equal(await county({}), 'MI-wayne', 'receipts from before the datasets field were Wayne only');
});
