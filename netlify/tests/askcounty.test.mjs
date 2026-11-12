// Run: node netlify/tests/askcounty.test.mjs   (file storage; NVIDIA, Google and Gmail mocked)
import assert from 'node:assert/strict'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
process.env.USERS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'askc-')); process.env.NVIDIA_API_KEY = 'nvapi-test';
process.env.GOOGLE_CLIENT_ID = '123-abc.apps.googleusercontent.com'; process.env.GOOGLE_CLIENT_SECRET = 'secret-xyz';
const auth = await import('../lib/auth.mjs'); const dir = await import('../lib/county-contacts.mjs'); const { handle } = await import('../functions/askcounty.mjs');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok -', m); };
const calls = []; let gmailMode = 'ok', aiMode = 'ok', idEmail = 'pro@example.com';
const jwt = e => 'x.' + Buffer.from(JSON.stringify({ email: e })).toString('base64url') + '.y';
globalThis.fetch = async (u, o = {}) => { u = String(u); calls.push({ u, o });
  if (/nvidia|integrate/.test(u)) { if (aiMode === 'down') throw new Error('net'); return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '{"subject":"Request: tax deed list","body":"Hello,\\n\\nPlease send the latest list in CSV or Excel and the date it was last updated.\\n\\nThank you,"}' } }] }) }; }
  if (/oauth2.googleapis.com\/token/.test(u)) { const p = new URLSearchParams(o.body); return p.get('grant_type') === 'authorization_code' ? { ok: true, json: async () => ({ refresh_token: 'rt-1', id_token: jwt(idEmail), scope: 'openid email https://www.googleapis.com/auth/gmail.send' }) } : { ok: true, json: async () => ({ access_token: 'at-1' }) }; }
  if (/revoke/.test(u)) return { ok: true, json: async () => ({}) };
  if (/gmail.googleapis.com/.test(u)) { if (gmailMode === 'fail') return { ok: false, status: 500, json: async () => ({}) }; return { ok: true, json: async () => ({ id: 'm1' }) }; }
  throw new Error('unexpected ' + u); };
await auth.createUser('free@example.com', 'password123', false);
const pro = await auth.createUser('pro@example.com', 'password123', false); pro.paidThrough = '2099-01-01'; await auth.saveUser(pro);
const ck = async e => (await auth.sessionCookie(e)).split(';')[0];
const PRO = await ck('pro@example.com'), FREE = await ck('free@example.com');
const call = async (method, q, body, cookie) => { const r = await handle(new Request('https://x/f' + (q ? '?' + q : ''), { method, body: body ? JSON.stringify(body) : undefined, headers: { cookie: cookie || '' } })); let j = null; try { j = await r.clone().json(); } catch (e) {} return { s: r.status, j, loc: r.headers.get('location'), sc: r.headers.get('set-cookie') }; };

