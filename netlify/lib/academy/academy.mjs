// State & County Law Studies Department: the shared core (levels, topics, coverage, question banks, grading, certificates).
// It adds to the existing Academy: it reads the published state courses in ../curriculum and never changes them.
// Nothing here invents law. Every question comes from a reviewed course quiz or from that course's own cited sources.
import crypto from 'node:crypto';
import { COURSES } from '../curriculum/index.mjs';

// ---------- examination levels (owner can change these from the Owner Dashboard) ----------
export const DEFAULT_LEVELS = [
  { id: 'beginner', name: 'Beginner', questions: 30, minutes: 45, pass: 80 },
  { id: 'intermediate', name: 'Intermediate', questions: 50, minutes: 60, pass: 85 },
  { id: 'advanced', name: 'Advanced', questions: 75, minutes: 90, pass: 90 },
  { id: 'expert', name: 'Expert', questions: 100, minutes: 120, pass: 90 },
  { id: 'grandmaster', name: 'Grand Master', questions: 150, minutes: 180, pass: 95 }
];
export const DEFAULT_RETAKE = { waitHours: 24, maxPerWeek: 3 };
export const SETTINGS_KEY = 'academy-settings-v1', COVERAGE_KEY = 'academy-coverage-v1', LOG_KEY = 'academy-exam-log-v1',
  CERT_INDEX_KEY = 'academy-certs-index-v1', PROPOSALS_KEY = 'academy-proposals-v1';
export const certKey = id => 'academy-cert-' + id;

const clampInt = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
export function mergeSettings(saved) {
  const s = saved || {};
  const levels = DEFAULT_LEVELS.map(d => { const o = (s.levels || {})[d.id] || {}; return { ...d,
    questions: clampInt(o.questions, 5, 300, d.questions), minutes: clampInt(o.minutes, 5, 600, d.minutes), pass: clampInt(o.pass, 50, 100, d.pass) }; });
  const r = s.retake || {};
  return { levels, retake: { waitHours: clampInt(r.waitHours, 0, 720, DEFAULT_RETAKE.waitHours), maxPerWeek: clampInt(r.maxPerWeek, 1, 50, DEFAULT_RETAKE.maxPerWeek) } };
}
export function cleanSettingsInput(b) {
  const levels = {}; for (const d of DEFAULT_LEVELS) { const o = (b.levels || {})[d.id]; if (o) levels[d.id] = { questions: o.questions, minutes: o.minutes, pass: o.pass }; }
  return { levels, retake: b.retake || {} };
}

// ---------- curriculum topics; each one says which layer of rules it belongs to ----------
export const LAYERS = { state: 'State law', county: 'County ordinance', auction: 'Administrative auction policy', federal: 'Federal law' };
export const STATE_TOPICS = [
  ['liens-deeds', 'Tax lien and tax deed laws', 'state'], ['statutes', 'State statutes and legal definitions', 'state'],
  ['redemption', 'Redemption periods', 'state'], ['interest', 'Interest rates and penalties', 'state'],
  ['expiration', 'Tax certificate expiration', 'state'], ['foreclosure', 'Foreclosure procedures', 'state'],
  ['bankruptcy', 'Bankruptcy protections', 'federal'], ['ownership', 'Property ownership rights', 'state'],
  ['surplus', 'Surplus funds', 'state'], ['quiet-title', 'Quiet title procedures', 'state'],
  ['investor', 'Investor rights and responsibilities', 'state'], ['notices', 'Required legal notices', 'state'],
  ['restrictions', 'State specific purchasing restrictions', 'state'], ['probate', 'Property inheritance and probate laws', 'state'],
  ['federal', 'Federal laws affecting tax sale investments', 'federal']
].map(([id, name, layer]) => ({ id, name, layer }));
export const COUNTY_TOPICS = [
  ['ordinances', 'County ordinances', 'county'], ['registration', 'Auction registration', 'auction'], ['bidding', 'Bidding procedures', 'auction'],
  ['payment', 'Payment requirements', 'auction'], ['fees', 'County fees', 'county'], ['otc', 'Over the counter purchasing', 'auction'],
  ['zoning', 'Zoning regulations', 'county'], ['building', 'Building restrictions', 'county'], ['land-use', 'Land use regulations', 'county'],
  ['environmental', 'Environmental restrictions', 'county'], ['research', 'Property research procedures', 'auction'],
  ['resources', 'Official county resources', 'county'], ['collection', 'Local tax collection procedures', 'county']
].map(([id, name, layer]) => ({ id, name, layer }));

