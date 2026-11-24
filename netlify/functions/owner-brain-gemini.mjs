// Owner-confirmed Gemini document extraction (upload only, free tier, one file per request).
//   GET                               -> stored results, allowance and on/off state
//   POST {action:'gemini-extract', confirmed:true, pdf:<base64>, text:<County PDF Reader text>, fileName?}
//   POST {action:'gemini-review', id, decision:'verified'|'rejected'}   (owner decision on one stored result)
//   POST {action:'gemini-resume'}      switches the job on again after a stop
// Results are stored unverified and never written to published map data. NVIDIA does not read them yet.
import {createHash} from 'node:crypto';
import * as auth from '../lib/brain-auth.mjs';
import * as RL from '../lib/ratelimit.mjs';
import * as KEYS from '../lib/apikeys.mjs';
import * as GL from '../lib/gemini-limits.mjs';
import * as GX from '../lib/gemini-extract.mjs';
export const STORE = 'brain-helper-results-v1-gemini';
const CFG = 'owner-ai-research-api-controls';
const BASE = process.env.GEMINI_BASE || 'https://generativelanguage.googleapis.com';
const MAX_BODY = 6_000_000, KEEP = 50;
const j = (status, data) => new Response(JSON.stringify(data), {status, headers: {'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'Vary': 'Cookie', 'X-Robots-Tag': 'noindex'}});
const empty = () => ({version: 1, stopped: false, results: []});

async function handler(req) {
  const me = await auth.userFromCookie(req.headers.get('cookie') || '');
  if (!me?.owner) return j(me ? 403 : 401, {ok: false, error: 'Owner access required'});
  const settings = await auth.kvGet(CFG), caps = GL.geminiCaps(settings);
  const doc = (await auth.kvGet(STORE)) || empty();
  if (req.method === 'GET') return j(200, {ok: true, enabled: caps.enabled, stopped: !!doc.stopped, used: await GL.geminiUsedToday(RL, caps), daily: caps.daily, results: doc.results});
  if (req.method !== 'POST') return j(405, {ok: false, error: 'GET or POST only'});
  if (req.headers.get('origin') !== new URL(req.url).origin) return j(403, {ok: false, error: 'Invalid origin'});
  let body;
  try { const raw = await req.text(); if (raw.length > MAX_BODY) throw Error('big'); body = JSON.parse(raw); } catch { return j(400, {ok: false, error: 'Invalid or too large request (limit about 4 MB per PDF).'}); }

  if (body.action === 'gemini-resume') { doc.stopped = false; await auth.kvPut(STORE, doc); return j(200, {ok: true, stopped: false}); }
  if (body.action === 'gemini-review') {
    const r = doc.results.find(x => x.id === body.id);
    if (!r || !['verified', 'rejected'].includes(body.decision)) return j(400, {ok: false, error: 'Unknown result or decision'});
    if (body.decision === 'verified') {
      // NVIDIA reads a verified result only with a dataset (one county) and the official source link you checked it against.
      if (!GX.DATASET_OK.test(String(body.dataset || ''))) return j(400, {ok: false, error: 'Enter the dataset, for example IA-scott.'});
      const link = GX.httpsOnly(body.sourceUrl);
      if (!link) return j(400, {ok: false, error: 'Enter the official source link (https).'});
      r.dataset = String(body.dataset); r.sourceUrl = link;
    }
    r.decision = body.decision; r.verified = body.decision === 'verified'; r.reviewedAt = new Date().toISOString();
    await auth.kvPut(STORE, doc);
    return j(200, {ok: true, id: r.id, decision: r.decision});
  }
  if (body.action !== 'gemini-extract' || !body.confirmed) return j(400, {ok: false, error: 'Confirm one Gemini request for one uploaded file'});
  if (!caps.enabled) return j(409, {ok: false, error: 'Gemini is switched off (API Keys, Research Controls)'});
  if (doc.stopped) return j(409, {ok: false, error: 'Gemini stopped after a provider error. Turn it on again first.'});
  const pdf = String(body.pdf || ''), text = String(body.text || '').slice(0, GX.MAX_TEXT_CHARS);
  if (pdf.length < 100 || !/^[A-Za-z0-9+/]+=*$/.test(pdf)) return j(400, {ok: false, error: 'No PDF received.'});
  if (Math.floor(pdf.length * 3 / 4) > GX.MAX_PDF_BYTES) return j(400, {ok: false, error: 'PDF is over the 4 MB limit.'});
  if (text.trim().length < 20) return j(400, {ok: false, error: 'Read the PDF with the County PDF Reader first: its text is needed to check every quote.'});
  await KEYS.load(true);
  const key = KEYS.keyOf('GEMINI_API_KEY');
  if (!key) return j(409, {ok: false, error: 'Save a Gemini key in Owner API Keys first'});
  const slot = await GL.reserveGemini(RL, caps);
  if (!slot.ok) return j(429, {ok: false, error: slot.error});
  const model = String(settings?.geminiModel || GX.DEFAULT_MODEL);
  const out = await GX.extract({key, base: BASE, model, pdfBase64: pdf, docText: text});
  if (!out.ok) {
    if (out.stop) { doc.stopped = true; await auth.kvPut(STORE, doc); }
    return j(502, {ok: false, error: out.error, dropped: out.dropped});
  }
  const rec = {id: 'g' + Date.now().toString(36) + createHash('sha256').update(pdf).digest('hex').slice(0, 6), createdAt: new Date().toISOString(),
    model: out.model, fileSha256: createHash('sha256').update(Buffer.from(pdf, 'base64')).digest('hex'), fileName: String(body.fileName || '').replace(/[^\w .\-]/g, '').slice(0, 80),
    status: out.status, verified: false, decision: null, facts: out.facts, droppedCount: out.dropped.length, dropped: out.dropped};
  doc.results = [rec, ...doc.results].slice(0, KEEP);
  await auth.kvPut(STORE, doc);
  return j(200, {ok: true, result: rec});
}

export default auth.withBrainStore(handler);
