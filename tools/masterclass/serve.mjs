// Local test server: serves kinvest-liens and runs the real Netlify functions (member data in a temp folder, test accounts only).
import http from 'node:http'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
process.env.USERS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ppa-mcsrv-')); process.env.SESSION_SECRET = 'serve-secret';
const ROOT = path.resolve(process.cwd()), SITE = path.join(ROOT, 'kinvest-liens');
const auth = await import('../../netlify/lib/auth.mjs');
const FN = {}; for (const f of ['learnhub', 'drills', 'course', 'learn']) FN[f] = (await import('../../netlify/functions/' + f + '.mjs')).default;
const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const mk = async (e, patch) => { const u = await auth.createUser(e, 'pw-123456', false); Object.assign(u, patch || {}); await auth.saveUser(u); return (await auth.sessionCookie(e)).split(';')[0]; };
export const COOKIES = { pro: await mk('pro@test.invalid', { paidThrough: day(30), course: { fl: { lessons: { 'fl-what': '2026-11-01', 'fl-calendar': '2026-11-02', 'fl-notices': '2026-11-03' }, quizzes: {} } } }), free: await mk('free@test.invalid') };
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json' };
export const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.startsWith('/.netlify/functions/')) {
    const fn = FN[u.pathname.split('/').pop()]; if (!fn) { res.statusCode = 404; return res.end('{}'); }
    let body = ''; for await (const c of req) body += c;
    const r = await fn(new Request('http://x' + req.url, { method: req.method, headers: { cookie: req.headers.cookie || '', 'content-type': 'application/json' }, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body }));
    res.statusCode = r.status; r.headers.forEach((v, k) => res.setHeader(k, v)); return res.end(await r.text());
  }
  let p = path.join(SITE, decodeURIComponent(u.pathname)); if (!p.startsWith(SITE)) { res.statusCode = 403; return res.end(); }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) { res.statusCode = 404; return res.end('not found'); }
  res.setHeader('content-type', MIME[path.extname(p)] || 'application/octet-stream'); res.end(fs.readFileSync(p));
});
if (import.meta.url === 'file://' + process.argv[1]) server.listen(Number(process.env.PORT || 8097), () => console.log('serving on', process.env.PORT || 8097));
