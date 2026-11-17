// Keeps county news warm: every 30 minutes, start the lookup for the county whose stories are the oldest (so visitors usually get cached stories).
import * as N from '../lib/news.mjs';
export default async (req) => {
  const origin = new URL(req.url).origin; let pick = null;
  for (const k of N.knownCounties()) { const [state, county] = k.split('|'), c = await N.readCache(state, county); const age = c ? Date.now() - c.t : Infinity; if (!(c && c.fresh) && (!pick || age > pick.age) && await N.shouldRefresh(state, county)) pick = { state, county, age }; }
  if (pick) await fetch(origin + '/.netlify/functions/countynews-background', { method: 'POST', body: JSON.stringify({ state: pick.state, county: pick.county }), signal: AbortSignal.timeout(4000) }).catch(() => {});
};
export const config = { schedule: '*/30 * * * *' };
