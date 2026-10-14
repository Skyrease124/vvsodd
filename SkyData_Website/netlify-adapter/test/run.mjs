// End-to-end test of the deployable Netlify project in a real browser, against the local Netlify stand-in
// (real Postgres + Netlify's Blobs server). Usage (from SkyData_Website, after build.mjs):
//   node netlify-adapter/test/run.mjs <project-dir> <setup-code-file> <out-dir>
// External AI services are not configured and are not called.
import { createHash, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { startEmulator } from './emulator.mjs';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const { zipSync } = require('fflate');
const { chromium } = require(process.env.PLAYWRIGHT ?? 'playwright');

const [project, codeFile, outDir] = process.argv.slice(2);
const code = readFileSync(codeFile, 'utf8').trim();
mkdirSync(outDir, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};
const OWNER = 'skyariasa@gmail.com';
const PASSWORD = 'Test-only password ' + randomBytes(6).toString('hex');

const emu = await startEmulator(project);
const base = emu.url.replace('127.0.0.1', 'localhost'); // secure-context cookies (__Host-) need localhost
const browser = await chromium.launch();
try {
  const raw = (p, init = {}) => fetch(base + p, { redirect: 'manual', ...init });

  // 1. Signed out, and faking ChatGPT's identity headers gets nowhere.
  const spoof = { 'oai-authenticated-user-id': 'attacker', 'oai-authenticated-user-email': OWNER, 'cf-connecting-ip': '1.2.3.4' };
  let r = await raw('/');
  check('signed-out home shows the SkyData login', r.status === 200 && (await r.text()).includes('Invite-only access'));
  r = await raw('/api/auth/session', { headers: spoof });
  check('fake ChatGPT owner headers are refused (API)', r.status === 403, String(r.status));
  r = await raw('/owner', { headers: spoof });
  const ownerPage = await r.text();
  check('fake ChatGPT owner headers are refused (owner page)', !ownerPage.includes('Owner account') && ownerPage.includes('Invite-only access'), String(r.status));
  r = await raw('/downloads/skydata_connector_addon.zip');
  check('protected download needs sign-in', r.headers.get('content-type')?.includes('text/html'), r.headers.get('content-type'));
  r = await raw('/api/engineering', { method: 'POST', headers: { ...spoof, 'content-type': 'application/json', origin: base }, body: '{}' });
  check('Engineering Mode API refuses fake owner', r.status === 403, String(r.status));

  // 2. Owner setup: wrong code refused, right code creates the owner login.
  const form = (fields) => new URLSearchParams(fields).toString();
  r = await raw('/owner-setup', { method: 'POST', headers: { origin: base, 'content-type': 'application/x-www-form-urlencoded' }, body: form({ code: 'WRONG-CODE', password: PASSWORD, confirm: PASSWORD }) });
  check('owner setup refuses a wrong code', r.status === 401, String(r.status));
  r = await raw('/owner-setup', { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/x-www-form-urlencoded' }, body: form({ code, password: PASSWORD, confirm: PASSWORD }) });
  check('owner setup refuses another website', r.status === 403, String(r.status));

  const context = await browser.newContext({ baseURL: base });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/owner-setup');
  await page.fill('input[name=code]', code);
  await page.fill('input[name=password]', PASSWORD);
  await page.fill('input[name=confirm]', PASSWORD);
  await page.click('button');
  check('owner setup with the right code', (await page.textContent('main')).includes('Saved.'));

  // 3. Normal SkyData login.
  await page.goto('/login');
  await page.fill('input[name=email]', OWNER);
  await page.fill('input[name=password]', PASSWORD);
  await Promise.all([page.waitForLoadState('load'), page.click('form[action="/login"] button')]);
  await page.waitForLoadState('networkidle');
  const session = await (await page.request.get('/api/auth/session')).json().catch(() => ({}));
  check('owner signs in with SkyData login', session.signedIn === true && session.isOwner === true && session.email === OWNER, JSON.stringify(session).slice(0, 120));
  const cookies = await context.cookies();
  const sc = cookies.find((c) => c.name === '__Host-skydata_session');
  check('session cookie is HttpOnly + Secure', sc && sc.httpOnly && sc.secure, sc ? `httpOnly=${sc.httpOnly} secure=${sc.secure} sameSite=${sc.sameSite}` : 'missing');

  // 4. Every page renders for the owner.
  for (const p of ['/', '/code', '/engineering', '/engineering/runner', '/knowledge', '/decisions', '/debate', '/interpreter', '/blender', '/owner/voice', '/owner', '/account', '/owner/models', '/connect']) {
    const before = errors.length;
    const resp = await page.goto(p);
    await page.waitForLoadState('networkidle').catch(() => {});
    const text = (await page.textContent('body')) ?? '';
    const bad = /Temporarily unavailable|storage is unavailable|Application error|Internal Server Error/i.test(text);
    check(`page ${p} renders`, resp.status() < 400 && !bad && errors.length === before, `${resp.status()}${bad ? ' error text' : ''}${errors.length > before ? ' js: ' + errors.slice(before).join(' | ').slice(0, 120) : ''}`);
  }
  await page.goto('/');
  await page.screenshot({ path: path.join(outDir, 'home.png') });

  // 5. Protected download now works for the owner.
  const dl = await page.request.get('/downloads/skydata_connector_addon.zip');
  const dlBytes = await dl.body();
  check('owner gets the protected download', dl.ok() && dlBytes[0] === 0x50 && dlBytes[1] === 0x4b, `${dl.status()} ${dlBytes.length} bytes`);

  // 6. Chat saving (encrypted with the site key).
  const api = (p, method = 'GET', body) => page.evaluate(async ({ p, method, body }) => {
    const res = await fetch(p, { method, headers: body === undefined ? {} : typeof body === 'string' ? { 'content-type': 'application/json' } : {}, body: body === undefined ? undefined : typeof body === 'string' ? body : new Uint8Array(body) });
    const t = await res.text();
    let j;
    try { j = JSON.parse(t); } catch { j = t.slice(0, 200); }
    return { status: res.status, body: j };
  }, { p, method, body });
  const state = { messages: [{ role: 'user', content: 'Hello from the Netlify test' }, { role: 'assistant', content: 'Saved reply' }], draft: 'draft text', model: 'nvidia/nemotron-3-ultra-550b-a55b', replyLanguage: 'en' };
  r = await api('/api/chat-state', 'POST', JSON.stringify(state));
  const loaded = await api('/api/chat-state');
  check('chat is saved and loaded back', r.status === 200 && loaded.body?.state?.messages?.[0]?.content === 'Hello from the Netlify test', `${r.status} ${JSON.stringify(r.body).slice(0, 100)}`);
  const pgRaw = await (async () => { const pg = (await import('pg')).default; const c = new pg.Client({ connectionString: emu.connectionString }); await c.connect(); const q = await c.query('SELECT state FROM chat_state'); await c.end(); return q.rows[0]?.state ?? ''; })();
  check('saved chat is encrypted in the database', pgRaw.includes('ciphertext') && !pgRaw.includes('Hello from the Netlify test'));

  // 7. Project ZIP upload in 3 MB parts (multipart over Blobs), indexing, download, delete.
  const random = randomBytes(7 * 1024 * 1024 + 12345);
  const zip = zipSync({ 'src/app.js': [new TextEncoder().encode('export const answer = 42;\n'), { level: 6 }], 'assets/noise.bin': [random, { level: 0 }] });
  const sha = createHash('sha256').update(zip).digest('hex');
  const created = await api('/api/projects', 'POST', JSON.stringify({ name: 'netlify-test.zip', size: zip.byteLength }));
  const id = created.body?.id;
  const PART = 3 * 1024 * 1024;
  let partsOk = true;
  let parts = 0;
  for (let n = 1, off = 0; off < zip.byteLength; n++, off += PART) {
    const res = await api(`/api/projects/${id}/part?number=${n}`, 'POST', Array.from(zip.subarray(off, off + PART)));
    partsOk &&= res.status === 200;
    parts++;
  }
  const completed = await api(`/api/projects/${id}/complete`, 'POST', '{}');
  const indexed = await api(`/api/projects/${id}/index`, 'POST', JSON.stringify({ number: 0, files: [{ path: 'src/app.js', text: 'export const answer = 42;\n' }] }));
  const ready = await api(`/api/projects/${id}/ready`, 'POST', JSON.stringify({ files: [{ path: 'src/app.js', size: 26, chunk: 0 }, { path: 'assets/noise.bin', size: random.length }] }));
  check('project ZIP uploads in 3 MB parts', created.status === 200 && partsOk && completed.status === 200 && indexed.status === 200 && ready.status === 200, `${(zip.byteLength / 1048576).toFixed(1)} MB in ${parts} parts; create ${created.status} complete ${completed.status} index ${indexed.status} ready ${ready.status}`);
  const back = await page.request.get(`/api/projects/${id}/download`);
  const backSha = createHash('sha256').update(await back.body()).digest('hex');
  check('downloaded project ZIP is byte-identical', back.ok() && backSha === sha, `${back.status()} sha ${backSha.slice(0, 12)} vs ${sha.slice(0, 12)}`);
  const list = await api('/api/projects');
  check('project appears in the list', list.body?.projects?.some((p) => p.id === id));
  const filesApi = await api(`/api/projects/${id}/files`);
  check('project file browser lists files', filesApi.status === 200, `${filesApi.status} ${JSON.stringify(filesApi.body).slice(0, 120)}`);
  const del = await api(`/api/projects/${id}`, 'DELETE');
  const gone = await page.request.get(`/api/projects/${id}/download`);
  check('project delete removes it', del.status === 200 && gone.status() === 404, `${del.status} then ${gone.status()}`);

  // 8. Knowledge document upload (multipart). Indexing needs the NVIDIA embeddings key, not configured here.
  const doc = new TextEncoder().encode(('# Netlify knowledge test\n\n' + 'SkyData on Netlify stores this text in Blobs. '.repeat(90000)).slice(0, 4 * 1024 * 1024));
  const kd = await api('/api/knowledge', 'POST', JSON.stringify({ name: 'netlify-test.md', size: doc.byteLength, category: 'ENGINEERING' }));
  let kOk = kd.status === 200;
  for (let n = 1, off = 0; off < doc.byteLength; n++, off += PART) kOk &&= (await api(`/api/knowledge/${kd.body.id}/part?number=${n}`, 'POST', Array.from(doc.subarray(off, off + PART)))).status === 200;
  const kc = await api(`/api/knowledge/${kd.body.id}/complete`, 'POST', '{}');
  const kl = await api('/api/knowledge');
  const kdoc = kl.body?.documents?.find((d) => d.id === kd.body.id);
  check('knowledge document uploads and is stored', kOk && kc.status === 200 && kdoc?.status === 'extracting', `create ${kd.status} complete ${kc.status} status ${kdoc?.status}`);

  // 9. HP runner pairing (device side has no session; it uses its own token).
  const pair = await api('/api/engineering-runner/code', 'POST', '{}');
  const device = await raw('/api/engineering-runner/pair', { method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: JSON.stringify({ code: pair.body?.code }) });
  const token = (await device.json().catch(() => ({}))).token;
  const poll = await raw('/api/engineering-runner/poll', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify({ ready: true, version: '2.4.11' }) });
  const status = await api('/api/engineering-runner/status');
  check('HP runner pairs and polls', pair.status === 200 && device.status === 200 && poll.status === 200 && status.body?.device, `code ${pair.status} pair ${device.status} poll ${poll.status} device ${JSON.stringify(status.body?.device ?? null).slice(0, 80)}`);

  // 10. Chat without any AI key answers with an error, not a crash.
  const chat = await api('/api/chat', 'POST', JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], model: 'nvidia/nemotron-3-ultra-550b-a55b' }));
  check('chat without AI keys fails gracefully', chat.status >= 400 && chat.status < 500 || (chat.status === 503 && typeof chat.body === 'object'), `${chat.status} ${JSON.stringify(chat.body).slice(0, 120)}`);

  // 11. Log out.
  await page.goto('/account');
  const logout = page.locator('form[action="/logout"] button');
  if (await logout.count()) await Promise.all([page.waitForLoadState('load'), logout.first().click()]);
  const after = await (await page.request.get('/api/auth/session')).status();
  check('log out ends the session', after === 403, String(after));
  check('no JavaScript errors on any page', errors.length === 0, errors.slice(0, 3).join(' | ').slice(0, 200));
  await context.close();
} finally {
  await browser.close();
  await emu.stop();
}
writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