ok((await call('POST', '', { act: 'draft', county: 'Volusia', kind: 'taxdeed' }, FREE)).s === 402, 'Ask the County is paid-plan only');
ok((await call('GET', 'act=status')).s === 401, 'sign-in required');
let r = await call('POST', '', { act: 'draft', state: 'FL', county: 'Volusia', parcel: '612901110240', kind: 'taxdeed' }, PRO);
ok(r.s === 200 && r.j.ai && /CSV or Excel/.test(r.j.body) && r.j.body.trim().endsWith('pro@example.com') && r.j.subject, 'AI drafts a short email asking for CSV/Excel and the last-updated date');
ok(r.j.mode === 'link' && r.j.to === null && /clerk\.org|realtaxdeed/.test(r.j.link), 'no verified email: official link + copy mode, never a guessed address (' + r.j.link + ')');
const nv = calls.find(c => /integrate/.test(c.u)); ok(/Volusia County, FL/.test(nv.o.body) && /latest|list/.test(nv.o.body), 'the AI prompt names the county and the list request');
aiMode = 'down'; r = await call('POST', '', { act: 'draft', state: 'FL', county: 'Volusia', kind: 'laft' }, PRO); ok(r.s === 200 && !r.j.ai && /CSV or Excel/.test(r.j.body), 'if the AI fails, a safe template draft is used'); aiMode = 'ok';
ok((await call('POST', '', { act: 'draft', county: 'Volusia', kind: 'status' }, PRO)).s === 400, 'Parcel Status needs a parcel ID');
// verified email + Gmail
dir.VERIFIED_EMAILS['FL|Volusia|clerk'] = { email: 'taxdeeds@example.gov', office: 'Volusia Clerk Tax Deeds', sourceUrl: 'https://www.clerk.org/', checked: '2026-11-12' };
r = await call('POST', '', { act: 'draft', state: 'FL', county: 'Volusia', kind: 'taxdeed' }, PRO); ok(r.j.mode === 'email' && r.j.to === 'taxdeeds@example.gov', 'verified directory email is used as the recipient');
r = await call('POST', '', { act: 'send', requestId: 'req-00000001', state: 'FL', county: 'Volusia', kind: 'taxdeed', subject: 'Hello there', body: 'Hello, please send the list. Thank you' }, PRO); ok(r.s === 400 && r.j.needGmail, 'cannot send before Gmail is connected');
r = await call('GET', 'act=oauth', null, PRO); const st = new URL(r.loc).searchParams;
ok(r.s === 302 && st.get('scope') === 'openid email https://www.googleapis.com/auth/gmail.send' && /ppa_g=/.test(r.sc), 'OAuth asks only for send permission (+ email to verify the sender)');
const state = st.get('state');
idEmail = 'someone-else@gmail.com'; r = await call('GET', 'act=callback&code=c1&state=' + state, null, PRO + '; ppa_g=' + state);
ok(/gmail=mismatch/.test(r.loc) && calls.some(c => /revoke/.test(c.u)) && !(await call('GET', 'act=status', null, PRO)).j.gmail.connected, 'a Gmail that does not match the signup email is refused and its token revoked');
ok(/gmail=failed/.test((await call('GET', 'act=callback&code=c1&state=wrong', null, PRO + '; ppa_g=' + state)).loc), 'OAuth state must match (CSRF protection)');
idEmail = 'pro@example.com'; r = await call('GET', 'act=callback&code=c1&state=' + state, null, PRO + '; ppa_g=' + state); ok(/gmail=connected/.test(r.loc), 'matching Gmail connects');
r = await call('GET', 'act=status', null, PRO); ok(r.j.gmail.connected && r.j.gmail.email === 'pro@example.com' && !JSON.stringify(r.j).includes('rt-1'), 'status never returns tokens');
calls.length = 0;
const req = { act: 'send', requestId: 'req-00000002', state: 'FL', county: 'Volusia', kind: 'taxdeed', subject: 'Request: tax deed list', body: 'Hello,\n\nPlease send the list.\n\nThank you,\npro@example.com' };
const [a, b] = await Promise.all([call('POST', '', req, PRO), call('POST', '', req, PRO)]);
const sends = calls.filter(c => /gmail.googleapis/.test(c.u));
ok(sends.length === 1 && [a, b].some(x => x.j.ok), 'a double tap sends only once');
const raw = Buffer.from(JSON.parse(sends[0].o.body).raw, 'base64url').toString(); ok(/From: pro@example.com/.test(raw) && /Reply-To: pro@example.com/.test(raw) && /To: taxdeeds@example.gov/.test(raw), 'sent from the member, replies go to the member');
r = await call('POST', '', req, PRO); ok(r.j.ok && r.j.duplicate && calls.filter(c => /gmail.googleapis/.test(c.u)).length === 1, 'retrying the same request does not send again');
r = await call('GET', 'act=status', null, PRO); ok(r.j.history.length === 1 && r.j.history[0].to === 'taxdeeds@example.gov' && r.j.history[0].via === 'gmail', 'sent request history is kept');
gmailMode = 'fail'; r = await call('POST', '', { ...req, requestId: 'req-00000003' }, PRO); ok(r.s === 502 && /Nothing was sent/.test(r.j.error), 'a Gmail failure says nothing was sent');
gmailMode = 'ok'; r = await call('POST', '', { ...req, requestId: 'req-00000003' }, PRO); ok(r.j.ok, 'and the member can try again');
delete dir.VERIFIED_EMAILS['FL|Volusia|clerk'];
r = await call('POST', '', { ...req, requestId: 'req-00000004' }, PRO); ok(r.s === 400 && /official link/.test(r.j.error), 'never sends to a county without a verified email');
await call('POST', '', { act: 'copied', requestId: 'req-00000005', state: 'FL', county: 'Lee', kind: 'laft', subject: 'Request', office: 'Lee Clerk', link: 'https://www.leeclerk.org/' }, PRO);
r = await call('GET', 'act=status', null, PRO); ok(r.j.history[0].via === 'copied', 'copied requests appear in history too');
console.log('\n' + pass + ' checks passed');
