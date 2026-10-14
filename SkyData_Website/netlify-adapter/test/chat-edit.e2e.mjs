// "Edit in Editor" on a chat photo: the photo opens in the Editor at full size (the chat itself sends a 1024 px copy),
// in a real browser on the local Netlify stand-in, at desktop and iPhone size. The chat's photo AI is answered by a
// stand-in inside the browser (this test is about the button and the hand-off, not the AI).
// Usage (from SkyData_Website, after build.mjs): node netlify-adapter/test/chat-edit.e2e.mjs <project> <code-file> <images-dir>
// <images-dir> holds iphone12mp.jpg (4032×3024).
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { startEmulator } from './emulator.mjs';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium, devices } = require(process.env.PLAYWRIGHT ?? 'playwright');
const [project, codeFile, images] = process.argv.slice(2);
const results = [];
const check = (name, ok, detail = '') => {
  results.push(Boolean(ok));
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};
const PASSWORD = 'Chat edit test password 1';

const emu = await startEmulator(project);
const base = emu.url.replace('127.0.0.1', 'localhost');
const browser = await chromium.launch();
try {
  const setup = await browser.newPage({ baseURL: base });
  await setup.goto('/owner-setup');
  await setup.fill('input[name=code]', readFileSync(codeFile, 'utf8').trim());
  await setup.fill('input[name=password]', PASSWORD);
  await setup.fill('input[name=confirm]', PASSWORD);
  await setup.click('button');
  await setup.close();

  for (const [label, opts] of [['desktop', { viewport: { width: 1280, height: 860 } }], ['iphone13', devices['iPhone 13']]]) {
    const context = await browser.newContext({ ...opts, baseURL: base });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    let visionImage = '';
    // Stand-ins: photo questions are switched on, and the photo AI answers in one line.
    await page.route('**/api/status', async (route) => {
      const real = await (await route.fetch()).json();
      await route.fulfill({ json: { ...real, configured: true, visionConfigured: true } });
    });
    await page.route('**/api/vision', async (route) => {
      const body = route.request().postDataJSON();
      visionImage = body.messages.at(-1).image ?? '';
      await route.fulfill({ json: { content: 'A colourful test picture.', model: 'stand-in' } });
    });
    await page.goto('/login');
    await page.fill('input[name=email]', 'skyariasa@gmail.com');
    await page.fill('input[name=password]', PASSWORD);
    await Promise.all([page.waitForLoadState('load'), page.click('form[action="/login"] button')]);
    await page.goto('/');
    await page.waitForFunction(() => document.querySelector('input[type=file][accept="image/*"]:not([capture])'), null, { timeout: 30_000 });

    // Send a photo in the chat.
    await page.setInputFiles('input[type=file][accept="image/*"]:not([capture])', path.join(images, 'iphone12mp.jpg'));
    await page.waitForSelector('.photo-preview img', { timeout: 30_000 });
    await page.fill('textarea[aria-label="Message SkyData"]', 'What is this?');
    await page.click('button.send-button');
    await page.waitForFunction(() => document.body.textContent.includes('A colourful test picture.'), null, { timeout: 30_000 });
    const sent = await page.evaluate(async (src) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      return [img.naturalWidth, img.naturalHeight];
    }, visionImage);
    check(`${label}: the chat sends its usual 1024 px copy to the AI`, sent[0] === 1024 && sent[1] === 768, sent.join('×'));
    const button = page.locator('article.user button.edit-photo-link');
    check(`${label}: the sent photo has an Edit in Editor button`, (await button.count()) === 1 && /Edit in Editor/.test(await button.textContent()));

    // Open it in the Editor: the original arrives, at full size.
    await Promise.all([page.waitForURL('**/editor?from=chat'), button.click()]);
    await page.waitForFunction(() => document.querySelectorAll('.editor-msg img').length > 0 || document.querySelector('.editor-msg.err'), null, { timeout: 120_000 });
    const opened = (await page.locator('.editor-msg').nth(1).textContent()) ?? '';
    const status = (await page.locator('.editor-status').textContent()) ?? '';
    check(`${label}: the Editor opens the original photo at full size`, /iphone12mp\.jpg/.test(opened) && /4032×3024 px/.test(opened) && /4032×3024/.test(status), `${opened.slice(0, 80)} · ${status}`);
    const n = await page.locator('.editor-msg').count();
    await page.fill('.editor-input', 'black and white');
    await page.click('.editor-send');
    await page.waitForFunction((k) => document.querySelectorAll('.editor-msg').length >= k + 2 && !document.querySelector('.editor-upload')?.disabled, n, { timeout: 120_000 });
    check(`${label}: it can be edited right away`, /black and white/i.test(await page.locator('.editor-msg').last().textContent()));

    // The hand-off is used once: opening the link again does not reopen the photo.
    await page.goto('/editor?from=chat');
    await page.waitForFunction(() => document.querySelector('.editor-msg.err'), null, { timeout: 120_000 });
    check(`${label}: the hand-off is cleared after use`, /no longer waiting/.test(await page.locator('.editor-msg.err').last().textContent()));
    check(`${label}: no page errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
    await context.close();
  }
} finally {
  await browser.close();
  await emu.stop();
}
console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
process.exit(results.every(Boolean) ? 0 : 1);
