// Calculation drills for members (Pro). A question is a signed token; the answer is computed by the verified rules engine on the server
// and is never sent until the member submits. Progress is saved to the account (me.drills).
import crypto from 'node:crypto';
import * as auth from '../lib/auth.mjs';
import * as RL from '../lib/ratelimit.mjs';
import { STATES, LEVELS, build, newToken, readToken, publicQuestion, check, example } from '../lib/drills.mjs';
const json = (code, body) => new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const summary = d => Object.fromEntries(Object.entries(d || {}).filter(([k]) => /^[A-Z]{2}-[123]$/.test(k)).map(([k, v]) => [k, { tries: v.tries || 0, right: v.right || 0, streak: v.streak || 0, best: v.best || 0 }]));

export default async (req) => {
  const u = new URL(req.url), me = await auth.userFromCookie(req.headers.get('cookie') || ''), paid = auth.isPaid(me);
  if (req.method === 'GET' && u.searchParams.get('info')) return json(200, { states: STATES, levels: LEVELS, signedIn: !!me, paid, progress: me ? summary(me.drills) : {} });
  if (req.method === 'GET' && u.searchParams.get('preview')) { const q = example(); return json(200, { preview: { ...publicQuestion(q, null), token: undefined, answer: q.answer, steps: q.steps, sources: q.sources, verifiedOn: q.verifiedOn, rulesLabel: q.rulesLabel } }); }
  if (!me) return json(401, { error: 'Sign in to use the drills.', needLogin: true });
  if (!paid) return json(402, { error: 'Calculation drills are for Pro members.', needPaid: true });
  if (!(await RL.hit('drill:' + me.email, 300, 3600e3)).ok) return json(429, { error: 'That is a lot of drills in an hour. Take a break and come back.' });
  if (req.method === 'GET') {
    const st = String(u.searchParams.get('state') || '').toUpperCase(), lv = Number(u.searchParams.get('level') || 1);
    // the token carries the seed, so the same question can be rebuilt on the server to check the answer
    const seed = crypto.randomInt(1, 2 ** 31 - 1), q = build(st, lv, seed); if (!q) return json(400, { error: 'Pick a state and level from the list.' });
    return json(200, { question: publicQuestion(q, newToken(me.email, st, lv, seed)) });
  }
  if (req.method !== 'POST') return json(405, { error: 'Use GET or POST.' });
  let b; try { b = JSON.parse(await req.text() || '{}'); } catch (e) { return json(400, { error: 'Bad request.' }); }
  const p = readToken(b.token, me.email); if (!p) return json(400, { error: 'That question expired. Get a new one.' });
  const q = build(p.s, p.l, p.d); if (!q) return json(400, { error: 'Bad question.' });
  const r = check(q, b.answer); if (r.parsed === null) return json(400, { error: q.kind === 'date' ? 'Enter the date as YYYY-MM-DD.' : 'Enter a number, for example 137.50.' });
  const key = p.s + '-' + p.l, id = crypto.createHash('sha256').update(String(b.token)).digest('hex').slice(0, 10);
  me.drills = me.drills || {}; const d = me.drills[key] = me.drills[key] || { tries: 0, right: 0, streak: 0, best: 0 }; me.drillSeen = me.drillSeen || [];
  let counted = false; if (!me.drillSeen.includes(id)) { counted = true; me.drillSeen = me.drillSeen.concat(id).slice(-200); d.tries++; if (r.correct) { d.right++; d.streak++; d.best = Math.max(d.best, d.streak); } else d.streak = 0; await auth.saveUser(me); }
  return json(200, { correct: r.correct, counted, answer: q.answer, kind: q.kind, steps: q.steps, sources: q.sources, verifiedOn: q.verifiedOn, rulesLabel: q.rulesLabel, progress: summary(me.drills), note: 'Educational practice with made-up numbers. Rules are from the statutes we checked on the date shown; confirm your own numbers with the county.' });
};
