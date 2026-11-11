// Daily email digest for members who turned on email alerts. Safe to run repeatedly: an alert is never sent twice.
import * as W from '../lib/watch.mjs';
export default async () => { const r = await W.runDigest(); console.log('watch digest', JSON.stringify(r)); return new Response(JSON.stringify(r)); };
export const config = { schedule: '0 13 * * *' };
