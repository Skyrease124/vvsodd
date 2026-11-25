// Law Studies pages in a phone browser. The academy API is answered by the real library (no network, no storage).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as A from '../netlify/lib/academy/academy.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const S = A.mergeSettings({}), sessions = {};
const b = await chromium.launch({ args: ['--no-sandbox'] }); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.route('**/.netlify/functions/academy**', async r => {
  const u = new URL(r.request().url()), json = d => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  if (r.request().method() === 'GET') {
    const st = u.searchParams.get('state'); const cov = A.stateCoverage({});
    if (st) return json({ state: cov.find(x => x.state === st), levels: A.levelAvailability(st, S), counties: [], countyTopics: A.COUNTY_TOPICS, history: [], signedIn: true, paid: true });
    return json({ states: cov, stateTopics: A.STATE_TOPICS, countyTopics: A.COUNTY_TOPICS, layers: A.LAYERS, levels: S.levels, retake: S.retake, history: [], certificates: [], signedIn: true, paid: true, note: A.CREDENTIAL_NOTE });
  }
  const body = JSON.parse(r.request().postData());
  if (body.action === 'start') { const x = A.startExam(body.state, body.level, S); sessions[x.session.id] = x.session; return json({ exam: x.exam }); }
  const g = A.gradeExam(sessions[body.id], body.answers); return json({ result: { score: g.score, right: g.right, total: g.total, passed: g.passed, review: g.review }, certificate: null, note: A.CREDENTIAL_NOTE });
});
await p.goto('http://127.0.0.1:8765/learn/law/', { waitUntil: 'load' });
await p.locator('#st option[value="FL"]').waitFor({ state: 'attached' });
await p.selectOption('#st', 'FL'); await p.getByText('Final examinations').waitFor();
assert.ok(await p.getByRole('link', { name: 'Start examination' }).count() >= 1, 'Beginner is ready for Florida');
assert.ok(await p.getByText(/Pending: \d+ of 150 verified questions/).count() === 1, 'Grand Master stays pending');
await p.selectOption('#st', 'GA'); await p.getByText(/opens only after its lessons are written/).waitFor();
await p.goto('http://127.0.0.1:8765/learn/law/exam/?state=FL&level=beginner'); await p.getByRole('button', { name: 'Begin examination' }).click();
await p.locator('fieldset.q').first().waitFor(); assert.equal(await p.locator('fieldset.q').count(), 30);
for (const f of await p.locator('fieldset.q').all()) await f.locator('label').first().click();
await p.getByRole('button', { name: 'Submit examination' }).click(); await p.getByText('Review').waitFor();
assert.equal(await p.locator('.q').count(), 30, 'every question is reviewed with its answer');
await p.screenshot({ path: process.env.SHOT || '/tmp/law-exam.png' });
assert.deepEqual(errs, []); await b.close(); console.log('PASS: Law Studies hub, pending levels, timed exam and review');
