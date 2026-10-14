// The Lambda runtime's own AWS credentials must not reach SkyData (it would use them instead of the
// owner's saved Amazon Polly keys).
import assert from 'node:assert/strict';
import { siteEnv } from '../src/entry.mjs';

const store = { get: async () => 'a'.repeat(64), set: async () => ({ modified: true }) };
const env = await siteEnv({
  vars: { AWS_ACCESS_KEY_ID: 'ASIANETLIFYRUNTIME', AWS_SECRET_ACCESS_KEY: 'runtime-secret', AWS_SESSION_TOKEN: 'runtime-token', AWS_REGION: 'us-east-2', AWS_LAMBDA_FUNCTION_NAME: 'x', LAMBDA_TASK_ROOT: '/var/task', _X_AMZN_TRACE_ID: 't', _HANDLER: 'h', NVIDIA_API_KEY: 'kept', SKYDATA_SECRET_KEY: 'b'.repeat(64) },
  pool: {}, files: store, parts: store, system: store, origin: 'https://example.test',
});
for (const k of ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'AWS_REGION', 'AWS_LAMBDA_FUNCTION_NAME', 'LAMBDA_TASK_ROOT', '_X_AMZN_TRACE_ID', '_HANDLER']) assert.equal(env[k], undefined, k + ' must not reach SkyData');
assert.equal(env.NVIDIA_API_KEY, 'kept');
assert.equal(env.SKYDATA_SECRET_KEY, 'b'.repeat(64));
assert.ok(env.DB && env.FILES && env.ASSETS);
console.log('PASS site env: AWS Lambda runtime credentials are dropped, site settings kept');
