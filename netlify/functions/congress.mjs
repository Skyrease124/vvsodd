// Current U.S. senators and representatives for a state. GET ?state=FL -> { ok:true, members:[{id,name,party,chamber,district,link}], checked, source } | { ok:false, reason:'nokey'|'lookup' }
import { hit } from '../lib/ratelimit.mjs';
import * as C from '../lib/congress.mjs';
const STATES = new Set('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' '));
const json = (c, b) => new Response(JSON.stringify(b), { status: c, headers: { 'Content-Type': 'application/json', 'Cache-Control': c === 200 && b.ok ? 'public, max-age=3600' : 'no-store' } });
export default async function handler(req, context) {
  if (req.method !== 'GET') return json(405, { ok: false });
  const ip = req.headers.get('x-nf-client-connection-ip') || (context && context.ip) || 'x';
  if (!(await hit('congress:' + ip, 40, 60e3)).ok) return json(429, { ok: false, error: 'Too many requests.' });
  const st = String(new URL(req.url).searchParams.get('state') || '').toUpperCase();
  if (!STATES.has(st)) return json(400, { ok: false, error: 'Bad state.' });
  return json(200, await C.forState(st));
}
