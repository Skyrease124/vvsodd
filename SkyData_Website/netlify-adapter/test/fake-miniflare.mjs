// Stand-in for Miniflare in SkyData's own tests (scripts/test-*-worker.mjs), backed by the Netlify adapter:
// real Postgres (Netlify's @netlify/database-dev) for env.DB and Netlify's local Blobs server for env.FILES.
// The repo's tests then run unchanged against the Netlify storage, exercising its SQL and file calls.
// Like ChatGPT Sites, dispatchFetch trusts the test's oai-authenticated-* headers (the tests stand in for the
// platform); the production entry point strips them (see ../src/entry.mjs, tested in run.mjs).
import { NetlifyDB } from '@netlify/database-dev';
import { BlobsServer } from '@netlify/blobs/server';
import { getStore } from '@netlify/blobs';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { D1OnPostgres } from '../src/d1.mjs';
import { R2OnBlobs } from '../src/r2.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const migration = readFileSync(path.join(here, '../migrations/20261014000000_skydata_initial.sql'), 'utf8');

// The tests replay SkyData's SQLite migrations, which the Postgres schema already contains.
class TestD1 extends D1OnPostgres {
  prepare(sql) {
    const s = sql
      .replace(/^\s*CREATE TABLE (?!IF NOT EXISTS)/i, 'CREATE TABLE IF NOT EXISTS ')
      .replace(/^\s*CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS)/i, (_m, u) => `CREATE ${u ?? ''}INDEX IF NOT EXISTS `)
      .replace(/^\s*ALTER TABLE (\S+) ADD (?!COLUMN IF NOT EXISTS)/i, 'ALTER TABLE $1 ADD COLUMN IF NOT EXISTS ');
    return super.prepare(s);
  }
}

const realFetch = globalThis.fetch;
let active = null;
let started = null;
const defaultWorker = path.join(process.cwd(), 'dist/server/index.js');

export class Miniflare {
  constructor(options = {}) {
    this.options = options;
    this.ready = this.#start();
  }
  async #start() {
    // The first module is the entry, as in Miniflare (tests can build their own from the bundle).
    this.worker = (await import(this.options.modules?.[0]?.path ?? defaultWorker)).default;
    this.db = new NetlifyDB();
    const cs = await this.db.start();
    const admin = new pg.Client({ connectionString: cs });
    await admin.connect();
    await admin.query(migration);
    await admin.end();
    this.pool = new pg.Pool({ connectionString: cs, max: 4 });
    this.pool.on('error', () => {});
    this.blobs = new BlobsServer({ directory: mkdtempSync(path.join(tmpdir(), 'skydata-test-blobs-')), token: 't' });
    const { port } = await this.blobs.start();
    const url = `http://127.0.0.1:${port}`;
    const store = (name) => getStore({ name, siteID: 'test', token: 't', edgeURL: url, uncachedEdgeURL: url, fetch: realFetch, consistency: 'strong' });
    this.blobURL = url;
    this.D1 = new TestD1(this.pool);
    this.R2 = new R2OnBlobs(store('files'), store('parts'));
    // Like Miniflare, only the bindings the test asks for exist.
    this.env = { ...(this.options.bindings ?? {}), ASSETS: { fetch: async () => new Response('Not found', { status: 404 }) } };
    if (this.options.d1Databases?.includes('DB')) this.env.DB = this.D1;
    if (this.options.r2Buckets?.includes('FILES')) this.env.FILES = this.R2;
  }
  async getD1Database() {
    await this.ready;
    return this.D1;
  }
  async getR2Bucket() {
    await this.ready;
    return this.R2;
  }
  async dispatchFetch(input, init) {
    await this.ready;
    const request = input instanceof Request ? input : new Request(input, init);
    // Outbound requests from the site go to the test's outboundService, as in Miniflare.
    const outbound = this.options.outboundService;
    active = this;
    started ??= true;
    globalThis.fetch = async (i, o) => {
      const req = i instanceof Request ? i : new Request(i, o);
      if (req.url.startsWith(this.blobURL)) return realFetch(i, o);
      if (!outbound) return realFetch(i, o);
      return outbound(req);
    };
    const waits = [];
    try {
      const res = await this.worker.fetch(request, this.env, { waitUntil: (p) => waits.push(p), passThroughOnException() {}, props: {} });
      // Buffer the body so later outbound calls made while streaming still see the mock.
      const body = res.body ? await res.arrayBuffer() : null;
      await Promise.allSettled(waits);
      return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
    } finally {
      if (active === this) globalThis.fetch = realFetch;
    }
  }
  async dispose() {
    await this.ready;
    await this.pool.end().catch(() => {});
    await this.blobs.stop();
    await this.db.stop();
  }
}
