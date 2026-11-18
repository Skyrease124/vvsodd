// Owner-only API key box (/owner/keys/). The owner pastes a key; it is stored on the server and never shown again (only the last 4 characters).
//   GET                         -> { ok, keys:[{name,label,set,hint,source}] }
//   POST {name, value}          -> save      POST {name, remove:true} -> clear
//   POST {test:'ga'|'az'}       -> server-side check: camera count, one sample camera, and whether its image loads (the key is never returned)
import * as auth from '../lib/auth.mjs';
import * as KEYS from '../lib/apikeys.mjs';
import { APP_ID as OSAPP, postAny as OSPOST, candidates as OSKEYS } from '../lib/onesignal.mjs';
import { PROVIDERS } from './cameras.mjs';
import * as FIRMS from '../lib/firms.mjs';
import * as ENERGY from '../lib/energy.mjs';
import * as WX from '../lib/wx.mjs';
import * as GOV from '../lib/govdata.mjs';
import * as GM from '../lib/gmaps.mjs';
import * as RC from '../lib/rentcast.mjs';
import * as CEN from '../lib/census.mjs';
import * as BLS from '../lib/bls.mjs';
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
  if (b.test === 'onesignal') {
    // Checks the key without sending anyone a notification: the target is an external id nobody has, so a valid key gets "no recipients".
    if (!(await OSKEYS()).length) return json(200, { ok: false, error: 'No key saved yet.' });
    try {
      const { r, scheme, source } = await OSPOST({ app_id: OSAPP, target_channel: 'push', include_aliases: { external_id: ['pp_key_check_nobody'] }, headings: { en: 'Key check' }, contents: { en: 'Key check' } }, AbortSignal.timeout(10000));
      const d = await r.json().catch(() => ({})); const msg = JSON.stringify(d.errors || d.message || '').slice(0, 160);
      if (r.status === 401 || r.status === 403) return json(200, { ok: false, error: 'OneSignal rejected every key we hold (' + r.status + ', tried both key styles and each saved key). Check that it is the key for THIS app (App ID starts 0bfd191b) from Settings > Keys & IDs > App API Keys, copied whole with no spaces. An Organization key or the Identity Verification key will not work.' });
      if (r.status >= 500) return json(200, { ok: false, error: 'OneSignal had a problem (' + r.status + '). Try again.' });
      return json(200, { ok: true, nlr: true, text: 'The key ' + source + ' was accepted (' + scheme + ' style) for app ' + OSAPP.slice(0, 8) + '\u2026. No notification was sent (' + (d.id ? 'sent' : 'no recipients, as expected') + ').' + (r.ok ? '' : ' Note: ' + msg) });
    } catch (e) { return json(200, { ok: false, error: 'No answer from OneSignal.' }); }
  }
  if (b.test === 'bls') {
    try { const r = await BLS.jobsFor('13', '021'); if (!r.ok) return json(200, { ok: false, error: r.reason === 'nokey' ? 'No key saved yet.' : 'No answer.' });
      return json(200, { ok: true, nlr: true, text: r.none ? 'Answered, but no data for the test county.' : 'Bibb County, GA unemployment ' + r.rate + '% (' + r.month + '), state ' + r.state + '%, US ' + r.us + '%.' }); }
    catch (e) { return json(200, { ok: false, error: String(e.message || e).slice(0, 200) }); }
  }
  if (b.test === 'census') {
    try { const r = await CEN.neighborhood(32.84, -83.63); if (!r.ok) return json(200, { ok: false, error: r.reason === 'nokey' ? 'No key saved yet.' : 'No answer.' });
      return json(200, { ok: true, nlr: true, text: 'ACS ' + r.range + '. Test spot in Macon, GA: tract median household income ' + (r.tract && r.tract.income ? '$' + r.tract.income.toLocaleString('en-US') : 'n/a') + ', ' + (r.county ? r.county.name : '') + ' population ' + (r.county && r.county.pop ? r.county.pop.toLocaleString('en-US') : 'n/a') + '.' }); }
    catch (e) { return json(200, { ok: false, error: String(e.message || e).replace(/key=[^&\s]+/g, 'key=\u2026') }); }
  }
  if (b.test === 'rentcast') {
    const k = KEYS.keyOf('RENTCAST_KEY'); if (!k) return json(200, { ok: false, error: 'No key saved yet.' });
    // A bad-key check that costs no credit: RentCast rejects invalid keys before counting a request? Not guaranteed, so test with a 0-result query only once a day.
    try { const r = await fetch((process.env.RENTCAST_BASE || 'https://api.rentcast.io/v1') + '/properties?' + new URLSearchParams({ address: '1 Test Rd, Nowhere, ZZ 00000', limit: 1 }), { headers: { 'X-Api-Key': k }, signal: AbortSignal.timeout(10000) });
      const d = await r.json().catch(() => ({})); if (r.status === 401 || r.status === 403) return json(200, { ok: false, error: 'RentCast said: ' + (d.message || 'key not accepted') });
      return json(200, { ok: true, nlr: true, text: 'Used this month on the site: ' + (await RC.usedThisMonth()) + ' of ' + RC.CAP + ' (this test may count as 1 on your RentCast plan).' }); }
    catch (e) { return json(200, { ok: false, error: 'No answer from RentCast.' }); }
  }
  if (b.test === 'vision') {
    const k = KEYS.keyOf('GOOGLE_VISION_KEY'); if (!k) return json(200, { ok: false, error: 'No key saved yet.' });
    const res = [], chk = async (name, f) => { try { const m = await f(); res.push(name + ': ' + (m || 'OK')); } catch (e) { res.push(name + ': FAILED (' + String(e.message || e).slice(0, 140) + ')'); } };
    const gj = async (url, opt) => { const r = await fetch(url, Object.assign({ signal: AbortSignal.timeout(10000) }, opt)); const d = await r.json().catch(() => ({})); if (!r.ok || d.error) throw new Error((d.error && d.error.message) || 'HTTP ' + r.status); return d; };
    await chk('PDF reading (Vision)', () => gj((process.env.VISION_BASE || 'https://vision.googleapis.com/v1') + '/images:annotate?key=' + encodeURIComponent(k), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requests: [{ image: { content: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' }, features: [{ type: 'TEXT_DETECTION' }] }] }) }).then(() => ''));
    await chk('Google maps (Map Tiles)', () => GM.tile('satellite', 3, 2, 3).then(t => t ? '' : 'no key'));
    await chk('Street View', async () => { const d = await gj((process.env.GMAPS_BASE || 'https://maps.googleapis.com/maps/api') + '/streetview/metadata?location=33.749,-84.388&key=' + encodeURIComponent(k)); if (d.status === 'REQUEST_DENIED') throw new Error(d.error_message || 'denied'); return ''; });
    await chk('Nearby places (Places)', () => GM.nearby(33.749, -84.388).then(r => r.ok ? '' : 'no answer'));
    await chk('Road access (Roads)', () => GM.road(33.749, -84.388).then(r => r.ok ? '' : 'no answer'));
    const bad = res.filter(x => /FAILED/.test(x));
    return json(200, bad.length === res.length ? { ok: false, error: res.join(' | ') } : { ok: true, nlr: true, text: res.join(' \u00b7 ') });
  }
  if (b.test === 'gov') {
    try { const [c, p] = await Promise.all([GOV.crime(32.84, -83.63), GOV.parks(32.84, -83.63)]); if (!c.ok && c.reason === 'nokey') return json(200, { ok: false, error: 'No key saved yet.' });
      return json(200, { ok: true, nlr: true, text: 'Test spot: Macon, GA. FBI: ' + (c.agency ? c.agency.name + ' ' + c.year + ' data found' : 'no answer') + '. Parks: ' + (p.ok && p.parks[0] ? p.parks[0].name + ' ' + p.parks[0].miles + ' mi' : 'no answer') + '.' }); }
    catch (e) { return json(200, { ok: false, error: String(e.message || e).replace(/(api_key|API_KEY)=[^&\s]+/g, '$1=\u2026') }); }
  }
  if (b.test === 'wx') {
    try { const r = await WX.forecast(33.749, -84.388, 2, 0); if (!r.ok) return json(200, { ok: false, error: 'No key saved yet.' });
      return json(200, { ok: true, nlr: true, text: 'Test spot: ' + r.place.name + ', ' + r.place.region + '. Now ' + r.now.f + '\u00b0F, ' + r.now.text + (r.air ? '. Air: ' + r.air.label : '') + '.' }); }
    catch (e) { return json(200, { ok: false, error: String(e.message || e) }); }
  }
  if (b.test === 'nlr') {
    try { const r = await ENERGY.lookup(33.749, -84.388); if (!r.ok) return json(200, { ok: false, error: 'No key saved yet.' });
      return json(200, { ok: true, nlr: true, text: 'Test spot: downtown Atlanta. Solar: ' + (r.solar ? r.solar.kwhYear.toLocaleString('en-US') + ' kWh/year for 4 kW' : 'no answer') + '. Utility: ' + (r.rates && r.rates.utility ? r.rates.utility : 'no answer') + '. EV stations within 25 mi: ' + (r.ev ? r.ev.total : 'no answer') + '.' }); }
    catch (e) { return json(200, { ok: false, error: String(e.message || e).replace(/api_key=[^&\s]+/gi, 'api_key=\u2026') }); }
  }
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
