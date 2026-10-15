// Netlify Blobs tokens belong to one invocation and expire. A warm function that kept the stores it opened on its
// first request failed every later upload with "Netlify Blobs could not write to store 'skydata-file-parts' (Failed to
// decode token: Token expired)". This test uploads a project, rotates the Blobs token like Netlify does, then uploads,
// reads and deletes again on the same warm function. Usage (from SkyData_Website, after build.mjs):
//   node netlify-adapter/test/blobs-token.e2e.mjs <project> <code-file>
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { startEmulator } from './emulator.mjs';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = require(process.env.PLAYWRIGHT ?? 'playwright');
const { zipSync } = require('fflate');
const [project, codeFile] = process.argv.slice(2);
const results = [];
const check = (name, ok, detail = '') => {
  results.push(Boolean(ok));
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};
const PASSWORD = 'Blobs token test owner password 1';

const emu = await startEmulator(project);
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

  const post = (p, data, type) => page.request.post(p, { data, headers: { origin: base, ...(type ? { 'content-type': type } : {}) } });
  const upload = async (name) => {
    const zip = Buffer.from(zipSync({ 'src/index.js': new TextEncoder().encode('console.log("' + name + '")\n') }));
    const created = await post('/api/projects', { name, size: zip.length });
    if (!created.ok()) return { ok: false, step: 'create', status: created.status(), text: (await created.text()).slice(0, 200) };
    const { id } = await created.json();
    const part = await post('/api/projects/' + id + '/part?number=1', zip, 'application/octet-stream');
    if (!part.ok()) return { ok: false, id, step: 'part', status: part.status(), text: (await part.text()).slice(0, 200) };
    const done = await post('/api/projects/' + id + '/complete', {});
    if (!done.ok()) return { ok: false, id, step: 'complete', status: done.status(), text: (await done.text()).slice(0, 200) };
    // The page then stores the text index and the manifest (both in Blobs) and marks the project ready.
    const text = 'console.log("' + name + '")\n';
    const index = await post('/api/projects/' + id + '/index', { number: 0, files: [{ path: 'src/index.js', text }] });
    if (!index.ok()) return { ok: false, id, step: 'index', status: index.status(), text: (await index.text()).slice(0, 200) };
    const ready = await post('/api/projects/' + id + '/ready', { files: [{ path: 'src/index.js', size: text.length, chunk: 0 }] });
    if (!ready.ok()) return { ok: false, id, step: 'ready', status: ready.status(), text: (await ready.text()).slice(0, 200) };
    return { ok: true, id };
  };

  const first = await upload('before-rotation.zip');
  check('a ZIP uploads on a fresh function', first.ok, JSON.stringify(first));

  await emu.rotateBlobsToken();

  const second = await upload('after-rotation.zip');
  check('after the Blobs token changes, a ZIP still uploads on the same warm function', second.ok, JSON.stringify(second));
  const listed = await page.request.get('/api/projects');
  const names = ((await listed.json().catch(() => ({}))).projects ?? []).map((p) => p.name);
  check('both projects are listed', listed.ok() && names.includes('before-rotation.zip') && names.includes('after-rotation.zip'), names.join(', '));
  const files = await page.request.get('/api/projects/' + first.id + '/files');
  check('files of a project stored before the token changed can still be read', files.ok() && (await files.text()).includes('src/index.js'), String(files.status()));
  const del = await page.request.delete('/api/projects/' + first.id, { headers: { origin: base } });
  check('a project uploaded before the token changed can still be deleted', del.ok(), String(del.status()));
} finally {
  await browser.close();
  await emu.stop();
}
const passed = results.filter(Boolean).length;
console.log(`${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
