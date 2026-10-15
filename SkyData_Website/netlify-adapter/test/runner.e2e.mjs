// HP runner end to end against the Netlify build: the downloadable runner ZIP is extracted, paired with a local
// copy of the site (SKYDATA_SITE_URL) and run with real Docker. It must refuse an old ChatGPT Sites pairing, then
// pick up and run a JavaScript test and a REA 6.5.0 analysis that the owner queues on the site.
// Needs Docker with node:24-alpine and skydata-rea:6.5.0-a1 (Prepare_REA). Usage (from SkyData_Website, after build.mjs):
//   node netlify-adapter/test/runner.e2e.mjs <project> <code-file> <runner-zip>
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startEmulator } from './emulator.mjs';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = require(process.env.PLAYWRIGHT ?? 'playwright');
const [project, codeFile, runnerZip] = process.argv.slice(2);
const results = [];
const check = (name, ok, detail = '') => {
  results.push(Boolean(ok));
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};
const OWNER = 'skyariasa@gmail.com';
const PASSWORD = 'Runner test owner password 1';
// Statuses while a job is queued, waiting for the runner window's "yes", or running.
const PENDING = /wait|claim|run|pend|queue/;
const until = async (what, fn, ms = 180_000) => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw Error('Timed out waiting for ' + what);
    await new Promise((r) => setTimeout(r, 1000));
  }
};

// The local site runs in this process, so the runner must be started without blocking it (no spawnSync).
const run = (args, input) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: runnerDir, env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    const timer = setTimeout(() => child.kill(), 120_000);
    child.on('close', (status) => { clearTimeout(timer); resolve({ status, stdout, stderr }); });
    child.stdin.end(input);
  });
const work = mkdtempSync(path.join(tmpdir(), 'skydata-runner-e2e-'));
const runnerDir = path.join(work, 'runner');
const home = path.join(work, 'home');
mkdirSync(runnerDir);
mkdirSync(home);
const unzip = spawnSync('unzip', ['-q', path.resolve(runnerZip), '-d', runnerDir]);
if (unzip.status !== 0) throw Error('unzip failed: ' + unzip.stderr);

