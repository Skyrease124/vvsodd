// Guided practice cases. GET lists or returns the public part of a case. POST reveals the documented outcome after a decision.
// No sign-in needed. Nothing the visitor types is stored.
import { list, publicCase, reveal } from '../lib/practice-cases.mjs';

const json = (code, body) => new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export default async (req) => {
  if (req.method === 'GET') {
    const id = new URL(req.url).searchParams.get('case');
    if (!id) return json(200, { cases: list() });
    const c = publicCase(id); if (!c) return json(404, { error: 'That practice case is not published.' });
    return json(200, { case: c });
  }
  if (req.method !== 'POST') return json(405, { error: 'Use GET or POST.' });
  let b; try { b = JSON.parse(await req.text() || '{}'); } catch (e) { return json(400, { error: 'Bad request.' }); }
  const decision = String(b.decision || '');
  if (!['buy', 'watch', 'pass'].includes(decision)) return json(400, { error: 'Choose Buy, Watch or Pass.' });
  const reason = String(b.reason || '').trim();
  if (reason.length < 15) return json(400, { error: 'Please explain your decision in a sentence or two first.' });
  const r = reveal(String(b.case || ''), { decision, marks: b.marks || {} });
  if (!r) return json(404, { error: 'That practice case is not published.' });
  return json(200, r);
};
