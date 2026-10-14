// Amazon Polly on Netlify: the function's own AWS runtime credentials are present (as on AWS Lambda), and the
// owner connects their own keys at /connect-polly. Every call to AWS must be signed with the owner's key.
// A fake AWS answers DescribeVoices locally. Usage (from SkyData_Website, after build.mjs):
//   node netlify-adapter/test/polly.e2e.mjs <project-dir> <setup-code-file>
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { startEmulator } from './emulator.mjs';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = require(process.env.PLAYWRIGHT ?? 'playwright');
const [project, codeFile] = process.argv.slice(2);
const code = readFileSync(codeFile, 'utf8').trim();
const OWNER_KEY = 'AKIAOWNERTESTKEY0001';
const RUNTIME_KEY = 'ASIANETLIFYRUNTIME01';

const signedWith = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const req = input instanceof Request ? input : new Request(input, init);
  if (/amazonaws\.com/.test(req.url)) {
    signedWith.push((req.headers.get('authorization') || '').match(/Credential=([A-Z0-9]+)\//)?.[1] ?? 'unsigned');
    return Response.json({ Voices: [{ Id: 'Matthew', Name: 'Matthew', LanguageCode: 'en-US', LanguageName: 'US English', Gender: 'Male', SupportedEngines: ['generative', 'neural', 'long-form', 'standard'] }, { Id: 'Ruth', Name: 'Ruth', LanguageCode: 'en-US', LanguageName: 'US English', Gender: 'Female', SupportedEngines: ['generative', 'long-form', 'neural'] }] }, { headers: { 'x-amzn-requestid': 'test' } });
  }
  return realFetch(input, init);
};

const emu = await startEmulator(project, { AWS_ACCESS_KEY_ID: RUNTIME_KEY, AWS_SECRET_ACCESS_KEY: 'runtime-secret-value-xxxxxxxxxxxxxxxx', AWS_SESSION_TOKEN: 'runtime-session-token', AWS_REGION: 'us-east-2' });
const base = emu.url.replace('127.0.0.1', 'localhost');
const browser = await chromium.launch();
let ok = true;
try {
  const page = await (await browser.newContext({ baseURL: base })).newPage();
  const PASSWORD = 'Polly test password 123';
  await page.goto('/owner-setup');
  await page.fill('input[name=code]', code);
  await page.fill('input[name=password]', PASSWORD);
  await page.fill('input[name=confirm]', PASSWORD);
  await page.click('button');
  await page.goto('/login');
  await page.fill('input[name=email]', 'skyariasa@gmail.com');
  await page.fill('input[name=password]', PASSWORD);
  await Promise.all([page.waitForLoadState('load'), page.click('form[action="/login"] button')]);

  await page.goto('/connect-polly');
  await page.fill('input[name=access]', OWNER_KEY);
  await page.fill('input[name=secret]', 'ownerSecretAccessKeyValue0123456789abcd');
  await Promise.all([page.waitForLoadState('load'), page.locator('form button[type=submit], form button').first().click()]);
  const saved = await page.textContent('body');
  const connectOk = /Credentials saved encrypted/.test(saved);
  console.log(`${connectOk ? 'PASS' : 'FAIL'}  Polly keys verified and saved — ${saved.match(/Credentials saved[^.]*\.|[^.]*(denied|rejected|could not)[^.]*\./i)?.[0] ?? saved.slice(0, 160)}`);
  ok &&= connectOk;

  const before = signedWith.length;
  await page.goto('/owner/voice');
  await page.waitForLoadState('networkidle');
  const body = await page.textContent('body');
  const catalogCalls = signedWith.slice(before);
  const voicesShown = /Matthew/.test(await page.content());
  const usedOwner = catalogCalls.length > 0 && catalogCalls.every((k) => k === OWNER_KEY);
  console.log(`${usedOwner ? 'PASS' : 'FAIL'}  voice list calls AWS with the owner's key — keys used: ${catalogCalls.join(', ') || 'none'}`);
  console.log(`${voicesShown && !/Voice access was denied/.test(body) ? 'PASS' : 'FAIL'}  /owner/voice lists the voices (Matthew) and no "denied" message`);
  ok &&= usedOwner && voicesShown && !/Voice access was denied/.test(body);
  console.log(`all AWS calls signed with: ${[...new Set(signedWith)].join(', ')}`);
} finally {
  await browser.close();
  await emu.stop();
}
process.exit(ok ? 0 : 1);
