// Engineering Mode (Superpowers) end to end on the Netlify build: the owner signs in, opens /engineering in a real
// browser and runs each Superpowers workflow. The AI provider is a local stand-in (no real model is called); the test
// checks what SkyData sends to it (the pinned Superpowers skill text and the no-execution rules) and that the answer
// comes back through the Netlify Function to the page. Usage (from SkyData_Website, after build.mjs):
//   node netlify-adapter/test/engineering.e2e.mjs <project> <code-file>
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { startEmulator } from './emulator.mjs';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = require(process.env.PLAYWRIGHT ?? 'playwright');
const [project, codeFile] = process.argv.slice(2);
const results = [];
const check = (name, ok, detail = '') => {
  results.push(Boolean(ok));
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};
const OWNER = 'skyariasa@gmail.com';
const PASSWORD = 'Engineering test owner password 1';
const ANSWER = 'Stand-in engineering answer. Tests NOT_RUN.';

// The site's server runs in this process: answer its AI calls locally and record them.
const calls = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (/generativelanguage\.googleapis\.com|integrate\.api\.nvidia\.com/.test(url)) {
    const raw = init?.body ?? (input instanceof Request ? await input.clone().text() : '');
    calls.push({ url, body: typeof raw === 'string' ? raw : '' });
    if (url.includes('generativelanguage')) {
      const chunk = { candidates: [{ content: { role: 'model', parts: [{ text: ANSWER }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 } };
      if (url.includes('streamGenerateContent')) return new Response('data: ' + JSON.stringify(chunk) + '\r\n\r\n', { headers: { 'content-type': 'text/event-stream' } });
      return Response.json(chunk);
    }
    return Response.json({ choices: [{ message: { role: 'assistant', content: ANSWER }, finish_reason: 'stop' }], model: 'stand-in' });
  }
  return realFetch(input, init);
};

const emu = await startEmulator(project, { GEMINI_API_KEY: 'stand-in-gemini-key', GEMINI_FREE_TIER_CONFIRMED: 'true', NVIDIA_API_KEY: 'nvapi-stand-in' });
const base = emu.url.replace('127.0.0.1', 'localhost');
const browser = await chromium.launch();
try {
  const signedOut = await realFetch(base + '/api/engineering', { method: 'POST', headers: { origin: base, 'content-type': 'application/json' }, body: '{}' });
  check('signed out, Engineering is refused', signedOut.status === 403, String(signedOut.status));

  const page = await browser.newPage({ baseURL: base });
  await page.goto('/owner-setup');
  await page.fill('input[name=code]', readFileSync(codeFile, 'utf8').trim());
  await page.fill('input[name=password]', PASSWORD);
  await page.fill('input[name=confirm]', PASSWORD);
  await page.click('button');
  await page.goto('/login');
  await page.fill('input[name=email]', OWNER);
  await page.fill('input[name=password]', PASSWORD);
  await Promise.all([page.waitForURL('**/owner'), page.click('form[action="/login"] button')]);

  // Every workflow through the API, rotating through the selectable models. Engineering allows 12 requests per minute,
  // so the test stays under that (8 requests in total).
  const { ENGINEERING_WORKFLOWS } = await import(path.resolve('lib/engineering-contract.ts')).catch(() => ({ ENGINEERING_WORKFLOWS: null }));
  const workflows = ENGINEERING_WORKFLOWS ?? [
    { id: 'planning', skill: 'writing-plans' },
    { id: 'debugging', skill: 'systematic-debugging' },
    { id: 'review', skill: 'requesting-code-review' },
    { id: 'testing', skill: 'test-driven-development' },
    { id: 'performance', skill: 'systematic-debugging' },
  ];
  const status = await (await page.request.get('/api/status')).json();
  const models = (status.models ?? []).map((m) => m.id).filter((id) => !id.startsWith("gemini") && id !== "nvidia/nemotron-3.5-super-vl-120b-a12b");
  const gemini = await page.request.post('/api/engineering', { headers: { origin: base }, data: { mode: 'research', workflow: 'planning', model: 'gemini-3.8-flash', messages: [{ role: 'user', content: 'Hi' }] } });
  check('Gemini is refused in Engineering', gemini.status() === 400, String(gemini.status()));
  check('Engineering has the three NVIDIA models', models.length === 3, models.join(', '));
  const rounds = Math.max(workflows.length, models.length);
  for (let i = 0; i < rounds; i++) {
    {
      const w = workflows[i % workflows.length];
      const model = models[i % models.length];
      const before = calls.length;
      const r = await page.request.post('/api/engineering', { headers: { origin: base }, data: { mode: 'research', workflow: w.id, model, messages: [{ role: 'user', content: 'Find why the login test fails.' }] } });
      const d = await r.json().catch(() => ({}));
      const sent = calls.slice(before).map((c) => c.body).join('\n');
      const skillName = 'name: ' + w.skill;
      check(`${w.id} with ${model}`, r.status() === 200 && d.content?.includes('Stand-in engineering answer') && sent.includes(skillName) && sent.includes('using-superpowers') && /NO EXECUTION/i.test(sent), `HTTP ${r.status()}${d.error ? ' ' + d.error : ''} · skills ${JSON.stringify(d.skills)} · provider ${d.actualProvider ?? '?'}`);
    }
  }
  const dev = await page.request.post('/api/engineering', { headers: { origin: base }, data: { mode: 'development', workflow: 'planning', model: models[0], approved: true, action: 'propose', messages: [{ role: 'user', content: 'Propose a fix.' }] } });
  const devBody = await dev.json().catch(() => ({}));
  check('Development (proposal) mode works and reports nothing executed', dev.status() === 200 && devBody.modificationsApplied === false, `HTTP ${dev.status()} ${devBody.error ?? ''}`);

  // The real page: enable, choose a workflow, ask, see the answer.
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/engineering');
  await page.waitForSelector('textarea');
  const toggle = page.locator('input[type=checkbox]').first();
  if (!(await toggle.isChecked())) await toggle.check();
  await page.fill('textarea', 'Plan how to add a password reset test.');
  await page.locator('main button:not([disabled])').filter({ hasNotText: /Stop|Download|Restore|Discard|unavailable|never/ }).first().click();
  await page.waitForFunction((t) => document.body.innerText.includes(t), 'Stand-in engineering answer', { timeout: 60_000 }).catch(() => {});
  const shown = await page.locator('main').innerText();
  check('the Engineering page runs a Superpowers task and shows the answer', shown.includes('Stand-in engineering answer'), shown.match(/(Superpowers[^\n]{0,80})/)?.[1] ?? '');
  check('no page errors', errors.length === 0, errors.join(' | ').slice(0, 200));
} finally {
  await browser.close();
  await emu.stop();
  globalThis.fetch = realFetch;
}
const passed = results.filter(Boolean).length;
console.log(`${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
