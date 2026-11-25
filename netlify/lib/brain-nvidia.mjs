// NVIDIA consolidation of REAL helper-agent results.
// Inputs are read from stored helper output only (official GIS worker, validator decisions,
// Photon and Geoapify candidates). NVIDIA receives a bounded list of sourced items with short
// references (H1, H2, ...). Its answer is checked deterministically: every cited reference must
// exist in the input and every proposal must be backed by an official or validator item.
// Nothing is published here. Every proposal waits for owner approval.
import {complete, fastModel} from './llm.mjs';
import {updateJson, LEDGER, DECISION} from './brain-approvals.mjs';
import {operationCountyIds, countyOperation} from './brain-gis-universal.mjs';
import {countyCheckpointKey} from './brain-gis-county-worker.mjs';
import {MATCHES} from './parcel-matches-registry.mjs';
import {storedFactOk, DATASET_OK, httpsOnly} from './gemini-extract.mjs';

export const RECEIPTS = 'brain-nvidia-consolidation-v1';
export const USAGE = 'brain-nvidia-usage-v1';
export const DAILY_LIMIT = 25; // raised from 10 by the owner
// One function call can wait about 26 seconds. The fast model gets the first 15; a second model is tried only if at least 8 are left.
export const TIMING = {budgetMs: 24000, fastMs: 15000, minRetryMs: 8000}; // owner-triggered consolidations per UTC day, to stay inside free allowances
const MAX_ITEMS = 24, MAX_COUNTY_WORKER = 10, MAX_PARCEL_MATCH = 8, MAX_GROQ = 6, MAX_GEMINI = 4, COORD_TOLERANCE = 0.002; // degrees, about 200 m
// Plausibility only: a coordinate must be inside the United States (including Alaska and Hawaii). No state or county is
// named here. A dataset's own geography is enforced by the official-source checks, never by this module.
const US_BOUNDS = {minLat: 18, maxLat: 72, minLon: -180, maxLon: -60};
// The official GIS worker store is the Wayne County worker's. Its rows carry this dataset id.
const WAYNE_WORKER_DATASET = 'MI-wayne';

const clip = (v, n = 160) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);
const inUs = (lat, lon) => lat != null && lon != null && lat >= US_BOUNDS.minLat && lat <= US_BOUNDS.maxLat && lon >= US_BOUNDS.minLon && lon <= US_BOUNDS.maxLon;
const day = now => new Date(now).toISOString().slice(0, 10);
// Removes the configured key and any key-shaped or bearer text before anything is stored or shown.
const scrub = (text, secret) => {
  let out = clip(text, 220);
  if (secret) out = out.split(secret).join('[redacted]');
  return out.replace(/nvapi-[A-Za-z0-9_-]+/g, '[redacted]').replace(/Bearer\s+\S+/gi, 'Bearer [redacted]');
};

