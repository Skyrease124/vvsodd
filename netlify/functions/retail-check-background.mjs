// Background: runs one owner-requested "Check now" with a longer time limit. It runs only with the job's secret token,
// which only the request that queued the job knows. The result is stored on the job; the owner page reads it.
import * as R from '../lib/retail.mjs';
export default async function handler(req) {
  let b; try { b = await req.json(); } catch (e) { return new Response('Bad request', { status: 400 }); }
  const ok = await R.runCheckJob(b && b.jobId, b && b.token);
  return new Response(ok ? 'ok' : 'Forbidden', { status: ok ? 200 : 403 });
}
