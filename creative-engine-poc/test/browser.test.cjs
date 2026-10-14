// End-to-end browser test of the prototype with Playwright.
// Usage: node browser.test.cjs <base-url> <dir-with-test-images> <out-dir> [chromium|webkit|firefox]
// It drives the real page: upload → chat edit → preview → undo → download, on a desktop and an iPhone-sized context.
const { chromium, webkit, firefox, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const [base, imgDir, outDir, engine = 'chromium'] = process.argv.slice(2);
const browserType = { chromium, webkit, firefox }[engine];
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

// Mean RGB and grey-ness of the newest preview image, measured in the page.
async function lastPreviewStats(page) {
  return page.evaluate(async () => {
    const imgs = [...document.querySelectorAll('.msg img')];
    const img = imgs[imgs.length - 1];
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let r = 0, gg = 0, b = 0, spread = 0;
    const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) {
      r += d[i]; gg += d[i + 1]; b += d[i + 2];
      spread += Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
    }
    const tl = g.getImageData(5, 5, 1, 1).data;
    return { w: c.width, h: c.height, mean: [r / n, gg / n, b / n].map(Math.round), chroma: +(spread / n).toFixed(1), topLeft: [...tl.slice(0, 3)], previews: imgs.length };
  });
}

function jpegSize(buf) {
  for (let i = 2; i < buf.length - 9; ) {
    const m = buf[i + 1];
    if (m >= 0xc0 && m <= 0xc3) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return { w: 0, h: 0 };
}

async function waitForReply(page, count) {
  await page.waitForFunction((n) => document.querySelectorAll('.msg').length >= n && !document.getElementById('send').disabled, count, { timeout: 120_000 });
}

async function scenario(label, contextOptions) {
  const browser = await browserType.launch();
  const context = await browser.newContext({ ...contextOptions, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const t0 = Date.now();
  await page.goto(base);
  await page.waitForFunction(() => window.__engine, null, { timeout: 120_000 });
  const eng = await page.evaluate(() => window.__engine);
  check(`${label}: engine loads`, eng.commands > 100, `${eng.commands} allowed commands, ${Date.now() - t0} ms to ready`);

  // 1. Small photo: two edits in one message.
  let n = await page.locator('.msg').count();
  await page.setInputFiles('#file', path.join(imgDir, 'test.jpg'));
  await waitForReply(page, n + 2);
  let s = await lastPreviewStats(page);
  check(`${label}: upload shows preview`, s.w === 1024 && s.h === 683, `${s.w}×${s.h}, mean ${s.mean}`);
  const before = s;

  n = await page.locator('.msg').count();
  await page.fill('#prompt', 'make it brighter and black and white');
  await page.click('#send');
  await waitForReply(page, n + 2);
  s = await lastPreviewStats(page);
  const reply = await page.locator('.msg').nth(n + 1).innerText();
  check(`${label}: "brighter and black and white"`, s.chroma < 3 && s.mean[0] > before.mean[0] - 30, `chroma ${before.chroma}→${s.chroma}, mean ${before.mean}→${s.mean}; reply: ${reply.split('\n')[0]}`);

  n = await page.locator('.msg').count();
  await page.fill('#prompt', 'square crop then rotate right');
  await page.click('#send');
  await waitForReply(page, n + 2);
  s = await lastPreviewStats(page);
  const status = await page.locator('#status').innerText();
  check(`${label}: "square crop then rotate right"`, s.w === s.h && status.startsWith('800×800'), `${s.w}×${s.h}; status: ${status}`);

  n = await page.locator('.msg').count();
  await page.locator('.msg button', { hasText: 'Undo' }).last().click();
  await waitForReply(page, n + 1);
  s = await lastPreviewStats(page);
  check(`${label}: undo restores previous step`, s.w === 1024 && s.h === 683 && s.chroma < 3, `${s.w}×${s.h}, chroma ${s.chroma}`);

  n = await page.locator('.msg').count();
  await page.fill('#prompt', 'remove the person in the background');
  await page.click('#send');
  await waitForReply(page, n + 2);
  const unsupported = await page.locator('.msg').last().innerText();
  check(`${label}: unsupported request explained, nothing run`, /could not match/i.test(unsupported), unsupported.slice(0, 90));

  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('.msg button', { hasText: 'Download JPG' }).last().click()]);
  const dlPath = path.join(outDir, `${label}-${dl.suggestedFilename()}`);
  await dl.saveAs(dlPath);
  const head = fs.readFileSync(dlPath).subarray(0, 3);
  check(`${label}: download JPG`, head[0] === 0xff && head[1] === 0xd8, `${dl.suggestedFilename()}, ${fs.statSync(dlPath).size} bytes`);

  // 2. Safety: the in-browser bridge refuses file/script commands and file parameters even if sent directly.
  const refused = await page.evaluate(async () => {
    const { default: init, PhotoEditor } = await import('./pkg/skydata_photocraft_bridge.js');
    await init();
    const png = await (await fetch(document.querySelector('.msg img').src)).arrayBuffer();
    const ed = new PhotoEditor('a.png', new Uint8Array(png));
    const out = [];
    for (const plan of [
      [{ command: 'file.save', params: {} }],
      [{ command: 'file.scripts.run', params: {} }],
      [{ command: 'image.adjustments.colorLookup', params: { file: '/etc/passwd' } }],
      [{ command: 'filter.blur.gaussianBlur', params: { radius: 2, nested: { url: 'http://169.254.169.254/' } } }],
    ]) {
      try { ed.run(JSON.stringify(plan)); out.push('RAN'); } catch (e) { out.push(e.message); }
    }
    ed.free();
    return out;
  });
  check(`${label}: blocked commands/params refused in browser`, refused.every((r) => r !== 'RAN'), refused.map((r) => r.slice(0, 60)).join(' | '));

  // 3. iPhone-sized 12 MP photo: edits run on a 1600 px proxy; the download is rendered at full size.
  n = await page.locator('.msg').count();
  let t = Date.now();
  await page.setInputFiles('#file', path.join(imgDir, 'iphone12mp.jpg'));
  await waitForReply(page, n + 2);
  const openMs = Date.now() - t;
  n = await page.locator('.msg').count();
  t = Date.now();
  await page.fill('#prompt', 'auto enhance, warmer and sharpen');
  await page.click('#send');
  await waitForReply(page, n + 2);
  const editMs = Date.now() - t;
  n = await page.locator('.msg').count();
  await page.fill('#prompt', 'square crop');
  await page.click('#send');
  await waitForReply(page, n + 2);
  const st12 = await page.locator('#status').innerText();
  check(`${label}: 12 MP photo edited on a proxy`, st12.startsWith('1200×1200') && st12.includes('4032×3024'), `open ${openMs} ms, 5 engine steps ${editMs} ms; status: ${st12}`);
  t = Date.now();
  const [dl2] = await Promise.all([page.waitForEvent('download', { timeout: 300_000 }), page.locator('.msg button', { hasText: 'Download JPG' }).last().click()]);
  const dl2Path = path.join(outDir, `${label}-12mp-${dl2.suggestedFilename()}`);
  await dl2.saveAs(dl2Path);
  const exportMs = Date.now() - t;
  const dims = jpegSize(fs.readFileSync(dl2Path));
  check(`${label}: 12 MP full-size download`, dims.w === 3024 && dims.h === 3024, `${dims.w}×${dims.h}, ${fs.statSync(dl2Path).size} bytes, full-size render + export ${exportMs} ms`);

  // 4. EXIF-rotated JPEG comes in upright (the stored red corner moves to the top-right).
  n = await page.locator('.msg').count();
  await page.setInputFiles('#file', path.join(imgDir, 'rotated6.jpg'));
  await waitForReply(page, n + 2);
  const st6 = await page.locator('#status').innerText();
  s = await lastPreviewStats(page);
  const tr = await page.evaluate(() => { const img = [...document.querySelectorAll('.msg img')].pop(); const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const g = c.getContext('2d'); g.drawImage(img, 0, 0); return [...g.getImageData(c.width - 5, 5, 1, 1).data.slice(0, 3)]; });
  check(`${label}: EXIF-rotated photo upright`, st6.startsWith('600×800') && tr[0] > 180 && s.topLeft[1] > 120, `status: ${st6}; top-left ${s.topLeft} (green), top-right ${tr} (red marker)`);

  // 5. Not an image: clear error, page still usable.
  n = await page.locator('.msg').count();
  await page.setInputFiles('#file', path.join(imgDir, 'notimage.jpg'));
  await page.waitForFunction((k) => document.querySelectorAll('.msg').length >= k && document.querySelector('.msg:last-child').classList.contains('err'), n + 2, { timeout: 60_000 });
  const bad = await page.locator('.msg').last().innerText();
  check(`${label}: non-image rejected clearly`, /could not open/i.test(bad), bad.slice(0, 100));

  await page.screenshot({ path: path.join(outDir, `${label}.png`), fullPage: false });
  check(`${label}: no page errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  await scenario(`${engine}-desktop`, { viewport: { width: 1280, height: 860 } });
  const phone = devices['iPhone 13'];
  // In Chromium this emulates the iPhone screen, touch and user agent only; the engine underneath is still Chromium.
  await scenario(`${engine}-iphone13-emulated`, engine === 'firefox' ? { viewport: phone.viewport } : phone);
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  fs.writeFileSync(path.join(outDir, `results-${engine}.json`), JSON.stringify(results, null, 2));
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
