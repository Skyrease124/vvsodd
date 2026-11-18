// Calculation drills. Practice scenarios with made-up numbers; the ANSWER is always computed by the verified state rules engine
// (kinvest-liens/liens/lien-rules.js: FL, AZ, IA, CO statute-checked), never by a model and never stored in the browser.
// A question is a signed token (state, level, seed). The server rebuilds the scenario from the token to check an answer.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
let ENGINE = null;
function engine() {
  if (ENGINE) return ENGINE;
  const root = process.env.LAMBDA_TASK_ROOT || process.cwd();
  const f = [path.join(root, 'kinvest-liens/liens/lien-rules.js'), path.join(HERE, '../../kinvest-liens/liens/lien-rules.js'), path.join(process.cwd(), 'kinvest-liens/liens/lien-rules.js')].find(x => fs.existsSync(x));
  if (!f) throw new Error('rules engine not found');
  const ctx = { module: { exports: {} }, window: undefined }; ctx.globalThis = ctx;
  vm.runInNewContext(fs.readFileSync(f, 'utf8'), ctx, { timeout: 2000 });
  ENGINE = ctx.module.exports.estimate ? ctx.module.exports : ctx.LienCalc; return ENGINE;
}
export const STATES = { FL: 'Florida', AZ: 'Arizona', IA: 'Iowa', CO: 'Colorado' };
export const LEVELS = { 1: 'Beginner: interest on a clean redemption', 2: 'Intermediate: a rule that changes the answer', 3: 'Advanced: a statute date or full payoff' };

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const pad = n => (n < 10 ? '0' : '') + n;
const iso = (y, m, d) => y + '-' + pad(m) + '-' + pad(d);
const addMonths = (y, m, n) => { const t = y * 12 + (m - 1) + n; return [Math.floor(t / 12), (t % 12) + 1]; };
const money = n => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nice = s => new Date(s + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

// Build one scenario from (state, level, seed, attempt). Returns null if the engine cannot answer it.
function scenario(state, level, seed, attempt) {
  const r = rng(seed * 31 + attempt), pick = (a, b) => a + Math.floor(r() * (b - a + 1));
  const y = 2026, m0 = pick(1, 6), d0 = level === 2 && (state === 'AZ' || state === 'CO') ? pick(18, 28) : pick(1, 14);
  let face = pick(4, 100) * 50, rate, n = pick(2, 11), dEnd = pick(1, 12), rateStep = 0.25;
  if (state === 'FL') { rate = pick(8, 72) * rateStep; if (level === 2) { rate = [0, 0.25, 0.5, 1, 1.5, 2][pick(0, 5)]; n = pick(0, 2); } }
  else if (state === 'AZ') { rate = pick(4, 16); }
  else if (state === 'CO') { rate = 13; }
  else { rate = 24; }
  if (state === 'IA' && level === 2) { face = pick(2, 9) * 10; n = pick(0, 2); }
  if (state === 'AZ' && level === 2) { n = pick(1, 6); dEnd = pick(1, 10); }
  const [ey, em] = addMonths(y, m0, n), bought = iso(y, m0, d0), asOf = iso(ey, em, Math.min(dEnd, 28));
  const h = { state, paid: face, rate, bought };
  const E = engine(), out = E.estimate(h, { asOf });
  if (!out.verified || out.interest == null || out.total == null) return null;
  if (state === 'FL' && level === 1 && (out.floorApplied || rate === 0)) return null; // level 1 stays a clean calculation
  if (state === 'FL' && level === 2 && !(out.floorApplied || rate === 0)) return null; // level 2 must hit the minimum-return rule or the 0% exception
  const facts = [['State', STATES[state]], ['Amount paid at the sale (face amount)', money(face)], ['Date bought', nice(bought)]];
  if (state === 'FL') facts.push(['Winning bid rate', rate + '%']);
  if (state === 'AZ') facts.push(['Winning bid rate', rate + '%']);
  if (state === 'CO') facts.push(['Interest rate on this lien', rate + '% a year (set by formula for the sale year)']);
  if (state === 'IA') facts.push(['Interest rate', 'set by Iowa law (you do not choose it)']);
  facts.push(['Date the owner redeems', nice(asOf)]);
  let kind = 'money', prompt, answer, why = out.steps.slice(), dateRow = null;
  if (level === 3) {
    dateRow = (out.dates || []).find(d => d.kind === 'statute' && /^\d{4}-\d{2}-\d{2}$/.test(d.date) && d.key !== 'expire');
    if (dateRow) { kind = 'date'; prompt = 'Using the state rules, what is: ' + dateRow.label + '? Enter the date as YYYY-MM-DD.'; answer = dateRow.date; why.push(dateRow.note); }
  }
  if (kind === 'money') {
    const total = level === 3;
    prompt = total ? 'What is the total the owner must pay to redeem (amount paid plus interest, no later-year taxes)? Enter dollars and cents.' : 'How much interest does the owner owe at redemption? Enter dollars and cents.';
    answer = total ? out.total : out.interest;
  }
  return { state, level, kind, prompt, facts: facts.map(f => ({ label: f[0], value: f[1] })), answer, steps: why, sources: out.sources || [], verifiedOn: out.verifiedOn || null, rulesLabel: out.label, floor: !!out.floorApplied };
}
export function build(state, level, seed) {
  if (!STATES[state] || !LEVELS[level]) return null;
  for (let a = 0; a < 40; a++) { const s = scenario(state, level, seed, a); if (s) return s; }
  return null;
}

// ---- signed question tokens ----
const secret = () => process.env.SESSION_SECRET || 'dev-secret';
const sign = body => crypto.createHmac('sha256', secret()).update(body).digest('base64url');
export function newToken(email, state, level, seed) { const b = Buffer.from(JSON.stringify({ s: state, l: level, d: seed, e: crypto.createHash('sha256').update(String(email).toLowerCase()).digest('hex').slice(0, 12), t: Date.now() })).toString('base64url'); return b + '.' + sign(b); }
export function readToken(tok, email) {
  const [b, sig] = String(tok || '').split('.'); if (!b || !sig) return null;
  const good = sign(b); if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  let p; try { p = JSON.parse(Buffer.from(b, 'base64url').toString('utf8')); } catch (e) { return null; }
  if (p.e !== crypto.createHash('sha256').update(String(email).toLowerCase()).digest('hex').slice(0, 12) || Date.now() - p.t > 6 * 3600e3) return null;
  return p;
}
export function publicQuestion(q, tok) { return { token: tok, state: q.state, stateName: STATES[q.state], level: q.level, levelName: LEVELS[q.level], kind: q.kind, prompt: q.prompt, facts: q.facts, practice: 'Practice scenario with made-up numbers.' }; }
export function check(q, raw) {
  const t = String(raw == null ? '' : raw).trim();
  if (q.kind === 'date') { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t); return { correct: !!m && t === q.answer, parsed: m ? t : null }; }
  const n = Number(t.replace(/[$,\s]/g, '')); if (!isFinite(n) || t === '') return { correct: false, parsed: null };
  return { correct: Math.abs(n - q.answer) < 0.005, parsed: n };
}
export const example = () => build('FL', 1, 7);
