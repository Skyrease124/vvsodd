// Production-only scheduler for the Retail stock monitor. It is inert until the owner turns it on in the owner Retail
// page, and never runs on a Deploy Preview. Each run checks up to 10 due products with the fixed page rules; the Groq
// reader may help on unreadable pages (at most 3 requests per run) and can only confirm OUT OF STOCK.
import * as R from '../lib/retail.mjs';
import { makeReader } from '../lib/retail-groq.mjs';
import * as A from '../lib/retail-amazon.mjs';
export const config = { schedule: '*/30 * * * *' };
export default async function scheduled(req, context) {
  if (context?.deploy?.context !== 'production' || context.deploy.published !== true) return new Response(null, { status: 204 });
  if (!(await R.monitorEnabled())) { console.log('Retail monitor disabled by owner control'); return new Response(null, { status: 204 }); }
  try {
    const r = await R.monitor({ limit: 10, reader: makeReader({ maxCalls: 3 }) });
    let amz = null; try { amz = await A.step({ reader: makeReader({ maxCalls: 2 }) }); } catch (e) { /* Amazon problems never stop the other stores */ }
    await R.saveMonitorRun({ status: 'completed', checked: r.checked, changed: r.changed, alerts: r.alerts, failed: r.failed.length, amazon: amz });
    for (const f of r.failed) await R.notifyOwner('Retail source stopped working', f.name + ' (' + R.RETAILERS[f.retailer].name + '): ' + f.error, '/owner/retail/', 'fail' + f.id + new Date().toISOString().slice(0, 10)).catch(() => {});
  } catch (e) { await R.saveMonitorRun({ status: 'error', reason: String(e.message || e).slice(0, 160) }).catch(() => {}); }
  return new Response(null, { status: 204 });
}
