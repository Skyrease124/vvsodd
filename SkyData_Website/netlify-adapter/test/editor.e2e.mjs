// SkyData Editor (/editor) inside the built site, on the local Netlify stand-in, in a real browser.
// Usage (from SkyData_Website, after build.mjs): node netlify-adapter/test/editor.e2e.mjs <project> <code-file> <images-dir> <out-dir>
// <images-dir> holds test.jpg (1200×800), iphone12mp.jpg (4032×3024), rotated6.jpg (EXIF 6), notimage.jpg.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { startEmulator } from './emulator.mjs';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium, devices } = require(process.env.PLAYWRIGHT ?? 'playwright');
const [project, codeFile, images, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const code = readFileSync(codeFile, 'utf8').trim();
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: Boolean(ok) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};
const jpegSize = (buf) => {
  for (let i = 2; i < buf.length - 9; ) {
    const m = buf[i + 1];
    if (m >= 0xc0 && m <= 0xc3) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return { w: 0, h: 0 };
};

const emu = await startEmulator(project);
const base = emu.url.replace('127.0.0.1', 'localhost');
const browser = await chromium.launch();
const PASSWORD = 'Editor test password 123';

async function signIn(page) {
  await page.goto('/login');
  await page.fill('input[name=email]', 'skyariasa@gmail.com');
  await page.fill('input[name=password]', PASSWORD);
  await Promise.all([page.waitForLoadState('load'), page.click('form[action="/login"] button')]);
}
const lastPreview = (page) => page.evaluate(async () => {
  const img = [...document.querySelectorAll('.editor-msg img')].pop();
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let spread = 0;
  for (let i = 0; i < d.length; i += 4) spread += Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
  const tr = [...g.getImageData(c.width - 5, 5, 1, 1).data.slice(0, 3)];
  return { w: c.width, h: c.height, chroma: +(spread / (d.length / 4)).toFixed(1), topRight: tr };
});
const count = (page) => page.locator('.editor-msg').count();
const settle = (page, n) => page.waitForFunction((k) => document.querySelectorAll('.editor-msg').length >= k && !document.querySelector('.editor-send')?.closest('form')?.querySelector('.editor-upload')?.disabled, n, { timeout: 300_000 });

try {
  // Signed out: the Editor page itself needs a SkyData account.
  const anon = await fetch(base + '/editor', { redirect: 'manual' });
  const anonText = await anon.text();
  check('signed-out /editor shows the login page', anonText.includes('Invite-only access'), String(anon.status));
  const wasm = await fetch(base + '/editor-engine/pkg/skydata_photocraft_bridge_bg.wasm');
  check('engine file is served', wasm.ok && (await wasm.arrayBuffer()).byteLength > 10_000_000, `${wasm.status} ${wasm.headers.get('content-type')}`);

  const setup = await browser.newPage({ baseURL: base });
  await setup.goto('/owner-setup');
  await setup.fill('input[name=code]', code);
  await setup.fill('input[name=password]', PASSWORD);
  await setup.fill('input[name=confirm]', PASSWORD);
  await setup.click('button');
  await setup.close();

  for (const [label, opts] of [['desktop', { viewport: { width: 1280, height: 860 } }], ['iphone13', devices['iPhone 13']]]) {
    const context = await browser.newContext({ ...opts, baseURL: base, acceptDownloads: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await signIn(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle').catch(() => {});
    const link = page.locator('header a[href="/editor"]');
    check(`${label}: home header has an Editor link`, (await link.count()) === 1);
    const t0 = Date.now();
    await link.click();
    await page.waitForURL('**/editor', { waitUntil: 'commit' });
    await page.waitForFunction(() => document.querySelector('.editor-status')?.textContent?.startsWith('Ready'), null, { timeout: 120_000 });
    check(`${label}: Editor opens and the engine loads`, true, `${Date.now() - t0} ms`);

    let n = await count(page);
    await page.setInputFiles('input[type=file]', path.join(images, 'test.jpg'));
    await settle(page, n + 2);
    let s = await lastPreview(page);
    check(`${label}: upload shows the photo`, s.w === 1024 && s.h === 683, `${s.w}×${s.h}`);

    n = await count(page);
    await page.fill('.editor-input', 'make it brighter and black and white');
    await page.click('.editor-send');
    await settle(page, n + 2);
    s = await lastPreview(page);
    const reply = await page.locator('.editor-msg').last().locator('p').textContent();
    check(`${label}: "brighter and black and white"`, s.chroma < 3, `chroma ${s.chroma}; ${reply}`);

    n = await count(page);
    await page.locator('.editor-chips button', { hasText: 'square crop' }).click();
    await settle(page, n + 2);
    s = await lastPreview(page);
    check(`${label}: square crop chip`, s.w === s.h, `${s.w}×${s.h}`);

    n = await count(page);
    await page.locator('.editor-actions button', { hasText: 'Undo' }).last().click();
    await settle(page, n + 1);
    s = await lastPreview(page);
    check(`${label}: undo`, s.w === 1024 && s.h === 683 && s.chroma < 3, `${s.w}×${s.h}`);

    n = await count(page);
    await page.fill('.editor-input', 'remove the person in the background');
    await page.click('.editor-send');
    await settle(page, n + 2);
    // Not a quick phrase, so it goes to SkyData AI; this test site has no AI key, so the Editor says so and nothing runs.
    const unsupported = page.locator('.editor-msg').last();
    check(`${label}: request beyond the quick phrases without AI is explained`, /You can still use phrases like/.test(await unsupported.textContent()) && (await unsupported.locator('img').count()) === 0, (await unsupported.textContent()).slice(0, 90));

    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('.editor-actions button', { hasText: 'Download JPG' }).last().click()]);
    const file = path.join(out, `${label}-${dl.suggestedFilename()}`);
    await dl.saveAs(file);
    const head = readFileSync(file).subarray(0, 2);
    check(`${label}: download JPG`, head[0] === 0xff && head[1] === 0xd8, `${dl.suggestedFilename()} ${statSync(file).size} bytes`);

    n = await count(page);
    await page.setInputFiles('input[type=file]', path.join(images, 'iphone12mp.jpg'));
    await settle(page, n + 2);
    n = await count(page);
    let t = Date.now();
    await page.fill('.editor-input', 'auto enhance, warmer and sharpen');
    await page.click('.editor-send');
    await settle(page, n + 2);
    const editMs = Date.now() - t;
    const st = await page.locator('.editor-status').textContent();
    t = Date.now();
    const [dl2] = await Promise.all([page.waitForEvent('download', { timeout: 300_000 }), page.locator('.editor-actions button', { hasText: 'Download JPG' }).last().click()]);
    const file2 = path.join(out, `${label}-12mp-${dl2.suggestedFilename()}`);
    await dl2.saveAs(file2);
    const dims = jpegSize(readFileSync(file2));
    check(`${label}: 12 MP photo edits on a preview copy and downloads full size`, st.includes('4032×3024') && dims.w === 4032 && dims.h === 3024, `edit ${editMs} ms, download ${Date.now() - t} ms, ${dims.w}×${dims.h}`);

    n = await count(page);
    await settle(page, n);
    await page.setInputFiles('input[type=file]', path.join(images, 'rotated6.jpg'));
    await settle(page, n + 2);
    s = await lastPreview(page);
    check(`${label}: EXIF-rotated photo is upright`, s.w === 600 && s.h === 800 && s.topRight[0] > 180, `${s.w}×${s.h} top-right ${s.topRight}`);

    n = await count(page);
    await page.setInputFiles('input[type=file]', path.join(images, 'notimage.jpg'));
    await page.waitForFunction((k) => document.querySelectorAll('.editor-msg').length >= k, n + 2, { timeout: 60_000 });
    check(`${label}: non-image is rejected clearly`, /Could not open this photo/.test(await page.locator('.editor-msg').last().textContent()));
    await page.screenshot({ path: path.join(out, `${label}.png`) });

    // Leaving the page shuts the engine down (memory goes back to the phone).
    await page.click('header a.new');
    await page.waitForURL(base + '/');
    check(`${label}: no page errors`, errors.length === 0, errors.slice(0, 2).join(' | '));
    await context.close();
  }
} finally {
  await browser.close();
  await emu.stop();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
