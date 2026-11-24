// Browser test of the owner activity page and approval panels, fed by the REAL owner-brain-activity
// function over isolated synthetic data. Run after the static server is up (see validate-map-polish.yml):
//   node --experimental-vm-modules kinvest-liens/tests/brain-activity-page.browser.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {PUTNAM, putnamActivity} from '../../netlify/lib/brain-gis-putnam.mjs';
import {geminiCaps, geminiUsedToday} from '../../netlify/lib/gemini-limits.mjs';
import {cloudflareCaps, cloudflareUsedToday} from '../../netlify/lib/cloudflare-limits.mjs';
const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const NOW = Date.parse('2026-11-23T20:00:00.000Z');
const ago = m => new Date(NOW - m * 60e3).toISOString();
const DUMMY_KEY = 'test-dummy-key-not-a-credential-0000';

async function activity(store, quota = {active: false, count: 0}) {
  const context = vm.createContext({Response, Request, URL, console, JSON, Math, Object, Array, String, Number, Set, Map, Promise, Error, RegExp, Buffer, Symbol, AbortSignal,
    Date: class extends Date { constructor(...a) { if (a.length) super(...a); else super(NOW); } static now() { return NOW; } }});
  const auth = new vm.SyntheticModule(['userFromCookie', 'kvGet', 'withBrainStore', 'isBrainPreview', 'readWayneGisQuota'], function () {
    this.setExport('userFromCookie', async () => ({owner: true}));
    this.setExport('kvGet', async k => structuredClone(store.get(k) ?? null));
    this.setExport('withBrainStore', fn => fn); this.setExport('isBrainPreview', () => true);
    this.setExport('readWayneGisQuota', async () => quota);
  }, {context});
  const ops = new vm.SyntheticModule(['countyOperation', 'operationCountyIds'], function () {
    this.setExport('countyOperation', () => ({mode: 'research-only'})); this.setExport('operationCountyIds', () => []);
  }, {context});
  const putnam = new vm.SyntheticModule(['putnamActivity'], function () { this.setExport('putnamActivity', putnamActivity); }, {context});
  const cp = new vm.SyntheticModule(['countyCheckpointKey'], function () { this.setExport('countyCheckpointKey', id => 'x-' + id); }, {context});
  const mod = new vm.SourceTextModule(fs.readFileSync('netlify/functions/owner-brain-activity.mjs', 'utf8'), {context});
  const rl = new vm.SyntheticModule(['peek', 'hit'], function () { this.setExport('peek', async () => ({used: 0})); this.setExport('hit', async () => ({ok: true})); }, {context});
  const gl = new vm.SyntheticModule(['geminiCaps', 'geminiUsedToday'], function () { this.setExport('geminiCaps', geminiCaps); this.setExport('geminiUsedToday', geminiUsedToday); }, {context});
  const cl = new vm.SyntheticModule(['cloudflareCaps', 'cloudflareUsedToday'], function () { this.setExport('cloudflareCaps', cloudflareCaps); this.setExport('cloudflareUsedToday', cloudflareUsedToday); }, {context});
  await mod.link(s => s.includes('ratelimit') ? rl : s.includes('cloudflare-limits') ? cl : s.includes('gemini-limits') ? gl : s.includes('brain-auth') ? auth : s.includes('brain-gis-putnam') ? putnam : s.includes('brain-gis-universal') ? ops : cp);
  await mod.evaluate();
  return (await mod.namespace.default(new Request('https://preview.test/.netlify/functions/owner-brain-activity'))).json();
}
const worker = {cursor: 14, runs: 3, verified: 6, published: 4, needsReview: 1, failures: 0, state: 'idle', lastCompleted: ago(9),
  recent: [{parcelId: '01002754', status: 'published', checkedAt: ago(9), gisTrace: [{stage: 'lookup', status: 'ok', durationMs: 412, at: ago(9)}]},
    {parcelId: '01002755', status: 'needs_review', checkedAt: ago(12), reason: 'Multiple official parcel matches', failedStage: 'parcel_verification'}],
  progress: {total: 100, pending: 86, skipped: 2, verifiedPercent: 6, processingPercent: 14}};
const receipt = (id, outcome, extra = {}) => ({id, at: ago(id === 'n1' ? 6 : 40), outcome, model: 'meta/llama-3.3-70b-instruct', durationMs: 900,
  inputs: {count: 6, sources: {validator: 2, 'official-gis-worker': 3, photon: 1}, refs: []}, conflicts: [], proposals: [], rejected: [], ...extra});
