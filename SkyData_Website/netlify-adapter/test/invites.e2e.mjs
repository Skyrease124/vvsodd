// Owner invite links: approve an email, send the one-time link, the member creates a password and signs in;
// links are single-use, replaceable, expire, die on revoke, and double as password resets. Real browser on the
// local Netlify stand-in. Usage (from SkyData_Website, after build.mjs):
//   node netlify-adapter/test/invites.e2e.mjs <project> <code-file>
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { startEmulator } from './emulator.mjs';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = require(process.env.PLAYWRIGHT ?? 'playwright');
const pg = require('./netlify-adapter/node_modules/pg');
const [project, codeFile] = process.argv.slice(2);
const results = [];
const check = (name, ok, detail = '') => {
  results.push(Boolean(ok));
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};
const OWNER = 'skyariasa@gmail.com';
const OWNER_PASSWORD = 'Invite test owner password 1';
const MEMBER = 'friend@example.com';
const MEMBER_PASSWORD = 'Friend password 12345';

const emu = await startEmulator(project);
const base = emu.url.replace('127.0.0.1', 'localhost'); // __Host- cookies need a secure context
const browser = await chromium.launch();
const db = new pg.Client({ connectionString: emu.connectionString });
await db.connect();
try {
  const anon = await (await fetch(base + '/login')).text();
  check('login page points new members to their invite link', anon.includes('invite link the SkyData owner sent you') && !anon.includes('Verify email with ChatGPT'));
  const junk = await fetch(base + '/invite?t=' + 'a'.repeat(64));
  check('an unknown link is refused', junk.status === 410, String(junk.status));

  const owner = await browser.newPage({ baseURL: base });
  await owner.goto('/owner-setup');
  await owner.fill('input[name=code]', readFileSync(codeFile, 'utf8').trim());
  await owner.fill('input[name=password]', OWNER_PASSWORD);
  await owner.fill('input[name=confirm]', OWNER_PASSWORD);
  await owner.click('button');
  await owner.goto('/login');
  await owner.fill('input[name=email]', OWNER);
  await owner.fill('input[name=password]', OWNER_PASSWORD);
  await Promise.all([owner.waitForURL('**/owner'), owner.click('form[action="/login"] button')]);

  // Approving shows the link right away.
  await owner.fill('#invite-email', MEMBER);
  await Promise.all([owner.waitForLoadState('load'), owner.click('form:has(#invite-email) button')]);
  const firstLink = await owner.inputValue('#invite-link');
  check('approving an email shows a one-time sign-up link', /^http:\/\/localhost:\d+\/invite\?t=[a-f0-9]{64}$/.test(firstLink), firstLink.replace(/t=.*/, 't=…'));
  const mail = await owner.getAttribute('a:has-text("Email this link")', 'href');
  check('the prepared email contains the link and the member address', decodeURIComponent(mail).includes(firstLink) && mail.startsWith('mailto:' + encodeURIComponent(MEMBER)));
  const stored = await db.query('SELECT token_hash FROM member_invites WHERE email = $1', [MEMBER]);
  check('only a hash of the link is stored', stored.rows.length === 1 && !firstLink.includes(stored.rows[0].token_hash));

  // A newer link replaces the older one.
  await Promise.all([owner.waitForLoadState('load'), owner.click(`article:has-text("${MEMBER}") button:has-text("Create sign-up link")`)]);
  const link = await owner.inputValue('#invite-link');
  check('creating a new link replaces the older one', link !== firstLink && (await fetch(firstLink)).status === 410);

  // The member opens the link in their own browser.
  const memberCtx = await browser.newContext({ baseURL: base });
  const member = await memberCtx.newPage();
  await member.goto(link);
  check('the link shows the approved email', (await member.textContent('main')).includes(MEMBER));
  await member.fill('#password', MEMBER_PASSWORD);
  await member.fill('#confirm', MEMBER_PASSWORD + 'x');
  await Promise.all([member.waitForLoadState('load'), member.click('form[action="/invite"] button')]);
  check('mismatched passwords are refused and the link still works', (await member.textContent('[role=alert]'))?.includes('same password twice'));
  await member.fill('#password', MEMBER_PASSWORD);
  await member.fill('#confirm', MEMBER_PASSWORD);
  await Promise.all([member.waitForURL(base + '/'), member.click('form[action="/invite"] button')]);
  const session = await (await member.request.get('/api/auth/session')).json();
  check('creating the password signs the member in', session.signedIn && session.email === MEMBER && session.isOwner === false, JSON.stringify(session));
  check('the used link no longer works', (await fetch(link)).status === 410);
  const ownerPage = await member.request.get('/owner');
  check('the member is not the owner', (await ownerPage.text()).includes('Only the SkyData owner can manage members.'));

  // Cross-site form posts are refused.
  const forged = await fetch(base + '/invite', { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/x-www-form-urlencoded' }, body: 't=' + 'a'.repeat(64) + '&password=x' });
  check('a cross-site form post is refused', forged.status === 400, String(forged.status));

  // Signing in again later with email + password.
  const later = await (await browser.newContext({ baseURL: base })).newPage();
  await later.goto('/login');
  await later.fill('input[name=email]', MEMBER);
  await later.fill('input[name=password]', MEMBER_PASSWORD);
  await Promise.all([later.waitForURL(base + '/'), later.click('form[action="/login"] button')]);
  check('the member signs in with email and password', (await (await later.request.get('/api/auth/session')).json()).email === MEMBER);

  // Password reset: the owner sends a new link; it signs out old sessions and replaces the password.
  await owner.goto('/owner');
  await Promise.all([owner.waitForLoadState('load'), owner.click(`article:has-text("${MEMBER}") button:has-text("Password reset link")`)]);
  check('an active member gets a password reset link', (await owner.textContent('[role=status]')).includes('Password reset link ready'));
  const reset = await owner.inputValue('#invite-link');
  const resetPage = await (await browser.newContext({ baseURL: base })).newPage();
  await resetPage.goto(reset);
  await resetPage.fill('#password', 'Brand new password 678');
  await resetPage.fill('#confirm', 'Brand new password 678');
  await Promise.all([resetPage.waitForURL(base + '/'), resetPage.click('form[action="/invite"] button')]);
  check('the reset signs out the member’s other sessions', (await later.request.get('/api/auth/session')).status() === 403);
  const retry = await (await browser.newContext({ baseURL: base })).newPage();
  await retry.goto('/login');
  await retry.fill('input[name=email]', MEMBER);
  await retry.fill('input[name=password]', MEMBER_PASSWORD);
  await Promise.all([retry.waitForLoadState('load'), retry.click('form[action="/login"] button')]);
  check('the old password stops working', (await retry.textContent('[role=alert]'))?.includes('Email or password is incorrect'));

  // Expired links and revoked members.
  await owner.goto('/owner');
  await Promise.all([owner.waitForLoadState('load'), owner.click(`article:has-text("${MEMBER}") button:has-text("Password reset link")`)]);
  const expiring = await owner.inputValue('#invite-link');
  await db.query('UPDATE member_invites SET expires = $1 WHERE email = $2', [Date.now() - 1000, MEMBER]);
  check('an expired link is refused', (await fetch(expiring)).status === 410);
  await Promise.all([owner.waitForLoadState('load'), owner.click(`article:has-text("${MEMBER}") button:has-text("Password reset link")`)]);
  const beforeRevoke = await owner.inputValue('#invite-link');
  await Promise.all([owner.waitForLoadState('load'), owner.click(`article:has-text("${MEMBER}") button:has-text("Revoke access")`)]);
  check('revoking access cancels the unused link', (await fetch(beforeRevoke)).status === 410 && (await db.query('SELECT 1 FROM member_invites WHERE email = $1', [MEMBER])).rows.length === 0);
  check('revoking access signs the member out', (await resetPage.request.get('/api/auth/session')).status() === 403);
} finally {
  await db.end();
  await browser.close();
  await emu.stop();
}
const passed = results.filter(Boolean).length;
console.log(`${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
