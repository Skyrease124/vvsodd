// SkyData Editor people-photo tools (remove/blur/colour the background, colour splash, skin and face touch-ups), in a
// real browser on the local Netlify stand-in, with the on-device cutout model and a fake NVIDIA for the AI cases.
// Usage (from SkyData_Website, after build.mjs):
//   node netlify-adapter/test/cutout.e2e.mjs <project> <code-file> <images-dir> <portrait> <out-dir>
// <images-dir> holds test.jpg (no person). <portrait> is any photo of one person, about 600–1000 px (not included in
// the repository); a 4× enlargement of it is made to test the full-size download.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { startEmulator } from './emulator.mjs';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = require(process.env.PLAYWRIGHT ?? 'playwright');
const [project, codeFile, images, portrait, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push(Boolean(ok));
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

let nextReply = '';
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const req = input instanceof Request ? input : new Request(input, init);
  if (req.url.startsWith('https://integrate.api.nvidia.com/')) return Response.json({ choices: [{ message: { role: 'assistant', content: nextReply } }], usage: { prompt_tokens: 1, completion_tokens: 1 } });
  return realFetch(input, init);
};

const emu = await startEmulator(project, { NVIDIA_API_KEY: 'synthetic-test-key-not-real-0123456789' });
const base = emu.url.replace('127.0.0.1', 'localhost');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ baseURL: base, acceptDownloads: true, viewport: { width: 1100, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  const P = 'Cutout test password 123';
  await page.goto('/owner-setup');
  await page.fill('input[name=code]', readFileSync(codeFile, 'utf8').trim());
  await page.fill('input[name=password]', P);
  await page.fill('input[name=confirm]', P);
  await page.click('button');
  await page.goto('/login');
  await page.fill('input[name=email]', 'skyariasa@gmail.com');
  await page.fill('input[name=password]', P);
  await Promise.all([page.waitForLoadState('load'), page.click('form[action="/login"] button')]);
  await page.goto('/editor');
  await page.waitForFunction(() => document.querySelector('.editor-status')?.textContent?.startsWith('Ready'), null, { timeout: 120_000 });

  const count = () => page.locator('.editor-msg').count();
  const settle = (k) => page.waitForFunction((n) => document.querySelectorAll('.editor-msg').length >= n && !document.querySelector('.editor-upload')?.disabled, k, { timeout: 300_000 });
  const last = () => page.locator('.editor-msg').last();
  const open = async (file) => {
    const n = await count();
    await page.setInputFiles('input[type=file]', file);
    await settle(n + 2);
  };
  const ask = async (text) => {
    const n = await count();
    const t = Date.now();
    await page.fill('.editor-input', text);
    await page.click('.editor-send');
    await settle(n + 2);
    return { text: (await last().locator('p').textContent()) ?? '', hasImage: (await last().locator('img').count()) > 0, ms: Date.now() - t };
  };
  const undo = async () => {
    const n = await count();
    await page.locator('.editor-msg').filter({ has: page.locator('.editor-actions button', { hasText: 'Undo' }) }).last().locator('.editor-actions button', { hasText: 'Undo' }).click();
    await settle(n + 1);
  };
  // Average colour and alpha in a box (fractions of the image), plus colourfulness, of the latest preview.
  const probe = (box, name) => page.evaluate(async ([b, name]) => {
    const img = [...document.querySelectorAll('.editor-msg img')].pop();
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const x = Math.round(b[0] * c.width), y = Math.round(b[1] * c.height), w = Math.max(1, Math.round(b[2] * c.width)), h = Math.max(1, Math.round(b[3] * c.height));
    const d = g.getImageData(x, y, w, h).data;
    let r = 0, gg = 0, bb = 0, a = 0, chroma = 0, edge = 0;
    for (let i = 0; i < d.length; i += 4) {
      r += d[i]; gg += d[i + 1]; bb += d[i + 2]; a += d[i + 3];
      chroma += Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
      if (i >= 4) edge += Math.abs(d[i] - d[i - 4]);
    }
    const n = d.length / 4;
    if (name) {
      const a2 = document.createElement('a');
      a2.download = name;
    }
    return { r: Math.round(r / n), g: Math.round(gg / n), b: Math.round(bb / n), a: Math.round(a / n), chroma: Math.round(chroma / n), detail: +(edge / n).toFixed(1) };
  }, [box, name]);
  const shots = [];
  const keep = async (label) => {
    const src = await page.evaluate(() => [...document.querySelectorAll('.editor-msg img')].pop().src);
    const bytes = await page.evaluate(async (u) => {
      const b = await (await fetch(u)).arrayBuffer();
      return [...new Uint8Array(b)];
    }, src);
    const file = path.join(out, `cutout-${label}.png`);
    writeFileSync(file, Buffer.from(bytes));
    shots.push(file);
  };
  const BG = [0.0, 0.0, 0.14, 0.14]; // top-left corner: sky and mountains
  const CITY = [0.8, 0.35, 0.18, 0.3]; // buildings on the right: background with detail
  const FACE = [0.4, 0.45, 0.2, 0.12]; // middle of the face

  // 1. A photo with no person: the tools say so and nothing changes.
  await open(path.join(images, 'test.jpg'));
  let r = await ask('blur the background');
  check('no person in the photo: explained, nothing changes', !r.hasImage && /couldn't find a person/.test(r.text), r.text);

  await open(portrait);
  const before = { bg: await probe(BG), city: await probe(CITY), face: await probe(FACE) };
  await keep('0-original');

  // 2. Blur the background: the background loses detail, the face keeps it.
  r = await ask('blur the background');
  let bg = await probe(BG), face = await probe(FACE);
  const city = await probe(CITY);
  check('blur the background (quick phrase, on the device)', r.hasImage && r.text === 'Done: blurred the background.' && city.detail < before.city.detail * 0.6 && face.detail > before.face.detail * 0.85, `${r.ms} ms; background detail ${before.city.detail} → ${city.detail}, face ${before.face.detail} → ${face.detail}`);
  await keep('1-blur-background');
  await undo();

  // 3. Remove the background: see-through around the person, the face untouched.
  r = await ask('remove the background');
  bg = await probe(BG); face = await probe(FACE);
  check('remove the background: see-through background, face kept', r.hasImage && /removed the background/.test(r.text) && bg.a < 20 && face.a > 240, `background alpha ${bg.a}, face alpha ${face.a}`);
  await keep('2-remove-background');
  const [dl] = await Promise.all([page.waitForEvent('download'), last().locator('.editor-actions button', { hasText: 'Download PNG' }).click()]);
  await settle(await count());
  const pngAlpha = await page.evaluate(async (bytes) => {
    const bmp = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const g = c.getContext('2d');
    g.drawImage(bmp, 0, 0);
    return [g.getImageData(2, 2, 1, 1).data[3], g.getImageData(Math.round(bmp.width / 2), Math.round(bmp.height / 2), 1, 1).data[3]];
  }, [...readFileSync(await dl.path())]);
  check('Download PNG keeps the see-through background', pngAlpha[0] === 0 && pngAlpha[1] === 255, `corner alpha ${pngAlpha[0]}, centre alpha ${pngAlpha[1]}`);
  let n = await count();
  await page.locator('.editor-msg').filter({ has: page.locator('img') }).last().locator('.editor-actions button', { hasText: 'Save to My Files' }).click();
  await settle(n + 1);
  check('Save to My Files keeps it see-through (PNG)', /Saved ".+" in My Files/.test(await last().locator('p').textContent()));
  await undo();

  // 4. White background.
  r = await ask('put me on a white background');
  bg = await probe(BG); face = await probe(FACE);
  check('white background', r.hasImage && bg.r > 240 && bg.g > 240 && bg.b > 240 && bg.a === 255 && face.r < 230, `background ${bg.r},${bg.g},${bg.b}; face ${face.r},${face.g},${face.b}`);
  await keep('3-white-background');
  await undo();

  // 5. Colour splash: background black and white, the person still in colour.
  r = await ask('make the background black and white');
  bg = await probe(BG); face = await probe(FACE);
  check('black and white background, person in colour', r.hasImage && bg.chroma <= 3 && face.chroma > before.face.chroma * 0.8, `background colourfulness ${before.bg.chroma} → ${bg.chroma}, face ${before.face.chroma} → ${face.chroma}`);
  await keep('4-colour-splash');
  await undo();

  // 6. Skin smoothing: the face is smoother, the background unchanged.
  r = await ask('smooth my skin');
  bg = await probe(BG); face = await probe(FACE);
  const city2 = await probe(CITY);
  check('smooth the skin: face smoother, background unchanged', r.hasImage && r.text === 'Done: smoothed the skin.' && face.detail < before.face.detail && Math.abs(city2.detail - before.city.detail) < 0.3, `face detail ${before.face.detail} → ${face.detail}, background ${before.city.detail} → ${city2.detail}`);
  await keep('5-smooth-skin');

  // 7. Two people-photo steps in one request (each finds the person again on the picture so far), then undo once.
  r = await ask('brighten my face and blur the background');
  check('two people-photo steps in one request', r.hasImage && r.text === 'Done: brightened the face, blurred the background.', r.text);
  await keep('6-face-and-blur');
  await undo();
  await undo();

  // 8. The AI can use the people-photo tools; a part edit that crops is refused.
  nextReply = '{"steps":[{"command":"skydata.region","params":{"region":"background","steps":[{"command":"image.adjustments.exposure","params":{"exposure":-1.2}},{"command":"image.adjustments.hueSaturation","params":{"saturation":-40}}]}}],"reply":"Dimmed and muted the background so you stand out."}';
  r = await ask('make the scenery behind me moody so I stand out');
  bg = await probe(BG);
  check('AI plan with a background-only edit', r.hasImage && r.text === 'Dimmed and muted the background so you stand out.' && bg.r < before.bg.r - 30, `${r.text} · background ${before.bg.r} → ${bg.r}`);
  await undo();
  nextReply = '{"steps":[{"command":"skydata.region","params":{"region":"face","steps":[{"command":"image.crop","params":{"x":0,"y":0,"width":10,"height":10}}]}}],"reply":"Cropped."}';
  r = await ask('zoom into my face with the region tool');
  check('AI plan that crops inside a part is refused', !r.hasImage && /can't be used on one part/.test(r.text), r.text);

  // 9. Full-size: a 4× photo is edited on a 1600 px copy; the download applies the same cutout at full size.
  const big = path.join(out, 'portrait-4x.png');
  const bigBytes = await page.evaluate(async (bytes) => {
    const bmp = await createImageBitmap(new Blob([new Uint8Array(bytes)]));
    const c = new OffscreenCanvas(bmp.width * 4, bmp.height * 4);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return [...new Uint8Array(await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer())];
  }, [...readFileSync(portrait)]);
  writeFileSync(big, Buffer.from(bigBytes));
  await open(big);
  r = await ask('remove the background');
  const [dl2] = await Promise.all([page.waitForEvent('download', { timeout: 300_000 }), last().locator('.editor-actions button', { hasText: 'Download PNG' }).click()]);
  const full = await page.evaluate(async (bytes) => {
    const bmp = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const g = c.getContext('2d');
    g.drawImage(bmp, 0, 0);
    return { w: bmp.width, h: bmp.height, corner: g.getImageData(8, 8, 1, 1).data[3], centre: g.getImageData(Math.round(bmp.width / 2), Math.round(bmp.height / 2), 1, 1).data[3] };
  }, [...readFileSync(await dl2.path())]);
  const status = (await page.locator('.editor-status').textContent()) ?? '';
  check('full-size download applies the cutout at full size', r.hasImage && /preview of a/.test(status) && full.corner === 0 && full.centre === 255 && full.w > 2000, `${full.w}×${full.h}, corner alpha ${full.corner}, centre ${full.centre}`);

  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  writeFileSync(path.join(out, 'cutout-shots.json'), JSON.stringify(shots));
} finally {
  await browser.close();
  await emu.stop();
}
console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
process.exit(results.every(Boolean) ? 0 : 1);
