// Daily push delivery for opted-in Pro members. Safe to run repeatedly: a notification is never sent twice to the same member.
import { run } from '../lib/pushjobs.mjs';
export default async () => { const r = await run(); console.log('push run', JSON.stringify(r)); return new Response(JSON.stringify(r)); };
export const config = { schedule: '0 15 * * *' };
