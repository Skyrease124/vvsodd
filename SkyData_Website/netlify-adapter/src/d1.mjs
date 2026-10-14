// A Cloudflare D1-compatible database object backed by Netlify Database (Postgres), so SkyData's existing
// `env.DB.prepare(sql).bind(...).first/all/run()` and `env.DB.batch([...])` calls run unchanged.
// SkyData's SQL was written for SQLite; translateSql() converts the few dialect differences it uses.
import pg from 'pg';

// Postgres returns BIGINT and NUMERIC as strings; D1 returns numbers.
const TYPES = {
  getTypeParser(oid, format) {
    if (oid === 20 || oid === 1700) return (v) => (v === null ? null : Number(v));
    return pg.types.getTypeParser(oid, format);
  },
};

const IDENT_RESERVED = new Set(['window']);

/** SQLite → Postgres for the constructs SkyData uses. Exported for tests. */
export function translateSql(sql) {
  let out = '';
  let n = 0;
  let i = 0;
  let first = null;
  let ignore = false;
  const recent = [];
  while (i < sql.length) {
    const c = sql[i];
    if (c === "'") {
      // String literal: copied as is ('' is an escaped quote).
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") j += 2;
        else if (sql[j] === "'") break;
        else j++;
      }
      out += sql.slice(i, j + 1);
      i = j + 1;
      recent.length = 0;
    } else if (c === '"' || c === '`') {
      const j = sql.indexOf(c, i + 1);
      const end = j < 0 ? sql.length : j;
      out += '"' + sql.slice(i + 1, end) + '"';
      i = end + 1;
      recent.length = 0;
    } else if (c === '?') {
      out += '$' + ++n;
      i++;
      recent.length = 0;
    } else {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(sql.slice(i));
      if (!m) {
        out += c;
        i++;
        if (!/\s/.test(c)) recent.length = 0;
        continue;
      }
      const w = m[0];
      const up = w.toUpperCase();
      first ??= up;
      i += w.length;
      // INSERT OR IGNORE INTO → INSERT INTO … ON CONFLICT DO NOTHING
      if (up === 'IGNORE' && recent.at(-1) === 'OR' && recent.at(-2) === 'INSERT') {
        out = out.replace(/OR\s*$/i, '');
        ignore = true;
        recent.length = 0;
        continue;
      }
      let text = w;
      if (IDENT_RESERVED.has(w.toLowerCase())) text = '"' + w.toLowerCase() + '"';
      else if (up === 'LIKE') text = 'ILIKE'; // SQLite LIKE ignores ASCII case
      else if (up === 'INSTR' && sql[i] === '(') text = 'STRPOS'; // instr(text, part) has the same arguments
      else if (recent.at(-1) === 'AS' && /[A-Z]/.test(w) && /[a-z]/.test(w)) text = '"' + w + '"'; // keep camelCase aliases
      else if (first === 'CREATE' || first === 'ALTER') text = { INTEGER: 'BIGINT', REAL: 'DOUBLE PRECISION', BLOB: 'BYTEA' }[up] ?? w;
      out += text;
      recent.push(up);
      if (recent.length > 3) recent.shift();
    }
  }
  if (ignore) {
    const r = /\sRETURNING\s/i.exec(out);
    out = r ? out.slice(0, r.index) + ' ON CONFLICT DO NOTHING' + out.slice(r.index) : out.replace(/;?\s*$/, ' ON CONFLICT DO NOTHING');
  }
  return { sql: scalarMinMax(out), params: n };
}

