// Shared helpers for the parcel-overlay functions (wetlands, flood): outline validation, even-odd rings, area in acres, rate limiting.
import pc from 'polygon-clipping';
export { pc };
export const SQM_ACRE = 4046.8564224;
export const json = (code, body) => new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const hits = new Map();
export const limited = (k, n, ms) => { const now = Date.now(), r = (hits.get(k) || []).filter(t => now - t < ms); if (r.length >= n) return true; r.push(now); hits.set(k, r); return false; };
// local equal-area-enough projection (metres) around the parcel; error is far below 0.1% at lot scale
export const proj = (lng0, lat0) => { const k = Math.cos(lat0 * Math.PI / 180); return p => [(p[0] - lng0) * k * 111320, (p[1] - lat0) * 110574]; };
const ringArea = r => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(a) / 2; };
export const multiArea = (mp, P) => mp.reduce((s, poly) => s + poly.reduce((t, ring, i) => t + (i ? -1 : 1) * ringArea(ring.map(P)), 0), 0);
export const closed = r => (r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) ? r : r.concat([r[0]]);
// Rings (even-odd, any orientation) -> MultiPolygon, by XOR-ing the rings: separate parts stay separate, inner rings become holes
export const esriToMulti = rings => { let acc = []; for (const r of rings) { if (r.length < 3) continue; const m = [[closed(r)]]; acc = acc.length ? pc.xor(acc, m) : m; } return acc; };
// Parses and validates a POST {rings} body for Florida; returns {rings} or {error:Response}
export async function readOutline(req) {
  let rings; try { rings = (await req.json()).rings; } catch (e) { return { error: json(400, { ok: false, error: 'Bad outline.' }) }; }
  const okPt = p => Array.isArray(p) && p.length >= 2 && p[0] >= -88 && p[0] <= -79.5 && p[1] >= 24 && p[1] <= 31.1;
  if (!Array.isArray(rings) || !rings.length || rings.length > 40 || !rings.every(r => Array.isArray(r) && r.length >= 4 && r.every(okPt)) || rings.flat().length > 6000) return { error: json(400, { ok: false, error: 'Bad outline.' }) };
  const xs = rings.flat().map(p => p[0]), ys = rings.flat().map(p => p[1]); if (Math.max(...xs) - Math.min(...xs) > 0.1 || Math.max(...ys) - Math.min(...ys) > 0.1) return { error: json(400, { ok: false, error: 'Outline too large.' }) };
  return { rings };
}
export const outlineKey = rings => rings.map(r => r.map(p => p[0].toFixed(7) + ',' + p[1].toFixed(7)).join(';')).join('|');
