import assert from 'node:assert/strict';
import test from 'node:test';
import { readWayneQuota, reserveWayneRequest } from '../../netlify/lib/brain-wayne-gis-quota.mjs';

function setup() {
  const values = new Map();
  let sequence = 0;
  let time = new Date('2026-11-22T12:00:00Z');
  const storage = {
    read: async key => structuredClone(values.get(key) ?? null),
    async write(key, data, expected) {
      if ((values.get(key)?.etag ?? null) !== expected) return null;
      const etag = String(++sequence);
      values.set(key, { data, etag });
      return etag;
    }
  };
  return {
    values,
    on: date => { time = new Date(date); },
    reserve: () => reserveWayneRequest(storage, () => time),
    read: () => readWayneQuota(storage, time)
  };
}

test('cutover denies calls without altering saved usage and admits calls on the next UTC day', async () => {
  const h = setup();
  h.values.set('owner-brain-wayne-worker-v1', { data: { dailyUsed: 19, cursor: 12 } });
  await assert.rejects(h.reserve(), { code: 'QUOTA', quotaState: 'quota_cutover' });
  assert.deepEqual(await h.read(), { active: false, count: 0, resumeAt:'2026-11-23T00:00:00.000Z' });
  assert.deepEqual(h.values.get('owner-brain-wayne-worker-v1').data, { dailyUsed: 19, cursor: 12 });
  h.on('2026-11-23T00:00:00Z');
  assert.equal(await h.reserve(), 1);
});

test('competing callers can reserve the final slot only once', async () => {
  const h = setup();
  await assert.rejects(h.reserve(), { code: 'QUOTA' });
  h.on('2026-11-23T00:00:00Z');
  for (let index = 1; index < 30; index++) assert.equal(await h.reserve(), index);
  const results = await Promise.allSettled([h.reserve(), h.reserve(), h.reserve()]);
  assert.deepEqual(results.filter(r => r.status === 'fulfilled').map(r => r.value), [30]);
  for (const result of results.filter(r => r.status === 'rejected')) assert.equal(result.reason.code, 'QUOTA');
  assert.deepEqual(await h.read(), { active: true, count: 30, resumeAt:null });
  h.on('2026-11-24T00:00:00Z');
  assert.equal(await h.reserve(), 1);
  assert.equal(h.values.get('brain-wayne-gis-quota-v1-2026-11-23').data.count, 30);
});
