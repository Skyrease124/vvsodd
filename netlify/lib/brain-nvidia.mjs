// NVIDIA consolidation of REAL helper-agent results.
// Inputs are read from stored helper output only (official GIS worker, validator decisions,
// Photon and Geoapify candidates). NVIDIA receives a bounded list of sourced items with short
// references (H1, H2, ...). Its answer is checked deterministically: every cited reference must
// exist in the input and every proposal must be backed by an official or validator item.
// Nothing is published here. Every proposal waits for owner approval.
import {complete} from './llm.mjs';
import {updateJson, LEDGER, DECISION} from './brain-approvals.mjs';

export const RECEIPTS = 'brain-nvidia-consolidation-v1';
export const USAGE = 'brain-nvidia-usage-v1';
export const DAILY_LIMIT = 3; // owner-triggered consolidations per UTC day, to stay inside free allowances
const MAX_ITEMS = 30, COORD_TOLERANCE = 0.002; // degrees, about 200 m
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

// Reads stored helper output. Each item keeps its source and timestamp.
export async function collectItems(auth) {
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
  raw.sort((a, b) => String(b.checkedAt).localeCompare(String(a.checkedAt)));
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
    const official = group.filter(i => i.source === 'validator' || i.source === 'official-gis-worker');
    const classOf = i => (['pending_owner_review', 'approved_for_staging', 'published'].includes(i.status) ? 'verified' : 'unverified');
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
    'Photon and Geoapify items are unverified geocoder candidates, not parcel boundaries.',
    'Return ONLY JSON: {"conflicts":[{"parcelId":"...","refs":["H1"],"detail":"short factual text"}],"proposals":[{"parcelId":"...","refs":["H1"],"summary":"short factual text"}]}.',
    'Propose an update only when a validator or official-gis-worker item supports it. Every proposal needs owner approval.',
  ].join(' ');
  const user = JSON.stringify(items.map(({ref, source, dataset, parcelId, recordId, status, reason, lat, lon, evidenceUrl, checkedAt, unverified}) =>
    ({ref, source, dataset, parcelId, recordId, status, reason, lat, lon, evidenceUrl, checkedAt, unverified: !!unverified})));
  return {system, user};
}

// Output budget: enough for one short conflict or proposal per item, bounded for free-tier use.
export const tokenBudget = n => Math.min(2048, Math.max(600, 300 + 60 * (n || 0)));

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
  const pool = JSON.stringify(cited).replace(/,/g, '');
  return numbersIn(text).find(n => !pool.includes(n.replace(/,/g, '')));
}
// Source references are built from the input items, never from the model.
const sourcesOf = cited => cited.map(i => ({ref: i.ref, source: i.source, dataset: i.dataset || null, status: i.status || null, evidenceUrl: i.evidenceUrl || null,
  checkedAt: i.checkedAt || null, unverified: !!i.unverified}));
// Facts only from official or validator items; geocoder candidates never supply a location.
function factsOf(parcelId, cited, dataset = null) {
  const official = cited.filter(i => i.source === 'validator' || i.source === 'official-gis-worker');
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
    if (!cited.some(i => i.source === 'validator' || i.source === 'official-gis-worker')) { rejected.push('proposal has no official or validator source'); continue; }
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
export async function runConsolidation({auth, now = Date.now(), config = null} = {}) {
  const started = Date.now();
  const id = 'nv-' + new Date(now).toISOString().replace(/[-:.TZ]/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 8);
  const items = await collectItems(auth);
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
      const answer = await complete(cfg, system, user, {maxTokens, timeoutMs: 25000, temperature: 0.1, thinking: false});
      const checked = validateConsolidation(answer.text, items);
      // An answer cut off at the token limit that is not valid JSON is incomplete: nothing is proposed from it.
      const cutOff = answer.finishReason === 'length' && checked.rejected.includes('answer was not valid JSON');
      receipt = {...base, model: answer.model, outcome: cutOff ? 'failed' : 'completed', incomplete: cutOff || undefined,
        error: cutOff ? 'NVIDIA answered but stopped at the ' + maxTokens + '-token limit before finishing its JSON; nothing was proposed.' : undefined,
        maxTokens, fallbackFrom: answer.fallbackFrom || undefined, bytesSent: Buffer.byteLength(system + user),
        conflicts: [...deterministic, ...(cutOff ? [] : checked.conflicts)], proposals: cutOff ? [] : checked.proposals, rejected: checked.rejected, durationMs: Date.now() - started};
    } catch (error) {
      const quota = error.upstreamStatus === 429 || /NVIDIA said 429/.test(String(error.detail || ''));
      // An empty answer means NVIDIA responded but gave no visible text; the receipt says so instead of a bare failure.
      const empty = error.code === 'EMPTY_ANSWER';
      receipt = {...base, model: error.model || null, outcome: quota ? 'quota_limited' : 'failed', incomplete: empty || undefined,
        error: scrub((empty ? 'NVIDIA responded (HTTP ' + (error.upstreamStatus || 200) + ') but returned no visible text: ' : '') + (error.detail || error.message), cfg.key),
        conflicts: deterministic, proposals: [], rejected: [], durationMs: Date.now() - started};
    }
  }
  await updateJson(auth, RECEIPTS, cur => ({receipts: [receipt, ...(cur?.receipts || [])].slice(0, 20)}));
  return receipt;
}
