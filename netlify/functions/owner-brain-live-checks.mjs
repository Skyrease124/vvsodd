// Owner-only live checks for the helper APIs and the intake round trip. Preview only: on production every route
// answers 404. GET reports availability, limits and the last outcome (never a key value). POST runs one check after
// an explicit confirmation. Each check sends at most one bounded request, inside its own daily allowance.
import * as auth from '../lib/brain-auth.mjs';
import * as keystore from '../lib/keystore.mjs';
import * as KEYS from '../lib/apikeys.mjs';
import * as RL from '../lib/ratelimit.mjs';
import * as GL from '../lib/groq-limits.mjs';
import {complete} from '../lib/llm.mjs';
import {reserveRun, usageToday, DAILY_LIMIT} from '../lib/brain-nvidia.mjs';
import {DETROIT_GIS} from '../lib/brain-official-verification.mjs';
import {runLiveCheck, summary, reserveOwnBudget, usedOwnBudget, intakeRoundTrip, describeNvidia} from '../lib/live-checks.mjs';

const json = (status, body) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'Vary': 'Cookie', 'X-Robots-Tag': 'noindex, nofollow'}});
const GEOAPIFY_LIMIT = 25;  // live-check geocodes per day (raised from 5 by the owner); the account's 300 a day is shared with the automatic finder
const ROUND_TRIP_LIMIT = 3; // intake round trips per day

function buildChecks(now) {
  return {
    nvidia: {
      label: 'NVIDIA chat check',
      cost: 'One chat request, up to 256 tokens. Uses one of the daily NVIDIA runs shared with consolidation.',
      limit: DAILY_LIMIT,
      missing: 'NVIDIA key is not configured. Nothing was sent.',
      available: async () => !!(await keystore.getConfig())?.key,
      usedToday: () => usageToday(auth, now),
      reserve: () => reserveRun(auth, now),
      secrets: async () => [(await keystore.getConfig())?.key],
      run: async () => {
        const cfg = await keystore.getConfig();
        // Reasoning models spend their first tokens thinking, so a tiny limit returns no visible text. 256 tokens with
        // thinking turned off is still one small request. The reply text is never stored.
        try {
          return describeNvidia(await complete(cfg, 'detailed thinking off. Reply with the single word OK.', 'Ping.', {maxTokens: 256, timeoutMs: 20000}), null);
        } catch (error) {
          console.warn('NVIDIA live check failed', error?.code || error?.name, error?.upstreamStatus || '', error?.detail || '');
          return describeNvidia(null, error);
        }
      },
    },
    geoapify: {
      label: 'Geoapify geocode check',
      cost: 'One geocode request. Separate live-check allowance of 5 per day, inside the account limit of 300 per day.',
      limit: GEOAPIFY_LIMIT,
      missing: 'Geoapify key is not saved. Save it in the API key manager first. Nothing was sent.',
      available: async () => { await KEYS.load(); return !!KEYS.keyOf('GEOAPIFY_API_KEY'); },
      usedToday: () => usedOwnBudget(auth, 'geoapify', now),
      reserve: () => reserveOwnBudget(auth, 'geoapify', GEOAPIFY_LIMIT, now),
      secrets: async () => [KEYS.keyOf('GEOAPIFY_API_KEY')],
      run: async () => {
        const key = KEYS.keyOf('GEOAPIFY_API_KEY');
        const url = 'https://api.geoapify.com/v1/geocode/search?' + new URLSearchParams({text: '90 Chandler, Detroit MI 48202', limit: '1', filter: 'countrycode:us', apiKey: key});
        try {
          const response = await fetch(url, {signal: AbortSignal.timeout(8500), redirect: 'error'});
          if (!response.ok) return {outcome: 'failed', detail: 'Geoapify returned HTTP ' + response.status + '. Check the key, quota and restrictions.'};
          const body = await response.json();
          if (!Array.isArray(body.features)) return {outcome: 'failed', detail: 'Geoapify answered without a result list.'};
          return {outcome: 'ok', detail: 'Geoapify answered with ' + body.features.length + ' result(s). One geocode request was used.'};
        } catch {
          return {outcome: 'failed', detail: 'Geoapify did not answer in time.'};
        }
      },
    },
    // Usage only: Groq requests are made by the connection test and by triage, never by this list.
    groq: {
      label: 'Groq connection test and triage',
      cost: 'Shared allowance for the key test and parcel triage. This entry only shows usage.',
      displayOnly: true,
      limit: GL.groqCaps(null).daily,
      missing: 'Groq key is not saved, or Groq is switched off. Nothing was sent.',
      available: async () => { await KEYS.load(); return !!KEYS.keyOf('GROQ_API_KEY') && GL.groqCaps(await auth.kvGet('owner-ai-research-api-controls')).enabled; },
      usedToday: async () => GL.groqUsedToday(RL, GL.groqCaps(await auth.kvGet('owner-ai-research-api-controls'))),
      run: async () => ({outcome: 'failed', detail: 'This entry only shows usage.'}),
    },
    wayne_gis: {
      label: 'Wayne County GIS layer check',
      cost: 'One layer-metadata request through the shared Wayne GIS budget. No parcel is queried.',
      limit: null,
      missing: null,
      available: async () => true,
      run: async () => {
        try {
          const response = await auth.fetchWayneGis(DETROIT_GIS + '?f=json');
          if (!response.ok) return {outcome: 'failed', detail: 'Wayne County GIS returned HTTP ' + response.status + '.'};
          const body = await response.json();
          if (!body || (!body.name && !body.geometryType)) return {outcome: 'failed', detail: 'Wayne County GIS answered without layer metadata.'};
          return {outcome: 'ok', detail: 'Wayne County GIS answered layer metadata. No parcel was queried.'};
        } catch (error) {
          if (error?.code === 'QUOTA') return {outcome: 'budget_limited', detail: 'The shared Wayne GIS daily budget is used up. Nothing was sent.'};
          return {outcome: 'failed', detail: 'Wayne County GIS did not answer in time.'};
        }
      },
    },
    intake_round_trip: {
      label: 'Intake round trip (test item)',
      cost: 'Writes one test item to the preview store only, then withdraws it. Limit 3 per day.',
      limit: ROUND_TRIP_LIMIT,
      missing: null,
      available: async () => true,
      usedToday: () => usedOwnBudget(auth, 'intake_round_trip', now),
      reserve: () => reserveOwnBudget(auth, 'intake_round_trip', ROUND_TRIP_LIMIT, now),
      run: () => intakeRoundTrip({auth, now}),
    },
  };
}

