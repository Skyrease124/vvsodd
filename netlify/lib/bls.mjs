// County jobs data from the U.S. Bureau of Labor Statistics, Local Area Unemployment Statistics (LAUS).
// All three series are "not seasonally adjusted" so county, state and US numbers compare like for like.
import * as KEYS from './apikeys.mjs';
import { tractAt } from './census.mjs';
const API = process.env.BLS_API || 'https://api.bls.gov/publicAPI/v2/timeseries/data/';
const cache = new Map();
const memo = async (k, ttl, f) => { const h = cache.get(k); if (h && Date.now() - h.t < ttl) return h.v; const v = await f(); if (cache.size > 800) cache.clear(); cache.set(k, { t: Date.now(), v }); return v; };
const pts = s => (s && s.data || []).filter(d => /^M(0[1-9]|1[0-2])$/.test(d.period) && d.value !== '-' && Number.isFinite(Number(d.value)))
  .map(d => ({ y: +d.year, m: +d.period.slice(1), label: d.periodName + ' ' + d.year, v: Number(d.value), prelim: (d.footnotes || []).some(f => f && f.code === 'P') }))
  .sort((a, b) => a.y - b.y || a.m - b.m);
export async function series(ids, key) {
  const y = new Date().getFullYear();
  const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'PricePocketAsset research (https://pricepocketasset.com)' }, signal: AbortSignal.timeout(12000),
    body: JSON.stringify({ seriesid: ids, startyear: String(y - 2), endyear: String(y), registrationkey: key }) });
  const j = await r.json().catch(() => null);
  if (!j || j.status !== 'REQUEST_SUCCEEDED') throw new Error('BLS ' + r.status + ' ' + String(j && (j.message || []).join(' ') || '').slice(0, 120));
  const out = {}; (j.Results && j.Results.series || []).forEach(s => out[s.seriesID] = pts(s)); return out;
}
export async function jobsFor(st, co) {
  await KEYS.load(); const key = KEYS.keyOf('BLS_KEY'); if (!key) return { ok: false, reason: 'nokey' };
  return memo('j' + st + co, 12 * 36e5, async () => {
    const c = 'LAUCN' + st + co + '000000000', s = 'LAUST' + st + '0000000000000';
    const d = await series([c + '3', c + '6', s + '3', 'LNU04000000'], key);
    const rate = d[c + '3'] || [], lf = d[c + '6'] || [], sr = d[s + '3'] || [], us = d.LNU04000000 || [];
    if (!rate.length) return { ok: true, none: true };
    const last = rate[rate.length - 1], at = (a, p) => (a.find(x => x.y === p.y && x.m === p.m) || {}).v ?? null;
    const yago = rate.find(x => x.y === last.y - 1 && x.m === last.m), lfl = at(lf, last), lfy = yago ? at(lf, yago) : null;
    return { ok: true, month: last.label, prelim: last.prelim, rate: last.v, state: at(sr, last), us: at(us, last), yearAgo: yago ? yago.v : null,
      laborForce: lfl, laborForceChange: lfl && lfy ? Math.round(1000 * (lfl - lfy) / lfy) / 10 : null,
      trend: rate.slice(-13).map(x => ({ label: x.label, v: x.v })), fips: st + co,
      source: 'U.S. Bureau of Labor Statistics, Local Area Unemployment Statistics (not seasonally adjusted)' };
  });
}
export async function jobsAt(lat, lng) { const t = await tractAt(lat, lng); if (!t) return { ok: true, none: true }; return jobsFor(t.state, t.county); }