// SQLite's two-argument MAX(a,b)/MIN(a,b) are GREATEST/LEAST in Postgres; one-argument ones stay aggregates.
function scalarMinMax(sql) {
  const re = /\b(MAX|MIN)\s*\(/gi;
  let m;
  let result = '';
  let last = 0;
  while ((m = re.exec(sql))) {
    let depth = 0;
    let comma = false;
    let j = m.index + m[0].length - 1;
    for (; j < sql.length; j++) {
      if (sql[j] === '(') depth++;
      else if (sql[j] === ')') {
        depth--;
        if (depth === 0) break;
      } else if (sql[j] === ',' && depth === 1) comma = true;
      else if (sql[j] === "'") j = sql.indexOf("'", j + 1);
    }
    if (comma) {
      result += sql.slice(last, m.index) + (m[1].toUpperCase() === 'MAX' ? 'GREATEST(' : 'LEAST(');
      last = m.index + m[0].length;
    }
  }
  return result + sql.slice(last);
}

function toParam(v) {
  if (v === undefined) throw new TypeError('D1_TYPE_ERROR: Type \'undefined\' not supported for value \'undefined\'');
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof ArrayBuffer) return Buffer.from(v);
  if (ArrayBuffer.isView(v)) return Buffer.from(v.buffer, v.byteOffset, v.byteLength);
  if (typeof v === 'bigint') return v.toString();
  return v;
}

function fromRow(row) {
  for (const k in row) {
    const v = row[k];
    if (Buffer.isBuffer(v)) row[k] = v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength);
  }
  return row;
}

class Statement {
  constructor(db, sql, params = []) {
    this.db = db;
    this.source = sql;
    this.params = params;
  }
  bind(...values) {
    return new Statement(this.db, this.source, values.map(toParam));
  }
  async _query(client, rowMode) {
    const { sql } = this.db._translate(this.source);
    const started = Date.now();
    const res = await (client ?? this.db.pool).query({ text: sql, values: this.params, types: TYPES, ...(rowMode ? { rowMode } : {}) });
    return { res, duration: Date.now() - started };
  }
  _result({ res, duration }) {
    const rows = Array.isArray(res) ? res.at(-1) : res;
    return {
      success: true,
      results: (rows.rows ?? []).map(fromRow),
      meta: { changes: rows.command === 'SELECT' ? 0 : rows.rowCount ?? 0, duration, rows_read: rows.rowCount ?? 0, rows_written: rows.command === 'SELECT' ? 0 : rows.rowCount ?? 0, last_row_id: null, changed_db: rows.command !== 'SELECT' },
    };
  }
  async first(column) {
    const r = this._result(await this._query());
    const row = r.results[0];
    if (!row) return null;
    if (column !== undefined) {
      if (!(column in row)) throw new Error(`D1_COLUMN_NOTFOUND: Column not found (${column})`);
      return row[column];
    }
    return row;
  }
  async all() {
    return this._result(await this._query());
  }
  async run() {
    return this._result(await this._query());
  }
  async raw(options = {}) {
    const q = await this._query(undefined, 'array');
    const rows = q.res.rows.map((r) => r.map((v) => (Buffer.isBuffer(v) ? v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength) : v)));
    return options.columnNames ? [q.res.fields.map((f) => f.name), ...rows] : rows;
  }
}

export class D1OnPostgres {
  constructor(pool) {
    this.pool = pool;
    this.cache = new Map();
  }
  _translate(sql) {
    let t = this.cache.get(sql);
    if (!t) {
      t = translateSql(sql);
      if (this.cache.size > 2000) this.cache.clear();
      this.cache.set(sql, t);
    }
    return t;
  }
  prepare(sql) {
    return new Statement(this, sql);
  }
  /** Like D1, all statements run in one transaction and the results come back in order. */
  async batch(statements) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const out = [];
      for (const s of statements) out.push(s._result(await s._query(client)));
      await client.query('COMMIT');
      return out;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }
  async exec(sql) {
    const started = Date.now();
    const statements = sql.split(/;\s*(?:\n|$)/).map((s) => s.trim()).filter(Boolean);
    for (const s of statements) await this.pool.query(this._translate(s).sql);
    return { count: statements.length, duration: Date.now() - started };
  }
  dump() {
    throw new Error('D1 dump() is not available on Netlify.');
  }
}
