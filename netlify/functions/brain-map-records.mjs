// Owner-approved property records for one county, filtered for the viewer on the server.
//   GET ?state=MI&county=Wayne  ->  { ok, state, county, records, access }
// Pro sees an approval at once; Free and anonymous viewers see it 48 hours later; withdrawn never. A record
// without a verified location is returned without coordinates. Nothing pending is ever read here.
import * as auth from '../lib/brain-auth.mjs';
import {isProAccount} from '../lib/research-releases.mjs';
import {recordsForCounty} from '../lib/approved-records.mjs';
import {cleanReleases, RELEASE_INDEX} from '../lib/property-intake.mjs';

const json = (status, body) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'private, no-store', 'Vary': 'Cookie', 'X-Content-Type-Options': 'nosniff'}});

async function handler(req) {
  if (req.method !== 'GET') return json(405, {ok: false, error: 'GET only'});
  const u = new URL(req.url);
  const state = (u.searchParams.get('state') || '').toUpperCase();
  const county = u.searchParams.get('county') || '';
  if (!/^[A-Z]{2}$/.test(state) || !/^[A-Za-z0-9.' -]{2,80}$/.test(county)) return json(400, {ok: false, error: 'Invalid county'});
  try {
    const me = await auth.userFromCookie(req.headers.get('cookie') || '');
    const records = recordsForCounty(cleanReleases(await auth.kvGet(RELEASE_INDEX)), {state, county, user: me, now: Date.now()});
    return json(200, {ok: true, state, county, records, access: isProAccount(me) ? 'pro' : 'free'});
  } catch (error) {
    console.error('brain-map-records', error);
    return json(503, {ok: false, error: 'Approved records unavailable'});
  }
}
export default auth.withBrainStore(handler);
