// Law Studies core: no answers leak before submission, grading, retake policy, settings bounds, publish rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../../netlify/lib/academy/academy.mjs';

test('levels default to the owner proposal and clamp edits', () => {
  const s = A.mergeSettings({});
  assert.deepEqual(s.levels.map(l => [l.questions, l.minutes, l.pass]), [[30, 45, 80], [50, 60, 85], [75, 90, 90], [100, 120, 90], [150, 180, 95]]);
  const e = A.mergeSettings({ levels: { beginner: { questions: 9999, minutes: 1, pass: 20 } } });
  assert.deepEqual([e.levels[0].questions, e.levels[0].minutes, e.levels[0].pass], [300, 5, 50]);
});
test('banks come only from published courses, each question with its official source', () => {
  assert.equal(A.bankFor('GA').length, 0, 'no course, no questions');
  const b = A.bankFor('FL'); assert.ok(b.length >= 30);
  for (const q of b.filter(x => x.kind === 'Statute identification')) assert.ok(q.sources[0].url.startsWith('http'));
});
test('an exam sent to the student has no answers or explanations', () => {
  const r = A.startExam('FL', 'beginner', A.mergeSettings({}));
  assert.equal(r.exam.questions.length, 30);
  const txt = JSON.stringify(r.exam); assert.ok(!/"correct"|"why"|"sources"/.test(txt));
});
test('grading uses the shuffled order and reveals answers after submission', () => {
  const r = A.startExam('FL', 'beginner', A.mergeSettings({})), bank = A.bankFor('FL');
  const answers = {}; r.session.items.forEach(p => { const q = bank.find(x => x.id === p.id); answers[p.id] = p.order.indexOf(q.correct); });
  const g = A.gradeExam(r.session, answers); assert.equal(g.score, 100); assert.equal(g.passed, true); assert.ok(g.review[0].correctAnswer && g.review[0].why);
  assert.equal(A.gradeExam(r.session, {}).passed, false);
  assert.equal(A.gradeExam(r.session, answers, Date.parse(r.session.started) + 60 * 60e3).passed, false, 'late submissions cannot pass');
});
test('levels without enough verified questions stay pending', () => {
  assert.match(A.startExam('FL', 'grandmaster', A.mergeSettings({})).error, /pending/);
});
test('retake policy', () => {
  const s = A.mergeSettings({}), now = Date.now(), h = [{ state: 'FL', level: 'beginner', submitted: new Date(now - 3600e3).toISOString() }];
  assert.match(A.retakeBlock(h, s, 'FL', 'beginner', now), /retake/);
  assert.equal(A.retakeBlock(h, s, 'FL', 'beginner', now + 25 * 3600e3), null);
});
test('a state cannot show Published without a published course', () => {
  const rows = A.stateCoverage({ states: { GA: { status: 'Published' }, FL: {} } });
  assert.equal(rows.find(r => r.state === 'GA').status, 'Approved');
  assert.equal(rows.find(r => r.state === 'FL').status, 'Published');
  assert.equal(rows.length, 51);
});
