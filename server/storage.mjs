import fs from 'node:fs';
import path from 'node:path';

/**
 * Storage adapters exposing one async API over SQLite (node:sqlite) and
 * PostgreSQL (pg, e.g. Supabase):
 *   get(sql, ...params)  -> first row or undefined
 *   all(sql, ...params)  -> array of rows
 *   run(sql, ...params)  -> { changes }
 *   exec(sql)            -> run one or more statements without params
 *   transaction(fn)      -> run fn(tx) atomically (nestable via savepoints)
 *   lock(key)            -> serialize concurrent writers inside a transaction
 *   close()
 * SQL uses `?` placeholders; the Postgres adapter rewrites them to $1, $2, ...
 */
export async function openStorage({ dbPath, databaseUrl }) {
  return databaseUrl ? openPostgres(databaseUrl) : openSqlite(dbPath);
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

const PG_OID = {
  INT8: 20,
  JSON: 114,
  TIMESTAMP: 1114,
  TIMESTAMPTZ: 1184,
  NUMERIC: 1700,
  JSONB: 3802,
};

// Postgres prints timestamps as "2026-10-22 03:04:05.123+00"; return the same
// ISO strings the SQLite backend stores.
function pgTimestampToIso(value, assumeUtc) {
  let text = value.replace(' ', 'T');
  if (assumeUtc) text += 'Z';
  else text = text.replace(/([+-]\d{2})$/, '$1:00');
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function toPgPlaceholders(sql) {
  let index = 0;
  let inString = false;
  let out = '';
  for (const ch of sql) {
    if (ch === "'") inString = !inString;
    out += ch === '?' && !inString ? `$${++index}` : ch;
  }
  return out;
}

// Supabase presents a certificate chained to its own CA, so verification
// needs FLOW_PG_SSL_CA; without it the connection is encrypted but the
// server certificate is not verified. Certificate parameters in the URL
// itself (sslrootcert/sslcert/sslkey) are left to pg.
function resolvePgConnection(databaseUrl) {
  const url = new URL(databaseUrl);
  const params = url.searchParams;
  if (params.has('sslrootcert') || params.has('sslcert') || params.has('sslkey')) {
    return { connectionString: databaseUrl, ssl: undefined };
  }
  const sslmode = params.get('sslmode');
  params.delete('sslmode');
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const ca = (process.env.FLOW_PG_SSL_CA || '').replace(/\\n/g, '\n').trim();
  let ssl;
  if (sslmode === 'disable' || (isLocal && !sslmode)) {
    ssl = false;
  } else if (ca) {
    ssl = { ca, rejectUnauthorized: true };
  } else if (sslmode === 'verify-full' || sslmode === 'verify-ca') {
    ssl = { rejectUnauthorized: true };
  } else {
    ssl = { rejectUnauthorized: false };
    console.warn(
      '[flow] PostgreSQL TLS certificate is not verified; set FLOW_PG_SSL_CA to your provider CA (e.g. the Supabase root certificate) to verify it.'
    );
  }
  return { connectionString: url.toString(), ssl };
}

async function openPostgres(databaseUrl) {
  const { default: pg } = await import('pg');
  const { connectionString, ssl } = resolvePgConnection(databaseUrl);
  const pool = new pg.Pool({
    connectionString,
    ssl,
    // Small by default: serverless instances each open their own pool.
    max: Number(process.env.FLOW_PG_POOL_MAX) || 3,
    types: {
      getTypeParser(oid, format) {
        switch (oid) {
          case PG_OID.INT8:
          case PG_OID.NUMERIC:
            return (value) => Number(value);
          case PG_OID.JSON:
          case PG_OID.JSONB:
            return (value) => value; // keep JSON as text, like SQLite
          case PG_OID.TIMESTAMPTZ:
            return (value) => pgTimestampToIso(value, false);
          case PG_OID.TIMESTAMP:
            return (value) => pgTimestampToIso(value, true);
          default:
            return pg.types.getTypeParser(oid, format);
        }
      },
    },
  });
  // An idle client losing its connection must not crash the process.
  pool.on('error', (err) => {
    console.error('[flow] PostgreSQL pool error:', err.message);
  });

  const statements = new Map();
  const toPg = (sql) => {
    let text = statements.get(sql);
    if (text === undefined) {
      text = toPgPlaceholders(sql);
      statements.set(sql, text);
    }
    return text;
  };
  const bind = (params) => params.map((v) => (v === undefined ? null : v));

  const makeConnection = (queryable, inTransaction) => {
    let savepointSeq = 0;
    const conn = {
      dialect: 'postgres',
      async get(sql, ...params) {
        return (await queryable.query(toPg(sql), bind(params))).rows[0];
      },
      async all(sql, ...params) {
        return (await queryable.query(toPg(sql), bind(params))).rows;
      },
      async run(sql, ...params) {
        const result = await queryable.query(toPg(sql), bind(params));
        return { changes: result.rowCount ?? 0 };
      },
      async exec(sql) {
        await queryable.query(sql);
      },
      async transaction(fn) {
        if (inTransaction) {
          const name = `flow_sp_${++savepointSeq}`;
          await queryable.query(`SAVEPOINT ${name}`);
          try {
            const result = await fn(conn);
            await queryable.query(`RELEASE SAVEPOINT ${name}`);
            return result;
          } catch (err) {
            await queryable.query(`ROLLBACK TO SAVEPOINT ${name}`);
            throw err;
          }
        }
        // Every statement of the transaction must run on this one client.
        const client = await pool.connect();
        let broken = false;
        try {
          await client.query('BEGIN');
          const result = await fn(makeConnection(client, true));
          await client.query('COMMIT');
          return result;
        } catch (err) {
          await client.query('ROLLBACK').catch(() => {
            broken = true;
          });
          throw err;
        } finally {
          // A connection that cannot roll back is discarded, not reused.
          client.release(broken);
        }
      },
      // Held until the surrounding transaction ends.
      async lock(key) {
        await queryable.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
      },
      async close() {
        await pool.end();
      },
    };
    return conn;
  };

  return makeConnection(pool, false);
}
