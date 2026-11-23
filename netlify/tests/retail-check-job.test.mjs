// Run: node netlify/tests/retail-check-job.test.mjs   (file-backed storage; TEST FIXTURE accounts and products; store pages and OneSignal are stubbed, never reached).
import assert from 'node:assert/strict'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
process.env.USERS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'retail-job-')); process.env.FOUNDER_EMAIL = 'founder@example.com'; process.env.ONESIGNAL_REST_API_KEY = 'os_v2_app_testkey'; process.env.SESSION_SECRET = 't';
const sent = []; const realFetch = globalThis.fetch;
globalThis.fetch = async (url, o) => { if (String(url).includes('onesignal.com')) { sent.push(JSON.parse(o.body)); return new Response(JSON.stringify({ id: 'n' + sent.length }), { status: 200 }); } return realFetch(url, o); };
const auth = await import('../lib/auth.mjs'); const R = await import('../lib/retail.mjs');
const api = (await import('../functions/retail.mjs')).default;
const bg = (await import('../functions/retail-check-background.mjs')).default;
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok -', m); };
const mk = async (e, patch) => { const u = await auth.createUser(e, 'password123', false); Object.assign(u, patch || {}); await auth.saveUser(u); return (await auth.sessionCookie(e)).split(';')[0]; };
const F = await mk('founder@example.com', { owner: true }), M = await mk('member@example.com', { paidThrough: '2999-01-01' });
const ago = min => new Date(Date.now() - min * 60e3).toISOString();
const IN_STOCK_PAGE = '<html><script type="application/ld+json">{"@type":"Product","name":"Job test","offers":{"@type":"Offer","price":"44.00","availability":"https://schema.org/InStock"}}</script><button>Add to Cart</button></html>';
const postApi = (c, b, origin = 'http://preview.test') => api(new Request(origin + '/.netlify/functions/retail', { method: 'POST', headers: { cookie: c, 'Content-Type': 'application/json' }, body: JSON.stringify(b) }));
const getApi = (c, q) => api(new Request('http://preview.test/.netlify/functions/retail?' + new URLSearchParams(q), { headers: { cookie: c } }));
const product = (await R.createProduct('founder', { url: 'https://www.target.com/p/job-test', name: 'Job test (TEST FIXTURE)', category: 'pokemon', status: 'sold_out', auto: true })).product;
const bgRun = (jobId, token) => bg(new Request('http://preview.test/.netlify/functions/retail-check-background', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId, token }) }));

// 1. Queuing: the request returns at once with a job; nothing changes until the background function runs it
const dispatched = []; let fetches = 0;
R._setDispatch(async args => { dispatched.push(args); });
R._setFetch(async () => { fetches++; return new Response(IN_STOCK_PAGE, { status: 200 }); });
let res = await postApi(F, { action: 'checkNow', id: product.id }); let j = await res.json();
ok(res.status === 200 && j.queued && dispatched.length === 1 && dispatched[0].origin === 'http://preview.test', 'Check now queues one job and hands it to the background function with the site address');
ok(fetches === 0 && (await R.getProduct(product.id)).status === 'sold_out', 'nothing is read or changed until the background function runs the job');
const job = dispatched[0];
let st = await R.checkStatus(job.jobId);
ok(st.status === 'queued' && st.result === null && !JSON.stringify(st).includes(job.token), 'a queued job reports "queued" and never returns its secret token');

// 2. The token: a wrong token cannot run the job
ok((await R.runCheckJob(job.jobId, 'not-the-token')) === false && (await R.checkStatus(job.jobId)).status === 'queued' && fetches === 0, 'a wrong token does not run the job');
ok((await bgRun(job.jobId, 'wrong')).status === 403 && fetches === 0, 'the background function refuses a wrong token');
ok((await bgRun('0123456789abcdef01234567', job.token)).status === 403, 'an unknown job is refused');

// 3. The right token runs it once, and the result is stored on the job
ok((await bgRun(job.jobId, job.token)).status === 200, 'the background function runs the job with the right token');
st = await R.checkStatus(job.jobId);
ok(st.status === 'done' && st.result.readable === true && st.result.changed === true && /^Checked: IN STOCK \(changed\)/.test(st.result.message), 'the job stores what it found');
ok((await R.getProduct(product.id)).status === 'in_stock' && (await R.getProduct(product.id)).checkJob === '', 'the product is updated and no longer marked as being checked');
await R.runCheckJob(job.jobId, job.token);
ok(fetches === 1, 'a job never runs twice, even if the background function is called again');

// 4. One check at a time per product
R._setDispatch(async args => { dispatched.push(args); });
const cur = await R.getProduct(product.id); cur.manualCheckAt = ago(1); cur.status = 'sold_out'; await auth.kvPut('rp_' + product.id, cur);
res = await postApi(F, { action: 'checkNow', id: product.id }); j = await res.json();
ok(res.status === 200, 'a new check is allowed once the 15-second guard has passed');
const second = await postApi(F, { action: 'checkNow', id: product.id });
ok(second.status === 429, 'a second tap straight after is refused by the guard');
const cur2 = await R.getProduct(product.id); cur2.manualCheckAt = ago(1); await auth.kvPut('rp_' + product.id, cur2);
const busy = await postApi(F, { action: 'checkNow', id: product.id }); const bj = await busy.json();
ok(busy.status === 409 && /already being checked/.test(bj.error), 'while a job is still queued, another check for the same product is refused (409)');
const cur3 = await R.getProduct(product.id); cur3.manualCheckAt = ago(1); cur3.checkJob = j.jobId; const jr = await auth.kvGet('rcheck_' + j.jobId); jr.createdAt = ago(11); await auth.kvPut('rcheck_' + j.jobId, jr); await auth.kvPut('rp_' + product.id, cur3);
res = await postApi(F, { action: 'checkNow', id: product.id });
ok(res.status === 200, 'a job stuck for more than 10 minutes does not block a new check');

// 5. A failed start is reported, and the product is not left marked as being checked
R._setDispatch(async () => { throw new Error('network down'); });
const cur4 = await R.getProduct(product.id); cur4.manualCheckAt = ago(1); cur4.checkJob = ''; await auth.kvPut('rp_' + product.id, cur4);
res = await postApi(F, { action: 'checkNow', id: product.id }); j = await res.json();
ok(res.status === 502 && /Could not start the check/.test(j.error), 'a check that cannot start says so');
ok((await R.getProduct(product.id)).checkJob === '' && (await R.checkStatus(j.jobId ?? '0123456789abcdef01234567')).status !== 'queued', 'after a failed start, nothing is left marked as being checked');

// 6. The owner page reads a job's status; members and strangers cannot
R._setDispatch(async args => { dispatched.push(args); await R.runCheckJob(args.jobId, args.token); });
const cur5 = await R.getProduct(product.id); cur5.manualCheckAt = ago(1); cur5.checkJob = ''; await auth.kvPut('rp_' + product.id, cur5);
res = await postApi(F, { action: 'checkNow', id: product.id }); j = await res.json();
const readOwner = await getApi(F, { checkJob: j.jobId }); const body = await readOwner.json();
ok(readOwner.status === 200 && body.status === 'done' && body.result && !JSON.stringify(body).includes('token'), 'the owner can read a finished job, without its token');
ok((await getApi(M, { checkJob: j.jobId })).status === 403, 'members cannot read check results');
ok((await getApi(F, { checkJob: '0123456789abcdef01234567' })).status === 404, 'an unknown job is reported as not found');
ok((await postApi(M, { action: 'checkNow', id: product.id })).status === 403, 'members cannot queue a check');
console.log('# pass ' + pass);
