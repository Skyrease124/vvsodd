// Owner-triggered live checks for the helper APIs and the intake round trip. Preview only.
// Each run: checks availability (a boolean, never a value), reserves its own daily allowance, sends at most one
// bounded request, and stores only an outcome word, a fixed sentence and the time. Keys, URLs carrying keys and
// response bodies are never stored or returned. Dependencies are injected, so this module is testable without
// the network or the Netlify runtime.
import {updateJson} from './brain-approvals.mjs';
import {audienceFor} from './research-releases.mjs';
import {validateSubmission, newItem, verifyItem, approveItem, withdrawReleaseInList, mutateIntake, mutateReleases} from './property-intake.mjs';

// Counters use a key without the word "usage", so the preview keeps them in its own store. Upstream quotas that are
// shared with production (NVIDIA, Wayne GIS) are still reserved through their shared counters.
export const LOG = 'owner-live-checks-v1';
export const COUNTER = 'owner-live-checks-counter-v1';
const HOUR = 3600e3;
const OUTCOMES = new Set(['ok', 'failed', 'not_configured', 'budget_limited']);

export const dayOf = now => new Date(now).toISOString().slice(0, 10);

export async function usedOwnBudget(auth, name, now = Date.now()) {
  const cur = (await auth.kvGet(COUNTER)) || {};
  return cur.day === dayOf(now) ? (cur.counts?.[name] || 0) : 0;
}

// Throws {code: 'BUDGET'} when the check's own daily limit is reached. Nothing is sent in that case.
export async function reserveOwnBudget(auth, name, limit, now = Date.now()) {
  const day = dayOf(now);
  await updateJson(auth, COUNTER, cur => {
    const base = cur?.day === day ? cur : {day, counts: {}};
    const used = base.counts?.[name] || 0;
    if (used >= limit) throw Object.assign(Error('Daily live-check limit reached'), {code: 'BUDGET'});
    return {day, counts: {...base.counts, [name]: used + 1}};
  });
}

// Removes the given secret values and anything shaped like a key from text that may be stored or shown.
export function scrub(text, secrets = []) {
  let out = String(text ?? '').slice(0, 300);
  for (const s of secrets) if (typeof s === 'string' && s.length >= 6) out = out.split(s).join('[redacted]');
  return out.replace(/(api[_-]?key|token|bearer|authorization|secret)\s*[=:]?\s*\S+/gi, '$1 [redacted]');
}

async function recordResult(auth, record) {
  const cur = (await auth.kvGet(LOG)) || {};
  const last = {...(cur.last || {}), [record.name]: {outcome: record.outcome, detail: record.detail, at: record.at, durationMs: record.durationMs}};
  const history = [{name: record.name, outcome: record.outcome, at: record.at}, ...(cur.history || [])].slice(0, 30);
  await auth.kvPut(LOG, {schemaVersion: 1, last, history});
}

// Runs one check. checks maps a name to {label, cost, limit, missing, available(), usedToday(), reserve(), run(), secrets()}.
export async function runLiveCheck({auth, name, checks, now = Date.now(), paused = false}) {
  const spec = Object.prototype.hasOwnProperty.call(checks, name) ? checks[name] : null;
  if (!spec) return {status: 404, ok: false, error: 'Unknown check'};
  if (spec.displayOnly) return {status: 400, ok: false, error: 'This entry only shows usage. It cannot be run.'};
  if (paused) return {status: 409, ok: false, error: 'Agent automation is paused. Nothing was sent.'};
  const started = Date.now();
  const at = new Date(now).toISOString();
  let result = null;
  if (!(await spec.available())) {
    result = {outcome: 'not_configured', detail: spec.missing || 'This check is not configured. Nothing was sent.'};
  } else {
    try {
      if (spec.reserve) await spec.reserve();
    } catch (error) {
      if (error?.code !== 'QUOTA' && error?.code !== 'BUDGET') throw error;
      result = {outcome: 'budget_limited', detail: 'The daily allowance for this check is used up. Nothing was sent.'};
    }
    if (!result) {
      try { result = await spec.run(); }
      catch { result = {outcome: 'failed', detail: 'The check stopped before it returned a result.'}; }
    }
  }
  const secrets = spec.secrets ? (await spec.secrets()).filter(Boolean) : [];
  const outcome = OUTCOMES.has(result.outcome) ? result.outcome : 'failed';
  const record = {name, outcome, detail: scrub(result.detail, secrets), at, durationMs: Date.now() - started};
  await recordResult(auth, record);
  return {status: 200, ok: true, result: record};
}

// What the owner page shows: availability booleans, limits, usage and the last outcome. Never a key or a URL.
export async function summary({auth, checks, now = Date.now()}) {
  const last = ((await auth.kvGet(LOG)) || {}).last || {};
  const items = [];
  for (const name of Object.keys(checks)) {
    const spec = checks[name];
    const available = (await spec.available()) === true;
    items.push({
      name, label: spec.label, cost: spec.cost, available, displayOnly: spec.displayOnly === true,
      missing: available ? null : (spec.missing || null),
      limitPerDay: spec.limit ?? null,
      usedToday: spec.usedToday ? await spec.usedToday(now) : null,
      last: last[name] ? {outcome: last[name].outcome, detail: last[name].detail, at: last[name].at} : null,
    });
  }
  return {items, now: new Date(now).toISOString()};
}

