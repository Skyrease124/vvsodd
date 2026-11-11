// Full state courses: outline for everyone; module 1 free; other modules, quizzes and the Bid or Pass walkthrough for members.
// Progress is saved to the member's account (user.course[courseId]); signed-out visitors keep it in the browser.
import * as auth from '../lib/auth.mjs';
import { COURSES, TRACKER, outline, findLesson, lessonKeys, minutes } from '../lib/curriculum/index.mjs';

const json = (code, body) => new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export default async (req) => {
  const me = await auth.userFromCookie(req.headers.get('cookie') || '');
  const paid = auth.isPaid(me);
  const u = new URL(req.url);
  if (req.method === 'GET') {
    if (u.searchParams.get('tracker')) return json(200, { tracker: TRACKER, published: Object.values(COURSES).filter(c => c.status === 'published').map(c => c.state) });
    const c = COURSES[String(u.searchParams.get('c') || '').toLowerCase()];
    if (!c || c.status !== 'published') return json(404, { error: 'That course is not published yet.' });
    const lid = u.searchParams.get('l'), qid = u.searchParams.get('q'), ex = u.searchParams.get('x');
    const progress = (me && me.course && me.course[c.id]) || null;
    if (lid) {
      const f = findLesson(c, lid); if (!f) return json(404, { error: 'Lesson not found.' });
      if (!f.m.free && !paid) return json(403, { locked: true, signedIn: !!me, title: f.l.title });
      return json(200, { lesson: { id: f.l.id, title: f.l.title, mins: minutes(f.l), body: f.l.body, module: f.m.id } });
    }
    if (qid) {
      const m = c.modules.find(x => x.id === qid); if (!m) return json(404, { error: 'Quiz not found.' });
      if (!m.free && !paid) return json(403, { locked: true, signedIn: !!me, title: m.title + ' quiz' });
      return json(200, { quiz: m.quiz, module: m.id, title: m.title });
    }
    if (ex) {
      if (!c.exercise) return json(404, { error: 'No exercise.' });
      if (!paid) return json(403, { locked: true, signedIn: !!me, title: c.exercise.title });
      const { walkthrough, ...pub } = c.exercise; // the walkthrough is sent only after the student submits (POST)
      return json(200, { exercise: pub });
    }
    return json(200, { course: outline(c), signedIn: !!me, paid, progress });
  }
  if (req.method !== 'POST') return json(405, { error: 'Use GET or POST.' });
  let b; try { b = JSON.parse(await req.text() || '{}'); } catch (e) { return json(400, { error: 'Bad request.' }); }
  const c = COURSES[String(b.c || '').toLowerCase()];
  if (!c || c.status !== 'published') return json(404, { error: 'That course is not published yet.' });
  if (b.action === 'exercise') {
    if (!paid) return json(403, { error: 'The Bid or Pass exercise is for members.' });
    const max = Number(String(b.maxBid || '').replace(/[$,]/g, ''));
    if (!(max >= 0) || !['bid', 'pass'].includes(b.decision) || String(b.reason || '').trim().length < 20) return json(400, { error: 'Enter a maximum bid, choose Bid or Pass, and explain why in a sentence or two.' });
    return json(200, { walkthrough: c.exercise.walkthrough });
  }
  if (!me) return json(401, { error: 'Sign in to save progress.' });
  me.course = me.course || {}; const p = me.course[c.id] = me.course[c.id] || { lessons: {}, quizzes: {} };
  if (b.action === 'lesson') {
    const f = findLesson(c, String(b.l || '')); if (!f) return json(400, { error: 'Bad lesson.' });
    if (!f.m.free && !paid) return json(403, { error: 'This lesson is for members.' });
    p.lessons[f.l.id] = new Date().toISOString().slice(0, 10);
  } else if (b.action === 'quiz') {
    const m = c.modules.find(x => x.id === b.m); if (!m) return json(400, { error: 'Bad quiz.' });
    if (!m.free && !paid) return json(403, { error: 'This quiz is for members.' });
    const n = (m.quiz || []).length, s = Math.max(0, Math.min(n, Math.round(Number(b.score) || 0)));
    const old = p.quizzes[m.id]; p.quizzes[m.id] = { score: Math.max(s, old ? old.score : 0), of: n };
  } else return json(400, { error: 'Bad action.' });
  // keep only ids that still exist
  const keys = new Set(lessonKeys(c)); for (const k of Object.keys(p.lessons)) if (!keys.has(k)) delete p.lessons[k];
  await auth.saveUser(me);
  return json(200, { progress: p });
};
