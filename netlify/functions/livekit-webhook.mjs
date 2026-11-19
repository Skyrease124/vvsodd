// LiveKit Cloud calls this when room events happen (set up at cloud.livekit.io, Settings, Webhooks). The request is accepted only if it is signed with our own LiveKit key.
import * as L from '../lib/live.mjs';
const json = (c, b) => new Response(JSON.stringify(b), { status: c, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export default async function handler(req) {
  if (req.method !== 'POST') return json(405, { ok: false });
  const r = await L.webhook(await req.text(), req.headers.get('authorization') || '');
  return json(r.ok === false ? (r.status || 400) : 200, r.ok === false ? { ok: false } : r);
}
