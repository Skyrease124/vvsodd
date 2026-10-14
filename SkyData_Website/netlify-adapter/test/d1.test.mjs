// Unit tests for the D1-on-Postgres adapter: SQL translation, and D1 result semantics on a real Postgres.
import assert from 'node:assert/strict';
import { NetlifyDB } from '@netlify/database-dev';
import pg from 'pg';
import { D1OnPostgres, translateSql } from '../src/d1.mjs';

const t = (sql) => translateSql(sql).sql;
assert.equal(t('SELECT * FROM a WHERE x = ? AND y = ?'), 'SELECT * FROM a WHERE x = $1 AND y = $2');
assert.equal(t("SELECT 'a ? b', `col` FROM t WHERE z = ?"), `SELECT 'a ? b', "col" FROM t WHERE z = $1`);
assert.equal(t('INSERT OR IGNORE INTO t (a) VALUES (?)'), 'INSERT  INTO t (a) VALUES ($1) ON CONFLICT DO NOTHING');
assert.equal(t('UPDATE request_limits SET window = ? WHERE id = ?'), 'UPDATE request_limits SET "window" = $1 WHERE id = $2');
assert.equal(t('UPDATE d SET used = MAX(0,used - 1)'), 'UPDATE d SET used = GREATEST(0,used - 1)');
assert.equal(t('SELECT MAX(created) FROM t'), 'SELECT MAX(created) FROM t');
assert.equal(t('SELECT x FROM t WHERE instr(code,?)!=1 AND code LIKE ?'), 'SELECT x FROM t WHERE STRPOS(code,$1)!=1 AND code ILIKE $2');
assert.equal(t('SELECT SUM(c) AS estimatedCost FROM t'), 'SELECT SUM(c) AS "estimatedCost" FROM t');
assert.equal(t("SELECT 'it''s LIKE window' AS x"), "SELECT 'it''s LIKE window' AS x");
assert.equal(t('CREATE TABLE IF NOT EXISTS a (n INTEGER NOT NULL, r REAL, b BLOB)'), 'CREATE TABLE IF NOT EXISTS a (n BIGINT NOT NULL, r DOUBLE PRECISION, b BYTEA)');

const server = new NetlifyDB();
const cs = await server.start();
const pool = new pg.Pool({ connectionString: cs });
pool.on('error', () => {});
const db = new D1OnPostgres(pool);
try {
  await db.prepare('CREATE TABLE t (id TEXT PRIMARY KEY, n INTEGER NOT NULL, f REAL, b BLOB, window INTEGER)').run();
  const now = Date.now();
  let r = await db.prepare('INSERT INTO t (id, n, f, b, window) VALUES (?, ?, ?, ?, ?)').bind('a', now, 1.5, new Uint8Array([1, 2, 3]), 7).run();
  assert.equal(r.meta.changes, 1);
  const row = await db.prepare('SELECT * FROM t WHERE id = ?').bind('a').first();
  assert.equal(row.n, now, 'millisecond timestamps survive as numbers');
  assert.equal(row.f, 1.5);
  assert.deepEqual([...new Uint8Array(row.b)], [1, 2, 3], 'BLOB comes back as an ArrayBuffer');
  assert.ok(row.b instanceof ArrayBuffer);
  assert.equal(row.window, 7);
  assert.equal(await db.prepare('SELECT COUNT(*) AS c FROM t').first('c'), 1, 'COUNT is a number, first(column) works');
  assert.equal(await db.prepare('SELECT * FROM t WHERE id = ?').bind('missing').first(), null);
  r = await db.prepare('INSERT OR IGNORE INTO t (id, n) VALUES (?, ?)').bind('a', 1).run();
  assert.equal(r.meta.changes, 0, 'INSERT OR IGNORE reports no change on a duplicate');
  const upsert = await db.prepare('INSERT INTO t (id, n) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET n = t.n + 1 RETURNING n').bind('a', 0).first();
  assert.equal(upsert.n, now + 1);
  assert.deepEqual((await db.prepare('SELECT id FROM t').all()).results, [{ id: 'a' }]);
  assert.deepEqual(await db.prepare('SELECT id, n FROM t').raw(), [['a', now + 1]]);
  await db.prepare('UPDATE t SET n = ? WHERE id = ?').bind(true, 'a').run();
  assert.equal(await db.prepare('SELECT n FROM t').first('n'), 1, 'booleans are stored as 1/0 like D1');
  assert.throws(() => db.prepare('SELECT ?').bind(undefined), /D1_TYPE_ERROR/, 'undefined is refused at bind(), as in D1');
  // batch() is one transaction: a failing statement rolls back the earlier ones.
  await assert.rejects(() => db.batch([db.prepare("INSERT INTO t (id, n) VALUES ('b', 1)"), db.prepare("INSERT INTO t (id, n) VALUES ('a', 1)")]));
  assert.equal(await db.prepare("SELECT COUNT(*) AS c FROM t WHERE id = 'b'").first('c'), 0, 'batch rolled back');
  const out = await db.batch([db.prepare("INSERT INTO t (id, n) VALUES ('b', 1)"), db.prepare('SELECT COUNT(*) AS c FROM t')]);
  assert.equal(out[1].results[0].c, 2);
  console.log('PASS d1 adapter: SQL translation (10 cases) and D1 semantics on real Postgres (numbers, BLOBs, first/all/run/raw, INSERT OR IGNORE, upsert RETURNING, booleans, undefined, batch rollback)');
} finally {
  await pool.end();
  await server.stop();
}
