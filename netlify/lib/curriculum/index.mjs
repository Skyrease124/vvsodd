// State tax sale curriculum: registry, outline, gating and the 50-state tracker.
// A course is released (status 'published') only when its lessons, citations, exercises and quizzes are complete.
import fl from './fl.mjs';
import tx from './tx.mjs';
import { TRACKER } from './tracker.mjs';

export const COURSES = { fl, tx };
export { TRACKER };

const words = s => String(s || '').split(/\s+/).filter(Boolean).length;
export const minutes = l => Math.max(3, Math.round(words(l.body) / 200));

export function outline(c) {
  return {
    id: c.id, state: c.state, title: c.title, intro: c.intro, status: c.status, checked: c.checked, review: c.review,
    totalMinutes: c.modules.reduce((t, m) => t + m.lessons.reduce((u, l) => u + minutes(l), 0), 0),
    modules: c.modules.map(m => ({ id: m.id, title: m.title, free: !!m.free, quiz: (m.quiz || []).length, lessons: m.lessons.map(l => ({ id: l.id, title: l.title, mins: minutes(l) })) })),
    glossary: c.glossary, links: c.links, checklists: c.checklists, sources: c.sources, exercise: c.exercise ? { title: c.exercise.title } : null
  };
}
export function findLesson(c, id) {
  for (const m of c.modules) { const l = m.lessons.find(x => x.id === id); if (l) return { m, l }; }
  return null;
}
export const lessonKeys = c => c.modules.flatMap(m => m.lessons.map(l => l.id));
