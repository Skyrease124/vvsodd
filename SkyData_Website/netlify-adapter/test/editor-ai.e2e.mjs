// SkyData Editor + AI planner, in a real browser on the local Netlify stand-in, with a fake NVIDIA that returns
// chosen edit plans. Usage (from SkyData_Website, after build.mjs):
//   node netlify-adapter/test/editor-ai.e2e.mjs <project> <code-file> <images-dir>
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { startEmulator } from './emulator.mjs';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = require(process.env.PLAYWRIGHT ?? 'playwright');
const [project, codeFile, images] = process.argv.slice(2);
const results = [];
const check = (name, ok, detail = '') => {
  results.push(Boolean(ok));
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

// The fake model answers with whatever plan the current test step sets.
let nextReply = '';
const aiCalls = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const req = input instanceof Request ? input : new Request(input, init);
  if (req.url.startsWith('https://integrate.api.nvidia.com/')) {
    const body = await req.json();
    aiCalls.push(body);
    return Response.json({ choices: [{ message: { role: 'assistant', content: nextReply } }], usage: { prompt_tokens: 1, completion_tokens: 1 } });
  }
  return realFetch(input, init);
};

const emu = await startEmulator(project, { NVIDIA_API_KEY: 'synthetic-test-key-not-real-0123456789' });
const base = emu.url.replace('127.0.0.1', 'localhost');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ baseURL: base });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const P = 'Editor AI test password 1';
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
  const settle = (k) => page.waitForFunction((n) => document.querySelectorAll('.editor-msg').length >= n && !document.querySelector('.editor-upload')?.disabled, k, { timeout: 120_000 });
  const ask = async (text) => {
    const n = await count();
    await page.fill('.editor-input', text);
    await page.click('.editor-send');
    await settle(n + 2);
    const last = page.locator('.editor-msg').last();
    return { text: (await last.locator('p').textContent()) ?? '', hasImage: (await last.locator('img').count()) > 0 };
  };
  const chroma = () => page.evaluate(async () => {
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
    return +(s / (d.length / 4)).toFixed(1);
  });

  let n = await count();
  await page.setInputFiles('input[type=file]', path.join(images, 'test.jpg'));
  await settle(n + 2);
  const before = await chroma();

  // 1. A known phrase never reaches the AI.
  let r = await ask('brighter');
  check('quick phrase is handled on the device (no AI call)', r.hasImage && aiCalls.length === 0, r.text);

  // 2. A free-form look goes to SkyData AI; its plan is applied.
  nextReply = '<think>planning</think>```json\n{"steps":[{"command":"image.adjustments.hueSaturation","params":{"saturation":-100}},{"command":"image.adjustments.photoFilter","params":{"filter":"sepia","density":60}},{"command":"filter.noise.addNoise","params":{"amount":6,"distribution":"gaussian","monochromatic":true}}],"reply":"Gave it a warm faded 70s film look."}\n```';
  r = await ask('make it look like an old 70s photo');
  const call = aiCalls.at(-1);
  const system = call?.messages?.find((m) => m.role === 'system')?.content ?? '';
  const after = await chroma();
  check('free-form request is planned by SkyData AI and applied', r.hasImage && r.text === 'Gave it a warm faded 70s film look.' && after < before, `reply "${r.text}", colourfulness ${before} → ${after}`);
  check('AI request uses the fast free model and the Editor tool list', call?.model === 'nvidia/nemotron-3.5-lightning-30b-a3b' && system.includes('image.adjustments.curves') && call?.messages?.at(-1)?.content.includes('Image size: 1200×800'), `model ${call?.model}`);
  check('only the words were sent to the AI (no photo)', !JSON.stringify(call).includes('data:image') && JSON.stringify(call).length < 60000, `${JSON.stringify(call).length} bytes`);

  // 3. A plan with a tool the Editor doesn't allow is refused; nothing runs.
  nextReply = '{"steps":[{"command":"file.save","params":{}}],"reply":"Saved."}';
  n = await count();
  r = await ask('save it to my computer');
  check('AI plan with a forbidden tool is refused', !r.hasImage && /tool the Editor doesn't have/.test(r.text), r.text);

  // 4. A plan pointing at a file is refused.
  nextReply = '{"steps":[{"command":"image.adjustments.colorLookup","params":{"file":"/etc/passwd"}}],"reply":"Applied a LUT."}';
  r = await ask('apply my cinematic LUT');
  check('AI plan with a file parameter is refused', !r.hasImage && /does not allow/.test(r.text), r.text);

  // 5. The AI says it can't: the explanation is shown, nothing runs.
  nextReply = '{"steps":[],"reply":"I can\'t remove people from photos, but I can blur the whole image or crop them out."}';
  r = await ask('remove the person on the left');
  check('impossible request is explained by the AI', !r.hasImage && /can't remove people/.test(r.text), r.text);

  // 6. Mixed request where the AI is unavailable: the understood part still runs.
  nextReply = 'not json at all';
  r = await ask('sharpen and make it dreamy');
  check('if the AI fails, the understood phrases still apply', r.hasImage && /sharpened/.test(r.text) && /unavailable/.test(r.text), r.text);

  // 7. Numbers written as text (what the live model sent for colour balance) are converted, and the edit applies.
  nextReply = '{"steps":[{"command":"image.adjustments.colorBalance","params":{"shadows":["+10","0","-15"],"midtones":["20","-5","-25"]}},{"command":"filter.noise.addNoise","params":{"amount":"5"}}],"reply":"Warm 70s tones."}';
  r = await ask('make it look like a 1970s postcard');
  check('quoted numbers from the AI still work', r.hasImage && r.text === 'Warm 70s tones.', r.text);

  // 8. One step the engine rejects is skipped and named; the rest of the AI plan still applies.
  nextReply = '{"steps":[{"command":"image.crop","params":{"x":0,"y":0,"width":0,"height":10}},{"command":"image.adjustments.hueSaturation","params":{"saturation":-40}},{"command":"filter.blur.gaussianBlur","params":{"radius":5000}}],"reply":"Faded the colours."}';
  r = await ask('fade the colours like old film');
  check('a step that cannot be fixed is skipped, an out-of-range number is brought into range, the rest applies', r.hasImage && /^Faded the colours\. \(Skipped one step the editor couldn't apply: crop\.\)$/.test(r.text), r.text);
  n = await count();
  await page.locator('.editor-actions button', { hasText: 'Undo' }).last().click();
  await settle(n + 1);
  check('undo after a skipped step works', (await page.locator('.editor-msg').last().locator('p').textContent()) === 'Undid the last edit.');

  // 9. A setting in the wrong shape (what the live model sent for hue/saturation) is left out; the step still runs.
  nextReply = '{"steps":[{"command":"image.adjustments.hueSaturation","params":{"saturation":-30,"reds":-20,"colorize":"false"}},{"command":"image.adjustments.photoFilter","params":{"filter":"sepia","density":40}}],"reply":"Old film colours."}';
  r = await ask("make it look like a 1970s print from grandma's album");
  check('a wrongly shaped setting is left out and the rest applies', r.hasImage && r.text === "Old film colours. (Left out settings the editor couldn't use: reds in hue saturation.)", r.text);

  // The download re-renders at full size (the 4032×3024 photo is edited on a 1600 px copy), scaling the blur radius past
  // the engine's 1000 limit; it is brought back to the limit.
  n = await count();
  await page.setInputFiles('input[type=file]', path.join(images, 'iphone12mp.jpg'));
  await settle(n + 2);
  nextReply = '{"steps":[{"command":"filter.blur.gaussianBlur","params":{"radius":1000}}],"reply":"Very soft."}';
  r = await ask('make it as dreamy as a fog bank');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 300_000 }), page.locator('.editor-actions button', { hasText: 'Download JPG' }).last().click()]);
  const head = readFileSync(await dl.path()).subarray(0, 2);
  check('full-size download works when a scaled setting passes the limit', r.hasImage && head[0] === 0xff && head[1] === 0xd8, r.text);
  check('no page errors', errors.length === 0, errors.join(' | '));
  console.log(`AI calls made: ${aiCalls.length}`);
} finally {
  await browser.close();
  await emu.stop();
}
console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
process.exit(results.every(Boolean) ? 0 : 1);
