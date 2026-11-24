// Owner-only NVIDIA consolidation of helper-agent results. Owner-triggered; no schedule.
// GET reports status and receipts. POST runs one bounded consolidation after explicit confirmation.
// The API key is read server-side and is never returned, logged, or sent to the browser.
import * as auth from '../lib/brain-auth.mjs';
import * as keystore from '../lib/keystore.mjs';
import {RECEIPTS, DAILY_LIMIT, usageToday, runConsolidation} from '../lib/brain-nvidia.mjs';
const json = (status, body) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'Vary': 'Cookie', 'X-Robots-Tag': 'noindex, nofollow'}});

function publicReceipt(r) {
  return {id: r.id, at: r.at, outcome: r.outcome, model: r.model || null, durationMs: r.durationMs ?? null,
    inputs: {count: r.inputs?.count ?? 0, sources: r.inputs?.sources || {}, refs: (r.inputs?.refs || []).slice(0, 30)},
    conflicts: (r.conflicts || []).slice(0, 30), proposals: (r.proposals || []).slice(0, 20), rejected: (r.rejected || []).slice(0, 20),
    error: r.error || null, bytesSent: r.bytesSent ?? null, incomplete: r.incomplete === true, maxTokens: r.maxTokens ?? null, fallbackFrom: r.fallbackFrom || null};
}

async function handler(req) {
  if (req.method !== 'GET' && req.method !== 'POST') return json(405, {ok: false, error: 'GET or POST only'});
  const me = await auth.userFromCookie(req.headers.get('cookie') || '');
  if (!me?.owner) return json(me ? 403 : 401, {ok: false, error: 'Owner access required'});
  const cfg = await keystore.getConfig();
  if (req.method === 'GET') {
    const stored = (await auth.kvGet(RECEIPTS))?.receipts || [];
    const used = await usageToday(auth);
    const remaining = Math.max(0, DAILY_LIMIT - used);
    const last = stored[0];
    // Most recent outcome wins; a configured key with no run yet is idle.
    const state = !cfg?.key ? 'not_configured' : remaining === 0 ? 'quota_limited' : last?.outcome === 'failed' ? 'failed' : last?.outcome === 'completed' ? 'completed' : 'idle';
    return json(200, {ok: true, configured: !!cfg?.key, keySource: cfg?.key ? cfg.source : null, state,
      dailyLimit: DAILY_LIMIT, usedToday: used, remainingToday: remaining, receipts: stored.slice(0, 10).map(publicReceipt)});
  }
  if (req.headers.get('origin') !== new URL(req.url).origin) return json(403, {ok: false, error: 'Invalid origin'});
  let b; try { const raw = await req.text(); if (raw.length > 300) throw Error(); b = JSON.parse(raw); } catch { return json(400, {ok: false, error: 'Invalid request'}); }
  if (b?.action !== 'consolidate' || b.confirmed !== true) return json(400, {ok: false, error: 'Explicit confirmation required'});
  const control = await auth.kvGet('owner-brain-scanner-v1');
  if (control?.status === 'paused') return json(409, {ok: false, error: 'Agent automation is paused'});
  if (!cfg?.key) return json(409, {ok: false, error: 'NVIDIA is not configured for this environment. Nothing was sent.'});
  if ((await usageToday(auth)) >= DAILY_LIMIT) return json(429, {ok: false, error: 'Daily NVIDIA consolidation limit reached. Nothing was sent.'});
  try {
    const receipt = await runConsolidation({auth, config: cfg});
    return json(200, {ok: true, receipt: publicReceipt(receipt),
      notice: receipt.outcome === 'completed' ? 'NVIDIA consolidation stored. Every proposal still needs owner approval.' : 'Consolidation ended with outcome: ' + receipt.outcome + '.'});
  } catch (e) {
    if (e.code === 'QUOTA') return json(429, {ok: false, error: 'Daily NVIDIA consolidation limit reached. Nothing was sent.'});
    return json(502, {ok: false, error: 'Consolidation failed before storing a receipt.'});
  }
}
export default auth.withBrainStore(handler);