const emu = await startEmulator(project);
const base = emu.url.replace('127.0.0.1', 'localhost');
const env = { ...process.env, HOME: home, USERPROFILE: home, SKYDATA_SITE_URL: base };
const browser = await chromium.launch();
let runner;
try {
  // Owner signs in.
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
  const api = async (p, body) => {
    const r = body === undefined ? await page.request.get(p) : await page.request.post(p, { data: body, headers: { origin: base } });
    const text = await r.text();
    if (!r.ok()) throw Error(p + ' ' + r.status() + ' ' + text.slice(0, 300));
    return text ? JSON.parse(text) : null;
  };

  // A pairing saved by runner 2.4.x (no site recorded) is refused with a clear message, before any polling.
  mkdirSync(path.join(home, '.skydata-runner'), { recursive: true });
  writeFileSync(path.join(home, '.skydata-runner', 'connection.json'), JSON.stringify({ token: 'a'.repeat(64), expires: Date.now() + 86400000 }));
  const old = await run(['runner.mjs', 'start'], '');
  check('an old ChatGPT Sites pairing is refused with "pair again"', /paired with the old ChatGPT Sites SkyData, not http:\/\/localhost/.test(old.stdout + old.stderr), (old.stdout + old.stderr).trim().split('\n').at(-1));

  // Pair with this site.
  const { code } = await api('/api/engineering-runner/code', {});
  const paired = await run(['runner.mjs', 'pair'], code + '\n');
  check('the runner from the ZIP pairs with this site', paired.status === 0 && paired.stdout.includes('Paired with ' + base), (paired.stdout + paired.stderr).trim().split('\n').slice(-3).join(' | ') + ' [code ' + String(code).slice(0, 12) + '…]');
  const saved = JSON.parse(readFileSync(path.join(home, '.skydata-runner', 'connection.json'), 'utf8'));
  check('the pairing records which site it belongs to', saved.site === base);

  // Start it; answer "yes" to each local approval prompt, as the owner would in the runner window.
  let out = '';
  runner = spawn(process.execPath, ['runner.mjs', 'start'], { cwd: runnerDir, env, stdio: ['pipe', 'pipe', 'pipe'] });
  const onData = (d) => {
    out += d;
    if (/Type yes[^\n]*: $/.test(out)) {
      out += '\n';
      runner.stdin.write('yes\n');
    }
  };
  runner.stdout.on('data', onData);
  runner.stderr.on('data', onData);
  let lastStatus;
  const status = await until('runner online', async () => {
    const s = (lastStatus = await api('/api/engineering-runner/status'));
    return s.device?.online && s.device?.rea?.available ? s : null;
  }, 120_000).catch((e) => {
    console.log('runner output:\n' + out.slice(-1500) + '\nlast status: ' + JSON.stringify(lastStatus).slice(0, 1200));
    throw e;
  });
  check('the site sees runner 2.5.0 online', status.device.online === true && status.device.runnerVersion === '2.5.0', 'runner ' + status.device.runnerVersion);
  check('the site sees REA 6.5.0 available on the runner', status.device.rea?.available && JSON.stringify(status.device.rea).includes('6.5.0'), JSON.stringify(status.device.rea).slice(0, 160));

  // 1. JavaScript test.
  await api('/api/engineering-runner/test', { code: 'console.log("runner works", 6 * 7)', approved: true });
  const js = await until('JavaScript test result', async () => {
    const s = await api('/api/engineering-runner/status');
    const h = (s.history ?? []).find((x) => x.kind === 'snippet');
    return h && !PENDING.test(h.status) ? h : null;
  });
  check('a JavaScript test runs in Docker on the runner and reports back', js.status === 'passed' && JSON.stringify(js).includes('runner works 42'), js.status);

  // 2. REA on an uploaded project (the REA fixture), the way the Engineering page does it.
  const fixture = path.join(runnerDir, 'rea', 'fixture');
  const files = [];
  (function walk(dir) {
    for (const n of readdirSync(dir)) {
      const p = path.join(dir, n);
      if (statSync(p).isDirectory()) walk(p);
      else files.push({ path: path.relative(fixture, p).split(path.sep).join('/'), text: readFileSync(p, 'utf8') });
    }
  })(fixture);
  const zipPath = path.join(work, 'fixture.zip');
  spawnSync('zip', ['-qr', zipPath, '.'], { cwd: fixture });
  const zip = readFileSync(zipPath);
  const { id } = await api('/api/projects', { name: 'fixture.zip', size: zip.length });
  const part = await page.request.post('/api/projects/' + id + '/part?number=1', { data: zip, headers: { origin: base, 'content-type': 'application/octet-stream' } });
  if (!part.ok()) throw Error('part upload ' + part.status());
  await api('/api/projects/' + id + '/complete', {});
  await api('/api/projects/' + id + '/index', { number: 0, files });
  await api('/api/projects/' + id + '/ready', { files: files.map((f) => ({ path: f.path, size: Buffer.byteLength(f.text), chunk: 0 })) });
  const paths = files.map((f) => f.path).filter((p) => /\.(m?js|json|html)$/.test(p));
  const preview = await api('/api/engineering-runner/rea-preview', { projectId: id, paths });
  const queued = await api('/api/engineering-runner/rea-analyze', { projectId: id, paths, approved: true, fingerprint: preview.fingerprint });
  const jobId = queued.id ?? queued.job?.id;
  const rea = await until('REA result', async () => {
    const r = await page.request.get('/api/engineering-runner/rea-run?id=' + jobId);
    if (!r.ok()) return null;
    const d = await r.json();
    return d.status && !PENDING.test(d.status) ? d : null;
  }, 300_000);
  const text = JSON.stringify(rea);
  check('a REA 6.5.0 analysis runs on the runner and the site stores it', /"reaVersion":"6\.5\.0"/.test(text) && ['complete', 'partial'].includes(rea.status), rea.status);
  for (const want of ['/health', '/api/orders', '/:id', 'https://api.example.test/v1/products']) check('REA found endpoint ' + want, text.includes(JSON.stringify(want)));
  check('REA reports no resource-constraint skips at 1 GB', !text.includes('Resource constraint'));
} finally {
  runner?.kill();
  await browser.close();
  await emu.stop();
}
const passed = results.filter(Boolean).length;
console.log(`${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
