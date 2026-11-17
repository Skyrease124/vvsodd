// Owner-only: read a scanned county PDF with Google Cloud Vision (DOCUMENT_TEXT_DETECTION), 5 pages per call.
//   POST { pdf: <base64>, from: 1 }  ->  { ok, totalPages, pages:[{n, text}] }
// The PDF is not stored; it is sent to Google only for reading and the text comes back to the owner's browser.
import * as auth from '../lib/auth.mjs';
import * as KEYS from '../lib/apikeys.mjs';
const json = (c, b) => new Response(JSON.stringify(b), { status: c, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
const BASE = process.env.VISION_BASE || 'https://vision.googleapis.com/v1';
export default async function handler(req) {
  const me = await auth.userFromCookie(req.headers.get('cookie'));
  if (!me) return json(401, { ok: false, error: 'Sign in first.' });
  if (!me.owner) return json(403, { ok: false, error: 'Owner only.' });
  if (req.method !== 'POST') return json(405, { ok: false });
  await KEYS.load(true); const key = KEYS.keyOf('GOOGLE_VISION_KEY'); if (!key) return json(200, { ok: false, error: 'Save the Google Cloud Vision key on the API keys page first.' });
  let b; try { b = await req.json(); } catch (e) { return json(400, { ok: false, error: 'File too big or bad request (limit about 4 MB per PDF).' }); }
  const pdf = String(b.pdf || ''); if (pdf.length < 100 || !/^[A-Za-z0-9+/=]+$/.test(pdf.slice(0, 200))) return json(400, { ok: false, error: 'No PDF received.' });
  const from = Math.max(1, Number(b.from) || 1), pages = [0, 1, 2, 3, 4].map(i => from + i);
  try {
    const r = await fetch(BASE + '/files:annotate?key=' + encodeURIComponent(key), { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(24000),
      body: JSON.stringify({ requests: [{ inputConfig: { content: pdf, mimeType: 'application/pdf' }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }], pages }] }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return json(200, { ok: false, error: 'Google said: ' + ((d.error && d.error.message) || 'HTTP ' + r.status).slice(0, 200) });
    const res = (d.responses || [])[0] || {};
    if (res.error) return json(200, { ok: false, error: 'Google said: ' + String(res.error.message).slice(0, 200) });
    const total = res.totalPages || 0;
    const out = (res.responses || []).map((x, i) => ({ n: (x.context && x.context.pageNumber) || from + i, text: (x.fullTextAnnotation && x.fullTextAnnotation.text) || '' }));
    return json(200, { ok: true, totalPages: total, pages: out });
  } catch (e) { return json(200, { ok: false, error: 'Reading timed out or failed. Try again.' }); }
}
