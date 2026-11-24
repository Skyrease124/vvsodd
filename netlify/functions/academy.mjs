// State & County Law Studies Department (student side). Reads the published state courses; never changes them.
// GET: catalog, a state's levels, my history and certificates, or ?verify=ID (public). POST: start or submit an exam.
// Exams are for members (the existing $5.50 weekly plan) and the owner. Answers are never sent before submission.
import * as auth from '../lib/auth.mjs';
import * as A from '../lib/academy/academy.mjs';

const json = (code, body) => new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const settings = async () => A.mergeSettings(await auth.kvGet(A.SETTINGS_KEY));

export default async (req) => {
  const u = new URL(req.url), me = await auth.userFromCookie(req.headers.get('cookie') || ''), paid = auth.isPaid(me);
  if (req.method === 'GET') {
    const v = u.searchParams.get('verify');
    if (v) {
      const c = await auth.kvGet(A.certKey(String(v).toUpperCase().replace(/[^A-Z0-9-]/g, '')));
      if (!c || c.revoked) return json(404, { ok: false, error: 'No valid certificate has that ID.' });
      return json(200, { ok: true, certificate: { id: c.id, title: c.title, holder: c.holder, state: c.state, level: c.level, score: c.score, issued: c.issued, note: A.CREDENTIAL_NOTE } });
    }
    const s = await settings(), cov = await auth.kvGet(A.COVERAGE_KEY);
    const st = String(u.searchParams.get('state') || '').toUpperCase();
    const mine = (me && me.academy) || {};
    if (st) {
      const row = A.stateCoverage(cov).find(x => x.state === st); if (!row) return json(404, { error: 'Unknown state.' });
      return json(200, { state: row, levels: A.levelAvailability(st, s), counties: A.countyCoverage(cov, st), countyTopics: A.COUNTY_TOPICS,
        history: (mine.history || []).filter(h => h.state === st).slice(-20), signedIn: !!me, paid });
    }
    return json(200, { states: A.stateCoverage(cov).map(r => ({ state: r.state, name: r.name, status: r.status, course: r.course })),
      stateTopics: A.STATE_TOPICS, countyTopics: A.COUNTY_TOPICS, layers: A.LAYERS, levels: s.levels, retake: s.retake,
      history: (mine.history || []).slice(-50), certificates: mine.certificates || [], signedIn: !!me, paid, note: A.CREDENTIAL_NOTE });
  }
  if (req.method !== 'POST') return json(405, { error: 'Use GET or POST.' });
  if (!me) return json(401, { error: 'Sign in to take an examination.' });
  if (!paid) return json(403, { locked: true, error: 'Examinations are for members.' });
  let b; try { b = JSON.parse(await req.text() || '{}'); } catch (e) { return json(400, { error: 'Bad request.' }); }
  const s = await settings(); me.academy = me.academy || { history: [], certificates: [], sessions: {} }; const ac = me.academy;
  ac.sessions = ac.sessions || {}; ac.history = ac.history || []; ac.certificates = ac.certificates || [];
  if (b.action === 'start') {
    const st = String(b.state || '').toUpperCase(), row = A.stateCoverage(await auth.kvGet(A.COVERAGE_KEY)).find(x => x.state === st);
    if (!row || row.status !== 'Published') return json(400, { error: 'This state course is not published yet.' });
    const block = me.owner ? null : A.retakeBlock(ac.history, s, st, b.level); if (block) return json(429, { error: block });
    const r = A.startExam(st, b.level, s); if (r.error) return json(400, { error: r.error });
    for (const [k, x] of Object.entries(ac.sessions)) if (Date.now() - Date.parse(x.started) > 12 * 3600e3) delete ac.sessions[k];
    ac.sessions[r.session.id] = r.session; await auth.saveUser(me);
    return json(200, { exam: r.exam });
  }
  if (b.action === 'submit') {
    const ses = ac.sessions[b.id]; if (!ses) return json(404, { error: 'That examination was not found or was already submitted.' });
    const g = A.gradeExam(ses, b.answers || {}); delete ac.sessions[b.id];
    const level = s.levels.find(l => l.id === ses.level) || { name: ses.level };
    const rec = { state: ses.state, level: ses.level, levelName: level.name, score: g.score, right: g.right, total: g.total, passed: g.passed, late: g.late, started: ses.started, submitted: new Date().toISOString() };
    ac.history.push(rec); ac.history = ac.history.slice(-200);
    let cert = null;
    if (g.passed) {
      const name = A.STATES.find(x => x[0] === ses.state)[1];
      cert = { id: A.newCertId(), title: name + ' State Law Completion Certificate (' + level.name + ')', holder: String(me.name || me.displayName || 'PricePocket student').slice(0, 80), state: ses.state, level: level.name, score: g.score, issued: rec.submitted.slice(0, 10) };
      await auth.kvPut(A.certKey(cert.id), { ...cert, email: me.email });
      const idx = (await auth.kvGet(A.CERT_INDEX_KEY)) || []; idx.push({ id: cert.id, email: me.email, title: cert.title, issued: cert.issued }); await auth.kvPut(A.CERT_INDEX_KEY, idx.slice(-2000));
      ac.certificates.push(cert); rec.certificate = cert.id;
    }
    await auth.saveUser(me);
    const log = (await auth.kvGet(A.LOG_KEY)) || []; log.push({ ...rec, email: me.email }); await auth.kvPut(A.LOG_KEY, log.slice(-1000));
    return json(200, { result: { ...rec, review: g.review }, certificate: cert, note: A.CREDENTIAL_NOTE });
  }
  return json(400, { error: 'Bad action.' });
};
