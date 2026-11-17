// Owner-only API key box (/owner/keys/). The owner pastes a key; it is stored on the server and never shown again (only the last 4 characters).
//   GET                         -> { ok, keys:[{name,label,set,hint,source}] }
//   POST {name, value}          -> save      POST {name, remove:true} -> clear
//   POST {test:'ga'|'az'}       -> server-side check: camera count, one sample camera, and whether its image loads (the key is never returned)
import * as auth from '../lib/auth.mjs';
import * as KEYS from '../lib/apikeys.mjs';
import { PROVIDERS } from './cameras.mjs';
import * as FIRMS from '../lib/firms.mjs';
const json = (c, b) => new Response(JSON.stringify(b), { status: c, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
const UA = 'PricePocketAsset parcel research site (https://pricepocketasset.com)';
export default async function handler(req) {
  const me = await auth.userFromCookie(req.headers.get('cookie'));
  if (!me) return json(401, { ok: false, error: 'Sign in first.' });
  if (!me.owner) return json(403, { ok: false, error: 'Owner only.' });
  await KEYS.load(true);
  const list = () => Object.keys(KEYS.NAMES).map(n => { const env = !!process.env[n], k = KEYS.keyOf(n); return { name: n, label: KEYS.NAMES[n], set: !!k, hint: k ? '…' + k.slice(-4) : '', source: env ? 'Netlify setting' : k ? 'Saved here' : '' }; });
  if (req.method === 'GET') return json(200, { ok: true, keys: list() });
  if (req.method !== 'POST') return json(405, { ok: false });
  let b; try { b = await req.json(); } catch (e) { return json(400, { ok: false, error: 'Bad request.' }); }
  if (b.test === 'firms') {
    try { const r = await FIRMS.nearby(37.5, -120.5, 50, 2); if (!r.ok) return json(200, { ok: false, error: 'No key saved yet.' });
      return json(200, { ok: true, firms: true, provider: 'NASA FIRMS', fires: r.total, partial: r.partial }); }
    catch (e) { return json(200, { ok: false, error: String(e.message || e).replace(/csv\/[^/]+\//, 'csv/\u2026/') }); }
  }
  if (b.test) {
    const p = PROVIDERS[b.test]; if (!p || !p.keyed) return json(400, { ok: false, error: 'Unknown provider.' });
    if (!KEYS.keyOf(p.keyEnv)) return json(200, { ok: false, error: 'No key saved yet.' });
    try {
      const cams = await p.keyed.call(p), c = cams[Math.floor(cams.length / 2)];
      let img = { ok: false };
      try { const r = await fetch(c.image, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) }); const type = r.headers.get('content-type') || '', size = (await r.arrayBuffer()).byteLength; img = { ok: r.ok && /^image\//.test(type) && size > 2000, status: r.status, type, size }; } catch (e) { img = { ok: false, error: 'image did not load' }; }
      return json(200, { ok: true, provider: p.name, cameras: cams.length, sample: { name: c.name, road: c.road, lat: c.lat, lng: c.lng, viewer: c.viewer, image: c.image }, image: img });
    } catch (e) { return json(200, { ok: false, error: String(e.message || e).replace(/key=[^&\s]+/gi, 'key=…') }); }
  }
  if (!KEYS.NAMES[b.name]) return json(400, { ok: false, error: 'Unknown key name.' });
  if (b.remove) { await KEYS.remove(b.name); return json(200, { ok: true, keys: list() }); }
  const v = String(b.value || '').trim();
  if (!/^[A-Za-z0-9._\-]{8,200}$/.test(v)) return json(400, { ok: false, error: 'That does not look like a key (letters and numbers only, no spaces).' });
  await KEYS.save(b.name, v); return json(200, { ok: true, keys: list() });
}
