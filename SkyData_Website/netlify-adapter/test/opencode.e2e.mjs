// OpenCode Zen (free DeepSeek V4.1 Flash) as an optional chat model on the Netlify build: the owner connects a key on
// /connect-opencode in a real browser, SkyData checks it against Zen's model list (a local stand-in here), then a chat
// with the new model goes to Zen with the free model id. Usage (from SkyData_Website, after build.mjs):
//   node netlify-adapter/test/opencode.e2e.mjs <project> <code-file>
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
const KEY = 'sk-opencode-stand-in-key-0123456789';
let offerOver = false;
const calls = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith('https://opencode.ai/')) return realFetch(input, init);
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  const body = init?.body ? JSON.parse(String(init.body)) : null;
  calls.push({ url, auth: headers.get('authorization'), body });
  if (headers.get('authorization') !== 'Bearer ' + KEY) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (url === 'https://opencode.ai/zen/v1/models') return Response.json({ data: [{ id: 'claude-sonnet' }, { id: 'deepseek-v4-flash-free' }, { id: 'deepseek-v4.1-flash-free' }] });
  if (url === 'https://opencode.ai/zen/v1/chat/completions') {
    if (offerOver) return Response.json({ error: { message: 'Free model no longer available' } }, { status: 402 });
    return Response.json({ choices: [{ message: { role: 'assistant', content: 'Hello from free DeepSeek V4.1 Flash.' }, finish_reason: 'stop' }], model: body.model });
  }
  return Response.json({ error: 'not found' }, { status: 404 });
};

const emu = await startEmulator(project, { NVIDIA_API_KEY: 'nvapi-stand-in' });
const base = emu.url.replace('127.0.0.1', 'localhost');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ baseURL: base });
  const PASSWORD = 'OpenCode test owner password 1';
  await page.goto('/owner-setup');
  await page.fill('input[name=code]', readFileSync(codeFile, 'utf8').trim());
  await page.fill('input[name=password]', PASSWORD);
  await page.fill('input[name=confirm]', PASSWORD);
  await page.click('button');
  await page.goto('/login');
  await page.fill('input[name=email]', 'skyariasa@gmail.com');
  await page.fill('input[name=password]', PASSWORD);
  await Promise.all([page.waitForURL('**/owner'), page.click('form[action="/login"] button')]);
  const chat = async () => {
    const r = await page.request.post('/api/chat', { headers: { origin: base }, data: { model: 'opencode/deepseek-v4.1-flash-free', messages: [{ role: 'user', content: 'Say hello.' }] } });
    return { status: r.status(), body: await r.json().catch(() => ({})) };
  };

  const status = await (await page.request.get('/api/status')).json();
  check('the new model is in the chat model list', (status.models ?? []).some((m) => m.id === 'opencode/deepseek-v4.1-flash-free' && /OpenCode/.test(m.label)), (status.models ?? []).map((m) => m.label).join(', '));
  let r = await chat();
  check('before connecting, the chat says how to connect', r.status === 503 && /Connect OpenCode/.test(r.body.error), JSON.stringify(r.body));

  await page.goto('/connect-opencode');
  await page.fill('input[name=key]', 'sk-wrong-key-0123456789012345');
  await page.click('form button');
  check('a wrong key is refused', /OpenCode rejected this key/.test(await page.locator('main').innerText()));
  await page.goto('/connect-opencode');
  await page.fill('input[name=key]', KEY);
  await page.click('form button');
  const text = await page.locator('main').innerText();
  check('the key is verified and saved with the free V4.1 model', /OpenCode connected/.test(text) && /deepseek-v4\.1-flash-free/.test(text), text.slice(0, 200));

  const before = calls.length;
  r = await chat();
  const sent = calls.slice(before).find((c) => c.url.endsWith('/chat/completions'));
  check('chat with the new model goes to OpenCode Zen with the free model id', r.status === 200 && /free DeepSeek V4\.1 Flash/.test(r.body.content) && sent?.body?.model === 'deepseek-v4.1-flash-free' && sent?.auth === 'Bearer ' + KEY, JSON.stringify(r.body).slice(0, 160));
  check('no NVIDIA-only settings are sent to OpenCode', sent && !('chat_template_kwargs' in sent.body), JSON.stringify(sent?.body ?? {}).slice(0, 200));

  offerOver = true;
  r = await chat();
  check('an OpenCode refusal shows OpenCode\'s own reason', r.status >= 400 && /OpenCode refused the request \(HTTP 402\): Free model no longer available/.test(r.body.error), `${r.status} ${r.body.error}`);
  const other = await page.request.post('/api/chat', { headers: { origin: base }, data: { model: 'nvidia/nemotron-3-ultra-550b-a55b', messages: [{ role: 'user', content: 'Say hello.' }] } });
  check('other models are unaffected (they still go to NVIDIA)', other.status() !== 503 || !/OpenCode/.test(await other.text()), String(other.status()));
  const eng = (await (await page.request.get('/api/status')).json()).models;
  check('the plus menu has Connect OpenCode', await (async () => { await page.goto('/'); await page.waitForSelector('a[href="/connect-opencode"]',{state:'attached',timeout:15000}).catch(()=>{}); return (await page.content()).includes('/connect-opencode'); })());
  check('signed-out visitors cannot open the connect page', await realFetch(base + '/connect-opencode', { redirect: 'manual' }).then(async (x) => x.status !== 200 || !(await x.text()).includes('name="key"')));
  void eng;
} finally {
  await browser.close();
  await emu.stop();
  globalThis.fetch = realFetch;
}
const passed = results.filter(Boolean).length;
console.log(`${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
