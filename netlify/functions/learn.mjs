// Master Class: outline and progress for everyone; lesson text for free lessons to anyone, the rest to members only.
import * as auth from '../lib/auth.mjs';
import { LESSONS, outline } from '../lib/course.mjs';

const json = (code, body) => new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export default async (req) => {
  const me = await auth.userFromCookie(req.headers.get('cookie') || '');
  const paid = auth.isPaid(me);
  if (req.method === 'GET') {
    const id = new URL(req.url).searchParams.get('id');
    if (id) {
      const l = LESSONS.find(x => x.id === id); if (!l) return json(404, { error: 'Lesson not found.' });
      if (!l.free && !paid) return json(403, { locked: true, signedIn: !!me, title: l.title, error: 'This lesson is for members.' });
      return json(200, { lesson: l });
    }
    return json(200, { lessons: outline(), signedIn: !!me, paid, progress: (me && me.learn) || {} });
  }
  if (req.method !== 'POST') return json(405, { error: 'Use GET or POST.' });
  if (!me) return json(401, { error: 'Sign in to save progress.' });
  let b; try { b = JSON.parse(await req.text() || '{}'); } catch (e) { return json(400, { error: 'Bad request.' }); }
  const isState = /^st_[A-Z]{2}$/.test(String(b.id || ''));
  const l = isState ? { id: b.id, free: false, quiz: [0, 0, 0] } : LESSONS.find(x => x.id === b.id); if (!l) return json(400, { error: 'Bad lesson.' });
  if (!l.free && !paid) return json(403, { error: 'This lesson is for members.' });
  const score = Math.max(0, Math.min(l.quiz.length, Math.round(Number(b.score) || 0)));
  const p = me.learn || {}; const old = p[l.id];
  p[l.id] = { score: Math.max(score, old ? old.score : 0), of: l.quiz.length, at: new Date().toISOString() };
  me.learn = p; await auth.saveUser(me);
  return json(200, { progress: p });
};