// Runs the intake path against the preview store: submit, verify, approve (Pro first), check the Pro and Free
// timing with the same audience rule the public feed uses, withdraw, and check the withdrawn release is hidden.
// The test item uses origin 'live-check' and a parcel id that is not a real parcel.
export async function intakeRoundTrip({auth, now = Date.now()}) {
  const at = new Date(now);
  const actor = 'owner-live-check';
  const v = validateSubmission({kind: 'new_property', origin: 'live-check', state: 'FL', county: 'Palm Beach', parcelId: 'LIVE-CHECK-0001', category: 'land_bank',
    title: 'Live check round trip item', description: 'Owner live check: a test item saved in the preview store only, then withdrawn.'});
  if (!v.ok) return {outcome: 'failed', detail: 'The test item failed validation. Nothing was stored.'};
  let item = newItem(v.item, {now: at, actor});
  const saveItem = next => mutateIntake(auth, intake => ({...intake, items: intake.items.map(x => (x.id === next.id ? next : x))}));
  await mutateIntake(auth, intake => ({...intake, items: [...intake.items, item]}));

  const verified = verifyItem(item, {evidenceUrl: 'https://www.pbcgov.org/', notes: 'Live check: round trip test item, not a parcel record.',
    checklist: {officialSource: true, identityMatched: true}, now: at, actor});
  if (verified.error) return {outcome: 'failed', detail: 'Round trip stopped at verification. Test item left for review.'};
  item = verified.item; await saveItem(item);

  const approved = approveItem(item, {releaseMode: 'pro_first_48h', now: at, actor});
  if (approved.error) return {outcome: 'failed', detail: 'Round trip stopped at approval. Test item left for review.'};
  const release = approved.release;
  await mutateReleases(auth, list => [release, ...list.filter(r => r.id !== release.id)]);
  item = approved.item; await saveItem(item);

  const pro = {paidThrough: '2999-12-31'};
  const t = Date.parse(release.proReleaseAt);
  const expectations = [
    ['Pro sees the item at approval', audienceFor(release, pro, t) === 'pro'],
    ['Free does not see it at approval', audienceFor(release, null, t) === 'none'],
    ['Free still waits one millisecond before 48 hours', audienceFor(release, null, t + 48 * HOUR - 1) === 'none'],
    ['Free sees it at exactly 48 hours', audienceFor(release, null, t + 48 * HOUR) === 'free'],
  ];

  const later = new Date(t + 49 * HOUR);
  let withdrawn = null, failure = null;
  await mutateReleases(auth, list => {
    const r = withdrawReleaseInList(list, release.id, {reason: 'Live check complete: withdrawing the test item.', now: later, actor});
    if (r.error) { failure = r; return undefined; }
    withdrawn = r.release;
    return r.list;
  });
  if (failure || !withdrawn) return {outcome: 'failed', detail: 'Round trip stopped at withdrawal. Test item left for review.'};
  expectations.push(['A withdrawn item is hidden from Pro and Free', audienceFor(withdrawn, pro, t + 49 * HOUR) === 'none' && audienceFor(withdrawn, null, t + 49 * HOUR) === 'none']);
  item = {...item, status: 'withdrawn', audit: [...item.audit, {at: later.toISOString(), action: 'withdrawn', by: actor, note: 'live check'}]};
  await saveItem(item);

  const failed = expectations.filter(([, ok]) => !ok).map(([label]) => label);
  if (failed.length) return {outcome: 'failed', detail: 'Round trip finished with failed expectations: ' + failed.join('; ') + '.'};
  return {outcome: 'ok', detail: 'Round trip: submitted, verified, approved Pro first, checked the Pro and Free timing, then withdrawn. Stored in the preview store only.'};
}

// Describes an NVIDIA chat result for the owner, naming where a failure came from. Never includes a key.
// ok -> {outcome:'ok'}; errors come from netlify/lib/llm.mjs complete(), whose own status 502 is a label, not NVIDIA's.
export function describeNvidia(result, error) {
  if (!error) {
    const fb = result?.fallbackFrom;
    return {outcome: 'ok', detail: 'NVIDIA answered with model ' + result.model + '.'
      + (fb ? ' The configured model ' + fb.model + ' was refused by NVIDIA with HTTP ' + fb.status + ', so a fallback was used.' : '')};
  }
  const fb = error.fallbackFrom ? ' The configured model ' + error.fallbackFrom.model + ' was refused by NVIDIA with HTTP ' + error.fallbackFrom.status + '.' : '';
  if (error.code === 'EMPTY_ANSWER') return {outcome: 'failed', detail: 'NVIDIA responded (HTTP ' + (error.upstreamStatus || 200) + ') but returned no visible text: ' + error.detail + '. Our backend counts this as a failure.' + fb};
  if (error.code === 'UPSTREAM') return {outcome: 'failed', detail: 'NVIDIA returned HTTP ' + error.upstreamStatus + '.'};
  if (error.code === 'NO_MODEL') return {outcome: 'failed', detail: 'NVIDIA refused the configured model (HTTP ' + error.upstreamStatus + ') and no fallback model answered.'};
  if (error.name === 'AbortError') return {outcome: 'failed', detail: 'NVIDIA did not answer before the time limit. Nothing was received.'};
  return {outcome: 'failed', detail: 'The request did not reach NVIDIA or failed in our backend before a response.'};
}
