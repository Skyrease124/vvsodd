// My Files (Creative Files): save from the Editor, list, reopen and keep editing, download, delete, in a real browser
// on the local Netlify stand-in, at desktop and iPhone size.
// Usage (from SkyData_Website, after build.mjs): node netlify-adapter/test/files.e2e.mjs <project> <code-file> <images-dir> <out-dir>
// <images-dir> holds test.jpg (1200×800) and iphone12mp.jpg (4032×3024).
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { startEmulator } from './emulator.mjs';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium, devices } = require(process.env.PLAYWRIGHT ?? 'playwright');
const [project, codeFile, images, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push(Boolean(ok));
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
const EMAIL = 'skyariasa@gmail.com';
const PASSWORD = 'Files test password 123';

const emu = await startEmulator(project);
const base = emu.url.replace('127.0.0.1', 'localhost');
const browser = await chromium.launch();
try {
  const anon = await fetch(base + '/files', { redirect: 'manual' });
  check('signed-out /files shows the login page', (await anon.text()).includes('Invite-only access'), String(anon.status));

  const setup = await browser.newPage({ baseURL: base });
  await setup.goto('/owner-setup');
  await setup.fill('input[name=code]', readFileSync(codeFile, 'utf8').trim());
  await setup.fill('input[name=password]', PASSWORD);
  await setup.fill('input[name=confirm]', PASSWORD);
  await setup.click('button');
  await setup.close();

  for (const [label, opts] of [['desktop', { viewport: { width: 1280, height: 860 } }], ['iphone13', devices['iPhone 13']]]) {
    const context = await browser.newContext({ ...opts, baseURL: base, acceptDownloads: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('dialog', (d) => d.accept());
    await page.goto('/login');
    await page.fill('input[name=email]', EMAIL);
    await page.fill('input[name=password]', PASSWORD);
    await Promise.all([page.waitForLoadState('load'), page.click('form[action="/login"] button')]);

    const count = () => page.locator('.editor-msg').count();
    const settle = (n) => page.waitForFunction((k) => document.querySelectorAll('.editor-msg').length >= k && !document.querySelector('.editor-upload')?.disabled, n, { timeout: 300_000 });
    const last = () => page.locator('.editor-msg').last();
    const ask = async (text) => {
      const n = await count();
      await page.fill('.editor-input', text);
      await page.click('.editor-send');
      await settle(n + 2);
    };
    const save = async () => {
      const n = await count();
      await last().locator('.editor-actions button', { hasText: 'Save to My Files' }).click();
      await settle(n + 1);
      return (await last().locator('p').textContent()) ?? '';
    };
    const preview = () => page.evaluate(async () => {
      const img = [...document.querySelectorAll('.editor-msg img')].pop();
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let s = 0;
      for (let i = 0; i < d.length; i += 4) s += Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
      return { w: c.width, h: c.height, chroma: +(s / (d.length / 4)).toFixed(1) };
    });
    const cards = () => page.locator('.files-card');
    const openFiles = async () => {
      await page.goto('/files');
      await page.waitForFunction(() => !document.querySelector('.files-status')?.textContent?.startsWith('Loading'), null, { timeout: 30_000 });
    };
    const download = async (card) => {
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 300_000 }), card.locator('button', { hasText: /^Download$/ }).click()]);
      const buf = readFileSync(await dl.path());
      return { name: dl.suggestedFilename(), head: [buf[0], buf[1]], ...jpegSize(buf) };
    };

    await openFiles();
    check(`${label}: My Files starts empty, with the on-device note`, (await page.locator('.files-empty').count()) === 1 && /stored only in this browser on this device/.test(await page.locator('.files-note').textContent()));

    // Edit a photo and save it.
    await page.locator('.files-empty a', { hasText: 'Open the Editor' }).click();
    await page.waitForFunction(() => document.querySelector('.editor-status')?.textContent?.startsWith('Ready'), null, { timeout: 120_000 });
    check(`${label}: the Editor has a My Files link`, (await page.locator('header a[href="/files"]').count()) === 1);
    let n = await count();
    await page.setInputFiles('input[type=file]', path.join(images, 'test.jpg'));
    await settle(n + 2);
    await ask('black and white');
    let text = await save();
    check(`${label}: Save to My Files`, /^Saved "test" in My Files \(1200×800 px\)/.test(text) && (await last().locator('a[href="/files"]').count()) === 1, text);
    await ask('square crop');
    text = await save();
    check(`${label}: saving again updates the same file`, /^Updated "test" in My Files \(800×800 px\)/.test(text), text);

    // The list.
    await openFiles();
    const info = await cards().first().locator('.files-info').textContent();
    const thumbOk = await cards().first().locator('img').evaluate(async (img) => (await img.decode().then(() => true, () => false)) && img.naturalWidth > 0 && img.naturalWidth <= 360);
    check(`${label}: one file listed with a thumbnail and details`, (await cards().count()) === 1 && thumbOk && /800×800 px/.test(info) && /2 edits/.test(info), info);
    let dl = await download(cards().first());
    check(`${label}: download from My Files is the full-size edited JPG`, dl.head[0] === 0xff && dl.head[1] === 0xd8 && dl.w === 800 && dl.h === 800 && dl.name === 'test-edited.jpg', `${dl.name} ${dl.w}×${dl.h}`);
    const usage = await page.locator('.files-usage').textContent().catch(() => '');
    check(`${label}: storage use is shown`, /Using .+ on this device/.test(usage), usage);

    // Reopen it and keep editing.
    await cards().first().locator('a', { hasText: 'Edit' }).click();
    await page.waitForURL('**/editor?file=*');
    await page.waitForFunction(() => /^Opened "test" from My Files/.test([...document.querySelectorAll('.editor-msg p')].pop()?.textContent ?? '') || /Could not open/.test(document.body.textContent), null, { timeout: 120_000 });
    let s = await preview();
    text = (await last().locator('p').textContent()) ?? '';
    check(`${label}: reopening shows the saved edits (square, black and white)`, /with its 2 edits/.test(text) && s.w === s.h && s.chroma < 3, `${text} · ${s.w}×${s.h} chroma ${s.chroma}`);
    n = await count();
    await last().locator('.editor-actions button', { hasText: 'Undo' }).click();
    await settle(n + 1);
    s = await preview();
    check(`${label}: undo works on a reopened file (crop undone, still black and white)`, s.w !== s.h && s.chroma < 3, `${s.w}×${s.h}`);
    text = await save();
    check(`${label}: saving a reopened file updates it`, /^Updated "test"/.test(text), text);

    // A second, large photo.
    n = await count();
    await page.setInputFiles('input[type=file]', path.join(images, 'iphone12mp.jpg'));
    await settle(n + 2);
    await ask('warmer');
    text = await save();
    check(`${label}: a new photo is saved as a new file at full size`, /^Saved "iphone12mp" in My Files \(4032×3024 px\)/.test(text), text);

    await page.reload();
    await openFiles();
    const names = await cards().locator('.files-info strong').allTextContents();
    const firstInfo = await cards().nth(1).locator('.files-info').textContent();
    check(`${label}: both files are kept after a reload, newest first`, names.join(',') === 'iphone12mp,test' && /1 edit\b/.test(firstInfo), `${names} · ${firstInfo}`);
    dl = await download(cards().first());
    check(`${label}: the 12 MP file downloads at full size`, dl.w === 4032 && dl.h === 3024, `${dl.w}×${dl.h}`);

    // The files belong to this account: the database name is derived from the account email.
    const dbs = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
    const expected = 'skydata-creative-files-' + createHash('sha256').update(EMAIL).digest('hex').slice(0, 16);
    check(`${label}: files are stored per account`, dbs.includes(expected) && !dbs.some((d) => d.includes('@')), dbs.join(','));

    await page.screenshot({ path: path.join(out, `files-${label}.png`), fullPage: true });
    await cards().filter({ hasText: 'iphone12mp' }).locator('button', { hasText: 'Delete' }).click();
    await page.waitForFunction(() => document.querySelectorAll('.files-card').length === 1, null, { timeout: 30_000 });
    check(`${label}: delete removes the file`, (await cards().locator('.files-info strong').allTextContents()).join() === 'test');

    // Signed out, My Files is not reachable.
    await page.goto('/account');
    const logout = page.locator('form[action="/logout"] button');
    if (await logout.count()) {
      await Promise.all([page.waitForLoadState('load'), logout.first().click()]);
      await page.goto('/files');
      check(`${label}: after signing out, My Files asks to sign in`, (await page.content()).includes('Invite-only access'));
    } else check(`${label}: after signing out, My Files asks to sign in`, false, 'no sign-out button found on /account');
    check(`${label}: no page errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
    await context.close();
  }
} finally {
  await browser.close();
  await emu.stop();
}
console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
process.exit(results.every(Boolean) ? 0 : 1);
