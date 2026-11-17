// County news lookup (Netlify background function: answers 202 at once, then runs for as long as GDELT needs, up to 15 minutes).
// Only counties in the registry are looked up, and never while the cache is fresh, a lookup is running, or one just failed.
import * as N from '../lib/news.mjs';
export default async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });
  let b; try { b = await req.json(); } catch (e) { return new Response('bad request', { status: 400 }); }
  const state = String(b.state || '').toUpperCase(), county = String(b.county || '').trim();
  if (!N.STATE_NAMES[state] || !N.knownCounties().has(state + '|' + county)) return new Response('unknown county', { status: 400 });
  if (await N.shouldRefresh(state, county, { background: true })) await N.refresh(state, county);
};
