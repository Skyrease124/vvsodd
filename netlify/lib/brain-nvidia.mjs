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
const MI_BOX = {minLat: 41.6, maxLat: 48.4, minLon: -90.5, maxLon: -82.1};

const clip = (v, n = 160) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);
const inBox = (lat, lon) => lat != null && lon != null && lat >= MI_BOX.minLat && lat <= MI_BOX.maxLat && lon >= MI_BOX.minLon && lon <= MI_BOX.maxLon;
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
    raw.push({source: 'official-gis-worker', parcelId: clip(row.parcelId, 20), status: clip(row.status, 60), reason: clip(row.reason), checkedAt: row.checkedAt});
  }
  for (const e of (ledger.entries || []).filter(x => x.dataset === 'MI-wayne' && [DECISION.pending, DECISION.approved].includes(x.decision)).slice(-15)) {
    raw.push({source: 'validator', parcelId: clip(e.parcelId, 20), recordId: clip(e.recordId, 40), status: clip(e.decision, 60),
      lat: num(e.proposedPosition?.lat), lon: num(e.proposedPosition?.lon), evidenceUrl: /^https:\/\//.test(e.evidenceUrl || '') ? clip(e.evidenceUrl, 300) : null,
      checkedAt: e.reviewedAt});
  }
  for (const [source, store] of [['photon', photon], ['geoapify', geo]]) {
    for (const row of (Array.isArray(store.recent) ? store.recent : []).slice(0, 10)) {
      if (!row?.checkedAt) continue;
      const c = Array.isArray(row.candidates) ? row.candidates[0] : null;
      const lat = num(c?.lat), lon = num(c?.lon);
      raw.push({source, parcelId: clip(row.parcelId, 20), status: clip(row.status, 60), lat: inBox(lat, lon) ? lat : null, lon: inBox(lat, lon) ? lon : null,
        checkedAt: row.checkedAt, unverified: true});
    }
  }
  raw.sort((a, b) => String(b.checkedAt).localeCompare(String(a.checkedAt)));
  return raw.slice(0, MAX_ITEMS).map((item, i) => ({ref: 'H' + (i + 1), ...item}));
}

// Deterministic conflicts: same parcel, different status class or different location across helpers.
export function deterministicConflicts(items) {
  const byParcel = new Map();
  for (const item of items) if (item.parcelId) byParcel.set(item.parcelId, [...(byParcel.get(item.parcelId) || []), item]);
  const out = [];
  for (const [parcelId, group] of byParcel) {
    if (group.length < 2) continue;
    // Verified = validator or official worker reported an exact match (pending, approved or published).
    // Unverified = the worker could not confirm the parcel. One of each is a real disagreement.
    const official = group.filter(i => i.source === 'validator' || i.source === 'official-gis-worker');
    const classOf = i => (['pending_owner_review', 'approved_for_staging', 'published'].includes(i.status) ? 'verified' : 'unverified');
    const classes = new Set(official.map(classOf));
    if (classes.size > 1)
      out.push({parcelId, refs: official.map(i => i.ref), kind: 'status_disagreement', origin: 'deterministic',
        detail: 'Official worker and validator disagree on whether this parcel was verified.'});
    const located = group.filter(i => i.lat != null && i.lon != null);
    for (let a = 0; a < located.length; a++) for (let b = a + 1; b < located.length; b++) {
      const dLat = Math.abs(located[a].lat - located[b].lat), dLon = Math.abs(located[a].lon - located[b].lon);
      if (dLat > COORD_TOLERANCE || dLon > COORD_TOLERANCE)
        out.push({parcelId, refs: [located[a].ref, located[b].ref], kind: 'location_disagreement', origin: 'deterministic',
          detail: 'Stored coordinates for this parcel differ by more than about 200 m.'});
    }
  }
  return out;
}

