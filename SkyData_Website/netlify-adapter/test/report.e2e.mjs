// Website investigation reports on Netlify: a request is cut off after 30 seconds there, but the report model can take
// minutes. Generate must hand the work to the background function and answer at once; the page then polls until the
// report is saved. Also: a failed background run reports its reason, and a run that never finished does not leave the
// investigation stuck on "generating". The HP runner is simulated through its device API; the model is a local
// stand-in that takes longer than the request it was started from. Usage (from SkyData_Website, after build.mjs):
//   node netlify-adapter/test/report.e2e.mjs <project> <code-file>
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { startEmulator } from './emulator.mjs';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = require(process.env.PLAYWRIGHT ?? 'playwright');
const [project, codeFile] = process.argv.slice(2);
const results = [];
const check = (name, ok, detail = '') => {
  results.push(Boolean(ok));
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};
const PASSWORD = 'Report test owner password 1';
const MODEL = 'nvidia/nemotron-3-ultra-550b-a55b';
const REPORT_DELAY = 4000;

let modelMode = 'slow';
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith('https://integrate.api.nvidia.com/')) {
    if (modelMode === 'fail') return Response.json({ error: 'busy' }, { status: 429 });
    // Like a real connection, an aborted signal ends the request.
    const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    await new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(signal.reason);
      const t = setTimeout(resolve, REPORT_DELAY);
      signal?.addEventListener('abort', () => (clearTimeout(t), reject(signal.reason)));
    });
    return Response.json({ choices: [{ message: { role: 'assistant', content: 'CONFIRMED [page-0]: Background report.' }, finish_reason: 'stop' }] });
  }
  return realFetch(input, init);
};