const baseStore = () => new Map([
  ['owner-brain-wayne-worker-v1', structuredClone(worker)],
  ['brain-map-history-v1', {entries: [{dataset: 'MI-wayne', recordId: 'TEST-A', parcelId: '99000001', action: 'published', at: ago(9)}]}],
  ['owner-brain-approvals-v1', {entries: [{caseKey: 'case-owner-1', dataset: 'MI-wayne', recordId: 'TEST-A', parcelId: '99000001', decision: 'approved_for_staging', reviewedAt: ago(30), reviewedBy: 'owner', sourceProvider: 'Official county GIS'}]}],
  ['brain-map-county-v1-MI-wayne', {version: 3, records: {}}],
]);
// Snapshot 1: existing history with a completed NVIDIA run. Snapshot 2: three genuinely new records appear on refresh.
const first = baseStore(); first.set('brain-nvidia-consolidation-v1', {receipts: [receipt('n1', 'completed', {proposals: [{parcelId: '99000001', refs: ['H1'], summary: 's'}]})]});
const liveJson = JSON.stringify(await activity(first, {active: true, count: 12}));
const second = baseStore();
const w2 = structuredClone(worker);
w2.recent = [{parcelId: '99000010', status: 'published', checkedAt: ago(-2)}, {parcelId: '99000011', status: 'retry_later', checkedAt: ago(-3), reason: 'HTTP 503 from GIS', failedStage: 'lookup', nextRetryAt: ago(-33), retryAttempt: 1, retryMaximum: 3}, ...worker.recent];
second.set('owner-brain-wayne-worker-v1', w2);
second.set('brain-map-history-v1', {entries: [{dataset: 'MI-wayne', recordId: 'TEST-D', parcelId: '99000009', action: 'published', at: ago(-2)}, ...second.get('brain-map-history-v1').entries]});
second.set('brain-nvidia-consolidation-v1', {receipts: [receipt('n2', 'completed', {inputs: {count: 6, sources: {validator: 2, 'official-gis-worker': 3, photon: 1}, refs: []}, conflicts: [{parcelId: '99000010', refs: ['H1'], kind: 'status_disagreement', detail: 'x'}]}), ...first.get('brain-nvidia-consolidation-v1').receipts]});
const refreshJson = JSON.stringify(await activity(second, {active: true, count: 12}));
const emptyJson = JSON.stringify(await activity(new Map(), {active: false, count: 0}));
const GIS = 'https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Parcels_Current/FeatureServer/0';
const reviewJson = JSON.stringify({ok: true, entries: [
  {caseKey: 'k1', dataset: 'MI-wayne', recordId: 'TEST-P', parcelId: '99000020', decision: 'pending_owner_review',
    reviewedBy: 'preview-wayne-batch-validator', reviewedAt: ago(15), evidenceUrl: GIS, proposedPosition: {lat: 42.3, lon: -83.1}},
  {caseKey: 'k2', dataset: 'MI-wayne', recordId: 'TEST-Q', parcelId: '99000021', decision: 'approved_for_staging',
    reviewedBy: 'preview-wayne-batch-validator', reviewedAt: ago(900), publishStatus: 'published', evidenceUrl: GIS, proposedPosition: {lat: 42.31, lon: -83.11}}]});
const nvidiaJson = JSON.stringify({ok: true, configured: true, keySource: 'env', state: 'idle', dailyLimit: 3, usedToday: 1, remainingToday: 2, receipts: []});

const pulses = page => page.evaluate(() => [...document.getElementById('network').classList].filter(c => c.startsWith('pulse-')));
const labels = page => page.evaluate(() => { const t = document.getElementById('signalLabel').textContent; return t ? [t] : []; });
async function sample(page, ms, read) { const seen = new Set(); const end = Date.now() + ms; while (Date.now() < end) { (await read(page)).forEach(x => seen.add(x)); await page.waitForTimeout(80); } return [...seen]; }
const PAGE = 'http://127.0.0.1:8765/owner/brain/activity/';

async function withPage(browser, fn) {
  const context = await browser.newContext({viewport: {width: 1280, height: 900}});
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try { await fn(page, errors); } finally { await context.close(); }
}

