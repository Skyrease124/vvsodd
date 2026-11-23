// Owner-only manual product check. There is no schedule: checks run only when the owner asks.
import * as auth from '../lib/auth.mjs';
import * as R from '../lib/retail.mjs';
const json = (code, body) => new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
export default async function handler(req) {
  const user = await auth.userFromCookie(req.headers.get('cookie'));
  if (!user || !user.owner) return json(403, { ok: false, error: 'Owner only.' });
  const r = await R.monitor({ limit: 25 });
  for (const f of r.failed) await R.notifyOwner('Retail source stopped working', f.name + ' (' + R.RETAILERS[f.retailer].name + '): ' + f.error, '/owner/retail/', 'fail' + f.id + new Date().toISOString().slice(0, 10)).catch(() => {});
  return json(200, { ok: true, checked: r.checked, changed: r.changed, alerts: r.alerts, failed: r.failed.length });
}