const emu = await startEmulator(project, { NVIDIA_API_KEY: 'nvapi-stand-in' });
const base = emu.url.replace('127.0.0.1', 'localhost');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ baseURL: base });
  await page.goto('/owner-setup');
  await page.fill('input[name=code]', readFileSync(codeFile, 'utf8').trim());
  await page.fill('input[name=password]', PASSWORD);
  await page.fill('input[name=confirm]', PASSWORD);
  await page.click('button');
  await page.goto('/login');
  await page.fill('input[name=email]', 'skyariasa@gmail.com');
  await page.fill('input[name=password]', PASSWORD);
  await Promise.all([page.waitForURL('**/owner'), page.click('form[action="/login"] button')]);
  const api = async (p, body, method) => {
    const r = body === undefined && !method ? await page.request.get(p) : await page.request.fetch(p, { method: method ?? 'POST', data: body ?? {}, headers: { origin: base } });
    const text = await r.text();
    return { status: r.status(), body: text ? JSON.parse(text) : null };
  };

  // A paired HP with a passing browser self-test.
  const { body: { code } } = await api('/api/engineering-runner/code', {});
  const { body: { token } } = await api('/api/engineering-runner/pair', { code });
  const device = (p, b) => realFetch(base + '/api/engineering-runner/' + p, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify(b) }).then((r) => r.json());
  const poll = { ready: true, protocol: 2, version: '2.5.1', capabilities: { rea: { available: true, reaVersion: '6.5.0', adapterVersion: '1' }, browser: { available: true, selfTestPassed: true, stagehandVersion: '4.2.1', adapterVersion: '2', checkedAt: Date.now(), detail: 'Simulated HP self-test' } } };
  await device('poll', poll);

  const investigate = async () => {
    const created = await api('/api/engineering-browser', { url: 'https://example.com/', goal: 'Map the public pages', engine: 'superpowers', model: MODEL, workflow: 'planning', approved: true });
    if (created.status !== 202) throw Error('start ' + created.status + ' ' + JSON.stringify(created.body));
    const { job } = await device('poll', poll);
    const b = JSON.parse(job.code.slice('SKYDATA_BROWSER_V1\n'.length));
    await device('progress', { id: job.id, phase: 'browser_launching' });
    const evidence = { stagehandVersion: '4.2.1', browserExecuted: true, cleanupConfirmed: true, requestFingerprint: createHash('sha256').update(JSON.stringify({ url: b.url, goal: b.goal, engine: b.engine })).digest('hex'), pages: [{ id: 'page-0', url: b.url, title: 'Public fixture' }], scripts: [], screenshots: [], network: [], interactions: [] };
    await device('browser-result', { id: job.id, result: { status: 'complete', cleanupConfirmed: true, evidence } });
    return job.id;
  };
  const statusOf = async (id) => (await api('/api/engineering-browser/' + id)).body;

  // 1. Generate answers at once and the report arrives in the background.
  const id = await investigate();
  const t0 = Date.now();
  const gen = await api('/api/engineering-browser/' + id + '/generate', {});
  check('Generate answers at once while the report is written in the background', gen.status === 202 && gen.body.status === 'generating' && Date.now() - t0 < REPORT_DELAY, `HTTP ${gen.status} in ${Date.now() - t0} ms`);
  const again = await api('/api/engineering-browser/' + id + '/generate', {});
  check('pressing Generate again while it runs shows "generating", not an error', again.status === 202 && again.body.status === 'generating', `HTTP ${again.status} ${JSON.stringify(again.body)}`);
  let s;
  for (let i = 0; i < 30 && (s = await statusOf(id)).status === 'generating'; i++) await new Promise((r) => setTimeout(r, 500));
  check('the investigation becomes report_ready', s.status === 'report_ready', JSON.stringify(s));
  const report = await api('/api/engineering-browser/' + id + '/report');
  check('the saved report has the model answer', report.status === 200 && report.body.content?.includes('Background report') && report.body.actualModel === MODEL, String(report.status));

  // 2. A failing model: the reason comes back with the status, and Generate can be pressed again.
  modelMode = 'fail';
  const id2 = await investigate();
  await api('/api/engineering-browser/' + id2 + '/generate', {});
  for (let i = 0; i < 30 && (s = await statusOf(id2)).status === 'generating'; i++) await new Promise((r) => setTimeout(r, 300));
  check('a failed background report shows why', s.status === 'complete' && /Report model failed \(429\)/.test(s.error ?? ''), JSON.stringify(s));

  // 3. A run that died without finishing (no record of its start, like the one stuck before this fix) is released.
  const stuck = await investigate();
  const db = new pg.Client({ connectionString: emu.connectionString });
  await db.connect();
  await db.query("UPDATE engineering_browser_jobs SET status='generating' WHERE id=$1", [stuck]);
  await db.end();
  await realFetch(base + '/api/engineering-browser/' + stuck, { headers: { cookie: (await page.context().cookies()).map((c) => c.name + '=' + c.value).join('; ') } });
  s = await statusOf(stuck);
  check('a stuck "generating" investigation is released with a clear message', s.status === 'complete' && /stopped before it finished/.test(s.error ?? ''), JSON.stringify(s));
  modelMode = 'slow';
  const retry = await api('/api/engineering-browser/' + stuck + '/generate', {});
  for (let i = 0; i < 30 && (s = await statusOf(stuck)).status === 'generating'; i++) await new Promise((r) => setTimeout(r, 500));
  check('after that, Generate works again', retry.status === 202 && s.status === 'report_ready', JSON.stringify(s));

  // History downloads: the collected evidence of a "complete" investigation, and a stuck one listed as complete.
  const evidence = await api('/api/engineering-browser/' + stuck + '/evidence');
  check('the evidence of an investigation can be downloaded', evidence.status === 200 && evidence.body.evidence?.pages?.[0]?.title === 'Public fixture' && evidence.body.url === 'https://example.com/', String(evidence.status));
  const db2 = new pg.Client({ connectionString: emu.connectionString });
  await db2.connect();
  const listed = await investigate();
  await db2.query("UPDATE engineering_browser_jobs SET status='generating' WHERE id=$1", [listed]);
  await db2.end();
  const history = (await api('/api/engineering-browser')).body.jobs;
  check('the history no longer shows a stuck run as "generating"', history.find((j) => j.id === listed)?.status === 'complete', JSON.stringify(history.find((j) => j.id === listed)));

  // 4. The real page: Generate, then the report shows up without pressing anything else.
  const id3 = await investigate();
  await page.goto('/engineering');
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const opened = await page.evaluate(async (jobId) => (await fetch('/api/engineering-browser/' + jobId + '/generate', { method: 'POST' })).status, id3);
  check('the page’s Generate request is accepted', opened === 202, String(opened));
  for (let i = 0; i < 30 && (s = await statusOf(id3)).status === 'generating'; i++) await new Promise((r) => setTimeout(r, 500));
  check('the report is saved for the page to show', s.status === 'report_ready', JSON.stringify(s));
  await page.reload();
  const toggle = page.locator('input[type=checkbox]').first();
  if (!(await toggle.isChecked())) await toggle.check();
  await page.locator('select').filter({ has: page.locator('option[value=website]') }).selectOption('website');
  await page.locator('summary', { hasText: 'Website investigation history' }).click();
  await page.locator('summary', { hasText: 'Website investigation history' }).scrollIntoViewIfNeeded();
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
  const [file] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.locator('button', { hasText: 'Download report' }).first().click()]).catch(async (e) => { console.log('buttons:', await page.locator('button', { hasText: 'Download report' }).evaluateAll((b) => b.map((x) => x.outerHTML + ' in ' + x.closest('details,article,section')?.tagName))); console.log('panel:', (await page.locator('.engineering-website-panel').innerText()).slice(-300), errors, await page.evaluate(async () => { const r = await fetch('/api/engineering-browser'); return (await r.text()).slice(0, 300); })); throw e; });
  const md = readFileSync(await file.path(), 'utf8');
  check('the history has a Download report button that saves the report', md.includes('Background report') && file.suggestedFilename().endsWith('.md'), file.suggestedFilename());
  const [ev] = await Promise.all([page.waitForEvent('download'), page.locator('button', { hasText: 'Download evidence' }).first().click()]);
  check('a complete investigation has a Download evidence button', JSON.parse(readFileSync(await ev.path(), 'utf8')).evidence?.pages?.length === 1, ev.suggestedFilename());
  check('no page errors', errors.length === 0, errors.join(' | '));
} finally {
  await browser.close();
  await emu.stop();
  globalThis.fetch = realFetch;
}
const passed = results.filter(Boolean).length;
console.log(`${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
