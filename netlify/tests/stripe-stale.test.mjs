// Run: node netlify/tests/stripe-stale.test.mjs   (a test-mode customer ID left on an account must not break live billing)
import assert from 'node:assert/strict'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
process.env.USERS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'stale-'));
const auth = await import('../lib/auth.mjs'); const S = await import('../lib/stripe.mjs');
const u = await auth.createUser('m@example.com', 'password123', false); u.stripeCustomerId = 'cus_TEST'; await auth.saveUser(u);
const missing = Object.assign(new Error("No such customer: 'cus_TEST'; a similar object exists in test mode"), { code: 'resource_missing', statusCode: 404 });
const fake = { customers: { retrieve: async id => { if (id === 'cus_TEST') throw missing; return { id }; }, create: async () => ({ id: 'cus_LIVE' }) } };
assert.equal(await S.liveCustomer(fake, u), null); assert.equal((await auth.getUser('m@example.com')).stripeCustomerId, undefined);
console.log('ok - stale test-mode customer is dropped from the account');
const id = await S.ensureCustomer(fake, await auth.getUser('m@example.com')); assert.equal(id, 'cus_LIVE');
console.log('ok - a new live customer is created on the next checkout');
const net = { customers: { retrieve: async () => { throw Object.assign(new Error('network'), { type: 'StripeConnectionError' }); } } };
const v = await auth.getUser('m@example.com'); await assert.rejects(S.liveCustomer(net, v)); assert.equal((await auth.getUser('m@example.com')).stripeCustomerId, 'cus_LIVE');
console.log('ok - a network error never clears a real customer');
