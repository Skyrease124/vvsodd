// The Netlify Function body: SkyData's server with Netlify Database, Blobs and environment variables.
import { getStore } from '@netlify/blobs';
import { getConnectionString } from '@netlify/database';
import pg from 'pg';
import { createHandler, siteEnv } from './entry.mjs';

/* global Netlify, __SETUP_CODE_HASH__ */
function databasePool() {
  const pool = new pg.Pool({ connectionString: getConnectionString(), max: 5, idleTimeoutMillis: 10000 });
  // An idle connection closed by the database server must not crash the function; the pool reconnects.
  pool.on('error', (e) => console.error('SkyData database connection dropped', e.message));
  return pool;
}

const handler = createHandler({
  setupCodeHash: __SETUP_CODE_HASH__,
  makeEnv: (origin) =>
    siteEnv({
      vars: Netlify.env.toObject(),
      pool: databasePool(),
      files: getStore({ name: 'skydata-files', consistency: 'strong' }),
      parts: getStore({ name: 'skydata-file-parts', consistency: 'strong' }),
      system: getStore({ name: 'skydata-system', consistency: 'strong' }),
      origin,
    }),
});

export default handler;
