// Pro-only property research report for one listed parcel (JSON or CSV). Built from our own data; no model call, no spend.
import * as auth from '../lib/auth.mjs';
import * as RL from '../lib/ratelimit.mjs';
import * as PR from '../lib/privateroll.mjs';
import { build, toCsv } from '../lib/aireport.mjs';
import { loadLiens, FILES } from './screen.mjs';
import { _loadData } from './ask.mjs';
import { COUNTY_STATE } from './ai.mjs';
const json = (code, body, h = {}) => new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...h } });
export default async (req) => {
  const me = await auth.userFromCookie(req.headers.get('cookie') || '');
  if (!me) return json(401, { error: 'Sign in to build a report.' });
  if (!auth.isPaid(me)) return json(402, { error: 'Research reports are for Pro members.', needPaid: true });
  if (!(await RL.hit('aireport:' + me.email, 60, 3600e3)).ok) return json(429, { error: 'Too many reports this hour. Please wait.' });
  const u = new URL(req.url), county = String(u.searchParams.get('county') || ''), parcel = String(u.searchParams.get('parcel') || '');
  if (!FILES[county]) return json(404, { error: 'We do not carry a list for that county.' });
  const lien = loadLiens(county).find(x => String(x.parcel) === parcel);
  if (!lien) return json(404, { error: 'That parcel is not on our list for ' + county + '.' });
  const st = _loadData().STATES.find(s => s.a === COUNTY_STATE[county]) || null;
  const rep = build({ lien, state: st, roll: PR.get(county, parcel), today: new Date().toISOString().slice(0, 10) });
  if (u.searchParams.get('format') === 'csv') return new Response(toCsv(rep), { status: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="research-' + county.replace(/\W+/g, '-') + '-' + parcel.replace(/\W+/g, '') + '.csv"', 'Cache-Control': 'no-store' } });
  return json(200, { report: rep });
};
