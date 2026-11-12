// Property & Neighborhood Report API.
//   GET  ?county=Miami-Dade&parcel=30-2205-000-0200            -> the report (public; official data only)
//   POST {action:'estateSet', county, parcel, caseNumber, documentTitle, sourceUrl}   (site owner only: reviewer confirmation)
//   POST {action:'estateRemove', county, parcel}                                       (site owner only)
import * as auth from '../lib/auth.mjs';
import * as R from '../lib/report.mjs';

const json = (code, body) => new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': code === 200 ? 'public, max-age=300' : 'no-store' } });
const cache = new Map(), hits = new Map();
const limited = (k, n, ms) => { const now = Date.now(), r = (hits.get(k) || []).filter(t => now - t < ms); if (r.length >= n) return true; r.push(now); hits.set(k, r); return false; };
const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const estateKey = (county, id) => 'FL|' + county + '|' + id;
const links = async () => (await auth.kvGet('estate-links')) || {};

export default async function handler(req, context) {
  const ip = req.headers.get('x-nf-client-connection-ip') || (context && context.ip) || 'x';
  if (limited('r' + ip, 90, 60000)) return json(429, { error: 'Too many requests. Wait a minute.' });
  if (req.method === 'POST') {
    const me = await auth.userFromCookie(req.headers.get('cookie') || '');
    if (!me) return json(401, { error: 'Sign in.' });
    if (!auth.markOwner(me).owner) return json(403, { error: 'Only the reviewer (site owner) can confirm an estate link.' });
    let b; try { b = await req.json(); } catch (e) { return json(400, { error: 'Bad request.' }); }
    const county = clean(b.county, 30), id = R.normId(county, b.parcel); if (!id) return json(400, { error: 'Unknown county or parcel number.' });
    const all = await links(), k = estateKey(county, id);
    if (b.action === 'estateRemove') { delete all[k]; await auth.kvPut('estate-links', all); cache.clear(); return json(200, { ok: true }); }
    if (b.action !== 'estateSet') return json(400, { error: 'Unknown action.' });
    const caseNumber = clean(b.caseNumber, 40), documentTitle = clean(b.documentTitle, 120), sourceUrl = clean(b.sourceUrl, 300);
    if (!caseNumber || !documentTitle) return json(400, { error: 'A case number and the title of the official document that names this exact property are required.' });
    try { const u = new URL(sourceUrl); if (u.protocol !== 'https:') throw 0; } catch (e) { return json(400, { error: 'The official document needs an https:// link.' }); }
    all[k] = { caseNumber, documentTitle, sourceUrl, confirmedBy: me.email, confirmedAt: new Date().toISOString().slice(0, 10) };
    await auth.kvPut('estate-links', all); cache.clear(); return json(200, { ok: true });
  }
  const q = new URL(req.url).searchParams, county = clean(q.get('county'), 30), parcel = clean(q.get('parcel'), 40);
  if (!R.CONFIG[county]) return json(404, { supported: false, error: 'The report is available for Miami-Dade and Palm Beach counties so far.' });
  const ck = county + '|' + parcel; let rep = cache.get(ck);
  if (!rep || Date.now() - rep.t > 6 * 3600e3) { rep = { t: Date.now(), v: await R.buildReport(county, parcel) }; if (cache.size > 500) cache.clear(); cache.set(ck, rep); }
  const out = JSON.parse(JSON.stringify(rep.v));
  const id = out.id, link = id ? (await links())[estateKey(county, id)] : null;
  if (link && out.ownership) { out.ownership.status = 'estate_linked'; out.ownership.label = 'Estate record linked'; out.ownership.estate = link; out.ownership.why = 'A reviewer confirmed that this official document connects the estate to this exact property. It does not by itself say who can sign for the property today.'; }
  return json(200, out);
}