async function handler(req) {
  if (req.method !== 'GET' && req.method !== 'POST') return json(405, {ok: false, error: 'GET or POST only'});
  if (!auth.isBrainPreview()) return json(404, {ok: false, error: 'Not available on this site.'});
  const me = await auth.userFromCookie(req.headers.get('cookie') || '');
  if (!me?.owner) return json(me ? 403 : 401, {ok: false, error: 'Owner access required'});
  const now = Date.now();
  const checks = buildChecks(now);
  if (req.method === 'GET') return json(200, {ok: true, previewOnly: true, ...(await summary({auth, checks, now}))});
  if (req.headers.get('origin') !== new URL(req.url).origin) return json(403, {ok: false, error: 'Invalid request origin.'});
  let b;
  try { const raw = await req.text(); if (raw.length > 300) throw Error('too large'); b = JSON.parse(raw); }
  catch { return json(400, {ok: false, error: 'Invalid request'}); }
  if (b?.action !== 'run' || b.confirmed !== true || typeof b.name !== 'string') return json(400, {ok: false, error: 'Explicit confirmation required'});
  const paused = (await auth.kvGet('owner-brain-scanner-v1'))?.status === 'paused';
  const out = await runLiveCheck({auth, name: b.name, checks, now, paused});
  if (!out.ok) return json(out.status, {ok: false, error: out.error});
  return json(200, {ok: true, result: out.result});
}

export default auth.withBrainStore(handler);