export function buildPrompt(items) {
  const system = [
    'You consolidate helper-agent results for a county tax-sale research team.',
    'Use ONLY the items provided. Each item has a ref (H1, H2, ...). Do not invent parcel IDs, coordinates, owners, amounts, dates or sources.',
    'Photon and Geoapify items are unverified geocoder candidates, not parcel boundaries.',
    'Return ONLY JSON: {"conflicts":[{"parcelId":"...","refs":["H1"],"detail":"short factual text"}],"proposals":[{"parcelId":"...","refs":["H1"],"summary":"short factual text"}]}.',
    'Propose an update only when a validator or official-gis-worker item supports it. Every proposal needs owner approval.',
  ].join(' ');
  const user = JSON.stringify(items.map(({ref, source, parcelId, recordId, status, reason, lat, lon, evidenceUrl, checkedAt, unverified}) =>
    ({ref, source, parcelId, recordId, status, reason, lat, lon, evidenceUrl, checkedAt, unverified: !!unverified})));
  return {system, user};
}

// Strict check of NVIDIA's answer. Anything that cannot be traced to an input item is dropped.
export function validateConsolidation(text, items) {
  const rejected = [];
  let parsed;
  try { parsed = JSON.parse(String(text).replace(/^```(?:json)?\s*|\s*```$/g, '').trim()); }
  catch { return {conflicts: [], proposals: [], rejected: ['answer was not valid JSON']}; }
  const byRef = new Map(items.map(i => [i.ref, i]));
  const refsOk = refs => Array.isArray(refs) && refs.length > 0 && refs.length <= 6 && refs.every(r => byRef.has(r));
  const conflicts = [], proposals = [];
  for (const c of (Array.isArray(parsed?.conflicts) ? parsed.conflicts : []).slice(0, 20)) {
    const parcels = refsOk(c?.refs) ? new Set(c.refs.map(r => byRef.get(r).parcelId)) : null;
    if (!parcels || parcels.size !== 1 || !parcels.has(clip(c.parcelId, 20))) { rejected.push('conflict cited unknown refs or another parcel'); continue; }
    conflicts.push({parcelId: clip(c.parcelId, 20), refs: c.refs, kind: 'model_flag', origin: 'nvidia', detail: clip(c.detail, 240)});
  }
  for (const p of (Array.isArray(parsed?.proposals) ? parsed.proposals : []).slice(0, 20)) {
    const cited = refsOk(p?.refs) ? p.refs.map(r => byRef.get(r)) : null;
    if (!cited) { rejected.push('proposal cited unknown refs'); continue; }
    if (!cited.every(i => i.parcelId === clip(p.parcelId, 20))) { rejected.push('proposal named a parcel its sources do not cover'); continue; }
    if (!cited.some(i => i.source === 'validator' || i.source === 'official-gis-worker')) { rejected.push('proposal has no official or validator source'); continue; }
    proposals.push({parcelId: clip(p.parcelId, 20), refs: p.refs, summary: clip(p.summary, 300), requiresOwnerApproval: true});
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
  const base = {id, at: new Date(now).toISOString(), inputs: {count: items.length, sources: {}, refs: items.map(i => ({ref: i.ref, source: i.source, parcelId: i.parcelId || null, checkedAt: i.checkedAt}))}};
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
      const answer = await complete(cfg, system, user, {maxTokens: 900, timeoutMs: 25000, temperature: 0.1});
      const checked = validateConsolidation(answer.text, items);
      receipt = {...base, model: answer.model, outcome: 'completed', bytesSent: Buffer.byteLength(system + user),
        conflicts: [...deterministic, ...checked.conflicts], proposals: checked.proposals, rejected: checked.rejected, durationMs: Date.now() - started};
    } catch (error) {
      const quota = /NVIDIA said 429/.test(String(error.detail || ''));
      receipt = {...base, model: null, outcome: quota ? 'quota_limited' : 'failed', error: scrub(error.detail || error.message, cfg.key),
        conflicts: deterministic, proposals: [], rejected: [], durationMs: Date.now() - started};
    }
  }
  await updateJson(auth, RECEIPTS, cur => ({receipts: [receipt, ...(cur?.receipts || [])].slice(0, 20)}));
  return receipt;
}
