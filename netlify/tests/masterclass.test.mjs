// Run: node netlify/tests/masterclass.test.mjs
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import assert from 'node:assert/strict';
process.env.USERS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ppa-mc-')); process.env.SESSION_SECRET = 't';
const auth = await import('../lib/auth.mjs'); const D = await import('../lib/drills.mjs'); const H = await import('../lib/curriculum/hub.mjs');
const { COURSES } = await import('../lib/curriculum/index.mjs'); const { default: drills } = await import('../functions/drills.mjs'); const { default: hub } = await import('../functions/learnhub.mjs');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok -', m); };
const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const mk = async (e, patch) => { const u = await auth.createUser(e, 'pw-123456', false); Object.assign(u, patch || {}); await auth.saveUser(u); return (await auth.sessionCookie(e)).split(';')[0]; };
const call = async (fn, cookie, q, method = 'GET', body) => { const r = await fn(new Request('http://x/f' + (q ? '?' + q : ''), { method, headers: { cookie, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })); return { s: r.status, j: await r.json() }; };
// chapters, paths
ok(H.CHAPTERS.length === 10 && H.PATHS.length === 3, 'ten chapters and three paths');
for (const c of Object.values(COURSES)) { const m = H.chapterMap(c, null); ok(m.length === 10 && m.every(x => x.lessons.length > 0 && x.modules.length > 0), c.id + ': every chapter maps to real modules and lessons'); const ps = H.pathsFor(c, null); ok(ps.every(p => p.total > 0 && p.done === 0), c.id + ': paths have lessons'); }
const pr = H.pathsFor(COURSES.fl, { lessons: { 'fl-what': '2026-01-01', 'fl-calendar': '2026-01-01' } }); ok(pr[0].done === 2 && pr[0].total === new Set(H.chapterMap(COURSES.fl, null).filter(x => [1, 2, 3, 5].includes(x.n)).flatMap(x => x.lessons.map(l => l.id))).size, 'path progress counts lessons once');
// glossary
const g = H.glossary(); ok(g.length > 90 && g.some(e => e.scope === 'national') && g.some(e => e.scope === 'FL'), 'glossary merges national and state terms (' + g.length + ')');
ok(H.searchGlossary(g, 'redemption').length >= 6 && H.searchGlossary(g, 'zzzqqq').length === 0, 'glossary search finds terms and returns nothing for nonsense');
ok(H.searchGlossary(g, 'redemption')[0].term.toLowerCase().startsWith('redemption'), 'best match first');
// drills engine
for (const st of Object.keys(D.STATES)) for (const lv of [1, 2, 3]) { const q = D.build(st, lv, 4242); ok(q && q.steps.length && q.sources.length && q.verifiedOn, st + ' level ' + lv + ': builds with steps, sources and a verified date'); ok(JSON.stringify(D.publicQuestion(q, 't')).indexOf(String(q.answer)) < 0 || String(q.answer).length < 3, st + lv + ': public question does not contain the answer'); }
ok(D.build('FL', 1, 99).floor === false && D.build('FL', 2, 99).floor !== undefined, 'FL level 1 is a clean calculation');
let floors = 0; for (let s = 1; s < 40; s++) { const q = D.build('FL', 2, s); if (q.floor) floors++; } ok(floors > 20, 'FL level 2 usually exercises the 5% minimum (' + floors + '/39)');
ok(D.build('XX', 1, 1) === null && D.build('FL', 9, 1) === null, 'unknown state/level refused');
// endpoint access
const free = await mk('free@x.com'), pro = await mk('pro@x.com', { paidThrough: day(20) }), other = await mk('other@x.com', { paidThrough: day(20) });
ok((await call(drills, '', 'state=FL&level=1')).s === 401, 'signed out: 401');
ok((await call(drills, free, 'state=FL&level=1')).s === 402, 'free: 402');
const pv = await call(drills, '', 'preview=1'); ok(pv.s === 200 && pv.j.preview.answer != null && pv.j.preview.steps.length, 'public preview is a worked example');
let g1 = await call(drills, pro, 'state=FL&level=1'); ok(g1.s === 200 && g1.j.question.token && !('answer' in g1.j.question), 'pro gets a question with no answer');
const tok = g1.j.question.token; const payload = JSON.parse(Buffer.from(tok.split('.')[0], 'base64url').toString()); const truth = D.build(payload.s, payload.l, payload.d);
let r = await call(drills, pro, '', 'POST', { token: tok, answer: String(truth.answer) }); ok(r.s === 200 && r.j.correct === true && r.j.counted === true && r.j.steps.length && r.j.verifiedOn, 'right answer is accepted, with working and a verified date');
ok(r.j.progress['FL-1'].tries === 1 && r.j.progress['FL-1'].right === 1, 'progress saved to the account');
r = await call(drills, pro, '', 'POST', { token: tok, answer: String(truth.answer) }); ok(r.j.counted === false && r.j.progress['FL-1'].tries === 1, 'the same question cannot be counted twice');
g1 = await call(drills, pro, 'state=FL&level=1'); r = await call(drills, pro, '', 'POST', { token: g1.j.question.token, answer: '0.01' }); ok(r.j.correct === false && typeof r.j.answer === 'number', 'wrong answer is marked wrong and the working is shown');
r = await call(drills, pro, '', 'POST', { token: tok.slice(0, -3) + 'abc', answer: '1' }); ok(r.s === 400, 'a tampered token is refused');
r = await call(drills, other, '', 'POST', { token: tok, answer: '1' }); ok(r.s === 400, 'another member cannot use my token');
r = await call(drills, pro, '', 'POST', { token: g1.j.question.token, answer: 'abc' }); ok(r.s === 400, 'non-numeric answer gets a clear 400');
let me = await auth.getUser('other@x.com'); ok(!me.drills, 'another member progress untouched');
// hub endpoints
let h = await call(hub, '', 'glossary=1&q=redemption'); ok(h.s === 200 && h.j.terms.length >= 6, 'hub glossary search');
h = await call(hub, '', 'counties=1'); ok(h.j.counties.includes('Palm Beach') && h.j.counties.length >= 20, 'county list (' + h.j.counties.length + ')');
h = await call(hub, '', 'county=Palm%20Beach'); ok(h.s === 200 && h.j.county.steps.length >= 4 && h.j.county.links.every(l => /^https?:/.test(l.url)) && h.j.county.stateName === 'Florida', 'county page has steps, official links and the state');
ok(h.j.county.notes.some(n => /Educational only/.test(n)) && h.j.county.course.id === 'fl', 'county page carries the disclaimer and links the state course');
h = await call(hub, '', 'county=Nowhere'); ok(h.s === 404, 'unknown county is a 404, not an invented page');
h = await call(hub, pro, 'paths=1&c=tx'); ok(h.s === 200 && h.j.chapters.length === 10 && h.j.paths.length === 3, 'paths endpoint');
ok(!JSON.stringify(h.j).includes('"body"'), 'no lesson text leaks from the hub');
console.log('\n' + pass + ' checks passed');
