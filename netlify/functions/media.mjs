// Serves member profile photos and background photos from our own site storage. Signed-in members only.
import * as auth from '../lib/auth.mjs';
import * as C from '../lib/community.mjs';
export default async function handler(req) {
  const user = await auth.userFromCookie(req.headers.get('cookie')); if (!user) return new Response('', { status: 401 });
  const q = new URL(req.url).searchParams, kind = q.get('k'), uid = q.get('u');
  if (!['avatar', 'cover', 'post'].includes(kind) || !/^[a-f0-9]{16}$/.test(String(uid))) return new Response('', { status: 400 });
  if (kind === 'post' && !/^[a-f0-9]{16}$/.test(String(q.get('p')))) return new Response('', { status: 400 });
  const m = await auth.kvGet(kind === 'post' ? C.postPhotoKey(uid, q.get('p')) : C.mediaKey(kind, uid));
  if (kind === 'post' && m && !m.post) return new Response('', { status: 404 });   // not attached to a post yet: only its owner's page has it if (!m || m.removed || !m.b64) return new Response('', { status: 404 });
  const buf = Buffer.from(m.b64, 'base64');
  return new Response(buf, { status: 200, headers: { 'Content-Type': m.type, 'Content-Length': String(buf.length), 'Cache-Control': 'private, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'" } });
}