// Worker states that describe processing, not a property fact: a timeout or a retry says nothing about the parcel itself.
// A proposal that rests only on these is rejected; they may still appear as conflicts.
const PROCESSING_STATES = /^(retry_later|retrying|provider_error|error|timeout|attention|quota_wait|transport_or_payload|http_\d+|incomplete_results)$/;
// Official sources: items that come from an official county record or an owner-visible validator decision.
// Geocoder candidates and skipped parcels are context only and can never back a proposal.
const isOfficial = i => i.source === 'validator' || i.source === 'official-gis-worker' || i.official === true;
const https = v => (/^https:\/\//.test(v || '') ? clip(v, 300) : null);

// Reads stored helper output. Each item keeps its source and timestamp.
// options.matches: parcel-match audits by dataset (default: the registered audits). options.countyIds: county worker datasets.
export async function collectItems(auth, options = {}) {
  const matches = options.matches ?? MATCHES;
  const countyIds = options.countyIds ?? operationCountyIds().filter(id => countyOperation(id)?.mode !== 'existing-worker');
  const worker = (await auth.kvGet('owner-brain-wayne-worker-v1')) || {};
  const ledger = (await auth.kvGet(LEDGER)) || {entries: []};
  const photon = (await auth.kvGet('owner-brain-photon-status-v1')) || {};
  const geo = (await auth.kvGet('owner-brain-geoapify-status-v1')) || {};
  const raw = [];
  for (const row of (Array.isArray(worker.recent) ? worker.recent : []).slice(0, 15)) {
    if (!row?.checkedAt) continue;
    raw.push({source: 'official-gis-worker', dataset: WAYNE_WORKER_DATASET, parcelId: clip(row.parcelId, 20), status: clip(row.status, 60), reason: clip(row.reason), checkedAt: row.checkedAt});
  }
  for (const e of (ledger.entries || []).filter(x => x.dataset && [DECISION.pending, DECISION.approved].includes(x.decision)).slice(-15)) {
    raw.push({source: 'validator', dataset: clip(e.dataset, 60), parcelId: clip(e.parcelId, 20), recordId: clip(e.recordId, 40), status: clip(e.decision, 60),
      lat: num(e.proposedPosition?.lat), lon: num(e.proposedPosition?.lon), evidenceUrl: /^https:\/\//.test(e.evidenceUrl || '') ? clip(e.evidenceUrl, 300) : null,
      checkedAt: e.reviewedAt});
  }
  for (const [source, store] of [['photon', photon], ['geoapify', geo]]) {
    for (const row of (Array.isArray(store.recent) ? store.recent : []).slice(0, 10)) {
      if (!row?.checkedAt) continue;
      const c = Array.isArray(row.candidates) ? row.candidates[0] : null;
      const lat = num(c?.lat), lon = num(c?.lon);
      raw.push({source, dataset: clip(row.dataset, 60) || null, parcelId: clip(row.parcelId, 20), status: clip(row.status, 60), lat: inUs(lat, lon) ? lat : null, lon: inUs(lat, lon) ? lon : null,
        checkedAt: row.checkedAt, unverified: true});
    }
  }
  // Generic county worker: saved official evidence (identity, situs address, official object and polygon all checked)
  // and the parcels it skipped. The polygon itself is never sent.
  const worked = [];
  for (const id of countyIds) {
    const cp = await auth.kvGet(countyCheckpointKey(id));
    if (!cp) continue;
    const url = https(countyOperation(id)?.source);
    for (const e of Object.values(cp.evidence || {}).filter(x => x?.parcelId && x?.checkedAt).slice(-5))
      worked.push({source: 'county-worker', dataset: clip(id, 60), parcelId: clip(e.parcelId, 20), status: 'official_evidence', official: true, evidenceUrl: url, checkedAt: e.checkedAt});
    for (const r of Object.values(cp.review || {}).filter(x => x?.parcelId && x?.checkedAt && !x.resolvedAt).slice(-5))
      worked.push({source: 'county-worker', dataset: clip(id, 60), parcelId: clip(r.parcelId, 20), status: clip(r.status, 60) || 'skipped', reason: clip(r.reason), checkedAt: r.checkedAt});
  }
  worked.sort((a, b) => String(b.checkedAt).localeCompare(String(a.checkedAt)));
  raw.push(...worked.slice(0, MAX_COUNTY_WORKER));
  // Owner-side parcel-match audits: exact parcel number, verified address and official polygon. Matches that
  // another helper also reported on come first, because they can be cross-checked. Positions stay server-side.
  const seen = new Set(raw.map(i => (i.dataset || '') + '\n' + i.parcelId));
  const matched = [];
  for (const [id, audit] of Object.entries(matches || {}))
    for (const r of (audit?.records || []).filter(x => x?.status === 'matched' && Array.isArray(x.point))) {
      const lat = num(r.point[1]), lon = num(r.point[0]);
      matched.push({source: 'parcel-match', dataset: clip(id, 60), parcelId: clip(r.parcel, 20), status: 'matched', official: true,
        lat: inUs(lat, lon) ? lat : null, lon: inUs(lat, lon) ? lon : null, evidenceUrl: https(r.evidenceUrl), checkedAt: audit.generatedAt || null,
        overlap: seen.has(clip(id, 60) + '\n' + clip(r.parcel, 20)) ? 0 : 1});
    }
  matched.sort((a, b) => a.overlap - b.overlap || a.dataset.localeCompare(b.dataset) || a.parcelId.localeCompare(b.parcelId));
  raw.push(...matched.slice(0, MAX_PARCEL_MATCH).map(({overlap, ...item}) => item));
  // Groq triage notes: stored, unverified AI summaries of queued parcels. Context only: they are never official,
  // so they cannot back a proposal, and no position or checklist is sent.
  const queue = (await auth.kvGet('owner-brain-scanner-v1'))?.queue;
  const triaged = (Array.isArray(queue) ? queue : []).filter(x => x?.triage?.status === 'complete' && x.triage.createdAt && x.parcelId && x.dataset)
    .sort((a, b) => String(b.triage.createdAt).localeCompare(String(a.triage.createdAt))).slice(0, MAX_GROQ);
  for (const x of triaged)
    raw.push({source: 'groq', dataset: clip(x.dataset, 60), parcelId: clip(x.parcelId, 20), recordId: clip(x.recordId, 40), status: 'triaged_unverified',
      reason: clip(x.triage.summary, 160), checkedAt: x.triage.createdAt, unverified: true});
  // Gemini document readings: only results the owner verified, with an owner-given dataset and https source link, and only
  // facts that pass the stored exact-value check again. They are context: official stays false, so they never back a proposal alone.
  const gem = (await auth.kvGet('brain-helper-results-v1-gemini'))?.results;
  const readings = (Array.isArray(gem) ? gem : []).filter(r => r?.verified === true && r.decision === 'verified' && DATASET_OK.test(r.dataset || '') && httpsOnly(r.sourceUrl) && r.reviewedAt)
    .sort((a, b) => String(b.reviewedAt).localeCompare(String(a.reviewedAt)));
  let gemCount = 0;
  for (const r of readings) {
    if (gemCount >= MAX_GEMINI) break;
    const good = (Array.isArray(r.facts) ? r.facts : []).filter(storedFactOk);
    const parcels = [...new Set(good.filter(f => f.field === 'parcelId').map(f => f.value))];
    if (parcels.length !== 1) continue; // one parcel per reading: otherwise it cannot be tied to one record
    const facts = {};
    for (const f of good) if (f.field !== 'parcelId' && f.field !== 'documentTitle' && !(f.field in facts)) facts[f.field] = clip(f.value, 40);
    raw.push({source: 'gemini-document', dataset: clip(r.dataset, 60), parcelId: clip(parcels[0], 20), status: 'owner_verified_reading', facts,
      evidenceUrl: httpsOnly(r.sourceUrl), checkedAt: r.reviewedAt, official: false, unverified: false});
    gemCount++;
  }
  // A smaller request finishes inside the function time limit. Parcels whose sources already disagree come first and stay
  // together, because disagreements are the most valuable thing to compare; a cap must never split such a pair.
  const groupKey = (i, n) => i.parcelId ? (i.dataset || '') + '\n' + i.parcelId : '#' + n;
  const groups = new Map();
  raw.forEach((item, n) => { const k = groupKey(item, n); groups.set(k, [...(groups.get(k) || []), item]); });
  // A parcel whose results already disagree comes first, then parcels with more sources, then official, then newest.
  const rank = g => [g.length > 1 && deterministicConflicts(g.map(i => ({...i, ref: 'x'}))).length ? 1 : 0, new Set(g.map(i => i.source)).size, g.some(isOfficial) ? 1 : 0, g.map(i => String(i.checkedAt)).sort().at(-1) || ''];
  const picked = [];
  for (const g of [...groups.values()].sort((a, b) => { const x = rank(a), y = rank(b); return y[0] - x[0] || y[1] - x[1] || y[2] - x[2] || y[3].localeCompare(x[3]); })) {
    if (picked.length + g.length > MAX_ITEMS && picked.length) { if (g.length > 1) continue; }
    for (const item of g) if (picked.length < MAX_ITEMS) picked.push(item);
    if (picked.length >= MAX_ITEMS) break;
  }
  raw.length = 0; raw.push(...picked);
  raw.sort((a, b) => (isOfficial(b) ? 1 : 0) - (isOfficial(a) ? 1 : 0) || String(b.checkedAt).localeCompare(String(a.checkedAt)));
  return raw.slice(0, MAX_ITEMS).map((item, i) => ({ref: 'H' + (i + 1), ...item}));
}

// Deterministic conflicts: same parcel, different status class or different location across helpers.
export function deterministicConflicts(items) {
  const byParcel = new Map();
  // A parcel number is only unique inside its dataset, so the key is the dataset and the number together.
  const keyOf = item => (item.dataset || '') + '\n' + item.parcelId;
  for (const item of items) if (item.parcelId) byParcel.set(keyOf(item), [...(byParcel.get(keyOf(item)) || []), item]);
  const out = [];
  for (const [key, group] of byParcel) {
    if (group.length < 2) continue;
    const parcelId = group[0].parcelId, dataset = group[0].dataset || null;
    // Verified = validator or official worker reported an exact match (pending, approved or published).
    // Unverified = the worker could not confirm the parcel. One of each is a real disagreement.
    const official = group.filter(isOfficial);
    const classOf = i => (['pending_owner_review', 'approved_for_staging', 'published', 'official_evidence', 'matched'].includes(i.status) ? 'verified' : 'unverified');
    const classes = new Set(official.map(classOf));
    if (classes.size > 1)
      out.push({parcelId, dataset, refs: official.map(i => i.ref), kind: 'status_disagreement', origin: 'deterministic',
        detail: 'Official worker and validator disagree on whether this parcel was verified.'});
    const located = group.filter(i => i.lat != null && i.lon != null);
    for (let a = 0; a < located.length; a++) for (let b = a + 1; b < located.length; b++) {
      const dLat = Math.abs(located[a].lat - located[b].lat), dLon = Math.abs(located[a].lon - located[b].lon);
      if (dLat > COORD_TOLERANCE || dLon > COORD_TOLERANCE)
        out.push({parcelId, dataset, refs: [located[a].ref, located[b].ref], kind: 'location_disagreement', origin: 'deterministic',
          detail: 'Stored coordinates for this parcel differ by more than about 200 m.'});
    }
  }
  return out;
}

export function buildPrompt(items) {
  const system = [
    'You consolidate helper-agent results for a county tax-sale research team.',
    'Use ONLY the items provided. Each item has a ref (H1, H2, ...) and a dataset (one county). The same parcel number in two datasets is two different parcels. Do not invent parcel IDs, coordinates, owners, amounts, dates or sources.',
    'Photon and Geoapify items are unverified geocoder candidates, not parcel boundaries. Items from county-worker with status official_evidence and from parcel-match are official county records; county-worker items with another status are parcels it skipped, which are context only. parcel-match items never show a position. Groq items are unverified AI triage notes: context only, never evidence, and never a reason to propose an update. gemini-document items are readings of an uploaded county file that the owner checked against the quoted text: context only, never official, and never a reason to propose an update on their own.',
    'Return ONLY JSON: {"conflicts":[{"parcelId":"...","refs":["H1"],"detail":"short factual text"}],"proposals":[{"parcelId":"...","refs":["H1"],"summary":"short factual text"}]}.',
    'Keep the answer short so it finishes: at most 5 conflicts and at most 5 proposals, the most important first, each detail or summary at most 20 words, one line of compact JSON and nothing else.',
    'A proposal must change a property fact: a position, an address, or the verification of a record. A worker state such as retry_later, timeout or error describes processing, not the parcel, so never propose from it; report it as a conflict if it disagrees with another source.',
    'Propose an update only when a validator, official-gis-worker, county-worker official_evidence or parcel-match item supports it. Every proposal needs owner approval.',
  ].join(' ');
  const user = JSON.stringify(items.map(({ref, source, dataset, parcelId, recordId, status, reason, lat, lon, evidenceUrl, checkedAt, unverified}) =>
    ({ref, source, dataset, parcelId, recordId, status, reason, lat: source === 'parcel-match' ? null : lat, lon: source === 'parcel-match' ? null : lon, evidenceUrl, checkedAt, unverified: !!unverified})));
  return {system, user};
}

// Output budget: enough for one short conflict or proposal per item, bounded for free-tier use.
export const tokenBudget = n => Math.min(1200, Math.max(600, 300 + 60 * (n || 0)));

// Parses the JSON answer. Accepts a fenced block or JSON surrounded by a sentence; anything else is not JSON.
export function parseAnswer(text) {
  const t = String(text ?? '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  try { return JSON.parse(t); } catch { /* try the outermost object */ }
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch { /* not JSON */ } }
  return null;
}

// Every number of three or more digits the model states must appear in the items it cites.
const numbersIn = text => String(text ?? '').match(/\d[\d.,-]{2,}\d|\d{3,}/g) || [];
function unsupportedNumber(text, cited) {
  // Only what NVIDIA was shown counts: a parcel-match position was withheld from the prompt.
  // Groq note text is never a source of numbers either.
  const shown = cited.map(i => (i.source === 'parcel-match' ? {...i, lat: null, lon: null} : i.source === 'groq' ? {...i, reason: null} : i));
  const pool = JSON.stringify(shown).replace(/,/g, '');
  return numbersIn(text).find(n => !pool.includes(n.replace(/,/g, '')));
}
// Source references are built from the input items, never from the model.
const sourcesOf = cited => cited.map(i => ({ref: i.ref, source: i.source, dataset: i.dataset || null, status: i.status || null, evidenceUrl: i.evidenceUrl || null,
  checkedAt: i.checkedAt || null, unverified: !!i.unverified,
  // The source's own short note, so a reviewer can check a summary against it. Groq's AI text is never passed on as evidence.
  note: i.source === 'groq' ? null : clip(i.reason, 160) || null}));
// Facts only from official or validator items; geocoder candidates never supply a location.
function factsOf(parcelId, cited, dataset = null) {
  const official = cited.filter(isOfficial);
  const located = official.find(i => Number.isFinite(i.lat) && Number.isFinite(i.lon));
  return {parcelId, dataset, statuses: [...new Set(official.map(i => i.status).filter(Boolean))],
    location: located ? {lat: located.lat, lon: located.lon, ref: located.ref} : null,
    evidenceUrls: [...new Set(official.map(i => i.evidenceUrl).filter(Boolean))]};
}

// Strict check of NVIDIA's answer. Anything that cannot be traced to an input item is dropped.
export function validateConsolidation(text, items) {
  const rejected = [];
  const parsed = parseAnswer(text);
  if (!parsed || typeof parsed !== 'object') return {conflicts: [], proposals: [], rejected: ['answer was not valid JSON']};
  const byRef = new Map(items.map(i => [i.ref, i]));
  const refsOk = refs => Array.isArray(refs) && refs.length > 0 && refs.length <= 6 && refs.every(r => byRef.has(r));
  const conflicts = [], proposals = [];
  for (const c of (Array.isArray(parsed?.conflicts) ? parsed.conflicts : []).slice(0, 20)) {
    // Every cited item must be the same parcel in the same dataset.
    const parcels = refsOk(c?.refs) ? new Set(c.refs.map(r => (byRef.get(r).dataset || '') + '\n' + byRef.get(r).parcelId)) : null;
    if (!parcels || parcels.size !== 1 || !c.refs.every(r => byRef.get(r).parcelId === clip(c.parcelId, 20))) { rejected.push('conflict cited unknown refs or another parcel'); continue; }
    const extra = unsupportedNumber(c.detail, c.refs.map(r => byRef.get(r)));
    if (extra) { rejected.push('conflict stated a value its sources do not contain (' + clip(extra, 20) + ')'); continue; }
    conflicts.push({parcelId: clip(c.parcelId, 20), dataset: byRef.get(c.refs[0]).dataset || null, refs: c.refs, kind: 'model_flag', origin: 'nvidia', detail: clip(c.detail, 240), sources: sourcesOf(c.refs.map(r => byRef.get(r)))});
  }
  for (const p of (Array.isArray(parsed?.proposals) ? parsed.proposals : []).slice(0, 20)) {
    const cited = refsOk(p?.refs) ? p.refs.map(r => byRef.get(r)) : null;
    if (!cited) { rejected.push('proposal cited unknown refs'); continue; }
    if (!cited.every(i => i.parcelId === clip(p.parcelId, 20) && (i.dataset || '') === (cited[0].dataset || ''))) { rejected.push('proposal named a parcel its sources do not cover'); continue; }
    if (!cited.some(isOfficial)) { rejected.push('proposal has no official or validator source'); continue; }
    if (cited.every(i => PROCESSING_STATES.test(i.status || ''))) { rejected.push('proposal rests only on a processing state, not a property fact'); continue; }
    const extra = unsupportedNumber(p.summary, cited);
    if (extra) { rejected.push('proposal stated a value its sources do not contain (' + clip(extra, 20) + ')'); continue; }
    proposals.push({parcelId: clip(p.parcelId, 20), dataset: cited[0].dataset || null, refs: p.refs, summary: clip(p.summary, 300), facts: factsOf(clip(p.parcelId, 20), cited, cited[0].dataset || null),
      sources: sourcesOf(cited), requiresOwnerApproval: true});
  }
  return {conflicts, proposals, rejected};
}

// Reserves one owner-triggered run for today. Throws QUOTA when the daily allowance is used.
export async function reserveRun(auth, now = Date.now()) {
  const result = await updateJson(auth, USAGE, cur => {
    const current = cur?.day === day(now) ? cur : {day: day(now), count: 0};
    if (current.count >= DAILY_LIMIT) throw Object.assign(Error('Daily NVIDIA consolidation limit reached'), {code: 'QUOTA'});
    return {...current, count: current.count + 1, lastRunAt: new Date(now).toISOString()};
  });
  return result.value;
}

export async function usageToday(auth, now = Date.now()) {
  const cur = (await auth.kvGet(USAGE)) || {};
  return cur.day === day(now) ? cur.count || 0 : 0;
}

// Runs one owner-triggered consolidation. Returns the receipt that was stored.
// config comes from the endpoint (keystore.getConfig()). This library never loads the key store itself,
// so it stays a pure module that runs without installed packages.
export async function runConsolidation({auth, now = Date.now(), config = null, sources = {}} = {}) {
  const started = Date.now();
  const id = 'nv-' + new Date(now).toISOString().replace(/[-:.TZ]/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 8);
  const items = await collectItems(auth, sources);
  const cfg = config;
  const base = {id, at: new Date(now).toISOString(), inputs: {count: items.length, sources: {}, datasets: [...new Set(items.map(i => i.dataset).filter(Boolean))].sort(),
      refs: items.map(i => ({ref: i.ref, source: i.source, dataset: i.dataset || null, parcelId: i.parcelId || null, checkedAt: i.checkedAt}))}};
  for (const i of items) base.inputs.sources[i.source] = (base.inputs.sources[i.source] || 0) + 1;
  const deterministic = deterministicConflicts(items);
  let receipt;
  if (!items.length) {
    receipt = {...base, outcome: 'no_helper_results', conflicts: [], proposals: [], rejected: [], durationMs: 0};
  } else if (!cfg?.key) {
    receipt = {...base, outcome: 'not_configured', conflicts: deterministic, proposals: [], rejected: [], durationMs: 0};
  } else {
    await reserveRun(auth, now); // throws QUOTA when the daily allowance is used; nothing is sent then
    const {system, user} = buildPrompt(items);
    try {
      const maxTokens = tokenBudget(items.length);
      const tried = [];
      const attempts = [];
      // The fast model is a reasoning model: it is asked not to reason (chat template switch), in one strict attempt. If NVIDIA
      // refuses the switch or the model, the default model is tried next without it.
      const FAST_OPTS = {strict: true, extraBody: {chat_template_kwargs: {enable_thinking: false}}};
      const attempt = async (config, ms, extra = {}) => {
        const t0 = Date.now();
        try { const a = await complete(config, system, user, {maxTokens, timeoutMs: ms, temperature: 0.1, thinking: false, ...extra}); tried.push(a.model); attempts.push({model: a.model, ok: true, ms: Date.now() - t0}); return a; }
        catch (e) {
          const model = e.model || config.model || 'unknown'; tried.push(model);
          const reason = e.name === 'AbortError' ? 'no answer in ' + Math.round(ms / 1000) + ' s' : e.code === 'EMPTY_ANSWER' ? String(e.detail || 'empty answer').replace(/^Empty answer from \S+ /, 'empty answer ').slice(0, 80) : e.upstreamStatus ? 'HTTP ' + e.upstreamStatus : 'error';
          attempts.push({model, ok: false, ms: Date.now() - t0, reason}); e.tried = tried; e.attempts = attempts; throw e;
        }
      };
      const left = () => TIMING.budgetMs - (Date.now() - started);
      // The owner's saved or environment model always wins. Otherwise a fast model goes first, then the default if time remains.
      const fast = cfg.model ? null : await fastModel(cfg.key);
      let answer;
      if (fast) {
        try { answer = await attempt({...cfg, model: fast}, Math.min(TIMING.fastMs, left()), FAST_OPTS); }
        catch (e) {
          const recoverable = e.name === 'AbortError' || e.code === 'EMPTY_ANSWER' || (e.code === 'UPSTREAM' && e.upstreamStatus !== 429);
          if (!recoverable || left() < TIMING.minRetryMs) throw e;
          answer = await attempt(cfg, left());
        }
      } else answer = await attempt(cfg, left());
      answer.tried = tried; answer.attempts = attempts;
      const checked = validateConsolidation(answer.text, items);
      // An answer cut off at the token limit that is not valid JSON is incomplete: nothing is proposed from it.
      const cutOff = answer.finishReason === 'length' && checked.rejected.includes('answer was not valid JSON');
      receipt = {...base, model: answer.model, outcome: cutOff ? 'failed' : 'completed', incomplete: cutOff || undefined,
        error: cutOff ? 'NVIDIA answered but stopped at the ' + maxTokens + '-token limit before finishing its JSON; nothing was proposed.' : undefined,
        tried: answer.tried, attempts: answer.attempts, maxTokens, fallbackFrom: answer.fallbackFrom || undefined, bytesSent: Buffer.byteLength(system + user),
        conflicts: [...deterministic, ...(cutOff ? [] : checked.conflicts)], proposals: cutOff ? [] : checked.proposals, rejected: checked.rejected, durationMs: Date.now() - started};
    } catch (error) {
      const quota = error.upstreamStatus === 429 || /NVIDIA said 429/.test(String(error.detail || ''));
      // An empty answer means NVIDIA responded but gave no visible text; the receipt says so instead of a bare failure.
      const empty = error.code === 'EMPTY_ANSWER';
      receipt = {...base, model: error.model || null, tried: error.tried, attempts: error.attempts, outcome: quota ? 'quota_limited' : 'failed', incomplete: empty || undefined,
        error: scrub(error.name === 'AbortError' ? 'NVIDIA did not answer in time (' + (error.model || 'unknown model') + ', ' + items.length + ' helper results sent). Nothing was proposed.' : (empty ? 'NVIDIA responded (HTTP ' + (error.upstreamStatus || 200) + ') but returned no visible text: ' : '') + (error.detail || error.message), cfg.key),
        conflicts: deterministic, proposals: [], rejected: [], durationMs: Date.now() - started};
    }
  }
  await updateJson(auth, RECEIPTS, cur => ({receipts: [receipt, ...(cur?.receipts || [])].slice(0, 20)}));
  return receipt;
}
