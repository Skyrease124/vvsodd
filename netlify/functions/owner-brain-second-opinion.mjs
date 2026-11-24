// Owner-confirmed second opinion on one NVIDIA receipt, from Cloudflare Workers AI (free allowance, one request per receipt).
//   GET  -> allowance, on/off state and stored opinions
//   POST {action:'second-opinion', receiptId, confirmed:true}
//   POST {action:'cloudflare-resume'}   switches the job on again after a stop
// It only stores verdicts for display. It never changes, adds, approves or publishes a proposal, and has no schedule.
import * as auth from '../lib/brain-auth.mjs';
import * as RL from '../lib/ratelimit.mjs';
import * as KEYS from '../lib/apikeys.mjs';
import * as CL from '../lib/cloudflare-limits.mjs';
import * as CO from '../lib/cloudflare-opinion.mjs';
export const STORE = 'brain-helper-results-v1-cloudflare';
const RECEIPTS = 'brain-nvidia-consolidation-v1';
const CFG = 'owner-ai-research-api-controls';
const BASE = process.env.CLOUDFLARE_BASE || 'https://api.cloudflare.com';
const KEEP = 30;
const j = (status, data) => new Response(JSON.stringify(data), {status, headers: {'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'Vary': 'Cookie', 'X-Robots-Tag': 'noindex'}});

async function handler(req) {
  const me = await auth.userFromCookie(req.headers.get('cookie') || '');
  if (!me?.owner) return j(me ? 403 : 401, {ok: false, error: 'Owner access required'});
  const settings = await auth.kvGet(CFG), caps = CL.cloudflareCaps(settings);
  const doc = (await auth.kvGet(STORE)) || {version: 1, stopped: false, results: []};
  const model = String(settings?.cloudflareModel || CO.DEFAULT_MODEL);
  if (req.method === 'GET') return j(200, {ok: true, enabled: caps.enabled, stopped: !!doc.stopped, used: await CL.cloudflareUsedToday(RL, caps), daily: caps.daily, model, results: doc.results});
  if (req.method !== 'POST') return j(405, {ok: false, error: 'GET or POST only'});
  if (req.headers.get('origin') !== new URL(req.url).origin) return j(403, {ok: false, error: 'Invalid origin'});
  let body; try { const raw = await req.text(); if (raw.length > 400) throw Error(); body = JSON.parse(raw); } catch { return j(400, {ok: false, error: 'Invalid request'}); }
  if (body.action === 'cloudflare-resume') { doc.stopped = false; await auth.kvPut(STORE, doc); return j(200, {ok: true, stopped: false}); }
  if (body.action !== 'second-opinion' || !body.confirmed || typeof body.receiptId !== 'string') return j(400, {ok: false, error: 'Confirm one second opinion for one receipt'});
  if (!caps.enabled) return j(409, {ok: false, error: 'The second opinion is switched off (API Keys, Research Controls)'});
  if (doc.stopped) return j(409, {ok: false, error: 'Cloudflare stopped after a provider error. Turn it on again first.'});
  if (doc.results.some(r => r.receiptId === body.receiptId)) return j(409, {ok: false, error: 'This receipt already has a second opinion.'});
  const receipt = ((await auth.kvGet(RECEIPTS))?.receipts || []).find(r => r.id === body.receiptId);
  if (!receipt || receipt.outcome !== 'completed') return j(404, {ok: false, error: 'No completed NVIDIA receipt with that id.'});
  const payload = CO.buildPayload(receipt);
  if (!payload) return j(409, {ok: false, error: 'That receipt has no proposals to check, or is too large.'});
  await KEYS.load(true);
  const token = KEYS.keyOf('CLOUDFLARE_API_TOKEN'), accountId = KEYS.keyOf('CLOUDFLARE_ACCOUNT_ID');
  if (!token || !accountId) return j(409, {ok: false, error: 'Save the Cloudflare account ID and API token in Owner API Keys first'});
  const slot = await CL.reserveCloudflare(RL, caps);
  if (!slot.ok) return j(429, {ok: false, error: slot.error});
  const out = await CO.ask({token, accountId, model, payload, base: BASE});
  if (!out.ok) {
    if (out.stop) { doc.stopped = true; await auth.kvPut(STORE, doc); }
    return j(502, {ok: false, error: out.error, dropped: out.dropped});
  }
  const rec = {receiptId: receipt.id, at: new Date().toISOString(), model: out.model, status: 'unverified', opinions: out.opinions, droppedCount: out.dropped.length};
  doc.results = [rec, ...doc.results].slice(0, KEEP);
  await auth.kvPut(STORE, doc);
  return j(200, {ok: true, result: rec});
}

export default auth.withBrainStore(handler);
