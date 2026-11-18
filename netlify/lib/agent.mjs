// Property research agent (LangGraph): understand -> plan -> retrieve -> verify -> (retry once) -> analyze -> report.
// Facts come only from our records (state rules, county lists, knowledge passages). The model, when available, only phrases the
// analysis from verified evidence; if it is down, a plain-code summary is returned. Gaps and conflicts are listed, never hidden.
import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { search } from './knowledge.mjs';

const DAY = 864e5, money = n => '$' + Math.round(n).toLocaleString('en-US');
const parseDay = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null; };
const S = Annotation.Root({
  q: Annotation(), ctx: Annotation(), intent: Annotation(), plan: Annotation(), evidence: Annotation(), findings: Annotation(), retried: Annotation(), analysis: Annotation(), result: Annotation(),
  trace: Annotation({ reducer: (a, b) => a.concat(b), default: () => [] })
});
const step = (name, detail) => ({ step: name, detail: detail || '' });

export const wantsResearch = q => /\b(research|investigate|analy[sz]e|report|due diligence|compare|comparison|versus|vs\.?|risks?|evaluate|break ?down|deep dive)\b/i.test(q) || /\b\d{2,}[-\d.]{5,}\b/.test(q);

async function understand(st) {
  const { ctx, q } = st; let it = null, how = 'rules';
  const byRules = ctx.ruleIntent(q, ctx.data);
  if (byRules) it = ctx.cleanIntent({ ...byRules, scope: byRules.scope.length ? byRules.scope : undefined }, ctx.codes, ctx.uiScope || []);
  else if (ctx.parse) { try { const raw = await ctx.parse(q); if (raw) { it = ctx.cleanIntent(raw, ctx.codes, ctx.uiScope || []); how = 'model'; } } catch (e) { /* fall through */ } }
  if (!it) { it = ctx.cleanIntent({}, ctx.codes, ctx.uiScope || []); how = 'general'; }
  if (it.task === 'general' && /\b(liens?|parcels?|lots?|propert(?:y|ies)|acres?)\b/i.test(q)) it.task = 'liens';
  const parcel = (q.match(/\b\d{2,}[-\d.]{5,}\b/) || [])[0] || null;
  return { intent: Object.assign(it, { parcel, how }), trace: [step('Understand request', ctx.describe(it) + (parcel ? ' · parcel ' + parcel : ''))] };
}
async function plan(st) {
  const it = st.intent, p = [];
  if (it.parcel) p.push('Look up parcel ' + it.parcel + ' in the county lists we carry');
  if (it.task === 'liens') p.push('Search county lien lists');
  if (it.task === 'states' || (it.scope || []).length > 1) p.push('Compare state rules');
  if ((it.scope || []).length) p.push('Retrieve rules and course passages for ' + it.scope.join(', ')); else p.push('Retrieve matching passages from our knowledge base');
  p.push('Verify dates, sources and missing fields', 'Write the analysis from verified evidence only');
  return { plan: p, trace: [step('Plan research', p.length + ' steps')] };
}
async function retrieve(st) {
  const { ctx, intent: it, q } = st, ev = st.evidence && st.retried ? { ...st.evidence } : {}; const t = [];
  let it2 = it;
  if (st.retried) { ev.relaxed = true; it2 = { ...it, relaxed: true }; for (const k of ['uses', 'excludeHomestead', 'hideFlood', 'hideWetlands', 'hideEnvRestricted', 'hideLandlocked', 'minCoverage']) delete it2[k]; if (it2.lien) it2.lien = {}; }
  if (it2.parcel && ctx.findParcel) { const hit = ctx.findParcel(it2.parcel); ev.parcelHit = hit; ev.liens = { total: hit.length, rows: [] }; t.push(step('Look up parcel', hit.length ? hit.length + ' exact match(es) in county lists' : 'not on any list we carry')); }
  else if (it2.task === 'liens') { ev.liens = ctx.runLiens(it2); t.push(step('Search county lists', ev.liens.noData ? 'no list for these states' : (ev.liens.total || 0) + ' match(es)' + (st.retried ? ' (filters relaxed)' : ''))); }
  if (it2.task === 'states' || (it2.scope || []).length > 1) { ev.states = ctx.runStates(ctx.data, it2); t.push(step('Compare state rules', (ev.states.total || 0) + ' state(s)')); }
  if (ctx.coverage && (it2.task === 'states' || (it2.scope || []).length > 1 || it2.task === 'liens')) { ev.coverage = (it2.scope || []).slice(0, 6).map(c => ({ state: c, ...ctx.coverage(c) })); if (ev.coverage.length) t.push(step('List coverage', ev.coverage.map(c => c.state + ': ' + c.liens + ' liens').join(', '))); }
  const scope = (it2.parcel && (ev.parcelHit || []).length ? [...new Set(ev.parcelHit.map(h => h.state).filter(Boolean))] : (it2.scope || [])).slice(0, 6), kb = [];
  if (it2.parcel && !(ev.parcelHit || []).length) { ev.kb = []; t.push(step('Retrieve knowledge', 'skipped: parcel not found, so no unrelated passages')); return { evidence: ev, trace: t }; }
  if (scope.length) for (const s of scope) kb.push(...search(ctx.idx, q, { state: s, k: 2 })); else kb.push(...search(ctx.idx, q, { k: 4 }));
  ev.kb = kb.map(r => ({ text: r.text.slice(0, 420), title: r.meta.title, url: r.meta.url, kind: r.meta.kind, state: r.meta.state, checked: r.meta.checked || null, verify: !!r.meta.verify, score: +r.score.toFixed(2) }));
  t.push(step('Retrieve knowledge', ev.kb.length + ' passage(s) from ' + new Set(ev.kb.map(x => x.kind)).size + ' kind(s)'));
  return { evidence: ev, trace: t };
}
async function verify(st) {
  const { ctx, evidence: ev } = st, today = parseDay(ctx.today), gaps = [], conflicts = [], notes = [], ok = [];
  const rows = (ev.liens && ev.liens.rows) || [];
  for (const r of (ev.parcelHit || []).slice(0, 5)) { const id = r.county + ' ' + r.parcel; const sd = parseDay(r.saleDate); if (sd != null && today != null && sd < today) notes.push(id + ': sale date ' + r.saleDate + ' has passed, so this is a historical listing, not confirmed available.'); const ck = parseDay(r.checked); if (ck != null && today != null && (today - ck) / DAY > 30) notes.push(id + ': list last checked ' + r.checked + ' (over 30 days ago).'); if (r.amount == null) gaps.push(id + ': amount not on the list'); if (r.market == null) gaps.push(id + ': county land value unknown'); if (r.flood == null) gaps.push(id + ': flood, wetland and road checks not on file'); ok.push(id); }
  for (const r of rows.slice(0, 15)) {
    const id = r.county + ' ' + r.parcel, why = [];
    if (r.noPrice) why.push('price not printed on the list');
    if (r.market == null) why.push('county land value unknown');
    if (r.status == null && r.saleDate == null) why.push('no status or sale date on the list');
    const sd = parseDay(r.saleDate); if (sd != null && today != null && sd < today) notes.push(id + ': sale date ' + r.saleDate + ' has passed, so this is a historical listing, not confirmed available.');
    const ck = parseDay(r.checked); if (ck != null && today != null && (today - ck) / DAY > 30) notes.push(id + ': list last checked ' + r.checked + ' (over 30 days ago).');
    if (!(r.flood != null || (r.green || []).length || (r.red || []).length)) why.push('flood, wetland and road checks not on file');
    why.length ? gaps.push(id + ': ' + why.join('; ')) : ok.push(id);
  }
  for (const s of ((ev.states && ev.states.rows) || [])) if (s.verify) conflicts.push(s.name + ': sources differ on this state’s rules; do not rely on the figures without checking the county.');
  for (const k of ev.kb || []) if (k.verify && !conflicts.some(c => c.startsWith(k.state))) conflicts.push((k.state || '') + ': knowledge base flags this state as unverified.');
  const total = ev.liens && ev.liens.total;
  const needRetry = !st.retried && !st.intent.parcel && ev.liens && !ev.liens.noData && total === 0;
  if (ev.liens && ev.liens.noData) gaps.push('We hold no county lien list for the states asked about; only their rules are covered.');
  if (!rows.length && !(ev.states && (ev.states.rows || []).length) && !(ev.kb || []).length) gaps.push('Nothing in our records matched the question.');
  if (st.intent.parcel && !(ev.parcelHit || []).length) gaps.push('Parcel ' + st.intent.parcel + ' is not on any county list we carry. Check the county tax collector; it may be absent from our lists or mistyped.');
  return { findings: { ok, gaps, conflicts, notes, checked: rows.length }, retried: st.retried || needRetry, trace: [step('Verify findings', rows.length + ' row(s) checked; ' + gaps.length + ' gap(s), ' + conflicts.length + ' conflict(s), ' + notes.length + ' note(s)' + (needRetry ? '; no results, retrying with fewer filters' : ''))] };
}