export const STATUSES = ['Not Started', 'Researching', 'Pending Verification', 'Approved', 'Published'];
export const STATES = [['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['DC','District of Columbia'],['FL','Florida'],['GA','Georgia'],['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming']];

const publishedCourse = st => Object.values(COURSES).find(c => c.state === st && c.status === 'published') || null;
// A state's course status: the owner's setting, but never above what exists. Published needs a published reviewed course.
export function stateCoverage(cov) {
  const c = cov || {};
  return STATES.map(([a, n]) => {
    const course = publishedCourse(a), saved = (c.states || {})[a] || {};
    let status = STATUSES.includes(saved.status) ? saved.status : (course ? 'Published' : 'Not Started');
    if (status === 'Published' && !course) status = 'Approved'; // only a reviewed, released course can be shown as published
    const topics = {}; for (const t of STATE_TOPICS) topics[t.id] = STATUSES.includes((saved.topics || {})[t.id]) ? saved.topics[t.id] : 'Not Started';
    return { state: a, name: n, status, course: course ? { id: course.id, title: course.title, checked: course.checked } : null, topics, note: saved.note || '' };
  });
}
export function countyCoverage(cov, st) {
  const c = ((cov || {}).counties || {});
  return Object.entries(c).filter(([k]) => !st || k.startsWith(st + '|')).map(([k, v]) => ({ key: k, state: k.split('|')[0], county: k.split('|')[1], status: STATUSES.includes(v.status) ? v.status : 'Not Started', note: v.note || '' }));
}

// ---------- question banks, built only from reviewed course content ----------
const cites = s => [...String(s || '').matchAll(/\[\[([^\]?][^\]]*)\]\]/g)].map(m => m[1]);
const plain = s => String(s || '').replace(/\[\[\?([^\]]*)\]\]/g, '$1').replace(/\[\[[^\]]*\]\]/g, '').replace(/\s+/g, ' ').replace(/\s+([.,;:])/g, '$1').trim();
const srcOut = s => s ? { short: s.short, name: s.name, url: s.url, checked: s.checked || null, effective: s.effective || null } : null;
export function bankFor(st) {
  const c = publishedCourse(st); if (!c) return [];
  const src = c.sources || {}, out = [];
  for (const m of c.modules) (m.quiz || []).forEach((q, i) => {
    const keys = cites(q.why).filter(k => src[k]);
    out.push({ id: `${c.id}:${m.id}:${i}`, type: 'choice', kind: 'Concept', topic: m.title, q: q.q, options: q.a, correct: q.c, why: plain(q.why), sources: keys.map(k => srcOut(src[k])) });
    // Statute identification: which of this course's own official sources supports the explanation?
    if (keys.length) {
      const right = src[keys[0]], others = Object.entries(src).filter(([k, s]) => k !== keys[0] && s.short !== right.short).map(([, s]) => s);
      if (others.length >= 2) {
        const h = crypto.createHash('sha1').update(c.id + m.id + i).digest(); const pick = [others[h[0] % others.length], others[(h[1] % (others.length - 1) + 1 + h[0]) % others.length]];
        if (pick[0].short !== pick[1].short) {
          const opts = [right, ...pick].map(s => s.short), stem = plain(q.why);
          if (stem.length > 30) out.push({ id: `${c.id}:${m.id}:${i}:cite`, type: 'choice', kind: 'Statute identification', topic: m.title, q: 'Which official source supports this rule? "' + stem + '"', options: opts, correct: 0, why: 'The rule comes from ' + right.name + '.', sources: [srcOut(right)] });
        }
      }
    }
  });
  return out;
}
export function levelAvailability(st, settings) {
  const n = bankFor(st).length;
  return settings.levels.map(l => ({ ...l, bank: n, ready: n >= l.questions }));
}

// ---------- exam sessions ----------
const shuffle = (arr, rnd) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd() % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const rng = () => crypto.randomBytes(4).readUInt32LE();
export function retakeBlock(history, settings, st, level, now = Date.now()) {
  const mine = (history || []).filter(h => h.state === st && h.level === level);
  const last = mine[mine.length - 1];
  if (last && now - Date.parse(last.submitted) < settings.retake.waitHours * 3600e3) return 'You can retake this exam after ' + new Date(Date.parse(last.submitted) + settings.retake.waitHours * 3600e3).toISOString().slice(0, 16).replace('T', ' ') + ' UTC.';
  const week = mine.filter(h => now - Date.parse(h.submitted) < 7 * 86400e3).length;
  if (week >= settings.retake.maxPerWeek) return 'You have used all ' + settings.retake.maxPerWeek + ' attempts for this exam this week.';
  return null;
}
export function startExam(st, levelId, settings) {
  const level = settings.levels.find(l => l.id === levelId); if (!level) return { error: 'Unknown level.' };
  const bank = bankFor(st); if (bank.length < level.questions) return { error: 'This exam is pending: ' + bank.length + ' of ' + level.questions + ' verified questions are ready.' };
  const picked = shuffle(bank, rng).slice(0, level.questions).map(q => { const order = shuffle(q.options.map((_, i) => i), rng); return { id: q.id, order }; });
  const id = crypto.randomBytes(9).toString('base64url'), started = new Date().toISOString();
  const session = { id, state: st, level: level.id, started, minutes: level.minutes, pass: level.pass, items: picked };
  const questions = picked.map((p, n) => { const q = bank.find(x => x.id === p.id); return { n: n + 1, id: q.id, kind: q.kind, topic: q.topic, q: q.q, options: p.order.map(i => q.options[i]) }; });
  return { session, exam: { id, state: st, level: level.name, minutes: level.minutes, pass: level.pass, started, questions } }; // no answers leave the server before submission
}
export function gradeExam(session, answers, now = Date.now()) {
  const bank = bankFor(session.state), late = now - Date.parse(session.started) > (session.minutes + 2) * 60e3;
  let right = 0;
  const review = session.items.map((p, n) => {
    const q = bank.find(x => x.id === p.id), pick = (answers || {})[p.id], chosen = Number.isInteger(pick) ? p.order[pick] : null, ok = !!q && chosen === q.correct;
    if (ok) right++;
    return q ? { n: n + 1, q: q.q, kind: q.kind, yourAnswer: chosen == null ? null : q.options[chosen], correctAnswer: q.options[q.correct], correct: ok, why: q.why, sources: q.sources } : { n: n + 1, missing: true };
  });
  const total = session.items.length, score = total ? Math.round(right / total * 1000) / 10 : 0;
  return { score, right, total, passed: !late && score >= session.pass, late, review };
}
export const newCertId = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', b = crypto.randomBytes(10); let s = ''; for (const x of b) s += A[x % A.length]; return 'PPA-' + s.slice(0, 5) + '-' + s.slice(5); };
export const CREDENTIAL_NOTE = 'PricePocket educational credential. Not an accredited degree, a professional license or legal advice.';
