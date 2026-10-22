import fs from 'node:fs';
import path from 'node:path';

/**
 * Storage adapter exposing one async API over the SQLite backend:
 *   get(sql, ...params)  -> first row or undefined
 *   all(sql, ...params)  -> array of rows
 *   run(sql, ...params)  -> { changes }
 *   exec(sql)            -> run one or more statements without params
 *   transaction(fn)      -> run fn(tx) atomically (nestable via savepoints)
 *   lock(key)            -> serialize concurrent writers inside a transaction
 *   close()
 * SQL uses `?` placeholders.
 */
export async function openStorage({ dbPath }) {
  return openSqlite(dbPath);
}

async function openSqlite(dbPath) {
  const { DatabaseSync } = await import('node:sqlite');
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const raw = new DatabaseSync(dbPath);
  const statements = new Map();
  const prepare = (sql) => {
    let stmt = statements.get(sql);
    if (!stmt) {
      stmt = raw.prepare(sql);
      statements.set(sql, stmt);
    }
    return stmt;
  };
  // node:sqlite cannot bind booleans or undefined
  const bind = (params) =>
    params.map((v) => {
      if (v === undefined) return null;
      if (typeof v === 'boolean') return v ? 1 : 0;
      return v;
    });

  let savepointSeq = 0;
  const db = {
    dialect: 'sqlite',
    async get(sql, ...params) {
      return prepare(sql).get(...bind(params));
    },
    async all(sql, ...params) {
      return prepare(sql).all(...bind(params));
    },
    async run(sql, ...params) {
      const result = prepare(sql).run(...bind(params));
      return { changes: Number(result.changes) };
    },
    async exec(sql) {
      raw.exec(sql);
    },
    // The single connection is shared by all requests, so the callback must
    // only await storage calls (they settle synchronously); awaiting real I/O
    // here would let other requests' statements join this transaction.
    async transaction(fn) {
      const name = `flow_sp_${++savepointSeq}`;
      raw.exec(`SAVEPOINT ${name}`);
      try {
        const result = await fn(db);
        raw.exec(`RELEASE ${name}`);
        return result;
      } catch (err) {
        raw.exec(`ROLLBACK TO ${name}`);
        raw.exec(`RELEASE ${name}`);
        throw err;
      }
    },
    // Single process + synchronous engine: writers are already serialized.
    async lock() {},
    async close() {
      raw.close();
    },
  };
  return db;
}
