// Private setup endpoint behind /admin/. Lets the site owner paste the NVIDIA key once.
// Protected by a one-time setup code (only its SHA-256 hash is stored here).
import crypto from 'node:crypto';
import * as keystore from '../lib/keystore.mjs';

const CODE_HASH = process.env.SETUP_CODE_HASH || '7bcea3ec427a6a4ee2a7a7320f380be5ab648b3659bb38ca3420e92b17e7ae7b';
const MODELS_URL = process.env.NVIDIA_MODELS_URL || 'https://integrate.api.nvidia.com/v1/models';

const tries = new Map(); // ip -> timestamps (best effort)
const json = (c, b) => ({ statusCode: c, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }, body: JSON.stringify(b) });

function codeOk(code) {
  const norm = String(code || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  const want = Buffer.from(CODE_HASH, 'hex');
  // the hash was made from the dashed form, so rebuild it
  const dashed = norm.match(/.{1,5}/g) ? norm.match(/.{1,5}/g).join('-') : '';
  const got = crypto.createHash('sha256').update(dashed).digest();
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}
const hint = k => '…' + String(k).slice(-4);

async function handle(event) {
  if (event.httpMethod === 'GET') {
    const c = await keystore.getConfig();
    return json(200, { enabled: !!c, source: c ? c.source : 'none', hint: c ? hint(c.key) : '', model: c && c.model ? c.model : '' });
  }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Use POST.' });
  let b; try { b = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Bad request.' }); }

  const ip = ((event.headers || {})['x-nf-client-connection-ip'] || (event.headers || {})['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  const now = Date.now(), recent = (tries.get(ip) || []).filter(t => now - t < 600000);
  if (recent.length >= 6) return json(429, { error: 'Too many tries. Wait 10 minutes and try again.' });
  recent.push(now); tries.set(ip, recent);

  if (!codeOk(b.code)) { await new Promise(r => setTimeout(r, 800)); return json(403, { error: 'That setup code is not right.' }); }

  if (b.action === 'remove') {
    try { await keystore.erase(); keystore.clearCache(); } catch (e) { return json(500, { error: 'Could not remove the saved key.' }); }
    return json(200, { ok: true, message: 'The saved key was removed. The question box is now hidden.' });
  }
  if (b.action !== 'save') return json(400, { error: 'Unknown action.' });

  const key = String(b.key || '').trim();
  const model = String(b.model || '').trim().slice(0, 100);
  if (key.length < 20 || /\s/.test(key)) return json(400, { error: 'That does not look like an NVIDIA key. Paste the whole key.' });
  if (model && !/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(model)) return json(400, { error: 'The model box should be left empty unless you know the exact model name, like meta/llama-3.3-70b-instruct.' });

  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
    const r = await fetch(MODELS_URL, { headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' }, signal: ctl.signal });
    clearTimeout(t);
    if (r.status === 401 || r.status === 403) return json(400, { error: 'NVIDIA did not accept that key. Check that you copied all of it.' });
    if (!r.ok) return json(502, { error: 'Could not check the key with NVIDIA right now. Try again in a minute.' });
  } catch (e) { return json(502, { error: 'Could not reach NVIDIA to check the key. Try again in a minute.' }); }

  try { await keystore.write({ key, model, savedAt: new Date().toISOString() }); keystore.clearCache(); }
  catch (e) { return json(500, { detail: String((e && (e.name + ': ' + e.message)) || e).slice(0, 160), error: 'The key checked out but could not be saved on the server. As a backup you can add it in Netlify under Site configuration, Environment variables, named NVIDIA_API_KEY.' }); }
  return json(200, { ok: true, message: 'Saved. The question box is now on for every state page.', hint: hint(key) });
}

async function toEvent(req, context) {
  return { httpMethod: req.method, body: req.method === 'POST' ? await req.text() : null,
    headers: { 'x-nf-client-connection-ip': req.headers.get('x-nf-client-connection-ip') || (context && context.ip) || '', 'x-forwarded-for': req.headers.get('x-forwarded-for') || '' } };
}
export default async (req, context) => {
  const r = await handle(await toEvent(req, context));
  return new Response(r.body, { status: r.statusCode, headers: r.headers });
};

export { handle as _handle };