function deterministic(st) {
  const ev = st.evidence, f = st.findings, lines = [], rows = (ev.liens && ev.liens.rows) || [];
  if (st.intent.parcel && !(ev.parcelHit || []).length) { lines.push('Parcel ' + st.intent.parcel + ' is not on any county list we carry, so I cannot report on it. I will not guess. Check the number against the county tax collector or property appraiser.'); return lines.join('\n'); }
  if (ev.states && (ev.states.rows || []).length) { lines.push('Rules compared for ' + ev.states.rows.length + ' state' + (ev.states.rows.length > 1 ? 's' : '') + '.'); ev.states.rows.slice(0, 6).forEach(s => lines.push('- ' + s.name + ': ' + s.system + '; rate ' + s.rate + '; redemption ' + s.redemption + '; bidding ' + s.bidding + (s.verify ? ' (needs checking)' : ''))); }
  if ((ev.parcelHit || []).length) { lines.push('Parcel record' + (ev.parcelHit.length > 1 ? 's' : '') + ' on county lists.'); ev.parcelHit.slice(0, 3).forEach(r => lines.push('- ' + r.county + ' ' + r.parcel + ': ' + (r.amount != null ? 'amount on list ' + money(r.amount) : 'amount not on list') + (r.market != null ? '; county land value ' + money(r.market) : '') + (r.status ? '; status ' + r.status : '') + (r.saleDate ? '; sale date ' + r.saleDate : '') + (r.checked ? '; list checked ' + r.checked : ''))); }
  if ((ev.coverage || []).length) { lines.push('Lien lists we hold, by state.'); ev.coverage.forEach(c => lines.push('- ' + c.state + ': ' + (c.liens ? c.liens.toLocaleString('en-US') + ' liens across ' + c.counties.join(', ') : 'no county list on file (rules only)') + (c.cheapest != null ? '; lowest amount owed ' + money(c.cheapest) : ''))); }
  if (rows.length) { lines.push('County list matches: ' + (ev.liens.total) + ' total, showing ' + Math.min(rows.length, 5) + '.'); rows.slice(0, 5).forEach(r => lines.push('- ' + r.county + ' ' + r.parcel + ': ' + (r.noPrice ? 'price not on list' : 'tax owed ' + money(r.face)) + (r.market != null ? '; county land value ' + money(r.market) : '') + (r.acres != null ? '; ' + r.acres + ' acres' : ''))); }
  if (!lines.length && (ev.kb || []).length) { lines.push('From our checked content.'); ev.kb.slice(0, 3).forEach(k => lines.push('- ' + k.title + ': ' + k.text.slice(0, 160))); }
  if (!lines.length) lines.push('I found nothing in our records that answers this.');
  return lines.join('\n');
}
async function analyze(st) {
  const { ctx } = st, ev = st.evidence, f = st.findings; let text = null, usedModel = false;
  if (ctx.write) {
    const pack = { question: st.q, plan: st.plan, rules: ev.states && ev.states.rows, liens: ((ev.liens && ev.liens.rows) || []).slice(0, 8), passages: (ev.kb || []).slice(0, 5).map(k => ({ title: k.title, text: k.text })), gaps: f.gaps.slice(0, 8), conflicts: f.conflicts, notes: f.notes.slice(0, 6) };
    try { text = await ctx.write(pack); usedModel = !!text; } catch (e) { text = null; }
  }
  const body = text || deterministic(st);
  return { analysis: { text: body, usedModel }, trace: [step('Analyze results', usedModel ? 'written by the model from verified evidence' : 'plain summary (model not used)')] };
}
async function report(st) {
  const ev = st.evidence, f = st.findings, sources = [], seen = new Set();
  const add = (n, u, k, c) => { const key = (u || n); if (seen.has(key)) return; seen.add(key); sources.push({ name: n, url: u || null, kind: k, checked: c || null }); };
  (ev.parcelHit || []).forEach(r => add(r.county + ' official list', r.source, 'county-list', r.checked));
  ((ev.liens && ev.liens.rows) || []).slice(0, 8).forEach(r => add(r.county + ' official list', r.source || null, 'county-list', r.checked));
  (ev.kb || []).forEach(k => add(k.title, k.url, k.kind, k.checked));
  const uncertainty = [...f.conflicts, ...f.gaps.slice(0, 6)];
  const text = st.analysis.text + (f.notes.length ? '\n\nHistorical or stale: ' + (f.notes.length > 3 ? f.notes.length + ' of the listings checked are historical or stale, for example: ' + f.notes[0] : f.notes.join(' ')) : '') + '\n\nVerify: confirm every figure, date and availability with the county tax collector before you act. This is research, not advice.';
  return { result: { answer: text, usedModel: st.analysis.usedModel, plan: st.plan, trace: st.trace.concat(step('Generate report', sources.length + ' source(s)')), evidence: { liens: ((ev.liens && ev.liens.rows) || []).slice(0, 8), states: (ev.states && ev.states.rows) || [], total: ev.liens ? ev.liens.total : null }, findings: f, sources, uncertainty, coverage: ev.coverage || [], parcel: ev.parcelHit || [] }, trace: [] };
}

export function buildGraph() {
  return new StateGraph(S)
    .addNode('understand', understand).addNode('planner', plan).addNode('retrieve', retrieve).addNode('verify', verify).addNode('analyze', analyze).addNode('report', report)
    .addEdge(START, 'understand').addEdge('understand', 'planner').addEdge('planner', 'retrieve').addEdge('retrieve', 'verify')
    .addConditionalEdges('verify', st => (st.retried && st.evidence && st.evidence.liens && st.evidence.liens.total === 0 && !(st.evidence.relaxed)) ? 'retrieve' : 'analyze', ['retrieve', 'analyze'])
    .addEdge('analyze', 'report').addEdge('report', END).compile();
}
let G = null;
export async function research(q, ctx) { G = G || buildGraph(); const out = await G.invoke({ q, ctx, retried: false }); return out.result; }
