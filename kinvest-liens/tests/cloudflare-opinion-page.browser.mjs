// Browser test of the Cloudflare second opinion in the approval panel, against mocked endpoints. No real request, no key.
// Run after the static server is up (see validate-map-polish.yml):
//   NODE_PATH=... node --experimental-vm-modules kinvest-liens/tests/cloudflare-opinion-page.browser.mjs
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const json = body => ({status: 200, contentType: 'application/json', body: JSON.stringify(body)});
const receipt = {id: 'r1', at: new Date().toISOString(), outcome: 'completed', model: 'meta/llama-3.3-70b-instruct', inputs: {count: 2, sources: {validator: 2}, datasets: ['IA-scott'], refs: []}, conflicts: [], rejected: [],
  proposals: [{parcelId: 'C0050-21', dataset: 'IA-scott', summary: 'Official match.', sources: [{ref: 'H1', source: 'validator'}]}]};
const browser = await chromium.launch({headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage']});
const page = await browser.newPage({viewport: {width: 390, height: 900}});
const errors = []; page.on('pageerror', e => errors.push(e.message));
let stored = null; const posts = [];
// Registered first so the specific routes below win.
await page.route('**/.netlify/functions/**', r => r.fulfill(json({ok: true, entries: [], cases: []})));
await page.route('**/.netlify/functions/owner-brain-nvidia', r => r.fulfill(json({ok: true, configured: true, state: 'completed', dailyLimit: 3, usedToday: 1, remainingToday: 2, receipts: [receipt]})));
await page.route('**/.netlify/functions/owner-brain-second-opinion', r => {
  if (r.request().method() === 'POST') { posts.push(JSON.parse(r.request().postData())); stored = {receiptId: 'r1', at: new Date().toISOString(), model: '@cf/test/model', opinions: [{parcelId: 'C0050-21', verdict: 'partly', reason: 'Only one source backs it.'}]}; return r.fulfill(json({ok: true, result: stored})); }
  return r.fulfill(json({ok: true, enabled: true, stopped: false, used: stored ? 1 : 0, daily: 3, model: '@cf/test/model', results: stored ? [stored] : []}));
});
page.on('dialog', d => d.accept());
await page.goto('http://127.0.0.1:8765/owner/brain/', {waitUntil: 'domcontentloaded'});
const ask = page.locator('#nvidiaReceipts button', {hasText: 'Ask Cloudflare for a second opinion'});
await page.locator('#nvidiaReceipts button').first().waitFor({state: 'attached', timeout: 20000});
await ask.waitFor({timeout: 10000});
assert.match(await page.locator('#nvidiaReceipts').textContent(), /Used today 0 of 3\. One request per receipt\./);
await ask.click();
await page.locator('#nvidiaReceipts', {hasText: 'Only partly supported'}).waitFor({timeout: 10000});
assert.deepEqual(posts, [{action: 'second-opinion', receiptId: 'r1', confirmed: true}]);
const text = await page.locator('#nvidiaReceipts').textContent();
assert.match(text, /warning only: no proposal was changed/); assert.match(text, /parcel C0050-21: Only one source backs it\./);
assert.equal(await page.locator('#nvidiaReceipts button', {hasText: 'Ask Cloudflare'}).count(), 0, 'one request per receipt');
assert.match(text, /Official match\./, 'the proposal itself is unchanged');
assert.deepEqual(errors, []);
await browser.close();
console.log('PASS: Cloudflare second opinion button, one request, warning only');
