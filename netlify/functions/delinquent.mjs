// Delinquent tax records (not a sale list). Aggregate summary is public; parcel search is for Pro members (enforced here on the server).
import * as auth from '../lib/auth.mjs';
import * as RL from '../lib/ratelimit.mjs';
import { DATASETS, loadParcels, loadSummary, search, publicRow } from '../lib/delinquent.mjs';
const json = (code, body, cache) => new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': cache || 'no-store' } });
export default async (req) => {
  const u = new URL(req.url), id = u.searchParams.get('d') || 'virginia-beach';
  if (!DATASETS[id]) return json(404, { error: 'Unknown dataset.' });
  if (u.searchParams.get('summary')) { const s = loadSummary(id); return s ? json(200, { summary: s, name: DATASETS[id].name }, 'public, max-age=300') : json(404, { error: 'Not loaded.' }); }
  const me = await auth.userFromCookie(req.headers.get('cookie') || '');
  if (!me) return json(401, { error: 'Sign in to search parcels.', needLogin: true });
  if (!auth.isPaid(me)) return json(402, { error: 'Parcel search is for Pro members.', needPaid: true });
  if (!(await RL.hit('delinq:' + me.email, 240, 3600e3)).ok) return json(429, { error: 'That is a lot of searches in an hour. Please wait a little.' });
  const d = loadParcels(id); if (!d) return json(503, { error: 'The data is not available right now.' });
  const gp = u.searchParams.get('gpin');
  if (gp) { const g = String(gp).replace(/\s+/g, ''); const p = d.p.find(x => x.g === g); return p ? json(200, { parcel: publicRow(p) }) : json(404, { error: 'That parcel id is not in this list.' }); }
  const o = Object.fromEntries(['q', 'minOwed', 'maxOwed', 'minYears', 'oldest', 'district', 'sort', 'limit', 'offset'].map(k => [k, u.searchParams.get(k)])); o.noAddress = u.searchParams.get('noAddress') === '1';
  const r = search(d.p, o);
  return json(200, { total: r.total, rows: r.rows.map(publicRow), districts: [...new Set(d.p.map(x => x.z))].sort(), built: d.built });
};
