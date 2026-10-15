// A local stand-in for Netlify, for tests: a real Postgres (Netlify's own @netlify/database-dev, with the
// project's migrations applied), Netlify's local Blobs server, and an HTTP server that — like Netlify's
// CDN with `preferStatic` — serves files from public/ first and sends everything else to the function.
import { NetlifyDB } from '@netlify/database-dev';
import { BlobsServer } from '@netlify/blobs/server';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';

const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.zip': 'application/zip', '.json': 'application/json', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain' };

export async function startEmulator(project, vars = {}) {
  const db = new NetlifyDB();
  const connectionString = await db.start();
  const migrations = path.join(project, 'netlify/database/migrations');
  const admin = new pg.Client({ connectionString });
  await admin.connect();
  for (const f of readdirSync(migrations).sort()) await admin.query(readFileSync(path.join(migrations, f), 'utf8'));
  await admin.end();

  const blobDir = mkdtempSync(path.join(tmpdir(), 'skydata-blobs-'));
  const token = 'local-token';
  let blobs = new BlobsServer({ directory: blobDir, token });
  const { port: blobPort } = await blobs.start();
  const blobURL = `http://127.0.0.1:${blobPort}`;
  process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify({ edgeURL: blobURL, uncachedEdgeURL: blobURL, siteID: 'local-site', token })).toString('base64');
  process.env.NETLIFY_DB_URL = connectionString;
  const env = { NETLIFY_DB_URL: connectionString, NETLIFY_BLOBS_CONTEXT: process.env.NETLIFY_BLOBS_CONTEXT, ...vars };
  globalThis.Netlify = { env: { get: (k) => env[k], toObject: () => ({ ...env }), has: (k) => k in env, set: (k, v) => (env[k] = v), delete: (k) => delete env[k] } };

  const fn = (await import(path.join(project, 'netlify/functions/skydata/skydata.mjs'))).default;
  const pub = path.join(project, 'public');
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const file = path.join(pub, decodeURIComponent(url.pathname));
      if (file.startsWith(pub + path.sep) && existsSync(file) && statSync(file).isFile() && ['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
        return res.end(req.method === 'HEAD' ? undefined : readFileSync(file));
      }
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      if (body && body.byteLength > 6 * 1024 * 1024) {
        res.writeHead(413);
        return res.end('Payload too large for a Netlify Function');
      }
      let request = new Request(url, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body });
      const waits = [];
      // Like Netlify's background functions: answer 202 at once and keep running (up to 15 minutes there).
      if (url.pathname.startsWith('/.netlify/functions/skydata-background/')) {
        res.writeHead(202);
        res.end();
        // Netlify has already answered, so the request's own signal is aborted while the background work runs.
        const done = new AbortController();
        done.abort();
        request = new Request(request, { signal: done.signal });
        await fn(request, { ip: req.socket.remoteAddress, waitUntil: (p) => waits.push(p) }).then((r) => r.arrayBuffer()).catch((e) => console.error('background error', e));
        await Promise.allSettled(waits);
        return;
      }
      const response = await fn(request, { ip: req.socket.remoteAddress, waitUntil: (p) => waits.push(p) });
      const out = {};
      response.headers.forEach((v, k) => {
        if (k === 'set-cookie') return;
        out[k] = v;
      });
      const cookies = response.headers.getSetCookie?.() ?? [];
      if (cookies.length) out['set-cookie'] = cookies;
      res.writeHead(response.status, out);
      if (response.body) for await (const c of response.body) res.write(c);
      res.end();
      await Promise.allSettled(waits);
    } catch (e) {
      console.error('emulator error', e);
      res.writeHead(500);
      res.end('emulator error');
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}`;
  return {
    url,
    connectionString,
    // Like Netlify, where each invocation gets a short-lived Blobs token: serve the same data under a new token and
    // retire the old one, so anything still holding the old token fails.
    async rotateBlobsToken() {
      const fresh = new BlobsServer({ directory: blobDir, token: 'rotated-' + Date.now() });
      const { port } = await fresh.start();
      const url = `http://127.0.0.1:${port}`;
      process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify({ edgeURL: url, uncachedEdgeURL: url, siteID: 'local-site', token: fresh.token ?? 'rotated' })).toString('base64');
      env.NETLIFY_BLOBS_CONTEXT = process.env.NETLIFY_BLOBS_CONTEXT;
      await blobs.stop();
      blobs = fresh;
    },
    async stop() {
      server.close();
      await blobs.stop();
      await db.stop();
    },
  };
}
