// Current members of the U.S. Congress for a state, from the Library of Congress API (api.congress.gov). Needs CONGRESS_API_KEY (owner keys box).
// Names, party, chamber and district only, as the source lists them. No ratings, no opinions.
import * as KEYS from './apikeys.mjs';
const API = process.env.CONGRESS_API || 'https://api.congress.gov/v3/member/';
const UA = 'PricePocketAsset research (https://pricepocketasset.com)';
const cache = new Map(), TTL = 12 * 36e5;
const terms = m => Array.isArray(m.terms) ? m.terms : (m.terms && Array.isArray(m.terms.item) ? m.terms.item : []);
const flip = n => { const s = String(n || '').trim(); const i = s.indexOf(','); return i > 0 ? (s.slice(i + 1).trim() + ' ' + s.slice(0, i).trim()).replace(/\s+/g, ' ') : s; };
const party = p => /democrat/i.test(p) ? 'D' : /republican/i.test(p) ? 'R' : /independent/i.test(p) ? 'I' : String(p || '').slice(0, 12);
export function shape(d) {
  const out = [];
  for (const m of (d && Array.isArray(d.members) ? d.members : [])) {
    const t = terms(m).slice(-1)[0] || {}, ch = /senate/i.test(t.chamber || '') ? 'Senate' : /house/i.test(t.chamber || '') ? 'House' : '';
    if (!m.bioguideId || !m.name || !ch) continue;
    out.push({ id: String(m.bioguideId), name: flip(m.name).slice(0, 80), party: party(m.partyName), chamber: ch, district: m.district != null && ch === 'House' ? String(m.district) : '', link: 'https://bioguide.congress.gov/search/bioguide/' + encodeURIComponent(m.bioguideId) });
  }
  return out.sort((a, b) => (a.chamber === b.chamber ? 0 : a.chamber === 'Senate' ? -1 : 1) || (+a.district || 0) - (+b.district || 0) || a.name.localeCompare(b.name));
}
export async function forState(st) {
  await KEYS.load(); const key = KEYS.keyOf('CONGRESS_API_KEY'); if (!key) return { ok: false, reason: 'nokey' };
  const h = cache.get(st); if (h && Date.now() - h.t < TTL) return h.v;
  const c = new AbortController(), t = setTimeout(() => c.abort(), 9000);
  try {
    const r = await fetch(API + st + '?' + new URLSearchParams({ currentMember: 'true', limit: '250', format: 'json' }), { headers: { 'User-Agent': UA, 'X-Api-Key': key, Accept: 'application/json' }, signal: c.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const v = { ok: true, state: st, members: shape(await r.json()), checked: new Date().toISOString(), source: 'Library of Congress (api.congress.gov)' };
    if (!v.members.length) return { ok: false, reason: 'lookup' };
    if (cache.size > 80) cache.clear(); cache.set(st, { t: Date.now(), v }); return v;
  } catch (e) { return { ok: false, reason: 'lookup' }; } finally { clearTimeout(t); }
}
export const _reset = () => cache.clear();