const browser = await chromium.launch({headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']});
try {
  await withPage(browser, async (page, errors) => {
    let body = liveJson;
    await page.route('**/.netlify/functions/owner-brain-activity', r => r.fulfill({status: 200, contentType: 'application/json', body, headers: {'Cache-Control': 'no-store'}}));
    await page.goto(PAGE, {waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => document.getElementById('stamp').textContent.startsWith('Checked'), null, {timeout: 20000});
    const chips = await page.locator('#agentStrip .agentChip').evaluateAll(els => els.map(e => [e.querySelector('b').textContent, e.dataset.state, e.querySelector('span').textContent]));
    const byName = Object.fromEntries(chips.map(([n, s, l]) => [n, {state: s, label: l}]));
    assert.equal(chips.length, 8, 'eight agents shown');
    assert.equal(byName.NVIDIA.state, 'completed');
    assert.equal(byName.NVIDIA.label, 'COMPLETED');
    assert.equal(byName['Official GIS'].state, 'completed', 'last Wayne batch finished, below the shared daily cap');
    assert.equal(byName.Gemini.state, 'idle', 'the upload only reader has stored nothing yet');
    assert.equal(byName.Cloudflare.state, 'idle', 'no second opinion stored yet');
    assert.equal(await page.locator('#activity .log-entry').count(), JSON.parse(liveJson).events.length, 'every recorded event is listed');
    // First load: recorded activity is not replayed as new animation.
    assert.deepEqual(await sample(page, 2500, pulses), [], 'no replay of recorded events on first load');
    // Refresh with new backend records: each animates with its real label.
    body = refreshJson;
    await page.locator('#refresh').click();
    const refreshCount = JSON.parse(refreshJson).events.length;
    await page.waitForFunction(n => document.querySelectorAll('#activity .log-entry').length === n, refreshCount, {timeout: 10000});
    const [seenPulses, seenLabels] = await Promise.all([sample(page, 12000, pulses), sample(page, 12000, labels)]);
    assert.ok(seenPulses.includes('pulse-verify') && seenPulses.includes('pulse-error') && seenPulses.includes('pulse-publish'), 'verify, warning and publication pulses');
    assert.ok(seenLabels.some(t => t.includes('HELPER → NVIDIA · 6 ITEMS')), 'NVIDIA transfer label reflects the real item count');
    assert.ok(seenLabels.some(t => t.includes('MAP PUBLICATION · 99000009')), 'publication label names the real parcel');
    assert.equal(errors.length, 0, errors.join(';'));
  });
  await withPage(browser, async (page) => {
    await page.route('**/.netlify/functions/owner-brain-activity', r => r.fulfill({status: 200, contentType: 'application/json', body: emptyJson}));
    await page.goto(PAGE, {waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => document.getElementById('stamp').textContent.startsWith('Checked'), null, {timeout: 20000});
    assert.deepEqual(await sample(page, 3000, pulses), [], 'no animation without backend events');
    const nv = await page.locator('#agentStrip .agentChip[data-state]').evaluateAll(els => els.find(e => e.querySelector('b').textContent === 'NVIDIA')?.dataset.state);
    assert.equal(nv, 'idle', 'NVIDIA is idle when no consolidation has run');
    assert.equal(await page.locator('#healthState').textContent(), 'QUOTA WAIT');
  });
  await withPage(browser, async (page, errors) => {
    await page.route('**/.netlify/functions/owner-brain-activity', r => r.fulfill({status: 200, contentType: 'application/json', body: liveJson}));
    await page.route('**/.netlify/functions/owner-brain-review', r => r.fulfill({status: 200, contentType: 'application/json', body: reviewJson}));
    await page.route('**/.netlify/functions/owner-brain-nvidia', r => r.fulfill({status: 200, contentType: 'application/json', body: nvidiaJson}));
    await page.route('**/.netlify/functions/owner-brain-second-opinion', r => r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({ok: true, enabled: true, stopped: false, used: 0, daily: 3, model: 'm', results: []})}));
    await page.goto('http://127.0.0.1:8765/owner/brain/', {waitUntil: 'domcontentloaded'});
    await page.evaluate(() => document.querySelectorAll('.bn-row[aria-expanded="false"]').forEach(a => a.click())); // panels open in place under their rows
    await page.waitForFunction(() => !document.getElementById('approvalStatus').textContent.startsWith('Loading'), null, {timeout: 20000});
    assert.match(await page.locator('#approvalStatus').textContent(), /1 waiting for your decision · 1 already public/);
    assert.equal(await page.locator('#approvalItems .approval-card').count(), 2, 'pending and already-public corrections');
    assert.match(await page.locator('#approvalItems .approval-card').nth(1).locator('h3').textContent(), /already public/);
    assert.equal(await page.locator('#approvalItems button', {hasText: 'Approve'}).count(), 2);
    assert.equal(await page.locator('#approvalItems button', {hasText: 'Reject'}).count(), 1, 'pending cases get Reject');
    assert.equal(await page.locator('#approvalItems button', {hasText: 'Withdraw from public map'}).count(), 1, 'public cases say Withdraw');
    assert.equal(await page.locator('#approvalItems .approval-card').first().locator('select option').count(), 2, 'Pro-first and critical options');
    await page.waitForFunction(() => document.getElementById('nvidiaStatus').textContent.includes('Key configured'), null, {timeout: 20000});
    assert.equal(await page.locator('#nvidiaRun').isDisabled(), false);
    const html = await page.content();
    assert.equal(html.includes(DUMMY_KEY) || /nvapi-/.test(html), false, 'no key-like value in the page');
    assert.equal(errors.length, 0, errors.join(';'));
  });
  console.log('PASS: activity page, agent states, NVIDIA events, approval queue and NVIDIA panel');
} finally {
  await browser.close();
}
