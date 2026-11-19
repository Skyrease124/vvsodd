// Scheduled: checks due products once each (shared by every watcher) and tells the owner when a source stops working.
import * as R from '../lib/retail.mjs';
export default async function handler() {
  const r = await R.monitor({ limit: 25 });
  for (const f of r.failed) await R.notifyOwner('Retail source stopped working', f.name + ' (' + R.RETAILERS[f.retailer].name + '): ' + f.error, '/owner/retail/', 'fail' + f.id + new Date().toISOString().slice(0, 10)).catch(() => {});
  return new Response(JSON.stringify({ checked: r.checked, changed: r.changed, alerts: r.alerts, failed: r.failed.length }), { headers: { 'Content-Type': 'application/json' } });
}
export const config = { schedule: '*/10 * * * *' };
